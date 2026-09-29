import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
      message = "",
      image_base64 = null,
      image_mime = "image/jpeg",
      conversation_history = [],
      is_proactive = false
    } = await req.json().catch(() => ({}));

    // Return empty proactive response if proactive notification requested
    if (is_proactive) {
      return new Response(JSON.stringify({ should_notify: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const requestMsg = (message || "").trim();
    if (!requestMsg && !image_base64 && conversation_history.length === 0) {
      return new Response(
        JSON.stringify({ reply: "¡Hola! ¿En qué te puedo ayudar o de qué te gustaría platicar hoy?" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiApiKey = (Deno.env.get("Spirit") || Deno.env.get("OPENAI_API_KEY") || "").trim();
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ reply: "Lo siento, la API Key no está configurada correctamente en el servidor." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Eres una inteligencia artificial conversacional avanzada, completa, versátil, empática, amable e infinitamente inteligente (al estilo de ChatGPT / Gemini). Hablas SIEMPRE Y ÚNICAMENTE en español de forma natural, fluida, cercana, clara y directa.

ASISTENTE GENERAL MULTI-PROPÓSITO DE CONOCIMIENTO UNIVERSAL:
- Eres una IA de conocimiento general sin limitaciones de temas. Sabes de cocina (recetas y consejos), ciencia, tecnología, programación, matemáticas, historia, cultura popular, cine, música, videojuegos, filosofía, pasatiempos, consejos de vida diaria y plática casual amigable.
- Si el usuario te hace cualquier pregunta (sobre ciencia, recetas, código, consejos, reflexiones o simplemente platicar), RESPÓNDELE DE INMEDIATO con la máxima calidad, calidez, detalle y claridad en español.
- TODAS tus respuestas deben ser formuladas 100% por ti de forma dinámica, original, amigable y natural.
- No muestres bloques de código de pensamiento (<think>), "Thought:", ni etiquetas internas. Responde directamente con un texto bien estructurado y fácil de leer.`;

    // Sanitize conversation history enforcing strict role alternation (user / model)
    function sanitizeHistory(history: any[]): any[] {
      if (!Array.isArray(history)) return [];
      const cleanList: any[] = [];
      for (const msg of history) {
        if (!msg || typeof msg !== "object") continue;
        const role = msg.role === "model" || msg.role === "assistant" ? "model" : "user";
        let parts: any[] = [];
        if (Array.isArray(msg.parts)) {
          parts = msg.parts;
        } else if (typeof msg.content === "string") {
          parts = [{ text: msg.content }];
        } else if (typeof msg.text === "string") {
          parts = [{ text: msg.text }];
        }
        const validParts = parts.filter(
          (p: any) => p && (p.text !== undefined || p.inlineData !== undefined)
        );
        if (validParts.length === 0) continue;

        if (cleanList.length > 0 && cleanList[cleanList.length - 1].role === role) {
          cleanList[cleanList.length - 1].parts.push(...validParts);
        } else {
          cleanList.push({ role, parts: [...validParts] });
        }
      }
      return cleanList;
    }

    const contents = sanitizeHistory(conversation_history);

    // Prepare current turn input parts
    const userParts: any[] = [];
    if (requestMsg) {
      userParts.push({ text: requestMsg });
    }
    if (image_base64) {
      const cleanBase64 = image_base64.replace(/^data:image\/\w+;base64,/, "");
      userParts.push({
        inlineData: {
          mimeType: image_mime || "image/jpeg",
          data: cleanBase64
        }
      });
    }

    if (userParts.length > 0) {
      if (contents.length > 0 && contents[contents.length - 1].role === "user") {
        contents[contents.length - 1].parts.push(...userParts);
      } else {
        contents.push({ role: "user", parts: userParts });
      }
    }

    const candidateModels = [
      "models/gemini-2.0-flash",
      "models/gemini-1.5-flash",
      "models/gemini-1.5-pro"
    ];

    let cleanReply = "";

    for (const modelName of candidateModels) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${geminiApiKey}`;

      try {
        const res = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (rawText) {
            cleanReply = rawText
              .replace(/<think>[\s\S]*?<\/think>/gi, "")
              .replace(/```json[\s\S]*?```/gi, "")
              .trim();
            if (cleanReply) break;
          }
        }
      } catch (e) {
        console.warn(`Error llamando a Gemini con modelo ${modelName}:`, e);
      }
    }

    if (!cleanReply) {
      cleanReply = "Lo siento, no pude procesar tu mensaje en este momento. Intenta de nuevo más tarde.";
    }

    return new Response(JSON.stringify({ reply: cleanReply }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(
      JSON.stringify({ reply: "Ocurrió un error al procesar la solicitud: " + err.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
