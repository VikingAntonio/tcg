// Confirma una compra de Stripe del lado servidor.
//
// El navegador solo aporta el `session_id` que Stripe añade a la URL de retorno.
// Aquí se consulta la sesión real a Stripe y, si está pagada y pertenece al
// usuario autenticado, se entregan los artículos con `applyPaidCheckoutSession`
// (la misma ruta que usa el webhook). Así, manipular el frontend no desbloquea
// nada gratis y el resultado es idempotente.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { applyPaidCheckoutSession } from "../_shared/entitlements.ts";

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
