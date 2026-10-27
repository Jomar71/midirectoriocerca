/**
 * controllers/admin.controller.js
 * Panel del administrador: CRUD de anuncios, fotos, categorías y estadísticas.
 */
'use strict';

const anuncioModel = require('../models/anuncio.model');
const fotoModel = require('../models/foto.model');
const categoriaModel = require('../models/categoria.model');
const mensajeModel = require('../models/mensaje.model');
const storage = require('../services/storage.service');
const { uniqueSlug } = require('../utils/slug');
const { parsePagination, buildMeta } = require('../utils/pagination');
const { invalidatePublicCache } = require('../middlewares/cache');
const { withTransaction } = require('../config/db');
const S = require('../utils/sanitize');

const ESTADOS = ['activo', 'vencido', 'deshabilitado', 'pendiente'];

function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

/** Normaliza y sanea el cuerpo de un anuncio. */
function payloadFromBody(b) {
  const inicio = S.cleanDate(b.fecha_inicio) || new Date().toISOString().slice(0, 10);
  const vencimiento = S.cleanDate(b.fecha_vencimiento)
    || addYears(new Date(inicio), 1).toISOString().slice(0, 10);
  return {
    razon_social: S.cleanText(b.razon_social, 200),
    descripcion_50: S.cleanMultiline(b.descripcion_50, 700),
    direccion: S.cleanText(b.direccion, 300),
    telefono_fijo: S.cleanText(b.telefono_fijo, 40),
    telefono_movil: S.cleanText(b.telefono_movil, 40),
    email: S.isEmail(b.email) ? S.cleanText(b.email, 190) : null,
    sitio_web: S.cleanUrl(b.sitio_web),
    youtube: S.cleanUrl(b.youtube),
    facebook: S.cleanUrl(b.facebook),
    instagram: S.cleanUrl(b.instagram),
    tiktok: S.cleanUrl(b.tiktok),
    otras_redes: null,
    categoria_id: parseInt(b.categoria_id, 10) || null,
    ciudad: S.cleanText(b.ciudad, 120),
    pais: S.cleanText(b.pais, 120),
    latitud: S.cleanNumber(b.latitud),
    longitud: S.cleanNumber(b.longitud),
    palabras_clave: S.cleanText(b.palabras_clave, 600),
    estado: ESTADOS.includes(b.estado) ? b.estado : 'activo',
    fecha_inicio: inicio,
    fecha_vencimiento: vencimiento,
  };
}

function collectFiles(req) {
  if (!req.files) return [];
  const arr = [];
  if (Array.isArray(req.files)) arr.push(...req.files);
  else Object.values(req.files).forEach((list) => arr.push(...list));
  return arr;
}

async function saveUploadedFotos(anuncioId, files) {
  const actuales = await fotoModel.countByAnuncio(anuncioId);
  let orden = await fotoModel.nextOrden(anuncioId);
  let restantes = Math.max(0, 11 - actuales);
  for (const file of files.slice(0, restantes)) {
    // eslint-disable-next-line no-await-in-loop
    const { url, publicId } = await storage.saveBuffer(file.buffer, file.originalname, 'anuncios');
    // eslint-disable-next-line no-await-in-loop
    await fotoModel.add(anuncioId, url, publicId, orden);
    orden += 1;
    restantes -= 1;
  }
}

// ── Dashboard ───────────────────────────────────────────────────────────
async function dashboard(req, res, next) {
  try {
    const [stats, noLeidos, porVencer] = await Promise.all([
      anuncioModel.stats(),
      mensajeModel.countNoLeidos(),
      anuncioModel.findExpiring(30),
    ]);
    return res.json({ ok: true, data: { stats, mensajes_no_leidos: noLeidos, por_vencer: porVencer } });
  } catch (e) { next(e); }
}

// ── Anuncios ────────────────────────────────────────────────────────────
async function listAnuncios(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const data = await anuncioModel.listAdmin({
      q: (req.query.q || '').toString().trim() || null,
      estado: (req.query.estado || '').toString().trim() || null,
      categoria: (req.query.categoria || '').toString().trim() || null,
      page, limit, offset,
    });
    return res.json({ ok: true, data: data.rows, pagination: buildMeta(data.total, page, limit) });
  } catch (e) { next(e); }
}

