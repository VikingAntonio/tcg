// ====================================================================
// SUPABASE EDGE FUNCTION PARA GEMINI AI (spirit-chat/index.ts)
// ====================================================================
// Asistente virtual en español basado en Google Gemini AI (estilo ChatGPT).
// Características principales:
// 1. Detección dinámica de modelos de Google Gemini vía ListModels API.
// 2. Respuesta abierta a cualquier consulta general (conocimiento universal).
// 3. Conversación fluida de varios turnos (multi-turn history).
// 4. Análisis de imágenes multimodal (visión por computadora).
// 5. Sanitización y filtrado de respuestas para eliminar pensamientos internos (<think>).
// 6. Integración de reglas de Producto Sellado según rol de sesión (is_admin).
// ====================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface RequestBody {
  prompt?: string;
  message?: string;
  history?: Array<{ role: string; content?: string; text?: string; parts?: any[] }>;
  conversation_history?: Array<{ role: string; content?: string; text?: string; parts?: any[] }>;
  image?: string;
  image_url?: string;
  image_base64?: string;
  image_mime?: string;
  is_proactive?: boolean;
  is_admin?: boolean;
  db_context?: string;
  context_mode?: string;
}

function buildSealedProductSystemPrompt(dbContext: string, isAdmin: boolean): string {
  if (isAdmin) {
    return `
--- MODO TIENDA: ASISTENTE DEL DUEÑO ---
El usuario es el dueño de la tienda. Tienes acceso de lectura a sus datos: perfil, carpetas/álbumes, binders, inversiones, productos sellados, preventas, ventas, clientes y tracking.

${dbContext}

REGLAS:
1. Responde con los datos reales del contexto. No inventes cifras, nombres, fechas ni estados.
2. Puedes mostrar costos, ganancias y datos de clientes porque la sesión es del administrador.
3. Si te preguntan por una carta, producto o colección, búscala en TODAS las secciones del contexto (carpetas, binders, inversiones, productos sellados) y di con precisión dónde está y en qué estado.
4. Si te piden modificar algo (stock, precios, guías, etc.), indica qué datos faltan o qué pasos seguir en la app. No afirmes que ya lo guardaste ni que la base de datos se actualizó.
5. No copies los encabezados ni el formato del contexto. Úsalo solo como fuente de datos y responde de forma natural.
`;
  }
  return `
--- MODO TIENDA: ATENCIÓN AL CLIENTE ---
El usuario es un cliente que está viendo la tienda. Habla con él como atención al cliente: amable, claro y útil. No eres el dueño ni tienes acceso a datos privados.

${dbContext}

REGLAS:
1. Responde sobre horarios, ubicación, formas de contacto, envíos/entregas, políticas, disponibilidad, precios y cómo comprar.
2. Muestra solo información pública: perfil, nombre del producto o preventa, precio de venta, descuento/apartado, estado (Disponible, Agotado, Poco Stock, En Camino), TCG, fechas y estado público de rastreo si le pertenece al cliente.
3. No reveles costos, ganancias, inversión, nombres de otros compradores, reservas ni ventas privadas.
4. Si te preguntan por una carta o producto, búscalo en el catálogo del contexto y responde si está disponible y a qué precio.
5. Si te piden modificar algo, explica cómo hacerlo en la app. No afirmes que ya lo hiciste.
6. No copies los encabezados ni el formato del contexto. Úsalo solo como fuente de datos y responde de forma natural.
`;
}

const GENERAL_MODE_PROMPT = `
--- MODO GENERAL ---
No se incluyó contexto de la tienda porque este mensaje no es sobre el negocio.
Responde como una IA general con tus propios conocimientos. No inventes datos de la tienda ni menciones inventario, precios, clientes o ventas.
Si el usuario pide algo relacionado con su tienda o catálogo, pídele que lo especifique para consultarlo.
Si la pregunta requiere datos en tiempo real (clima actual, noticias, precios de mercados externos), aclara que no tienes acceso en vivo y ofrece información general.
`;

