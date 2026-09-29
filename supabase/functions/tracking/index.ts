import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Carrier Strategies ---
interface CarrierStrategy {
  name: string;
  buildTrackingUrl: (trackingNumber: string) => string;
}

function getCarrierStrategy(carrierInput?: string): CarrierStrategy {
  const input = (carrierInput || "").toLowerCase().trim();
  if (input.includes("correos") || input.includes("mexpost") || input.includes("sepomex")) {
    return {
      name: "Correos de México",
      buildTrackingUrl: (num) => `https://www.correosdemexico.gob.mx/sslservicios/seguimientoenvio/seguimiento.aspx?guia=${encodeURIComponent(num)}`
    };
  }
  if (input.includes("estafeta")) {
    return {
      name: "Estafeta",
      buildTrackingUrl: (num) => `https://www.estafeta.com/Herramientas/Rastreo?trackingNumber=${encodeURIComponent(num)}`
    };
  }
  if (input.includes("fedex")) {
    return {
      name: "FedEx",
      buildTrackingUrl: (num) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(num)}`
    };
  }
  if (input.includes("dhl")) {
    return {
      name: "DHL",
      buildTrackingUrl: (num) => `https://www.dhl.com/mx-es/home/rastreo.html?tracking-id=${encodeURIComponent(num)}`
    };
  }
  return {
    name: carrierInput || "Paquetería Genérica",
    buildTrackingUrl: (num) => `https://www.google.com/search?q=rastreo+${encodeURIComponent(carrierInput || '')}+${encodeURIComponent(num)}`
  };
}

// --- Carrier Scraper ---
async function scrapeCarrierData(trackingNumber: string, strategy: CarrierStrategy, overrideUrl?: string | null) {
  const carrierKey = strategy.name.toLowerCase();

  // 1. FedEx API
  if (carrierKey.includes("fedex")) {
    try {
      const fedexApiUrl = "https://www.fedex.com/trackingCal/track";
      const params = new URLSearchParams();
      params.append("data", JSON.stringify({
        TrackPackagesRequest: {
          appType: "WTRACK",
          appVersion: "1",
          supportBooleans: true,
          supportHTML: true,
          trackingInfoList: [{ trackingNumberInfo: { trackingNumber } }]
        }
      }));
      params.append("action", "trackpackages");
      params.append("format", "json");

      const fedexRes = await fetch(fedexApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        body: params.toString()
      });

      if (fedexRes.ok) {
        const json = await fedexRes.json();
        const packageList = json?.TrackPackagesResponse?.packageList;
        if (packageList && packageList.length > 0) {
          const pkg = packageList[0];
          const rawInfo = `Estado FedEx: ${pkg.keyStatus || ''} - ${pkg.statusWithDetails || ''} - Destino: ${pkg.destinationLocation || ''} - Entrega estimada: ${pkg.displayEstDeliveryDateTime || ''} - Eventos: ${(pkg.scanEventList || []).map((e: any) => e.scanDetails).join(', ')}`;
          return { success: true, rawText: rawInfo };
        }
      }
    } catch (e) {
      console.warn("FedEx API fetch failed:", e);
    }
  }

  // 2. Estafeta Form POST
  if (carrierKey.includes("estafeta")) {
    try {
      const estafetaUrl = "https://www.estafeta.com/Herramientas/Rastreo";
      const res = await fetch(estafetaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        body: `waybill=${encodeURIComponent(trackingNumber)}`
      });
      if (res.ok) {
        const html = await res.text();
        const cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ").replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (cleaned.length > 100) {
          return { success: true, rawText: cleaned.slice(0, 4000) };
        }
      }
    } catch (e) {
      console.warn("Estafeta POST failed:", e);
    }
  }

  // 3. Correos de México Form POST
  if (carrierKey.includes("correos")) {
    try {
      const correosUrl = "https://www.correosdemexico.gob.mx/sslservicios/seguimientoenvio/seguimiento.aspx";
      const getRes = await fetch(correosUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });
      if (getRes.ok) {
        const getHtml = await getRes.text();
        const viewStateMatch = getHtml.match(/id="__VIEWSTATE"\s+value="([^"]+)"/);
        const eventValidationMatch = getHtml.match(/id="__EVENTVALIDATION"\s+value="([^"]+)"/);

        const viewState = viewStateMatch ? viewStateMatch[1] : "";
        const eventValidation = eventValidationMatch ? eventValidationMatch[1] : "";

        const formParams = new URLSearchParams();
        if (viewState) formParams.append("__VIEWSTATE", viewState);
        if (eventValidation) formParams.append("__EVENTVALIDATION", eventValidation);
        formParams.append("txtGuia", trackingNumber);
        formParams.append("btnBuscar", "Buscar");

        const postRes = await fetch(correosUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          },
          body: formParams.toString()
        });

        if (postRes.ok) {
          const postHtml = await postRes.text();
          const cleaned = postHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ").replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

          if (cleaned.length > 50) {
            return { success: true, rawText: cleaned.slice(0, 4000) };
          }
        }
      }
    } catch (e) {
      console.warn("Correos de México WebForm POST failed:", e);
    }
  }

  // 4. Default Direct GET Fetch
  const targetUrl = overrideUrl || strategy.buildTrackingUrl(trackingNumber);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const html = await res.text();
      const cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ").replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (cleaned.length > 50) {
        return { success: true, rawText: cleaned.slice(0, 4000) };
      }
    }
  } catch (e) {
    console.warn("Direct GET fetch failed:", e);
  }

  return { success: false, rawText: `No se pudo obtener información de la guía ${trackingNumber}` };
}

