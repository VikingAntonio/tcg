import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fallback price in MXN for premium subscription if not set in DB package_configs
const DEFAULT_PREMIUM_PRICE_MXN = 300;

// Stripe exige un mínimo de 10 MXN por cargo
const MIN_CHARGE_MXN = 10;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolvePromoPrice(supabase: any, productId: string, basePrice: number): Promise<{ price: number, isLimited: boolean, isExpired: boolean }> {
  try {
    const { data: promo } = await supabase
      .from('product_promotions')
      .select('*')
      .eq('product_id', productId)
      .eq('status', 'active')
      .maybeSingle();

    if (!promo) return { price: basePrice, isLimited: false, isExpired: false };

    const now = new Date();
    if (!promo.is_permanent) {
      if (promo.start_date && new Date(promo.start_date) > now) return { price: basePrice, isLimited: false, isExpired: false };
      if (promo.end_date && new Date(promo.end_date) < now) {
        return { price: basePrice, isLimited: promo.is_limited_time, isExpired: promo.is_limited_time };
      }
    }
    return { price: Number(promo.promo_price || basePrice), isLimited: Boolean(promo.is_limited_time), isExpired: false };
  } catch (e) {
    return { price: basePrice, isLimited: false, isExpired: false };
  }
}

function appendSimpleLineItem(params: URLSearchParams, index: number, name: string, description: string, amountMxn: number) {
  params.append(`line_items[${index}][price_data][currency]`, "mxn");
  params.append(`line_items[${index}][price_data][unit_amount]`, Math.round(amountMxn * 100).toString());
  params.append(`line_items[${index}][price_data][product_data][name]`, name);
  if (description) {
    params.append(`line_items[${index}][price_data][product_data][description]`, description);
  }
}

async function resolveCartItem(supabase: any, raw: any, fallbackSellerId: string | null) {
  const id = raw?.id || raw?.product_id;
  if (!id) return { error: "Hay un artículo inválido en el carrito." };

  const qty = Math.max(1, Math.min(99, parseInt(raw?.quantity ?? raw?.cart_quantity) || 1));

  // Los apartados/preventas se liquidan en tienda (no son un cargo único)
  if (raw?.is_preorder || raw?.preorder_id) {
    return { error: `"${raw?.name || 'Apartado'}" es un apartado: su pago se coordina directamente con la tienda y no se puede cobrar con tarjeta en este carrito.` };
  }

  // Los artículos digitales se cobran en su propia ficha (así el webhook sabe
  // exactamente qué entitlement entregar). Por el carrito se perdería la compra.
  const digitalTypes = ["accessory", "accessories", "sticker", "stickers", "spirit", "spirits", "assistant", "pack", "packs"];
  if (digitalTypes.includes(String(raw?.type || "").toLowerCase())) {
    return { error: `"${raw?.name || 'Este artículo'}" es digital: cómpralo desde su ficha para que quede guardado para siempre en tu cuenta.` };
  }

  const isInvestment = String(raw?.type || "").toLowerCase() === "investment";

  if (isInvestment) {
    const { data } = await supabase
      .from("investment_cards")
      .select("id, card_name, image_url, current_price, sale_price, quantity, user_id")
      .eq("id", id)
      .maybeSingle();
    if (!data) return { error: `La carta "${raw?.name || id}" ya no está disponible.` };
    // Se cobra el precio de venta público; el de mercado solo es respaldo
    // cuando la carta no tiene precio de venta fijado.
    const salePrice = Number(data.sale_price) || 0;
    const price = salePrice > 0 ? salePrice : (Number(data.current_price) || 0);
    if (price <= 0) return { error: `La carta "${data.card_name || raw?.name || id}" no tiene precio de venta configurado.` };
    const stock = parseInt(data.quantity);
    if (Number.isFinite(stock) && stock <= 0) {
      return { error: `"${data.card_name || raw?.name || id}" está agotado.` };
    }
    if (Number.isFinite(stock) && qty > stock) {
      return { error: `Solo quedan ${stock} unidad(es) de "${data.card_name || raw?.name || id}".` };
    }
    return {
      item: {
        id: String(data.id),
        source: "investment",
        name: data.card_name || raw?.name || "Carta",
        image_url: data.image_url || "",
        price,
        quantity: qty,
        seller_id: data.user_id || fallbackSellerId || null,
      },
    };
  }

  // Producto sellado
  const { data: sealed } = await supabase
    .from("sealed_products")
    .select("id, name, image_url, price, stock, quantity, user_id")
    .eq("id", id)
    .maybeSingle();

  if (sealed) {
    const price = Number(sealed.price) || 0;
    if (price <= 0) return { error: `"${sealed.name || id}" no tiene precio configurado.` };
    const stock = sealed.stock !== undefined && sealed.stock !== null ? parseInt(sealed.stock) : NaN;
    if (Number.isFinite(stock) && stock <= 0) {
      return { error: `"${sealed.name || id}" está agotado.` };
    }
    if (Number.isFinite(stock) && qty > stock) {
      return { error: `Solo quedan ${stock} unidad(es) de "${sealed.name || id}".` };
    }
    return {
      item: {
        id: String(sealed.id),
        source: "sealed",
        name: sealed.name || "Producto",
        image_url: sealed.image_url || "",
        price,
        quantity: qty,
        seller_id: sealed.user_id || fallbackSellerId || null,
      },
    };
  }

  // Carta / accesorio de la base general
  // `select("*")` a propósito: `quantity` puede no existir todavía en el
  // proyecto (migración O) y una lista de columnas rompería el SELECT entero.
  const { data: card } = await supabase
    .from("viking_data")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (card) {
    const price = Number(String(card.price ?? "").replace(/[^0-9.]/g, "")) || 0;
    if (price <= 0) return { error: `"${card.name || id}" no tiene precio configurado.` };
    const stock = parseInt(card.quantity);
    if (Number.isFinite(stock) && stock <= 0) {
      return { error: `"${card.name || id}" está agotado.` };
    }
    if (Number.isFinite(stock) && qty > stock) {
      return { error: `Solo quedan ${stock} unidad(es) de "${card.name || id}".` };
    }
    return {
      item: {
        id: String(card.id),
        source: "card",
        name: card.name || "Carta",
        image_url: card.image_url || "",
        price,
        quantity: qty,
        seller_id: card.user_id || fallbackSellerId || null,
      },
    };
  }

  return { error: `"${raw?.name || id}" ya no está disponible en la tienda.` };
}

