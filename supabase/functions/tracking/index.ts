// ====================================================================
// SUPABASE EDGE FUNCTION PARA RASTREO Y ASISTENTE DE TRACKING (tracking/index.ts)
// ====================================================================
// Esta función recorre los registros de la tabla 'public.tracking',
// ingresa al enlace/URL de rastreo de cada paquete (Correos de México, Estafeta,
// FedEx, DHL, etc.) y analiza el texto de la página para actualizar el estado.
// También actúa como asistente IA en español (estilo spirit-chat) sin procesos
// de pensamiento, capaz de consultar la BD, refrescar guías y agregar nuevos trackings.
// ====================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface RequestBody {
  user_id?: string;
  tracking_id?: string;
  force_all?: boolean;
  prompt?: string;
  message?: string;
  history?: Array<{ role: string; content?: string; text?: string; parts?: any[] }>;
  conversation_history?: Array<{ role: string; content?: string; text?: string; parts?: any[] }>;
  action?: string;
}

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

// Limpieza y sanitización estricta de las respuestas devueltas por Gemini AI
function sanitizeAIResponse(text: string): string {
  if (!text) return '';
  let clean = text;

  // 1. Eliminar bloques de pensamiento o borradores <thought> o <think>
  clean = clean.replace(/<(thought|think)[\s\S]*?<\/\1>/gi, '');

  // 2. Eliminar secciones de desglose de preguntas, borradores en inglés o razonamientos internos
  clean = clean.replace(/(question \d+:|knowledge areas:|steps \(|self-correction|drafting:|persona:|constraint:|\"como se hace|\"how to make)[\s\S]*?(?=\n\n[A-Z¡¿"']|Para |El |Hola |¡Hola |$)/gi, '');

  // 3. Eliminar prefijos de razonamiento o etiquetas internas
  clean = clean.replace(/(pensamiento|thought|reasoning|proceso de pensamiento):[\s\S]*?(?=\n\n|\n[A-Z¡¿"']|$)/gi, '');

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

function buildCarrierUrl(carrier: string | null, guia: string | null, customUrl: string | null): string {
  if (customUrl && customUrl.trim().length > 0) return customUrl.trim();
  if (!guia) return '';

  const c = (carrier || '').toLowerCase().trim();
  const g = encodeURIComponent(guia.trim());

  if (c.includes('correos') || c.includes('sepomex') || c.includes('mexpost')) {
    return `https://www.correosdemexico.gob.mx/sslservicios/seguimientoenvio/seguimiento.aspx?guia=${g}`;
  }
  if (c.includes('estafeta')) {
    return `https://www.estafeta.com/Herramientas/Rastreo?trackingNumber=${g}`;
  }
  if (c.includes('fedex')) {
    return `https://www.fedex.com/fedextrack/?trknbr=${g}`;
  }
  if (c.includes('dhl')) {
    return `https://www.dhl.com/mx-es/home/rastreo.html?tracking-id=${g}`;
  }

  return `https://www.google.com/search?q=rastreo+${encodeURIComponent(carrier || '')}+${g}`;
}

function parseStatusFromContent(htmlOrText: string): string | null {
  if (!htmlOrText) return null;
  const lower = htmlOrText.toLowerCase();

  // 1. Listo para entregar / Ventanilla / Ocurre
  if (
    lower.includes('listo para recoger') ||
    lower.includes('disponible en ventanilla') ||
    lower.includes('listo en ventanilla') ||
    lower.includes('disponible para entrega') ||
    lower.includes('espera de ser recogido') ||
    lower.includes('en sucursal') ||
    lower.includes('llegada a oficina de destino') ||
    lower.includes('disponible en oficina') ||
    lower.includes('listo para entregar') ||
    lower.includes('oficina de destino') ||
    lower.includes('recepcion en oficina') ||
    lower.includes('ocurre')
  ) {
    return 'ready_for_pickup';
  }

  // 2. Entregado / Completado
  if (
    lower.includes('entregado') ||
    lower.includes('recibido por') ||
    lower.includes('delivered') ||
    lower.includes('entrega realizada') ||
    lower.includes('entregada')
  ) {
    return 'completed';
  }

  // 3. Devuelto
  if (
    lower.includes('devuelto') ||
    lower.includes('retornado') ||
    lower.includes('devolución') ||
    lower.includes('devolucion')
  ) {
    return 'returned';
  }

  // 4. En tránsito / En camino
  if (
    lower.includes('en tránsito') ||
    lower.includes('en transito') ||
    lower.includes('en camino') ||
    lower.includes('en traslado') ||
    lower.includes('despachado') ||
    lower.includes('salida de la oficina') ||
    lower.includes('out for delivery') ||
    lower.includes('procesamiento') ||
    lower.includes('reparto') ||
    lower.includes('deposito') ||
    lower.includes('clasificacion')
  ) {
    return 'in_transit';
  }

  return null;
}

// Función para ejecutar la verificación y actualización en BD de los trackings
async function checkAndUpdateTrackings(
  supabase: any,
  options: { user_id?: string; tracking_id?: string; force_all?: boolean }
) {
  const { user_id, tracking_id, force_all } = options;
  let query = supabase.from('tracking').select('*');

  if (tracking_id) {
    query = query.eq('id', tracking_id);
  } else if (user_id) {
    query = query.eq('user_id', user_id);
  }

  if (!force_all && !tracking_id) {
    query = query.neq('status', 'completed');
  }

  const { data: items, error } = await query;
  if (error || !items) {
    return { error: error?.message || 'Error consultando la base de datos' };
  }

  const results = [];

  for (const item of items) {
    const guia = item.guia || item.tracking_number || '';
    const paqueteria = item.paqueteria || item.carrier || '';
    const trackingUrl = buildCarrierUrl(paqueteria, guia, item.tracking_url);

    let newStatus: string | null = null;
    let checkSuccess = false;
    let fetchErrorMsg = '';

    if (trackingUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(trackingUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const pageText = await res.text();
          newStatus = parseStatusFromContent(pageText);
          checkSuccess = true;
        } else {
          fetchErrorMsg = `HTTP Status ${res.status}`;
        }
      } catch (err: any) {
        fetchErrorMsg = err.message || 'Error de conexión HTTP';
      }
    }

    const updateData: Record<string, any> = {
      last_checked_at: new Date().toISOString()
    };

    if (newStatus && newStatus !== item.status) {
      updateData.status = newStatus;
      if (newStatus === 'ready_for_pickup') {
        updateData.is_notified = false; // Habilita notificación proactiva en PC y Móvil
      }
      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      await supabase.from('tracking').update(updateData).eq('id', item.id);
    } else {
      await supabase.from('tracking').update(updateData).eq('id', item.id);
    }

    results.push({
      id: item.id,
      guia,
      carrier: paqueteria,
      url: trackingUrl,
      previousStatus: item.status,
      newStatus: newStatus || item.status,
      updated: !!(newStatus && newStatus !== item.status),
      checkSuccess,
      fetchErrorMsg
    });
  }

  return { success: true, count: results.length, results };
}

// Intentar agregar una nueva guía si la intención del usuario en el prompt es crear un tracking
async function tryExtractAndAddTracking(supabase: any, promptText: string, user_id?: string): Promise<string | null> {
  const lower = promptText.toLowerCase();
  const isAddIntent = lower.includes('agrega') || lower.includes('agregar') || lower.includes('añade') || lower.includes('añadir') || lower.includes('registra') || lower.includes('registrar') || lower.includes('nuevo tracking') || lower.includes('nueva guia');

  if (!isAddIntent) return null;

  // Extraer probable número de guía
  const guiaMatch = promptText.match(/\b([A-Za-z0-9]{6,25})\b/);
  if (!guiaMatch) return null;

  const guia = guiaMatch[1];
  let carrier = 'Correos de México';

  if (lower.includes('estafeta')) carrier = 'Estafeta';
  else if (lower.includes('fedex')) carrier = 'FedEx';
  else if (lower.includes('dhl')) carrier = 'DHL';
  else if (lower.includes('correos') || lower.includes('sepomex') || lower.includes('mexpost')) carrier = 'Correos de México';

  const insertData: Record<string, any> = {
    guia: guia,
    tracking_number: guia,
    paqueteria: carrier,
    carrier: carrier,
    nombre_cliente: 'Cliente',
    status: 'pending',
    direction: 'received'
  };

  if (user_id) {
    insertData.user_id = user_id;
  }

  const { data, error } = await supabase.from('tracking').insert([insertData]).select().single();
  if (error) {
    console.warn("Error agregando tracking en BD:", error.message);
    return null;
  }

  // Ejecutar verificación inmediata para la nueva guía
  if (data && data.id) {
    await checkAndUpdateTrackings(supabase, { tracking_id: data.id, force_all: true });
  }

  return guia;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Configuración incompleta de Supabase en Edge Function.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body: RequestBody = await req.json().catch(() => ({}));
    const { user_id, tracking_id, force_all, prompt, message, history, conversation_history } = body;

    const userPrompt = (prompt || message || '').trim();

    // =========================================================================
    // CASO A: CONSULTA / PETICIÓN IA INTERACTIVA (Prompt o mensaje proporcionado)
    // =========================================================================
    if (userPrompt) {
      // 1. Verificar si el usuario pide agregar un nuevo tracking
      const newlyAddedGuia = await tryExtractAndAddTracking(supabase, userPrompt, user_id);

      // 2. Verificar si pide actualizar / consultar estado
      const lowerPrompt = userPrompt.toLowerCase();
      if (lowerPrompt.includes('actualiz') || lowerPrompt.includes('consult') || lowerPrompt.includes('revis') || lowerPrompt.includes('chec') || lowerPrompt.includes('estatus') || lowerPrompt.includes('estado')) {
        await checkAndUpdateTrackings(supabase, { user_id, tracking_id, force_all: true });
      }

      // 3. Consultar todos los trackings relevantes de la base de datos
      let dbQuery = supabase.from('tracking').select('*').order('created_at', { ascending: false });
      if (user_id) {
        dbQuery = dbQuery.eq('user_id', user_id);
      } else if (tracking_id) {
        dbQuery = dbQuery.eq('id', tracking_id);
      }

      const { data: trackings } = await dbQuery;

      // 4. Construir contexto de los paquetes reales en la base de datos
      let dbContext = "PAQUETES REGISTRADOS EN LA BASE DE DATOS:\n";
      if (!trackings || trackings.length === 0) {
        dbContext += "No hay paquetes ni guías registradas actualmente.\n";
      } else {
        trackings.forEach((t: any, idx: number) => {
          const guia = t.guia || t.tracking_number || 'Sin guía';
          const paq = t.paqueteria || t.carrier || 'No especificada';
          const status = t.status || 'pending';
          const cliente = t.nombre_cliente || t.seller_name || 'Sin contacto';
          const url = t.tracking_url || buildCarrierUrl(paq, guia, null);
          const checked = t.last_checked_at ? new Date(t.last_checked_at).toLocaleString('es-MX') : 'No verificado aún';

          let statusEs = status;
          if (status === 'ready_for_pickup') statusEs = 'Listo para recoger (En sucursal/ventanilla)';
          else if (status === 'in_transit') statusEs = 'En tránsito / En camino';
          else if (status === 'completed') statusEs = 'Entregado';
          else if (status === 'returned') statusEs = 'Devuelto';
          else if (status === 'pending') statusEs = 'Pendiente de actualización';

          dbContext += `${idx + 1}. Guía: ${guia} | Paquetería: ${paq} | Contacto: ${cliente} | Estado: ${statusEs} | Última verificación: ${checked} | URL: ${url}\n`;
        });
      }

      if (newlyAddedGuia) {
        dbContext += `\n[SISTEMA]: Se acaba de agregar la guía "${newlyAddedGuia}" exitosamente a la base de datos y se realizó su primera verificación.\n`;
      }

      // 5. Preparar llamada a Gemini AI
      const apiKey = (
        Deno.env.get('Spirit') ||
        Deno.env.get('GEMINI_API_KEY') ||
        Deno.env.get('OPENAI_API_KEY') ||
        ''
      ).trim();

      if (!apiKey) {
        return new Response(
          JSON.stringify({
            reply: `INFORMACIÓN DE TUS PAQUETES:\n${dbContext}\n\n(Nota: Configura la API Key Spirit/GEMINI_API_KEY en Supabase para respuestas IA personalizadas).`
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const candidateModels = await discoverAvailableGeminiModels(apiKey);
      const systemInstruction = {
        parts: [
          {
            text: `Eres un Asistente Virtual Inteligente en español especializado en el rastreo de paquetes de la plataforma Viking TCG.
Tienes acceso DIRECTO y EN TIEMPO REAL a la base de datos de paquetes del usuario provista abajo.

REGLAS ABSOLUTAS E IMPERATIVAS:
1. Responde SIEMPRE de forma directa, amable, concisa y clara en español.
2. Queda STRICTAMENTE PROHIBIDO mostrar pensamientos internos, notas de razonamiento, borradores de pasos, metacomentarios o etiquetas <think> o <thought>.
3. NUNCA expliques qué es un número de tracking o cómo funciona el rastreo general a menos que el usuario explícitamente te pregunte la definición.
4. NUNCA digas que no puedes consultar la información o que no tienes acceso a internet. Tú YA TIENES la información real extraída de las páginas de rastreo de Correos de México, Estafeta, FedEx y DHL en la base de datos.
5. Utiliza ÚNICAMENTE la lista de paquetes proporcionada a continuación para responder las dudas del usuario o confirmar la actualización.

--- BASE DE DATOS DE PAQUETES ---
${dbContext}`
          }
        ]
      };

      const historyInput = history || conversation_history || [];
      const contents: GeminiContent[] = [];

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

          const validParts = parts.filter(p => p && p.text !== undefined);
          if (validParts.length === 0) continue;

          if (contents.length > 0 && contents[contents.length - 1].role === role) {
            contents[contents.length - 1].parts.push(...validParts);
          } else {
            contents.push({ role, parts: [...validParts] });
          }
        }
      }

      if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
        contents[contents.length - 1].parts.push({ text: userPrompt });
      } else {
        contents.push({ role: 'user', parts: [{ text: userPrompt }] });
      }

      let geminiRes: Response | null = null;
      let aiData: any = null;
      let lastApiError: string = '';

      for (const modelName of candidateModels) {
        const apiVersion = 'v1beta';
        const geminiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;

        try {
          const res = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction,
              contents,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 1024
              }
            })
          });

          const data = await res.json();
          if (res.ok && data.candidates && data.candidates.length > 0) {
            geminiRes = res;
            aiData = data;
            break;
          } else if (data.error && data.error.message) {
            lastApiError = `[${modelName}] ${data.error.message}`;
          }
        } catch (e: any) {
          lastApiError = `[${modelName}] ${e.message}`;
        }
      }

      let cleanReply = '';
      if (aiData) {
        const candidate = aiData.candidates?.[0];
        const resParts = candidate?.content?.parts || [];
        let rawReply = '';
        for (const part of resParts) {
          if (part.text) rawReply += part.text;
        }
        cleanReply = sanitizeAIResponse(rawReply);
      }

      if (!cleanReply) {
        cleanReply = `Aquí tienes el estado de tus paquetes en la base de datos:\n\n${dbContext}`;
      }

      return new Response(
        JSON.stringify({
          reply: cleanReply,
          success: true,
          count: trackings?.length || 0,
          trackings: trackings || []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // CASO B: EJECUCIÓN DIRECTA O CRON (Verificación de rastreos en segundo plano)
    // =========================================================================
    const checkResult = await checkAndUpdateTrackings(supabase, { user_id, tracking_id, force_all });

    if (checkResult.error) {
      return new Response(
        JSON.stringify({ error: checkResult.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: checkResult.count,
        results: checkResult.results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `Error interno en Edge Function tracking: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
