// Confirma una compra de Stripe del lado servidor.
//
// El navegador solo aporta el `session_id` que Stripe añade a la URL de retorno.
// Aquí se consulta la sesión real a Stripe y, si está pagada y pertenece al
// usuario autenticado, se entregan los artículos con `applyPaidCheckoutSession`
// (la misma ruta que usa el webhook). Así, manipular el frontend no desbloquea
// nada gratis y el resultado es idempotente.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// ---------------------------------------------------------------------------
// Lógica de entrega de compras (copiada a propósito dentro de esta función).
// El editor del dashboard de Supabase despliega un único archivo por función,
// así que no puede resolver `../_shared/...`. Mantener sincronizada esta copia
// con la de `stripe-webhook/index.ts`.
// ---------------------------------------------------------------------------

const CSV_COLUMN: Record<string, string> = {
  accessory: "purchased_accessory_ids",
  sticker: "purchased_sticker_ids",
  spirit: "purchased_spirit_ids",
  pack: "purchased_pack_ids",
};

function normalizeItemType(raw: string | null | undefined): string | null {
  const v = (raw || "").toLowerCase();
  if (v === "accessory" || v === "accessories") return "accessory";
  if (v === "sticker" || v === "stickers") return "sticker";
  if (v === "spirit" || v === "spirits" || v === "assistant") return "spirit";
  if (v === "pack" || v === "packs") return "pack";
  return null;
}

type EntitlementInput = {
  type: string;
  id: string;
  snapshot?: Record<string, unknown>;
  source?: string;
  pricePaid?: number;
  currency?: string;
  sessionId?: string | null;
  parentId?: string | null;
};

function splitIds(value: unknown): string[] {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Guarda los entitlements y mantiene sincronizadas las columnas CSV históricas
 * (`purchased_*_ids`) que todavía lee parte de la interfaz.
 */
async function grantEntitlements(
  supabase: any,
  userId: string,
  items: EntitlementInput[],
): Promise<EntitlementInput[]> {
  const valid = items.filter((it) => it && it.id && it.type && CSV_COLUMN[it.type]);
  if (!userId || valid.length === 0) return [];

  const rows = valid.map((it) => ({
    user_id: userId,
    item_type: it.type,
    item_id: String(it.id),
    item_snapshot: it.snapshot || {},
    source: it.source || "purchase",
    price_paid: Number(it.pricePaid) || 0,
    currency: it.currency || "MXN",
    stripe_session_id: it.sessionId || null,
    parent_item_id: it.parentId || null,
  }));

  const { error } = await supabase
    .from("user_entitlements")
    .upsert(rows, { onConflict: "user_id,item_type,item_id", ignoreDuplicates: false });

  if (error) {
    console.error("grantEntitlements upsert error:", error.message);
  }

  // Merge de las columnas CSV por tipo
  const byColumn = new Map<string, string[]>();
  for (const it of valid) {
    const col = CSV_COLUMN[it.type];
    if (!byColumn.has(col)) byColumn.set(col, []);
    byColumn.get(col)!.push(String(it.id));
  }

  const columns = Array.from(byColumn.keys());
  const { data: userRow } = await supabase
    .from("usuarios")
    .select(["id", ...columns].join(","))
    .eq("id", userId)
    .maybeSingle();

  if (userRow) {
    const updates: Record<string, string> = {};
    for (const [col, ids] of byColumn.entries()) {
      const merged = Array.from(new Set([...splitIds(userRow[col]), ...ids]));
      updates[col] = merged.join(",");
    }
    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await supabase.from("usuarios").update(updates).eq("id", userId);
      if (updErr) console.error("grantEntitlements csv update error:", updErr.message);
    }
  }

  return valid;
}

async function fetchSnapshot(supabase: any, type: string, id: string): Promise<Record<string, unknown>> {
  const table = type === "accessory" ? "accessories"
    : type === "sticker" ? "stickers"
    : type === "spirit" ? "spirits"
    : type === "pack" ? "product_packs"
    : null;
  if (!table) return {};
  const { data } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  return data || {};
}

/**
 * Aplica un checkout pagado. Es idempotente: puede ejecutarse desde el webhook
 * y desde `verify-checkout-session` sin duplicar compras.
 */
