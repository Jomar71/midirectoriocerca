/**
 * utils/sanitize.js
 * Utilidades de saneamiento y validación de entradas.
 * - Se escapan los caracteres peligrosos para evitar XSS en plantillas EJS.
 * - Las consultas a BD siempre usan parámetros (evita SQL Injection).
 */
'use strict';

/** Elimina etiquetas y caracteres de control de textos de una sola línea. */
function cleanText(value, maxLen = 300) {
  if (value === undefined || value === null) return null;
  const s = String(value)
    .replace(/<[^>]*>/g, '')          // quita etiquetas HTML
    .replace(/[\u0000-\u001F\u007F]/g, ' ') // quita caracteres de control
    .trim();
  return s ? s.slice(0, maxLen) : null;
}

/** Saneamiento de textos largos (descripciones, mensajes). */
function cleanMultiline(value, maxLen = 5000) {
  if (value === undefined || value === null) return null;
  const s = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
  return s ? s.slice(0, maxLen) : null;
}

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));

/** Permite solo URLs http(s) válidas (evita javascript: y data:). */
function cleanUrl(value, maxLen = 300) {
  if (!value) return null;
  const s = String(value).trim();
  if (!/^https?:\/\//i.test(s)) return null;
  try {
    const u = new URL(s);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return s.slice(0, maxLen);
  } catch { return null; }
}

/** Convierte a número decimal válido o null. */
function cleanNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Fecha en formato YYYY-MM-DD o null. */
function cleanDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

module.exports = { cleanText, cleanMultiline, isEmail, cleanUrl, cleanNumber, cleanDate };
