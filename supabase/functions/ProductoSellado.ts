// ====================================================================
// GEMINI AI PRODUCTO SELLADO HELPER / HANDLER (supabase/functions/ProductoSellado.ts)
// ====================================================================

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
