// ====================================================================
// SUPABASE EDGE FUNCTION PARA GEMINI AI (spirit-chat/index.ts)
// ====================================================================
// Asistente virtual general en español basado en Google Gemini AI (estilo ChatGPT Pro).
// Características principales:
// 1. Respuesta abierta y directa a cualquier consulta (recetas, explicaciones, charla general).
// 2. Detección dinámica de modelos de Google Gemini vía ListModels API.
// 3. Consulta y respuesta sobre la tabla 'public.tracking' cuando hay datos de envíos.
// 4. Ejecución de recorrido manual de rastreo a petición del usuario.
// 5. Notificación de proactividad cuando hay paquetes listos para recoger.
// 6. Conversación fluida de varios turnos y análisis de imágenes multimodal.
// ====================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  store_id?: string;
}

// Limpieza y sanitización estricta de las respuestas devueltas por el modelo
function sanitizeAIResponse(text: string): string {
  if (!text) return '';
  let clean = text;

  // 1. Eliminar bloques HTML/XML de pensamiento y razonamiento
  clean = clean.replace(/<(thought|think|reasoning|scratchpad|planning|draft)[\s\S]*?<\/\1>/gi, '');

  // 2. Eliminar prefijos de delimitación de especialidad o disclaimers molestos
  clean = clean.replace(/^(aunque mi especialidad es|como asistente de|como ia de|en mi rol de)[^.\n]*[.\n]\s*/gi, '');

  // 3. Eliminar secciones generales de pensamiento o borrador antes de la respuesta real
  clean = clean.replace(/(question \d+:|knowledge areas:|steps \([^)]*\)|self-correction|drafting:|persona:|constraint:|"como se hace|"how to make)[\s\S]*?(?=\n\n[A-Z¡¿"']|Para |El |Hola |¡Hola |$)/gi, '');
  clean = clean.replace(/(pensamiento|thought|reasoning|proceso de pensamiento):[\s\S]*?(?=\n\n|\n[A-Z¡¿"']|$)/gi, '');

  // 4. Filtrar líneas de planificación/borrador mediante detección de patrones meta
  const metaKeywords = [
    'user asks',
    'user input',
    'tracking number',
    'acknowledge',
    'identify the carrier',
    'direct the user',
    'alternative',
    'persona',
    'constraint',
    'thought',
    'reasoning',
    'direct answer',
    'drafting',
    'step 1:',
    'step 2:',
    'step 3:',
    'step 4:',
    'direct and helpful'
  ];

  const lines = clean.split('\n');
  const filtered = lines.filter(line => {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();

    // Eliminar viñetas o líneas numeradas que contengan descriptores de razonamiento meta
    if (trimmed.startsWith('*') || trimmed.startsWith('-') || /^step\s*\d+:/i.test(trimmed)) {
      const isMeta = metaKeywords.some(kw => lower.includes(kw));
      if (isMeta) return false;
    }

    return true;
  });

  clean = filtered.join('\n').trim();
  clean = clean.replace(/```json[\s\S]*?```/gi, '').replace(/```[\s\S]*?```/gi, '').trim();

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

  foundModels.sort((a, b) => {
    const aRank = a.includes("2.0-flash") ? 0 : a.includes("1.5-flash") ? 1 : 2;
    const bRank = b.includes("2.0-flash") ? 0 : b.includes("1.5-flash") ? 1 : 2;
    return aRank - bRank;
  });

  return foundModels;
}

// Ejecución de recorrido manual invocando la Edge Function 'tracking'
async function triggerTrackingScan(supabaseUrl: string, supabaseKey: string, storeId?: string): Promise<any> {
  try {
    const trackingFunctionUrl = `${supabaseUrl}/functions/v1/tracking`;
    const res = await fetch(trackingFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify(storeId ? { user_id: storeId, force_all: true } : { force_all: true })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Error ejecutando scan manual de tracking:", e);
  }
  return null;
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
      is_proactive = false,
      store_id
    } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

    // --- MANEJO DE PROACTIVIDAD (PENSAMIENTO / NOTIFICACIÓN AUTOMÁTICA) ---
    if (is_proactive) {
      if (supabase) {
        let query = supabase.from('tracking').select('*').eq('status', 'ready_for_pickup').eq('is_notified', false);
        if (store_id) {
          query = query.eq('user_id', store_id);
        }
        const { data: readyItems } = await query;

        if (readyItems && readyItems.length > 0) {
          const item = readyItems[0];
          const guia = item.guia || item.tracking_number || 'sin guía';
          const paqueteria = item.paqueteria || item.carrier || 'paquetería';
          const persona = item.nombre_cliente || item.seller_name || '';

          // Marcar como notificado
          await supabase.from('tracking').update({
            is_notified: true,
            notified_at: new Date().toISOString()
          }).eq('id', item.id);

          const notifyMsg = `¡Atención! Tienes un paquete listo para ir a recoger en ventanilla/correo (Guía: ${guia}, ${paqueteria}${persona ? ', Contacto: ' + persona : ''}).`;

          return new Response(JSON.stringify({
            should_notify: true,
            is_persistent: true,
            notification_id: `ready_pickup_${item.id}`,
            message: notifyMsg
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

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
        JSON.stringify({ reply: '¡Hola! ¿En qué te puedo ayudar o de qué te gustaría platicar hoy?' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Detección de petición manual de recorrido de tracking por parte del usuario
    const lowerPrompt = userPrompt.toLowerCase();
    const isManualScanRequested = (
      lowerPrompt.includes('haz un recorrido') ||
      lowerPrompt.includes('recorrido de tracking') ||
      lowerPrompt.includes('recorrido de rastreo') ||
      lowerPrompt.includes('actualiza mis trackings') ||
      lowerPrompt.includes('actualizar trackings') ||
      lowerPrompt.includes('revisar paquetes') ||
      lowerPrompt.includes('checa mis paquetes') ||
      lowerPrompt.includes('checar paquetes')
    );

    let scanSummaryText = '';
    if (isManualScanRequested && supabase) {
      const scanResult = await triggerTrackingScan(supabaseUrl, supabaseKey, store_id);
      if (scanResult && scanResult.success) {
        scanSummaryText = `[SISTEMA: Se acaba de realizar un recorrido en tiempo real de los envíos. Resultados verificados: ${scanResult.count || 0} paquetes.]\n`;
      }
    }

    // Extraer número de guía o código de seguimiento mencionado en el prompt
    const trackingCodeMatches = userPrompt.match(/\b[A-Za-z0-9]{6,30}\b/g) || [];
    const potentialGuiaCodes = trackingCodeMatches.filter(code => /\d/.test(code) && /[A-Za-z]/.test(code));

    // Consultar información actual de la tabla 'public.tracking'
    let trackingContextText = '';
    const isTrackingQuery = (
      potentialGuiaCodes.length > 0 ||
      lowerPrompt.includes('tracking') ||
      lowerPrompt.includes('guia') ||
      lowerPrompt.includes('guía') ||
      lowerPrompt.includes('paquete') ||
      lowerPrompt.includes('rastreo') ||
      lowerPrompt.includes('rastrear') ||
      lowerPrompt.includes('envio') ||
      lowerPrompt.includes('envío')
    );

    if (isTrackingQuery && supabase) {
      try {
        let trackings: any[] = [];

        if (potentialGuiaCodes.length > 0) {
          for (const code of potentialGuiaCodes) {
            const { data: matched } = await supabase
              .from('tracking')
              .select('*')
              .or(`guia.ilike.%${code}%,tracking_number.ilike.%${code}%`);

            if (matched && matched.length > 0) {
              trackings.push(...matched);
            }
          }
        }

        if (trackings.length === 0) {
          let q = supabase.from('tracking').select('*').order('created_at', { ascending: false });
          if (store_id) {
            const { data: userTrackings } = await q.eq('user_id', store_id).limit(20);
            if (userTrackings && userTrackings.length > 0) {
              trackings = userTrackings;
            }
          }
          if (trackings.length === 0) {
            const { data: globalTrackings } = await supabase.from('tracking').select('*').order('created_at', { ascending: false }).limit(20);
            if (globalTrackings && globalTrackings.length > 0) {
              trackings = globalTrackings;
            }
          }
        }

        const uniqueTrackings = Array.from(new Map(trackings.map(item => [item.id, item])).values());

        if (uniqueTrackings.length > 0) {
          trackingContextText = `INFORMACIÓN ACTUAL DE TRACKINGS EN BASE DE DATOS:
${uniqueTrackings.map((t, idx) => {
  const dir = t.direction === 'received' ? 'Recibir (Compra)' : 'Enviar (Venta)';
  const guia = t.guia || t.tracking_number || 'N/A';
  const paq = t.paqueteria || t.carrier || 'N/A';
  const contacto = t.nombre_cliente || t.seller_name || 'N/A';
  const st = t.status || 'pendiente';
  const fEnvio = t.fecha_envio || 'No especificada';
  const fLlegada = t.fecha_llegada || 'No especificada';
  const url = t.tracking_url || 'N/A';
  const ultCheck = t.last_checked_at || 'Nunca';
  return `${idx + 1}. Tipo: ${dir} | Guía: ${guia} | Paquetería: ${paq} | Contacto: ${contacto} | Estado actual: ${st} | Fecha Envío: ${fEnvio} | Fecha Llegada Estimada: ${fLlegada} | Última verificación: ${ultCheck} | Enlace: ${url}`;
}).join('\n')}`;
        } else if (potentialGuiaCodes.length > 0) {
          trackingContextText = `INFORMACIÓN DE TRACKING: El código de guía ${potentialGuiaCodes.join(', ')} no se encuentra registrado en el sistema.`;
        }
      } catch (e) {
        console.warn("Error consultando tabla tracking para contexto:", e);
      }
    }

    const candidateModels = await discoverAvailableGeminiModels(apiKey);
    const contents: GeminiContent[] = [];

    // Sanitizar historial de conversación
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

    const systemInstruction = {
      parts: [
        {
          text: `Eres una Inteligencia Artificial general, altamente capaz, inteligente, empática, alegre y directa (estilo ChatGPT Pro / Gemini Pro).
Respondes libre y abiertamente a cualquier pregunta del usuario (recetas, explicaciones, programación, charla general).

REGLAS OBLIGATORIAS:
1. RESPONDE DIRECTAMENTE: Contesta de forma clara y directa a la solicitud del usuario. NUNCA agregues disclaimers sobre tus funciones, rol o especialidad (JAMÁS digas "Aunque mi especialidad es...", "Como IA de...", "En mi rol de...").
2. NUNCA MOSTRAR PENSAMIENTO INTERNO: NUNCA muestres borradores, notas de planificación, pasos internos ni viñetas de razonamiento.
3. RASTREO Y PAQUETES:
   - Tienes acceso a los datos de la base de datos de rastreo cuando se proveen en el contexto.
   - Si el contexto contiene datos de guías/paquetes, responde con total precisión sobre su estado actual, paquetería, fechas y detalles.
   - Si la guía solicitada no está en el contexto, indica amablemente que el código no aparece registrado en el sistema.
4. Idioma: Habla siempre en español fluido, natural y cercano.`
        }
      ]
    };

    if (scanSummaryText || trackingContextText) {
      systemInstruction.parts.push({
        text: `\nDATOS DE RASTREO Y SISTEMA:\n${scanSummaryText}${trackingContextText}`
      });
    }

    let geminiRes: Response | null = null;
    let aiData: any = null;
    let lastApiError: string = '';

    for (const modelName of candidateModels) {
      const apiVersion = 'v1beta';
      const geminiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;

      const generationConfig: Record<string, any> = {
        temperature: 0.2,
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
