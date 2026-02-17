/**
 * TCG Dual - Chatbot con Inteligencia Artificial (Groq)
 *
 * ATENCIÓN DE SEGURIDAD:
 * Este script realiza llamadas a la API de Groq directamente desde el navegador.
 * Para usar 'Supabase Environment Variables' de forma segura, se recomienda
 * mover la lógica de la función 'askGroq' a una Supabase Edge Function y
 * llamarla desde aquí. De lo contrario, tu GROQ_API_KEY será visible para cualquiera.
 */

// --- CONFIGURACIÓN ---
// Si usas esto en el frontend, reemplaza con tu clave.
// Si lo mueves a Edge Functions, usa Deno.env.get("GROQ_API_KEY")
const GROQ_API_KEY = 'TU_API_KEY_AQUI';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

let chatbotContext = null;
let contextTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos de cache

// --- LÓGICA DE CONTEXTO ---

/**
 * Obtiene la información de tiendas y productos desde Supabase para alimentar la IA.
 * Implementa un RAG simplificado con cache de 5 minutos.
 */
async function getChatbotContext() {
    const now = Date.now();
    if (chatbotContext && (now - contextTimestamp < CACHE_DURATION)) {
        return chatbotContext;
    }

    try {
        // Obtenemos un resumen de las tiendas para no saturar el prompt y ahorrar tokens
        const { data: stores, error: storesErr } = await _supabase
            .from('usuarios')
            .select('id, store_name, horario, ubicacion')
            .eq('is_store', true)
            .limit(10);

        if (storesErr) throw storesErr;

        let context = "Eres el Asistente Virtual de TCG Dual. Ayudas con información de tiendas, horarios, ubicaciones y productos.\n";
        context += "INFORMACIÓN GENERAL DE TIENDAS:\n";

        for (const store of stores) {
            context += `- ${store.store_name || 'Tienda sin nombre'}: Horario: ${store.horario || 'No especificado'}, Ubicación: ${store.ubicacion || 'No especificada'}.\n`;
        }

        // Contexto específico de la tienda actual si el usuario está en una página de tienda
        const urlParams = new URLSearchParams(window.location.search);
        const storeParam = urlParams.get('store');
        if (storeParam) {
            const { data: currentStore } = await _supabase
                .from('usuarios')
                .select('id, store_name, horario, ubicacion')
                .eq('store_name', storeParam)
                .single();

            if (currentStore) {
                context += `\nCONTEXTO ACTUAL: El usuario está viendo la tienda "${currentStore.store_name}".\n`;
                context += `Detalles específicos: Horario ${currentStore.horario}, Ubicación ${currentStore.ubicacion}.\n`;

                // Productos destacados de esta tienda
                const { data: albums } = await _supabase
                    .from('albums')
                    .select('title')
                    .eq('user_id', currentStore.id)
                    .eq('is_public', true)
                    .limit(5);

                if (albums && albums.length > 0) {
                    context += `Álbumes disponibles en esta tienda: ${albums.map(a => a.title).join(', ')}.\n`;
                }
            }
        }

        chatbotContext = context;
        contextTimestamp = now;
        return chatbotContext;
    } catch (error) {
        console.error("Error al obtener contexto:", error);
        return "TCG Dual es una plataforma para coleccionistas de cartas TCG.";
    }
}

// --- LÓGICA DE IA ---

/**
 * Envía el mensaje del usuario a Groq con el contexto recuperado.
 */
async function askGroq(userMessage) {
    const context = await getChatbotContext();

    // Indicador de "Escribiendo..."
    const $container = $('#chat-messages');
    const thinkingId = 'bot-thinking-' + Date.now();
    const $thinkingMsg = $(`<div class="chat-msg msg-bot" id="${thinkingId}"><i>Escribiendo...</i></div>`);
    $container.append($thinkingMsg);
    $container.scrollTop($container[0].scrollHeight);

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: 'system', content: context },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.6,
                max_tokens: 500
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || 'Error en Groq API');
        }

        const botResponse = data.choices[0].message.content;

        // Mostrar respuesta real
        $(`#${thinkingId}`).html(botResponse);
        $container.scrollTop($container[0].scrollHeight);

    } catch (error) {
        console.error('Error Groq:', error);
        $(`#${thinkingId}`).text('Lo siento, hubo un error al procesar tu solicitud. Por favor intenta más tarde.');
    }
}

// --- INTEGRACIÓN ---

/**
 * Sobrescribe los controladores de eventos del chatbot original.
 */
function initAIChatbot() {
    console.log("Chatbot IA: Reemplazando controladores legacy...");

    $('#send-chat').off('click').on('click', function() {
        const text = $('#chat-input').val().trim();
        if (!text) return;

        if (typeof window.addChatMessage === 'function') {
            window.addChatMessage('user', text);
        }

        $('#chat-input').val('');
        askGroq(text);
    });

    $('#chat-input').off('keypress').on('keypress', function(e) {
        if (e.which == 13) $('#send-chat').click();
    });

    $('.faq-btn').off('click').on('click', function() {
        const question = $(this).text();
        if (typeof window.addChatMessage === 'function') {
            window.addChatMessage('user', question);
        }
        askGroq(question);
    });
}

// Esperar a que los scripts base se carguen completamente
$(document).ready(function() {
    setTimeout(initAIChatbot, 1200);
});
