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
    const {
      user_id,
      store_id,
      message,
      image_base64,
      image_mime = "image/jpeg",
      is_admin: clientIsAdmin = false,
      conversation_history = [],
      is_proactive = false,
      proactive_context = null,
      is_scan = false,
      game_type = null,
      auto_add = false,
      target_type = "album",
      target_id = null
    } = await req.json();

    const requestMsg = message || "";
    if (!is_scan && !is_proactive && !requestMsg && !image_base64 && conversation_history.length === 0) {
      return new Response(JSON.stringify({ reply: "Dime en qué te puedo ayudar hoy con tu tienda o tus cartas." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const geminiApiKey = (Deno.env.get("Spirit") || Deno.env.get("OPENAI_API_KEY") || "").trim();
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ reply: "Lo siento, la API Key no está configurada correctamente en el servidor.", should_notify: false }), {
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

    // Helper to fetch public Google Sheet CSV content
    async function fetchGoogleSheetContent(sheetUrl: string, maxRows = 100): Promise<string> {
      if (!sheetUrl) return "";
      try {
        const docIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!docIdMatch) return "";
        const docId = docIdMatch[1];
        let gid = "0";
        const gidMatch = sheetUrl.match(/[#&?]gid=([0-9]+)/);
        if (gidMatch) {
          gid = gidMatch[1];
        }

        const csvUrl = `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${gid}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);

        const res = await fetch(csvUrl, { signal: controller.signal });
        clearTimeout(timer);

        if (!res.ok) {
          return `[Google Sheet (Privado/No accesible público): ${sheetUrl}]`;
        }

        const csvText = await res.text();
        if (!csvText || csvText.includes("<!DOCTYPE html>")) {
          return `[Google Sheet (Requiere acceso público para exportar CSV): ${sheetUrl}]`;
        }

        const lines = csvText.split("\n").slice(0, maxRows);
        return lines.join("\n");
      } catch (e: any) {
        return `[Error leyendo Google Sheet: ${e?.message || 'Timeout'}]`;
      }
    }

    // Fetch user details and learn items knowledge base for targetUserId
    let userProfile = null;
    let userLearnItemsText = "";

    if (targetUserId) {
      const { data: profile } = await supabase.from("usuarios").select("*").eq("id", targetUserId).maybeSingle();
      if (profile) {
        userProfile = {
          id: profile.id,
          username: profile.username,
          store_name: profile.store_name,
          whatsapp_link: profile.whatsapp_link,
          messenger_link: profile.messenger_link,
          role: profile.role,
          subscription_expires_at: profile.subscription_expires_at || profile.expiration_date || profile.expires_at || null,
          created_at: profile.created_at
        };
      }

      // Fetch user's learn items (FAQs, Google Sheets, text notes, files)
      const { data: learnRows } = await supabase
        .from("learn_items")
        .select("*")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false });

      if (learnRows && learnRows.length > 0) {
        const itemTexts: string[] = [];
        for (const item of learnRows) {
          let itemDesc = `[Categoría: ${item.category || 'General'} | Tipo: ${item.type || 'nota'}] `;
          if (item.title) itemDesc += `Título: ${item.title}\n`;
          if (item.question) itemDesc += `Pregunta: ${item.question}\n`;
          if (item.answer) itemDesc += `Respuesta: ${item.answer}\n`;
          if (item.content) itemDesc += `Contenido: ${item.content}\n`;

          if (item.sheet_url) {
            itemDesc += `Enlace Google Sheet: ${item.sheet_url}\n`;
            const sheetData = await fetchGoogleSheetContent(item.sheet_url, 150);
            if (sheetData) {
              itemDesc += `--- DATOS DEL GOOGLE SHEET EXTRÁIDOS ---\n${sheetData}\n--- FIN DATOS GOOGLE SHEET ---\n`;
            }
          }

          if (item.file_url || item.file_name) {
            itemDesc += `Archivo adjunto: ${item.file_name || ''} (${item.file_url || ''})\n`;
          }

          itemTexts.push(itemDesc.trim());
        }
        userLearnItemsText = itemTexts.join("\n\n");
      }
    }

    // Helper to query external multi-TCG databases with fast 1.5s timeout per request
    async function queryExternalTCGCard(cardName: string) {
      const trimmed = cardName.trim();
      const results: any[] = [];

      const fetchWithTimeout = async (url: string, timeoutMs = 1500) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timer);
          return res;
        } catch (e) {
          clearTimeout(timer);
          return null;
        }
      };

      // 1. Try Yu-Gi-Oh! via YGOPRODeck
      try {
        const res = await fetchWithTimeout(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(trimmed)}`);
        if (res && res.ok) {
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

      // 2. Try Pokémon TCG via TCGdex
      try {
        const pokeRes = await fetchWithTimeout(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(trimmed)}`);
        if (pokeRes && pokeRes.ok) {
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

      // Fallback placeholder card if no external API returned an image
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

    // Handle Proactive Evaluation Request
    if (is_proactive) {
      const proactiveSystemPrompt = `Eres el asistente virtual proactivo e inteligente de Viking TCG.
Tu tarea es EVALUAR de forma PROACTIVA si existe alguna recomendación, tip, advertencia o consejo RELEVANTE y ÚTIL para mostrarle al usuario en este momento en su interfaz.

INFORMACIÓN DE CONTEXTO ACTUAL:
- Página actual: ${proactive_context?.page || 'desconocida'}
- Evento / Acción detectada: ${proactive_context?.event_type || 'desconocido'}
- Detalles del evento: ${JSON.stringify(proactive_context?.event_details || {})}
- Perfil de la tienda / usuario: ${JSON.stringify(userProfile || {})}
- Historial de notificaciones ya mostradas previamente (IDs): ${JSON.stringify(proactive_context?.history_ids || [])}

REGLAS DE EVALUACIÓN:
1. NO MOLESTAR: Si no hay nada verdaderamente relevante o útil que decir para la situación o página actual, responde {"should_notify": false}.
2. UTILIDAD Y CONTEXTO REAL: Genera un mensaje si detectas:
   - Estado de suscripción (ej. la suscripción vence pronto o venció).
   - Acciones del usuario (ej. está editando/creando un álbum, deck, wishlist, producto sellado, subastas o inversiones) donde un tip rápido o recomendación práctica le ayude a optimizar su tienda o catálogo.
   - Datos incompletos importantes (ej. si no tiene enlace de WhatsApp configurado para ventas).
   - Consejos sobre la página o vista actual.
3. NO REPETIR: Si la recomendación derivada de este evento/contexto ya está presente en history_ids, responde {"should_notify": false}.
4. TONO Y FORMATO:
   - El mensaje DEBE ser 100% generado dinámicamente por ti, en español natural, conciso y amigable.
   - SIN emojis, SIN bloques de código, SIN etiquetas XML.
   - Longitud corta (máximo 120 caracteres) apta para aparecer en un globo flotante.
5. FORMATO DE RESPUESTA:
   Responde ÚNICAMENTE en JSON válido con esta estructura exacta:
   {"should_notify": true, "message": "Tu texto aquí", "notification_id": "id_unico_snake_case"}
   o
   {"should_notify": false}
`;

      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`);
      const listData = await listRes.json();

      if (!listRes.ok || listData.error) {
        return new Response(JSON.stringify({ should_notify: false, error: listData?.error?.message }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const availableModels = (listData.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent") && !m.name.includes("2.5") && !m.name.includes("deprecated"))
        .map((m: any) => m.name);

      if (availableModels.length === 0) {
        return new Response(JSON.stringify({ should_notify: false }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      for (const modelName of availableModels) {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${geminiApiKey}`;

        try {
          const res = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: proactiveSystemPrompt }] }]
            })
          });

          if (res.ok) {
            const data = await res.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const cleanText = rawText.replace(/```json/gi, "").replace(/```/gi, "").trim();
            try {
              const parsed = JSON.parse(cleanText);
              if (parsed && typeof parsed.should_notify === 'boolean') {
                return new Response(JSON.stringify(parsed), {
                  status: 200,
                  headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
              }
            } catch (e) {
              console.warn("Error parseando JSON proactivo de Gemini:", e, cleanText);
            }
          }
        } catch (e) {
          console.warn(`Error en proactivo con ${modelName}:`, e);
        }
      }

      return new Response(JSON.stringify({ should_notify: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Handle Card Vision Scanner Request
    if (is_scan || proactive_context?.action === "scan_card") {
      if (!image_base64) {
        return new Response(JSON.stringify({ success: false, error: "No se proporcionó imagen para escanear" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const cleanBase64 = image_base64.replace(/^data:image\/\w+;base64,/, "");
      const scanPrompt = `Eres Gemini Vision TCG Fast Scanner, un motor ultrarrápido y experto en visión por computadora para identificar cartas coleccionables TCG (Yu-Gi-Oh!, Pokémon, Magic The Gathering, Lorcana, One Piece, Digimon, Dragon Ball, etc.).
Analiza con alta precisión y de forma inmediata la imagen de la carta.
Juego preferido: ${game_type || 'Desconocido'}.

INSTRUCCIONES:
1. Identifica el nombre exacto de la carta (card_name) en español o inglés (ej. "Dark Magician", "Blue-Eyes White Dragon", "Pikachu").
2. Identifica el código de carta o passcode (code) si está visible (ej. LOB-001, LOB-EN001, 123/456, 46986414).
3. Identifica el juego (game): "yugioh", "pokemon", "magic", "onepiece", "lorcana" u "otro".
4. Identifica la expansión (expansion) si es visible.
5. Identifica la rareza (rarity) si es deducible.

FORMATO DE RESPUESTA:
Responde ÚNICAMENTE en JSON válido con este formato exacto, sin texto conversacional ni markdown:
{
  "success": true,
  "card_name": "Nombre Exacto de la Carta",
  "code": "CÓDIGO O PASSCODE",
  "game": "yugioh | pokemon | magic | onepiece | lorcana | otro",
  "expansion": "Nombre del Set/Expansión",
  "rarity": "Rareza"
}

Si la imagen NO es una carta o no se distingue, responde:
{
  "success": false,
  "error": "No se pudo identificar una carta válida en la imagen"
}`;

      const targetMime = image_mime || "image/jpeg";
      // Prioritize gemini-2.0-flash for high speed and accuracy
      const candidateModels = ["models/gemini-2.0-flash", "models/gemini-1.5-flash", "models/gemini-1.5-pro"];

      for (const modelName of candidateModels) {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${geminiApiKey}`;

        try {
          const res = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: scanPrompt },
                    {
                      inlineData: {
                        mimeType: targetMime,
                        data: cleanBase64
                      }
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 256
              }
            })
          });

          if (res.ok) {
            const data = await res.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            let cleanText = rawText.replace(/```json/gi, "").replace(/```/gi, "").trim();

            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              cleanText = jsonMatch[0];
            }

            try {
              const parsed = JSON.parse(cleanText);
              if (parsed && parsed.success && parsed.card_name) {
                // Execute parallel internal and external database search for instant matching
                const cardName = parsed.card_name.trim();

                // 1. External database search
                const externalResults = await queryExternalTCGCard(cardName);
                const bestExternalMatch = externalResults && externalResults.length > 0 ? externalResults[0] : null;

                // 2. Internal database search
                let internalMatches: any = { in_albums: [], in_decks: [], in_wishlist: [] };
                if (targetUserId) {
                  const { data: userAlbums } = await supabase.from("albums").select("id, title").eq("user_id", targetUserId);
                  if (userAlbums && userAlbums.length > 0) {
                    const albumIds = userAlbums.map((a: any) => a.id);
                    const { data: albumPages } = await supabase.from("pages").select("id, album_id").in("album_id", albumIds);
                    if (albumPages && albumPages.length > 0) {
                      const pageIds = albumPages.map((p: any) => p.id);
                      const { data: slots } = await supabase.from("card_slots").select("*").in("page_id", pageIds).ilike("name", `%${cardName}%`);
                      if (slots) internalMatches.in_albums = slots;
                    }
                  }

                  const { data: userDecks } = await supabase.from("decks").select("id, name").eq("user_id", targetUserId);
                  if (userDecks && userDecks.length > 0) {
                    const deckIds = userDecks.map((d: any) => d.id);
                    const { data: dCards } = await supabase.from("deck_cards").select("*").in("deck_id", deckIds).ilike("name", `%${cardName}%`);
                    if (dCards) internalMatches.in_decks = dCards;
                  }

                  const { data: wCards } = await supabase.from("wishlist").select("*").eq("user_id", targetUserId).ilike("name", `%${cardName}%`);
                  if (wCards) internalMatches.in_wishlist = wCards;
                }

                parsed.external_data = bestExternalMatch;
                parsed.internal_matches = internalMatches;

                // Optionally auto-add card directly to specified album or deck for batch scanning speed
                let autoAddResult = null;
                if (auto_add && targetUserId && target_id) {
                  if (target_type === "album") {
                    const addRes = await executeToolCall("add_cards_to_album", {
                      albumId: target_id,
                      cards: [{
                        card_name: cardName,
                        rarity: parsed.rarity || bestExternalMatch?.rarity || "Common",
                        image_url: bestExternalMatch?.image_url || ""
                      }]
                    });
                    autoAddResult = addRes;
                  } else if (target_type === "deck") {
                    const addRes = await executeToolCall("add_cards_to_deck", {
                      deckId: target_id,
                      cards: [{
                        card_name: cardName,
                        quantity: 1,
                        image_url: bestExternalMatch?.image_url || ""
                      }]
                    });
                    autoAddResult = addRes;
                  }
                }
                if (autoAddResult) {
                  parsed.auto_added = autoAddResult;
                }

                return new Response(JSON.stringify(parsed), {
                  status: 200,
                  headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
              } else if (parsed) {
                return new Response(JSON.stringify(parsed), {
                  status: 200,
                  headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
              }
            } catch (e) {
              console.warn("Error parseando respuesta JSON de Gemini Vision:", e, cleanText);
            }
          }
        } catch (e) {
          console.warn(`Error en scan vision con ${modelName}:`, e);
        }
      }

      return new Response(JSON.stringify({ success: false, error: "No se pudo procesar la imagen con Gemini Vision" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
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
            name: "get_store_claims",
            description: "Obtiene la lista de claims activos (artículos en claim/dinámicas activas) de la tienda.",
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
            name: "get_investments",
            description: "Obtiene las categorías y cartas de inversión registradas.",
            parameters: { type: "OBJECT", properties: {} }
          },
          {
            name: "get_subastas",
            description: "Obtiene las subastas activas o registradas de la tienda.",
            parameters: { type: "OBJECT", properties: {} }
          },
          {
            name: "get_user_learn_items",
            description: "Obtiene la información de aprendizaje o datos de negocio registrados en learn.html de la tienda.",
            parameters: { type: "OBJECT", properties: {} }
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
            name: "update_album",
            description: "[SOLO ADMIN] Actualiza el título o imagen de portada de un álbum existente.",
            parameters: {
              type: "OBJECT",
              properties: {
                albumId: { type: "STRING" },
                albumTitle: { type: "STRING" },
                newTitle: { type: "STRING" },
                coverImageUrl: { type: "STRING" }
              }
            }
          },
          {
            name: "delete_album",
            description: "[SOLO ADMIN] Elimina un álbum de la tienda por ID o título.",
            parameters: {
              type: "OBJECT",
              properties: {
                albumId: { type: "STRING" },
                albumTitle: { type: "STRING" }
              }
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
            name: "update_album_card",
            description: "[SOLO ADMIN] Edita o actualiza los datos de una carta dentro de un álbum (precio, rareza, edición, idioma, imagen).",
            parameters: {
              type: "OBJECT",
              properties: {
                albumId: { type: "STRING" },
                albumTitle: { type: "STRING" },
                cardName: { type: "STRING", description: "Nombre de la carta a editar" },
                newName: { type: "STRING" },
                price: { type: "NUMBER" },
                rarity: { type: "STRING" },
                edition: { type: "STRING" },
                language: { type: "STRING" },
                image_url: { type: "STRING" }
              },
              required: ["cardName"]
            }
          },
          {
            name: "remove_cards_from_album",
            description: "[SOLO ADMIN] Elimina cartas de un álbum por su nombre.",
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
            name: "update_deck",
            description: "[SOLO ADMIN] Actualiza el nombre o tag de formato de un deck.",
            parameters: {
              type: "OBJECT",
              properties: {
                deckId: { type: "STRING" },
                deckName: { type: "STRING" },
                newName: { type: "STRING" },
                format_tag: { type: "STRING" }
              }
            }
          },
          {
            name: "delete_deck",
            description: "[SOLO ADMIN] Elimina un deck por ID o nombre.",
            parameters: {
              type: "OBJECT",
              properties: {
                deckId: { type: "STRING" },
                deckName: { type: "STRING" }
              }
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
                      section: { type: "STRING", description: "Main, Extra, Side, Tokens" },
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
            name: "update_deck_card",
            description: "[SOLO ADMIN] Edita los datos de una carta dentro de un deck (cantidad, sección, imagen).",
            parameters: {
              type: "OBJECT",
              properties: {
                deckId: { type: "STRING" },
                deckName: { type: "STRING" },
                cardName: { type: "STRING" },
                quantity: { type: "NUMBER" },
                section: { type: "STRING" },
                image_url: { type: "STRING" }
              },
              required: ["cardName"]
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
            name: "add_sealed_product",
            description: "[SOLO ADMIN] Agrega o crea un nuevo producto sellado en la tienda.",
            parameters: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                price: { type: "NUMBER" },
                stock: { type: "NUMBER" },
                image_url: { type: "STRING" },
                description: { type: "STRING" }
              },
              required: ["name", "price"]
            }
          },
          {
            name: "update_sealed_product",
            description: "[SOLO ADMIN] Actualiza el nombre, precio, stock o descripción de un producto sellado.",
            parameters: {
              type: "OBJECT",
              properties: {
                productId: { type: "STRING" },
                name: { type: "STRING" },
                newName: { type: "STRING" },
                price: { type: "NUMBER" },
                stock: { type: "NUMBER" },
                description: { type: "STRING" },
                image_url: { type: "STRING" }
              }
            }
          },
          {
            name: "remove_sealed_product",
            description: "[SOLO ADMIN] Elimina un producto sellado por ID o nombre.",
            parameters: {
              type: "OBJECT",
              properties: {
                productId: { type: "STRING" },
                name: { type: "STRING" }
              }
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
                      image_url: { type: "STRING" },
                      list_index: { type: "NUMBER" }
                    },
                    required: ["card_name"]
                  }
                }
              },
              required: ["cards"]
            }
          },
          {
            name: "update_wishlist_card",
            description: "[SOLO ADMIN] Edita o actualiza una carta en la lista de deseos / Wishlist (cantidad, rareza, notas, estado de conseguida).",
            parameters: {
              type: "OBJECT",
              properties: {
                wishlistId: { type: "STRING" },
                cardName: { type: "STRING" },
                newName: { type: "STRING" },
                quantity: { type: "NUMBER" },
                rarity: { type: "STRING" },
                notes: { type: "STRING" },
                obtained: { type: "BOOLEAN" },
                image_url: { type: "STRING" }
              }
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
            name: "manage_claims",
            description: "[SOLO ADMIN] Crea, actualiza o elimina un claim/dinámica.",
            parameters: {
              type: "OBJECT",
              properties: {
                action: { type: "STRING", description: "create, update, delete" },
                claimId: { type: "STRING" },
                title: { type: "STRING" },
                price: { type: "NUMBER" },
                image_url: { type: "STRING" },
                status: { type: "STRING" }
              },
              required: ["action"]
            }
          },
          {
            name: "manage_investments",
            description: "[SOLO ADMIN] Administra categorías y cartas de inversión (crear, modificar o eliminar).",
            parameters: {
              type: "OBJECT",
              properties: {
                action: { type: "STRING", description: "create_category, create_card, update_card, delete_card" },
                categoryId: { type: "STRING" },
                cardId: { type: "STRING" },
                name: { type: "STRING" },
                purchase_price: { type: "NUMBER" },
                current_price: { type: "NUMBER" },
                sale_price: { type: "NUMBER" },
                image_url: { type: "STRING" }
              },
              required: ["action"]
            }
          },
          {
            name: "manage_learn_items",
            description: "[SOLO ADMIN] Administra la información de aprendizaje/negocio de learn.html (crear, modificar o eliminar).",
            parameters: {
              type: "OBJECT",
              properties: {
                action: { type: "STRING", description: "create, update, delete" },
                itemId: { type: "STRING" },
                title: { type: "STRING" },
                content: { type: "STRING" },
                category: { type: "STRING" },
                image_url: { type: "STRING" },
                is_public: { type: "BOOLEAN" }
              },
              required: ["action"]
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
          },
          {
            name: "manage_subastas",
            description: "[SOLO ADMIN] Administra las subastas de la tienda (crear, actualizar o eliminar subasta).",
            parameters: {
              type: "OBJECT",
              properties: {
                action: { type: "STRING", description: "create, update, delete" },
                subastaId: { type: "STRING" },
                title: { type: "STRING" },
                initial_price: { type: "NUMBER" },
                min_bid_increment: { type: "NUMBER" },
                end_time: { type: "STRING" },
                image_url: { type: "STRING" },
                status: { type: "STRING", description: "active, ended, cancelled" }
              },
              required: ["action"]
            }
          },
          {
            name: "manage_eventos",
            description: "[SOLO ADMIN] Administra eventos o torneos de la tienda (crear, actualizar o eliminar).",
            parameters: {
              type: "OBJECT",
              properties: {
                action: { type: "STRING", description: "create, update, delete" },
                eventId: { type: "STRING" },
                title: { type: "STRING" },
                description: { type: "STRING" },
                event_date: { type: "STRING" },
                entry_fee: { type: "NUMBER" },
                image_url: { type: "STRING" }
              },
              required: ["action"]
            }
          },
          {
            name: "manage_preventas",
            description: "[SOLO ADMIN] Administra preventas de productos o expansiones TCG (crear, actualizar o eliminar).",
            parameters: {
              type: "OBJECT",
              properties: {
                action: { type: "STRING", description: "create, update, delete" },
                preventaId: { type: "STRING" },
                title: { type: "STRING" },
                price: { type: "NUMBER" },
                release_date: { type: "STRING" },
                description: { type: "STRING" },
                image_url: { type: "STRING" }
              },
              required: ["action"]
            }
          },
          {
            name: "manage_widgets_dominios",
            description: "[SOLO ADMIN] Administra dominios autorizados y widgets de la tienda (consultar, agregar o eliminar dominio).",
            parameters: {
              type: "OBJECT",
              properties: {
                action: { type: "STRING", description: "list, add, remove, toggle" },
                domainId: { type: "STRING" },
                domain: { type: "STRING" },
                is_active: { type: "BOOLEAN" }
              },
              required: ["action"]
            }
          },
          {
            name: "manage_clientes",
            description: "[SOLO ADMIN] Consulta o administra notas y datos de clientes de la tienda.",
            parameters: {
              type: "OBJECT",
              properties: {
                action: { type: "STRING", description: "list, update_notes, get_details" },
                clienteId: { type: "STRING" },
                notes: { type: "STRING" }
              },
              required: ["action"]
            }
          }
        ]
      }
    ];

    async function executeToolCall(name: string, args: any) {
      const writeTools = [
        "create_album", "update_album", "delete_album",
        "add_cards_to_album", "update_album_card", "remove_cards_from_album",
        "create_deck", "update_deck", "delete_deck",
        "add_cards_to_deck", "update_deck_card", "remove_cards_from_deck",
        "add_sealed_product", "update_sealed_product", "remove_sealed_product",
        "add_to_wishlist", "update_wishlist_card", "remove_from_wishlist",
        "manage_claims", "manage_investments", "manage_learn_items", "update_store_info",
        "manage_subastas", "manage_eventos", "manage_preventas", "manage_widgets_dominios", "manage_clientes"
      ];

      if (writeTools.includes(name) && !is_admin) {
        return { error: "Acceso restringido: Solo el administrador con sesión iniciada puede realizar modificaciones." };
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
          let albumTitle = args.albumTitle || "";
          if (!albumId && albumTitle && targetUserId) {
            const { data: found } = await supabase.from("albums").select("id, title").eq("user_id", targetUserId).ilike("title", `%${albumTitle}%`).limit(1).maybeSingle();
            if (found) {
              albumId = found.id;
              albumTitle = found.title;
            }
          }
          if (!albumId) {
            return {
              error: `El álbum '${albumTitle || args.albumId || 'solicitado'}' no fue encontrado en tu tienda.`,
              suggestion: "¿Deseas que cree un nuevo álbum con este título por ti?"
            };
          }

          const { data: pages } = await supabase.from("pages").select("id, page_index").eq("album_id", albumId).order("page_index", { ascending: true });
          if (!pages || pages.length === 0) return { albumId, albumTitle, pages: [], slots: [], message: `El álbum '${albumTitle}' no tiene páginas cargadas aún.` };

          const pageIds = pages.map((p: any) => p.id);
          const { data: slots } = await supabase.from("card_slots").select("*").in("page_id", pageIds);

          const slotList = (slots || []).map((s: any) => `• **${s.name}** - Precio: $${s.price || 0} | Rareza: ${s.rarity || 'Standard'} | Edición: ${s.edition || '1st'} | Idioma: ${s.language || 'ES'}`);
          const albumSummaryMsg = `Detalles del álbum **"${albumTitle}"** (${slotList.length} cartas):\n` + (slotList.length > 0 ? slotList.join("\n") : "Este álbum no contiene cartas todavía.");

          return { albumId, albumTitle, pages, slots: slots || [], message: albumSummaryMsg, summary: albumSummaryMsg };
        }

        case "get_user_decks": {
          if (!targetUserId) return { error: "ID de usuario objetivo no especificado." };
          const { data: decks } = await supabase.from("decks").select("id, name, format_tag, is_public, created_at").eq("user_id", targetUserId).order("created_at", { ascending: false });
          return { decks: decks || [] };
        }

        case "get_deck_details": {
          let deckId = args.deckId;
          let deckName = args.deckName || "";
          if (!deckId && deckName && targetUserId) {
            const { data: found } = await supabase.from("decks").select("id, name, format_tag").eq("user_id", targetUserId).ilike("name", `%${deckName}%`).limit(1).maybeSingle();
            if (found) {
              deckId = found.id;
              deckName = found.name;
            }
          }
          if (!deckId) {
            return {
              error: `El deck '${deckName || args.deckId || 'solicitado'}' no existe en tu tienda.`,
              suggestion: "¿Deseas que cree este deck por ti y le agregue las cartas?"
            };
          }

          const { data: deckMeta } = await supabase.from("decks").select("*").eq("id", deckId).single();
          const { data: cards } = await supabase.from("deck_cards").select("*").eq("deck_id", deckId);

          const cardList = (cards || []).map((c: any) => `• **${c.name}** x${c.quantity || 1} (Sección: ${c.section || 'Main'})`);
          const deckSummaryMsg = `Detalles del deck **"${deckName}"** (Tag: ${deckMeta?.format_tag || 'Sin Tag'}, Total de cartas distintas: ${cardList.length}):\n` + (cardList.length > 0 ? cardList.join("\n") : "Este deck está vacío.");

          return { deck: deckMeta, cards: cards || [], message: deckSummaryMsg, summary: deckSummaryMsg };
        }

        case "get_sealed_products": {
          if (!targetUserId) return { error: "ID de usuario objetivo no especificado." };
          const { data: products } = await supabase.from("sealed_products").select("*").eq("user_id", targetUserId);
          return { sealed_products: products || [] };
        }

        case "get_store_claims": {
          if (!targetUserId) return { error: "ID de usuario objetivo no especificado." };
          const { data: claims } = await supabase.from("claims").select("*").eq("user_id", targetUserId).eq("status", "Activa");
          return { claims: claims || [], total_active_claims: claims?.length || 0 };
        }

        case "get_user_wishlist": {
          if (!targetUserId) return { error: "ID de usuario objetivo no especificado." };
          const { data: wishlist } = await supabase.from("wishlist").select("*").eq("user_id", targetUserId).order("created_at", { ascending: false });
          return { wishlist: wishlist || [] };
        }

        case "get_investments": {
          if (!targetUserId) return { error: "ID de usuario no disponible." };
          const { data: cats } = await supabase.from("investment_categories").select("*").eq("user_id", targetUserId);
          const { data: cards } = await supabase.from("investment_cards").select("*").eq("user_id", targetUserId);
          return { categories: cats || [], investment_cards: cards || [] };
        }

        case "get_subastas": {
          if (!targetUserId) return { error: "ID de usuario no disponible." };
          const { data: subastas } = await supabase.from("subastas").select("*").eq("user_id", targetUserId);
          return { subastas: subastas || [] };
        }

        case "get_user_learn_items": {
          if (!targetUserId) return { error: "ID de usuario no disponible." };
          const { data: learnItems } = await supabase.from("learn_items").select("*").eq("user_id", targetUserId).order("created_at", { ascending: false });

          const enrichedItems: any[] = [];
          if (learnItems && learnItems.length > 0) {
            for (const item of learnItems) {
              const obj = { ...item };
              if (item.sheet_url) {
                const sheetContent = await fetchGoogleSheetContent(item.sheet_url, 150);
                if (sheetContent) {
                  obj.extracted_sheet_csv = sheetContent;
                }
              }
              enrichedItems.push(obj);
            }
          }
          return { learn_items: enrichedItems };
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
          if (!q) return { results: [], message: "No se proporcionó nombre de carta para buscar." };

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
                const { data: slots } = await supabase.from("card_slots").select("*").in("page_id", pageIds).ilike("name", `%${q}%`);
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
              const { data: dCards } = await supabase.from("deck_cards").select("*").in("deck_id", deckIds).ilike("name", `%${q}%`);
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

          let claimsArr: any[] = [];
          if (targetUserId) {
            const { data: cProds } = await supabase.from("claims").select("*").eq("user_id", targetUserId).eq("status", "Activa").ilike("title", `%${q}%`);
            if (cProds) {
              claimsArr = cProds.map((c: any) => ({ ...c, location: "Claim Activo" }));
            }
          }

          let wishlistArr: any[] = [];
          if (targetUserId) {
            const { data: wCards } = await supabase.from("wishlist").select("*").eq("user_id", targetUserId).ilike("name", `%${q}%`);
            if (wCards) {
              wishlistArr = wCards.map((w: any) => ({ ...w, location: "Wishlist" }));
            }
          }

          // Search in external TCG API
          const externalMatch = await queryExternalTCGCard(q);

          const totalLocalMatches = albumSlots.length + deckCardsArr.length + sealedArr.length + claimsArr.length + wishlistArr.length;

          // Format a comprehensive human-readable message with full item details
          const detailsLines: string[] = [`Resultados de la búsqueda para **"${q}"**:`];

          if (albumSlots.length > 0) {
            detailsLines.push(`\n**En Álbumes (${albumSlots.length}):**`);
            albumSlots.forEach(s => {
              detailsLines.push(`• **${s.name}** - Álbum: "${s.album_title}" | Precio: $${s.price || 0} | Rareza: ${s.rarity || 'Standard'} | Edición: ${s.edition || '1st'} | Idioma: ${s.language || 'ES'}`);
            });
          }

          if (deckCardsArr.length > 0) {
            detailsLines.push(`\n**En Decks (${deckCardsArr.length}):**`);
            deckCardsArr.forEach(c => {
              detailsLines.push(`• **${c.name}** - Deck: "${c.deck_name}" | Cantidad: ${c.quantity || 1} | Sección: ${c.section || 'Main'}`);
            });
          }

          if (sealedArr.length > 0) {
            detailsLines.push(`\n**En Productos Sellados (${sealedArr.length}):**`);
            sealedArr.forEach(p => {
              detailsLines.push(`• **${p.name}** - Precio: $${p.price || 0} | Stock: ${p.stock || 0} | Descripción: ${p.description || 'Sin descripción'}`);
            });
          }

          if (claimsArr.length > 0) {
            detailsLines.push(`\n**En Claims / Dinámicas (${claimsArr.length}):**`);
            claimsArr.forEach(cl => {
              detailsLines.push(`• **${cl.title}** - Precio: $${cl.price || 0} | Estado: ${cl.status}`);
            });
          }

          if (wishlistArr.length > 0) {
            detailsLines.push(`\n**En Lista de Deseos / Wishlist (${wishlistArr.length}):**`);
            wishlistArr.forEach(w => {
              detailsLines.push(`• **${w.name}** - Cantidad buscada: ${w.quantity || 1} | Rareza: ${w.rarity || 'Cualquiera'} | Notas: ${w.notes || 'Ninguna'}`);
            });
          }

          if (externalMatch && externalMatch.length > 0) {
            detailsLines.push(`\n**Coincidencias en Base de Datos TCG Externa:**`);
            externalMatch.slice(0, 3).forEach((ext: any) => {
              detailsLines.push(`• **${ext.card_name}** (${ext.tcg.toUpperCase()}) - Tipo: ${ext.type || 'Carta'} | Rareza: ${ext.rarity || 'Standard'}`);
            });
          }

          if (totalLocalMatches === 0 && (!externalMatch || externalMatch.length === 0)) {
            detailsLines.push(`No se encontraron cartas ni productos coincidentes con "${q}" en la tienda ni en bases externas.`);
          }

          const detailedMessage = detailsLines.join('\n');

          return {
            query: q,
            message: detailedMessage,
            summary: detailedMessage,
            in_albums: albumSlots,
            in_decks: deckCardsArr,
            sealed_products: sealedArr,
            in_claims: claimsArr,
            in_wishlist: wishlistArr,
            external_tcg_database: externalMatch
          };
        }

        case "create_album": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          const { data: countData } = await supabase.from("albums").select("*", { count: "exact", head: true }).eq("user_id", targetUserId);
          const pos = countData || 0;
          const { data: newAlbum, error } = await supabase.from("albums").insert([
            { title: args.title, user_id: targetUserId, cover_image_url: args.coverImageUrl || "", position: pos, is_public: true }
          ]).select().single();

          if (error) return { error: error.message };
          return { success: true, message: `Álbum '${args.title}' creado con éxito.`, album: newAlbum };
        }

        case "update_album": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          let query = supabase.from("albums").update({
            ...(args.newTitle ? { title: args.newTitle } : {}),
            ...(args.coverImageUrl !== undefined ? { cover_image_url: args.coverImageUrl } : {})
          }).eq("user_id", targetUserId);

          if (args.albumId) query = query.eq("id", args.albumId);
          else if (args.albumTitle) query = query.ilike("title", `%${args.albumTitle}%`);
          else return { error: "Especifica ID o título del álbum a actualizar." };

          const { error } = await query;
          if (error) return { error: error.message };
          return { success: true, message: "Álbum actualizado correctamente." };
        }

        case "delete_album": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          let query = supabase.from("albums").delete().eq("user_id", targetUserId);
          if (args.albumId) query = query.eq("id", args.albumId);
          else if (args.albumTitle) query = query.ilike("title", `%${args.albumTitle}%`);
          else return { error: "Especifica ID o título exacto del álbum a eliminar. Operación cancelada por seguridad." };

          const { error } = await query;
          if (error) return { error: error.message };
          return { success: true, message: "Álbum eliminado correctamente." };
        }

        case "add_cards_to_album": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          let albumId = args.albumId;
          if (!albumId && args.albumTitle) {
            const { data: found } = await supabase.from("albums").select("id").eq("user_id", targetUserId).ilike("title", `%${args.albumTitle}%`).limit(1).maybeSingle();
            if (found) albumId = found.id;
          }
          if (!albumId) {
            const { data: newAlb } = await supabase.from("albums").insert([{ title: args.albumTitle || "Nuevo Álbum", user_id: targetUserId, is_public: true }]).select().single();
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
            const cardName = card.card_name || card.name || "Carta";
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
              const ext = await queryExternalTCGCard(cardName);
              if (ext && ext.length > 0) {
                cardImg = ext[0].image_url;
                if (!cardRarity) cardRarity = ext[0].rarity;
              }
            }

            slotsToInsert.push({
              page_id: currentPageId,
              slot_index: currentSlot,
              name: cardName,
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

        case "update_album_card": {
          let albumId = args.albumId;
          if (!albumId && args.albumTitle && targetUserId) {
            const { data: found } = await supabase.from("albums").select("id").eq("user_id", targetUserId).ilike("title", `%${args.albumTitle}%`).limit(1).maybeSingle();
            if (found) albumId = found.id;
          }
          if (!albumId) return { error: "Álbum no encontrado." };

          const { data: pages } = await supabase.from("pages").select("id").eq("album_id", albumId);
          if (!pages || pages.length === 0) return { error: "No hay páginas en este álbum." };

          const pageIds = pages.map((p: any) => p.id);
          const upData: any = {};
          if (args.newName) upData.name = args.newName;
          if (args.price !== undefined) upData.price = args.price;
          if (args.rarity) upData.rarity = args.rarity;
          if (args.edition) upData.edition = args.edition;
          if (args.language) upData.language = args.language;
          if (args.image_url) upData.image_url = args.image_url;

          const { error } = await supabase.from("card_slots").update(upData).in("page_id", pageIds).ilike("name", `%${args.cardName}%`);
          if (error) return { error: error.message };

          return { success: true, message: `Carta '${args.cardName}' actualizada en el álbum.` };
        }

        case "remove_cards_from_album": {
          if (!args.cardName) return { error: "Especifica el nombre de la carta a eliminar." };
          let albumId = args.albumId;
          if (!albumId && args.albumTitle && targetUserId) {
            const { data: found } = await supabase.from("albums").select("id").eq("user_id", targetUserId).ilike("title", `%${args.albumTitle}%`).limit(1).maybeSingle();
            if (found) albumId = found.id;
          }
          if (!albumId) return { error: "Álbum no encontrado." };

          const { data: pages } = await supabase.from("pages").select("id").eq("album_id", albumId);
          if (!pages || pages.length === 0) return { error: "No hay páginas en este álbum." };

          const pageIds = pages.map((p: any) => p.id);
          const { error: delErr } = await supabase.from("card_slots").delete().in("page_id", pageIds).ilike("name", `%${args.cardName}%`);
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

        case "update_deck": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          const upData: any = {};
          if (args.newName) upData.name = args.newName;
          if (args.format_tag !== undefined) upData.format_tag = args.format_tag;

          let query = supabase.from("decks").update(upData).eq("user_id", targetUserId);
          if (args.deckId) query = query.eq("id", args.deckId);
          else if (args.deckName) query = query.ilike("name", `%${args.deckName}%`);
          else return { error: "Especifica ID o nombre del deck a actualizar." };

          const { error } = await query;
          if (error) return { error: error.message };
          return { success: true, message: "Deck actualizado correctamente." };
        }

        case "delete_deck": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          let query = supabase.from("decks").delete().eq("user_id", targetUserId);
          if (args.deckId) query = query.eq("id", args.deckId);
          else if (args.deckName) query = query.ilike("name", `%${args.deckName}%`);
          else return { error: "Especifica ID o nombre del deck a eliminar. Operación cancelada por seguridad." };

          const { error } = await query;
          if (error) return { error: error.message };
          return { success: true, message: "Deck eliminado correctamente." };
        }

        case "add_cards_to_deck": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          let deckId = args.deckId;
          let deckName = args.deckName || "";
          if (!deckId && deckName) {
            const { data: found } = await supabase.from("decks").select("id, name").eq("user_id", targetUserId).ilike("name", `%${deckName}%`).limit(1).maybeSingle();
            if (found) {
              deckId = found.id;
              deckName = found.name;
            }
          }
          if (!deckId) {
            const { data: newD, error: createErr } = await supabase.from("decks").insert([{ name: deckName || "Nuevo Deck", user_id: targetUserId, is_public: true }]).select().single();
            if (createErr) return { error: `Error al crear deck: ${createErr.message}` };
            if (newD) {
              deckId = newD.id;
              deckName = newD.name;
            }
          }
          if (!deckId) return { error: "No se pudo obtener ni crear el deck." };

          const cardsToInsert = [];
          for (const c of args.cards) {
            const cName = c.card_name || c.name || "Carta";
            let cardImg = c.image_url || "";
            if (!cardImg) {
              const ext = await queryExternalTCGCard(cName);
              if (ext && ext.length > 0) {
                cardImg = ext[0].image_url;
              }
            }
            cardsToInsert.push({
              deck_id: deckId,
              name: cName,
              quantity: c.quantity || 1,
              section: c.section || "Main",
              image_url: cardImg
            });
          }

          const { error: insErr } = await supabase.from("deck_cards").insert(cardsToInsert);
          if (insErr) return { error: `Error en la base de datos al insertar cartas: ${insErr.message}` };

          return { success: true, message: `Se agregaron ${cardsToInsert.length} carta(s) al deck '${deckName}'.`, cards: cardsToInsert };
        }

        case "update_deck_card": {
          let deckId = args.deckId;
          if (!deckId && args.deckName && targetUserId) {
            const { data: found } = await supabase.from("decks").select("id").eq("user_id", targetUserId).ilike("name", `%${args.deckName}%`).limit(1).maybeSingle();
            if (found) deckId = found.id;
          }
          if (!deckId) return { error: "Deck no encontrado en tu tienda." };

          const upData: any = {};
          if (args.quantity !== undefined) upData.quantity = args.quantity;
          if (args.section) upData.section = args.section;
          if (args.image_url) upData.image_url = args.image_url;

          const { error } = await supabase.from("deck_cards").update(upData).eq("deck_id", deckId).ilike("name", `%${args.cardName}%`);
          if (error) return { error: `Error al actualizar carta en el deck: ${error.message}` };

          return { success: true, message: `Carta '${args.cardName}' actualizada en el deck.` };
        }

        case "remove_cards_from_deck": {
          if (!args.cardName) return { error: "Especifica la carta a eliminar del deck." };
          let deckId = args.deckId;
          if (!deckId && args.deckName && targetUserId) {
            const { data: found } = await supabase.from("decks").select("id").eq("user_id", targetUserId).ilike("name", `%${args.deckName}%`).limit(1).maybeSingle();
            if (found) deckId = found.id;
          }
          if (!deckId) return { error: "Deck no encontrado." };

          const { error: delErr } = await supabase.from("deck_cards").delete().eq("deck_id", deckId).ilike("name", `%${args.cardName}%`);
          if (delErr) return { error: delErr.message };

          return { success: true, message: `Se eliminó '${args.cardName}' del deck.` };
        }

        case "add_sealed_product": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          let img = args.image_url || "";
          if (!img) {
            const ext = await queryExternalTCGCard(args.name);
            if (ext && ext.length > 0) img = ext[0].image_url;
          }
          const { data: newProd, error } = await supabase.from("sealed_products").insert([{
            user_id: targetUserId,
            name: args.name,
            price: args.price || 0,
            stock: args.stock || 1,
            image_url: img,
            description: args.description || "",
            is_public: true
          }]).select().single();

          if (error) return { error: error.message };
          return { success: true, message: `Producto sellado '${args.name}' agregado con éxito.`, product: newProd };
        }

        case "update_sealed_product": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          const upData: any = {};
          if (args.newName) upData.name = args.newName;
          if (args.price !== undefined) upData.price = args.price;
          if (args.stock !== undefined) upData.stock = args.stock;
          if (args.description !== undefined) upData.description = args.description;
          if (args.image_url) upData.image_url = args.image_url;

          let query = supabase.from("sealed_products").update(upData).eq("user_id", targetUserId);
          if (args.productId) query = query.eq("id", args.productId);
          else if (args.name) query = query.ilike("name", `%${args.name}%`);
          else return { error: "Especifica ID o nombre del producto sellado a actualizar." };

          const { error } = await query;
          if (error) return { error: error.message };
          return { success: true, message: "Producto sellado actualizado con éxito." };
        }

        case "remove_sealed_product": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          let query = supabase.from("sealed_products").delete().eq("user_id", targetUserId);
          if (args.productId) query = query.eq("id", args.productId);
          else if (args.name) query = query.ilike("name", `%${args.name}%`);
          else return { error: "Especifica ID o nombre del producto a eliminar. Operación cancelada por seguridad." };

          const { error } = await query;
          if (error) return { error: error.message };
          return { success: true, message: "Producto sellado eliminado correctamente." };
        }

        case "add_to_wishlist": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          const cardsToInsert = [];
          for (const c of args.cards) {
            const cardName = c.card_name || c.name || "Carta";
            let cardImg = c.image_url || "";
            let cardRarity = c.rarity || "";
            if (!cardImg) {
              const ext = await queryExternalTCGCard(cardName);
              if (ext && ext.length > 0) {
                cardImg = ext[0].image_url;
                if (!cardRarity) cardRarity = ext[0].rarity;
              }
            }
            cardsToInsert.push({
              user_id: targetUserId,
              name: cardName,
              quantity: c.quantity || 1,
              rarity: cardRarity || "",
              notes: c.notes || "",
              image_url: cardImg,
              list_index: c.list_index !== undefined ? c.list_index : 0,
              obtained: false
            });
          }

          const { error: wErr } = await supabase.from("wishlist").insert(cardsToInsert);
          if (wErr) return { error: wErr.message };

          return { success: true, message: `Se agregaron ${cardsToInsert.length} carta(s) a la Wishlist.`, cards: cardsToInsert };
        }

        case "update_wishlist_card": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          const upData: any = {};
          if (args.newName) upData.name = args.newName;
          if (args.quantity !== undefined) upData.quantity = args.quantity;
          if (args.rarity) upData.rarity = args.rarity;
          if (args.notes !== undefined) upData.notes = args.notes;
          if (args.obtained !== undefined) upData.obtained = args.obtained;
          if (args.image_url) upData.image_url = args.image_url;

          let query = supabase.from("wishlist").update(upData).eq("user_id", targetUserId);
          if (args.wishlistId) query = query.eq("id", args.wishlistId);
          else if (args.cardName) query = query.ilike("name", `%${args.cardName}%`);
          else return { error: "Especifica la carta a actualizar en la Wishlist." };

          const { error } = await query;
          if (error) return { error: error.message };
          return { success: true, message: "Carta de Wishlist actualizada con éxito." };
        }

        case "remove_from_wishlist": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          let query = supabase.from("wishlist").delete().eq("user_id", targetUserId);
          if (args.wishlistId) {
            query = query.eq("id", args.wishlistId);
          } else if (args.cardName) {
            query = query.ilike("name", `%${args.cardName}%`);
          } else {
            return { error: "Especifica la carta a eliminar de la Wishlist. Operación cancelada por seguridad." };
          }

          const { error: delErr } = await query;
          if (delErr) return { error: delErr.message };

          return { success: true, message: "Carta eliminada de la Wishlist." };
        }

        case "manage_claims": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          const { action, claimId, title, price, image_url, status } = args;

          if (action === "create") {
            const { data: newClaim, error } = await supabase.from("claims").insert([{
              user_id: targetUserId,
              title: title || "Nuevo Claim",
              price: price || 0,
              image_url: image_url || "",
              status: status || "Activa"
            }]).select().single();
            if (error) return { error: error.message };
            return { success: true, message: `Claim '${title}' creado con éxito.`, claim: newClaim };
          } else if (action === "update") {
            if (!claimId) return { error: "ID de claim requerido para actualizar." };
            const upData: any = {};
            if (title) upData.title = title;
            if (price !== undefined) upData.price = price;
            if (image_url) upData.image_url = image_url;
            if (status) upData.status = status;
            const { error } = await supabase.from("claims").update(upData).eq("id", claimId).eq("user_id", targetUserId);
            if (error) return { error: error.message };
            return { success: true, message: "Claim actualizado con éxito." };
          } else if (action === "delete") {
            if (!claimId) return { error: "ID de claim requerido para eliminar." };
            const { error } = await supabase.from("claims").delete().eq("id", claimId).eq("user_id", targetUserId);
            if (error) return { error: error.message };
            return { success: true, message: "Claim eliminado con éxito." };
          }
          return { error: "Acción no válida en manage_claims." };
        }

        case "manage_investments": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          const { action, categoryId, cardId, name, purchase_price, current_price, sale_price, image_url } = args;

          if (action === "create_category") {
            const { data: cat, error } = await supabase.from("investment_categories").insert([{
              user_id: targetUserId,
              name: name || "Nueva Categoría",
              is_public: true
            }]).select().single();
            if (error) return { error: error.message };
            return { success: true, message: `Categoría de inversión '${name}' creada.`, category: cat };
          } else if (action === "create_card") {
            let img = image_url || "";
            if (!img && name) {
              const ext = await queryExternalTCGCard(name);
              if (ext && ext.length > 0) img = ext[0].image_url;
            }
            const { data: invCard, error } = await supabase.from("investment_cards").insert([{
              user_id: targetUserId,
              category_id: categoryId || null,
              card_name: name || "Nueva Carta",
              purchase_price: purchase_price || 0,
              current_price: current_price || 0,
              sale_price: sale_price || 0,
              image_url: img,
              is_public: true
            }]).select().single();
            if (error) return { error: error.message };
            return { success: true, message: `Carta de inversión '${name}' agregada.`, card: invCard };
          } else if (action === "update_card") {
            if (!cardId) return { error: "cardId requerido para actualizar." };
            const upObj: any = {};
            if (name) upObj.card_name = name;
            if (purchase_price !== undefined) upObj.purchase_price = purchase_price;
            if (current_price !== undefined) upObj.current_price = current_price;
            if (sale_price !== undefined) upObj.sale_price = sale_price;
            if (image_url) upObj.image_url = image_url;
            const { error } = await supabase.from("investment_cards").update(upObj).eq("id", cardId).eq("user_id", targetUserId);
            if (error) return { error: error.message };
            return { success: true, message: "Carta de inversión actualizada." };
          } else if (action === "delete_card") {
            if (!cardId) return { error: "cardId requerido para eliminar." };
            const { error } = await supabase.from("investment_cards").delete().eq("id", cardId).eq("user_id", targetUserId);
            if (error) return { error: error.message };
            return { success: true, message: "Carta de inversión eliminada." };
          }
          return { error: "Acción no válida en manage_investments." };
        }

        case "manage_learn_items": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          const { action, itemId, title, content, category, image_url, is_public, type, sheet_name, sheet_url, file_url, file_name, question, answer } = args;

          if (action === "create") {
            const { data: newItem, error } = await supabase.from("learn_items").insert([{
              user_id: targetUserId,
              title: title || "Nuevo Aprendizaje / Información",
              content: content || "",
              category: category || "General",
              image_url: image_url || "",
              type: type || "nota",
              sheet_name: sheet_name || "",
              sheet_url: sheet_url || "",
              file_url: file_url || "",
              file_name: file_name || "",
              question: question || "",
              answer: answer || "",
              is_public: is_public !== undefined ? is_public : true
            }]).select().single();
            if (error) return { error: error.message };
            return { success: true, message: `Información/Aprendizaje '${title}' guardado con éxito.`, item: newItem };
          } else if (action === "update") {
            if (!itemId) return { error: "itemId requerido para actualizar." };
            const upData: any = {};
            if (title) upData.title = title;
            if (content !== undefined) upData.content = content;
            if (category) upData.category = category;
            if (image_url !== undefined) upData.image_url = image_url;
            if (is_public !== undefined) upData.is_public = is_public;
            if (type) upData.type = type;
            if (sheet_name !== undefined) upData.sheet_name = sheet_name;
            if (sheet_url !== undefined) upData.sheet_url = sheet_url;
            if (file_url !== undefined) upData.file_url = file_url;
            if (file_name !== undefined) upData.file_name = file_name;
            if (question !== undefined) upData.question = question;
            if (answer !== undefined) upData.answer = answer;
            const { error } = await supabase.from("learn_items").update(upData).eq("id", itemId).eq("user_id", targetUserId);
            if (error) return { error: error.message };
            return { success: true, message: "Información de learn.html actualizada." };
          } else if (action === "delete") {
            if (!itemId) return { error: "itemId requerido para eliminar." };
            const { error } = await supabase.from("learn_items").delete().eq("id", itemId).eq("user_id", targetUserId);
            if (error) return { error: error.message };
            return { success: true, message: "Elemento de learn.html eliminado." };
          }
          return { error: "Acción no válida en manage_learn_items." };
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

        case "manage_subastas": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          const { action, subastaId, title, initial_price, min_bid_increment, end_time, image_url, status } = args;

          if (action === "create") {
            let img = image_url || "";
            if (!img && title) {
              const ext = await queryExternalTCGCard(title);
              if (ext && ext.length > 0) img = ext[0].image_url;
            }
            const { data: newSub, error } = await supabase.from("subastas").insert([{
              user_id: targetUserId,
              title: title || "Nueva Subasta",
              initial_price: initial_price || 0,
              min_bid_increment: min_bid_increment || 10,
              end_time: end_time || new Date(Date.now() + 86400000 * 3).toISOString(),
              image_url: img,
              status: status || "active"
            }]).select().single();
            if (error) return { error: error.message };
            return { success: true, message: `Subasta '${title}' creada con éxito.`, subasta: newSub };
          } else if (action === "update") {
            if (!subastaId) return { error: "subastaId requerido para actualizar." };
            const upData: any = {};
            if (title) upData.title = title;
            if (initial_price !== undefined) upData.initial_price = initial_price;
            if (min_bid_increment !== undefined) upData.min_bid_increment = min_bid_increment;
            if (end_time) upData.end_time = end_time;
            if (image_url) upData.image_url = image_url;
            if (status) upData.status = status;
            const { error } = await supabase.from("subastas").update(upData).eq("id", subastaId).eq("user_id", targetUserId);
            if (error) return { error: error.message };
            return { success: true, message: "Subasta actualizada con éxito." };
          } else if (action === "delete") {
            if (!subastaId) return { error: "subastaId requerido para eliminar." };
            const { error } = await supabase.from("subastas").delete().eq("id", subastaId).eq("user_id", targetUserId);
            if (error) return { error: error.message };
            return { success: true, message: "Subasta eliminada con éxito." };
          }
          return { error: "Acción no válida en manage_subastas." };
        }

        case "manage_eventos": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          const { action, eventId, title, description, event_date, entry_fee, image_url } = args;

          if (action === "create") {
            const { data: newEv, error } = await supabase.from("eventos").insert([{
              user_id: targetUserId,
              title: title || "Nuevo Evento TCG",
              description: description || "",
              event_date: event_date || new Date().toISOString(),
              entry_fee: entry_fee || 0,
              image_url: image_url || ""
            }]).select().single();
            if (error) return { error: error.message };
            return { success: true, message: `Evento '${title}' registrado con éxito.`, evento: newEv };
          } else if (action === "update") {
            if (!eventId) return { error: "eventId requerido para actualizar." };
            const upData: any = {};
            if (title) upData.title = title;
            if (description !== undefined) upData.description = description;
            if (event_date) upData.event_date = event_date;
            if (entry_fee !== undefined) upData.entry_fee = entry_fee;
            if (image_url) upData.image_url = image_url;
            const { error } = await supabase.from("eventos").update(upData).eq("id", eventId).eq("user_id", targetUserId);
            if (error) return { error: error.message };
            return { success: true, message: "Evento actualizado con éxito." };
          } else if (action === "delete") {
            if (!eventId) return { error: "eventId requerido para eliminar." };
            const { error } = await supabase.from("eventos").delete().eq("id", eventId).eq("user_id", targetUserId);
            if (error) return { error: error.message };
            return { success: true, message: "Evento eliminado con éxito." };
          }
          return { error: "Acción no válida en manage_eventos." };
        }

        case "manage_preventas": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          const { action, preventaId, title, price, release_date, description, image_url } = args;

          if (action === "create") {
            let img = image_url || "";
            if (!img && title) {
              const ext = await queryExternalTCGCard(title);
              if (ext && ext.length > 0) img = ext[0].image_url;
            }
            const { data: newPrev, error } = await supabase.from("preventas").insert([{
              user_id: targetUserId,
              title: title || "Nueva Preventa",
              price: price || 0,
              release_date: release_date || new Date().toISOString(),
              description: description || "",
              image_url: img
            }]).select().single();
            if (error) return { error: error.message };
            return { success: true, message: `Preventa '${title}' creada con éxito.`, preventa: newPrev };
          } else if (action === "update") {
            if (!preventaId) return { error: "preventaId requerido para actualizar." };
            const upData: any = {};
            if (title) upData.title = title;
            if (price !== undefined) upData.price = price;
            if (release_date) upData.release_date = release_date;
            if (description !== undefined) upData.description = description;
            if (image_url) upData.image_url = image_url;
            const { error } = await supabase.from("preventas").update(upData).eq("id", preventaId).eq("user_id", targetUserId);
            if (error) return { error: error.message };
            return { success: true, message: "Preventa actualizada con éxito." };
          } else if (action === "delete") {
            if (!preventaId) return { error: "preventaId requerido para eliminar." };
            const { error } = await supabase.from("preventas").delete().eq("id", preventaId).eq("user_id", targetUserId);
            if (error) return { error: error.message };
            return { success: true, message: "Preventa eliminada con éxito." };
          }
          return { error: "Acción no válida en manage_preventas." };
        }

        case "manage_widgets_dominios": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          const { action, domainId, domain, is_active } = args;

          if (action === "list") {
            const { data: domains } = await supabase.from("widget_domains").select("*").eq("user_id", targetUserId);
            return { domains: domains || [] };
          } else if (action === "add") {
            if (!domain) return { error: "Dominio requerido para agregar." };
            const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
            const { data: newDom, error } = await supabase.from("widget_domains").insert([{
              user_id: targetUserId,
              domain: cleanDomain,
              is_active: is_active !== undefined ? is_active : true
            }]).select().single();
            if (error) return { error: error.message };
            return { success: true, message: `Dominio '${cleanDomain}' agregado a widgets autorizados.`, domain: newDom };
          } else if (action === "toggle" || action === "remove") {
            if (action === "remove") {
              let query = supabase.from("widget_domains").delete().eq("user_id", targetUserId);
              if (domainId) query = query.eq("id", domainId);
              else if (domain) query = query.ilike("domain", `%${domain}%`);
              else return { error: "Especifica dominio o ID a eliminar." };
              const { error } = await query;
              if (error) return { error: error.message };
              return { success: true, message: "Dominio eliminado de widgets." };
            } else {
              if (!domainId) return { error: "domainId requerido para cambiar estado." };
              const { error } = await supabase.from("widget_domains").update({ is_active: is_active }).eq("id", domainId).eq("user_id", targetUserId);
              if (error) return { error: error.message };
              return { success: true, message: "Estado de dominio actualizado." };
            }
          }
          return { error: "Acción no válida en manage_widgets_dominios." };
        }

        case "manage_clientes": {
          if (!targetUserId) return { error: "No se especificó usuario." };
          const { action, clienteId, notes } = args;

          if (action === "list") {
            const { data: clients } = await supabase.from("clientes").select("*").eq("user_id", targetUserId);
            return { clientes: clients || [] };
          } else if (action === "update_notes") {
            if (!clienteId) return { error: "clienteId requerido." };
            const { error } = await supabase.from("clientes").update({ notes: notes || "" }).eq("id", clienteId).eq("user_id", targetUserId);
            if (error) return { error: error.message };
            return { success: true, message: "Notas de cliente actualizadas." };
          }
          return { error: "Acción no válida en manage_clientes." };
        }

        default:
          return { error: `Herramienta no reconocida: ${name}` };
      }
    }

    // Fetch active character spirit details for character voice personality alignment
    let characterVoiceStyle = "hombre adulto, voz masculina, tranquila, segura y natural";
    let spiritName = "Viking TCG";
    if (targetUserId) {
      const { data: userSpiritRow } = await supabase.from("usuarios").select("selected_spirit_id").eq("id", targetUserId).maybeSingle();
      if (userSpiritRow?.selected_spirit_id) {
        const { data: spiritRow } = await supabase.from("spirits").select("name, voice_type").eq("id", userSpiritRow.selected_spirit_id).maybeSingle();
        if (spiritRow) {
          spiritName = spiritRow.name || spiritName;
          const voiceProfiles: Record<string, string> = {
            hombreAdulto: "hombre adulto, voz masculina, tranquila, segura y natural",
            mujerAdulta: "mujer adulta, voz femenina, cálida, clara y natural",
            niño: "niño, voz infantil, alegre, curiosa y juguetona",
            niña: "niña, voz infantil femenina, dulce, alegre y curiosa"
          };
          characterVoiceStyle = voiceProfiles[spiritRow.voice_type] || characterVoiceStyle;
        }
      }
    }

    const systemPrompt = `Eres la entidad virtual (${spiritName}), un asistente IA extremadamente capaz, inteligente y experto oficial de Viking TCG. Adaptas tu tono y personalidad al estilo del personaje: ${characterVoiceStyle}. Hablas SIEMPRE Y ÚNICAMENTE en español de forma natural, fluida, inteligente, experta y directa.

BASE DE CONOCIMIENTO INDIVIDUAL Y DATOS DE APRENDIZAJES (LEARN.HTML) DE ESTE USUARIO:
${userLearnItemsText || "No hay notas ni preguntas frecuentes registradas aún en learn.html para este usuario."}

DIRECTIVAS CRÍTICAS Y REGLAS DE ORO:
1. USO OBLIGATORIO Y PRIORITARIO DE LA BASE DE CONOCIMIENTO Y BÚSQUEDA:
   - TIENES ACCESO DIRECTO a la información de la tienda, FAQs, notas y datos de Google Sheets de este usuario (mostrados arriba).
   - NUNCA respondas diciendo "no tengo esa información", "no puedo ver el contenido de Google Sheets", o "no puedo entrar a enlaces" si la pregunta trata sobre la ubicación, precios, horarios, FAQs o datos del catálogo de este usuario.
   - Si la respuesta está en los datos de arriba (FAQs, Google Sheets, notas), RESPÓNSELA DE INMEDIATO con precisión.
   - Si la consulta requiere datos en tiempo real de álbumes, decks, productos sellados, wishlist o subastas, USA LAS HERRAMIENTAS CORRESPONDIENTES ('get_user_albums', 'get_album_details', 'get_user_decks', 'get_deck_details', 'get_sealed_products', 'search_cards', 'get_user_learn_items') ANTES de responder.

2. LIBERA TODO TU POTENCIAL - EJECUTA ACCIONES DE INMEDIATO:
   Cuando el usuario te pida realizar cualquier operación CRUD (crear, agregar, modificar, actualizar o eliminar álbumes, cartas, decks, wishlist, productos sellados, claims, subastas, inversiones, eventos, preventas, widgets/dominios o elementos de learn), DEBES INVOCAR LA HERRAMIENTA ADECUADA EN TU PRIMERA RESPUESTA. No preguntes si deseas hacerlo si el usuario ya te dio la orden; simplemente ejecuta la acción.

3. PROHIBICIÓN ABSOLUTA DE FRASES GENÉRICAS Y EVASIVAS:
   Está estrictamente prohibido responder con respuestas robóticas o prefabricadas como "Entendido. ¿Deseas realizar alguna otra consulta o modificación?". Si una herramienta devuelve un resultado exitoso, explica exactamente lo que se hizo. Si la consulta pide información existente, responde con la información concreta.

4. AISLAMIENTO ESTRICTO DE TIENDA / USUARIO (TENANT ISOLATION):
   Estás atendiendo EXCLUSIVAMENTE a la tienda del usuario con ID ${targetUserId || 'desconocido'}. Solo debes consultar y modificar información perteneciente a este usuario específico.

5. BÚSQUEDA Y AUTOCORRECCIÓN DE CARTAS MULTI-TCG:
   Entiendes y buscas cartas de Yu-Gi-Oh!, Pokémon, Disney Lorcana, One Piece, Magic The Gathering, etc. Si el usuario escribe mal el nombre de una carta, utiliza las herramientas de búsqueda interna/externa para obtener la carta correcta y su imagen oficial.

6. FORMATO LIMPIO SIN PENSAMIENTOS NI EMOJIS:
   No muestres bloques de código de pensamiento (<think>), "Thought:", ni emojis. Responde directamente con un mensaje amigable, profesional y preciso en español.

7. MODOS DE PERMISO Y SEGURIDAD:
   - Modo actual: ${is_admin ? "PROPIETARIO ADMINISTRADOR (Acceso total para modificar la base de datos)" : "CLIENTE PÚBLICO (Modo de solo consulta)"}.
   - En modo ADMINISTRADOR: Ejecuta todas las herramientas de escritura que el usuario solicite.
   - En modo PÚBLICO: Ofrece información detallada y guía al cliente. Si pide hacer ediciones, indícale amablemente que debe iniciar sesión en su panel de administración.
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

    let availableModels = (listData.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent") && !m.name.includes("2.5") && !m.name.includes("deprecated"))
      .map((m: any) => m.name);

    // Sort models so ultra-fast flash models (e.g. gemini-2.0-flash, gemini-1.5-flash) are tried first
    availableModels.sort((a: string, b: string) => {
      const aIsFlash2 = a.includes("2.0-flash") ? 0 : a.includes("1.5-flash") ? 1 : 2;
      const bIsFlash2 = b.includes("2.0-flash") ? 0 : b.includes("1.5-flash") ? 1 : 2;
      return aIsFlash2 - bIsFlash2;
    });

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

    const sanitizedHistory: any[] = [];
    if (Array.isArray(conversation_history)) {
      for (const msg of conversation_history) {
        if (!msg || typeof msg !== "object") continue;
        const role = msg.role === "model" || msg.role === "assistant" ? "model" : "user";
        let parts = msg.parts;
        if (typeof msg.content === "string") {
          parts = [{ text: msg.content }];
        } else if (typeof msg.text === "string") {
          parts = [{ text: msg.text }];
        }
        if (!Array.isArray(parts) || parts.length === 0) continue;

        const cleanParts = parts.filter((p: any) => p && (p.text !== undefined || p.inlineData !== undefined));
        if (cleanParts.length > 0) {
          sanitizedHistory.push({ role, parts: cleanParts });
        }
      }
    }

    const contents = [...sanitizedHistory];
    if (userParts.length > 0) {
      contents.push({ role: "user", parts: userParts });
    }

    for (const modelName of availableModels) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${geminiApiKey}`;

      try {
        const res = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            tools,
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1024
            }
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
    const executedToolResults: any[] = [];

    while (candidate?.content?.parts?.some((p: any) => p.functionCall) && loopCount < 4) {
      loopCount++;
      const functionCalls = candidate.content.parts.filter((p: any) => p.functionCall);
      const functionResponses = [];

      for (const fc of functionCalls) {
        const callName = fc.functionCall.name;
        const callArgs = fc.functionCall.args || {};
        const result = await executeToolCall(callName, callArgs);
        executedToolResults.push({ tool: callName, result });
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
          systemInstruction: { parts: [{ text: systemPrompt + "\n\nINSTRUCCIÓN CRÍTICA DE RESPUESTA: Explica en detalle el resultado de la función o acción al usuario en español con datos concretos (nombres de cartas, ubicación, precio, estado, etc.), en un mensaje completo, profesional y directo. NO respondas solo con frases genéricas como 'Operación realizada'." }] },
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
      if (part.thought) {
        continue;
      }
      if (part.text) rawTextReply += part.text;
    }

    // Post-processing: Strip code blocks and thoughts without destroying natural Spanish text
    let cleanReply = rawTextReply
      .replace(/```json[\s\S]*?```/gi, "")
      .replace(/```[\s\S]*?```/gi, "")
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .trim();

    // Remove specific thought/log header lines if present
    const lines = cleanReply.split("\n");
    const filteredLines = lines.filter(l => {
      const trimmed = l.trim();
      if (/^(\*|\-)?\s*(Role|Tone|Current Session Mode|User ID|Plan|Thought|Thinking|Action|Observation|Check against rules|Acknowledge|Confirm|Maintain|Avoid|Instruction|Step|Guidelines|Notes):/i.test(trimmed)) return false;
      if (/^(Response plan|Here is the response|System:)/i.test(trimmed)) return false;
      return true;
    });

    cleanReply = filteredLines.join("\n").trim();

    // Strip out emojis from the reply
    cleanReply = cleanReply.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

    // Post-processing: Generate explicit response if cleanReply is empty or canned
    if (executedToolResults.length > 0) {
      const msgs = executedToolResults.map(tr => {
        if (tr.result?.error) {
          return `Error al ejecutar '${tr.tool}': ${tr.result.error} ${tr.result.suggestion || ''}`;
        }
        return tr.result?.message || tr.result?.summary || null;
      }).filter(Boolean);

      if (!cleanReply || cleanReply.includes("Entendido. ¿Deseas realizar alguna otra consulta") || cleanReply.includes("Acción ejecutada correctamente") || cleanReply.startsWith("Operación '")) {
        if (msgs.length > 0) {
          cleanReply = msgs.join("\n\n");
        }
      }
    }

    if (!cleanReply) {
      cleanReply = "He procesado tu solicitud. Si deseas realizar algún cambio en tus álbumes, decks, productos sellados, wishlist o inversiones, indícamelo con el nombre exacto.";
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
