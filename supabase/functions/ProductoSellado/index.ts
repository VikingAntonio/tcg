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
--- CONTEXTO COMPLETO DE PRODUCTOS SELLADOS Y VENTAS (ADMINISTRADOR) ---
Tienes acceso total como Administrador de la tienda a la tabla de productos sellados (public.sealed_products) e historial de ventas (public.sealed_product_sales).

DATOS DISPONIBLES EN SISTEMA:
${dbContext}

REGLAS DE PRODUCTO SELLADO Y VENTAS PARA ADMINISTRADOR:
1. Si el usuario te pregunta quién compró, qué compraron, o si un cliente pagó completo o solo apartó, consulta los registros de ventas y responde con los datos exactos.
2. Si el usuario desea agregar, modificar stock o actualizar un producto sellado, actúa como un asistente amable e interactivo.
3. Tienes acceso total a los datos privados (costo de compra, ganancias unitarias, stock real, estado, visibilidad).
4. No imprimas pensamientos internos, etiquetas ni razonamientos.
`;
  } else {
    return `
--- CONTEXTO DE PRODUCTOS SELLADOS EN TIENDA (CLIENTE PÚBLICO) ---
Eres un asistente de ventas de la tienda. Muestras ÚNICAMENTE la información pública permitida para clientes.

DATOS PÚBLICOS DISPONIBLES EN SISTEMA:
${dbContext}

REGLAS STRICTAS DE PRIVACIDAD PARA CLIENTES:
1. Muestra ÚNICAMENTE: Nombre del producto, Precio de venta, Descuento (si aplica), Estado ("Disponible", "Agotado", "Poco Stock", "En Camino"), Franquicia (TCG) y Descripción.
2. Queda ESTRICTAMENTE PROHIBIDO mostrar o revelar el precio de costo/compra, ganancias del vendedor o nombres de otros compradores.
3. Responde amablemente con los datos públicos del catálogo.
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
