/**
 * utils/slug.js
 * Genera slugs para URLs amigables: "Mi Empresa, C.A." -> "mi-empresa-c-a"
 */
'use strict';

function slugify(text) {
  return String(text || '')
    .normalize('NFD')                     // separa acentos
    .replace(/[\u0300-\u036f]/g, '')      // elimina diacríticos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')         // quita caracteres no permitidos
    .replace(/\s+/g, '-')                 // espacios -> guiones
    .replace(/-+/g, '-')                  // colapsa guiones
    .replace(/^-|-$/g, '')                // recorta guiones extremos
    .slice(0, 200);
}

/**
 * Genera un slug único consultando la BD (añade sufijo -2, -3, ...).
 * @param {Function} existsFn (slug) => Promise<boolean>
 */
async function uniqueSlug(base, existsFn) {
  let slug = slugify(base) || 'anuncio';
  let candidate = slug;
  let i = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await existsFn(candidate)) {
    candidate = `${slug}-${i}`;
    i += 1;
    if (i > 9999) { candidate = `${slug}-${Date.now()}`; break; }
  }
  return candidate;
}

module.exports = { slugify, uniqueSlug };
