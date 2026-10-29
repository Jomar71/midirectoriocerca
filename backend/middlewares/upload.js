/**
 * middlewares/upload.js
 * Configuración de Multer (en memoria) para subir hasta 11 fotografías.
 * El guardado físico lo realiza services/storage.service.js (local o CDN).
 */
'use strict';

const os = require('os');
const path = require('path');

const multer = require('multer');
const env = require('../config/env');

const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith('image/')) return cb(null, true);
  return cb(new Error('Formato de imagen no permitido.'));
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: (env.storage.maxMb || 8) * 1024 * 1024,
    files: 11,
    fieldSize: 50 * 1024 * 1024,
  },
  fileFilter,
});

/** Sube el campo "fotos" (hasta 11). Acepta también un único campo "foto". */
const fotosUpload = upload.fields([
  { name: 'fotos', maxCount: 11 },
  { name: 'foto', maxCount: 1 },
]);

module.exports = { upload, fotosUpload };
