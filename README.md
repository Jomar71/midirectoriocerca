# DirectorioCerca

Directorio empresarial en línea, escalable y listo para producción. Sitio **público** para visitantes y **panel privado** para un **único administrador** (el propietario).

- **Stack:** Node.js + Express · EJS (SEO server-side) · PostgreSQL · Tailwind CSS (CDN) · Nodemailer · node-cron.
- **Público:** buscador (palabra clave + ciudad), fichas de anuncio con galería, mapa, redes, traducción, WhatsApp, formulario de contacto y páginas legales (`/nosotros`, `/terminos`, `/privacidad`, `/contacto`) enlazadas desde el menú superior.
- **Geografía:** catálogo oficial DANE de los 33 departamentos y 1.122 municipios de Colombia, con sus capitales.
- **Privado:** un solo usuario administrador gestiona todo: anuncios, fotos, categorías, mensajes, vencimientos e importación CSV masiva.

---

## Características del anuncio (14/14)

1. Galería de hasta **11 fotografías** con lightbox.
2. **Portafolio empresarial** (~50 palabras).
3. Datos direccionales, teléfonos fijo y móvil, correos.
4. Enlaces a **web, YouTube, Facebook, Instagram, TikTok**.
5. **Formulario de contacto** (secretaría 24/7) que envía **correo real**.
6. **SEO**: metaetiquetas, Open Graph, Twitter Card y **Schema.org LocalBusiness**.
7. **Mapa geosatelital** (Google Maps Embed).
8. **Traducción** a todos los idiomas (Google Translate Widget).
9. **10 palabras clave** de búsqueda.
10. **6 cambios** gratis por anuncio (contador + auditoría en el panel).
11. Botón para **compartir por WhatsApp**.
12. **PWA** (manifest + service worker, instalable en móvil).
13. **Asistencia 24/7** (formulario de contacto, email y WhatsApp).
14. **Vencimiento a 12 meses** con aviso al admin 1 mes antes y renovación/deshabilitación manual.

---

## Requisitos

- **Node.js 18+** (probado con Node 24).
- **PostgreSQL 12+**.
- (Opcional) **Redis** para caché.

---

## Instalación local

```bash
# 1) Instalar dependencias
npm install

# 2) Crear el archivo de entorno
copy .env.example .env       # Windows
# cp .env.example .env       # Linux/Mac
# Edita .env con tus datos de PostgreSQL y correo.

# 3) Crear la base de datos, tablas e índices
npm run db:init

# 4) Crear el administrador único y 3 anuncios de ejemplo
npm run db:seed

# 5) Arrancar
npm run dev      # desarrollo (nodemon)
npm start        # producción
```

Abre `http://localhost:3000`.
Panel de administración: `http://localhost:3000/admin/login` (acceso solo por URL directa; no hay enlace en el sitio y el panel redirige al login sin sesión de admin).

**Credenciales por defecto** (cámbialas en `.env` antes de `db:seed`):

```
Email:      admin@directoriocerca.com
Contraseña: Admin123!
```

---

## Configuración del correo (envío real)

En `.env` define `MAIL_TRANSPORT`:

- `json` (por defecto): no envía, imprime el correo en consola — para desarrollo.
- `ethereal`: crea una cuenta de prueba **gratis** y muestra una URL para ver el correo.
- `smtp`: envío real. Completa `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` y `ADMIN_EMAIL`.
  Ejemplos de proveedores: Gmail (App Password), Brevo, SendGrid, Mailgun, Zoho.

---

## Almacenamiento de imágenes

Por defecto `STORAGE_DRIVER=local` guarda en `public/uploads/anuncios/` (gratis, ideal para probar).
Si esa carpeta no es escribible (por ejemplo en Pxxl o un sistema de solo lectura), se usa
automáticamente `<proyecto>/uploads/` o `os.tmpdir()/directoriocerca/uploads/`, y todas se sirven
en `/uploads`. También puedes fijar una ruta absoluta persistente con `UPLOAD_DIR`.
La abstracción en `backend/services/storage.service.js` permite conectar **Cloudinary** o **S3**
cambiando `STORAGE_DRIVER` y las credenciales, sin tocar el resto del código.

