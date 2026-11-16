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
- **Rotación manual**: arrastrar sobre el visor gira el modelo (`ROTATE_SPEED`, límites `PHI_MIN/PHI_MAX`). El auto-rotado se pausa al arrastrar y se reanuda tras `IDLE_RESUME_MS` de inactividad. El `touch-action:none` del canvas evita el scroll encima; el gesto de "tocar" (sin arrastre) sigue abriendo el menú (`michatbot.js`).
- Render bajo demanda (solo rota si hay auto-rotate o cambio), DPR limitado, y recuperación ante `webglcontextlost` (reconstruye el renderer en un **canvas nuevo**, porque un canvas perdido siempre devuelve el mismo contexto muerto).
- Three.js se importa por `importmap` si la página ya lo declara (`carrito.html`, `public.html`) o por CDN `esm.sh/three@0.160.0` si no; así no se duplica la instancia de three.
- `isSupported()` se prueba **una sola vez** y se cachea (no crear contextos de prueba repetidos).
- Si el módulo no carga o falla `init()`, `create()` devuelve `null` y `michatbot.js` cae a `model-viewer` (`buildCornerModelViewer`). Por eso el chat/detalle usan `useMobileViewer()` (comprueba `isCreated()`) antes de `moveTo`.
- Cargar el script **antes** de `michatbot.js` en cada vista (25 HTML). En escritorio el flujo con `model-viewer` queda intacto.

## Módulo de Inversiones — cálculos y hoja de cálculo (`docs/inversiones.html`)
- Fuente única de datos: `docs/js/inversiones.js` sobre `investment_categories` (vaults) e `investment_cards` (activos). La vista pública `public.html` reutiliza las mismas tablas vía `docs/js/app.js`.
- Cálculos centralizados en `computeCardMetrics(card)` (por carta) y `computeVaultTotals(cards)` (por colección). No duplicar fórmulas: `cost = purchase_price × qty`, `market = current_price × qty`, `saleTarget = sale_price × qty`, `unrealized = market − cost`, `projected = saleTarget − cost`, `marginVsMarket = saleTarget − market`. Las cartas vendidas (`is_sold`) se excluyen de latente/estimada y suman a `realized`.
- `sale_price` es el precio objetivo de venta (se guarda desde el modal, campo `#inv-card-sale-price`). Al marcar vendida se guardan `sold_price`, `sold_quantity`, `sold_at` (función `registerCardSale`, botón en la pestaña RENTABILIDAD). El ledger `investment_transactions` (compra/venta/precio) es best-effort: si la tabla no existe, `logInvestmentTransaction` no rompe el flujo.
- Modos intactos: `renderAlbumMode` (binders/turn.js), `renderSlideMode` (Swiper cards) sin cambios de estructura; `renderListMode` es el único enriquecido (summary + `.inv-list-metrics`). No tocar el orden DOM de los modos binder/slide.
- Hoja de cálculo: icono `.inv-ledger-open` (sobre la portada) y botón `.btn-ledger-inv-cat` en cada tarjeta de colección → `openVaultLedger(cat)` (modal `#vault-ledger-modal`): totales, tabla por carta con fila de totales (`tfoot`) y registro de movimientos. La tabla hace scroll horizontal dentro de `.inv-ledger-table-wrap` (no desborda la página).
- Migración SQL: `docs/F_add_investment_sales_and_ledger.sql` (idempotente, solo añade columnas y crea `investment_transactions`). Ejecutar en Supabase antes de usar venta/ledger; el resto funciona sin ella.
- Pestañas del modal: RESUMEN (strip de métricas `#inv-detail-metrics`), RENTABILIDAD (`renderProfitabilityTab`), DATOS, IMAGES, MOVIMIENTOS. En modo "nuevo activo" se ocultan RESUMEN/RENTABILIDAD/MOVIMIENTOS hasta guardar. Si se abre el modal con `defaultTab='inv-tab-rentabilidad'` hay que poblarla explícitamente (no solo en el click).
- Pruebas Playwright: los `let` de módulo (p.ej. `localInvestmentCards`) NO están en `window`; usar `page.evaluate(() => window.eval('localInvestmentCards = ...'))` para inyectar estado. Para el ledger, interceptar `**/rest/v1/investment_cards**` con `page.route` (no se puede reasignar el `const _supabase`).

## Guardado por lotes de `packages.html` (BDD Global)
- El botón "Guardar en BDD Global" (`#btn-save-bdd-global`) inserta cada item de `window.bddGlobalQueue` en una tabla según `item.type`: `sleeves|deckbox|coin|mats|dice` → `accessories`, `sealed` → `sealed_products`, `preorder` → `preorders`, resto (single) → `viking_data`.
- Esquema real (verificado vía REST con la anon key): `viking_data`, `accessories`, `sealed_products` y `preorders` **no** tienen columna `description`; `accessories` tampoco tiene `model_url`. PostgREST rechaza el INSERT entero con "Could not find the 'description' column ... in the schema cache" → se guardaban 0 registros.
- Arreglo doble: (1) `docs/G_add_description_and_media_columns.sql` añade `description` a `viking_data/accessories/sealed_products/preorders` y `model_url` a `accessories` (idempotente, termina con `NOTIFY pgrst, 'reload schema'`); (2) `insertResilient(table, payload)` en el inline JS de `packages.html` detecta el error de columna faltante, borra la clave opcional (`description`/`model_url`) y reintenta, de modo que guarda **aunque el SQL no se haya ejecutado**. Un error real (p.ej. RLS) NO se traga: se muestra.
- Los duplicados de nombre SÍ están permitidos (no hay constraint único en `viking_data`); el "no me deja guardar" era solo el fallo de columna.
- Las cartas sueltas guardan `type: 'card_single'` y aparecen en todas las búsquedas por nombre porque `VikingData.search()` (js/viking-data.js) hace `ilike('name', ...)` sin filtrar por `type`; lo usan utils.js, fast-mode.js, deseos.js, productoSellado.js, binders/admin/inversiones, etc.
- `packages.html` es una vista con gate de auth (redirige a index.html si no hay sesión admin). Para probarla con Playwright: `ctx.addInitScript(() => localStorage.setItem('tcg_session', JSON.stringify({id,role:'admin'})))` y mockear `**/rest/v1/usuarios**`. Registrar la ruta genérica `**/rest/v1/**` ANTES que las específicas (Playwright da prioridad a la última registrada).

## Rendimiento móvil — Service Worker (crítico)
`docs/sw.js` no llegaba a **instalarse**: `URLS_TO_CACHE` incluía `./build.html`, que ya no existe, y `cache.addAll()` rechaza todo el install si **una** URL da 404 → el SW quedaba sin activar y **no se cacheaba nada**. Como el `.gltf` del asistente referencia un `.bin` de ~2.7 MB, se re-descargaba en cada navegación (lentísimo en móvil).
- Install tolerante: se cachea cada URL por separado (`cache.add(url).catch(...)`) en vez de `addAll`.
- `isModelAsset` incluye `bin|ktx2|basis|drc` además de `glb|gltf`, para cache-first de los buffers/texturas del modelo (antes caían al branch network-first de Supabase).
- Al cambiar assets, subir `STATIC_CACHE` (ahora `viking-static-v223`).
