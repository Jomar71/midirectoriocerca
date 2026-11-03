/**
 * services/storage.service.js
 * Abstraccion de almacenamiento de imagenes.
 * Implementa el driver "local". Los drivers "cloudinary" y "s3" quedan
 * preparados para conectar sin cambiar el resto del codigo.
 */
'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');

const PUBLIC_DIR = path.resolve(__dirname, '..', '..', 'public');
const PROJECT_DIR = path.resolve(__dirname, '..', '..');

const rawUploadDir = (env.storage.uploadDir || 'uploads').trim() || 'uploads';
const isAbsoluteUploadDir = path.isAbsolute(rawUploadDir);
// Segmento usado en las URLs públicas (/uploads/...). Si UPLOAD_DIR es una
// ruta absoluta se mantiene "uploads" para no exponer la ruta del servidor.
const uploadDirName = isAbsoluteUploadDir
  ? 'uploads'
  : (rawUploadDir
    .replace(/^[\\/]+/, '')
    .replace(/^public[\\/]+/, '')
    .replace(/[\\/]+$/, '') || 'uploads');

// Carpetas candidatas, en orden de preferencia. Si la primera no es
// escribible (Pxxl monta public/ como solo lectura, EACCES, etc.) se usa
// la siguiente.
const UPLOAD_CANDIDATES = isAbsoluteUploadDir
  ? [
    path.resolve(rawUploadDir),
    path.join(os.tmpdir(), 'directoriocerca', uploadDirName),
  ]
  : [
    path.resolve(PUBLIC_DIR, uploadDirName),
    path.resolve(PROJECT_DIR, uploadDirName),
    path.join(os.tmpdir(), 'directoriocerca', uploadDirName),
  ];

let uploadRoot = UPLOAD_CANDIDATES[0];

const IS_WINDOWS = process.platform === 'win32';

function setPermisos(dir) {
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

/** Comprueba que se pueda crear y borrar un archivo en la carpeta. */
function isWritable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    setPermisos(dir);
    const probe = path.join(dir, `.dc-write-test-${process.pid}-${Date.now()}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return true;
  } catch (e) {
    return false;
  }
}

function ensureUploadDirs() {
  const found = UPLOAD_CANDIDATES.find((dir) => isWritable(dir));
  uploadRoot = found || UPLOAD_CANDIDATES[0];
  ensureDirSync(path.join(uploadRoot, 'anuncios'));
  if (!found) {
    console.warn('[storage] Ninguna carpeta de subidas es escribible:', UPLOAD_CANDIDATES.join(', '));
  } else {
    console.log('[storage] Carpeta de subidas activa:', uploadRoot);
  }
  return uploadRoot;
}

/** Carpeta física activa que corresponde a la URL /<uploadDirName>. */
function getUploadRoot() {
  return uploadRoot;
}

/** Carpetas que se sirven en /<uploadDirName> (activa, alternativas y legado). */
function getUploadRoots() {
  return [...new Set([
    uploadRoot,
    ...UPLOAD_CANDIDATES,
    path.resolve(PUBLIC_DIR, uploadDirName),
  ])];
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

/**
 * Sube un buffer a Cloudinary usando su API REST y firma SHA-1.
 * Devuelve { url: secure_url, publicId }.
 */
async function uploadToCloudinary(buffer, originalName, folder = 'anuncios', mimetype = '') {
  const { cloudName, apiKey, apiSecret } = env.storage.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Faltan credenciales de Cloudinary. Define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en .env.');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const cleanFolder = (folder || 'anuncios').replace(/^[\\/]+/, '').replace(/[\\/]+$/, '');
  const targetFolder = `directoriocerca/${cleanFolder}`;

  const toSign = `folder=${targetFolder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimetype || 'application/octet-stream' });
  formData.append('file', blob, originalName || 'image.jpg');
  formData.append('api_key', apiKey);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);
  formData.append('folder', targetFolder);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message || `Error al subir imagen a Cloudinary (HTTP ${response.status})`);
  }

  return {
    url: data.secure_url,
    publicId: data.public_id,
  };
}

/**
 * Elimina una imagen de Cloudinary a través de su public_id.
 */
