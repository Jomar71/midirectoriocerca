/**
 * services/storage.service.js
 * Abstracción de almacenamiento de imágenes.
 * Implementa el driver "local". Los drivers "cloudinary" y "s3" quedan
 * preparados para conectar sin cambiar el resto del código.
 */
'use strict';

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');

const PUBLIC_DIR = path.resolve(__dirname, '..', '..', 'public');
const UPLOAD_ABS = path.join(PUBLIC_DIR, env.storage.uploadDir);

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function safeName(original) {
  const ext = (path.extname(original || '') || '.jpg').toLowerCase().replace(/[^.a-z0-9]/g, '');
  const rand = crypto.randomBytes(8).toString('hex');
  return `${Date.now()}-${rand}${ext || '.jpg'}`;
}

/** Guarda un buffer y devuelve { url, publicId }. */
async function saveBuffer(buffer, originalName, folder = 'anuncios') {
  const driver = env.storage.driver;
  if (driver === 'cloudinary' || driver === 's3') {
    // Punto de extensión: integrar SDK correspondiente con las credenciales de .env.
    throw new Error(`El driver de almacenamiento "${driver}" no está configurado. Usa STORAGE_DRIVER=local.`);
  }

  // Driver local
  const dir = path.join(UPLOAD_ABS, folder);
  await ensureDir(dir);
  const filename = safeName(originalName);
  await fs.writeFile(path.join(dir, filename), buffer);

  const publicId = `${env.storage.uploadDir}/${folder}/${filename}`;
  const url = `/${env.storage.uploadDir}/${folder}/${filename}`;
  return { url, publicId };
}

/** Elimina un archivo a partir de su publicId (ruta relativa a /public). */
async function deleteByPublicId(publicId) {
  if (!publicId) return;
  const driver = env.storage.driver;
  if (driver !== 'local') {
    console.warn('[storage] Borrado no implementado para driver:', driver);
    return;
  }
  const abs = path.join(PUBLIC_DIR, publicId);
  // Seguridad: evita salir del directorio de subidas
  if (!abs.startsWith(UPLOAD_ABS)) return;
  try {
    await fs.unlink(abs);
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('[storage] No se pudo borrar:', publicId);
  }
}

/** Elimina un archivo a partir de su URL pública (/uploads/...). */
async function deleteByUrl(url) {
  if (!url || !url.startsWith(`/${env.storage.uploadDir}/`)) return;
  return deleteByPublicId(url.replace(/^\//, ''));
}

module.exports = { saveBuffer, deleteByPublicId, deleteByUrl };
