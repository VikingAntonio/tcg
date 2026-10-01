// ====================================================================
// SUPABASE EDGE FUNCTION PARA RASTREO AUTOMÁTICO DE TRACKING (tracking/index.ts)
// ====================================================================
// Esta función recorre los registros de la tabla 'public.tracking',
// ingresa al enlace/URL de rastreo de cada paquete (Correos de México, Estafeta,
// FedEx, DHL, etc.) y analiza el texto de la página para actualizar el estado.
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
    lower.includes('ocurre')
  ) {
    return 'ready_for_pickup';
  }

  // 2. Entregado / Completado
  if (
    lower.includes('entregado') ||
    lower.includes('recibido por') ||
    lower.includes('delivered') ||
    lower.includes('entrega realizada')
  ) {
    return 'completed';
  }

  // 3. Devuelto
  if (
    lower.includes('devuelto') ||
    lower.includes('retornado') ||
    lower.includes('devolución')
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
    lower.includes('reparto')
  ) {
    return 'in_transit';
  }

  return null;
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
        JSON.stringify({ error: 'Configuración incompleta de Supabase en Edge Function (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body: RequestBody = await req.json().catch(() => ({}));
    const { user_id, tracking_id, force_all } = body;

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

    if (error) {
      return new Response(
        JSON.stringify({ error: `Error al consultar la tabla tracking: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No hay guías pendientes por verificar.', results: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
          const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seg timeout

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
          updateData.is_notified = false; // Reset notification flag so proactive chatbot notifies user
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

    return new Response(
      JSON.stringify({
        success: true,
        count: results.length,
        results
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
