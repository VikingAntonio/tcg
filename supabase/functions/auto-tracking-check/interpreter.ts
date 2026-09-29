import { InterpretationResult, ScrapeResult, TrackingStatus } from "./types.ts";

export async function interpreter(
  scrape: ScrapeResult,
  previousStatus: string = "pending"
): Promise<InterpretationResult> {
  const geminiApiKey = (Deno.env.get("Spirit") || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("OPENAI_API_KEY") || "").trim();

  if (!geminiApiKey || !scrape.success) {
    return {
      status: (previousStatus as TrackingStatus) || "pending",
      summary: scrape.error || "No se pudo consultar el sitio de la paquetería",
      confidence: "low"
    };
  }

  const prompt = `Eres un sistema experto de rastreo de paquetes de logística para paqueterías (Correos de México, Estafeta, FedEx, DHL, Paquetexpress, etc.).

Tu tarea es analizar el texto extraído del sitio web de seguimiento de la paquetería "${scrape.carrier}" para el número de guía "${scrape.trackingNumber}".

ESTADO ACTUAL PREVIO DEL PAQUETE EN SISTEMA: "${previousStatus}"

TEXTO EXTRAÍDO DEL SITIO WEB:
"""
${scrape.rawText}
"""

REGLAS STRICTAS DE INTERPRETACIONAL Y MAPPING DE ESTADOS:
Debes mapear la información únicamente a uno de los siguientes 5 estados internos exactos:

1. "ready_for_pickup":
   - ÚNICAMENTE Y EXCLUSIVAMENTE cuando la información confirme explícitamente que el paquete YA ESTÁ LISTO / DISPONIBLE EN VENTANILLA O EN SUCURSAL PARA QUE EL CLIENTE VAYA A RECOGERLO.
   - Ejemplos válidos: "En ventanilla", "Disponible para recoger", "Disponible en oficina", "En sucursal para entrega en ventanilla", "Disponible en módulo", "Llegó a oficina postal para entrega en ventanilla".
   - REGLA CRÍTICA DE CONSERVADURISMO: NO marcas un paquete como "ready_for_pickup" si solo dice "en tránsito", "en camino", "llegó a centro de distribución de la ciudad", "en ruta de entrega", "salida de centro logístico". Si no hay evidencia contundente de que está en ventanilla/oficina listo para recoger, NO USES "ready_for_pickup".

2. "completed":
   - Cuando la página indique que el paquete ya fue entregado con éxito al destinatario.
   - Ejemplos: "Entregado", "Entregado en domicilio", "Recibido por destinatario", "Entrega realizada".

3. "returned":
   - Cuando el paquete fue devuelto o está en proceso de devolución al remitente.
   - Ejemplos: "Devuelto al remitente", "Devolución en proceso", "Rechazado".

4. "in_transit":
   - Cuando el paquete se encuentra en movimiento, en traslado, en procesmiento postal, despachado o en trayecto.
   - Ejemplos: "En tránsito", "Salió de centro operativo", "En traslado a destino", "Recepcionado en origen".

5. "pending":
   - Cuando la guía aún no muestra eventos registrado en el sistema o marca número inválido / no encontrado.

FORMATO DE RESPUESTA:
Responde ÚNICAMENTE un objeto JSON válido sin etiquetas Markdown ni bloques de código, con este formato exacto:
{
  "status": "ready_for_pickup" | "completed" | "returned" | "in_transit" | "pending",
  "summary": "Resumen conciso en 1 frase del estado reportado por la paquetería",
  "confidence": "high" | "medium" | "low"
}`;

  const candidateModels = ["models/gemini-2.0-flash", "models/gemini-1.5-flash", "models/gemini-1.5-pro"];

  for (const modelName of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${geminiApiKey}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
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
        if (jsonMatch) cleanText = jsonMatch[0];

        const parsed = JSON.parse(cleanText);

        const validStatuses: TrackingStatus[] = ['pending', 'in_transit', 'ready_for_pickup', 'completed', 'returned'];
        const status = validStatuses.includes(parsed.status) ? (parsed.status as TrackingStatus) : (previousStatus as TrackingStatus);

        return {
          status,
          summary: parsed.summary || "Estado interpretado",
          confidence: parsed.confidence || "high"
        };
      }
    } catch (err) {
      console.warn(`Error interpreting with ${modelName}:`, err);
    }
  }

  return {
    status: (previousStatus as TrackingStatus) || "in_transit",
    summary: "No se pudo interpretar la respuesta de Gemini",
    confidence: "low"
  };
}
