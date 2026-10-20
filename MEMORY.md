# MEMORY.md — DirectorioCerca

## Qué es este proyecto
DirectorioCerca es un **directorio empresarial web de un solo administrador**. El sitio es público para visitantes; la administración la ejerce únicamente el propietario (un solo admin). **No existe registro de clientes, ni login de anunciantes, ni panel de usuario cliente.** Todo el contenido lo sube y modifica el administrador.

Promociona Empresas, Negocios, Profesionales, Productos y Servicios a nivel Local, Nacional e Internacional, y debe soportar una cantidad ilimitada de anuncios (unipersonales, pymes, negocios, profesionales) sin degradar el rendimiento.

## Stack
- **Backend:** Node 18+ / Express 4, entry `backend/server.js`
- **Renderizado:** EJS server-rendered (por SEO)
- **Base de datos:** PostgreSQL
- **Frontend:** Vanilla JS + Tailwind (CDN)
- **Auth:** un solo admin, JWT en cookie httpOnly
- **Caché:** Redis (opcional, para caché pública)
- **Almacenamiento:** solo `local` (`public/uploads/`); `cloudinary`/`s3` son stubs que lanzan error

## Estructura de capas
`routes/` → `controllers/` → `models/` (SQL) → `services/` (storage, mail, cron, csv, seo) + `middlewares/`
- Vistas: `views/` (EJS)
- Código de navegador: `public/js/`
- Esquema y categorías: `database.sql`

Orden de montaje de rutas en `backend/server.js` (importa): **sitemap → auth → admin → public**.

## Reglas de negocio que NO se deben romper
- **Máximo 11 fotos** por anuncio.
- **6 ediciones gratis** por anuncio: cada `PUT /api/admin/anuncios/:id` incrementa `anuncios.cambios_usados` y registra en `cambios_log`.
- Los anuncios **expiran a los 12 meses**. El cron diario (`services/cron.service.js`, `CRON_DAILY`) marca los vencidos y envía aviso por email `EXPIRY_WARNING_DAYS` (30) días antes.
- La caché pública es Redis-backed pero opcional. **Cualquier cambio en controladores admin debe llamar a `invalidatePublicCache()`.**

## Autenticación y acceso
- Un solo administrador. JWT en cookie httpOnly.
- Todas las rutas `/api/admin/*` requieren el JWT del admin (`middlewares/auth.js`).
- Las páginas HTML usan `requireAdminPage`.
- **No agregar registro de clientes ni login de anunciantes.**

## Rutas clave
- **Server-rendered (`public.routes.js`):** `/`, `/anuncio/:slug`, `/nosotros`, `/terminos`, `/privacidad`, `/contacto` (estas 4 son estáticas, sin BD; el formulario de `/contacto` reutiliza `#contacto-form` + `/js/index.js` → `POST /api/contacto`)
- **API de solo lectura:** `/api/anuncios`, `/api/categorias`, `/api/ubicaciones`
- **Panel admin:** una sola página (`views/admin-panel.ejs`) manejada por `public/js/admin-panel.js` que llama a `/api/admin/*`. `/admin/panel` → `requireAdminPage` (302 a login); API admin → 401. **El footer ya NO enlaza a `/admin/login`** (el acceso es solo por URL directa, a petición del usuario).

## Geografía de Colombia (DANE – DIVIPOLA)
- Tablas `departamentos` (33, con `capital`) y `ciudades` (1122 municipios, `es_capital`, `tipo`, lat/long), cargadas por `npm run db:init` desde `database.sql`. Fuente: datos.gov.co `gdxc-w37w` (DANE). Nombres en Title Case.
- **Caso especial:** Cundinamarca no tiene municipio `001` propio (su capital es Bogotá, entidad aparte). Su `capital` es "Bogotá D.C." y ninguna de sus ciudades marca `es_capital`.
- Modelo: `backend/models/ubicacion.model.js` (`listDepartamentos`, `listCiudades`, `listCiudadesByDepartamento`, `findDepartamentoBySlug`, `getUbicaciones`, `groupByDepartamento`). `getUbicaciones` reemplazó a `categoriaModel.getUbicaciones` (eliminada).
- Filtro `?departamento=<slug>` en la home: coincide la ciudad del anuncio con el catálogo de forma **tolerante** (`unaccent(lower(...))`, aceptando también la parte antes de la coma, ej. "Bogotá" ↔ "Bogotá, D.C.") para reconocer datos históricos de texto libre.
- Home: **buscador simplificado (2026-10-20):** input "¿Qué buscas?" (`q`) + input "¿Dónde?" (`ciudad`, con `<datalist>` de las ciudades del catálogo, deduplicadas) + botón "Buscar". Los selects de categoría/departamento/ciudad se quitaron del formulario (los filtros por URL `?categoria=`/`?departamento=`/`?ciudad=` siguen funcionando; las tarjetas de categorías enlazan `?categoria=`). El filtro `?ciudad=` en `anuncio.model.js` ahora es tolerante: `unaccent(lower(...)) = ... OR ILIKE '%...%'` (el usuario escribe a mano). El JS dependiente dept→ciudad (`filtro-departamento`) quedó sin uso (guard se sale si no existen los elementos).
- Admin: el modal de anuncio tiene select de departamento + input ciudad con `<datalist>` del catálogo (permite texto libre para otros países); elegir departamento autocompleta país = Colombia.
- La BD real ya tiene el catálogo aplicado de forma aditiva (sin borrar datos); para instalaciones limpias basta `npm run db:init`.

