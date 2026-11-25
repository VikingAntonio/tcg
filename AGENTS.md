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

## Inversiones — buscador y cierre de modales
- `inversiones.html` **debe** cargar `js/viking-data.js` (junto a `js/supabase-config.js`) para que `VikingData` exista; `searchExternalCard` (utils.js) sólo consulta `viking_data` si `typeof VikingData !== 'undefined'`. Sin ese script, el buscador sólo devuelve cartas externas y nunca las cartas propias guardadas en la BDD. Otros visores (binders.html) ya lo cargan.
- Los modales usan `.overlay-content` (de `style.css`), que trae `align-items: center`. Como `.inv-modal-header` es un hijo flex en columna, quedaba encogido a su contenido y centrado → la X (`.inv-close-btn`, `position:absolute`) aparecía a ~350-450px del borde derecho. Arreglo: `align-items: stretch` en `#investment-card-modal .overlay-content` y en `.inv-ledger-content`, y `width: 100%` en `.inv-modal-header`. Resultado: X a 16px (13px móvil) de la esquina, sin overflow.
- Los `.inv-tab-link` con sus data-tab deben seguir siendo 5; el buscador vive en la pestaña DATOS (`#inv-tab-datos`), por eso al probar con Playwright hay que activar esa pestaña antes de `fill()`.

## Subida de medios — `window.MediaUpload` (bug de subida)
`js/media-upload.js` declara `const MediaUpload = {...}`. Un `const` en el top-level crea un **global léxico**, NO una propiedad de `window`; por eso `window.MediaUpload` era `undefined` aunque `typeof MediaUpload === 'object'`. El código que guarda con `if (window.MediaUpload && ...)` (p. ej. `packages.html` → `handleBddFileSelected`) saltaba la subida, intentaba el fallback al bucket `accessories` (bloqueado por RLS → 403) y acababa guardando un `URL.createObjectURL(file)` = `blob:https://...` **muerto** en `image_url`. Resultado: cartas guardadas con imagen rota. Arreglo: `window.MediaUpload = MediaUpload;` al final del archivo. El resto de vistas usan la referencia léxica (`MediaUpload.uploadImage`) y ya funcionaban.
- El archivo se llamaba `cloudinary-upload.js` y el global `CloudinaryUpload`; se renombraron para no exponer el proveedor en el código servido.

## Inversiones — bugs de gráfica, preview, slots y reordenamiento (binder)
- **Gráfica temblorosa en el modal (RESUMEN):** `renderPriceHistoryChart` crea un Chart.js con `responsive:true, maintainAspectRatio:false`, que dimensiona el canvas a partir del padre. El contenedor usaba `height: calc(100% - 30px)` dentro de un `flex:1`, así que canvas↔contenedor se redimensionaban mutuamente en bucle (el modal oscilaba 756→735… sin parar). Arreglo: `.inv-detail-chart-container` con **altura fija** (`200px`) y `position:relative`; el canvas se adapta dentro, no al revés. No volver a usar `%`/`flex` como altura de un contenedor de Chart.js responsive.
- Al cerrar el modal se hace `invPriceChart.destroy()` para no dejar el chart vivo apuntando a un canvas oculto.
- **Preview de la carta elegida no aparecía:** `syncAddPreview()` estaba declarada **dentro** de `initInvestmentListeners`, así que el override de `inversiones.html` (`window.syncAddPreview = ...`, aplicado en un `<script>` posterior) capturaba `undefined` y nunca se ejecutaba. Arreglo: `syncAddPreview()` a **scope de módulo** (junto a las demás funciones, no anidada). Ojo: en este repo las funciones de nivel superior de un `.js` clásico SÍ son accesibles como `window.<fn>`; las anidadas y los `let`/`const` de módulo NO.
- **Slot elegido ignorado:** al guardar se hacía `cardData.position = localInvestmentCards.length` (siempre al final). Ahora un click en un slot vacío guarda `pendingSlotIndex` (índice global = `pageIdx*numSlots+slotIdx`); al insertar se usa esa posición, se hace `splice` en el array local y se persiste con `persistInvestmentPositions()`. `pendingSlotIndex` se resetea en ADD ASSET, al abrir una carta existente y al cerrar el modal.
- **Reordenar (drag & drop):** los slots llenos son `draggable`; en `dragstart` se hace `$album.turn('disable', true)` para que turn.js no gire la página durante el arrastre, y en `dragend`/`drop` se rehabilita. El `drop` llama a `moveInvestmentCard(from, to)` → re-render + `persistInvestmentPositions()` (PATCH `position` solo de las cartas que cambiaron). Un `invDragJustEnded` (timestamp) evita que el `click` posterior abra el modal.
- **Migración SQL:** `docs/G_add_investment_position_and_price_history.sql` (idempotente) documenta `investment_cards.position` + índice y crea `investment_price_history` con RLS por dueño de la carta. Ambas ya existían en producción pero no había migración en el repo.
- **Ledger por colección:** icono `fa-table` en cada tarjeta de colección (`.inv-ledger-open` y `.btn-ledger-inv-cat`) abre `openVaultLedger()`; la tabla ya traía 11 columnas y ahora incluye **"Margen vs mercado"** (importe + `%`), en filas y en el pie de totales (colspan vacío = 12).

## Inversiones — precio de compra total por colección (lote)
Caso real: se compran N cartas juntas por un solo precio (p.ej. 10 cartas por $1000) y no conviene repetir ese precio carta por carta.
- Columna nueva `investment_categories.total_purchase_cost` (DECIMAL, nullable) → migración idempotente `docs/H_add_total_purchase_cost_to_investment_categories.sql`.
- `catLotCost(cat)` devuelve el lote o `null`. `computeVaultTotals(cards, lotOverride)` y `computeCardMetrics(card, costOverride)` aceptan un costo que **sustituye** al `purchase_price`.
- `allocateLotCost(cards, lot)` reparte el lote **proporcional al valor de compra** de cada carta (base = `purchase_price*qty`); si ninguna carta tiene precio, reparte **por cantidad**. La suma de asignaciones es exactamente el lote.
- El lote es autoritativo: `computeVaultTotals` fuerza `totals.cost = lot` (no la suma redondeada) y expone `hasLotCost`/`lotCost`. Si el lote es `null` todo vuelve al cálculo por carta (sin regresión).
- Se aplica en: tarjetas de colección, resumen de lista, métricas por carta del modo lista, pestaña RESUMEN (`#inv-detail-metrics`), pestaña RENTABILIDAD y el ledger (`openVaultLedger`, que además marca la columna "Costo unit." con `(lote)`).
- Los modales CREAR/EDITAR VAULT (Swal) incluyen el input `#swal-inv-vault-lot`. Si la columna aún no existe en la BD, `saveInvestmentCategory`/`updateInvestmentCategory` reintentan sin `total_purchase_cost` (igual que ya hacían con `grid_layout`) para no romper la creación.
- Helpers de conveniencia: `currentLotMap(cards)` y `currentCardCost(card, lotMap)` usan `currentInvestmentCategory`.
- **Dónde se pone el valor (dentro del binder):** `editVaultLotCost()` abre un Swal solo con el campo del lote. Se dispara desde 3 sitios: `#btn-edit-vault-lot` (cabecera escritorio), `#btn-edit-vault-lot-mobile` (panel lateral móvil) y `#btn-inv-lot-from-card` (justo debajo del campo "Precio compra" de la carta, en la pestaña DATOS). `#inv-desktop-lot-cost`/`#inv-mobile-lot-cost` muestran "Lote: $X" o "Costo por carta"; `updateVaultLotIndicators()` los refresca en `loadInvestmentCards()`. `updateCardLotHint(card)` muestra bajo el precio de compra el lote y la parte asignada a esa carta.


## Inversiones — reporte general SIN inventar precios (lote no se reparte)
Regla de oro del usuario: los cálculos usan **solo los valores que él escribe**. Nunca se inventan ni se reparten precios.
- `computeCardMetrics(card)` (docs/js/inversiones.js) usa SIEMPRE `purchase_price`, `current_price`, `sale_price` × `quantity` de la propia carta. **Ya no acepta `costOverride`** (se eliminó el reparto del lote).
- `computeVaultTotals(cards, lotOverride)`:
  - `sumCardCost` = suma del precio de compra real de TODAS las cartas.
  - `cost` = **lote** si está definido; si no, `sumCardCost`. El lote es SOLO el total general; **nunca** se reparte por carta (bug histórico: con lote 3800 y compras en 0, repartía 3800/nº cartas ≈ 211 por carta y lo mostraba como "Lo que pagué").
  - `market` (todas), `marketActive` (disponibles), `saleAll` (todas: incluye vendidas/no disponibles), `saleActive` (solo disponibles), `realized`, `soldCount`/`soldUnits`.
  - Derivados: `unrealized = market − cost`, `projected = saleAll − cost`, `roi`, `marginPct`. `saleTarget` = alias de `saleAll`.
- **Eliminados**: `allocateLotCost`, `currentLotMap`, `currentCardCost` y el uso de `costOverride`. Si vuelve a aparecer la tentación de "repartir el lote", NO hacerlo: el usuario lo pidió explícitamente.
- Ledger (`openVaultLedger(cat)`, recibe el objeto categoría): columna "Costo unit." muestra `card.purchase_price` real (sin "(lote)"); el pie usa el costo general.
- `updateCardLotHint` solo avisa "Lote de la colección: $X (total general, no se reparte por carta)".
- Reporte general (`renderCalcSheet`) con dos secciones: *Inversión y valores* (LO QUE PAGUÉ (TOTAL) · VALOR DE MERCADO · PRECIO DE VENTA (TODO) · PRECIO DE VENTA (DISPONIBLE)) y *Ganancia (venta − compra)* (GANANCIA SI VENDO TODO · GANANCIA SI VENDO LO DISPONIBLE · GANANCIA A PRECIO DE MERCADO · RENDIMIENTO SOBRE LO INVERTIDO) + pie (realizado / fuera de cartera).
- Ayuda ⓘ: `INV_METRIC_HELP` + `invInfoIcon(key)`; handler `$(document).on('click', '.inv-info-icon')` abre un Swal. Claves reporte: `cost, market, saleAll, saleActive, gainSaleAll, gainSaleActive, gainMarket, roi, realized, sold`; por carta: `saleTarget, unrealized, projected, margin`.
- Checkbox `#inv-card-available-toggle` = "ESTADO (¿DISPONIBLE?)"; al apagarlo muestra **VENDIDO** y la carta deja de contar como disponible.
- CSS: `.inv-calc-sheet/.inv-calc-head/.inv-calc-section-title/.inv-calc-grid/.inv-calc-card/.inv-calc-chips/.inv-calc-sold`, `.inv-info-icon`, `.inv-list-item-out`, `.inv-ledger-row-out`.
- Verificado con Playwright (escritorio + móvil): lote 3800 + compras en 0 + venta 3500 → "LO QUE PAGUÉ (TOTAL)" $3800, "PRECIO DE VENTA (TODO)" $3500, por carta $0/$0/$3500; sin lote el costo es la suma real ($1400 con 500+300×2+200+100). Los 3 modos, el gráfico y el cierre del modal OK; sin overflow.