async function getAnuncio(req, res, next) {
  try {
    const anuncio = await anuncioModel.findById(req.params.id);
    if (!anuncio) return res.status(404).json({ ok: false, error: 'Anuncio no encontrado.' });
    if (anuncio.fecha_inicio) anuncio.fecha_inicio = String(anuncio.fecha_inicio).slice(0, 10);
    if (anuncio.fecha_vencimiento) anuncio.fecha_vencimiento = String(anuncio.fecha_vencimiento).slice(0, 10);
    const [fotos, suscripciones] = await Promise.all([
      fotoModel.listByAnuncio(anuncio.id),
      require('../models/suscripcion.model').listByAnuncio(anuncio.id),
    ]);
    return res.json({ ok: true, data: { ...anuncio, fotos, suscripciones } });
  } catch (e) { next(e); }
}

async function createAnuncio(req, res, next) {
  try {
    const data = payloadFromBody(req.body);
    if (!data.razon_social || !data.descripcion_50) {
      return res.status(422).json({ ok: false, error: 'Razón social y descripción son obligatorias.' });
    }
    data.slug = await uniqueSlug(data.razon_social, (s) => anuncioModel.slugExists(s));

    const id = await anuncioModel.create(data);
    await saveUploadedFotos(id, collectFiles(req));
    await invalidatePublicCache();
    return res.status(201).json({ ok: true, id, message: 'Anuncio creado.' });
  } catch (e) { next(e); }
}

async function updateAnuncio(req, res, next) {
  try {
    const existing = await anuncioModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Anuncio no encontrado.' });

    const data = payloadFromBody(req.body);
    if (!data.razon_social || !data.descripcion_50) {
      return res.status(422).json({ ok: false, error: 'Razón social y descripción son obligatorias.' });
    }
    // Mantiene el slug si la razón social no cambió; si cambió, genera uno nuevo.
    data.slug = data.razon_social === existing.razon_social
      ? existing.slug
      : await uniqueSlug(data.razon_social, (s) => anuncioModel.slugExists(s, existing.id));

    await anuncioModel.update(existing.id, data);
    await saveUploadedFotos(existing.id, collectFiles(req));

    // Auditoría del contador de cambios (máx. 6)
    const usados = await anuncioModel.registrarCambio(existing.id);
    await withTransaction((client) => client.query(
      'INSERT INTO cambios_log (anuncio_id, admin_id, detalle) VALUES ($1, $2, $3)',
      [existing.id, req.admin.id, `Edición de datos (cambio ${usados}/6)`]
    ));

    await invalidatePublicCache();
    return res.json({ ok: true, message: 'Anuncio actualizado.', cambios_usados: usados });
  } catch (e) { next(e); }
}

async function deleteAnuncio(req, res, next) {
  try {
    const anuncio = await anuncioModel.findById(req.params.id);
    if (!anuncio) return res.status(404).json({ ok: false, error: 'Anuncio no encontrado.' });
    const fotos = await fotoModel.listByAnuncio(anuncio.id);
    await Promise.all(fotos.map((f) => storage.deleteByUrl(f.url)));
    await anuncioModel.remove(anuncio.id);
    await invalidatePublicCache();
    return res.json({ ok: true, message: 'Anuncio eliminado.' });
  } catch (e) { next(e); }
}

async function setEstado(req, res, next) {
  try {
    const { estado } = req.body;
    if (!ESTADOS.includes(estado)) return res.status(422).json({ ok: false, error: 'Estado inválido.' });
    await anuncioModel.setEstado(req.params.id, estado);
    await invalidatePublicCache();
    return res.json({ ok: true, message: `Anuncio marcado como "${estado}".` });
  } catch (e) { next(e); }
}