// --- Gemini Interpreter ---
async function interpretStatusWithGemini(
  geminiApiKey: string,
  carrier: string,
  trackingNumber: string,
  rawText: string,
  previousStatus: string
) {
  if (!geminiApiKey || !rawText) {
    return { status: previousStatus || "pending", summary: "Sin datos para interpretar" };
  }

  const prompt = `Eres un sistema experto de rastreo de paquetes de logística para paqueterías (${carrier}).
Analiza el texto extraído del sitio web para la guía "${trackingNumber}".

ESTADO ANTERIOR: "${previousStatus}"
TEXTO EXTRAÍDO:
"""
${rawText}
"""

REGLAS STRICTAS DE MAPPING DE ESTADOS:
Mapea ÚNICAMENTE a uno de estos 5 estados exactos:

1. "ready_for_pickup":
   - ÚNICAMENTE Y EXCLUSIVAMENTE cuando la información confirme explícitamente que el paquete YA ESTÁ LISTO / DISPONIBLE EN VENTANILLA O EN SUCURSAL PARA QUE EL CLIENTE VAYA A RECOGERLO.
   - Ejemplos válidos: "En ventanilla", "Disponible para recoger", "Disponible en oficina", "En sucursal para entrega en ventanilla".
   - REGLA CRÍTICA DE CONSERVADURISMO: NO marcas como "ready_for_pickup" si solo dice "en tránsito", "en camino", "llegó a ciudad", "en ruta de entrega". Si no hay evidencia de que está en ventanilla/oficina para recoger, NO USES "ready_for_pickup".

2. "completed": cuando fue entregado al destinatario.
3. "returned": devuelto al remitente.
4. "in_transit": en tránsito, traslado, en camino o movimiento.
5. "pending": sin registro o pendiente.

Responde ÚNICAMENTE en JSON válido con este formato:
{
  "status": "ready_for_pickup" | "completed" | "returned" | "in_transit" | "pending",
  "summary": "Breve resumen de 1 frase del estado"
}`;

  const models = ["models/gemini-2.0-flash", "models/gemini-1.5-flash", "models/gemini-1.5-pro"];
  for (const modelName of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${geminiApiKey}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 256 }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        let clean = raw.replace(/```json/gi, "").replace(/```/gi, "").trim();
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        if (jsonMatch) clean = jsonMatch[0];

        const parsed = JSON.parse(clean);
        const validStatuses = ['pending', 'in_transit', 'ready_for_pickup', 'completed', 'returned'];
        const finalStatus = validStatuses.includes(parsed.status) ? parsed.status : previousStatus;

        return {
          status: finalStatus,
          summary: parsed.summary || "Estado interpretado"
        };
      }
    } catch (e) {
      console.warn(`Gemini interpret error with ${modelName}:`, e);
    }
  }

  return { status: previousStatus || "pending", summary: "Falló la interpretación de Gemini" };
}

