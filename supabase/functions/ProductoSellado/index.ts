// ====================================================================
// GEMINI AI PRODUCTO SELLADO HELPER / HANDLER (supabase/functions/ProductoSellado/index.ts)
// ====================================================================
// Edge Function autónoma para Producto Sellado compatible con Supabase CLI Bundler.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export interface SealedProductDraft {
  name?: string;
  price?: string;
  discount?: string;
  cost_price?: string;
  status?: string;
  stock?: number;
  tcg?: string;
  description?: string;
  image_url?: string;
  is_public?: boolean;
}

export function isSealedProductIntent(promptText: string): boolean {
  if (!promptText) return false;
  const lower = promptText.toLowerCase();
  return (
    lower.includes('producto sellado') ||
    lower.includes('nuevo producto') ||
    lower.includes('agregar producto') ||
    lower.includes('agrega un producto') ||
    lower.includes('añadir producto') ||
    lower.includes('tengo este producto') ||
    lower.includes('vender producto') ||
    lower.includes('registrar producto') ||
    lower.includes('crear producto')
  );
}

export function buildSealedProductSystemPrompt(dbContext: string, isAdmin: boolean): string {
  if (isAdmin) {
    return `
--- CONTEXTO DE PRODUCTOS SELLADOS EN TIENDA (ADMINISTRADOR) ---
Tienes acceso completo como Administrador de la tienda. Puedes consultar y administrar todos los datos privados y públicos de productos sellados.

DATOS DISPONIBLES EN SISTEMA:
${dbContext}

REGLAS DE PRODUCTO SELLADO PARA ADMINISTRADOR:
1. Si el usuario te indica que desea agregar o modificar un producto sellado ("agrega un nuevo producto", "tengo este producto sellado", etc.), actúa como un asistente eficiente y amable.
2. Ve recopilando los datos del producto (Nombre, Precio de venta, Descuento, Precio de costo/compra, Stock, Estado "Disponible/Agotado/Poco Stock/En Camino", Franquicia TCG, Imagen).
3. Si faltan datos clave (como el nombre o el precio), pregúntale amablemente por ellos uno a uno o en grupo, manteniendo el borrador del producto dentro del mismo objeto sin duplicar registros.
4. Si el administrador te pregunta por los datos o ganancias de un producto, dale la información completa incluyendo costo de compra y ganancia unitaria estimada.
`;
  } else {
    return `
--- CONTEXTO DE PRODUCTOS SELLADOS EN TIENDA (CLIENTE PÚBLICO) ---
Eres un asistente de ventas de la tienda. Muestras ÚNICAMENTE la información pública permitida para clientes.

DATOS PÚBLICOS DISPONIBLES EN SISTEMA:
${dbContext}

REGLAS STRICTAS DE PRIVACIDAD PARA CLIENTES:
1. Muestra ÚNICAMENTE: Nombre del producto, Precio de venta, Descuento (si aplica), Estado ("Disponible", "Agotado", "Poco Stock", "En Camino"), Franquicia (TCG) y Descripción.
2. Queda ESTRICTAMENTE PROHIBIDO mostrar o revelar el precio de costo/compra y la ganancia del vendedor.
3. Si el cliente pregunta si un producto está disponible o cuál es su precio, responde amablemente con los datos públicos del catálogo.
`;
  }
}

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