---

## Caché (opcional)

Activa Redis con `REDIS_ENABLED=true` y `REDIS_URL=...`. Acelera la API pública de solo lectura.
Si Redis no está disponible, el sistema funciona igual sin caché.

---

## Geografía de Colombia (departamentos y ciudades)

El directorio incluye el **catálogo oficial DANE – DIVIPOLA**: los **33 departamentos** con su **capital** y los **1.122 municipios** (código, tipo y coordenadas), cargados por `npm run db:init`.

- **Público:** en la portada, el buscador tiene "¿Qué buscas?" (palabra clave) y "¿Dónde?" (ciudad, autocompletado con el catálogo). Los filtros por URL (`?categoria=`, `?departamento=`, `?ciudad=`) siguen disponibles; `?ciudad=` acepta coincidencia parcial y sin acentos.
- **Admin:** al crear/editar un anuncio puedes elegir el departamento y la ciudad/municipio (autocompletado desde el catálogo), manteniendo la libertad de texto para otros países.
- **API:** `/api/ubicaciones` devuelve `departamentos`, `ciudades` y `paises`; con `?departamento=<slug>` devuelve solo ese departamento y sus ciudades.
- **Búsqueda:** `/?departamento=<slug>` filtra los anuncios del departamento (coincidencia tolerante sin acentos).
- Caso especial: la capital de **Cundinamarca** es Bogotá (entidad aparte), por lo que el catálogo la registra como tal y no asigna municipio capital propio.

---

## Estructura del proyecto

```
directoriocerca/
├── database.sql               # Esquema, índices, categorías y catálogo de Colombia (DANE)
├── .env.example
├── package.json
├── public/                    # Estáticos: css, js, img, uploads, PWA, plantilla CSV
├── views/                     # Plantillas EJS (index, anuncio, admin-*, 404, error)
└── backend/
    ├── server.js              # Punto de entrada
    ├── config/                # env, db (PostgreSQL), redis
    ├── controllers/           # Lógica de cada recurso
    ├── models/                # Consultas SQL parametrizadas
    ├── middlewares/           # auth (JWT), rate-limit, upload, cache, errores
    ├── routes/                # public, auth, admin, sitemap
    ├── services/              # storage, mail, cron, csv, seo
    ├── scripts/               # init-db.js, seed.js
    └── utils/                 # slug, paginación, saneamiento
```

---

## Importación masiva por CSV

En el panel → **Importar CSV**. Cabeceras:

```
razon_social, descripcion_50, direccion, telefono_fijo, telefono_movil, email,
sitio_web, youtube, facebook, instagram, tiktok, categoria, ciudad, pais,
latitud, longitud, palabras_clave, fecha_inicio, fecha_vencimiento, fotos
```

- Campos obligatorios: `razon_social`, `descripcion_50`.
- `fotos`: URLs separadas por `|` (máx. 11).
- `categoria`: slug o nombre de una categoría existente.
- Plantilla descargable: `/templates/anuncios-plantilla.csv`.

---

## Automatización (cron)

`backend/services/cron.service.js` corre a diario (`CRON_DAILY`):

- Marca como **vencido** los anuncios con `fecha_vencimiento < hoy`.
- Envía al administrador un **aviso 30 días antes** del vencimiento.

El administrador decide manualmente **renovar** (12 meses) o **deshabilitar** desde el panel.

---

## SEO

- URLs amigables: `/anuncio/nombre-empresa`.
- `sitemap.xml` dinámico y `robots.txt`.
- Metaetiquetas, Open Graph, Twitter Card y **JSON-LD LocalBusiness** por anuncio (renderizados en el servidor).