function assertStripeMinimum(amountMxn: number, label: string) {
  if (amountMxn < MIN_CHARGE_MXN) {
    return `"${label}" cuesta $${amountMxn} MXN y Stripe exige un mínimo de $${MIN_CHARGE_MXN} MXN por cobro. Ajusta el precio en el panel.`;
  }
  return null;
}

// Evita que el navegador mande a Stripe a un dominio ajeno tras el pago.
function sanitizeReturnUrl(raw: unknown, originHeader: string | null): string {
  const fallback = "https://vikingtcg.xyz/widgets.html";
  try {
    const target = new URL(String(raw || ""));
    if (target.protocol !== "https:" && target.protocol !== "http:") {
      return originHeader || fallback;
    }
    if (originHeader) {
      const origin = new URL(originHeader);
      if (target.host !== origin.host) return origin.origin;
    }
    return target.toString();
  } catch (_) {
    return originHeader || fallback;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
    if (!stripeSecretKey) {
      return json({ error: "Falta configurar STRIPE_SECRET_KEY en las variables de entorno de Supabase." }, 400);
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
        } catch (_) { /* token inválido: se ignora */ }
      }
    }

    const reqBody = await req.json().catch(() => ({}));
    // El usuario autenticado manda; el body solo se usa si no hay sesión.
    let userId = authUserId || reqBody.user_id || null;

    if (authUserId && reqBody.user_id && reqBody.user_id !== authUserId) {
      const { data: authProfile } = await supabase
        .from("usuarios")
        .select("role")
        .eq("id", authUserId)
        .maybeSingle();
      if (!authProfile || !["admin", "superadmin", "admin_store"].includes(String(authProfile.role || ""))) {
        userId = authUserId;
      }
    }

    if (!userId) {
      return json({ error: "Usuario no autenticado o ID de usuario no proporcionado." }, 401);
    }

    // Determine purchase type: 'subscription' (default), 'spirit', 'sticker', 'accessory', 'pack' or 'cart'
    const purchaseType = String(reqBody.purchase_type || "subscription").toLowerCase();

    const { data: userProfile } = await supabase
      .from("usuarios")
      .select("id, username, store_name, stripe_customer_id, email")
      .eq("id", userId)
      .maybeSingle();

    let customerId = userProfile?.stripe_customer_id;
    const userEmail = authUserEmail || userProfile?.email;

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

    const redirectOrigin = sanitizeReturnUrl(reqBody.return_url, req.headers.get("origin"));
    const returnQuery = redirectOrigin.includes("?") ? "&" : "?";
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
        return json({ error: "Falta proporcionar el ID del asistente (spirit_id)." }, 400);
      }

      // Security: server-side price from the spirits table. Client input is ignored.
      const { data: spirit, error: spiritErr } = await supabase
        .from("spirits")
        .select("id, name, price_mxn, stripe_price_id, sale_status")
        .eq("id", spiritId)
        .maybeSingle();

      if (spiritErr || !spirit) {
        return json({ error: "El asistente seleccionado no fue encontrado." }, 404);
      }

      params.append("mode", "payment");
      params.append("metadata[purchase_type]", "spirit");
      params.append("metadata[spirit_id]", spirit.id.toString());
      params.append("metadata[spirit_name]", spirit.name || "Asistente 3D");

      // El precio que el admin guarda en packages.html (`price_mxn`) manda.
      // Solo se usa el Price de Stripe si la fila no tiene precio propio.
      const dbSpiritPrice = Number(spirit.price_mxn) || 0;
      const baseSpiritPrice = dbSpiritPrice > 0 ? dbSpiritPrice : 50;
      const promoInfo = await resolvePromoPrice(supabase, spirit.id.toString(), baseSpiritPrice);
      const effectiveSpiritPrice = promoInfo.price;

      if (dbSpiritPrice <= 0 && !promoInfo.isLimited && spirit.stripe_price_id && spirit.stripe_price_id.trim().startsWith("price_")) {
        params.append("line_items[0][price]", spirit.stripe_price_id.trim());
        params.append("line_items[0][quantity]", "1");
      } else {
        const minErr = assertStripeMinimum(effectiveSpiritPrice, spirit.name || "Asistente 3D");
        if (minErr) return json({ error: minErr }, 400);
        appendSimpleLineItem(params, 0, `Asistente 3D: ${spirit.name}`, "Desbloqueo permanente de Asistente 3D en Viking TCG.", effectiveSpiritPrice);
        params.append("line_items[0][quantity]", "1");
      }

      params.append("success_url", `${redirectOrigin}${returnQuery}payment=success&type=spirit&spirit_id=${spirit.id}&session_id={CHECKOUT_SESSION_ID}`);
      params.append("cancel_url", `${redirectOrigin}${returnQuery}payment=canceled&type=spirit`);

    } else if (purchaseType === "sticker") {
      // ONE-TIME MICRO-PAYMENT FOR STICKER
      const stickerId = reqBody.sticker_id;
      if (!stickerId) {
        return json({ error: "Falta proporcionar el ID del sticker (sticker_id)." }, 400);
      }

      // Security: server-side price from the stickers table.
      const { data: sticker, error: stickerErr } = await supabase
        .from("stickers")
        .select("id, name, price_mxn, stripe_price_id, sale_status")
        .eq("id", stickerId)
        .maybeSingle();

      if (stickerErr || !sticker) {
        return json({ error: "El sticker seleccionado no fue encontrado." }, 404);
      }

      params.append("mode", "payment");
      params.append("metadata[purchase_type]", "sticker");
      params.append("metadata[sticker_id]", sticker.id.toString());
      params.append("metadata[sticker_name]", sticker.name || "Sticker");

      const dbStickerPrice = Number(sticker.price_mxn) || 0;
      const baseStickerPrice = dbStickerPrice > 0 ? dbStickerPrice : 25;
      const promoInfo = await resolvePromoPrice(supabase, sticker.id.toString(), baseStickerPrice);
      const effectiveStickerPrice = promoInfo.price;

      if (dbStickerPrice <= 0 && !promoInfo.isLimited && sticker.stripe_price_id && sticker.stripe_price_id.trim().startsWith("price_")) {
        params.append("line_items[0][price]", sticker.stripe_price_id.trim());
        params.append("line_items[0][quantity]", "1");
      } else {
        const minErr = assertStripeMinimum(effectiveStickerPrice, sticker.name || "Sticker");
        if (minErr) return json({ error: minErr }, 400);
        appendSimpleLineItem(params, 0, `Sticker: ${sticker.name}`, "Desbloqueo permanente de Sticker en Viking TCG.", effectiveStickerPrice);
        params.append("line_items[0][quantity]", "1");
      }

      params.append("success_url", `${redirectOrigin}${returnQuery}payment=success&type=sticker&sticker_id=${sticker.id}&session_id={CHECKOUT_SESSION_ID}`);
      params.append("cancel_url", `${redirectOrigin}${returnQuery}payment=canceled&type=sticker`);

    } else if (purchaseType === "accessory") {
      // ONE-TIME MICRO-PAYMENT FOR ACCESSORY (SLEEVES, DECKS, COINS, PLAYMAT)
      const accessoryId = reqBody.accessory_id;
      if (!accessoryId) {
        return json({ error: "Falta proporcionar el ID del accesorio (accessory_id)." }, 400);
      }

      // Security: server-side price from the accessories table.
      const { data: accessory, error: accErr } = await supabase
        .from("accessories")
        .select("id, name, price_mxn, stripe_price_id, sale_status, category")
        .eq("id", accessoryId)
        .maybeSingle();

      if (accErr || !accessory) {
        return json({ error: "El accesorio seleccionado no fue encontrado." }, 404);
      }

      params.append("mode", "payment");
      params.append("metadata[purchase_type]", "accessory");
      params.append("metadata[accessory_id]", accessory.id.toString());
      params.append("metadata[accessory_name]", accessory.name || "Accesorio");
      params.append("metadata[accessory_category]", accessory.category || "sleeves");

      const dbAccPrice = Number(accessory.price_mxn) || 0;
      const baseAccPrice = dbAccPrice > 0 ? dbAccPrice : 25;
      const promoInfo = await resolvePromoPrice(supabase, accessory.id.toString(), baseAccPrice);
      const effectiveAccPrice = promoInfo.price;

      if (dbAccPrice <= 0 && !promoInfo.isLimited && accessory.stripe_price_id && accessory.stripe_price_id.trim().startsWith("price_")) {
        params.append("line_items[0][price]", accessory.stripe_price_id.trim());
        params.append("line_items[0][quantity]", "1");
      } else {
        const minErr = assertStripeMinimum(effectiveAccPrice, accessory.name || "Accesorio");
        if (minErr) return json({ error: minErr }, 400);
        appendSimpleLineItem(params, 0, `Accesorio: ${accessory.name}`, `Desbloqueo permanente de Accesorio (${accessory.category || 'accesorio'}) en Viking TCG.`, effectiveAccPrice);
        params.append("line_items[0][quantity]", "1");
      }

      params.append("success_url", `${redirectOrigin}${returnQuery}payment=success&type=accessory&accessory_id=${accessory.id}&session_id={CHECKOUT_SESSION_ID}`);
      params.append("cancel_url", `${redirectOrigin}${returnQuery}payment=canceled&type=accessory`);

    } else if (purchaseType === "pack") {
      // ONE-TIME PAYMENT FOR A COMPOSED PACK
      const packId = reqBody.pack_id;
      if (!packId) {
        return json({ error: "Falta proporcionar el ID del pack (pack_id)." }, 400);
      }

      // Security: price comes from product_packs, never from the browser
      const { data: pack, error: packErr } = await supabase
        .from("product_packs")
        .select("id, name, normal_price, promo_price, status, items")
        .eq("id", packId)
        .maybeSingle();

      if (packErr || !pack) {
        return json({ error: "El pack seleccionado no fue encontrado." }, 404);
      }

      if (String(pack.status || "") !== "published") {
        return json({ error: "El pack ya no está disponible." }, 400);
      }

      const packPrice = Number(pack.promo_price || pack.normal_price) || 0;
      if (packPrice <= 0) {
        return json({ error: "El pack no tiene precio configurado." }, 400);
      }

      const packMinErr = assertStripeMinimum(packPrice, pack.name || "Pack");
      if (packMinErr) return json({ error: packMinErr }, 400);

      params.append("mode", "payment");
      params.append("metadata[purchase_type]", "pack");
      params.append("metadata[pack_id]", String(pack.id));
      params.append("metadata[pack_name]", pack.name || "Pack");

      appendSimpleLineItem(params, 0, `Pack: ${pack.name}`, "Compra de pack en Viking TCG.", packPrice);
      params.append("line_items[0][quantity]", "1");

      params.append("success_url", `${redirectOrigin}${returnQuery}payment=success&type=pack&pack_id=${pack.id}&session_id={CHECKOUT_SESSION_ID}`);
      params.append("cancel_url", `${redirectOrigin}${returnQuery}payment=canceled&type=pack`);

    } else if (purchaseType === "cart") {
      // ONE-TIME PAYMENT FOR THE SHOPPING CART (físico + cartas)
      if (!authUserId) {
        return json({ error: "Debes iniciar sesión para pagar el carrito con tarjeta." }, 401);
      }

      const rawItems = Array.isArray(reqBody.items) ? reqBody.items : [];
      if (rawItems.length === 0) {
        return json({ error: "El carrito está vacío." }, 400);
      }

      const resolved: any[] = [];
      for (const raw of rawItems) {
        const res = await resolveCartItem(supabase, raw, reqBody.seller_id || null);
        if (!res || res.error) {
          return json({ error: res?.error || "Hay un artículo que ya no está disponible." }, 400);
        }
        resolved.push(res.item);
      }

      const total = resolved.reduce((sum, it) => sum + it.price * it.quantity, 0);
      if (total < MIN_CHARGE_MXN) {
        return json({ error: `El total mínimo para pagar con tarjeta es de $${MIN_CHARGE_MXN} MXN.` }, 400);
      }

      const { data: order, error: orderErr } = await supabase
        .from("checkout_orders")
        .insert([{
          user_id: userId,
          buyer_name: reqBody.buyer_name || "",
          buyer_contact: reqBody.buyer_email || reqBody.buyer_contact || "",
          items: resolved,
          total_amount: Number(total.toFixed(2)),
          currency: "MXN",
          status: "pending",
        }])
        .select("id")
        .single();

      if (orderErr || !order) {
        throw new Error(orderErr?.message || "No se pudo registrar el pedido.");
      }

      params.append("mode", "payment");
      params.append("metadata[purchase_type]", "cart");
      params.append("metadata[order_id]", String(order.id));

      resolved.forEach((it, idx) => {
        appendSimpleLineItem(params, idx, it.name, "", it.price);
        params.append(`line_items[${idx}][quantity]`, String(it.quantity));
      });

      params.append("success_url", `${redirectOrigin}${returnQuery}payment=success&type=cart&order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`);
      params.append("cancel_url", `${redirectOrigin}${returnQuery}payment=canceled&type=cart`);

    } else {
      // SUBSCRIPTION PURCHASE (PREMIUM PLAN)
      const envPriceId = (Deno.env.get("STRIPE_PRICE_ID") || "").trim();

      params.append("mode", "subscription");
      params.append("metadata[purchase_type]", "subscription");

      // Security: server-side price from package_configs (lo que el admin
      // guarda en packages.html). El Price de Stripe solo se usa si no hay precio.
      let hasDbPrice = false;
      let subscriptionPriceMxn = DEFAULT_PREMIUM_PRICE_MXN;
      try {
        const { data: pkgConfig } = await supabase
          .from("package_configs")
          .select("price_mxn")
          .eq("id", "premium")
          .maybeSingle();

        if (pkgConfig && Number(pkgConfig.price_mxn) > 0) {
          subscriptionPriceMxn = Number(pkgConfig.price_mxn);
          hasDbPrice = true;
        }
      } catch (_) {
        subscriptionPriceMxn = DEFAULT_PREMIUM_PRICE_MXN;
      }

      const promoInfo = await resolvePromoPrice(supabase, "plan_premium", subscriptionPriceMxn);
      const effectivePlanPrice = promoInfo.price;

      if (!hasDbPrice && !promoInfo.isLimited && envPriceId && envPriceId.startsWith("price_")) {
        params.append("line_items[0][price]", envPriceId);
        params.append("line_items[0][quantity]", "1");
      } else {
        const planMinErr = assertStripeMinimum(effectivePlanPrice, "Plan Premium");
        if (planMinErr) return json({ error: planMinErr }, 400);
        const unitAmountCents = Math.round(effectivePlanPrice * 100);
        params.append("line_items[0][price_data][currency]", "mxn");
        params.append("line_items[0][price_data][unit_amount]", unitAmountCents.toString());
        params.append("line_items[0][price_data][recurring][interval]", "month");
        params.append("line_items[0][price_data][product_data][name]", "Suscripción Viking TCG Pro");
        params.append("line_items[0][price_data][product_data][description]", "Acceso ilimitado a widgets, stickers y herramientas profesionales.");
        params.append("line_items[0][quantity]", "1");
      }

      params.append("success_url", `${redirectOrigin}${returnQuery}payment=success&type=subscription&session_id={CHECKOUT_SESSION_ID}`);
      params.append("cancel_url", `${redirectOrigin}${returnQuery}payment=canceled&type=subscription`);
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

    // Guardar la sesión en el pedido del carrito (trazabilidad + idempotencia del webhook)
    if (purchaseType === "cart" && sessionData.id && sessionData.metadata?.order_id) {
      await supabase
        .from("checkout_orders")
        .update({ stripe_session_id: sessionData.id })
        .eq("id", sessionData.metadata.order_id);
    }

    return json({ url: sessionData.url, id: sessionData.id });

  } catch (err: any) {
    return json({ error: err.message || "Error procesando el pago en Stripe." }, 500);
  }
});
