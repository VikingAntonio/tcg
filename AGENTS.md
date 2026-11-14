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
