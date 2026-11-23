import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Lógica de entrega de compras (copiada a propósito dentro de esta función).
// El editor del dashboard de Supabase despliega un único archivo por función,
// así que no puede resolver `../_shared/...`. Mantener sincronizada esta copia
// con la de `verify-checkout-session/index.ts`.
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
 * Descuenta existencias de lo vendido (sellados, cartas sueltas e inversiones).
 * Es best-effort: un fallo se registra y se sigue con el resto, porque la venta
 * ya quedó asentada y no debe revertirse por el stock.
 */
async function decrementStockForItems(supabase: any, items: any[]): Promise<void> {
  for (const it of items) {
    if (!it?.id || !it?.source) continue;
    const qty = Math.max(1, Number(it.quantity || 1));
    try {
      if (it.source === "sealed") {
        const { data: prod } = await supabase
          .from("sealed_products")
          .select("stock, quantity, status")
          .eq("id", it.id)
          .maybeSingle();
        if (!prod) continue;
        const current = prod.stock !== undefined && prod.stock !== null
          ? parseInt(prod.stock)
          : parseInt(prod.quantity);
        const next = Math.max(0, (Number.isFinite(current) ? current : 1) - qty);
        await supabase
          .from("sealed_products")
          .update({ stock: next, quantity: next, status: next === 0 ? "Agotado" : (prod.status || "Disponible") })
          .eq("id", it.id);
      } else if (it.source === "card") {
        const { data: card } = await supabase
          .from("viking_data")
          .select("quantity")
          .eq("id", it.id)
          .maybeSingle();
        if (!card) continue;
        const current = parseInt(card.quantity);
        const next = Math.max(0, (Number.isFinite(current) ? current : 1) - qty);
        await supabase.from("viking_data").update({ quantity: next }).eq("id", it.id);
      } else if (it.source === "investment") {
        const { data: inv } = await supabase
          .from("investment_cards")
          .select("quantity")
          .eq("id", it.id)
          .maybeSingle();
        if (!inv) continue;
        const current = parseInt(inv.quantity);
        const next = Math.max(0, (Number.isFinite(current) ? current : 1) - qty);
        const patch: Record<string, unknown> = { quantity: next };
        // is_sold es contabilidad del dueño: solo se marca agotada públicamente
        if (next === 0) patch.is_available = false;
        await supabase.from("investment_cards").update(patch).eq("id", it.id);
      }
    } catch (e: any) {
      console.error(`stock decrement failed (${it.source}/${it.id}):`, e?.message || e);
    }
  }
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

      // Descontar stock (sellados, cartas sueltas e inversiones)
      await decrementStockForItems(supabase, items);
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


const STRIPE_WEBHOOK_SECRET = (Deno.env.get("STRIPE_WEBHOOK_SECRET") || "").trim();
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Tolerancia para evitar reenvíos de firmas antiguas (replay)
const SIGNATURE_TOLERANCE_SECONDS = 300;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ADMIN_ROLES = ["admin", "superadmin", "admin_store"];

function isAdminRole(role: unknown): boolean {
  return ADMIN_ROLES.includes(String(role || "").toLowerCase());
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  if (!header || !secret) return false;

  const parts = header.split(",");
  let timestamp = "";
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.trim().split("=");
    if (key === "t") timestamp = value;
    if (key === "v1" && value) signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return false;

  const timestampNum = parseInt(timestamp, 10);
  if (!Number.isFinite(timestampNum)) return false;
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampNum);
  if (ageSeconds > SIGNATURE_TOLERANCE_SECONDS) return false;

  const encoder = new TextEncoder();
  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expectedSig = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signatures.some((sig) => timingSafeEqual(expectedSig, sig));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
      },
    });
  }

  try {
    // Sin secreto de webhook no se puede validar la firma: se rechaza todo.
    // (Antes se aceptaba cualquier POST sin firma y se podían desbloquear
    //  compras y suscripciones gratis.)
    if (!STRIPE_WEBHOOK_SECRET) {
      console.error("STRIPE_WEBHOOK_SECRET no está configurado: se rechazan los webhooks.");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const signatureHeader = req.headers.get("stripe-signature") || "";
    const bodyText = await req.text();

    const isValid = await verifyStripeSignature(bodyText, signatureHeader, STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
      console.error("Invalid Stripe signature");
      return new Response(JSON.stringify({ error: "Invalid Stripe signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(bodyText);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        // Solo se entregan compras realmente pagadas.
        if (session.mode === "payment" && session.payment_status !== "paid") {
          console.log(`Session ${session.id} not paid (status=${session.payment_status}); skipping.`);
          break;
        }

        await applyPaidCheckoutSession(supabase, session);
        break;
      }

      case "checkout.session.async_payment_succeeded": {
        // Métodos de pago diferidos (OXXO, etc.)
        await applyPaidCheckoutSession(supabase, event.data.object);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const customerId = sub.customer;
        const status = sub.status;

        const { data: user } = await supabase
          .from("usuarios")
          .select("id, role")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (user) {
          const updateData: any = {
            subscription_status: status,
            stripe_subscription_id: sub.id || null,
          };
          if (sub.current_period_end) {
            updateData.subscription_end = new Date(sub.current_period_end * 1000).toISOString();
          }
          if ((status === "active" || status === "trialing") && !isAdminRole(user.role)) {
            updateData.role = "premium";
          }
          await supabase.from("usuarios").update(updateData).eq("id", user.id);

          const isActive = status === "active" || status === "trialing";
          await supabase.from("widget_domains").update({ is_active: isActive }).eq("user_id", user.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const customerId = sub.customer;

        const { data: user } = await supabase
          .from("usuarios")
          .select("id, role")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (user) {
          // No se degrada a un administrador
          const newRole = user.role === "admin" || user.role === "superadmin" || user.role === "admin_store"
            ? user.role
            : "starter";

          await supabase
            .from("usuarios")
            .update({ subscription_status: "canceled", role: newRole })
            .eq("id", user.id);

          await supabase.from("widget_domains").update({ is_active: false }).eq("user_id", user.id);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const { data: user } = await supabase
          .from("usuarios")
          .select("id, role")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (user) {
          const updateData: any = { subscription_status: "active" };
          if (!isAdminRole(user.role)) updateData.role = "premium";
          await supabase.from("usuarios").update(updateData).eq("id", user.id);

          await supabase.from("widget_domains").update({ is_active: true }).eq("user_id", user.id);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const { data: user } = await supabase
          .from("usuarios")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (user) {
          await supabase.from("usuarios").update({ subscription_status: "past_due" }).eq("id", user.id);
          await supabase.from("widget_domains").update({ is_active: false }).eq("user_id", user.id);
        }
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
