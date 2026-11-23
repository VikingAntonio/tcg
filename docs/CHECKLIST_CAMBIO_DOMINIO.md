# Cambio de dominio (vikingtcg.xyz → nuevo dominio)

Checklist verificado sobre el código real. El proyecto es estático y casi todo
usa rutas relativas, así que el cambio es pequeño: **78 referencias en 30
archivos**, de las cuales 58 son el favicon.

## 1. Lo único que hay que editar en el repo

| Archivo | Referencias | Qué es |
|---|---|---|
| `docs/CNAME` | 1 | Dominio de GitHub Pages (contiene `vikingtcg.xyz`) |
| `docs/*.html` (~30 vistas) | 58 | `https://vikingtcg.xyz/favi.png` (favicon / og:image) |
| `docs/js/viking-widget.js` | 13 | base del widget, `session-bridge.html`, `index.html`, y **2 comparaciones** `window.location.hostname !== 'vikingtcg.xyz'` (líneas 1576 y 2875) |
| `docs/widgets.html` | 4 | texto del snippet que copian los clientes (`<script src="https://vikingtcg.xyz/js/viking-widget.js">`) |
| `docs/js/vikingdevUI.js` | 2 | base del widget + badge "Powered by" |
| `docs/js/landing.js`, `docs/js/landing2.js` | 1 c/u | redirección a `admin.html` tras login |
| `docs/admin.html` | 1 | tile de inicio |
| `supabase/functions/create-checkout-session/index.ts` | 1 | `fallback` de `sanitizeReturnUrl` (`https://vikingtcg.xyz/widgets.html`) |
| `docs/404.html`, comentarios de `viking-widget.js` | 3 | solo comentarios |

Comando que hace el 95 % (excluye `binders.js` a propósito, ver punto 2):

```bash
cd docs
grep -rl "vikingtcg\.xyz" --include=*.html --include=*.js --include=*.json . \
  | grep -v "js/binders.js" \
  | xargs sed -i 's|vikingtcg\.xyz|NUEVODOMINIO.com|g'
cd ..
sed -i 's|vikingtcg\.xyz|NUEVODOMINIO.com|g' supabase/functions/create-checkout-session/index.ts
echo "NUEVODOMINIO.com" > docs/CNAME
```

Después: subir `STATIC_CACHE` en `docs/sw.js` (el HTML cambió) y desplegar la
función `create-checkout-session` (`supabase functions deploy create-checkout-session`).

## 2. NO tocar

- `docs/js/binders.js:641` → `email = resolvedEmail || \`${user}@vikingtcg.xyz\``.
  Es un **identificador de login** para cuentas antiguas que se registraron con
  correos `usuario@vikingtcg.xyz`. Si se cambia, esos usuarios no pueden entrar.
  El dominio viejo puede dejar de servir la web, pero el texto del correo en la
  BD debe seguir igual.

## 3. Fuera del repo (paneles)

1. **DNS / GitHub Pages**: crear el registro del dominio nuevo (CNAME `www` →
   `usuario.github.io`, o A records), esperar propagación y luego cambiar
   `docs/CNAME` + Settings → Pages → Custom domain. Marcar "Enforce HTTPS".
2. **Supabase → Authentication → URL Configuration**:
   - *Site URL* = `https://NUEVODOMINIO.com`
   - *Redirect URLs*: añadir `https://NUEVODOMINIO.com/**` (el código ya usa
     `window.location.origin` para la recuperación de contraseña, así que no hay
     que tocar el JS).
   - Revisar las plantillas de correo (confirmación / recuperación) por si traen
     el dominio escrito a mano.
3. **Stripe**: no hay que cambiar nada.
   - El webhook apunta a `https://<proyecto>.supabase.co/functions/v1/stripe-webhook`.
   - `success_url` / `cancel_url` se construyen con el `origin` de la petición y
     `sanitizeReturnUrl` fuerza el mismo host, así que el dominio nuevo funciona
     solo.
   - Opcional (cosmético): sitio web del negocio en el perfil de Stripe.
4. **Cloudinary**: nada. Las imágenes y modelos usan `res.cloudinary.com/de3n9pg8x/...`,
   independiente del dominio de la web.
5. **Service Worker**: la caché es por origen; en el dominio nuevo arranca vacía
   (no hay que migrar nada).

## 4. Recomendaciones

- Mantener el dominio viejo activo con **redirección 301** al nuevo durante unos
  meses: hay snippets de widget ya pegados en webs de clientes que apuntan a
  `https://vikingtcg.xyz/js/viking-widget.js`.
- Los enlaces públicos compartidos (`public.html?store=...`) seguirán funcionando
  en ambos dominios mientras el viejo redirija.
- Probar tras el cambio: login, recuperar contraseña, pago de prueba con Stripe,
  widget embebido en un dominio externo y "Mis compras".