## Inversiones — sin paréntesis en etiquetas; usar iconos ⓘ
Regla explícita del usuario (repetida varias veces): **prohibido** poner texto entre paréntesis en las etiquetas de la UI ("(lote)", "(todo)", "(total)", "(disponible)", "(ventas)", "(unitario)", "(mercado)", "(opcional)"). Se ve feo y largo. En su lugar:
- La etiqueta va limpia: `PRECIO DE VENTA TOTAL`, `GANANCIA YA REALIZADA`, `VALE HOY`, etc.
- Para explicar de dónde sale cada valor se usa `invInfoIcon(clave)` (icono azul `fa-circle-info`, `#2f80ed`; `#7db4ff` sobre el fondo oscuro de `.inv-calc-sheet`). Al pulsarlo abre un Swal con `INV_METRIC_HELP[clave]`.
- Iconos presentes en: reporte general (`.inv-calc-sheet`, 11), lista de cartas (`.inv-list-metrics`, 18), ledger (`#ledger-totals`, 8) y tarjetas de colección (`.inv-cat-metric`, 4).
- El porcentaje del margen va con `·` (punto medio), no entre paréntesis: `+$3500.00 · +0.0%`.
- Los únicos paréntesis aceptados son los del selector de tamaño de carpeta ("3x3 (9 Cartas)"), que es texto funcional del layout, no una métrica.

## Rendimiento móvil — Service Worker (crítico)
`docs/sw.js` no llegaba a **instalarse**: `URLS_TO_CACHE` incluía `./build.html`, que ya no existe, y `cache.addAll()` rechaza todo el install si **una** URL da 404 → el SW quedaba sin activar y **no se cacheaba nada**. Como el `.gltf` del asistente referencia un `.bin` de ~2.7 MB, se re-descargaba en cada navegación (lentísimo en móvil).
- Install tolerante: se cachea cada URL por separado (`cache.add(url).catch(...)`) en vez de `addAll`.
- `isModelAsset` incluye `bin|ktx2|basis|drc` además de `glb|gltf`, para cache-first de los buffers/texturas del modelo (antes caían al branch network-first de Supabase).
- Al cambiar assets, subir `STATIC_CACHE` (ahora `viking-static-v234`).

## Inversiones — conservar la hoja del binder y reordenar cartas en los 3 modos
- **Hoja del binder al cerrar/guardar el popup:** `renderInvestmentCards` re-construye el álbum entero, y turn.js arranca en la portada (page 1). Por eso, al guardar/editar/cerrar se volvía a la portada. Arreglo: `captureAlbumPage()` lee `$album.turn('page')` **antes** de vaciar el contenedor (`renderInvestmentCards` la llama solo en modo `album`), y `renderAlbumMode` la restaura al final del `setTimeout` con `$album.turn('page', invAlbumPage)` (acotada a `turn('pages')`). `openInvestmentCategory` resetea `invAlbumPage = 1` para que abrir un vault empiece en la portada.
  - OJO al medir en Playwright: en `display:'double'`, `turn('page')` devuelve la **primera** página del spread (p. ej. pedir 3 deja `page=2`, `view=[2,3]`). Comparar `turn('view')`, no `turn('page')`.
- **Reordenar en binder, lista y slide:** el orden es **uno solo** y compartido: el array `localInvestmentCards` + la columna `investment_cards.position` (`persistInvestmentPositions`). Cada modo lo pinta en ese orden, así que acomodar en un modo se refleja en los otros; no hay que hacer 3 ordenamientos.
  - **Solo drag & drop** (el usuario pidió quitar las flechas). `bindInvDragSource($el, idx)` marca el elemento `draggable` (escritorio HTML5) y `bindInvTouchDrag` añade long-press táctil (móvil). `invResolveDrop(x,y,$source,sourceIdx,startX)` devuelve el índice destino y `invApplyMove(fromIdx,toIdx)` hace `splice` + re-render + `persistInvestmentPositions()`.
  - En binder/lista el destino se resuelve por `elementFromPoint` (con fallback al card más cercano, `invNearestFlatTarget`, si se suelta fuera). En **slide** las cartas están apiladas (`effect:'cards'`), así que el destino se calcula por **desplazamiento horizontal**: `steps = round((x - startX) / (w * 0.55))`, `idx = clamp(sourceIdx + steps)`.
  - **Ghost táctil:** `.inv-drag-ghost` clona la carta. El clon incluye `.zoom-btn`, que trae `pointer-events:auto !important`; por eso el ghost lleva `.inv-drag-ghost, .inv-drag-ghost * { pointer-events:none !important; }` — sin esto el fantasma interceptaba el `elementFromPoint` y nunca se encontraba el destino.
  - **No romper la navegación:** el drag táctil solo se activa tras `INV_LONGPRESS_MS` (350ms) sin moverse >10px; un swipe rápido sigue cambiando de slide. En escritorio, como las cartas son `draggable`, la navegación del Swiper se hace con rueda (`mousewheel`) y teclado (`keyboard`), no con arrastre de ratón.
  - `invSuspendNav(true/false)` desactiva turn.js (`$album.turn('disable')`) y Swiper (`invSwiperInstance.mousewheel/keyboard`) mientras se arrastra.
  - `invDragJustEnded` (timestamp) evita que el click posterior al drop abra el modal.

## Inversiones — binder: solo giraba la portada (zona muerta de la esquina)
- Síntoma: en el binder solo se podía pasar la **primera** hoja; las interiores parecían pegadas (en móvil, directamente ninguna).
- Causa A (escritorio + móvil): turn.js detecta la esquina con `_cornerActivated` usando `jQuery('.page').width()/height()` = **content box**, pero compara contra el rectángulo completo del wrapper (300×420). La regla global `.page` (style.css) trae `padding:12px` + `border:1px` con `box-sizing:border-box`, así que el content box medía **274×394** y las franjas de 26px de la derecha y el abajo quedaban fuera de rango. La portada (`.cover-page`) no tiene padding, por eso solo ella giraba. Arreglo en `inversiones.css`: `#investment-card-container .investment-album .album-page { padding:0; border:none; }` y se mueve ese padding/border al `.grid-container` interno (mismo resultado visual, content box = 300×420). No tocar el `.page` global: lo usan otras vistas.
- Causa B (solo móvil): el `.zoom-btn` (abajo-derecha, 30px) hacía `stopPropagation` en `touchstart`, matando la esquina delantera de turn.js en cada hoja con cartas. Con la causa A arreglada quedan usables 6/8 esquinas en móvil (esquinas `br`, `bl`, `tr`), suficiente para avanzar y retroceder.
- Verificación Playwright: escritorio 16/16 esquinas giran (antes 4/16); móvil 6/8 (antes 0/8). En `display:'double'`, comparar `turn('view')`.
- Regresión visual: un A/B del CSS en la misma sesión da **0 píxeles** de diferencia y las posiciones de los slots son idénticas. Ya no hay botones de reordenar (se quitó el `.inv-reorder-btn` y su CSS); el reordenamiento es solo drag & drop, verificado 9/9 en escritorio y 9/9 en móvil (Playwright, eventos sintéticos para el táctil).

