/**
 * services/storage.service.js
 * Abstraccion de almacenamiento de imagenes.
 * Implementa el driver "local". Los drivers "cloudinary" y "s3" quedan
 * preparados para conectar sin cambiar el resto del codigo.
 */
'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');

const cleanUploadDir = (env.storage.uploadDir || 'uploads')
  .replace(/^[\\/]+/, '')
  .replace(/^public[\\/]+/, '')
  .replace(/[\\/]+$/, '');

const PUBLIC_DIR = path.resolve(__dirname, '..', '..', 'public');
const UPLOAD_ABS = path.resolve(PUBLIC_DIR, cleanUploadDir || 'uploads');

const IS_WINDOWS = process.platform === 'win32';

function setPermisos(dir) {
  // Se elimina fs.chmodSync que causaba error en el archivo
  if (IS_WINDOWS) {
    try { require('child_process').execSync(`icacls "${dir}" /grant Everyone:F /T`, { stdio: 'ignore', windowsHide: true }); } catch (e) {}
  } else {
    // Best-effort en Linux/Pxxl: evitar EACCES al guardar uploads.
    try { fs.chmodSync(dir, 0o777); } catch (e) {}
  }
}

function ensureDirSync(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') {
      console.warn(`[storage] Advertencia al crear carpeta ${dir}:`, e.message);
    }
  }
  try { setPermisos(dir); } catch (e) {
    console.warn(`[storage] No se pudo establecer permisos en ${dir}:`, e.message);
  }
}

function ensureUploadDirs() {
  ensureDirSync(PUBLIC_DIR);
  ensureDirSync(UPLOAD_ABS);
  ensureDirSync(path.join(UPLOAD_ABS, 'anuncios'));
}

// Inicializar carpetas al cargar el modulo
ensureUploadDirs();

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/pjpeg': '.jpg',
  'image/png': '.png',
  'image/apng': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/bmp': '.bmp',
  'image/x-ms-bmp': '.bmp',
  'image/tiff': '.tiff',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/jxl': '.jxl',
  'image/x-canon-cr2': '.cr2',
  'image/x-adobe-dng': '.dng',
};

/** Obtiene una extension segura a partir del nombre o del MIME. */
function resolveExtension(originalName, mimetype) {
  const raw = path.extname(originalName || '').toLowerCase();
  const clean = raw.replace(/^\./, '').replace(/[^a-z0-9]/g, '');
  if (clean && clean.length <= 10) return clean === 'jpeg' ? '.jpg' : `.${clean}`;
  return MIME_EXT[(mimetype || '').toLowerCase()] || '.jpg';
}

/** Guarda un buffer y devuelve { url, publicId }. */
async function saveBuffer(buffer, originalName, folder = 'anuncios', mimetype = '') {
  const driver = env.storage.driver;
  if (driver === 'cloudinary' || driver === 's3') {
    throw new Error(`El driver de almacenamiento "${driver}" no esta configurado. Usa STORAGE_DRIVER=local.`);
  }

  const uploadDirName = cleanUploadDir || 'uploads';
  const subfolder = (folder || 'anuncios').replace(/^[\\/]+/, '').replace(/[\\/]+$/, '');
  const targetDir = path.resolve(UPLOAD_ABS, subfolder);
  ensureDirSync(targetDir);

  const uuid = uuidv4();
  const date = new Date().toISOString().split('T')[0];
  const ext = resolveExtension(originalName, mimetype);
  const filename = `${date}-${uuid}${ext}`;
  const filePath = path.join(targetDir, filename);

  const cp = require('child_process');
  const writeToPath = async (p) => {
    await fsp.writeFile(p, buffer);
    // Se elimina fs.chmodSync que causaba error en el archivo
    if (IS_WINDOWS) {
      try { cp.execSync(`icacls "${p}" /grant Everyone:F`, { stdio: 'ignore', windowsHide: true }); } catch (e) {}
    }
  };

  try {
    await writeToPath(filePath);
  } catch (e) {
    throw new Error(`No se pudo guardar la imagen en ${filePath}: ${e.message}`);
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

/** Elimina un archivo a partir de su url pública (/uploads/...). */
async function deleteByUrl(url) {
  if (!url || !url.startsWith(`/${env.storage.uploadDir}/`)) return;
  return deleteByPublicId(url.replace(/^\//, ''));
}

module.exports = { saveBuffer, deleteByPublicId, deleteByUrl, ensureUploadDirs };