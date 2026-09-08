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
    const { user_id, store_id, message, is_admin: clientIsAdmin = false, conversation_history = [] } = await req.json();

    const requestMsg = message || "";
    if (!requestMsg) {
      return new Response(JSON.stringify({ reply: "Error: El mensaje es requerido." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const geminiApiKey = (Deno.env.get("Spirit") || Deno.env.get("OPENAI_API_KEY") || "").trim();
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ reply: "Error: No se encontró la API Key en los Secrets (Spirit)." }), {
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
          desc: "Carta agregada por Espíritu IA",
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
            description: "Obtiene información del perfil de la tienda (nombre, WhatsApp, redes, contacto).",
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
            description: "Obtiene productos sellados disponibles.",
            parameters: { type: "OBJECT", properties: {} }
          },
          {
            name: "search_cards",
            description: "Busca cartas en álbumes, decks, productos sellados e incluye consulta externa TCG (YGOPRODeck) si no está en la base local.",
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
            description: "[SOLO ADMIN] Agrega cartas a un álbum. Si no se especifican imágenes, las busca automáticamente en la base externa TCG.",
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
            name: "update_store_info",
            description: "[SOLO ADMIN] Actualiza los datos de la tienda.",
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
      const writeTools = ["create_album", "add_cards_to_album", "create_deck", "add_cards_to_deck", "update_store_info"];
      if (writeTools.includes(name) && !is_admin) {
        return { error: "Acceso denegado: Solo el administrador en admin.html puede realizar cambios." };
      }

      switch (name) {
        case "get_store_info": {
          const uId = args.userId || targetUserId;
          if (!uId) return { error: "No se encontró ID de usuario." };
          const { data: userRow } = await supabase.from("usuarios").select("id, username, store_name, whatsapp_link, messenger_link, profile_picture_url, store_banner_url").eq("id", uId).maybeSingle();
          return userRow || { message: "No se encontró perfil." };
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

          // Search in external TCG API if no local matches or to enrich details
          const externalMatch = await queryExternalTCGCard(q);

          return {
            query: q,
            in_albums: albumSlots,
            in_decks: deckCardsArr,
            sealed_products: sealedArr,
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
          return { success: true, message: `Álbum '${args.title}' creado.`, album: newAlbum };
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
          if (!albumId) return { error: "No se pudo obtener el álbum." };

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
                if (pageErr || !newPage) return { error: "Límite de páginas alcanzado o error al crear nueva página." };
                pages.push(newPage);
                currentPageId = newPage.id;
                pageSlotMap.set(currentPageId, new Set());
              }
              occupied = pageSlotMap.get(currentPageId)!;
              currentSlot = 0;
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
          if (insertErr) return { error: `Error al guardar en base de datos: ${insertErr.message}` };

          return { success: true, message: `Se agregaron ${slotsToInsert.length} carta(s) al álbum.`, cards_added: slotsToInsert };
        }

        case "create_deck": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          const { data: newDeck, error } = await supabase.from("decks").insert([
            { name: args.name, user_id: targetUserId, format_tag: args.format_tag || "", is_public: true }
          ]).select().single();

          if (error) return { error: error.message };
          return { success: true, message: `Deck '${args.name}' creado.`, deck: newDeck };
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
          if (!deckId) return { error: "No se pudo obtener el deck." };

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

          return { success: true, message: `Se agregaron ${cardsToInsert.length} cartas al deck.`, cards: cardsToInsert };
        }

        case "update_store_info": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          const updateData: any = {};
          if (args.store_name) updateData.store_name = args.store_name;
          if (args.whatsapp_link) updateData.whatsapp_link = args.whatsapp_link;
          if (args.messenger_link) updateData.messenger_link = args.messenger_link;

          const { error } = await supabase.from("usuarios").update(updateData).eq("id", targetUserId);
          if (error) return { error: error.message };
          return { success: true, message: "Información de la tienda actualizada.", updated: updateData };
        }

        default:
          return { error: `Herramienta desconocida: ${name}` };
      }
    }

    const systemPrompt = `Eres la Inteligencia Artificial Asistente de Viking TCG.

REGLAS OBLIGATORIAS DE RESPUESTA:
1. RESPONDE SIEMPRE EN ESPAÑOL DE FORMA DIRECTA Y ULTRA CORTA.
2. NUNCA MUESTRES PENSAMIENTOS INTERNOS, PASOS DE RAZONAMIENTO, PLANES DE RESPUESTA NI TEXTO EN INGLÉS COMO "The user said", "Plan:", "This is a simple...". Responde de inmediato al usuario.
3. SI TE PIDEN AGREGAR O CREAR CARTAS, ÁLBUMES O DECKS Y NO TIENES TODOS LOS DATOS (como imagen o rareza), NO PIDAS MÁS DATOS AL USUARIO. UTILIZA LAS HERRAMIENTAS Y AGREGA LA CARTA DE INMEDIATO (las imágenes y detalles se buscan automáticamente en la base TCG externa).
4. SI TE HACEN UNA PREGUNTA DIRECTA, RESPONDE SOLAMENTE EL RESULTADO O RESPUESTA DIRECTA SIN EXPLICACIONES EXTENSAS NI BIENVENIDAS LARGAS.
5. SI EL MODO DE SESIÓN ES ADMINISTRADOR (is_admin = true), EJECUTA LAS ACCIONES SOLICITADAS DIRECTAMENTE USANDO LAS HERRAMIENTAS CORRESPONDIENTES.

Modo de sesión actual: ${is_admin ? "ADMINISTRADOR" : "CLIENTE PÚBLICO"}.
ID de tienda: ${targetUserId || 'desconocido'}.
`;

    // Fetch available Gemini models
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`);
    const listData = await listRes.json();

    if (!listRes.ok || listData.error) {
      return new Response(JSON.stringify({ reply: `Error de Google Gemini: ${listData?.error?.message || 'Error API Key'}` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const availableModels = (listData.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent") && !m.name.includes("2.5") && !m.name.includes("deprecated"))
      .map((m: any) => m.name);

    if (availableModels.length === 0) {
      return new Response(JSON.stringify({ reply: "Error: No se encontró ningún modelo habilitado para tu API Key." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let geminiRes: Response | null = null;
    let aiData: any = null;
    let selectedModel = "";

    const contents = [...conversation_history, { role: "user", parts: [{ text: requestMsg }] }];

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
      return new Response(JSON.stringify({ reply: `Error al comunicarse con la IA de Google Gemini (${aiData?.error?.message || 'Sin respuesta'}).` }), {
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

    // Strict cleaning of reasoning/thinking lines in English or plans
    let cleanReply = rawTextReply.trim();
    if (cleanReply.includes("The user said") || cleanReply.includes("Plan:") || cleanReply.includes("Role:") || cleanReply.includes("The search for")) {
      const lines = cleanReply.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      const filteredLines = lines.filter(l => !l.startsWith("The user") && !l.startsWith("Plan:") && !l.startsWith("Role:") && !l.startsWith("Purpose:") && !l.startsWith("Response plan:") && !l.startsWith("The search for"));
      if (filteredLines.length > 0) {
        cleanReply = filteredLines.join("\n");
      } else {
        cleanReply = "";
      }
    }

    if (!cleanReply) {
      cleanReply = "Operación procesada correctamente.";
    }

    return new Response(JSON.stringify({
      reply: cleanReply
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ reply: "Error interno: " + err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