## Vista PÚBLICA de inversiones (`public.html`, `data-view="investments"`)
Solo se toca la vista pública; la app privada (`inversiones.html` + `js/inversiones.js`) queda intacta.
- **CSS propio y acotado:** `docs/css/public-inversiones.css` (se carga SOLO en `public.html`). Todo va prefijado con `#investments-view` o `.pub-inv-modal`, así que no afecta a `inversiones.html`. **No** se carga `inversiones.css` aquí (era la causa del aspecto pobre: la vista usaba solo estilos inline con texto `#000` sobre fondos oscuros → sin contraste).
- **Acento legible por tema:** `--pub-inv-accent` (= `--primary-color`, pero `#6c5ce7` en `theme-light` y `#ffe08a` en `theme-purple`) porque el `--primary-color` claro (lavanda `#a29bfe`) no contrasta sobre el fondo crema. Se usa para textos de acento (precio, set), no para fondos de botón.
- **Un solo popup por carta:** los modos slide/list antes ponían la clase `.card-slot` en el elemento clicable, y eso disparaba el handler global `$(document).on('click','.card-slot', ...)` → `openCardModal` (`#image-overlay`, con cantidad+carrito) **además** del modal público (con precio). Arreglo: los elementos públicos ya **no** llevan `.card-slot` (ahora `.pub-inv-slot`, `.pub-inv-slide`, `.pub-inv-list-item`) y su click hace `stopPropagation()`+`preventDefault()`. El modal único (`#public-inv-card-modal`, clases `.pub-inv-*`) tiene imagen + galería + título + **Precio** + Rareza + Cantidad + selector de cantidad + "Agregar al carrito" + descripción. Se abre con `openPublicInvestmentCardModal(card)` (deja la carta en `window.currentPublicInvCard`).
- **Etiquetas limpias:** "Precio" (antes "Precio al público" / "Precio al Público") en el modal y en modo lista. Estado no disponible = "AGOTADO".
- **Galería tipo Amazon:** si `card.extra_images` tiene URLs, `#public-inv-modal-extra-images` se puebla con miniaturas (`.pub-inv-thumb`, botones) que cambian la imagen principal; la 1ª es la principal y va `.active`. Sin extras, el contenedor se oculta.
- **Scrollbar al girar el binder:** el contenedor `#public-investment-cards.investment-album-layout` lleva `overflow:hidden` + `overscroll-behavior:contain` y alto fijo (600px; móvil `min-height:340px`). turn.js desplaza las hojas fuera del wrapper y sin esto crecía el documento y aparecía la barra de scroll.
- **Esquina de turn.js:** mismo bug que en la app privada (la regla global `.page` mete `padding:12px`+`border` y el content box queda 274×394). Arreglo equivalente acotado a la vista: `.public-inv-album .album-page { padding:0; border:none; }` y el padding pasa al `.grid-container` interno.
- **Carrito:** `#btn-public-inv-add-cart` usa `Cart.add(card, qty)` con `quantity`/`max_quantity` = stock real de la carta, para respetar el tope.
- **Service Worker:** `public-inversiones.css` está en `URLS_TO_CACHE`; subir `STATIC_CACHE` al tocar assets (ahora `viking-static-v235`).
- Verificado con Playwright (escritorio + móvil, temas claro/oscuro/morado): un único overlay activo por click, galería de 4 miniaturas con cambio de imagen, carrito con cantidad correcta, sin overflow horizontal, `album-page` con content box 300×420 y sin recorte.
- **Sello "AGOTADO" proporcional por contexto:** el tamaño del sello se define con `font-size` en el contenedor (el sello mide en `em`). Contenedores: `.pub-inv-slot` 4.5px (≈40% del ancho del slot), `.pub-inv-list-img` 3px (≈38%), `.pub-inv-slide-media` 20px (≈60% del ancho) y `.pub-inv-modal-img-wrap` 23px (≈59%; 11px en móvil). En los contextos pequeños se reduce además el padding/borde (regla `.pub-inv-slot .inv-stamp-unavailable, .pub-inv-list-img .inv-stamp-unavailable`). OJO: al añadir un `font-size` del sello en un `@media`, repetir la especificidad completa (p. ej. `.pub-inv-modal .pub-inv-modal-img-wrap`), si no la base gana y no se aplica.
- **Modo slide sin recorte:** el efecto `cards` de Swiper deja el `.swiper-slide` con `overflow:hidden` y su alto sigue al contenedor; por eso `.pub-inv-swiper` necesita `min-height` ≥ media+pie (ahora `585px`, ancho `max-width:260px`). Con menos, la parte de abajo de la carta se corta (móvil con más aún porque el texto ocupa más).

## Vista PÚBLICA de inversiones — lupa por carta (móvil) y álbumes 4x3
- En móvil, turn.js se queda con el toque del **cuerpo** de la carta (gira la hoja); el popup de la carta solo se abre con la **lupa** (`button.zoom-btn.pub-inv-slot-zoom`) que se inyecta por carta en `renderPublicInvAlbumMode` (app.js). El handler del slot (`$slot.on('click', ...)`) sale temprano si `innerWidth <= 768`, igual que en el binder privado. En escritorio no cambia nada (click en la carta abre el popup, la lupa va `display:none`).
- La lupa funciona porque `stopInterference` (app.js ~345) corta `touchstart/mousedown/pointerdown` en fase de captura para `protectedElements`, que incluye `.zoom-btn`; además el handler de la lupa hace `stopPropagation`/`stopImmediatePropagation` en `click` y `mousedown touchstart pointerdown`.
- **OJO (touch adjustment de Chromium):** en Chromium móvil un tap a <~15px del borde de la lupa engancha al botón más cercano (`touchscreen.tap` en el centro de la carta puede aterrizar en la lupa si están cerca). No es un bug real en dispositivo, pero al medir con Playwright hay que tocar lejos de la lupa para comprobar el flip.
- **Precio arriba:** en móvil `.pub-inv-slot-price` pasa a `top:0; left:0; right:0; width:100%` (banda superior a ancho completo) para dejar libre la esquina inferior derecha de la lupa. Fuente `clamp(4.5px, 1.5vw, 9px)` + `overflow:hidden` para que no desborde ni en 320px. En PC sigue abajo-izquierda como siempre.
- **Álbum 4x3 en móvil (solo este layout):** `renderPublicInvAlbumMode` añade la clase `inv-album-<grid>` al contenedor y, solo si `innerWidth <= 768 && gridLayout === '4x3'`, dimensiona el álbum con el ancho del contenedor (`containerWidth - 2`, mín. 240) en vez de `getAlbumSize`. En CSS: `#public-investment-cards.inv-album-4x3` con `padding: 10px 2px` y `gap: 3px; padding: 2px` en su `.grid-container.grid-layout-4x3`. En 390px la carta 4x3 pasa de ~32px a ~39px de ancho; en PC y en 3x3 nada cambia.
- Al tocar assets: subir `STATIC_CACHE` (ahora `viking-static-v238`) y el `?v=` de `public-inversiones.css` en `public.html`.

## Vista PÚBLICA de Binders (`public.html`, `?view=binders`) — clonada de Inversiones
Objetivo del usuario: que el link público de binders quede **igualito** al de inversiones (menú de colecciones → abrir → flip), sin tocar la vista pública de inversiones.
- **CSS propio y acotado:** `docs/css/public-binders.css` (cargado SOLO en `public.html`), todo prefijado con `#binders-view`/`.pub-binder-*`. No se carga `inversiones.css` ni `public-inversiones.css` aquí.
- **JS propio:** `docs/js/public-binders.js` (IIFE, cargado tras `app.js`). Expone `window.loadPublicBinderCategories`, `showPublicBinderCategories`, `openPublicBinder`, `shareCurrentPublicBinder`, `publicBindersNeedsClassicRender`. Todo lo demás (turn.js, `getAlbumSize`, `openCardModal`, `applyFoilToElement`) se reutiliza desde app.js.
- **Markup en `public.html`:** `#binders-view` = `#public-binder-header` (Volver + título + compartir) + `#public-binder-tabs` (`.sticky-tabs-container` con `tab-pill`: binder/vikingSlide/lista) + `#public-binder-categories` (menú) + `#binders-container` (render). Mismo patrón que `#investments-view`.
- **`switchView('binders')` (app.js):** delega en `loadPublicBinderCategories` (menú) salvo en modo clásico (`embed`/`limit`/`max`/`albumId`), que conserva `loadPublicBinders` + `renderBinder`. **El loader 3D ya NO se usa en `binders`** (solo en `albums`), porque ahora primero se ve el menú.
- **Flip idéntico a inversiones:** el álbum se arma con portada + páginas reales (`binder_pages`/`binder_card_slots` respetando `slot_index`) + contraportada, y `turn({display:'double', noCenter:true, gradients:false})`. El bug de la esquina (la regla global `.page` mete `padding:12px`+`border` y el content box queda 274×394) se arregla igual: `.public-binder-album .album-page { padding:0; border:none; }` y el padding/borde pasan al `.grid-container` interno. Sin eso solo giraba la portada.
- **Portada del binder:** se conserva la del binder (imagen propia `cover_image_url` o portada cósmica `style-cosmic` con `cover_color`), NO la azul/cósmica fija de inversiones.
- **Lupa por carta (móvil):** igual que inversiones. La lupa es `button.zoom-btn.pub-binder-slot-zoom`; al ser `.zoom-btn`, `stopInterference` (app.js ~345) frena el toque en captura y el popup no gira la hoja. El handler del slot sale temprano si `innerWidth <= 768`; en escritorio el click en la carta abre `openCardModal`. `openBinderCardModal(card)` reutiliza un `.card-slot` fantasma con los `data-*` que espera `openCardModal`.
- **Un solo popup:** el slot del álbum SÍ lleva `.card-slot` (para que el handler global de app.js funcione en escritorio), pero su click hace `stopPropagation`+`preventDefault`; en slide/lista los elementos (`.pub-binder-slide`, `.pub-binder-list-item`) NO llevan `.card-slot`.
- **Compartir:** `openShareModal(title, 'binders', id)` — se añadió el mapeo `binders → binderId` en app.js (antes caía en el `else` y generaba `&eventId=`). Ahora el link compartido abre el binder directo (`?view=binders&binderId=...`), y `loadPublicBinderCategories` detecta `binderId` y abre ese binder.
- **Service Worker:** `public-binders.css` y `public-binders.js` están en `URLS_TO_CACHE`; subir `STATIC_CACHE` al tocar assets (ahora `viking-static-v238`).
- **Pruebas Playwright (chromium headless):** el harness debe stubbear WebGL (`HTMLCanvasElement.prototype.getContext` devuelve `null` para `webgl`) o el navegador se cae por el modelo 3D. En móvil los eventos táctiles sintéticos NO llegan a turn.js (limitación del harness: ni `TouchEvent` ni `Input.dispatchTouchEvent` de CDP disparan el flip); validar el flip con **mouse real** en escritorio (arrastrar desde la esquina a lo ancho de la hoja, no un tirón corto) y en móvil comprobar geometría/lupa/modal. Resultado: menú 3 vaults, abrir/flip OK, 3 modos OK, modal único, sin overflow, sin errores reales.