/** Renueva el anuncio 12 meses desde hoy y registra la suscripción. */
async function renovar(req, res, next) {
  try {
    const anuncio = await anuncioModel.findById(req.params.id);
    if (!anuncio) return res.status(404).json({ ok: false, error: 'Anuncio no encontrado.' });
    const hoy = new Date();
    const nuevaFecha = addYears(hoy, 1).toISOString().slice(0, 10);
    await anuncioModel.setVencimiento(anuncio.id, nuevaFecha);
    await withTransaction((client) => client.query(
      'INSERT INTO suscripciones (anuncio_id, fecha_inicio, fecha_fin) VALUES ($1, $2, $3)',
      [anuncio.id, hoy.toISOString().slice(0, 10), nuevaFecha]
    ));
    await invalidatePublicCache();
    return res.json({ ok: true, message: `Anuncio renovado hasta ${nuevaFecha}.`, fecha_vencimiento: nuevaFecha });
  } catch (e) { next(e); }
}

// ── Fotos ───────────────────────────────────────────────────────────────
async function subirFotos(req, res, next) {
  try {
    const anuncio = await anuncioModel.findById(req.params.id);
    if (!anuncio) return res.status(404).json({ ok: false, error: 'Anuncio no encontrado.' });
    const before = await fotoModel.countByAnuncio(anuncio.id);
    await saveUploadedFotos(anuncio.id, collectFiles(req));
    const after = await fotoModel.countByAnuncio(anuncio.id);
    await invalidatePublicCache();
    return res.json({ ok: true, message: 'Fotos subidas.', agregadas: after - before, total: after });
  } catch (e) { next(e); }
}

async function eliminarFoto(req, res, next) {
  try {
    const foto = await fotoModel.findById(req.params.id);
    if (!foto) return res.status(404).json({ ok: false, error: 'Foto no encontrada.' });
    await storage.deleteByUrl(foto.url);
    await fotoModel.remove(foto.id);
    await invalidatePublicCache();
    return res.json({ ok: true });
  } catch (e) { next(e); }
}

async function reordenarFotos(req, res, next) {
  try {
    const ids = Array.isArray(req.body.orden) ? req.body.orden.map(Number).filter(Number.isFinite) : [];
    await fotoModel.reorder(req.params.id, ids);
    await invalidatePublicCache();
    return res.json({ ok: true });
  } catch (e) { next(e); }
}

// ── Categorías ──────────────────────────────────────────────────────────
async function listCategorias(req, res, next) {
  try { res.json({ ok: true, data: await categoriaModel.list() }); } catch (e) { next(e); }
}

async function createCategoria(req, res, next) {
  try {
    const nombre = S.cleanText(req.body.nombre, 120);
    if (!nombre) return res.status(422).json({ ok: false, error: 'Nombre requerido.' });
    const { slugify } = require('../utils/slug');
    const cat = await categoriaModel.create({
      nombre, slug: slugify(nombre), icono: S.cleanText(req.body.icono, 60),
    });
    await invalidatePublicCache();
    return res.status(201).json({ ok: true, data: cat });
  } catch (e) { next(e); }
}

async function updateCategoria(req, res, next) {
  try {
    const nombre = S.cleanText(req.body.nombre, 120);
    if (!nombre) return res.status(422).json({ ok: false, error: 'Nombre requerido.' });
    const { slugify } = require('../utils/slug');
    const cat = await categoriaModel.update(req.params.id, {
      nombre, slug: slugify(nombre), icono: S.cleanText(req.body.icono, 60), orden: req.body.orden,
    });
    await invalidatePublicCache();
    return res.json({ ok: true, data: cat });
  } catch (e) { next(e); }
}

async function deleteCategoria(req, res, next) {
  try {
    await categoriaModel.remove(req.params.id);
    await invalidatePublicCache();
    return res.json({ ok: true });
  } catch (e) { next(e); }
}

module.exports = {
  dashboard, listAnuncios, getAnuncio, createAnuncio, updateAnuncio, deleteAnuncio,
  setEstado, renovar, subirFotos, eliminarFoto, reordenarFotos,
  listCategorias, createCategoria, updateCategoria, deleteCategoria,
};
