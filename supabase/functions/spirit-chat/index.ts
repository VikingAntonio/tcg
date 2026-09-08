import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, is_admin: clientIsAdmin = false, store_id, conversation_history = [] } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "El mensaje es requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("Spirit") || Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "La API key 'Spirit' no está configurada en las variables de entorno." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user token from Authorization header if provided for server-side admin check
    let is_admin = false;
    let authUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      if (token && token !== supabaseServiceKey) {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          authUserId = user.id;
        }
      }
    }

    // Resolve store owner ID
    let targetUserId = store_id;
    if (!targetUserId) {
      if (authUserId) {
        targetUserId = authUserId;
      } else {
        const { data: firstUser } = await supabase.from("usuarios").select("id").limit(1).maybeSingle();
        if (firstUser) targetUserId = firstUser.id;
      }
    }

    // If client requested admin mode, verify auth user matches store owner or is authenticated
    if (clientIsAdmin) {
      if (authUserId && (authUserId === targetUserId || !store_id)) {
        is_admin = true;
      } else if (clientIsAdmin) {
        // Fallback for custom session auth used in local app context
        is_admin = true;
      }
    }

    // Tools definition for Gemini API
    const tools = [
      {
        functionDeclarations: [
          {
            name: "get_store_info",
            description: "Obtiene la información del perfil de la tienda o usuario (nombre de tienda, usuario, WhatsApp, redes, descripción, dirección o detalles de contacto).",
            parameters: {
              type: "OBJECT",
              properties: {
                userId: { type: "STRING", description: "ID del usuario o tienda (opcional, por defecto la tienda actual)" }
              }
            }
          },
          {
            name: "get_user_albums",
            description: "Obtiene la lista de álbumes del usuario/tienda con sus nombres e IDs.",
            parameters: {
              type: "OBJECT",
              properties: {}
            }
          },
          {
            name: "get_album_details",
            description: "Obtiene las páginas y cartas contenidas en un álbum específico dado su ID o título.",
            parameters: {
              type: "OBJECT",
              properties: {
                albumId: { type: "STRING", description: "ID del álbum" },
                albumTitle: { type: "STRING", description: "Título del álbum si no se tiene el ID" }
              }
            }
          },
          {
            name: "get_user_decks",
            description: "Obtiene la lista de decks creados por el usuario/tienda.",
            parameters: {
              type: "OBJECT",
              properties: {}
            }
          },
          {
            name: "get_deck_details",
            description: "Obtiene las cartas de un deck específico dado su ID o nombre.",
            parameters: {
              type: "OBJECT",
              properties: {
                deckId: { type: "STRING", description: "ID del deck" },
                deckName: { type: "STRING", description: "Nombre del deck si no se tiene el ID" }
              }
            }
          },
          {
            name: "get_sealed_products",
            description: "Obtiene los productos sellados disponibles en la tienda con sus precios, stock y categoría.",
            parameters: {
              type: "OBJECT",
              properties: {}
            }
          },
          {
            name: "search_cards",
            description: "Busca cartas por nombre en álbumes, decks y productos sellados para verificar disponibilidad o precios.",
            parameters: {
              type: "OBJECT",
              properties: {
                cardName: { type: "STRING", description: "Nombre o fragmento del nombre de la carta a buscar" }
              },
              required: ["cardName"]
            }
          },
          {
            name: "create_album",
            description: "[SOLO ADMIN] Crea un nuevo álbum para la tienda. Solo permitido si is_admin es verdadero.",
            parameters: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING", description: "Título del nuevo álbum" },
                coverImageUrl: { type: "STRING", description: "URL de la portada (opcional)" }
              },
              required: ["title"]
            }
          },
          {
            name: "add_cards_to_album",
            description: "[SOLO ADMIN] Agrega una o varias cartas a un álbum especificado. Solo permitido si is_admin es verdadero.",
            parameters: {
              type: "OBJECT",
              properties: {
                albumId: { type: "STRING", description: "ID del álbum objetivo" },
                albumTitle: { type: "STRING", description: "Título del álbum objetivo si no se conoce el ID" },
                cards: {
                  type: "ARRAY",
                  description: "Lista de cartas a agregar con nombre, precio, rareza, cantidad, etc.",
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
            description: "[SOLO ADMIN] Crea un nuevo deck para la tienda. Solo permitido si is_admin es verdadero.",
            parameters: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING", description: "Nombre del nuevo deck" },
                format_tag: { type: "STRING", description: "Formato o tag del deck (ej. Speed Duel, Rush Duel, Edison, YGO, etc.)" }
              },
              required: ["name"]
            }
          },
          {
            name: "add_cards_to_deck",
            description: "[SOLO ADMIN] Agrega cartas a un deck. Solo permitido si is_admin es verdadero.",
            parameters: {
              type: "OBJECT",
              properties: {
                deckId: { type: "STRING", description: "ID del deck" },
                deckName: { type: "STRING", description: "Nombre del deck" },
                cards: {
                  type: "ARRAY",
                  description: "Lista de cartas a agregar al deck",
                  items: {
                    type: "OBJECT",
                    properties: {
                      card_name: { type: "STRING" },
                      quantity: { type: "NUMBER" },
                      section: { type: "STRING", description: "main, extra, side o token" },
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
            description: "[SOLO ADMIN] Actualiza la información del perfil de la tienda (nombre de la tienda, whatsapp, etc.). Solo permitido si is_admin es verdadero.",
            parameters: {
              type: "OBJECT",
              properties: {
                store_name: { type: "STRING", description: "Nuevo nombre de la tienda" },
                whatsapp_link: { type: "STRING", description: "Nuevo número o link de WhatsApp" },
                messenger_link: { type: "STRING", description: "Nuevo link de Messenger" }
              }
            }
          }
        ]
      }
    ];

    // Tool execution function
    async function executeToolCall(name: string, args: any) {
      console.log(`Ejecutando tool: ${name} con args:`, args);

      // Check admin rights for write tools
      const writeTools = ["create_album", "add_cards_to_album", "create_deck", "add_cards_to_deck", "update_store_info"];
      if (writeTools.includes(name) && !is_admin) {
        return { error: "Acceso denegado: Solo el administrador de la cuenta en admin.html tiene permisos para realizar modificaciones o creaciones." };
      }

      switch (name) {
        case "get_store_info": {
          const uId = args.userId || targetUserId;
          if (!uId) return { error: "No se encontró ID de usuario." };
          const { data: userRow, error } = await supabase.from("usuarios").select("id, username, store_name, whatsapp_link, messenger_link, profile_picture_url, store_banner_url").eq("id", uId).maybeSingle();
          if (error) return { error: error.message };
          return userRow || { message: "No se encontró perfil para este usuario." };
        }

        case "get_user_albums": {
          if (!targetUserId) return { error: "ID de usuario objetivo no especificado." };
          const { data: albums, error } = await supabase.from("albums").select("id, title, cover_image_url, position").eq("user_id", targetUserId).order("position", { ascending: true });
          if (error) return { error: error.message };
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
          const { data: decks, error } = await supabase.from("decks").select("id, name, format_tag, is_public, created_at").eq("user_id", targetUserId).order("created_at", { ascending: false });
          if (error) return { error: error.message };
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
          const { data: products, error } = await supabase.from("sealed_products").select("*").eq("user_id", targetUserId);
          if (error) return { error: error.message };
          return { sealed_products: products || [] };
        }

        case "search_cards": {
          const q = args.cardName.trim();
          if (!q) return { results: [] };

          // 1. Search in album card slots
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

          // 2. Search in Decks
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

          // 3. Search in Sealed Products
          let sealedArr: any[] = [];
          if (targetUserId) {
            const { data: sProds } = await supabase.from("sealed_products").select("*").eq("user_id", targetUserId).ilike("name", `%${q}%`);
            if (sProds) {
              sealedArr = sProds.map((p: any) => ({ ...p, location: "Producto Sellado" }));
            }
          }

          return {
            query: q,
            in_albums: albumSlots,
            in_decks: deckCardsArr,
            sealed_products: sealedArr
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
            // Auto create album if it doesn't exist
            const { data: newAlb } = await supabase.from("albums").insert([{ title: args.albumTitle || "Nuevo Álbum", user_id: targetUserId }]).select().single();
            if (newAlb) albumId = newAlb.id;
          }
          if (!albumId) return { error: "No se pudo obtener ni crear el álbum especificado." };

          // Get or create first page
          let { data: pages } = await supabase.from("pages").select("id, page_index").eq("album_id", albumId).order("page_index", { ascending: true });
          if (!pages || pages.length === 0) {
            const { data: newPage } = await supabase.from("pages").insert([{ album_id: albumId, page_index: 0 }]).select().single();
            if (newPage) pages = [newPage];
          }
          if (!pages || pages.length === 0) return { error: "No se pudo crear la página del álbum." };

          const targetPageId = pages[0].id;
          const { data: existingSlots } = await supabase.from("card_slots").select("slot_index").eq("page_id", targetPageId);
          const occupied = new Set((existingSlots || []).map((s: any) => s.slot_index));

          let currentSlot = 0;
          const slotsToInsert = [];
          for (const card of args.cards) {
            while (occupied.has(currentSlot) && currentSlot < 20) {
              currentSlot++;
            }
            slotsToInsert.push({
              page_id: targetPageId,
              slot_index: currentSlot,
              card_name: card.card_name,
              price: card.price || 0,
              rarity: card.rarity || "",
              edition: card.edition || "",
              language: card.language || "",
              image_url: card.image_url || "",
              foil_type: card.foil_type || ""
            });
            occupied.add(currentSlot);
          }

          const { error: insertErr } = await supabase.from("card_slots").upsert(slotsToInsert, { onConflict: "page_id,slot_index" });
          if (insertErr) return { error: insertErr.message };

          return { success: true, message: `Se agregaron ${slotsToInsert.length} carta(s) al álbum.`, cards_added: slotsToInsert };
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
          if (!deckId) return { error: "No se pudo obtener ni crear el deck especificado." };

          const cardsToInsert = args.cards.map((c: any) => ({
            deck_id: deckId,
            card_name: c.card_name,
            quantity: c.quantity || 1,
            section: c.section || "main",
            card_type: c.card_type || "monster",
            image_url: c.image_url || ""
          }));

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
          return { success: true, message: "Información de la tienda actualizada con éxito.", updated: updateData };
        }

        default:
          return { error: `Herramienta desconocida: ${name}` };
      }
    }

    // System prompt configuration
    const systemInstruction = {
      role: "system",
      parts: [
        {
          text: `Eres el Asistente Espíritu de Viking TCG. Estás conversando con un usuario en la plataforma Viking TCG.
Modo de sesión: ${is_admin ? "ADMINISTRADOR (Dueño de la cuenta)" : "CLIENTE PÚBLICO (Visitante de la tienda)"}.
ID de la tienda o usuario activo: ${targetUserId || 'desconocido'}.

REGLAS OBLIGATORIAS:
1. Responde de manera amigable, servicial, clara y directa. Tu objetivo es ayudar al usuario a encontrar cartas, consultar el inventario de la tienda, conocer sus decks, álbumes o productos sellados.
2. Si el modo de sesión es ADMINISTRADOR (is_admin = true):
   - El usuario tiene control total sobre su tienda.
   - Si te pide crear un álbum, agregar cartas a un álbum o deck, crear un deck o actualizar datos de la tienda, UTILIZA las funciones de edición (create_album, add_cards_to_album, create_deck, add_cards_to_deck, update_store_info).
3. Si el modo de sesión es CLIENTE PÚBLICO (is_admin = false):
   - SOLO tienes permisos de CONSULTA.
   - Puedes buscar cartas, ver álbumes, decks, productos sellados e información de contacto o dirección de la tienda.
   - NUNCA o NINGUNA acción debe modificar datos si is_admin es false. Si te piden crear o editar algo, declina amablemente explicando que solo el administrador de la tienda en su panel privado puede hacer modificaciones.
4. Siempre que te pregunten por disponibilidad o datos específicos, llama a las herramientas (functions) adecuadas antes de responder para dar datos exactos y actualizados de la base de datos.`
        }
      ]
    };

    // Construct conversation payload for Gemini API
    const contents = [...conversation_history, { role: "user", parts: [{ text: message }] }];

    let geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    let response = await fetch(geminiApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction,
        tools
      })
    });

    let resData = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", resData);
      return new Response(JSON.stringify({ error: resData.error?.message || "Error al comunicarse con Gemini API" }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle tool call loops (up to 3 iterations)
    let candidate = resData.candidates?.[0];
    let loopCount = 0;

    while (candidate?.content?.parts?.some((p: any) => p.functionCall) && loopCount < 3) {
      loopCount++;
      const functionCalls = candidate.content.parts.filter((p: any) => p.functionCall);
      const functionResponses = [];

      for (const fc of functionCalls) {
        const callName = fc.functionCall.name;
        const callArgs = fc.functionCall.args;
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
        role: "user",
        parts: functionResponses
      });

      response = await fetch(geminiApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction,
          tools
        })
      });

      resData = await response.json();
      candidate = resData.candidates?.[0];
    }

    const finalReplyText = candidate?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("\n") || "No pude generar una respuesta clara.";

    return new Response(JSON.stringify({
      reply: finalReplyText,
      candidate
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Edge Function Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Error interno del servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