## Duelo móvil (`docs/duelmobile.html`) — arrastre libre de cartas
Síntoma: en móvil las cartas no se podían soltar en cualquier parte; había una "restricción" entre el tablero y la zona de la mano (se subían solas a la mano).
- **Causa raíz (clamp):** el manejador `mousemove.mobileDrag` inline en `duelmobile.html` (~línea 1266) acotaba `cardObj.x/y` al tablero interno: `boundedX = Math.max(-10, Math.min(1120-70, x))`, `boundedY = Math.max(-10, Math.min(600-100, y))`. Ese clamp existe en el HTML (no en `duel.js`, que sí es libre). Se quitó → `cardObj.x = x; cardObj.y = y;`.
- **OJO: hay DOS manejadores activos.** `duelmobile.html` re-enlaza `mousemove/touchmove.mobileDrag` (movimiento) y `duelmobile.js` (`window.renderAllCards` override ~7503) re-enlaza `mouseup/touchend.mobileDrag` (soltado). Ambos se apilan en cada `renderAllCards`; tocar el movimiento en el HTML y el drop en el JS.
- **Causa del "se sube a la mano":** el layout móvil flota las manos ENCIMA del tablero (`.hand-tray` `position:absolute; z-index:2000`). La detección vieja `checkHandTrayHover` (rect de la bandeja + buffer 30px) marcaba casi todo el tablero como "mano" y subía las cartas.
- **Arreglo del drop:** `resolveHandDropTarget(endPos, overBoardZone)` en `duelmobile.js` (~1698) devuelve 1/2 solo si el puntero se suelta **más allá del borde del playmat** (abajo→P1, arriba→P2) o sobre el **área envolvente de las cartas de la mano**; si hay una zona del tablero bajo el puntero (`overBoardZone`), la zona GANA (la carta se queda en el tablero). El drop usa `if (handTarget) {...} else if (hoverZone) {...} else { field_free }` (se eliminó la rama `isOverP1Hand/isOverP2Hand`).
- Reglas resultantes: soltar en zona del tablero → se queda en la zona; soltar en tablero vacío → `field_free` donde se soltó; soltar abajo/arriba del tablero o sobre la mano → se acomoda en la mano. Funciona igual con tablero rotado (`window.isBoardRotated`).
- **Service Worker:** subir `STATIC_CACHE` al tocar assets (ahora `viking-static-v239`).
- **Pruebas Playwright:** viewport 390×844, `isMobile/hasTouch`, stub de WebGL (`getContext` → `null` para `webgl`), arrastre con CDP `Input.dispatchTouchEvent` (30 pasos). Nota: un movimiento <15px se interpreta como tap, no drag. Hay un `TypeError ... reading 'xr'` en consola que es PREEXISTENTE (aparece igual sin tocar nada; viene del modelo 3D).

## Inversiones en `binders.html` — filtro por binder, scroll interno y columnas calculadas
Vista `#view-inversiones` (pestaña "Inversiones" de `binders.html`). Todo el cálculo vive en `docs/js/binders.js`.
- **Helpers únicos de cálculo** (no duplicar fórmulas): `slotQty(slot)`, `slotMetrics(slot)` → `{qty, costUnit, saleUnit, costTotal, saleTotal, profit}` con `costTotal = cost_price*qty`, `saleTotal = price*qty`, `profit = (price − cost_price)*qty`. `invMoney(v)` formatea negativos como `-$x.xx`; `invEsc(v)` escapa HTML (los títulos de binder/carta ya no se inyectan crudos).
- **Filtro por binder:** `#inv-binder-filter` (select "Todos los binders") + click en la tarjeta `.inv-binder-card` del resumen (toggle; la tarjeta activa lleva `.inv-binder-active`). Estado en `invBinderFilter` (id del binder). `getFilteredInvSlots()` combina el filtro de binder con el buscador `#inv-table-search`; `applyInvFilters()` re-renderiza tabla, totales y resalta la tarjeta. El click sobre la tabla de hojas (`.inv-pages-scroll`) también filtra (no hay exclusión).
- **Scroll interno sin barra visible:** `.inv-table-scroll` (contenedor de la tabla general) y `.inv-pages-scroll` (tabla de hojas dentro de cada tarjeta) usan `max-height` fijo + `overflow-y:auto` + `scrollbar-width:none` + `::-webkit-scrollbar{display:none}`. La tabla general ya no crece con N hojas. El `thead` es `position:sticky; top:0`.
- **OJO — `tfoot` sticky NO funciona en Chromium** dentro de estos contenedores (probado aislado: el `tfoot` sticky sí, pero el `td` sticky no se pega al fondo del scroller). Por eso los totales NO van en `<tfoot>`: van en la barra `#inv-table-totals` (`.inv-totals-bar`), fuera del área con scroll, siempre visible.
- **Columnas calculadas en la tabla general:** además de Costo Unitario / Precio Venta / Stock, hay `Costo Total`, `Venta Total` y `Ganancia` por fila (clases `.inv-cell-cost-total`, `.inv-cell-sale-total`, `.inv-cell-profit`). Al editar costo/precio/stock se llama `refreshInvRowTotals(slotId)` → recalcula la fila y `refreshInvTotalsFooter()` recalcula la barra de totales en vivo (usa `pendingInvChanges` superpuesto sobre `allUserBinderSlots`).
- **Barra de totales** (`renderInvTotalsFooter`): solo se muestra **con un binder filtrado** (alcance "Totales • <binder>", nº de cartas, INVERSIÓN TOTAL / VENTA TOTAL / GANANCIA). Sin filtro se oculta porque la tarjeta "Gran Total de Todos los Binders Creados" de arriba ya muestra esos mismos números — no duplicar. Ganancia negativa en rojo.
- **Tarjeta de binder** (`renderInversionesSummary`): el pie pasó de "Total Binder + costo/venta" a `.inv-binder-totals` con 3 métricas en el mismo espacio: **VALOR TOTAL** (venta), **INVERSIÓN** (costo) y **GANANCIA**. Es `flex-wrap` con `font-size: clamp()` para que quepa en la tarjeta sin desbordar (medido 320–1400px, `scrollWidth === clientWidth`). El gran total de todos los binders ahora también muestra Ganancia Total.
- **Grid del resumen:** `repeat(auto-fit, minmax(min(320px, 100%), 1fr))` para que no desborde en móvil (antes `minmax(320px, 1fr)` forzaba 320px en viewports de 320–340px).
- **Estado para recargar el resumen:** `allUserBinders` y `allUserBinderPages` se guardan en carga; tras guardar cambios se llama `renderInversionesSummary(...)` + `applyInvFilters()` para refrescar tarjetas y tabla.
- **Service Worker:** `STATIC_CACHE` subido a `viking-static-v241`.
- **Pruebas Playwright** (chromium del sistema: `chromium.launch({executablePath:'/usr/bin/chromium'})`; el navegador de Playwright no está instalado): mockear sesión en `localStorage['sb-ehszvqwftqgxjggnbcmt-auth-token']`, stub de WebGL (`getContext` → `null` para `webgl`) y `page.route('**/rest/v1/**')` con `usuarios`/`binders`/`binder_pages`/`binder_card_slots`. Verificado: filtro por select y por click de tarjeta, buscador combinado, totales en vivo al editar, sin overflow horizontal en 320/390/820/1400px.

## Modo "Contra la Máquina" — ELIMINADO
Se eliminó por completo: `docs/duelAI.html`, `docs/duelAIMobile.html`, `docs/js/duel-ai-board.js`, `docs/js/duel-ai-cards.js`, `docs/js/duel-ai-engine.js`, `docs/js/duel-ai-ui.js`, `docs/css/duel-ai.css` y la tarjeta `.vs-machine` de `configDuel.html` y `configDuelMobile.html`.

Quedan solo los modos **1 Jugador** y **2 Jugadores**. No reintroducir este modo sin pedirlo explícitamente.

## Duelo de escritorio (`docs/duel.html`) — el tinte del GLTF se quedaba pegado
Síntoma: al sumar o restar LP, el `model-viewer` del espíritu se quedaba verde (o rojo) para siempre.
- **Causa:** `triggerSpiritReaction` compartía un solo timer (`activeBubbleTimers`) para el burbuja de texto y para quitar la clase de tinte (`.spirit-viewer-heal` / `.spirit-viewer-damage`). Cualquier `showSpiritThought` (invocar, atacar, activar efecto…) limpiaba ese timer y programaba otro que **solo** ocultaba el burbuja, así que la clase de tinte nunca se removía.
- **Arreglo:** `activeTintTimers` + `clearSpiritTint(playerIdx)` (scope de módulo, junto a `activeBubbleTimers`). `triggerSpiritReaction` limpia el tinte previo, aplica el nuevo y programa su propio `setTimeout` de 2500 ms; el timer del burbuja ya solo hace `fadeOut`.
- El tinte y el burbuja van por separado a propósito: un pensamiento no debe cortar la animación de LP, pero tampoco puede dejarla pegada.
- `duelmobile.html` no tiene espíritus 3D, así que ahí no aplica.
- Verificado con Playwright (practice y multiplayer, P1 y P2): heal/damage/÷2, reacciones remotas del rival, heals seguidos y heal+pensamiento solapados → clase vacía y `filter: none` a los ~3 s.

## Duelo — cartas acopladas enviadas al Cementerio/Removido caían al fondo de la pila
Síntoma: enviar cartas acopladas al cementerio/removido (botones masivos "Todas a Cementerio" / "Todas a Removido" del modal de acopladas, o el flujo de campo→pila) las metía **debajo** de todo, mientras que las enviadas a mano sí quedaban arriba.
- **Causa:** `moveAllAttachedTo()` (bulk) y `detachAllChildren()` (usada por devolver a mano/deck, cambio de control, etc.) movían las cartas al `grave_*`/`banished_*` **sin** asignar `movedToPileAt`. La pila se ordena por `movedToPileAt` descendente (`openPileModal` y el render del tope), así que `undefined || 0` las dejaba siempre al final.
- **Arreglo** (idéntico en `docs/js/duel.js` y `docs/js/duelmobile.js`): ordenar las acopladas por `attachedAt` ascendente y asignar `movedToPileAt = baseTime + index` para grave/banish, de modo que la última acoplada quede arriba y todas por encima de lo que ya estaba en la pila. `sendAttachedCardsToPile()` (padre al campo→pila) ya lo hacía bien y no se tocó.
- **No cambia nada más:** `deck` sigue borrando `movedToPileAt` (va boca abajo), `hand` no lo toca, y el orden de `state.cards` no se altera (el `sort` es sobre el array filtrado).
- Verificado con Playwright en `duel.html` y `duelmobile.html`, P1 y P2: bulk a cementerio, bulk a removido, acción individual de una acoplada y flujo campo→cementerio; la carta pintada en la zona coincide con el tope real.