## Base de datos y acceso a datos
- Todo el acceso a BD pasa por `backend/config/db.js` (`query`, `pool`, `withTransaction`).
- **Siempre usar consultas parametrizadas** (`$1`, `$2`). Nunca interpolación de strings.
- Todo el acceso a variables de entorno pasa por `backend/config/env.js` (carga `.env` desde la raíz del repo). **No leer `process.env` directamente en otros archivos.**
- Búsqueda full-text usa el `search_vector` ponderado + índices `pg_trgm`.
- Paginación pública limitada a **20 por página**.

## Comandos
- `npm run dev` / `npm start` — nodemon / node plano, entry `backend/server.js`
- `npm run build` — no-op (`node --check backend/server.js`); existe porque las PaaS (Pxxl) ejecutan `npm run build` y fallaban sin el script.
- `npm run db:init` — crea la BD (si no existe) y ejecuta `database.sql`
- `npm run db:load` — aplica `database.sql` sobre `DATABASE_URL` **sin** crear la BD (para Postgres gestionado en la nube).
- `npm run db:seed` — crea el admin único + 3 anuncios de ejemplo
- `npm run db:reset` — `db:init` + `db:seed`
- `npm run lint` — **solo ejecuta `node --check backend/server.js`.** No revisa el resto del código.

## Deploy (Pxxl)
- Plataforma: **Pxxl** (`app.pxxl.app`). Repo GitHub `Jomar71/midirectoriocerca` (rama `main`). El deploy falla → Pxxl publica un check de commit en estado `failure` (aparece como **X** junto al commit en GitHub); **el commit en sí está bien**, la X es del deploy.
- Pipeline Pxxl: install → build → start → health check. Config: install `npm install`, build `npm run build`, start `npm start`, health check `GET /health`, auto-detección Node.
- El servidor hace `app.listen(env.port, '0.0.0.0')` (Pxxl no alcanza loopback) y lee `PORT`.
- `GET /health` en `backend/server.js` devuelve `{ ok: true, uptime }` **sin tocar la BD**.
- Secretos requeridos en Pxxl: `NODE_ENV=production`, `JWT_SECRET`, `APP_URL`, `DATABASE_URL` (Postgres gestionado), `PGSSL=true`. Cargar el esquema con `npm run db:load` (no `db:init`, que intenta crear la BD y falla en la nube).

## Advertencias críticas
- **`database.sql` empieza con `DROP TABLE ... CASCADE`.** `npm run db:init` destruye todos los datos existentes. El seeding es idempotente (admin por email, anuncios por slug se omiten si ya existen).
- **No hay framework de tests ni ESLint instalados** (los comentarios `eslint-disable` son inertes). Antes de terminar un cambio, hacer syntax-check de cada archivo tocado con `node --check <file>`; el lint solo no basta.
- **Sí es un repo git** (remoto `origin` → GitHub `Jomar71/midirectoriocerca`, rama `main`). Hay un `.env` real en la raíz del repo y está gitignoreado — nunca imprimir ni commitear sus secretos.
- `STORAGE_DRIVER` solo soporta `local`; `cloudinary`/`s3` son stubs que lanzan error.
- Redirects y cookies asumen `NODE_ENV=production` para cookies `secure`, `trust proxy` y HSTS — configurarlo en el VPS.

