import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Precio de mercado por código de impresión (RA03-EN123) usando TCGCSV, el
// espejo público diario del catálogo y los precios de TCGplayer. Se usa desde
// el navegador porque tcgcsv.com no manda cabeceras CORS.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const TCGCSV = "https://tcgcsv.com/tcgplayer";
const CATEGORY_YUGIOH = 2;
const TTL_MS = 6 * 60 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Caché en memoria del isolate: evita repetir descargas de set completo.
const cache = new Map<string, { at: number; value: unknown }>();

// TCGCSV responde 401 al User-Agent por defecto de Deno.
const REQUEST_HEADERS = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; tcg-market-price/1.0)",
};

async function getJson(url: string): Promise<any> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, { headers: REQUEST_HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const value = await res.json();
    cache.set(url, { at: Date.now(), value });
    return value;
  } finally {
    clearTimeout(timer);
  }
}

const results = (payload: any): any[] =>
  Array.isArray(payload) ? payload : (payload && Array.isArray(payload.results) ? payload.results : []);

function extendedValue(product: any, name: string): string {
  const entries = (product && product.extendedData) || [];
  const found = entries.find((e: any) => String(e.name || "").toLowerCase() === name.toLowerCase());
  return found ? String(found.value ?? "") : "";
}

function normalizeCode(value: string): string {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let code = url.searchParams.get("code") || "";

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      code = code || body.code || "";
    }

    const clean = String(code).trim().toUpperCase();
    if (!/^[A-Z0-9]{2,6}-[A-Z0-9]{0,4}\d{1,4}$/.test(clean)) {
      return json({ found: false, error: "Código inválido. Ejemplo: RA03-EN123" }, 400);
    }

    const prefix = clean.split("-")[0];
    const groups = results(await getJson(`${TCGCSV}/${CATEGORY_YUGIOH}/groups`));
    const group = groups.find((g: any) => String(g.abbreviation || "").toUpperCase() === prefix);
    if (!group) return json({ found: false, code: clean, error: "Set no encontrado" });

    const groupId = group.groupId;
    const [products, prices] = await Promise.all([
      getJson(`${TCGCSV}/${CATEGORY_YUGIOH}/${groupId}/products`),
      getJson(`${TCGCSV}/${CATEGORY_YUGIOH}/${groupId}/prices`),
    ]);

    const wanted = normalizeCode(clean);
    const matches = results(products).filter((p: any) => normalizeCode(extendedValue(p, "Number")) === wanted);
    if (!matches.length) return json({ found: false, code: clean, setName: group.name, error: "Impresión no encontrada" });

    const priceByProduct = new Map<number, any>();
    results(prices).forEach((p: any) => priceByProduct.set(Number(p.productId), p));

    const options = matches
      .map((p: any) => {
        const price = priceByProduct.get(Number(p.productId)) || {};
        const market = Number(price.marketPrice ?? price.midPrice ?? 0);
        return {
          productId: Number(p.productId),
          name: p.name,
          rarity: extendedValue(p, "Rarity"),
          variant: price.subTypeName || "",
          marketPrice: Number.isFinite(market) && market > 0 ? market : null,
          lowPrice: Number(price.lowPrice ?? 0) || null,
          midPrice: Number(price.midPrice ?? 0) || null,
          highPrice: Number(price.highPrice ?? 0) || null,
        };
      })
      .filter((o: any) => o.marketPrice !== null)
      .sort((a: any, b: any) => b.marketPrice - a.marketPrice);

    if (!options.length) {
      return json({ found: false, code: clean, setName: group.name, error: "Sin precio en TCGplayer" });
    }

    // Varias artes/rarezas comparten código: se devuelve la de mayor valor y
    // la lista completa por si conviene usar otra.
    const best = options[0];
    return json({
      found: true,
      code: clean,
      name: best.name,
      setName: group.name,
      rarity: best.rarity,
      variant: best.variant,
      productId: best.productId,
      price: best.marketPrice,
      currency: "USD",
      source: "TCGplayer",
      updatedAt: new Date().toISOString(),
      options: options.slice(0, 12),
    });
  } catch (error) {
    return json({ found: false, error: String((error as Error)?.message || error) }, 502);
  }
});