## Consumo de cuota Supabase — "Cached Egress" (modelos 3D)
Síntoma: el panel de Supabase marcaba **Cached Egress 6.1 / 5 GB (122 %)** mientras que `Egress` (base de datos) solo iba al 9 %. El "Cached Egress" es el CDN de **Storage**, no la BD.
- **Causa 1:** cada asistente pesa ~2.7 MB (`models/<ts>_<rand>/<Nombre>.bin`) + texturas JPG (~0.3–1 MB) y se servían con `cache-control: public, max-age=3600`: a la hora, cada visitante los volvía a descargar. Ver la sección *Cached Egress — causa real y arreglo* al final: la cabecera ahora es de 1 año.
- **Causa 2:** el Service Worker solo se registraba en 15 de 45 vistas, así que en el resto el modelo se bajaba completo en cada navegación. Ahora se registra desde `js/supabase-config.js` (lo cargan 37 vistas).
- **Causa 3:** las rejillas de asistentes montaban un `<model-viewer>` por asistente (`admin.js` → `#spirits-grid`, `app.js` → `loadPublicSpirits`, `play.html`, `duel.html`). Con 41 asistentes eso son ~150 MB por visita. Ahora pintan el póster (`poster_url`, en Cloudinary) y el modelo se monta solo al abrirlo: en admin con `.btn-preview-spirit-3d` → `#gltf-overlay`; en público el click de `.spirit-card` ya abría ese overlay y lee `data-poster`.
- `sw.js`: el cache-first ya no depende de la extensión; cualquier ruta con `/storage/v1/object/public/spirits/` se guarda en `IMAGE_CACHE` (por eso `STATIC_CACHE` v253 no la borra al subir de versión).
- `docs/J_storage_cache_control.sql` (opcional) solo actualiza el espejo de la BD; **no** cambia la cabecera servida (se cambia con la copia en servidor descrita al final del archivo).
- **No** volver a montar un `model-viewer` por elemento de una lista: con `loading="lazy"` igual descarga varios modelos al hacer scroll.
- Notificaciones (`js/notifications.js`): sondeo cada 60 s (antes 15 s), se detiene con `document.hidden` y se refresca en `visibilitychange`/`focus`; los `select` piden solo las columnas usadas.

## Asistente 3D (GLTF) — solo `admin.html` y `public.html`
- El asistente de la esquina (`js/michatbot.js` + `js/michatbot-mobile3d.js`) se carga **solo** en `admin.html` (dueño) y `public.html` (link público de la tienda). Se quitó de las otras 23 vistas para no descargar el modelo de ~2.7 MB en cada visita.
- En las demás vistas no llamar `initMichatbot` sin guardia: `if (typeof initMichatbot === 'function') initMichatbot(true);` (`admin.js`, `app.js`, `binders.js`, `claim.js`, `adminClaim.js`). `window.botInstance` sigue siendo opcional y todos sus usos ya están guardados.
- `admin.html`: la rejilla de selección pinta pósters; el 3D solo se abre en `#expanded-gltf-viewer` (overlay compartido) al pulsar `.btn-preview-spirit-3d`. Verificado con Playwright: 41 tarjetas = 41 pósters, **0** `model-viewer` dentro de `#spirits-grid`.
- `public.html`: misma rejilla de pósters (`poster_url || texture_url`); el click abre el overlay compartido. El visor de la esquina usa el espíritu seleccionado de la tienda.
- `packages.html`: la cola de BDD ya no monta un `model-viewer` por archivo 3D (icono `fa-cube` + "3D"); el preview de subida sigue siendo un único visor.
- `sw.js` (`STATIC_CACHE` v256): cache-first para `/storage/v1/object/public/spirits/` (`.gltf`, `.bin`, texturas), `model-viewer.min.js` de `ajax.googleapis.com` y `cache.put()` tolerante. Verificado: tras `serviceWorker.ready` + recarga, `viking-images-v1` contiene el `.gltf`, el `.bin` y las texturas.

## Asistente Gemini (`spirit-chat`) — conversación natural
- Regla del usuario: NO anunciar capacidades ni usar "¿En qué puedo ayudarte?" como muletilla. Un saludo se responde con un saludo; una pregunta se responde; una acción solo se menciona si el usuario la pide.
- **Sin respuestas fijas**: se eliminó `isSimpleGreeting()` y el saludo predefinido. Gemini formula siempre la respuesta (solo queda `'¡Hola!'` como fallback si llega un prompt vacío).
- `systemInstruction` prohíbe enumerar capacidades y pide respuestas breves y naturales.
- `sanitizeAIResponse()` sigue limpiando coletillas tipo "¿En qué puedo ayudarte?".
- **Contexto bajo demanda**: `shouldAttachStoreContext(text)` en `michatbot.js` decide si el mensaje es del negocio. Si no lo es (clima, matemáticas, charla), NO se consulta la BD y se envía `context_mode: 'general'`; Gemini responde con sus conocimientos. Si es del negocio, se construye el contexto y se envía `context_mode: 'store'`.
- **Caché**: `storeContextCache` (TTL 2 min) evita repetir las consultas en mensajes seguidos. `window.invalidateStoreContext()` lo limpia (se llama al añadir carta/producto/preventa).
- **Qué incluye `db_context`**:
  - Perfil/tienda e información adicional.
  - Preventas, productos sellados, ventas y tracking.
  - Binders + `binder_card_slots`.
  - **Carpetas/álbumes**: `albums` + `pages` + `card_slots`.
  - **Inversiones**: `investment_categories` + `investment_cards` (costo, mercado, venta, vendida, disponible).
  - Subastas, eventos, decks/mazos, wishlist, accesorios y (solo admin) clientes.
- **Admin vs público**: en `public.html` (o `?store=`) `is_admin` es siempre `false`; se filtran binders/álbumes/categorías privadas, cartas no públicas, agotadas y vendidas, y NUNCA se envían costos/ganancias. En admin se incluye todo.
- **Lectura solamente**: el bot no escribe en Supabase. Si piden modificar algo, guía; no confirma cambios falsos. Acciones reales requerirían tool-calling validado.

## Cached Egress de Supabase — causa real y arreglo (cabecera de 1 año)
Medido con `curl` sobre objetos de `spirits`:
- `GET /storage/v1/object/public/spirits/...` devolvía **`cache-control: public, max-age=3600`**. Con 1 hora, cada visitante que vuelve después de 1 h descarga otra vez el modelo completo (1.2–12 MB), y Supabase lo cuenta como **Cached Egress** (su doc lo define como el egress servido por su CDN con cache hits). Por eso el contador subía aunque hubiera Service Worker: el SW solo cubre a quien ya lo tiene instalado y cuya petición pasa por él.
- El `metadata->>'cacheControl'` de `storage.objects` **no** es la fuente de la cabecera servida: manda el `CacheControl` del objeto en S3. Ese espejo puede decir `public, max-age=31536000, immutable` y aun así servirse `3600` (pasaba en casi todos los modelos).
- **El valor de `cacheControl` se manda tal cual a la cabecera.** Pasar `cacheControl: '31536000'` produce `cache-control: public, 31536000` (inválido, sin `max-age=`) y el CDN acaba sirviendo 3600. Hay que pasar el valor completo: **`public, max-age=31536000, immutable`**.
- Arreglo aplicado (2026-11): los 228 objetos de `spirits` se marcaron con `public, max-age=31536000, immutable`. Se hace con **copia en el servidor**, sin descargar ni re-subir bytes:
  `POST /storage/v1/object/copy` con `{bucketId, sourceKey, destinationKey: sourceKey, metadata:{cacheControl:'public, max-age=31536000, immutable'}, copyMetadata:false}` y `x-upsert: true`.
  Es un `S3 CopyObject` con `MetadataDirective: REPLACE`: conserva bytes, `size`, `eTag` (salvo objetos multipart, que pasan a MD5 simple) y `mimetype`. Verificado: 228/228 OK, 0 fallos, modelo sigue cargando en `model-viewer`.
  - OJO: `PUT /storage/v1/object/{bucket}/{path}` **no** sirve para esto: reemplaza el contenido por el body (con body vacío deja el objeto en 0 bytes).
- En el panel: botón **"Reparar caché de modelos"** (`#btn-fix-spirits-cache`, en Mis Asistentes) → recorre el bucket y hace la copia. Es idempotente y se puede repetir.
- Las subidas nuevas usan ya el valor completo (`cacheControl: 'public, max-age=31536000, immutable'`) en `admin.js`, `build.js` y `packages.html`.
- `J_storage_cache_control.sql` (metadata en la BD) **no** cambia la cabecera servida; se conserva solo como documentación.
- Cloudinary queda como opción secundaria (selector en el modal, `uploadModelFiles`, botón "Copiar modelos a Cloudinary"). El plan gratuito limita a **10 MiB por archivo raw** (`File size too large... Maximum is 10485760`) y ~25 GB/mes de banda. `.bin` se sube como `.glbin` porque Cloudinary rechaza esa extensión.
- `michatbot.js` revalida el asistente en segundo plano (`lookupSpiritFromDb` + `refreshCornerModelUrl`) para que un `localStorage` con URL vieja no siga pidiendo el host anterior.

## Modelos 3D pesados — compresión (GLB + Draco)
Los `.bin` de los asistentes no estaban "sin comprimir": ya venían con `KHR_draco_mesh_compression`, pero con **3.1 millones de triángulos** para un visor de 150–320 px. Ahí no hay margen de compresión: el único lever es **simplificar la malla**.
- Comando usado (fuera del repo, con `@gltf-transform/cli`):
  `gltf-transform optimize in.gltf out.glb --compress draco --simplify true --simplify-ratio 0.08 --simplify-error 0.001 --texture-compress false`
