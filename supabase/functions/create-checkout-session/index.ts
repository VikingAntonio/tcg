import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fallback hardcoded Price ID for monthly 300 MXN subscription if not set in environment
const DEFAULT_PREMIUM_PRICE_ID = "price_1UXZhRC6W4MA8NCfJ2n0G9CJ";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: "Falta configurar STRIPE_SECRET_KEY en las variables de entorno de Supabase." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    let authUserId: string | null = null;
    let authUserEmail: string | null = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      if (token && token !== supabaseKey) {
        try {
          const { data: { user } } = await supabase.auth.getUser(token);
          if (user) {
            authUserId = user.id;
            authUserEmail = user.email || null;
          }
        } catch (_) {}
      }
    }

    const reqBody = await req.json().catch(() => ({}));
    const userId = authUserId || reqBody.user_id;

    if (!userId) {
      return new Response(JSON.stringify({ error: "Usuario no autenticado o ID de usuario no proporcionado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Determine purchase type: 'subscription' (default), 'spirit' (3D assistant), or 'sticker' (sticker purchase)
    const purchaseType = reqBody.purchase_type || "subscription";

    // Fetch user from DB
    const { data: userProfile } = await supabase
      .from("usuarios")
      .select("id, username, store_name, stripe_customer_id, email")
      .eq("id", userId)
      .maybeSingle();

    let customerId = userProfile?.stripe_customer_id;
    const userEmail = authUserEmail || userProfile?.email;

    // Create Stripe Customer if not existing
    if (!customerId) {
      const customerParams = new URLSearchParams();
      if (userEmail) customerParams.append("email", userEmail);
      customerParams.append("metadata[user_id]", userId);
      customerParams.append("name", userProfile?.store_name || userProfile?.username || "Usuario VikingTCG");

      const custRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: customerParams
      });

      const custData = await custRes.json();
      if (!custRes.ok) {
        throw new Error(custData.error?.message || "Error al crear cliente en Stripe.");
      }

      customerId = custData.id;

      await supabase
        .from("usuarios")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);
    }

    const redirectOrigin = reqBody.return_url || "https://vikingtcg.xyz/widgets.html";
    const params = new URLSearchParams();
    params.append("customer", customerId);
    params.append("client_reference_id", userId);
    params.append("metadata[user_id]", userId);
    params.append("payment_method_types[0]", "card");

    if (purchaseType === "spirit") {
      // ONE-TIME MICRO-PAYMENT FOR ASSISTANT / SPIRIT
      const spiritId = reqBody.spirit_id;
      if (!spiritId) {
        return new Response(JSON.stringify({ error: "Falta proporcionar el ID del asistente (spirit_id)." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Security: Query spirits table directly via service role to get verified server-side price
      const { data: spirit, error: spiritErr } = await supabase
        .from("spirits")
        .select("id, name, price_mxn, stripe_price_id, sale_status")
        .eq("id", spiritId)
        .maybeSingle();

      if (spiritErr || !spirit) {
        return new Response(JSON.stringify({ error: "El asistente seleccionado no fue encontrado." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      params.append("mode", "payment");
      params.append("metadata[purchase_type]", "spirit");
      params.append("metadata[spirit_id]", spirit.id.toString());
      params.append("metadata[spirit_name]", spirit.name || "Asistente 3D");

      // If a Stripe Price ID is explicitly configured for this assistant, use it directly
      if (spirit.stripe_price_id && spirit.stripe_price_id.trim().startsWith("price_")) {
        params.append("line_items[0][price]", spirit.stripe_price_id.trim());
        params.append("line_items[0][quantity]", "1");
      } else {
        // Otherwise, create dynamic line_item using server-side validated price_mxn (defaults to 50 MXN if missing/zero)
        const priceAmount = Math.max(10, Math.round((Number(spirit.price_mxn) || 50) * 100)); // in cents
        params.append("line_items[0][price_data][currency]", "mxn");
        params.append("line_items[0][price_data][unit_amount]", priceAmount.toString());
        params.append("line_items[0][price_data][product_data][name]", `Asistente 3D: ${spirit.name}`);
        params.append("line_items[0][price_data][product_data][description]", "Desbloqueo permanente de Asistente 3D en Viking TCG.");
        params.append("line_items[0][quantity]", "1");
      }

      params.append("success_url", `${redirectOrigin}?payment=success&type=spirit&spirit_id=${spirit.id}&session_id={CHECKOUT_SESSION_ID}`);
      params.append("cancel_url", `${redirectOrigin}?payment=canceled&type=spirit`);

    } else if (purchaseType === "sticker") {
      // ONE-TIME MICRO-PAYMENT FOR STICKER
      const stickerId = reqBody.sticker_id;
      if (!stickerId) {
        return new Response(JSON.stringify({ error: "Falta proporcionar el ID del sticker (sticker_id)." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Security: Query stickers table directly via service role to get verified server-side price
      const { data: sticker, error: stickerErr } = await supabase
        .from("stickers")
        .select("id, name, price_mxn, stripe_price_id, sale_status")
        .eq("id", stickerId)
        .maybeSingle();

      if (stickerErr || !sticker) {
        return new Response(JSON.stringify({ error: "El sticker seleccionado no fue encontrado." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      params.append("mode", "payment");
      params.append("metadata[purchase_type]", "sticker");
      params.append("metadata[sticker_id]", sticker.id.toString());
      params.append("metadata[sticker_name]", sticker.name || "Sticker");

      if (sticker.stripe_price_id && sticker.stripe_price_id.trim().startsWith("price_")) {
        params.append("line_items[0][price]", sticker.stripe_price_id.trim());
        params.append("line_items[0][quantity]", "1");
      } else {
        const priceAmount = Math.max(10, Math.round((Number(sticker.price_mxn) || 25) * 100)); // in cents
        params.append("line_items[0][price_data][currency]", "mxn");
        params.append("line_items[0][price_data][unit_amount]", priceAmount.toString());
        params.append("line_items[0][price_data][product_data][name]", `Sticker: ${sticker.name}`);
        params.append("line_items[0][price_data][product_data][description]", "Desbloqueo permanente de Sticker en Viking TCG.");
        params.append("line_items[0][quantity]", "1");
      }

      params.append("success_url", `${redirectOrigin}?payment=success&type=sticker&sticker_id=${sticker.id}&session_id={CHECKOUT_SESSION_ID}`);
      params.append("cancel_url", `${redirectOrigin}?payment=canceled&type=sticker`);

    } else {
      // SUBSCRIPTION PURCHASE (300 MXN MONTHLY)
      const envPriceId = (Deno.env.get("STRIPE_PRICE_ID") || "").trim();
      const finalPriceId = envPriceId || DEFAULT_PREMIUM_PRICE_ID;

      params.append("mode", "subscription");
      params.append("metadata[purchase_type]", "subscription");
      params.append("line_items[0][price]", finalPriceId);
      params.append("line_items[0][quantity]", "1");
      params.append("success_url", `${redirectOrigin}?payment=success&type=subscription&session_id={CHECKOUT_SESSION_ID}`);
      params.append("cancel_url", `${redirectOrigin}?payment=canceled&type=subscription`);
    }

    const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });

    const sessionData = await sessionRes.json();
    if (!sessionRes.ok) {
      throw new Error(sessionData.error?.message || "Error al crear sesión de Checkout de Stripe.");
    }

    return new Response(JSON.stringify({ url: sessionData.url, id: sessionData.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Error procesando el pago en Stripe." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