---

## Seguridad

- Un **único administrador** (sin registro de clientes ni login de anunciantes).
- Contraseña con **bcrypt**; sesión con **JWT** en cookie **httpOnly**.
- **Rate limiting** en login y formulario de contacto.
- Validación y saneamiento de entradas; consultas **parametrizadas** (anti SQL Injection) y escape en plantillas (anti XSS).
- Variables de entorno en `.env` (fuera del repositorio).

---

## Despliegue en VPS (producción)

```bash
# En el servidor
git clone <tu-repo> && cd directoriocerca
npm ci --omit=dev
cp .env.example .env   # edita valores reales (NODE_ENV=production, APP_URL, credenciales)

npm run db:init
npm run db:seed        # opcional (solo la primera vez)

# Gestor de procesos
npm install -g pm2
pm2 start backend/server.js --name directoriocerca
pm2 save && pm2 startup
```

Proxy inverso con **Nginx** (recomendado para HTTPS y estáticos):

```nginx
server {
  listen 80;
  server_name directoriocerca.com www.directoriocerca.com;

  client_max_body_size 90M;   # subida de hasta 11 fotos

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Con `NODE_ENV=production` el servidor activa `trust proxy`, cookies `secure` y CSP con HSTS.

---

## Despliegue en Pxxl (u otras PaaS)

Pxxl construye con el pipeline **install → build → start** y luego hace un **health check**. Configura así el proyecto:

| Ajuste           | Valor                                            |
| ---------------- | ------------------------------------------------ |
| Install command  | `npm install`                                    |
| Build command    | `npm run build` (no-op: solo verifica sintaxis)  |
| Start command    | `npm start`                                      |
| Puerto           | el que asigne Pxxl (la app lee `PORT`)           |
| Health check     | `/health` (responde `200` sin tocar la BD)       |

**Secretos** obligatorios en el panel (no van en el repo): `NODE_ENV=production`, `JWT_SECRET`, `APP_URL` (tu dominio público), `DATABASE_URL` (cadena del Postgres gestionado) y `PGSSL=true`.

> El servidor escucha en `0.0.0.0` y lee `PORT`, requisito de las PaaS. Antes de la primera petición hay que aplicar `database.sql` sobre la base provisionada: copia la cadena de conexión de Pxxl y ejecuta desde tu máquina `DATABASE_URL=... PGSSL=true npm run db:load` (no uses `db:init`, intenta crear la base y en un Postgres gestionado no está permitido).

---

## Escalabilidad

- Paginación obligatoria (máx. 20 por página en el listado público).
- Índices **GIN** sobre `tsvector` ponderado + `pg_trgm` para búsquedas difusas.
- Índices B-tree en `categoria_id`, `(ciudad, pais)`, `estado`, `fecha_vencimiento` y `ciudades (departamento_id, nombre)`.
- Lazy loading de imágenes y caché Redis opcional.
- Almacenamiento de imágenes abstraído para CDN.
- Arquitectura en capas (config/models/services/controllers) para escalar sin reescribir.

---

## Scripts npm

| Script         | Descripción                                             |
| -------------- | ------------------------------------------------------- |
| `npm start`    | Inicia el servidor (producción).                        |
| `npm run dev`  | Inicia con recarga automática (nodemon).                |
| `npm run build` | Verifica sintaxis de `server.js` (build no-op para PaaS). |
| `npm run db:init`  | Crea la BD y aplica `database.sql`.                 |
| `npm run db:load`  | Aplica `database.sql` sobre `DATABASE_URL` (BD en la nube, sin crear la BD). |
| `npm run db:seed`  | Crea el admin y 3 anuncios de ejemplo.             |
| `npm run db:reset` | `db:init` + `db:seed`.                              |
| `npm run lint` | Verificación de sintaxis de `server.js`.                |

---

## Licencia

MIT.
