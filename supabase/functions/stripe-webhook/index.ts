import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  if (!header || !secret) return false;

  const parts = header.split(",");
  let timestamp = "";
  let signature = "";

  for (const part of parts) {
    const [key, value] = part.trim().split("=");
    if (key === "t") timestamp = value;
    if (key === "v1") signature = value;
  }

  if (!timestamp || !signature) return false;

  const encoder = new TextEncoder();
  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );

  const expectedSig = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedSig === signature;
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
    const signatureHeader = req.headers.get("stripe-signature") || "";
    const bodyText = await req.text();

    // Verify webhook signature if secret is configured
    if (STRIPE_WEBHOOK_SECRET) {
      const isValid = await verifyStripeSignature(bodyText, signatureHeader, STRIPE_WEBHOOK_SECRET);
      if (!isValid) {
        console.error("Invalid Stripe signature");
        return new Response(JSON.stringify({ error: "Invalid Stripe signature" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const event = JSON.parse(bodyText);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (userId) {
          await supabase
            .from("usuarios")
            .update({
              subscription_status: "active",
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
            })
            .eq("id", userId);

          await supabase
            .from("widget_domains")
            .update({ is_active: true })
            .eq("user_id", userId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const customerId = sub.customer;
        const status = sub.status; // active, past_due, canceled, trialing, etc.

        const { data: user } = await supabase
          .from("usuarios")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          await supabase
            .from("usuarios")
            .update({ subscription_status: status })
            .eq("id", user.id);

          const isActive = status === "active" || status === "trialing";
          await supabase
            .from("widget_domains")
            .update({ is_active: isActive })
            .eq("user_id", user.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const customerId = sub.customer;

        const { data: user } = await supabase
          .from("usuarios")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          await supabase
            .from("usuarios")
            .update({ subscription_status: "canceled" })
            .eq("id", user.id);

          await supabase
            .from("widget_domains")
            .update({ is_active: false })
            .eq("user_id", user.id);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const { data: user } = await supabase
          .from("usuarios")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          await supabase
            .from("usuarios")
            .update({ subscription_status: "active" })
            .eq("id", user.id);

          await supabase
            .from("widget_domains")
            .update({ is_active: true })
            .eq("user_id", user.id);
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
          .single();

        if (user) {
          await supabase
            .from("usuarios")
            .update({ subscription_status: "past_due" })
            .eq("id", user.id);

          await supabase
            .from("widget_domains")
            .update({ is_active: false })
            .eq("user_id", user.id);
        }
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
