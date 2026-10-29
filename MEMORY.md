# MEMORY.md — DirectorioCerca

## Qué es este proyecto
DirectorioCerca es un **directorio empresarial web de un solo administrador**. El sitio es público para visitantes; la administración la ejerce únicamente el propietario (un solo admin). **No existe registro de clientes, ni login de anunciantes, ni panel de usuario cliente.** Todo el contenido lo sube y modifica el administrador.

Promociona Empresas, Negocios, Profesionales, Productos y Servicios a nivel Local, Nacional e Internacional, y soporta una cantidad ilimitada de anuncios sin degradar el rendimiento.

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
- Vistas: `views/` (EJS), browser: `public/js/`, estilos: `public/css/styles.css`, esquema: `database.sql`.
- Orden de rutas en `backend/server.js`: **sitemap → auth → admin → public**.

## Reglas de negocio que NO se deben romper
- **Máximo 11 fotos** por anuncio.
- **6 ediciones gratis** por anuncio: cada `PUT /api/admin/anuncios/:id` incrementa `anuncios.cambios_usados` y registra en `cambios_log`.
- Los anuncios **expiran a los 12 meses**. El cron diario (`services/cron.service.js`) marca vencidos y notifica 30 días antes.
- **Cualquier cambio en controladores admin debe llamar a `invalidatePublicCache()`.**
- Un solo admin en cookie httpOnly (`/admin/login`). Sin registro de clientes.

## Rutas clave
- **Server-rendered:** `/`, `/resultados`, `/anuncio/:slug`, `/contacto`, y `/nosotros` (+ subpáginas `/nosotros/quienes-somos`, `/nosotros/terminos`, `/nosotros/privacidad`). Antiguas URLs hacen 301 a las nuevas.
- **Resultados:** buscador flotante envía a `/resultados`. Soporta `?q=`, `?ciudad=`, `?categoria=`, `?departamento=`.
- **Ficha de anuncio:** galería responsive, contacto directo por WhatsApp al anunciante (`wa.me`), llamada telefónica, email y botón para compartir.

## Mejoras de consistencia y responsive (2026-10-26)
- **Storage:** corrección de `fs.unlink` asíncrono usando `fsp.unlink` en `storage.service.js`. `saveBuffer` organiza imágenes en subcarpeta `anuncios/` y convierte a WebP con `sharp`.
- **Modo oscuro en header:** sincronización correcta de iconos Sol/Luna en desktop y móvil (Sol en modo oscuro para volver a claro; Luna en modo claro).
- **Navegación de categorías:** enlaces de "Todas las categorías", migas de pan y footer ahora dirigen a `/resultados?categoria=...` (en vez de `/` que no listaba anuncios).
- **Página `/resultados`:** barra de categorías rápida (chips horizontales scrolleables), badges de filtros activos con botón para remover uno a uno, título dinámico según búsqueda/categoría/ciudad y paginación responsive.
- **Ficha `/anuncio/:slug`:** botón directo "Chatear por WhatsApp" con el teléfono del anunciante + botón "Compartir por WhatsApp".
- **Panel Admin:** inputs de fecha (`fecha_inicio`, `fecha_vencimiento`) ahora formatean `YYYY-MM-DD` sin truncar en blanco; eliminación del doble `append` de archivos en `FormData`; tabla con scroll horizontal suave (`min-w-[720px]`) para visualización cómoda en móviles.

## Fix ENOENT uploads/anuncios en Pxxl (2026-10-26)
- **Causa raíz:** en Pxxl el repo se clona en `/workspace/app`; como `public/uploads/anuncios/` estaba en `.gitignore`, la carpeta no existía y `mkdir` fallaba al intentar subir fotos.
- **Solución:**
  1. Se creó `public/uploads/anuncios/.gitkeep` y se exceptuó en `.gitignore`.
  2. `storage.service.js` ahora normaliza `UPLOAD_DIR` (quita slashes y prefijo `public/` duplicado), y crea la jerarquía `public → uploads → anuncios` con `{ recursive: true }` al cargar el módulo.
  3. `server.js` importa y llama `ensureUploadDirs()` durante el bootstrap como doble seguridad.
- **Para desplegar:** hacer `git add . && git commit && git push` — Pxxl redespliega automáticamente desde `origin/main`.

## Comandos
- `npm run dev` / `npm start` — nodemon / node plano, entry `backend/server.js`
- `npm run build` — no-op (`node --check backend/server.js`) para PaaS
- `npm run db:init` / `db:load` / `db:seed` / `db:reset`?
?
## Fix guardado de fotos (2026-10-27)
- **Causa raiz:** `saveBuffer` en `backend/services/storage.service.js` tenia cadena de fallbacks (escritura directa -> tmp dir + copy) y catch final que enmascaraba el error real, lanzando generico "No se pudo guardar la imagen por permisos...".
- **Solucion:** se elimino el fallback complejo y se reescribio el guardado local directo (mkdir recursive + chmod + icacls best-effort en Windows + fsp.writeFile). El error ahora incluye la causa real (`No se pudo guardar la imagen en <path>: <err>`).
- **Verificado:** `saveBuffer` probado con JPG real (sharp + escritura OK) en entorno Linux.

## Fix guardado de fotos restaurado (2026-10-29)
- **Causa raiz:** commits 9e687b2+1b7915f reemplazaron el guardado fisico de imagenes por Base64 Data URI en storage.service.js; el INSERT a otos.url VARCHAR(500) fallaba por longitud y rompia las subidas.
- **Solucion:** se elimino el bloque Base64 y se restauro el guardado local (sharp->webp, fsp.writeFile en public/uploads/anuncios/, deleteByUrl y ensureUploadDirs operativos).
- **Verificado:** 
ode --check, modulo storage carga y save/delete OK.
## Fix EACCES uploads en Linux/Pxxl (2026-10-29)
- **Causa raiz:** tras el cambio a guardado fisico, setPermisos solo aplicaba icacls en Windows; en Linux/Pxxl no habia rama else, por lo que public/uploads/anuncios/ quedaba sin permisos de escritura -> EACCES al subir.
- **Solucion:** rama else con s.chmodSync(dir, 0o777) best-effort en storage.service.js.