async function deleteFromCloudinary(publicId) {
  const { cloudName, apiKey, apiSecret } = env.storage.cloudinary;
  if (!cloudName || !apiKey || !apiSecret || !publicId) return;

  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  const formData = new FormData();
  formData.append('public_id', publicId);
  formData.append('api_key', apiKey);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`;
  try {
    const res = await fetch(endpoint, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.result !== 'ok' && data.result !== 'not found') {
      console.warn('[storage] Cloudinary destroy result:', data);
    }
  } catch (err) {
    console.warn('[storage] Error al borrar de Cloudinary:', err.message);
  }
}

/** Guarda un buffer y devuelve { url, publicId }. */
async function saveBuffer(buffer, originalName, folder = 'anuncios', mimetype = '') {
  const driver = env.storage.driver;
  if (driver === 'cloudinary') {
    return uploadToCloudinary(buffer, originalName, folder, mimetype);
  }
  if (driver === 's3') {
    throw new Error('El driver "s3" no esta configurado. Usa STORAGE_DRIVER=cloudinary o STORAGE_DRIVER=local.');
  }

  const subfolder = (folder || 'anuncios').replace(/^[\\/]+/, '').replace(/[\\/]+$/, '');
  const uuid = uuidv4();
  const date = new Date().toISOString().split('T')[0];
  const ext = resolveExtension(originalName, mimetype);
  const filename = `${date}-${uuid}${ext}`;

  const cp = require('child_process');
  const writeToPath = async (p) => {
    await fsp.writeFile(p, buffer);
    if (IS_WINDOWS) {
      try { cp.execSync(`icacls "${p}" /grant Everyone:F`, { stdio: 'ignore', windowsHide: true }); } catch (e) {}
    }
  };

  // Intenta la carpeta activa y, si falla, las alternativas escribibles.
  const roots = [...new Set([uploadRoot, ...UPLOAD_CANDIDATES])];
  let lastError = null;
  let savedPath = null;
  for (const root of roots) {
    const targetDir = path.resolve(root, subfolder);
    const filePath = path.join(targetDir, filename);
    try {
      fs.mkdirSync(targetDir, { recursive: true });
      setPermisos(targetDir);
      // eslint-disable-next-line no-await-in-loop
      await writeToPath(filePath);
      uploadRoot = root;
      savedPath = filePath;
      break;
    } catch (e) {
      lastError = e;
    }
  }

  if (!savedPath) {
    const attempted = path.join(uploadRoot, subfolder, filename);
    throw new Error(`No se pudo guardar la imagen en ${attempted}: ${lastError ? lastError.message : 'sin carpeta escribible'}`);
  }

  const rel = `${subfolder}/${filename}`;
  const publicId = `${uploadDirName}/${rel}`;
  const url = `/${uploadDirName}/${rel}`;
  return { url, publicId };
}

/** Elimina un archivo a partir de su publicId (ruta relativa a /public o ID en Cloudinary). */
async function deleteByPublicId(publicId) {
  if (!publicId) return;

  if (env.storage.driver === 'cloudinary' || String(publicId).startsWith('directoriocerca/')) {
    return deleteFromCloudinary(publicId);
  }

  // Normaliza "uploads/anuncios/x.png" -> "anuncios/x.png"
  let rel = String(publicId).replace(/^[\\/]+/, '');
  const firstSep = rel.search(/[\\/]/);
  if (firstSep !== -1 && rel.slice(0, firstSep) === uploadDirName) {
    rel = rel.slice(firstSep + 1);
  }
  rel = rel.replace(/^[\\/]+/, '');
  if (!rel) return;

  for (const root of getUploadRoots()) {
    const rootAbs = path.resolve(root);
    const abs = path.resolve(rootAbs, rel);
    // Seguridad: evita salir del directorio de subidas
    if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      await fsp.unlink(abs);
      return;
    } catch (e) {
      if (e.code !== 'ENOENT') console.warn('[storage] No se pudo borrar:', abs, e.message);
    }
  }
}

/** Elimina un archivo a partir de su url pública o publicId opcional. */
async function deleteByUrl(url, publicId = null) {
  if (publicId) return deleteByPublicId(publicId);
  if (!url) return;
  if (url.startsWith('https://res.cloudinary.com/')) {
    // Si es Cloudinary y no vino publicId, deduce el ID tras /image/upload/v.../
    const match = url.match(/\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
    if (match && match[1]) return deleteFromCloudinary(match[1]);
    return;
  }
  if (!url.startsWith(`/${uploadDirName}/`)) return;
  return deleteByPublicId(url.slice(1));
}

module.exports = {
  saveBuffer, deleteByPublicId, deleteByUrl, ensureUploadDirs, getUploadRoot, getUploadRoots,
};