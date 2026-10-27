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
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') {
      console.warn(`[storage] Advertencia al crear carpeta ${dir}:`, e.message);
    }
  }
  try {
    try { fs.chmodSync(dir, 0o777); } catch (e) {}
    try { require('child_process').execSync(`icacls "${dir}" /grant Everyone:F /T`, { stdio: 'ignore' }); } catch (e) {}
    try { require('child_process').execSync(`icacls "${dir}" /grant Users:F /T`, { stdio: 'ignore' }); } catch (e) {}
  } catch (e) {
    console.warn(`[storage] No se pudo establecer permisos en ${dir}:`, e.message);
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

  ensureDirSync(targetDir);

  let webpBuffer;
  try {
    webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();
  } catch (e) {
    throw new Error('No se pudo procesar la imagen. Asegúrate de que sea un archivo válido.');
  }

  let written = false;
  try {
    await fsp.writeFile(filePath, webpBuffer, { mode: 0o666 });
    try { fs.chmodSync(filePath, 0o666); } catch (e) {}
    written = true;
  } catch (e) {
    console.warn('[storage] writeFile falló:', e.message);
  }

  if (!written) {
    try {
      const stream = fs.createWriteStream(filePath, { mode: 0o666 });
      stream.end(webpBuffer);
      await new Promise((res, rej) => { stream.on('finish', res); stream.on('error', rej); });
      try { fs.chmodSync(filePath, 0o666); } catch (e) {}
      written = true;
    } catch (e) {
      console.warn('[storage] stream falló:', e.message);
    }
  }

  if (!written) {
    try {
      const tmpDir = path.join(process.env.TEMP || process.env.TMP || process.cwd(), 'dc-uploads-tmp');
      ensureDirSync(tmpDir);
      const tmpFile = path.join(tmpDir, filename);
      await fsp.writeFile(tmpFile, webpBuffer, { mode: 0o666 });
      try {
        await fsp.rename(tmpFile, filePath);
        written = true;
      } catch (e) {
        try {
          await fsp.copyFile(tmpFile, filePath);
          await fsp.unlink(tmpFile).catch(() => {});
          written = true;
        } catch (e2) {
          await fsp.unlink(tmpFile).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('[storage] tmp falló:', e.message);
    }
  }

  if (!written) {
    throw new Error('No se pudo guardar la imagen por permisos. Verifica los permisos de la carpeta public/uploads.');
  }

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