// --- Main Handler ---
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const geminiApiKey = (Deno.env.get("Spirit") || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("OPENAI_API_KEY") || "").trim();

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch pending received trackings
    const { data: rawPending, error: fetchErr } = await supabase
      .from("tracking")
      .select("*")
      .eq("direction", "received")
      .not("status", "ilike", "completed")
      .not("status", "ilike", "entregado");

    if (fetchErr) {
      return new Response(JSON.stringify({ success: false, error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const pendingItems = (rawPending || []).filter((i: any) => {
      const s = (i.status || "").toLowerCase();
      return s !== "completed" && s !== "entregado" && s !== "cancelado";
    });

    const results = [];
    const nowIso = new Date().toISOString();

    // 2. Process each package
    for (const item of pendingItems) {
      const trackingNumber = item.tracking_number || item.guia || "";
      const carrierName = item.carrier || item.paqueteria || "";

      if (!trackingNumber) continue;

      const strategy = getCarrierStrategy(carrierName);
      const scraped = await scrapeCarrierData(trackingNumber, strategy, item.tracking_url);
      const interpreted = await interpretStatusWithGemini(geminiApiKey, strategy.name, trackingNumber, scraped.rawText, item.status);

      const updateData: Record<string, any> = {
        status: interpreted.status,
        last_checked_at: nowIso
      };

      if (interpreted.status === "completed") {
        updateData.completed_at = nowIso;
      }

      await supabase.from("tracking").update(updateData).eq("id", item.id);

      results.push({
        id: item.id,
        trackingNumber,
        carrier: strategy.name,
        previousStatus: item.status,
        newStatus: interpreted.status,
        summary: interpreted.summary
      });
    }

    // 3. Detect and create notifications for packages ready for pickup
    const { data: readyUnnotified } = await supabase
      .from("tracking")
      .select("*")
      .eq("status", "ready_for_pickup")
      .or("is_notified.eq.false,is_notified.is.null");

    const notifications: any[] = [];
    if (readyUnnotified && readyUnnotified.length > 0) {
      const userMap = new Map<string, any[]>();
      for (const r of readyUnnotified) {
        const list = userMap.get(r.user_id) || [];
        list.push(r);
        userMap.set(r.user_id, list);
      }

      for (const [userId, items] of userMap.entries()) {
        const count = items.length;
        const msg = count === 1
          ? "📦 Tienes 1 paquete listo para recoger."
          : `📦 Tienes ${count} paquetes listos para recoger.`;

        const ids = items.map((i: any) => i.id);

        // Mark notified
        await supabase.from("tracking").update({ is_notified: true, notified_at: nowIso }).in("id", ids);

        // Record alert in learn_items for chatbot / user dashboard context
        try {
          await supabase.from("learn_items").insert([{
            user_id: userId,
            title: "📦 Paquetes Listos para Recoger",
            content: msg,
            category: "notificación",
            type: "alerta_tracking",
            is_public: false,
            created_at: nowIso
          }]);
        } catch (e) {
          console.warn("Could not insert notification into learn_items:", e);
        }

        notifications.push({ userId, readyCount: count, message: msg, trackingIds: ids });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      timestamp: nowIso,
      processedCount: results.length,
      results,
      notifications
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
