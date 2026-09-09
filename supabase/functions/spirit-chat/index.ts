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
    const { user_id, store_id, message, image_base64, image_mime = "image/jpeg", is_admin: clientIsAdmin = false, conversation_history = [] } = await req.json();

    const requestMsg = message || "";
    if (!requestMsg && !image_base64) {
      return new Response(JSON.stringify({ reply: "Dime en qué te puedo ayudar hoy." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const geminiApiKey = (Deno.env.get("Spirit") || Deno.env.get("OPENAI_API_KEY") || "").trim();
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ reply: "Lo siento, la API Key no está configurada correctamente en el servidor." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    let is_admin = false;
    let authUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      if (token && token !== supabaseKey) {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          authUserId = user.id;
        }
      }
    }

    let targetUserId = store_id || user_id;
    if (!targetUserId) {
      if (authUserId) {
        targetUserId = authUserId;
      } else {
        const { data: firstUser } = await supabase.from("usuarios").select("id").limit(1).maybeSingle();
        if (firstUser) targetUserId = firstUser.id;
      }
    }

    if (clientIsAdmin && (!authUserId || authUserId === targetUserId || !store_id)) {
      is_admin = true;
    }

    // Helper to query external multi-TCG databases (Yu-Gi-Oh!, Pokémon TCG, Lorcana, etc.)
    async function queryExternalTCGCard(cardName: string) {
      const trimmed = cardName.trim();
      const results: any[] = [];

      // 1. Try Yu-Gi-Oh! via YGOPRODeck
      try {
        const res = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.data && data.data.length > 0) {
            data.data.slice(0, 5).forEach((c: any) => {
              results.push({
                card_name: c.name,
                type: c.type || "Monster",
                rarity: c.card_sets?.[0]?.set_rarity || c.rarity || "Common",
                image_url: c.card_images?.[0]?.image_url || "",
                desc: c.desc || "",
                tcg: "yugioh"
              });
            });
          }
        }
      } catch (e) {
        console.warn("YGOPRODeck fetch error:", e);
      }

      // 2. Try Pokémon TCG via Pokédex / TCGdex / Pokémon API
      try {
        const pokeRes = await fetch(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(trimmed)}`);
        if (pokeRes.ok) {
          const pokeData = await pokeRes.json();
          if (Array.isArray(pokeData) && pokeData.length > 0) {
            for (const pc of pokeData.slice(0, 3)) {
              if (pc.image) {
                results.push({
                  card_name: pc.name,
                  type: "Pokémon",
                  rarity: "Uncommon",
                  image_url: pc.image.endsWith('/high.webp') || pc.image.endsWith('/high.png') ? pc.image : `${pc.image}/high.png`,
                  desc: `Set: ${pc.id || 'Pokémon TCG'}`,
                  tcg: "pokemon"
                });
              }
            }
          }
        }
      } catch (e) {
        console.warn("TCGdex fetch error:", e);
      }

      // Fallback placeholder image generator if no external API returned image
      if (results.length === 0) {
        results.push({
          card_name: trimmed,
          type: "Carta TCG",
          rarity: "Standard",
          image_url: `https://images.ygoprodeck.com/images/cards/back_high.jpg`,
          desc: "Carta agregada",
          tcg: "generic"
        });
      }

      return results;
    }

    // Tools definition
    const tools = [
      {
        functionDeclarations: [
          {
            name: "get_store_info",
            description: "Obtiene información general del perfil de la tienda (nombre, contacto, redes, etc.).",
            parameters: {
              type: "OBJECT",
              properties: {
                userId: { type: "STRING" }
              }
            }
          },
          {
            name: "get_user_albums",
            description: "Lista todos los álbumes de la tienda.",
            parameters: { type: "OBJECT", properties: {} }
          },
          {
            name: "get_album_details",
            description: "Obtiene páginas y cartas de un álbum por ID o título.",
            parameters: {
              type: "OBJECT",
              properties: {
                albumId: { type: "STRING" },
                albumTitle: { type: "STRING" }
              }
            }
          },
          {
            name: "get_user_decks",
            description: "Lista todos los decks creados por la tienda.",
            parameters: { type: "OBJECT", properties: {} }
          },
          {
            name: "get_deck_details",
            description: "Obtiene las cartas de un deck por ID o nombre.",
            parameters: {
              type: "OBJECT",
              properties: {
                deckId: { type: "STRING" },
                deckName: { type: "STRING" }
              }
            }
          },
          {
            name: "get_sealed_products",
            description: "Obtiene productos sellados disponibles en la tienda.",
            parameters: { type: "OBJECT", properties: {} }
          },
          {
            name: "get_user_wishlist",
            description: "Obtiene las cartas de la lista de deseos (Wishlist/Buscamos) de la tienda.",
            parameters: { type: "OBJECT", properties: {} }
          },
          {
            name: "get_cart_and_payment_info",
            description: "Obtiene información sobre opciones de pago, carrito de compras, horario y métodos de entrega de la tienda.",
            parameters: { type: "OBJECT", properties: {} }
          },
          {
            name: "search_cards",
            description: "Busca cartas en el inventario local (álbumes, decks, sellados, wishlist) y bases TCG externas.",
            parameters: {
              type: "OBJECT",
              properties: {
                cardName: { type: "STRING", description: "Nombre de la carta a buscar" }
              },
              required: ["cardName"]
            }
          },
          {
            name: "create_album",
            description: "[SOLO ADMIN] Crea un nuevo álbum para la tienda.",
            parameters: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING" },
                coverImageUrl: { type: "STRING" }
              },
              required: ["title"]
            }
          },
          {
            name: "add_cards_to_album",
            description: "[SOLO ADMIN] Agrega cartas a un álbum. Las imágenes se buscan automáticamente si no se especifican.",
            parameters: {
              type: "OBJECT",
              properties: {
                albumId: { type: "STRING" },
                albumTitle: { type: "STRING" },
                cards: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      card_name: { type: "STRING" },
                      price: { type: "NUMBER" },
                      rarity: { type: "STRING" },
                      edition: { type: "STRING" },
                      language: { type: "STRING" },
                      image_url: { type: "STRING" },
                      foil_type: { type: "STRING" }
                    },
                    required: ["card_name"]
                  }
                }
              },
              required: ["cards"]
            }
          },
          {
            name: "remove_cards_from_album",
            description: "[SOLO ADMIN] Elimina cartas de un álbum.",
            parameters: {
              type: "OBJECT",
              properties: {
                albumId: { type: "STRING" },
                albumTitle: { type: "STRING" },
                cardName: { type: "STRING" }
              },
              required: ["cardName"]
            }
          },
          {
            name: "create_deck",
            description: "[SOLO ADMIN] Crea un nuevo deck.",
            parameters: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                format_tag: { type: "STRING" }
              },
              required: ["name"]
            }
          },
          {
            name: "add_cards_to_deck",
            description: "[SOLO ADMIN] Agrega cartas a un deck.",
            parameters: {
              type: "OBJECT",
              properties: {
                deckId: { type: "STRING" },
                deckName: { type: "STRING" },
                cards: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      card_name: { type: "STRING" },
                      quantity: { type: "NUMBER" },
                      section: { type: "STRING" },
                      card_type: { type: "STRING" },
                      image_url: { type: "STRING" }
                    },
                    required: ["card_name"]
                  }
                }
              },
              required: ["cards"]
            }
          },
          {
            name: "remove_cards_from_deck",
            description: "[SOLO ADMIN] Elimina cartas de un deck.",
            parameters: {
              type: "OBJECT",
              properties: {
                deckId: { type: "STRING" },
                deckName: { type: "STRING" },
                cardName: { type: "STRING" }
              },
              required: ["cardName"]
            }
          },
          {
            name: "add_to_wishlist",
            description: "[SOLO ADMIN] Agrega cartas a la lista de deseos / buscados (Wishlist).",
            parameters: {
              type: "OBJECT",
              properties: {
                cards: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      card_name: { type: "STRING" },
                      quantity: { type: "NUMBER" },
                      rarity: { type: "STRING" },
                      notes: { type: "STRING" },
                      image_url: { type: "STRING" }
                    },
                    required: ["card_name"]
                  }
                }
              },
              required: ["cards"]
            }
          },
          {
            name: "remove_from_wishlist",
            description: "[SOLO ADMIN] Elimina una carta de la lista de deseos.",
            parameters: {
              type: "OBJECT",
              properties: {
                wishlistId: { type: "STRING" },
                cardName: { type: "STRING" }
              }
            }
          },
          {
            name: "update_store_info",
            description: "[SOLO ADMIN] Actualiza la información básica de la tienda.",
            parameters: {
              type: "OBJECT",
              properties: {
                store_name: { type: "STRING" },
                whatsapp_link: { type: "STRING" },
                messenger_link: { type: "STRING" }
              }
            }
          }
        ]
      }
    ];

    async function executeToolCall(name: string, args: any) {
      const writeTools = [
        "create_album", "add_cards_to_album", "remove_cards_from_album",
        "create_deck", "add_cards_to_deck", "remove_cards_from_deck",
        "add_to_wishlist", "remove_from_wishlist", "update_store_info"
      ];

      if (writeTools.includes(name) && !is_admin) {
        return { error: "Acceso restringido: Solo el administrador en su panel puede realizar modificaciones." };
      }

      switch (name) {
        case "get_store_info": {
          const uId = args.userId || targetUserId;
          if (!uId) return { error: "No se encontró ID de usuario." };
          const { data: userRow } = await supabase.from("usuarios").select("id, username, store_name, whatsapp_link, messenger_link, profile_picture_url, store_banner_url").eq("id", uId).maybeSingle();
          return userRow || { message: "Perfil de tienda no encontrado." };
        }

        case "get_user_albums": {
          if (!targetUserId) return { error: "ID de usuario objetivo no especificado." };
          const { data: albums } = await supabase.from("albums").select("id, title, cover_image_url, position").eq("user_id", targetUserId).order("position", { ascending: true });
          return { albums: albums || [] };
        }

        case "get_album_details": {
          let albumId = args.albumId;
          if (!albumId && args.albumTitle && targetUserId) {
            const { data: found } = await supabase.from("albums").select("id").eq("user_id", targetUserId).ilike("title", `%${args.albumTitle}%`).limit(1).maybeSingle();
            if (found) albumId = found.id;
          }
          if (!albumId) return { error: "Álbum no encontrado." };

          const { data: pages } = await supabase.from("pages").select("id, page_index").eq("album_id", albumId).order("page_index", { ascending: true });
          if (!pages || pages.length === 0) return { albumId, pages: [], slots: [] };

          const pageIds = pages.map((p: any) => p.id);
          const { data: slots } = await supabase.from("card_slots").select("*").in("page_id", pageIds);
          return { albumId, pages, slots: slots || [] };
        }

        case "get_user_decks": {
          if (!targetUserId) return { error: "ID de usuario objetivo no especificado." };
          const { data: decks } = await supabase.from("decks").select("id, name, format_tag, is_public, created_at").eq("user_id", targetUserId).order("created_at", { ascending: false });
          return { decks: decks || [] };
        }

        case "get_deck_details": {
          let deckId = args.deckId;
          if (!deckId && args.deckName && targetUserId) {
            const { data: found } = await supabase.from("decks").select("id, name, format_tag").eq("user_id", targetUserId).ilike("name", `%${args.deckName}%`).limit(1).maybeSingle();
            if (found) deckId = found.id;
          }
          if (!deckId) return { error: "Deck no encontrado." };

          const { data: deckMeta } = await supabase.from("decks").select("*").eq("id", deckId).single();
          const { data: cards } = await supabase.from("deck_cards").select("*").eq("deck_id", deckId);
          return { deck: deckMeta, cards: cards || [] };
        }

        case "get_sealed_products": {
          if (!targetUserId) return { error: "ID de usuario objetivo no especificado." };
          const { data: products } = await supabase.from("sealed_products").select("*").eq("user_id", targetUserId);
          return { sealed_products: products || [] };
        }

        case "get_user_wishlist": {
          if (!targetUserId) return { error: "ID de usuario objetivo no especificado." };
          const { data: wishlist } = await supabase.from("wishlist").select("*").eq("user_id", targetUserId).order("created_at", { ascending: false });
          return { wishlist: wishlist || [] };
        }

        case "get_cart_and_payment_info": {
          const { data: userRow } = await supabase.from("usuarios").select("store_name, whatsapp_link, messenger_link").eq("id", targetUserId).maybeSingle();
          return {
            store_name: userRow?.store_name || "Viking TCG Store",
            whatsapp: userRow?.whatsapp_link || "",
            messenger: userRow?.messenger_link || "",
            metodos_pago: ["Transferencia Bancaria", "Efectivo en Tienda", "Mercado Pago / Tarjeta", "Coordinación directa por WhatsApp"],
            envios: "Envíos locales y nacionales previo acuerdo por WhatsApp.",
            instrucciones_compra: "Puedes agregar productos al carrito en la tienda pública y dar clic en 'Enviar Pedido por WhatsApp' para coordinar el pago y entrega."
          };
        }

        case "search_cards": {
          const q = args.cardName.trim();
          if (!q) return { results: [] };

          let albumSlots: any[] = [];
          if (targetUserId) {
            const { data: userAlbums } = await supabase.from("albums").select("id, title").eq("user_id", targetUserId);
            if (userAlbums && userAlbums.length > 0) {
              const albumIds = userAlbums.map((a: any) => a.id);
              const { data: albumPages } = await supabase.from("pages").select("id, album_id").in("album_id", albumIds);
              if (albumPages && albumPages.length > 0) {
                const pageMap = new Map(albumPages.map((p: any) => [p.id, p.album_id]));
                const albumTitleMap = new Map(userAlbums.map((a: any) => [a.id, a.title]));
                const pageIds = albumPages.map((p: any) => p.id);
                const { data: slots } = await supabase.from("card_slots").select("*").in("page_id", pageIds).ilike("card_name", `%${q}%`);
                if (slots) {
                  albumSlots = slots.map((s: any) => {
                    const albId = pageMap.get(s.page_id);
                    return { ...s, album_title: albumTitleMap.get(albId) || "Álbum", location: "Álbum" };
                  });
                }
              }
            }
          }

          let deckCardsArr: any[] = [];
          if (targetUserId) {
            const { data: userDecks } = await supabase.from("decks").select("id, name").eq("user_id", targetUserId);
            if (userDecks && userDecks.length > 0) {
              const deckMap = new Map(userDecks.map((d: any) => [d.id, d.name]));
              const deckIds = userDecks.map((d: any) => d.id);
              const { data: dCards } = await supabase.from("deck_cards").select("*").in("deck_id", deckIds).ilike("card_name", `%${q}%`);
              if (dCards) {
                deckCardsArr = dCards.map((c: any) => ({
                  ...c,
                  deck_name: deckMap.get(c.deck_id) || "Deck",
                  location: "Deck"
                }));
              }
            }
          }

          let sealedArr: any[] = [];
          if (targetUserId) {
            const { data: sProds } = await supabase.from("sealed_products").select("*").eq("user_id", targetUserId).ilike("name", `%${q}%`);
            if (sProds) {
              sealedArr = sProds.map((p: any) => ({ ...p, location: "Producto Sellado" }));
            }
          }

          let wishlistArr: any[] = [];
          if (targetUserId) {
            const { data: wCards } = await supabase.from("wishlist").select("*").eq("user_id", targetUserId).ilike("card_name", `%${q}%`);
            if (wCards) {
              wishlistArr = wCards.map((w: any) => ({ ...w, location: "Wishlist" }));
            }
          }

          // Search in external TCG API
          const externalMatch = await queryExternalTCGCard(q);

          return {
            query: q,
            in_albums: albumSlots,
            in_decks: deckCardsArr,
            sealed_products: sealedArr,
            in_wishlist: wishlistArr,
            external_tcg_database: externalMatch
          };
        }

        case "create_album": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          const { data: countData } = await supabase.from("albums").select("*", { count: "exact", head: true }).eq("user_id", targetUserId);
          const pos = countData || 0;
          const { data: newAlbum, error } = await supabase.from("albums").insert([
            { title: args.title, user_id: targetUserId, cover_image_url: args.coverImageUrl || "", position: pos }
          ]).select().single();

          if (error) return { error: error.message };
          return { success: true, message: `Álbum '${args.title}' creado con éxito.`, album: newAlbum };
        }

        case "add_cards_to_album": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          let albumId = args.albumId;
          if (!albumId && args.albumTitle) {
            const { data: found } = await supabase.from("albums").select("id").eq("user_id", targetUserId).ilike("title", `%${args.albumTitle}%`).limit(1).maybeSingle();
            if (found) albumId = found.id;
          }
          if (!albumId) {
            const { data: newAlb } = await supabase.from("albums").insert([{ title: args.albumTitle || "Nuevo Álbum", user_id: targetUserId }]).select().single();
            if (newAlb) albumId = newAlb.id;
          }
          if (!albumId) return { error: "No se pudo obtener ni crear el álbum." };

          let { data: pages } = await supabase.from("pages").select("id, page_index").eq("album_id", albumId).order("page_index", { ascending: true });
          if (!pages || pages.length === 0) {
            const { data: newPage } = await supabase.from("pages").insert([{ album_id: albumId, page_index: 0 }]).select().single();
            if (newPage) pages = [newPage];
          }
          if (!pages || pages.length === 0) return { error: "No se pudo crear o recuperar página del álbum." };

          let currentPageIndex = 0;
          let currentPageId = pages[currentPageIndex].id;

          const { data: existingSlots } = await supabase.from("card_slots").select("page_id, slot_index").in("page_id", pages.map((p: any) => p.id));
          const pageSlotMap = new Map<string, Set<number>>();
          pages.forEach((p: any) => pageSlotMap.set(p.id, new Set()));
          (existingSlots || []).forEach((s: any) => {
            if (pageSlotMap.has(s.page_id)) {
              pageSlotMap.get(s.page_id)!.add(s.slot_index);
            }
          });

          const slotsToInsert = [];
          for (const card of args.cards) {
            let occupied = pageSlotMap.get(currentPageId) || new Set();
            let currentSlot = 0;
            while (occupied.has(currentSlot) && currentSlot < 20) {
              currentSlot++;
            }

            if (currentSlot >= 20) {
              currentPageIndex++;
              if (currentPageIndex < pages.length) {
                currentPageId = pages[currentPageIndex].id;
              } else {
                const { data: newPage, error: pageErr } = await supabase.from("pages").insert([{ album_id: albumId, page_index: currentPageIndex }]).select().single();
                if (pageErr || !newPage) return { error: "Error al crear nueva página en el álbum." };
                pages.push(newPage);
                currentPageId = newPage.id;
                pageSlotMap.set(currentPageId, new Set());
              }
              occupied = pageSlotMap.get(currentPageId)!;
              currentSlot = 0;
              while (occupied.has(currentSlot) && currentSlot < 20) {
                currentSlot++;
              }
            }

            let cardImg = card.image_url || "";
            let cardRarity = card.rarity || "";
            if (!cardImg) {
              const ext = await queryExternalTCGCard(card.card_name);
              if (ext && ext.length > 0) {
                cardImg = ext[0].image_url;
                if (!cardRarity) cardRarity = ext[0].rarity;
              }
            }

            slotsToInsert.push({
              page_id: currentPageId,
              slot_index: currentSlot,
              card_name: card.card_name,
              price: card.price || 0,
              rarity: cardRarity || "",
              edition: card.edition || "",
              language: card.language || "",
              image_url: cardImg,
              foil_type: card.foil_type || ""
            });
            occupied.add(currentSlot);
          }

          const { error: insertErr } = await supabase.from("card_slots").upsert(slotsToInsert, { onConflict: "page_id,slot_index" });
          if (insertErr) return { error: `Error al guardar en álbum: ${insertErr.message}` };

          return { success: true, message: `Se agregaron ${slotsToInsert.length} carta(s) al álbum.`, cards_added: slotsToInsert };
        }

        case "remove_cards_from_album": {
          let albumId = args.albumId;
          if (!albumId && args.albumTitle && targetUserId) {
            const { data: found } = await supabase.from("albums").select("id").eq("user_id", targetUserId).ilike("title", `%${args.albumTitle}%`).limit(1).maybeSingle();
            if (found) albumId = found.id;
          }
          if (!albumId) return { error: "Álbum no encontrado." };

          const { data: pages } = await supabase.from("pages").select("id").eq("album_id", albumId);
          if (!pages || pages.length === 0) return { error: "No hay páginas en este álbum." };

          const pageIds = pages.map((p: any) => p.id);
          const { error: delErr } = await supabase.from("card_slots").delete().in("page_id", pageIds).ilike("card_name", `%${args.cardName}%`);
          if (delErr) return { error: delErr.message };

          return { success: true, message: `Se eliminó '${args.cardName}' del álbum.` };
        }

        case "create_deck": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          const { data: newDeck, error } = await supabase.from("decks").insert([
            { name: args.name, user_id: targetUserId, format_tag: args.format_tag || "", is_public: true }
          ]).select().single();

          if (error) return { error: error.message };
          return { success: true, message: `Deck '${args.name}' creado con éxito.`, deck: newDeck };
        }

        case "add_cards_to_deck": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          let deckId = args.deckId;
          if (!deckId && args.deckName) {
            const { data: found } = await supabase.from("decks").select("id").eq("user_id", targetUserId).ilike("name", `%${args.deckName}%`).limit(1).maybeSingle();
            if (found) deckId = found.id;
          }
          if (!deckId) {
            const { data: newD } = await supabase.from("decks").insert([{ name: args.deckName || "Nuevo Deck", user_id: targetUserId, is_public: true }]).select().single();
            if (newD) deckId = newD.id;
          }
          if (!deckId) return { error: "No se pudo obtener ni crear el deck." };

          const cardsToInsert = [];
          for (const c of args.cards) {
            let cardImg = c.image_url || "";
            if (!cardImg) {
              const ext = await queryExternalTCGCard(c.card_name);
              if (ext && ext.length > 0) {
                cardImg = ext[0].image_url;
              }
            }
            cardsToInsert.push({
              deck_id: deckId,
              card_name: c.card_name,
              quantity: c.quantity || 1,
              section: c.section || "main",
              card_type: c.card_type || "monster",
              image_url: cardImg
            });
          }

          const { error: insErr } = await supabase.from("deck_cards").insert(cardsToInsert);
          if (insErr) return { error: insErr.message };

          return { success: true, message: `Se agregaron ${cardsToInsert.length} carta(s) al deck.`, cards: cardsToInsert };
        }

        case "remove_cards_from_deck": {
          let deckId = args.deckId;
          if (!deckId && args.deckName && targetUserId) {
            const { data: found } = await supabase.from("decks").select("id").eq("user_id", targetUserId).ilike("name", `%${args.deckName}%`).limit(1).maybeSingle();
            if (found) deckId = found.id;
          }
          if (!deckId) return { error: "Deck no encontrado." };

          const { error: delErr } = await supabase.from("deck_cards").delete().eq("deck_id", deckId).ilike("card_name", `%${args.cardName}%`);
          if (delErr) return { error: delErr.message };

          return { success: true, message: `Se eliminó '${args.cardName}' del deck.` };
        }

        case "add_to_wishlist": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          const cardsToInsert = [];
          for (const c of args.cards) {
            let cardImg = c.image_url || "";
            let cardRarity = c.rarity || "";
            if (!cardImg) {
              const ext = await queryExternalTCGCard(c.card_name);
              if (ext && ext.length > 0) {
                cardImg = ext[0].image_url;
                if (!cardRarity) cardRarity = ext[0].rarity;
              }
            }
            cardsToInsert.push({
              user_id: targetUserId,
              card_name: c.card_name,
              quantity: c.quantity || 1,
              rarity: cardRarity || "",
              notes: c.notes || "",
              image_url: cardImg,
              obtained: false
            });
          }

          const { error: wErr } = await supabase.from("wishlist").insert(cardsToInsert);
          if (wErr) return { error: wErr.message };

          return { success: true, message: `Se agregaron ${cardsToInsert.length} carta(s) a la Wishlist.`, cards: cardsToInsert };
        }

        case "remove_from_wishlist": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          let query = supabase.from("wishlist").delete().eq("user_id", targetUserId);
          if (args.wishlistId) {
            query = query.eq("id", args.wishlistId);
          } else if (args.cardName) {
            query = query.ilike("card_name", `%${args.cardName}%`);
          } else {
            return { error: "Especifica la carta a eliminar de la Wishlist." };
          }

          const { error: delErr } = await query;
          if (delErr) return { error: delErr.message };

          return { success: true, message: "Carta eliminada de la Wishlist." };
        }

        case "update_store_info": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          const updateData: any = {};
          if (args.store_name) updateData.store_name = args.store_name;
          if (args.whatsapp_link) updateData.whatsapp_link = args.whatsapp_link;
          if (args.messenger_link) updateData.messenger_link = args.messenger_link;

          const { error } = await supabase.from("usuarios").update(updateData).eq("id", targetUserId);
          if (error) return { error: error.message };
          return { success: true, message: "Información de la tienda actualizada con éxito.", updated: updateData };
        }

        default:
          return { error: `Herramienta no reconocida: ${name}` };
      }
    }

    const systemPrompt = `Eres la entidad virtual o espíritu guía de Viking TCG. Hablas de forma totalmente natural, cercana y humana en español.

REGLAS OBLIGATORIAS DE RESPUESTA:
1. NO USES EMOJIS. Queda estrictamente prohibido incluir emojis o caritas gráficas en tus respuestas. Responde únicamente en texto plano o con formato Markdown sencillo.
2. NO MUESTRES PENSAMIENTOS INTERNOS, LOGS NI METADATOS. Está rotundamente prohibido escribir texto en inglés o fragmentos técnicos como "* Role:", "* Tone:", "Check against rules:", "Plan:", "Thought:" o listas de verificación.
3. RESPONDE DIRECTO Y HUMANO. Da respuestas directas, serviciales y conversacionales. Nunca digas que eres un "asistente virtual", simplemente actúa con naturalidad según tu nombre.
4. MODO ADMINISTRADOR (is_admin = true): Puedes crear, consultar, agregar y eliminar cartas/elementos de Álbumes, Decks y Wishlist. Si falta información como imagen o rareza, agrégala de inmediato usando las herramientas (las imágenes se buscan solas en las APIs TCG).
5. MODO CLIENTE PÚBLICO (is_admin = false): Ayuda con consultas de productos, precios, disponibilidad de stock, horario, métodos de pago e instrucciones del carrito.
6. SI SE ENVÍA UNA IMAGEN ADJUNTA: Analízala y responde en relación a la carta o producto mostrado.

Modo de sesión actual: ${is_admin ? "ADMINISTRADOR (Acceso CRUD completo)" : "CLIENTE PÚBLICO (Modo consulta)"}.
ID de tienda/usuario: ${targetUserId || 'desconocido'}.
`;

    // Fetch available Gemini models
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`);
    const listData = await listRes.json();

    if (!listRes.ok || listData.error) {
      return new Response(JSON.stringify({ reply: `Error de Google Gemini: ${listData?.error?.message || 'Error de API Key'}` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const availableModels = (listData.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent") && !m.name.includes("2.5") && !m.name.includes("deprecated"))
      .map((m: any) => m.name);

    if (availableModels.length === 0) {
      return new Response(JSON.stringify({ reply: "No se encontró ningún modelo habilitado en Google Gemini." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let geminiRes: Response | null = null;
    let aiData: any = null;
    let selectedModel = "";

    const userParts: any[] = [];
    if (requestMsg) userParts.push({ text: requestMsg });
    if (image_base64) {
      const cleanBase64 = image_base64.replace(/^data:image\/\w+;base64,/, "");
      userParts.push({
        inlineData: {
          mimeType: image_mime,
          data: cleanBase64
        }
      });
    }

    const contents = [...conversation_history, { role: "user", parts: userParts }];

    for (const modelName of availableModels) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${geminiApiKey}`;

      try {
        const res = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            tools
          })
        });

        const data = await res.json();
        if (res.ok) {
          geminiRes = res;
          aiData = data;
          selectedModel = modelName;
          break;
        } else {
          console.warn(`Falló modelo ${modelName}:`, data.error?.message);
        }
      } catch (e) {
        console.warn(`Error con ${modelName}:`, e);
      }
    }

    if (!geminiRes || !geminiRes.ok) {
      return new Response(JSON.stringify({ reply: `No fue posible conectar con la IA (${aiData?.error?.message || 'Sin respuesta'}).` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Handle tool execution loop
    let candidate = aiData.candidates?.[0];
    let loopCount = 0;

    while (candidate?.content?.parts?.some((p: any) => p.functionCall) && loopCount < 3) {
      loopCount++;
      const functionCalls = candidate.content.parts.filter((p: any) => p.functionCall);
      const functionResponses = [];

      for (const fc of functionCalls) {
        const callName = fc.functionCall.name;
        const callArgs = fc.functionCall.args || {};
        const result = await executeToolCall(callName, callArgs);
        functionResponses.push({
          functionResponse: {
            name: callName,
            response: result
          }
        });
      }

      contents.push(candidate.content);
      contents.push({
        role: "function",
        parts: functionResponses
      });

      const loopUrl = `https://generativelanguage.googleapis.com/v1beta/${selectedModel}:generateContent?key=${geminiApiKey}`;
      const res = await fetch(loopUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          tools
        })
      });

      aiData = await res.json();
      candidate = aiData.candidates?.[0];
    }

    const parts = candidate?.content?.parts || [];
    let rawTextReply = "";
    for (const part of parts) {
      if (part.text) rawTextReply += part.text;
    }

    // Aggressive post-processing to remove log blocks, thinking steps, markdown code blocks, emojis and technical bullet points
    let cleanReply = rawTextReply
      .replace(/```json[\s\S]*?```/gi, "")
      .replace(/```[\s\S]*?```/gi, "")
      .trim();

    // Strip out lines starting with reasoning prefixes
    const lines = cleanReply.split("\n");
    const filteredLines = lines.filter(l => {
      const trimmed = l.trim();
      if (/^(\*|\-)?\s*(Role|Tone|Current Session Mode|User ID|Plan|Thought|Action|Observation|Check against rules|Acknowledge|Confirm|Maintain|Avoid):/i.test(trimmed)) return false;
      if (/^(The user|The search for|Response plan|Here is the response|System:)/i.test(trimmed)) return false;
      return true;
    });

    cleanReply = filteredLines.join("\n").trim();

    // Strip out emojis from the reply
    cleanReply = cleanReply.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

    if (!cleanReply) {
      cleanReply = "Listo, he completado tu solicitud.";
    }

    return new Response(JSON.stringify({
      reply: cleanReply
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ reply: "Ocurrió un error interno al procesar la solicitud: " + err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