## Frontend / CSP
- Tailwind y Google Translate se cargan desde CDNs.
- **Agregar cualquier dominio nuevo de script/style/frame requiere editar el `contentSecurityPolicy` de `helmet` en `backend/server.js`.**
- Diseño: tokens definidos en `views/partials/head.ejs` (config Tailwind): `primary` (azul, incluye `950` nuevo), `accent` (amarillo), `success`, `warning`, `error`, `info`, `neutral` (grises) + semánticos `verified`/`featured`/`distance`/`open`/`closed`/`rating`/`whatsapp`. Usar siempre los tokens (`bg-primary-600`, `text-neutral-500`), nunca `blue-*`/`gray-*`. Excepciones: los paneles admin/login usan `bg-neutral-*`/`bg-white` (superficies claras) sobre `bg-neutral-100`.
- Cabecera (`views/partials/header.ejs`): banner sticky (gradiente `from-primary-950 via-primary-900 to-primary-800` + textura de puntos + hairline accent superior) con **fila de menú inferior** (2026-10-20): Inicio, Nosotros, Términos y condiciones, Políticas y privacidad, Contáctanos (scroll horizontal en móvil). Logo (caja blanca `rounded-xl`), mensaje de acción centrado (visible en `xl`), CTA "Llama y suscríbete" (accent, **sin pulso**) que enlaza a `/#contacto` (en móvil se acorta a "Suscríbete"). Conserva el traductor de Google y el toggle de modo oscuro. Titular home (2026-10-20): "Encuentra lo que buscas, cerca de ti." + subtítulo del directorio virtual.
- Rediseño 2026-10 (profesionalización): portada con hero editorial en 2 columnas (titular + stats a la izquierda, tarjeta de buscador a la derecha), índice de categorías en tarjetas, resultados en tarjetas con `rounded-2xl`; ficha con tarjeta de contacto sticky (cabecera azul + acciones primaria/outline + WhatsApp); login admin a pantalla partida; panel admin con **barra lateral oscura** y tarjetas de stats con acento. Helpers en `styles.css`: `.nav-item.is-active`, `.msg-filter.is-active`, `.dc-rise` (entrada de portada), `.dc-tabular`. `admin-panel.js` usa `is-active` para la nav (ya no alterna `bg-neutral-900`/`text-white`).
- Modo oscuro: escala `slate` (`dark:bg-slate-900`, tarjetas `dark:bg-slate-700`, inputs `dark:bg-slate-600`, texto `dark:text-slate-100/400`). Toggle solo en páginas públicas (`partials/header.ejs`), persiste en `localStorage['dc-theme']`. El panel admin y el login no usan variantes `dark:` (se mantienen claros aunque hereden la clase).
- Jerarquía de botones: Primary = `bg-primary-600 hover:bg-primary-700 text-white`; Secondary = `border-primary-600 text-primary-600 hover:bg-primary-50 hover:border-primary-700`; Accent = `bg-accent-400 text-neutral-900 hover:bg-accent-500`. Texto blanco sobre amarillo: prohibido.

## Accesibilidad (auditoría 2026-10)
- **`views/partials/head.ejs`** ahora incluye `<meta charset>`, `<meta viewport>` y `<title>`. El título se pasa explícito: cada vista declara `var titulo = '...'` y hace `include('partials/head', { titulo: titulo })` (un `var` local **no** llega al partial de EJS). Si falta, usa un título por defecto.
- **Skip link** "Saltar al contenido" en `partials/header.ejs` y en el header del panel; todas las páginas con header tienen `<main id="contenido">`. `styles.css` usa `scroll-padding-top: 96px` para que el header sticky no tape las anclas (`#contacto`); `color-scheme` sigue al modo oscuro.
- **Modales** (`admin-panel.ejs`, lightbox de `anuncio.ejs`): `role="dialog"` + `aria-modal` + `aria-labelledby/label`, foco gestionado (se mueve al abrir, se atrapa con Tab, se cierra con Esc y se restaura al cerrar) — lógica en `admin-panel.js` (`focusables`/`trapFocus`/`closeAnuncioModal`/`closeMsgModal`) y `anuncio.js`.
- Todos los inputs del panel tienen `<label for>`/`id`; los filtros y campos sin label visible usan `sr-only`. Toasts y `#csv-result` son `role="status"`. Nav/paginación/filtros exponen estado con `aria-current`/`aria-pressed`.
- Contraste: usar `text-neutral-500` (no `neutral-400`) sobre fondos claros y `dark:text-slate-400` (no `slate-500`); placeholders `text-neutral-600`/`dark:text-slate-300`. Imágenes con `width`/`height`. Enlaces `target="_blank"` llevan un `sr-only` "(se abre en una pestaña nueva)". Marca con `translate="no"` (Google Translate activo).

## Mail
`MAIL_TRANSPORT`:
- `json` (por defecto) — imprime en consola, no envía
- `ethereal` — bandeja de prueba
- `smtp` — envío real
Ver `.env.example`.

## Regla de oro
`README.md` es la referencia completa (en español). Mantenerlo sincronizado cuando cambie el comportamiento. Este `MEMORY.md` es el resumen operativo para retomar el proyecto rápido.