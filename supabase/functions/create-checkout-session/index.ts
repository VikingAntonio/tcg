import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fallback price in MXN for premium subscription if not set in DB package_configs
const DEFAULT_PREMIUM_PRICE_MXN = 300;

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

    // Determine purchase type: 'subscription' (default), 'spirit' (3D assistant), 'sticker' (sticker purchase), or 'accessory' (deck accessory)
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
    // Note: Do not pass payment_method_types parameter as Stripe now automatically manages
    // payment methods from Dashboard Settings (dynamic payment methods).

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
      // Frontend client input is strictly ignored to prevent price manipulation.
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

      // If a Stripe Price ID is explicitly configured for this assistant, use it directly;
      // otherwise, securely create line_item using server-side validated price_mxn without requiring a Stripe Price ID.
      if (spirit.stripe_price_id && spirit.stripe_price_id.trim().startsWith("price_")) {
        params.append("line_items[0][price]", spirit.stripe_price_id.trim());
        params.append("line_items[0][quantity]", "1");
      } else {
        const priceAmount = Math.max(1000, Math.round((Number(spirit.price_mxn) || 50) * 100)); // in cents, min 10 MXN
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

      // Security: Query stickers table directly via service role to get verified server-side price.
      // Frontend client input is strictly ignored to prevent price manipulation.
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

      // If a Stripe Price ID is explicitly configured for this sticker, use it;
      // otherwise, securely create line_item using server-side validated price_mxn without requiring a Stripe Price ID.
      if (sticker.stripe_price_id && sticker.stripe_price_id.trim().startsWith("price_")) {
        params.append("line_items[0][price]", sticker.stripe_price_id.trim());
        params.append("line_items[0][quantity]", "1");
      } else {
        const priceAmount = Math.max(1000, Math.round((Number(sticker.price_mxn) || 25) * 100)); // in cents, min 10 MXN
        params.append("line_items[0][price_data][currency]", "mxn");
        params.append("line_items[0][price_data][unit_amount]", priceAmount.toString());
        params.append("line_items[0][price_data][product_data][name]", `Sticker: ${sticker.name}`);
        params.append("line_items[0][price_data][product_data][description]", "Desbloqueo permanente de Sticker en Viking TCG.");
        params.append("line_items[0][quantity]", "1");
      }

      params.append("success_url", `${redirectOrigin}?payment=success&type=sticker&sticker_id=${sticker.id}&session_id={CHECKOUT_SESSION_ID}`);
      params.append("cancel_url", `${redirectOrigin}?payment=canceled&type=sticker`);

    } else if (purchaseType === "accessory") {
      // ONE-TIME MICRO-PAYMENT FOR ACCESSORY (SLEEVES, DECKS, COINS, PLAYMAT)
      const accessoryId = reqBody.accessory_id;
      if (!accessoryId) {
        return new Response(JSON.stringify({ error: "Falta proporcionar el ID del accesorio (accessory_id)." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Security: Query accessories table directly via service role to get verified server-side price.
      // Frontend client input is strictly ignored to prevent price manipulation.
      const { data: accessory, error: accErr } = await supabase
        .from("accessories")
        .select("id, name, price_mxn, stripe_price_id, sale_status, category")
        .eq("id", accessoryId)
        .maybeSingle();

      if (accErr || !accessory) {
        return new Response(JSON.stringify({ error: "El accesorio seleccionado no fue encontrado." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      params.append("mode", "payment");
      params.append("metadata[purchase_type]", "accessory");
      params.append("metadata[accessory_id]", accessory.id.toString());
      params.append("metadata[accessory_name]", accessory.name || "Accesorio");
      params.append("metadata[accessory_category]", accessory.category || "sleeves");

      if (accessory.stripe_price_id && accessory.stripe_price_id.trim().startsWith("price_")) {
        params.append("line_items[0][price]", accessory.stripe_price_id.trim());
        params.append("line_items[0][quantity]", "1");
      } else {
        const priceAmount = Math.max(1000, Math.round((Number(accessory.price_mxn) || 25) * 100)); // in cents, min 10 MXN
        params.append("line_items[0][price_data][currency]", "mxn");
        params.append("line_items[0][price_data][unit_amount]", priceAmount.toString());
        params.append("line_items[0][price_data][product_data][name]", `Accesorio: ${accessory.name}`);
        params.append("line_items[0][price_data][product_data][description]", `Desbloqueo permanente de Accesorio (${accessory.category}) en Viking TCG.`);
        params.append("line_items[0][quantity]", "1");
      }

      params.append("success_url", `${redirectOrigin}?payment=success&type=accessory&accessory_id=${accessory.id}&session_id={CHECKOUT_SESSION_ID}`);
      params.append("cancel_url", `${redirectOrigin}?payment=canceled&type=accessory`);

    } else {
      // SUBSCRIPTION PURCHASE (PREMIUM PLAN)
      // Check if env variable STRIPE_PRICE_ID is set and starts with price_
      const envPriceId = (Deno.env.get("STRIPE_PRICE_ID") || "").trim();

      params.append("mode", "subscription");
      params.append("metadata[purchase_type]", "subscription");

      // Security: Query package_configs table for verified server-side price of premium plan
      let subscriptionPriceMxn = DEFAULT_PREMIUM_PRICE_MXN;
      try {
        const { data: pkgConfig } = await supabase
          .from("package_configs")
          .select("price_mxn")
          .eq("id", "premium")
          .maybeSingle();

        if (pkgConfig && Number(pkgConfig.price_mxn) > 0) {
          subscriptionPriceMxn = Number(pkgConfig.price_mxn);
        }
      } catch (_) {
        subscriptionPriceMxn = DEFAULT_PREMIUM_PRICE_MXN;
      }

      if (envPriceId && envPriceId.startsWith("price_")) {
        params.append("line_items[0][price]", envPriceId);
        params.append("line_items[0][quantity]", "1");
      } else {
        // Create recurring subscription directly via price_data without needing a pre-created Stripe Price ID.
        // Works seamlessly in test mode (sk-test) and live mode (sk-live) without manual dashboard setup!
        const unitAmountCents = Math.round(subscriptionPriceMxn * 100);
        params.append("line_items[0][price_data][currency]", "mxn");
        params.append("line_items[0][price_data][unit_amount]", unitAmountCents.toString());
        params.append("line_items[0][price_data][recurring][interval]", "month");
        params.append("line_items[0][price_data][product_data][name]", "Suscripción Viking TCG Pro");
        params.append("line_items[0][price_data][product_data][description]", "Acceso ilimitado a widgets, stickers y herramientas profesionales.");
        params.append("line_items[0][quantity]", "1");
      }

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
