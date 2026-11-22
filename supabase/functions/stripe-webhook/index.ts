import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyPaidCheckoutSession } from "../_shared/entitlements.ts";

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
