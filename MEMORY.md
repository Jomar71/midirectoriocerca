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
- Los mensajes de una ficha se guardan y envian al correo de contacto del anuncio; el admin recibe copia oculta. Si SMTP falla, el API lo comunica y conserva el mensaje.
- `APP_URL` se normaliza al origen HTTP(S); configurarlo solo con dominio, sin rutas. Evita enlaces internos duplicados como `/admin/panel/admin/panel`.
- El correo de nueva consulta no debe incluir enlaces; algunos clientes convierten automaticamente nombres de negocio que parecen dominios en enlaces externos.
- `STORAGE_DRIVER` solo admite local. Fotos se guardan originales, sin conversion WebP.
- En Pxxl, `UPLOAD_DIR` persistente evita perder archivos si el fallback usa `/tmp`.
- Tailwind y Google Translate usan CDN; dominios externos nuevos requieren actualizar CSP.
- Tema publico usa `localStorage['dc-theme']`; admin/login permanecen claros.
- Busqueda publica pagina hasta 20 resultados; resultados se muestran en `/resultados`.
- Colombia: departamentos/ciudades vienen de DANE; matching de ciudades tolera acentos y sufijos.
- Las fichas usan Leaflet local + teselas OpenStreetMap; zoom por rueda/pellizco sin controles de flechas. Usa coordenadas precisas del anuncio o centro municipal DANE aproximado; si no hay ubicacion calculable, muestra enlace a Google Maps, no embed con flechas.
- El boton de email usa `mailto:` y muestra el formulario interno como alternativa si el dispositivo no tiene cliente de correo configurado.

## Decisiones recientes
- Correos generales/avisos van al admin; consultas de ficha van al correo del anuncio y copia oculta al admin.
- Confirmar al visitante el envio solo cuando SMTP acepta el correo; avisar si se guardo pero el envio fallo.
- Fichas publicas deben exponer solo anuncios `activo`, igual que los listados publicos.
- Fichas deben renderizar las etiquetas SEO y JSON-LD preparados por el controlador.
- Para WhatsApp, preservar codigo de pais si el telefono ya trae prefijo `+` o `00`; numeros nacionales usan Colombia (+57).
- 2026-10-31: fichas SEO/estado/WhatsApp; contacto de ficha redirigido al email del anuncio con copia oculta al admin y enlace mailto con asunto/cuerpo.
- 2026-10-31: URLs del sitio se basan en el origen de `APP_URL`; el correo de nueva consulta no incluye enlaces.
- 2026-10-31: botón mailto directo + alternativa al formulario; mapa Leaflet interactivo y sin controles de flechas.
