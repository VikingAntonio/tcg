# VikingAntonio/tcg — Notas del repositorio

Sitio estático TCG servido desde `docs/`. Sin build step: se editan HTML/CSS/JS y se sirven tal cual.

## Estructura clave
- `docs/*.html` — vistas (una por pantalla). `docs/admin.html` es la referencia del panel superior.
- `docs/css/style.css` — estilos de casi todas las vistas. `docs/css/style2.css` — usado por `index.html`.
- `docs/js/*.js` — lógica por vista; `docs/js/michatbot.js` = asistente 3D (model-viewer).
- `docs/sw.js` — Service Worker (cachés). **Subir `STATIC_CACHE` (vNNN) en cada release de assets** para forzar refresco.

## Panel superior móvil (`.top-left-panel` > `.pill-panel`)
Patrón canónico (igual que `admin.html`), orden DOM: `theme-group` → (auction-pill) → `cart` → `avatar`.
- En móvil (<=768px) `#header-theme-group` se oculta por CSS; el orden visual L→R queda: avatar, carrito.
- El icono de notificaciones (`#notification-btn`) se **inyecta por JS** (`js/notifications.js` → `injectNotificationPill()`), que se auto-carga desde `js/utils.js`. Si una vista no incluye `utils.js` o redirige por auth, la campana no aparece.
- `packages.html` redirige a `index.html` si no hay sesión (gate de auth), por eso su panel medido sin sesión es el de `index.html`.
- Para verificar: medir `.pill-panel` (x,y,width) en móvil y escritorio; debe coincidir entre vistas.

## Asistente 3D móvil (`js/michatbot.js`)
Problema: en móvil, crear un 2º contexto WebGL (visor de chat/detalle) provoca pérdida de contexto (flash negro + cuadro blanco, visor vacío).
Solución implementada:
- `isLowPowerDevice()` — detecta móvil/GPU débil (UA + pantalla + núcleos).
- `primaryViewerQualityAttrs()` — atributos ligeros en low-power (`shadow-intensity="0"`, sin high-performance).
- `movePrimaryViewerTo()` / `returnPrimaryViewerHome()` — en móvil se reutiliza **un solo** `#michatbot-viewer` para el home, el chat y el detalle; en escritorio se mantiene el comportamiento previo.
- Recuperación de contexto: soft reload de `src` y, como último recurso, rebuild del visor.
- IMPORTANTE: los `.on()` del bloque de init deben ir con `.off()` previo. `initMichatbot()` corre varias veces (app.js, admin.js, binders.js, etc.) y los handlers duplicados rompían el cierre de overlays (p.ej. `#close-michatbot-detail`).

## Carrito (`docs/carrito.html`)
- Lógica intacta (`Cart`, localStorage `tcg_cart_items`). Solo diseño/markup.
- Estructura responsiva: `.cart-page-container`, `.cart-header`, `.cart-item` (grid), `.cart-item-foot`.
- Grid medido: móvil `84px 1fr`, escritorio `96px 1fr auto`. Verificar `scrollWidth - innerWidth === 0`.

## Pruebas
No hay framework de tests. Se usa Playwright ad-hoc con el server local:
- Servir: `python -m http.server 12000` dentro de `docs/`.
- Comprobar panel móvil/escritorio, reutilización de visor 3D y overflow del carrito con scripts temporales (borrarlos al terminar).

## Convenciones
- No introducir build ni dependencias nuevas. Mantener funciones existentes al rediseñar UI.
- Español en comentarios/UI. No dejar archivos temporales en el repo.

## Regresión GLTF móvil (redimensionar el asistente) — causa y arreglo
Síntoma: al cambiar el tamaño del asistente 3D en móvil, la pantalla parpadea en negro y el `model-viewer` queda en blanco; al recargar, el visor no renderiza.
Causa real: `model-viewer` 3.3.x dimensiona su buffer WebGL según `devicePixelRatio` (×3 en iPhone). Un visor de 150px reservaba 450px. El slider disparaba `input` decenas de veces por segundo y cada cambio reasignaba el buffer → se agotaba la memoria de GPU y se perdía el contexto.
Arreglo aplicado en `docs/js/michatbot.js` (commit 1bb16e5):
- `devicePixelRatio` efectivo limitado a 1.5 en móviles (canvas 225 en vez de 450 en iPhone 12).
- `setScale(scale, persist)`: agrupa los cambios en un `requestAnimationFrame` (un solo cambio de tamaño por frame) y persiste en `localStorage('michatbot_scale')`.
- Al iniciar se restaura el tamaño guardado (evita volver a 150px y reasignar).
- La recuperación de contexto ya NO recarga `src` en bucle; solo actúa ante un `error` real de carga, con backoff, y libera el contexto viejo con `WEBGL_lose_context` antes de reconstruir.
- `visibilitychange` pausa la rotación de todos los visores cuando la pestaña queda oculta.
Prueba de regresión: arrastrar el slider (40–50 ticks). Antes: canvas 1125px, reasignaciones constantes. Después: canvas 563px (DPR 1.5), 1 solo contexto, `loaded:true`. Script Playwright temporal; borrarlo al terminar.

