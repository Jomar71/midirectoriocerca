/**
 * services/storage.service.js
 * Abstracción de almacenamiento de imágenes.
 * Implementa el driver "local". Los drivers "cloudinary" y "s3" quedan
 * preparados para conectar sin cambiar el resto del código.
 */
'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');

const cleanUploadDir = (env.storage.uploadDir || 'uploads')
  .replace(/^[\\/]+/, '')
  .replace(/^public[\\/]+/, '')
  .replace(/[\\/]+$/, '');

const PUBLIC_DIR = path.resolve(__dirname, '..', '..', 'public');
const UPLOAD_ABS = path.resolve(PUBLIC_DIR, cleanUploadDir || 'uploads');

function ensureDirSync(dir) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o777 });
    }
  } catch (e) {
    console.warn(`[storage] Advertencia al crear carpeta ${dir}:`, e.message);
  }
}

function ensureUploadDirs() {
  ensureDirSync(PUBLIC_DIR);
  ensureDirSync(UPLOAD_ABS);
  ensureDirSync(path.join(UPLOAD_ABS, 'anuncios'));
}

// Inicializar carpetas al cargar el módulo
ensureUploadDirs();

/** Guarda un buffer y devuelve { url, publicId }. */
async function saveBuffer(buffer, originalName, folder = 'anuncios') {
  const driver = env.storage.driver;
  if (driver === 'cloudinary' || driver === 's3') {
    throw new Error(`El driver de almacenamiento "${driver}" no está configurado. Usa STORAGE_DRIVER=local.`);
  }

  const uploadDirName = cleanUploadDir || 'uploads';
  const subfolder = (folder || 'anuncios').replace(/^[\\/]+/, '').replace(/[\\/]+$/, '');
  const targetDir = path.resolve(UPLOAD_ABS, subfolder);
  ensureDirSync(targetDir);

  const uuid = uuidv4();
  const date = new Date().toISOString().split('T')[0];
  const filename = `${date}-${uuid}.webp`;
  const filePath = path.join(targetDir, filename);

  // Convertir a WebP con calidad 80 usando sharp
  await sharp(buffer)
    .webp({ quality: 80 })
    .toFile(filePath);

  const rel = `${subfolder}/${filename}`;
  const publicId = `${uploadDirName}/${rel}`;
  const url = `/${uploadDirName}/${rel}`;
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
    await fsp.unlink(abs);
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('[storage] No se pudo borrar:', publicId);
  }
}

/** Elimina un archivo a partir de su URL pública (/uploads/...). */
async function deleteByUrl(url) {
  if (!url || !url.startsWith(`/${env.storage.uploadDir}/`)) return;
  return deleteByPublicId(url.replace(/^\//, ''));
}

module.exports = { saveBuffer, deleteByPublicId, deleteByUrl, ensureUploadDirs };
