import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

import { getPendingTrackings } from "./getPendingTrackings.ts";
import { carrierSelector } from "./carrierSelector.ts";
import { carrierScraper } from "./carrierScraper.ts";
import { interpreter } from "./interpreter.ts";
import { dbUpdater } from "./dbUpdater.ts";
import { detector } from "./detector.ts";
import { notifier } from "./notifier.ts";
import { ProcessedTrackingResult } from "./types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch pending received packages
    const pendingTrackings = await getPendingTrackings(supabase);

    const processedResults: ProcessedTrackingResult[] = [];

    // 2. Loop through each package and process tracking update
    for (const item of pendingTrackings) {
      const trackingNumber = item.tracking_number || item.guia || "";
      const carrierName = item.carrier || item.paqueteria || "";

      if (!trackingNumber) {
        continue;
      }

      // Select carrier strategy
      const strategy = carrierSelector(carrierName);

      // Scrape package tracking status from web page
      const scrapeResult = await carrierScraper(trackingNumber, strategy, item.tracking_url);

      // Interpret raw text using Gemini AI into internal status
      const interpretation = await interpreter(scrapeResult, item.status);

      // Update database status
      let updateError: string | undefined;
      try {
        await dbUpdater(supabase, item.id, interpretation.status);
      } catch (err: any) {
        updateError = err.message;
      }

      processedResults.push({
        id: item.id,
        trackingNumber,
        carrier: strategy.name,
        previousStatus: item.status,
        newStatus: interpretation.status,
        isNewReadyForPickup: interpretation.status === 'ready_for_pickup' && item.status !== 'ready_for_pickup',
        error: updateError
      });
    }

    // 3. Detect packages newly ready for pickup that have not been notified
    const unnotifiedReadyItems = await detector(supabase);

    // 4. Send grouped notifications & mark notified
    const notificationsSent = await notifier(supabase, unnotifiedReadyItems);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        pendingCount: pendingTrackings.length,
        processedCount: processedResults.length,
        results: processedResults,
        notificationsSent
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Auto tracking check error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "Internal server error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
