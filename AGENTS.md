# AGENTS.md — DirectorioCerca

Single-admin business directory. Node 18+ / Express 4, EJS server-rendered for SEO, PostgreSQL, vanilla JS + Tailwind (CDN) on the frontend. `README.md` is the fuller (Spanish) reference; keep it in sync when behavior changes.

## Commands
- `npm run dev` / `npm start` — nodemon / plain node, entry `backend/server.js`.
- `npm run db:init` — creates the DB (if missing) and runs `database.sql`.
- `npm run db:seed` — creates the single admin + 3 sample listings.
- `npm run db:reset` — `db:init` + `db:seed`.
- `npm run lint` — **only runs `node --check backend/server.js`.** It does NOT check the rest of the codebase.

## Critical gotchas
- **`database.sql` begins with `DROP TABLE ... CASCADE`.** `npm run db:init` destroys all existing data. Seeding is idempotent (admin by email, listings by slug are skipped if present).
- **Test framework and ESLint are not installed** (the `eslint-disable` comments are inert). Before finishing a change, syntax-check every file you touched with `node --check <file>`; lint alone is not enough.
- **Git repo** with remote `origin` → GitHub `Jomar71/midirectoriocerca` (`main`). A real `.env` is present at the repo root and is gitignored — never print or commit its secrets.
- Deployed on **Pxxl** (`app.pxxl.app`): pipeline install → build → start → health check. Config: install `npm install`, build `npm run build` (no-op), start `npm start`, health check `GET /health`. Server binds `0.0.0.0` and reads `PORT`. A failed deploy shows on GitHub as a failed commit check (a red X), not a Git problem.
- **All env access goes through `backend/config/env.js`** (it loads `.env` from the repo root). Do not read `process.env` directly elsewhere.
- **DB access goes through `backend/config/db.js`** (`query`, `pool`, `withTransaction`). Always use parameterized queries (`$1`, `$2`), never string interpolation.
- `STORAGE_DRIVER` only supports `local`; `cloudinary`/`s3` are stubs that throw. Local uploads land in `public/uploads/` (gitignored).
- Redirects/cookies assume `NODE_ENV=production` for `secure` cookies, `trust proxy`, and HSTS — set it on the VPS.

## Architecture
- Layers: `routes/` → `controllers/` → `models/` (SQL) → `services/` (storage, mail, cron, csv, seo) and `middlewares/`. Views in `views/` (EJS), browser code in `public/js/`, schema/categories in `database.sql`.
- Route mount order in `backend/server.js` matters: sitemap → auth → admin → public.
- Colombia geography: tables `departamentos` (33, with `capital`) and `ciudades` (1122 DANE DIVIPOLA municipalities) are seeded by `database.sql`; model in `backend/models/ubicacion.model.js`. Home has Department→City dependent filters (`public/js/index.js`); `/api/ubicaciones` returns `{departamentos, ciudades, paises}` and supports `?departamento=<slug>`. Department matching is accent-tolerant (`unaccent(lower(...))` plus the part before the comma) so legacy free-text cities (e.g. "Bogotá") still match the catalog ("Bogotá, D.C."). Cundinamarca's capital is Bogotá (a separate entity), so it has no `es_capital` municipality.
- The admin panel is one page (`views/admin-panel.ejs`) driven by `public/js/admin-panel.js` calling `/api/admin/*`. All `/api/admin/*` routes require the admin JWT (`middlewares/auth.js`); HTML pages use `requireAdminPage`.
- Auth is a single admin with a JWT in an httpOnly cookie. There is no customer/anunciante registration — do not add one.
- Server-rendered pages live in `public.routes.js` (`/`, `/anuncio/:slug`); read-only API is `/api/anuncios`, `/api/categorias`, `/api/ubicaciones`.

## Business rules to preserve
- Max **11 photos** per listing (`fotoModel` / `saveUploadedFotos`).
- **6 free edits** per listing: each `PUT /api/admin/anuncios/:id` increments `anuncios.cambios_usados` and logs to `cambios_log`.
- Listings expire after **12 months**; `services/cron.service.js` (daily, `CRON_DAILY`) marks expired ones and emails a warning `EXPIRY_WARNING_DAYS` (30) days ahead.
- Public cache is Redis-backed but optional; changes in admin controllers must call `invalidatePublicCache()`.

## Frontend/CSP
- Tailwind and Google Translate load from CDNs. Adding any new external script/style/frame domain requires editing the `helmet` `contentSecurityPolicy` in `backend/server.js`.
- Public pagination is capped at 20/page; full-text search uses the weighted `search_vector` plus `pg_trgm` indexes.

## Mail
`MAIL_TRANSPORT`: `json` (default — prints to console, no send), `ethereal` (test inbox), `smtp` (real). See `.env.example`.

## Memoria
- Al empezar, lee `MEMORY.md` para conocer el estado del proyecto y las decisiones tomadas.
- Al terminar una tarea, actualízalo: estado actual, decisiones importantes (con su porqué) y errores a evitar.
- Mantenlo breve (máximo ~50 líneas): resume o elimina lo que ya no aporte.
- Si algo se convierte en una regla permanente, propón moverlo a `AGENTS.md` en lugar de dejarlo en la memoria.
- No guardes nunca datos sensibles (claves, tokens, datos personales).