## Panel superior móvil (`.top-left-panel` / `.pill-panel`)
- Orden visual (row-reverse): tema > carrito > avatar. Notificaciones las inyecta `js/notifications.js` (cargado por `js/utils.js`), insertándose antes de `.user-menu-container`.
- En móvil `#header-theme-group` se oculta (queda en el menú de avatar); solo visibles carrito + avatar + notificaciones.
- OJO con falsos positivos: al medir con Playwright, el ancho del panel puede dar 106 en vez de 150 si se mide antes de que `notifications.js` inyecte el icono (carga asíncrona). Esperar ~5-6s o esperar el nodo.
- `index.html` y `packages.html` usan `css/style2.css` (sistema neumórfico con variables `--primary`, `--bg-main`), NO el sistema `--primary-color` de `style.css`. Por eso sus botones de tema son inertes a propósito: NO añadir el grupo de tema ahí sin migrar las variables. `public.html` usa el header de tienda (`.store-header`), intencional.
- Tras cambios de assets, subir `STATIC_CACHE` en `docs/sw.js` (p. ej. v219 → v220) para invalidar la caché del service worker.

## Carrito — detalles en etiquetas
Los detalles del producto se muestran como chips (`.cart-tags`/`.cart-tag`) que se envuelven, en vez de una línea con ` | `. La fila de acciones (`.cart-item-foot`) hace `flex-wrap` en móvil. Verificar `overlap:false` y `scrollWidth === innerWidth`.

## Visor 3D móvil ligero (`docs/js/michatbot-mobile3d.js`)
Sustituye a `model-viewer` **solo en móvil/GPU débil** (`useMobile3D()`), porque `model-viewer` 3.3.x crea un contexto WebGL pesado por cada visor y en el celular se agotan (cuadro blanco / pantalla negra).
- API: `window.MichatbotMobile3D = { isSupported, isCreated, getViewer, create, moveTo, setAutoRotate, pause, resume, release, setModel }`.
- Un **único** `<canvas class="michatbot-mobile-viewer">` reutilizado para home/chat/detalle mediante `moveTo(container)`; nunca se crea un 2º contexto.
- Render bajo demanda (solo rota si hay auto-rotate o cambio), DPR limitado, y recuperación ante `webglcontextlost` (recrea el renderer en el mismo canvas).
- Three.js se importa por `importmap` si la página ya lo declara (`carrito.html`, `public.html`) o por CDN `esm.sh/three@0.160.0` si no; así no se duplica la instancia de three.
- `isSupported()` se prueba **una sola vez** y se cachea (no crear contextos de prueba repetidos).
- Si el módulo no carga o falla `init()`, `create()` devuelve `null` y `michatbot.js` cae a `model-viewer` (`buildCornerModelViewer`). Por eso el chat/detalle usan `useMobileViewer()` (comprueba `isCreated()`) antes de `moveTo`.
- Cargar el script **antes** de `michatbot.js` en cada vista (25 HTML). En escritorio el flujo con `model-viewer` queda intacto.

## Rendimiento móvil — Service Worker (crítico)
`docs/sw.js` no llegaba a **instalarse**: `URLS_TO_CACHE` incluía `./build.html`, que ya no existe, y `cache.addAll()` rechaza todo el install si **una** URL da 404 → el SW quedaba sin activar y **no se cacheaba nada**. Como el `.gltf` del asistente referencia un `.bin` de ~2.7 MB, se re-descargaba en cada navegación (lentísimo en móvil).
- Install tolerante: se cachea cada URL por separado (`cache.add(url).catch(...)`) en vez de `addAll`.
- `isModelAsset` incluye `bin|ktx2|basis|drc` además de `glb|gltf`, para cache-first de los buffers/texturas del modelo (antes caían al branch network-first de Supabase).
- Al cambiar assets, subir `STATIC_CACHE` (ahora `viking-static-v221`).