// Limpieza y sanitización estricta de las respuestas devueltas por el modelo
function sanitizeAIResponse(text: string): string {
  if (!text) return '';
  let clean = text;

  // 1. Eliminar bloques de pensamiento o borradores <thought> o <think>
  clean = clean.replace(/<(thought|think)[\s\S]*?<\/\1>/gi, '');
  clean = clean.replace(/<(thought|think)[\s\S]*/gi, '');

  // 2. Eliminar secciones de desglose de preguntas, borradores en inglés o razonamientos internos
  clean = clean.replace(/(question \d+:|knowledge areas:|steps \(|self-correction|drafting:|persona:|constraint:|\"como se hace|\"how to make)[\s\S]*?(?=\n\n[A-Z¡¿"']|Para |El |Hola |¡Hola |$)/gi, '');

  // 3. Eliminar prefijos de razonamiento o etiquetas internas
  clean = clean.replace(/(pensamiento|thought|reasoning|proceso de pensamiento|pasos|drafting):[\s\S]*?(?=\n\n|\n[A-Z¡¿"']|$)/gi, '');

  // 4. Filtrar líneas de metadatos o viñetas internas
  const lines = clean.split('\n');
  const filtered = lines.filter(line => {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();
    if (trimmed.startsWith('*') && (
      lower.includes('user input') ||
      lower.includes('persona') ||
      lower.includes('constraint') ||
      lower.includes('thought') ||
      lower.includes('direct answer') ||
      lower.includes('reasoning') ||
      lower.includes('pensamiento') ||
      lower.includes('spanish')
    )) {
      return false;
    }
    return true;
  });

  clean = filtered.join('\n').trim();

  // 5. Eliminar bloques json envolventes si existieran
  clean = clean.replace(/```json[\s\S]*?```/gi, '').replace(/```[\s\S]*?```/gi, '').trim();

  // 6. Quitar la coletilla "¿En qué puedo ayudarte?" cuando aparece sola.
  // Es justo lo que el usuario no quiere leer: una oferta genérica de ayuda.
  clean = clean.replace(
    /(^|[.!?]\s+)(?:¿)?(?:en qué|en que|en qué más|en que mas)\s+(?:te\s+)?(?:puedo|podría)\s+(?:ayudarte|asistirte|apoyarte)[^?\n]*\?/gi,
    '$1'
  );
  clean = clean.replace(
    /(^|[.!?]\s+)(?:¿)?hay algo (?:más|mas) en lo que (?:te\s+)?pueda\s+(?:ayudarte|asistirte|apoyarte)[^?\n]*\?/gi,
    '$1'
  );
  clean = clean.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  return clean;
}

// Descubrimiento dinámico de modelos disponibles vía ListModels API
async function discoverAvailableGeminiModels(apiKey: string): Promise<string[]> {
  const versions = ['v1beta', 'v1'];
  const foundModels: string[] = [];

  for (const ver of versions) {
    try {
      const url = `https://generativelanguage.googleapis.com/${ver}/models?key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.models)) {
          for (const m of data.models) {
            if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent') && !m.name.includes("2.5") && !m.name.includes("deprecated")) {
              const nameOnly = m.name.replace(/^models\//, '');
              if (!foundModels.includes(nameOnly)) {
                foundModels.push(nameOnly);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Error descubriendo modelos en versión ${ver}:`, e);
    }
  }

  if (foundModels.length === 0) {
    return [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];
  }

  // Ordenar priorizando modelos flash rápidos
  foundModels.sort((a, b) => {
    const aRank = a.includes("2.0-flash") ? 0 : a.includes("1.5-flash") ? 1 : 2;
    const bRank = b.includes("2.0-flash") ? 0 : b.includes("1.5-flash") ? 1 : 2;
    return aRank - bRank;
  });

  return foundModels;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json().catch(() => ({}));
    const {
      prompt,
      message,
      history,
      conversation_history,
      image,
      image_url,
      image_base64,
      image_mime = 'image/jpeg',
      is_proactive = false
    } = body;

    if (is_proactive) {
      return new Response(JSON.stringify({ should_notify: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userPrompt = (prompt || message || '').trim();
    const historyInput = history || conversation_history || [];

    const apiKey = (
      Deno.env.get('Spirit') ||
      Deno.env.get('GEMINI_API_KEY') ||
      Deno.env.get('OPENAI_API_KEY') ||
      ''
    ).trim();

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          reply: 'Error: No se encontró la API Key de Gemini en las variables del servidor (Spirit / GEMINI_API_KEY).'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userPrompt && !image && !image_url && !image_base64 && historyInput.length === 0) {
      return new Response(
        JSON.stringify({ reply: '¡Hola!' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const candidateModels = await discoverAvailableGeminiModels(apiKey);
    const contents: GeminiContent[] = [];

    // Sanitizar historial de conversación asegurando alternancia de roles (user / model)
    if (Array.isArray(historyInput) && historyInput.length > 0) {
      for (const turn of historyInput) {
        if (!turn || typeof turn !== 'object') continue;
        const role = turn.role === 'model' || turn.role === 'assistant' ? 'model' : 'user';
        let parts: GeminiPart[] = [];

        if (Array.isArray(turn.parts)) {
          parts = turn.parts;
        } else if (typeof turn.content === 'string') {
          parts = [{ text: turn.content }];
        } else if (typeof turn.text === 'string') {
          parts = [{ text: turn.text }];
        }

        const validParts = parts.filter(p => p && (p.text !== undefined || p.inlineData !== undefined));
        if (validParts.length === 0) continue;

        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          contents[contents.length - 1].parts.push(...validParts);
        } else {
          contents.push({ role, parts: [...validParts] });
        }
      }
    }

    // Preparar el turno actual
    const currentParts: GeminiPart[] = [];
    const rawImageData = image_base64 || image || image_url;

    if (rawImageData && typeof rawImageData === 'string') {
      let mimeType = image_mime || 'image/jpeg';
      let cleanBase64 = rawImageData;

      if (rawImageData.includes('base64,')) {
        mimeType = rawImageData.substring(rawImageData.indexOf(':') + 1, rawImageData.indexOf(';')) || mimeType;
        cleanBase64 = rawImageData.split(',')[1];
      }

      currentParts.push({
        inlineData: {
          mimeType: mimeType,
          data: cleanBase64
        }
      });
    }

    if (userPrompt) {
      currentParts.push({ text: userPrompt });
    }

    if (currentParts.length > 0) {
      if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
        contents[contents.length - 1].parts.push(...currentParts);
      } else {
        contents.push({ role: 'user', parts: currentParts });
      }
    }

    const { is_admin = false, db_context = '', context_mode = '' } = body;
    const isGeneralMode = context_mode === 'general' || !db_context;
    const sealedPromptExtension = isGeneralMode
      ? GENERAL_MODE_PROMPT
      : buildSealedProductSystemPrompt(db_context, is_admin);

    const systemInstruction = {
      parts: [
        {
          text: `Eres el asistente conversacional de Viking TCG. Hablas español natural, cálido y directo, como una IA normal.

Tienes conocimientos generales amplios (programación, matemáticas, tecnología, ciencias, historia, cocina, arte, cine, música, TCG, etc.) y puedes conversar de cualquier tema. No todo gira alrededor de la tienda: si te preguntan del clima, de matemáticas, de historia o de cualquier tema general, responde con tus propios conocimientos, sin buscar ni inventar datos del negocio.

${sealedPromptExtension}

CÓMO RESPONDER:
1. Si el usuario te saluda, devuelve el saludo de forma natural en una o dos frases. No enumeres lo que sabes hacer.
2. Responde exactamente lo que se te pregunta. Nada de introducciones, resúmenes de lo que sabes hacer ni ofertas de ayuda que nadie pidió.
3. PROHIBIDO enumerar o presumir capacidades. No digas "puedo ayudarte a...", "soy capaz de...", "puedo crear binders/decks/inversiones/subastas", ni listes funciones de la app. No uses "¿En qué puedo ayudarte?" como muletilla.
4. Solo describes o mencionas una acción cuando el usuario la pida de forma explícita. Si no la pide, no la menciones.
5. Usa el contexto de datos solo cuando la pregunta sea sobre el negocio. Si el contexto no está disponible, no inventes datos de la tienda.
6. No afirmes haber modificado la base de datos ni haber realizado cambios si no lo has hecho realmente.
7. Sé breve por defecto; amplía solo si el usuario pide detalle.
8. Nunca incluyas pensamientos internos, notas de razonamiento, borradores de pasos ni metacomentarios.
9. Si el usuario envía una imagen, descríbela y responde sobre ella con precisión.
10. No repitas ni copies los encabezados del contexto. Responde como si supieras los datos de memoria.

EJEMPLOS:
- Usuario: "hola" → "¡Hola! ¿Cómo estás?"
- Usuario: "¿cómo está el clima?" → "No tengo acceso al clima en vivo, pero puedo darte información general si me dices la ciudad."
- Usuario: "¿qué puedes hacer?" → "Puedo conversar de muchos temas y, cuando me preguntes por tu tienda, consultar tus datos. ¿Qué te gustaría saber?"`
        }
      ]
    };

    let geminiRes: Response | null = null;
    let aiData: any = null;
    let lastApiError: string = '';

    for (const modelName of candidateModels) {
      const apiVersion = 'v1beta';
      const geminiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;

      const generationConfig: Record<string, any> = {
        // Más libertad en charla general; más precisión cuando hay datos de tienda.
        temperature: isGeneralMode ? 0.8 : 0.4,
        maxOutputTokens: 2048
      };

      try {
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction,
            contents,
            generationConfig
          })
        });

        const data = await res.json();
        if (res.ok && data.candidates && data.candidates.length > 0) {
          geminiRes = res;
          aiData = data;
          break;
        } else if (data.error && data.error.message) {
          lastApiError = `[${modelName}] ${data.error.message}`;
          console.warn(`Intento fallido con modelo ${modelName}:`, data.error.message);
        }
      } catch (e: any) {
        lastApiError = `[${modelName}] ${e.message}`;
        console.warn(`Excepción llamando a ${modelName}:`, e);
      }
    }

    if (!geminiRes || !aiData) {
      return new Response(
        JSON.stringify({
          reply: `Lo siento, ocurrió un inconveniente de comunicación con el servicio de IA. Detalle: ${lastApiError || 'Sin respuesta de modelos.'}`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const candidate = aiData.candidates?.[0];
    const resParts = candidate?.content?.parts || [];
    let rawReply = '';

    for (const part of resParts) {
      if (part.text) rawReply += part.text;
    }

    const cleanReply = sanitizeAIResponse(rawReply);

    return new Response(
      JSON.stringify({ reply: cleanReply || 'No pude generar una respuesta clara en este momento.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ reply: 'Error interno en la Edge Function: ' + error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
