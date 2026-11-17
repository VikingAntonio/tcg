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

## Cloudinary — `window.CloudinaryUpload` (bug de subida)
`js/cloudinary-upload.js` declara `const CloudinaryUpload = {...}`. Un `const` en el top-level crea un **global léxico**, NO una propiedad de `window`; por eso `window.CloudinaryUpload` era `undefined` aunque `typeof CloudinaryUpload === 'object'`. El código que guarda con `if (window.CloudinaryUpload && ...)` (p. ej. `packages.html` → `handleBddFileSelected`) saltaba la subida, intentaba el fallback a Supabase Storage (bucket `accessories`, bloqueado por RLS → 403) y acababa guardando un `URL.createObjectURL(file)` = `blob:https://...` **muerto** en `image_url`. Resultado: cartas guardadas con imagen rota. Arreglo: `window.CloudinaryUpload = CloudinaryUpload;` al final del archivo. El resto de vistas usan la referencia léxica (`CloudinaryUpload.uploadImage`) y ya funcionaban.

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