- Resultado: Eveningstar 12.98 MB → **1.97 MB**, alluber 8.99 → **1.46 MB**, ghostOgre 8.98 → **1.73 MB** (≈6–7×). Se suben como `.glb` (un solo archivo, un solo request) al mismo folder con `cache-control: public, max-age=31536000, immutable`.
- Calidad verificada: render a 320 px original vs comprimido es indistinguible (diferencias solo de antialiasing/encuadre). Carga OK en model-viewer (escritorio) y en three.js `GLTFLoader` + `DRACOLoader` (móvil, `michatbot-mobile3d.js` ya configura el decoder de gstatic).
- `docs/L_use_compressed_models.sql` apunta `spirits.gltf_url` de esos 3 registros al `.glb`. Los originales no se borran.
- OJO: `models/1787119012509_745` ("mago BETA", 12.19 MB) **no está referenciado** por ninguna fila de `spirits`: es un upload huérfano y no genera egress.
- `--simplify-error` >= 0.015 rompe el encoder con `[KHR_draco_mesh_compression] Unknown geometry type`; 0.001–0.01 funciona.


## Storage — subir a Supabase o a Cloudinary (repartir la carga)
- El modal de asistente tiene `#input-spirit-storage` con **Servidor principal** (`primary`, por defecto) y **Servidor alterno** (`alternate`). Es por modelo, así que se puede repartir la carga entre los dos hosts. Lo que se sube al alterno **no gasta el Cached Egress del principal**.
- REGLA DEL USUARIO: **nada de nombres de proveedor en la interfaz**. Ni "Supabase" ni "Cloudinary" en etiquetas, badges, Swal, placeholders ni logs de consola. En el código solo quedan los identificadores funcionales (`_supabase`, URLs `api.cloudinary.com`, `res.cloudinary.com` de imágenes por defecto, claves de localStorage).
- No hay botones de "reparar caché" ni de "copiar a Cloudinary": el usuario los pidió quitar. La cabecera ya quedó reparada en producción y los modelos nuevos se suben con la cabecera correcta desde el propio modal.
- NO poner badges ni etiquetas que revelen dónde está guardado el modelo (se quitó el badge de host a petición del usuario).
- Cloudinary: `.gltf` + `.bin` + texturas en una carpeta única, `.bin` → `.glbin` con reescritura de `buffers[].uri`, límite 10 MiB/archivo.


## Storage — RLS (cerrar escritura anónima)
- La clave anónima podía subir/sobreescribir/borrar en `spirits` sin sesión (probado con `POST`/`DELETE` desde fuera del navegador). `docs/K_storage_rls_spirits.sql` lo cierra:
  - helper `public.is_admin()` (`security definer`, `usuarios.role='admin'`);
  - borra las políticas de `storage.objects` que mencionan `spirits`/`accessories` y las de escritura totalmente abiertas a `anon`/`public`;
  - recrea: `spirits/*` solo admin (todo el bucket, incluye `models/`, `accessories_3d/`, `accessories_models/`, `logos/`), `spirits/build_models/<uid>/*` solo su dueño, `accessories/*` solo admin.
- La lectura pública (`/storage/v1/object/public/...`) no usa RLS, así que la web sigue igual.
- Los `PATCH` a la tabla `spirits` con la clave anónima ya estaban bloqueados; el panel los hace con el JWT del admin.

## RLS de propiedad: binders, ventas y notificaciones (migración `M_`)
`create_binders_tables.sql` creó las políticas `"Owners full …"` con `FOR ALL USING (true) WITH CHECK (true)` **sin `TO`**, así que aplicaban también a `anon`: cualquiera con la clave pública podía editar/borrar binders ajenos. Igual pasaba en `sealed_product_sales` (leía nombre/teléfono de compradores) y `user_notification_states`.
- `docs/M_fix_rls_ownership_and_email.sql` (idempotente) deja: lectura pública solo de binders `is_public <> false`, escritura solo del dueño (`auth.uid()`) o admin; `sealed_product_sales` conserva el INSERT público (checkout invitado por WhatsApp) pero SELECT/UPDATE/DELETE solo del vendedor; `user_notification_states` solo del dueño; `app_notifications` lectura pública y escritura admin.
- Helpers `SECURITY DEFINER` (`binder_is_owner`, `binder_page_is_owner`, `binder_page_is_visible`) para heredar la propiedad sin recursión de RLS.
- **Correo en `usuarios`**: `anon` ya no tiene `SELECT` de tabla; se conceden columnas una por una salvo `email` (PostgreSQL suma privilegios, un `REVOKE (email)` no basta). Para el login/recuperación por nombre de usuario existe `public.get_login_email(text)` (SECURITY DEFINER, un solo correo, solo con coincidencia exacta). Todas las vistas que resolvían el correo con `from('usuarios').select('email')` ahora usan esa RPC con fallback al pseudo-correo (`@tcgdual.com`, `@vikingtcg.xyz`, `@vikingtcg.com`). `js/admin.js` y `scanner.html` siguen leyendo `email` porque van con sesión (rol `authenticated` conserva la columna).
- Los pseudo-correos (`@tcgdual.com`, `@vikingtcg.xyz`, `@vikingtcg.com`) son credenciales de cuentas viejas: **nunca** cambiarlos al cambiar de dominio.

## Imágenes de Cloudinary optimizadas (`window.optImg`)
Antes se servían los originales: sticker PNG 1.09 MB, sleeves 0.5–1.8 MB (39 accesorios ≈ 22 MB por visita). Ahora `window.optimizeCloudinaryImage(url, w)` (en `js/utils.js`) inserta `f_auto,q_auto,w_<w>,c_limit` solo en URLs `/image/upload/` (no toca `/raw/` ni las ya transformadas) y `window.optImg` es el atajo. Medido: sticker 1065 → 21 KB, sleeve 1777 → 46 KB.
- Aplicado en: `js/custom.js` (picker y modal de stickers), `packages.html` (stickers y accesorios), `accesorios.html` (tienda), `js/admin.js` (accesorios y pósteres), `js/app.js` (productos, preventas, eventos, wishlist, pósteres y stickers superpuestos), `carrito.html`, `js/productoSellado.js`, `subastas.html`, `js/binders.js`, `js/eventos.js`, `js/deseos.js`, `js/admin_deseos.js`, `js/adminClaim.js`, `js/viking-widget.js`.
- En `js/viking-widget.js` se usa la forma guardada `(window.optImg?window.optImg(u,w):u)` porque corre en webs de terceros sin `utils.js`.
- Las tarjetas ya usaban `window.optimizeMediaUrl`; no mezclar ambos helpers.
- **Cobertura completa (revisión de compras):** se envolvieron los 39 `<img src="${...}">` restantes que quedaban crudos en `js/admin.js` (8), `js/app.js` (9), `js/inversiones.js` (4), `js/binders.js` (3), `js/public-binders.js` (3), `js/magic.js` (3), `js/inversiones_current.js` (3), `js/expansiones.js`, `js/deckbuilding.js`, `js/preventas.js`, `js/subastas_v2.js`, `js/landing.js`, `js/landing2.js`. Ancho 200 en miniaturas (estilos de 40–89 px) y 400 en el resto.
- `index.html` **no carga `utils.js`** (usa `landing2.js`): ahí la transformación va inline en el template del logo de tienda, sin `optImg`.
- Las subidas usan **preset unsigned** (`js/media-upload.js`: `cloudName de3n9pg8x`, `uploadPreset vikingdevBdd`): no hace falta API key ni secreto en el frontend.


## Notificaciones — `binder_sales` no existe
`js/notifications.js` consultaba `binder_sales` en cada refresco (404 cada 60 s). Ahora se intenta una vez y, si falla, se desactiva en la sesión (`binderSalesUnavailable`). La tabla nunca existió; si se crea, el bloque vuelve a funcionar solo.

## Login de `binders.html`
Resolvía el correo **solo** con `${usuario}@vikingtcg.xyz`, así que las cuentas con correo real o `@tcgdual.com` no podían entrar. Ahora usa `get_login_email` y cae al pseudo-correo histórico.

## Modelos 3D — compresión masiva de los 40 `.gltf` (173.6 MB → 43.3 MB)
Estado real medido en producción (no estimado): **43 filas** de `spirits` con `gltf_url`; 40 eran `.gltf` + `.bin` + texturas (173.6 MB) y 3 ya eran `.glb` (4.9 MB). Los `.bin` son el 85 % del peso y traen 3+ millones de triángulos para un visor de 150–320 px: no hay margen con compresión, hay que **simplificar la malla**.
- Comando: `npx gltf-transform optimize in.gltf out.glb --compress draco --simplify true --simplify-ratio 0.08 --simplify-error 0.001 --texture-compress false --texture-size 1024` (v4.5.1). `--texture-size 1024` baja las texturas de 2048 y es invisible a ese tamaño de visor.
- Resultado: 173.6 → 43.3 MB (−75 %), mayor archivo 2.40 MB, un solo archivo por modelo.
- Los `.glb` se subieron al servidor alterno (Cloudinary, raw, preset `vikingdevBdd`, `public_id: spirits/models/compressed_<ts>/<id>.glb`). Verificado: 40/40 HTTP 200 + `access-control-allow-origin: *` + `magic=glTF`. `docs/N_use_compressed_models_all.sql` repunta `spirits.gltf_url` (los originales NO se borran; la ruta vieja queda en un comentario para revertir).
- **8 modelos tenían una textura que nunca se subió** (`<nombre>1.jpg` → 404 con `content-type: application/json`): al comprimir se sustituyó por un PNG blanco 1x1. Ids 6, 9, 11, 12, 15, 16, 17, 26. OJO al parchear: hay que cambiar también `images[].mimeType` a `image/png` o gltf-transform falla con "Invalid JPG, marker table corrupted".
- OJO al descargar: los `.bin` con espacios en el nombre (`kurikara divincarnate.bin`) hay que pedirlos con la URL codificada; si no, `curl` falla en silencio y el modelo no compila.
- Draco queda en `extensionsRequired`: model-viewer lo soporta nativo y `michatbot-mobile3d.js` ya configura `DRACOLoader` (gstatic 1.5.7).
- `gltf-transform` 4.5.1 tarda ~7 s por modelo; los 40 en ~5 min.

