/**
 * services/storage.service.js
 * Guarda la imagen como Base64 para evitar problemas de permisos y persistencia.
 */
'use strict';

const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');

/** Guarda un buffer convirtiéndolo a Base64 (Data URI). */
async function saveBuffer(buffer, originalName, folder = 'anuncios') {
  const uuid = uuidv4();
  
  try {
    // Comprimimos a WebP en memoria
    const dataToWrite = await sharp(buffer).webp({ quality: 80 }).toBuffer();
    
    // Convertimos a Base64 (Texto)
    const base64Image = dataToWrite.toString('base64');
    const dataUri = `data:image/webp;base64,${base64Image}`;

    // Devolvemos el texto. El controlador lo guardará en la BD.
    return { 
      url: dataUri, 
      publicId: uuid 
    };
  } catch (error) {
    console.error('[storage] Error procesando imagen:', error);
    throw new Error(`No se pudo procesar la imagen: ${error.message}`);
  }
}

// Estas funciones quedan vacías porque ya no guardamos archivos físicos
async function deleteByPublicId(publicId) {
  return; 
}

async function deleteByUrl(url) {
  return;
}

function ensureUploadDirs() {}

module.exports = { saveBuffer, deleteByPublicId, deleteByUrl, ensureUploadDirs };
