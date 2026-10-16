/**
 * config/env.js
 * Centraliza la lectura y validación de variables de entorno.
 * Cualquier módulo del backend debe importar la configuración desde aquí.
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const bool = (v, def = false) =>
  v === undefined ? def : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());

const num = (v, def) => (v === undefined || v === '' ? def : Number(v));

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  port: num(process.env.PORT, 3000),
  appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),

  jwt: {
    secret: process.env.JWT_SECRET || 'cambia_este_secreto',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    cookieName: process.env.COOKIE_NAME || 'dc_admin_token',
  },

  db: {
    connectionString: process.env.DATABASE_URL || null,
    host: process.env.PGHOST || 'localhost',
    port: num(process.env.PGPORT, 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'directoriocerca',
    ssl: bool(process.env.PGSSL, false) ? { rejectUnauthorized: false } : false,
  },

  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
    maxMb: num(process.env.UPLOAD_MAX_MB, 8),
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
      apiKey: process.env.CLOUDINARY_API_KEY || '',
      apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    },
    s3: {
      region: process.env.AWS_REGION || '',
      bucket: process.env.AWS_BUCKET || '',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  },

  redis: {
    enabled: bool(process.env.REDIS_ENABLED, false),
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    ttl: num(process.env.REDIS_TTL_SECONDS, 60),
  },

  mail: {
    transport: process.env.MAIL_TRANSPORT || 'json', // smtp | json | ethereal
    host: process.env.MAIL_HOST || '',
    port: num(process.env.MAIL_PORT, 587),
    secure: bool(process.env.MAIL_SECURE, false),
    user: process.env.MAIL_USER || '',
    pass: process.env.MAIL_PASS || '',
    from: process.env.MAIL_FROM || 'DirectorioCerca <no-reply@directoriocerca.com>',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@directoriocerca.com',
  },

  seed: {
    adminName: process.env.SEED_ADMIN_NAME || 'Propietario',
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@directoriocerca.com',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin123!',
  },

  cron: {
    tz: process.env.CRON_TZ || 'America/Caracas',
    daily: process.env.CRON_DAILY || '0 3 * * *',
    expiryWarningDays: num(process.env.EXPIRY_WARNING_DAYS, 30),
  },
};

module.exports = env;