## Compras — stock descontado y "Mis compras" (pantalla del comprador)
- **Bug real encontrado:** `create-checkout-session` pedía `quantity` a `viking_data`, pero esa columna **no existía**. PostgREST devolvía 42703, la función no encontraba la carta y respondía `"<carta>" ya no está disponible en la tienda.` → **ninguna carta suelta se podía pagar con tarjeta**. Arreglo doble: migración `docs/O_stock_cartas_y_mis_compras.sql` (añade `viking_data.quantity INTEGER DEFAULT 1` + backfill + índices de `checkout_orders`/`user_entitlements`) y el SELECT pasa a `select("*")` para que un proyecto sin la migración siga funcionando (sin stock = ilimitado).
- **Descuento de stock:** `decrementStockForItems(supabase, items)` en `stripe-webhook` y `verify-checkout-session` (copias sincronizadas). Cubre `sealed` (`stock`/`quantity`/`status='Agotado'`), `card` (`viking_data.quantity`) e `investment` (`investment_cards.quantity`; al llegar a 0 pone `is_available=false` para que la vista pública muestre AGOTADO, **sin** tocar `is_sold`, que es contabilidad del dueño). Es **best-effort**: un fallo se registra y se sigue, porque la venta ya está asentada (el pedido se reclama atómicamente con `status pending → paid`, así que no se descuenta dos veces).
- `create-checkout-session` ahora rechaza stock 0 con `"<artículo>" está agotado.` (antes, con stock 0, la validación `stock > 0 && qty > stock` dejaba pasar la compra).
- `app.js` → `#btn-add-to-cart`: si `currentCardData.quantity` es 0 avisa "Agotado" y no añade al carrito (antes `parseInt(0) || 1` lo convertía en 1).
- **Precio no manipulable:** el precio siempre sale de la BD en `create-checkout-session` (`spirits.price_mxn`, `accessories`, `product_packs`, `sealed_products`, `investment_cards.current_price`, `viking_data.price`, `package_configs`); el body del navegador solo aporta `id` y `quantity`. `verify-checkout-session` consulta la sesión real a Stripe y exige `client_reference_id === auth.uid()`.
- **"Mis compras" (`docs/mis-compras.html` + `js/mis-compras.js` + `css/mis-compras.css`):** dos pestañas. *Pedidos* lee `checkout_orders` (`status='paid'`) y pinta el **snapshot JSON** de `items`, así que la compra se ve aunque el vendedor borre el producto. *Compras y regalos* lee `user_entitlements` (accesorios, stickers, asistentes, packs; `source` = purchase/gift/pack). RLS ya limitaba ambas tablas a `auth.uid() = user_id` (verificado: anon devuelve `[]` en `checkout_orders`, `user_entitlements`, `pack_purchases`, `gift_claims`, `sealed_product_sales`).
- Enlace en el menú del avatar de las 20 vistas que lo tienen (`<a href="mis-compras.html">` tras el item Play), botón en `perfil.html` y botón "Ver mis compras" en el Swal de pago confirmado de `carrito.html`.
- OJO: la columna del logo es **`usuarios.store_logo`**, no `logo_url` (un SELECT con `logo_url` devuelve 400 y la página caería al fallback de caché).

## Cambio de dominio (diciembre) — checklist
`docs/CHECKLIST_CAMBIO_DOMINIO.md`. Resumen: 78 referencias en 30 archivos (58 son el favicon), `docs/CNAME`, 2 comparaciones de `hostname` en `js/viking-widget.js` (1576 y 2875), el snippet de `widgets.html`, el fallback de `create-checkout-session` y los paneles de Supabase Auth (Site URL + Redirect URLs). **No** tocar `${usuario}@vikingtcg.xyz` de `js/binders.js:641` (es identificador de login). Stripe y Cloudinary no requieren cambios; mantener el dominio viejo con 301 por los snippets de widget ya pegados.

## Asistente de la esquina — modelo viejo al volver atrás (bfcache) o con otra cuenta
Síntoma: tras cambiar de asistente, al volver con el botón atrás del navegador (o al entrar/salir del carrito) seguía apareciendo el modelo anterior hasta recargar.
- **Causa 1 (caché sin dueño):** `localStorage['viking_cached_spirit']` era global. Cualquier tienda/visitante podía pintar el asistente cacheado de otra sesión, y ese valor se usaba como primer pintado antes de la lectura real.
- **Causa 2 (lectura fallida = "no hay asistente"):** `lookupSpiritFromDb()` devolvía el primer espíritu público cuando la lectura de `usuarios`/`spirits` fallaba (red intermitente, token refrescándose). Eso sustituía el elegido por uno viejo.
- **Causa 3 (bfcache):** al volver con atrás no se re-ejecuta `DOMContentLoaded`; `pagehide`/`beforeunload` ya había liberado los visores 3D y nada los reconstruía ni revalidaba el asistente.
- **Arreglo (`js/michatbot.js`):**
  - `spiritCacheOwnerId()`: `user:<id>` en el panel, `store:<id>` en la tienda pública; si el dueño mira su propia tienda, comparte `user:<id>` para no perder el primer pintado.
  - `getCachedSpirit()`/`setCachedSpirit()` guardan/leen `viking_cached_spirit_owner` y rechazan la caché de otro dueño (la clave sin dueño se acepta como migración).
  - `discardStaleCachedSpirit()`: si el dueño ya se conoce y la caché no es suya, anula `currentSpirit` y vacía `#michatbot-model-container`. Se re-comprueba a los 3 s porque en público `currentStoreId` llega después del primer pintado.
  - `lookupSpiritFromDb()`: un `error` de Supabase ya NO cae al espíritu público; devuelve `null` y se conserva el cacheado.
  - `refreshCornerModelUrl(url)` cambia el `src` del visor ya montado (hasta 10 intentos/300 ms) sin reconstruirlo.
  - `revalidateSpiritFromDb({force, minInterval})` con deduplicación, reintentos 2/5/10/20 s, `visibilitychange` y `online`.
  - `pageshow(persisted)` → `initMichatbot(true)` (bfcache).
- `js/admin.js`: al seleccionar un asistente se actualizan `window.currentSpirit`, `tcg_session.selected_spirit_id` y la caché instantánea; `tcg_item_unlocked` sincroniza la sesión. `pageshow` refresca personalizaciones.
- `js/utils.js` y `js/notifications.js`: `pageshow` para reanudar sondeo/estado tras bfcache.
- `sw.js`: `/auth/v1/*` y `/rest/v1/usuarios` ya **no** se cachean en `DATA_CACHE` (servir un perfil/token viejo era otra vía para resucitar `selected_spirit_id`). `STATIC_CACHE` en `viking-static-v262`.

## Consumo de caché/egress (revisión)
- Modelos 3D en Storage: `GET` devuelve `cache-control: public, max-age=31536000, immutable` + `cf-cache-status: HIT` (verificado). OJO: un `HEAD` devuelve `private, no-cache`; los navegadores usan `GET`.
- Modelos en el servidor alterno: `max-age=2592000` (30 días) + `immutable` + `access-control-allow-origin: *`.
- Imágenes: todas las miniaturas pasan por `window.optImg`; solo quedan las 3 imágenes por defecto (`default_box/sleeves/coin.png`) con URL cruda.
- Lo que más consulta la BD es `js/notifications.js`: ~6 `select` cada 60 s por pestaña (se detiene con `document.hidden`). Es egress de BD (JSON pequeño), no "cached egress" de Storage.
- `ProactiveAssistant.trigger('page_load')` invoca la Edge Function `spirit-chat` en cada carga de admin/público (cooldown 12 s). Consume invocaciones/Gemini, no caché de Storage.
- **Pendiente detectado (2026-11):** el asistente id 57 ("Aluber the Jester of Despia") sigue como `.gltf` + `.glbin` de **8.68 MB** + 3 texturas (~0.3 MB) en el servidor alterno. Es el único que no pasó por la compresión; conviene recompilarlo con el pipeline de `gltf-transform` y repuntar `spirits.gltf_url` a un `.glb`.

## Egress de Storage — causa real del pico y arreglos (nov. 2026)
Medido con Playwright + `curl` + REST con la anon key. **Cached Egress = bytes servidos por el CDN de Storage**, no la base de datos (la BD es "Egress").
- Lo que se servía en cada visita sin poder cachearse: el asistente de la esquina montaba **siempre** el modelo por defecto `wingedKuriboh` (`.gltf` 4 KB + **`.bin` 1.25 MB** con `cache-control: private, no-cache` + 3 texturas ~0.57 MB) incluso en tiendas con asistente propio, y en algunas vistas lo montaba **dos veces** (home + chat).
- El `usuarios.select('..., subscription_status, ...')` del widget devolvía **400** porque **la columna no existía**: `docs/add_stripe_subscriptions.sql` nunca se ejecutó y PostgREST respondía `42703: column u.subscription_status does not exist`. Por eso el widget nunca resolvía la tienda y caía al modelo por defecto. (No era RLS.) `docs/P_widget_store_lookup.sql` ahora crea esas columnas **y** la RPC en un solo archivo. OJO: al existir la columna, la puerta de suscripción empieza a aplicarse de verdad; solo pasan `role='admin'`, `active`/`trialing` o dominios autorizados en `widget_domains`.
- Lo demás (modelos ya comprimidos, `model-viewer` de rejillas, notificaciones) sí estaba con caché larga y `cf-cache-status: HIT`.

### 1. Widget (`js/viking-widget.js`): 3D solo cuando hace falta
- `renderWidget()` ya **no** inyecta `<model-viewer>`; pinta póster (`.vk-spirit-poster`) o un placeholder SVG (`.vk-spirit-placeholder`).
- `fillMedia()`/`syncMedia()` montan el visor **solo cuando hay `gltf_url` real**; `ensureModel()` (que sí usa `DEFAULT_GLTF_URL`) se llama únicamente al **abrir el chat**. Una visita que no abre el chat descarga **0 bytes** de Storage.
- Solo se monta **un** visor al principio (el del compañero); el del chat se crea al abrirlo. Antes eran dos contextos WebGL con el mismo modelo.
- `fetchStoreRow()` / `readStoreAccess()` (a nivel de módulo, la usan los 4 widgets): intentan primero la RPC `get_widget_store` y, si no existe, piden las columnas sin `subscription_status`. La puerta de suscripción solo se aplica si el campo viene (`subKnown`); si no, manda la autorización por dominio. Antes de esto, subastas/claims/álbumes bloqueaban a todos porque el select fallaba y devolvía `null`.
- `vikingdev-binder` y `vikingdev-binders` **no pueden registrar la misma clase** (`NotSupportedError`); el error abortaba el script y dejaba `vikingdev-subastas` y `vikingdev-claims` sin definir. `vikingdev-binders` usa ahora una subclase.
- `fetchDefaultSpirit()` usa `.order('id', {ascending:true})` para ser determinista.
- Verificado (mitiendita.com, Playwright): se carga `compressed_.../10.glb` (Cloudinary) y **0 MB** desde Supabase Storage antes de interactuar.