async function applyPaidCheckoutSession(supabase: any, session: any): Promise<{ granted: EntitlementInput[] }> {
  const userId: string | null = session?.client_reference_id || session?.metadata?.user_id || null;
  const metadata = session?.metadata || {};
  const purchaseType = normalizeItemType(metadata.purchase_type) ||
    (session?.mode === "subscription" ? "subscription" : null);
  const sessionId = session?.id || null;
  const amountPaid = Number(session?.amount_total || 0) / 100;

  if (!userId) return { granted: [] };

  // --- Suscripción (plan premium) ---
  if (purchaseType === "subscription") {
    // Un administrador conserva su rol aunque se suscriba
    const { data: profile } = await supabase
      .from("usuarios")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    const currentRole = String(profile?.role || "").toLowerCase();
    const isAdminRole = ["admin", "superadmin", "admin_store"].includes(currentRole);

    const updates: Record<string, unknown> = { subscription_status: "active" };
    if (session?.customer) updates.stripe_customer_id = session.customer;
    if (session?.subscription) updates.stripe_subscription_id = session.subscription;
    if (!isAdminRole) updates.role = "premium";

    if (session?.subscription && session?.current_period_end) {
      updates.subscription_end = new Date(Number(session.current_period_end) * 1000).toISOString();
    }

    await supabase.from("usuarios").update(updates).eq("id", userId);
    await supabase.from("widget_domains").update({ is_active: true }).eq("user_id", userId);
    return { granted: [] };
  }

  // --- Pack compuesto ---
  if (purchaseType === "pack") {
    const packId = metadata.pack_id;
    if (!packId) return { granted: [] };

    const pack = await fetchSnapshot(supabase, "pack", String(packId));
    const items: any[] = Array.isArray(pack?.items) ? pack.items as any[] : [];

    // Registro inmutable del pack (unique por sesión de Stripe = idempotente)
    const { data: existing } = await supabase
      .from("pack_purchases")
      .select("id")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (!existing) {
      const { error: packErr } = await supabase.from("pack_purchases").insert([{
        user_id: userId,
        pack_id: packId,
        pack_name: pack?.name || metadata.pack_name || "Pack",
        price_paid: amountPaid,
        delivered_items: items,
        stripe_session_id: sessionId,
      }]);
      if (packErr) console.error("pack_purchases insert error:", packErr.message);
    }

    const grants: EntitlementInput[] = items
      .map((it) => {
        const type = normalizeItemType(it?.category);
        if (!type || !it?.id) return null;
        return {
          type,
          id: String(it.id),
          snapshot: it,
          source: "pack",
          pricePaid: 0,
          sessionId,
          parentId: String(packId),
        } as EntitlementInput;
      })
      .filter(Boolean) as EntitlementInput[];

    // El pack en sí también queda en la cuenta
    grants.push({
      type: "pack",
      id: String(packId),
      snapshot: Object.keys(pack).length > 0 ? pack : { id: packId, name: metadata.pack_name },
      source: "purchase",
      pricePaid: amountPaid,
      sessionId,
    });

    const granted = await grantEntitlements(supabase, userId, grants);
    return { granted };
  }

  // --- Carrito de productos físicos ---
  if (purchaseType === "cart" || metadata.order_id) {
    const orderId = metadata.order_id;
    if (!orderId) return { granted: [] };

    const { data: order } = await supabase
      .from("checkout_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (!order || order.status === "paid") return { granted: [] };

    // "Reclamar" el pedido de forma atómica: si el webhook y la verificación
    // llegan a la vez, solo uno de los dos procesa la venta.
    const { data: claimed } = await supabase
      .from("checkout_orders")
      .update({ status: "paid", paid_at: new Date().toISOString(), stripe_session_id: sessionId })
      .eq("id", orderId)
      .eq("status", "pending")
      .select("id");

    if (!claimed || claimed.length === 0) return { granted: [] };

    const items: any[] = Array.isArray(order.items) ? order.items as any[] : [];

    try {
      // Agrupar por vendedor para que cada uno reciba su notificación
      const bySeller = new Map<string, any[]>();
      for (const it of items) {
        const seller = it.seller_id || "unknown";
        if (!bySeller.has(seller)) bySeller.set(seller, []);
        bySeller.get(seller)!.push(it);
      }

      for (const [sellerId, sellerItems] of bySeller.entries()) {
        if (!sellerId || sellerId === "unknown") continue;
        const total = sellerItems.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 1), 0);
        await supabase.from("sealed_product_sales").insert([{
          seller_id: sellerId,
          buyer_name: order.buyer_name || "Cliente",
          buyer_contact: order.buyer_contact || "",
          items: sellerItems,
          total_amount: total,
          payment_status: "Pagado con Tarjeta (Stripe)",
          is_read: false,
        }]);
      }

      // Descontar stock de productos sellados
      for (const it of items) {
        if (it.source !== "sealed" || !it.id) continue;
        const qty = Number(it.quantity || 1);
        const { data: prod } = await supabase
          .from("sealed_products")
          .select("stock, quantity, status")
          .eq("id", it.id)
          .maybeSingle();
        if (prod) {
          const currentStock = prod.stock !== undefined && prod.stock !== null
            ? parseInt(prod.stock)
            : (parseInt(prod.quantity) || 1);
          const newStock = Math.max(0, currentStock - qty);
          await supabase
            .from("sealed_products")
            .update({ stock: newStock, quantity: newStock, status: newStock === 0 ? "Agotado" : (prod.status || "Disponible") })
            .eq("id", it.id);
        }
      }
    } catch (e) {
      // Dejar el pedido reintentable si algo falló a mitad de camino
      await supabase.from("checkout_orders").update({ status: "pending" }).eq("id", orderId);
      throw e;
    }

    return { granted: [] };
  }

  // --- Artículo individual (accesorio / sticker / asistente 3D) ---
  if (purchaseType === "accessory" || purchaseType === "sticker" || purchaseType === "spirit") {
    const itemId = metadata[`${purchaseType}_id`];
    if (!itemId) return { granted: [] };

    const snapshot = await fetchSnapshot(supabase, purchaseType, String(itemId));
    const fallbackName = metadata[`${purchaseType}_name`] || "";

    const granted = await grantEntitlements(supabase, userId, [{
      type: purchaseType,
      id: String(itemId),
      snapshot: Object.keys(snapshot).length > 0 ? snapshot : { id: String(itemId), name: fallbackName },
      source: "purchase",
      pricePaid: amountPaid,
      sessionId,
    }]);

    if (purchaseType === "spirit") {
      await supabase.from("usuarios").update({ selected_spirit_id: String(itemId) }).eq("id", userId);
    }

    return { granted };
  }

  return { granted: [] };
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
    if (!stripeSecretKey) {
      return json({ error: "Falta configurar STRIPE_SECRET_KEY en Supabase." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en Supabase." }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return json({ error: "Debes iniciar sesión." }, 401);
    }

    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return json({ error: "Sesión inválida." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.session_id || "").trim();
    if (!sessionId.startsWith("cs_")) {
      return json({ error: "session_id inválido." }, 400);
    }

    const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { "Authorization": `Bearer ${stripeSecretKey}` },
    });
    const session = await stripeRes.json();

    if (!stripeRes.ok || !session?.id) {
      return json({ error: session?.error?.message || "No se encontró la sesión de pago." }, 404);
    }

    const ownerId = session.client_reference_id || session.metadata?.user_id || null;
    if (!ownerId || ownerId !== user.id) {
      return json({ error: "Esta compra no pertenece a tu cuenta." }, 403);
    }

    const isPaid = session.payment_status === "paid" ||
      (session.mode === "subscription" && session.status === "complete");

    if (!isPaid) {
      return json({ ok: false, pending: true, error: "El pago todavía no se ha confirmado." }, 409);
    }

    const { granted } = await applyPaidCheckoutSession(supabase, session);

    const { data: entitlements } = await supabase
      .from("user_entitlements")
      .select("item_type, item_id, item_snapshot, source, granted_at")
      .eq("user_id", user.id)
      .order("granted_at", { ascending: false });

    return json({
      ok: true,
      purchase_type: session.metadata?.purchase_type || (session.mode === "subscription" ? "subscription" : null),
      granted,
      entitlements: entitlements || [],
    });

  } catch (err: any) {
    console.error("verify-checkout-session error:", err);
    return json({ error: err.message || "No se pudo verificar el pago." }, 500);
  }
});
