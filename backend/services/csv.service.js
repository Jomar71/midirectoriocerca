/**
 * services/csv.service.js
 * Importación masiva de anuncios desde CSV.
 * Cabeceras aceptadas (fila 1):
 *   razon_social, descripcion_50, direccion, telefono_fijo, telefono_movil,
 *   email, sitio_web, youtube, facebook, instagram, tiktok, categoria,
 *   ciudad, pais, latitud, longitud, palabras_clave, fecha_inicio,
 *   fecha_vencimiento, fotos
 * "fotos": URLs separadas por "|" (opcional).
 */
'use strict';

const { parse } = require('csv-parse/sync');
const anuncioModel = require('../models/anuncio.model');
const categoriaModel = require('../models/categoria.model');
const fotoModel = require('../models/foto.model');
const { uniqueSlug, slugify } = require('../utils/slug');
const S = require('../utils/sanitize');

const REQUIRED = ['razon_social', 'descripcion_50'];

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

async function importCsv(buffer, { defaultEstado = 'activo' } = {}) {
  const content = buffer.toString('utf8').replace(/^\uFEFF/, '');
  let records;
  try {
    records = parse(content, {
      columns: (h) => h.map((c) => c.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (e) {
    throw new Error(`CSV inválido: ${e.message}`);
  }

  // Índice de categorías por slug y por nombre
  const cats = await categoriaModel.listSimple();
  const catBySlug = new Map(cats.map((c) => [c.slug, c.id]));
  const catByName = new Map(cats.map((c) => [c.nombre.toLowerCase(), c.id]));

  const report = { total: records.length, inserted: 0, errors: [] };

  for (let i = 0; i < records.length; i += 1) {
    const row = records[i];
    const line = i + 2; // +2 = cabecera + base 1
    try {
      const faltantes = REQUIRED.filter((k) => !row[k]);
      if (faltantes.length) throw new Error(`Faltan campos obligatorios: ${faltantes.join(', ')}`);

      const razon = S.cleanText(row.razon_social, 200);
      const slug = await uniqueSlug(razon, (s) => anuncioModel.slugExists(s));

      let categoriaId = null;
      if (row.categoria) {
        const key = String(row.categoria).trim();
        categoriaId = catBySlug.get(slugify(key)) || catByName.get(key.toLowerCase()) || null;
      }

      const inicio = S.cleanDate(row.fecha_inicio) || new Date().toISOString().slice(0, 10);
      const vencimiento = S.cleanDate(row.fecha_vencimiento)
        || addMonths(new Date(inicio), 12).toISOString().slice(0, 10);

      const id = await anuncioModel.create({
        razon_social: razon,
        slug,
        descripcion_50: S.cleanMultiline(row.descripcion_50, 700) || razon,
        direccion: S.cleanText(row.direccion, 300),
        telefono_fijo: S.cleanText(row.telefono_fijo, 40),
        telefono_movil: S.cleanText(row.telefono_movil, 40),
        email: S.isEmail(row.email) ? S.cleanText(row.email, 190) : null,
        sitio_web: S.cleanUrl(row.sitio_web),
        youtube: S.cleanUrl(row.youtube),
        facebook: S.cleanUrl(row.facebook),
        instagram: S.cleanUrl(row.instagram),
        tiktok: S.cleanUrl(row.tiktok),
        categoria_id: categoriaId,
        ciudad: S.cleanText(row.ciudad, 120),
        pais: S.cleanText(row.pais, 120),
        latitud: S.cleanNumber(row.latitud),
        longitud: S.cleanNumber(row.longitud),
        palabras_clave: S.cleanText(row.palabras_clave, 600),
        estado: defaultEstado,
        fecha_inicio: inicio,
        fecha_vencimiento: vencimiento,
      });

      if (row.fotos) {
        const urls = String(row.fotos).split('|').map((u) => u.trim()).filter(Boolean).slice(0, 11);
        for (let k = 0; k < urls.length; k += 1) {
          // eslint-disable-next-line no-await-in-loop
          await fotoModel.add(id, urls[k], null, k);
        }
      }

      report.inserted += 1;
    } catch (e) {
      report.errors.push({ line, razon_social: row.razon_social || '', error: e.message });
    }
  }

  return report;
}

module.exports = { importCsv };