### 2. Compresión automática al subir modelos (`js/model-optimizer.js` + `.worker.js`)
- Pipeline = el mismo que se aplicó a mano: `weld → dedup → simplify(ratio 0.08, error 0.001) → prune → texturas a 1024 px → draco(edgebreaker) → writeBinary`. Salida: **un único `.glb`**.
- Corre en un **Worker** (`type:'module'`, `new URL(..., document.currentScript.src)`) con timeout de 180 s: no congela la pestaña y, si se queda sin memoria, muere el worker, no la pestaña.
- Dependencias por CDN (no hay build): `esm.sh/@gltf-transform/{core,functions,extensions}@4.5.1`, `esm.sh/meshoptimizer@0.22.0` y `esm.sh/draco3d@1.5.7`. **El encoder Draco necesita `locateFile`** apuntando a `cdn.jsdelivr.net/npm/draco3d@1.5.7/<archivo>.wasm`; sin eso falla con "both async and sync fetching of the wasm failed".
- Se salta sin tocar nada si: no hay `.gltf/.glb`, el total < 1.2 MB, o el modelo ya tiene **≤ 800 000 vértices** (así un `.glb` ya comprimido no se degrada dos veces). Ante cualquier error se devuelven los **archivos originales** (la subida nunca se rompe).
- Integrado en `js/admin.js` (`#btn-save-spirit`, ambos servidores) y en `MediaUpload.uploadModelFiles` (servidor alterno y `packages.html`). Un `WeakSet` evita comprimir dos veces el mismo `File`. Si el modelo no trae póster, se sube la textura reducida a 512 px como `texture_url` (Cloudinary) para que las rejillas no pidan la textura a Storage.
- Medido: Eveningstar **12.38 MB → 1.87 MB (−85 %)**, 2 330 094 → 421 923 vértices, **8.5 s**; el `.glb` carga en `model-viewer` 3.3.0 (verificado con captura).

### 3. Logos de tienda
- `js/perfil.js` sube el logo a **Cloudinary** (`MediaUpload.uploadImage`) con fallback a Storage `logos` (y `cacheControl` de 1 año en el fallback).
- `window.storeLogoUrl(url, w)` (en `js/utils.js`) = `optImg`; se usa en todas las vistas que pintan `store_logo` (menú del avatar, cabecera de tienda, modal de negocio, plantillas). Antes se descargaba el original (114 KB) para mostrarlo a 50 px.
- `index.html` no carga `utils.js`: `js/landing2.js` y `js/landing.js` usan la guarda `(window.storeLogoUrl ? ... : url)`.

### 4. Assets
`STATIC_CACHE` → `viking-static-v264` (incluye `model-optimizer.js` y `.worker.js`). Al tocar cualquiera de estos archivos, subir la versión.

## Vista PÚBLICA de inversiones — precio mostrado = precio de venta
- En `public.html?view=investments` el precio debe ser **`sale_price`** (lo que el dueño pide), NO `current_price` (mercado). `publicInvSalePrice(card)` en `js/app.js` devuelve `sale_price` y solo cae a `current_price` cuando la carta no tiene precio de venta (evita `$0.00`).
- Se usa en los 3 modos (álbum/slide/lista vía `publicInvPriceLabel`), en el modal `#public-inv-modal-price` y al añadir al carrito (`Cart.add({price})`).
- `supabase/functions/create-checkout-session` también cobra `sale_price` (respaldo `current_price`). **Hay que redesplegar la Edge Function** para que el cargo coincida con lo mostrado.
- La vista privada (`inversiones.html`) sigue mostrando `current_price` a propósito: ahí el precio de mercado alimenta las métricas/gráfica de inversión.
- Binders públicos (`public.html?view=binders`, `js/public-binders.js`) ya usaban `binder_card_slots.price`, que es "Precio Venta Público"; no requieren cambio (verificado con datos reales).

## Constructor de Decks para PC
- `docs/constrcutorDecks.html` (sic, con el typo) es el constructor de escritorio: layout Nexus de 3 columnas (`#deck-editor-pc-layout`: preview / deck / buscador), login, "Mis Decks" y editor. Carga `js/admin.js` + `js/inversiones.js` etc., así que reutiliza el editor de decks del panel.
- `docs/deckbuilding.html` es el de móvil/horizontal (291 líneas, aviso de rotar el dispositivo); `admin.html` enlaza a ese.
- `constrcutorDecks.html` es la **entrada de "Mis Decks" en PC** (tile de `admin.html`, menú de `expanciones.html`, `editDeck()` del panel). Acepta `?deckId=` para abrir un deck directo. `admin.html` conserva su editor intacto, pero ya no se llega a él por la UI.
- **En móvil se abre `deckbuilding.html`**: `admin.html` expone `window.deckBuilderUrl(deckId)` (PC → `constrcutorDecks.html`, móvil → `deckbuilding.html`) y `admin.js` la usa; además `constrcutorDecks.html` lleva un guard al inicio del `<body>` que hace `location.replace('deckbuilding.html?deckId=...')` en móvil (cubre enlaces directos y el menú de `expanciones.html`).
- **El hook de arranque va fuera de `$(document).ready`.** `admin.js` llama a `showAuthenticatedContent()` desde `checkSession()` y esa promesa se resuelve antes que los ready posteriores: si el override se instala dentro de `ready`, corre el original y la vista queda vacía. Se instala en un IIFE al final del documento y se envuelve el original en `try/catch` para abrir igual la lista aunque una consulta falle.
- `js/subastas_v2.js` → `checkAuctionSession()` solo redirige a `admin.html` si hay UI de subastas (`#admin-auction-tabs`) **y** no estamos ya en `admin.html` (`shouldRedirectToAdminPage()`). Sin esa segunda condición, `admin.html` entra en bucle de recargas al no haber sesión.
- Layout Nexus: `#view-deck-editor .nexus-layout` usa `minmax(260px,300px) minmax(0,1fr) minmax(340px,520px)`. Con `300px 820px 520px` fijo, entre 1441 y 1680px la columna izquierda se salía por la izquierda (recortada por `overflow:hidden`).

## Link público de un deck (`public.html`, `view=decks`)
- Solo se muestran **las cartas**: el bundle de accesorios del deck (mat, sleeves, deckbox, moneda, contadores) se quitó de `renderDeckShell`. No volver a inyectarlo ahí; los accesorios son del constructor, no de la vista pública.
- Botones: en escritorio "Probar Deck" es flotante (`#btn-try-deck`, abajo-derecha). En móvil ese flotante se oculta y aparece `.btn-try-deck-inline` dentro de `.deck-toggle-container`, junto a "Modo Lista" (con `flex-wrap` a 360px se apilan). Así no tapa la carta ni el botón de lista.
- `body.modal-open #btn-try-deck { display:none }` evita que el flotante quede encima de la lista de cartas (`#deck-list-overlay`).
- `configDuelMobile.html?deckId=` en móvil, `configDuel.html?deckId=` en escritorio.

## Imágenes rotas por `optImg` mal interpolado (Wanted, carrito, claims, etc.)
Síntoma: en `wanted.html` (y otras vistas) las cartas guardadas se veían **sin imagen**, aunque el buscador externo sí mostraba las miniaturas.
- **Causa:** al envolver los `src` con `window.optImg` se perdió la interpolación de la plantilla. Quedó `<img src="(window.optImg?window.optImg(item.image_url, 400):item.image_url)">` — el atributo contiene ese **texto literal**, no el resultado de la expresión, así que el navegador pedía una URL inválida. Las imágenes externas (TCGdex, YGOProDeck, Lorcana) nunca fueron el problema y Cloudinary no influye: `optImg` devuelve la URL tal cual si no es `/image/upload/`.
- **Arreglo:** restaurar `${...}`: `src="${(window.optImg?window.optImg(item.image_url, 400):item.image_url)}"` (y `${(...) || 'placeholder'}` cuando hay fallback). Afectaba a `js/deseos.js`, `js/admin_deseos.js`, `js/adminClaim.js` (4), `js/binders.js`, `js/eventos.js`, `js/productoSellado.js`, `js/viking-widget.js`, `carrito.html` y `subastas.html`.
- **Regla:** cualquier `src="..."` que use `window.optImg` dentro de un template literal necesita `${}`. Un `grep -rn 'src="(window\.'` no debe devolver nada.
- Verificado con Playwright (`wanted.html`, sesión en `localStorage['tcg_session']`, mock de `**/rest/v1/wishlist**`): el `src` sale con la URL real y la imagen carga (`naturalWidth > 0`).

## Wanted: por qué el link público sí mostraba imágenes y `wanted.html` no
- La vista pública (`public.html?view=wishlist`, `loadPublicWishlist` en `js/app.js`) ya tenía `src="${window.optImg(item.image_url, 400)}"`, por eso las imágenes se veían.
- La vista privada usa `js/deseos.js` → `loadWishlist()` y ahí estaba el `src` literal sin `${}`. Son dos renders distintos: corregir uno no arregla el otro.
- El nombre público de la sección pasó de **"Buscamos"** a **"Wanted"**: tile de `public.html` (`.home-menu-item[data-view="wishlist"]`), `js/build.js` (`key:'wishlist'`) y `js/custom.js` (`public-wishlist`). Los títulos de compartir (`openShareModal`) y los mensajes de WhatsApp/Messenger también dicen "Wanted - Slot N" / `"Wanted"`.
- `STATIC_CACHE` → `viking-static-v268`.
