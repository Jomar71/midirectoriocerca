# DirectorioCerca — memoria del proyecto

## Contexto
- Directorio empresarial publico con un unico administrador; visitantes no tienen cuenta ni panel.
- Node 18+, Express 4, EJS, PostgreSQL, JS vanilla y Tailwind CDN. Leer README.md para mas contexto.
- Capas: `backend/routes` -> `controllers` -> `models` -> PostgreSQL; servicios y middleware separados.
- Paginas publicas: `/`, `/resultados`, `/anuncio/:slug`, `/contacto` y `/nosotros/*`.
- Fichas: galeria/lightbox, mapa, contactos, redes, formulario, SEO y datos JSON-LD.

## Reglas que preservar
- Maximo 11 fotos por anuncio y 6 ediciones gratis registradas por anuncio.
- Anuncios vencen a los 12 meses; cron diario avisa 30 dias antes.
- Toda mutacion desde controladores admin debe llamar `invalidatePublicCache()`.
- Consultas SQL parametrizadas; acceso a BD por `backend/config/db.js`.
- Variables de entorno solo via `backend/config/env.js`.
- Un solo admin con JWT en cookie httpOnly; no crear registro de clientes/anunciantes.
- Orden de rutas en `backend/server.js`: sitemap, auth, admin, public.

## Operacion y gotchas
- `npm run build` solo verifica sintaxis de `backend/server.js`; ejecutar `node --check` en cada JS modificado.
- No hay framework de pruebas ni ESLint instalados.
- `database.sql` empieza con `DROP TABLE ... CASCADE`: nunca ejecutar `db:init` contra datos existentes.
- En Postgres administrado usar `npm run db:load`, no `db:init`.
- `MAIL_TRANSPORT=json` solo registra mensajes; produccion necesita SMTP configurado.
- Los mensajes de una ficha se guardan y envian solo al correo de contacto del anuncio (al admin si la ficha no tiene correo); el admin los consulta en el panel. Si SMTP falla, el API lo comunica y conserva el mensaje.
- `APP_URL` se normaliza al origen HTTP(S); configurarlo solo con dominio, sin rutas. Evita enlaces internos duplicados como `/admin/panel/admin/panel`.
- El correo de nueva consulta no debe incluir enlaces; algunos clientes convierten automaticamente nombres de negocio que parecen dominios en enlaces externos.
- `STORAGE_DRIVER` solo admite local. Fotos se guardan originales, sin conversion WebP.
- En Pxxl, `UPLOAD_DIR` persistente evita perder archivos si el fallback usa `/tmp`.
- Tailwind y Google Translate usan CDN; dominios externos nuevos requieren actualizar CSP.
- Tema publico usa `localStorage['dc-theme']`; admin/login permanecen claros.
- Busqueda publica pagina hasta 20 resultados; resultados se muestran en `/resultados`.
- Colombia: departamentos/ciudades vienen de DANE; matching de ciudades tolera acentos y sufijos.
- Las fichas usan Leaflet desde unpkg + teselas MapTiler, solo calles (sin satelite); zoom por rueda/pellizco sin controles. Geocodifica direccion/ciudad/pais con `@maptiler/client` al crear/cambiar ubicacion (tambien CSV), infiere departamento DANE y usa `country=co` para Colombia. Reintenta: direccion completa, calle sin numero/letra y ciudad+departamento; prefiere el resultado preciso y conserva el aproximado. Las fichas sin coordenadas se autorreparan al visitarse (max. cada 5 min), guardan coordenadas e invalidan cache. El backend envia `Referer` con el origen de `APP_URL`; la clave esta restringida por dominio y sin ese encabezado MapTiler responde 403. Si solo hay ciudad, el mapa se centra en ella y el marcador queda en su centro; si no hay resultado, usa la ciudad del catalogo o Bogota sin marcador. No se piden coordenadas manuales.
- El boton de correo abre un `mailto:` dirigido al email del anuncio, con asunto fijo "Contacto desde la web"; el destino se codifica en `data-email-href`, no se muestra en texto ni en datos estructurados, y se activa al clic para evitar la reescritura de Cloudflare. El destinatario no configura nada. Depende de una app de correo del visitante; el formulario web es la alternativa y usa SMTP configurado una vez para el sitio.

## Decisiones recientes
- Correos generales/avisos van al admin; consultas de ficha van solo al correo del anuncio.
- Confirmar al visitante el envio solo cuando SMTP acepta el correo; avisar si se guardo pero el envio fallo.
- Fichas publicas deben exponer solo anuncios `activo`, igual que los listados publicos.
- Las paginas publicas con `meta` (inicio, resultados y fichas) deben renderizar description, canonical, Open Graph y Twitter; las fichas ademas JSON-LD.
- Para WhatsApp, preservar codigo de pais si el telefono ya trae prefijo `+` o `00`; numeros nacionales usan Colombia (+57).
- 2026-10-31: fichas SEO/estado/WhatsApp; contacto de ficha redirigido al email del anuncio y enlace mailto con asunto/cuerpo.
- 2026-11-01: se quito la copia oculta al admin en consultas de ficha; el mensaje va solo al correo del anuncio (o al admin si no hay email).
- 2026-11-01: mapa de ficha solo con calles de MapTiler (sin capa satelital) y marcador basado en `anuncio.latitud`/`anuncio.longitud`; geocodificacion migrada a `@maptiler/client`.
- 2026-11-01: geocodificacion construye "direccion, ciudad, departamento, Colombia", infiere el departamento desde el catalogo DANE (tolera acentos y nombres como "Cali" -> "Santiago de Cali") y limita a `country=co`.
- 2026-11-01: geocodificacion con reintentos (direccion, calle sin numero, ciudad+departamento), prefiriendo el resultado preciso; `Referer` del origen de `APP_URL` evita el 403 de la clave restringida; fichas sin coordenadas se autorreparan al visitarse (max. cada 5 min) y el mapa cae a la ciudad del catalogo o Bogota sin marcador.
- 2026-10-31: URLs del sitio se basan en el origen de `APP_URL`; el correo de nueva consulta no incluye enlaces.
- 2026-10-31: boton abre mailto al email publicado (sin config del destinatario); formulario web usa SMTP global.
- 2026-10-31: Cloudflare reescribia el `href` del boton de correo a `/cdn-cgi/l/email-protection`; la ficha ahora codifica el destino y lo abre en el clic para evitar esa transformacion.
- 2026-11-01: plantilla CSV corregida a 18 columnas (sin latitud/longitud) y README alineado; las coordenadas se calculan automaticamente.
- 2026-11-01: resultados conserva `pais`/`departamento` al buscar y muestra chips para todos los filtros activos.
- 2026-11-01: fechas del API admin se normalizan con `S.formatDateOnly` para no enviar `"Thu Jan 01"` a los inputs date; tambien se usa en avisos de vencimiento.
- 2026-11-01: panel deshabilita la subida al llegar a 11 fotos y maneja errores al marcar/eliminar mensajes.
- 2026-11-01: smoke tests locales OK (publico, APIs, login, CRUD admin, CSV y contacto guardado); `MAPTILER_API_KEY` ausente deja coordenadas nulas sin romper.
