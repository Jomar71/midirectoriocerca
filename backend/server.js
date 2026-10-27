/**
 * server.js
 * Punto de entrada: configuración de Express, seguridad, vistas, rutas
 * y arranque de servicios (BD, caché, correo, cron).
 */
'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const env = require('./config/env');
const { testConnection } = require('./config/db');
const { initRedis } = require('./config/redis');
const mailService = require('./services/mail.service');
const { startCron } = require('./services/cron.service');
const { ensureUploadDirs } = require('./services/storage.service');

const publicRoutes = require('./routes/public.routes');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const sitemapRoutes = require('./routes/sitemap.routes');
const { notFound, errorHandler } = require('./middlewares/error');

const app = express();

// ── Confianza en proxy (nginx, VPS, Heroku...) ──────────────────────────
if (env.isProd) app.set('trust proxy', 1);

// ── Motor de vistas EJS (SEO server-side) ───────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// ── Seguridad ───────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", "'unsafe-inline'",
        'https://cdn.tailwindcss.com',
        'https://translate.google.com', 'https://translate.googleapis.com',
        'https://www.google.com', 'https://www.gstatic.com',
      ],
      scriptSrcElem: [
        "'self'", "'unsafe-inline'",
        'https://cdn.tailwindcss.com',
        'https://translate.google.com', 'https://translate.googleapis.com',
        'https://www.google.com', 'https://www.gstatic.com',
      ],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.tailwindcss.com', 'https://translate.googleapis.com', 'https://www.gstatic.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'https://translate.googleapis.com'],
      workerSrc: ["'self'", 'blob:'],
      frameSrc: ["'self'", 'https://www.google.com', 'https://maps.google.com', 'https://www.youtube.com', 'https://translate.google.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: env.isProd ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── Middlewares generales ───────────────────────────────────────────────
app.use(compression());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
if (!env.isProd) app.use(morgan('dev'));

// ── Archivos estáticos ──────────────────────────────────────────────────
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR, {
  maxAge: env.isProd ? '7d' : 0,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.webmanifest')) res.setHeader('Content-Type', 'application/manifest+json');
  },
}));

// ── Vendor: shaders (ESM autocontenido) servido al navegador ──────────────
// Solo dist/ (el build ESM). Se carga de forma diferida desde el cliente.
const SHADERS_DIST = path.join(__dirname, '..', 'node_modules', 'shaders', 'dist');
app.use('/vendor/shaders', express.static(SHADERS_DIST, {
  maxAge: '30d',
  immutable: true,
  index: false,
  setHeaders: (res) => { res.setHeader('Content-Type', 'text/javascript; charset=utf-8'); },
}));

// ── Health check (Pxxl y balanceadores) ─────────────────────────────────
app.get('/health', (_req, res) => res.status(200).json({ ok: true, uptime: process.uptime() }));

// ── Rutas ───────────────────────────────────────────────────────────────
app.use(sitemapRoutes);
app.use(authRoutes);
app.use(adminRoutes);
app.use(publicRoutes);

// ── Manejo de errores ───────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Arranque ────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    const now = await testConnection();
    console.log(`[db] Conectado a PostgreSQL (${now.toISOString()}).`);
  } catch (e) {
    console.error('[db] No se pudo conectar a PostgreSQL:', e.message);
    console.error('     Revisa tu .env y que la base de datos exista (npm run db:init).');
  }

  ensureUploadDirs();
  await initRedis();
  try { await mailService.initMailer(); } catch (e) { console.warn('[mail]', e.message); }
  startCron();

  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`[server] DirectorioCerca corriendo en ${env.appUrl} (puerto ${env.port}).`);
  });

  const shutdown = () => {
    console.log('\n[server] Cerrando...');
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();

module.exports = app;
