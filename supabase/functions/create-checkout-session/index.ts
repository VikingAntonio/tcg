import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
    const stripePriceId = (Deno.env.get("STRIPE_PRICE_ID") || "").trim();

    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: "Falta configurar STRIPE_SECRET_KEY en las variables de entorno de Supabase." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!stripePriceId) {
      return new Response(JSON.stringify({ error: "Falta configurar STRIPE_PRICE_ID en las variables de entorno de Supabase." }), {
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
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          authUserId = user.id;
          authUserEmail = user.email || null;
        }
      }
    }

    const reqBody = await req.json().catch(() => ({}));
    const userId = authUserId || reqBody.user_id;

    if (!userId) {
      return new Response(JSON.stringify({ error: "Usuario no autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get user details from database
    const { data: userProfile } = await supabase
      .from("usuarios")
      .select("id, username, store_name, stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    let customerId = userProfile?.stripe_customer_id;

    // If customer doesn't exist on Stripe yet, create one using Stripe API via fetch
    if (!customerId) {
      const customerParams = new URLSearchParams();
      if (authUserEmail) customerParams.append("email", authUserEmail);
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

      // Save customerId in database
      await supabase
        .from("usuarios")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);
    }

    const redirectOrigin = reqBody.return_url || "https://vikingtcg.xyz/widgets.html";

    // Build Stripe Checkout Session request parameters
    const params = new URLSearchParams();
    params.append("customer", customerId);
    params.append("mode", "subscription");
    params.append("payment_method_types[0]", "card");
    params.append("line_items[0][price]", stripePriceId);
    params.append("line_items[0][quantity]", "1");
    params.append("client_reference_id", userId);
    params.append("metadata[user_id]", userId);
    params.append("success_url", `${redirectOrigin}?payment=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${redirectOrigin}?payment=canceled`);

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
    return new Response(JSON.stringify({ error: err.message || "Error procesando el pago." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
