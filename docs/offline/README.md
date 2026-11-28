# Modo sin conexión (tablet)

Copia de solo lectura de la tienda pública para usar en una tablet **sin internet**:
binders, decks, álbumes, Wanted e inversiones, más el duelo de 1 jugador y Magic,
con sus imágenes (portadas, cartas y listas).

Todo vive en `docs/offline/`. **No modifica ninguna vista del sitio**: las páginas de
aquí son copias propias que reutilizan los mismos `js/` y `css/` del proyecto.

---

## 1. Cómo se usa

La forma más rápida: entra a tu panel (`admin.html`) con tu cuenta y pulsa el
tile verde **«Tablet Sin Conexión»**. Abre la copia sin conexión de tu tienda y
empieza a descargar solo (`offline/index.html?store=TU_USUARIO&autostart=1`).
Como está dentro del panel, solo lo ve el dueño de la cuenta.

También puedes entrar a mano:

1. Con internet, abre `https://TU-DOMINIO/offline/index.html?store=toonShop`
   (cambia `toonShop` por el nombre o el id de tu tienda).
2. El botón es la **píldora azul de abajo a la derecha** con el texto
   **DESCARGAR** (cuando ya hay copia dice **ACTUALIZAR**) y un punto verde/rojo
   con el estado. Púlsala y luego **Descargar / actualizar**. Tarda entre 10 y
   60 s según las imágenes.
   - En la primera visita el panel se abre solo, así que no hay que buscarlo.
   - Si la URL no trae tienda, el panel la pide antes de descargar.
   - En los tableros de juego (`duel`, `duelmobile`, `magic`) el botón se oculta
     para no tapar la mano: se actualiza desde el menú principal.
3. Cuando termine, ya puedes cortar el wifi: la vista funciona igual.
4. En la tablet, usa el menú del navegador → **Añadir a pantalla de inicio**
   para abrirlo como una app (el `manifest.webmanifest` ya está listo).

### Actualizar

Abre la página **con internet** y pulsa otra vez **Descargar / actualizar**.
Se vuelven a leer los datos (decks, binders, inversiones) y solo se descargan
las imágenes nuevas: las que ya estaban se conservan. Si no abres el panel, la
página intenta actualizarse sola cada 6 h al cargarse con conexión.

---

## 2. Qué incluye

| Vista | Qué se puede hacer |
|---|---|
| **Binders** | menú de binders, álbum con flip, modos binder / vikingSlide / lista, popup de carta |
| **Decks** | menú de decks, vista de deck, modo lista, **Probar Deck** → duelo |
| **Inversiones** | menú de colecciones, álbum con flip, slide, lista, popup con precio |
| **Duelo 1 jugador** | `configDuel.html` con todos tus decks y el tablero (`duel.html` / `duelmobile.html`) |
| **Magic** | `configMagic.html` y `magic.html` con todos tus decks |

No incluye: carrito y pagos, subastas, preventas, productos, wanted, claims,
eventos, panel de administración ni multijugador. En el duelo el botón de
compartir sala y el chat no hacen nada (no hay servidor).

---

## 3. Cómo funciona

- **Datos:** `js/offline-sync.js` lee las tablas por la API REST (clave pública) y
  guarda una copia en **IndexedDB** (`offline-db.js`). `js/offline-supabase.js`
  sustituye al cliente de Supabase y responde a las mismas consultas
  (`select`, `eq`, `in`, `order`, `limit`, `maybeSingle`…) desde esa copia.
  Por eso las vistas funcionan sin cambios: creen que hablan con la base.
- **Imágenes:** se descargan una vez y se guardan como blobs en **IndexedDB**
  (misma base, almacén `images`). El Service Worker (`offline-sw.js`) las sirve
  desde ahí cuando no hay red. Las que falten muestran un recuadro
  "Sincroniza con Internet" en lugar de un icono roto.
  Se usa IndexedDB y no Cache Storage a propósito: el Service Worker del sitio
  (`docs/sw.js`) borra en su `activate` todas las cachés que no sean las suyas,
  así que una copia guardada en Cache Storage desaparecería al abrir la web
  normal en el mismo navegador.
- **Archivos de la app** (HTML, CSS, JS, fuentes, librerías): caché
  `viking-offline-shell-v1`, que se rellena al sincronizar.
- **Optimización de imágenes:** se piden a un proxy de imágenes con
  `w=400` + `webp` + `q=72` (calidad *Optimizada*) o `w=800` + `q=80`
  (calidad *Alta*). Una carta de 400 px pesa ~25-40 KB en vez de 200-400 KB.
  Con ~2000 imágenes el paquete ronda **60-90 MB**.
- **PWA:** `manifest.webmanifest` + Service Worker con alcance `/offline/`.

---

## 4. Límites a tener en cuenta

- Hay que hacer **una primera sincronización con internet**; sin ella no hay nada.
- El navegador da a cada sitio un espacio limitado (Chrome ~60 % del disco libre).
  Si se llena, la sincronización avisa y hay que borrar la copia o usar
  calidad *Optimizada*.
- Algunas imágenes externas (TCGdex / YGOPRODeck / Cloudinary) pueden fallar; el
  panel lo dice al final ("N imágenes no se pudieron descargar"). Basta con
  volver a sincronizar.
- El modo sin conexión es de **solo lectura**: los cambios se hacen en la app
  normal con internet y se bajan al volver a sincronizar.

---

## 5. Mantenimiento

- `rebuild-html.py` vuelve a generar las páginas de `docs/offline/` a partir de
  las del sitio (por si cambia `public.html`, `duel.html`, etc.):

  ```bash
  cd docs && python3 offline/rebuild-html.py
  ```

- Después de tocar **cualquier** archivo de `offline/`, de `js/` o de `css/`,
  sube el número en `offline/js/offline-version.js`. El Service Worker borra el
  caparazón viejo y la próxima carga con internet trae los archivos nuevos.
  (El borrado lo pide la página por `postMessage`; el `activate` del SW lo hace
  también como respaldo, porque `importScripts` puede traer una copia vieja.)

- `offline/img/` y `offline/images/` son copias de los assets que el duelo
  referencia con ruta **relativa** (`img/bocabajo.jpg`, máscaras, tokens). Si
  cambian en el proyecto, cópialos otra vez aquí.

- Archivos principales:

  | Archivo | Función |
  |---|---|
  | `offline-sw.js` | Service Worker: caparazón, imágenes y respaldo sin red |
  | `js/offline-sync.js` | descarga de datos + imágenes y estado de la copia |
  | `js/offline-db.js` | almacén local en IndexedDB (tablas, metadatos e imágenes) |
  | `js/offline-supabase.js` | cliente de datos compatible con las vistas |
  | `js/offline-ui.js` | botón, panel de sincronización, aviso "Sin conexión" y accesos a duelo/Magic |
  | `offline.css` | estilos del panel y del aviso |
  | `js/offline-version.js` | versión del caparazón |
