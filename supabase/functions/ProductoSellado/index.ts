import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { isSealedProductIntent, buildSealedProductSystemPrompt } from "../ProductoSellado.ts";

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { prompt = '', is_admin = false, db_context = '' } = body;

    const isIntent = isSealedProductIntent(prompt);
    const systemPrompt = buildSealedProductSystemPrompt(db_context, is_admin);

    return new Response(
      JSON.stringify({
        is_sealed_product_intent: isIntent,
        system_prompt_extension: systemPrompt
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
