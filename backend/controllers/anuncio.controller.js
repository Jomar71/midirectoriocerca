/**
 * controllers/anuncio.controller.js
 * Controladores públicos: render de páginas (SEO server-side) y API JSON.
 */
'use strict';

const anuncioModel = require('../models/anuncio.model');
const categoriaModel = require('../models/categoria.model');
const ubicacionModel = require('../models/ubicacion.model');
const fotoModel = require('../models/foto.model');
const seo = require('../services/seo.service');
const { parsePagination, buildMeta, DEFAULT_LIMIT } = require('../utils/pagination');
const env = require('../config/env');

/** GET /  → Página principal (portada + categorías + pauta). */
async function renderIndex(req, res, next) {
  try {
    const filtros = {
      q: (req.query.q || '').toString().trim().slice(0, 100) || null,
      categoria: (req.query.categoria || '').toString().trim() || null,
      departamento: (req.query.departamento || '').toString().trim() || null,
      ciudad: (req.query.ciudad || '').toString().trim() || null,
      pais: (req.query.pais || '').toString().trim() || null,
    };

    const [categorias, ubicaciones] = await Promise.all([
      categoriaModel.list(),
      ubicacionModel.getUbicaciones(),
    ]);

    return res.render('index', {
      title: 'DirectorioCerca — Directorio de empresas, negocios y profesionales',
      meta: seo.metaFor({
        title: 'DirectorioCerca — Directorio de empresas y negocios',
        description: 'Encuentra empresas, negocios, profesionales, productos y servicios a nivel local, nacional e internacional.',
        url: `${env.appUrl}/`,
        type: 'website',
      }),
      categorias,
      ubicaciones,
      filtros,
      queryString: buildQueryString(req.query),
    });
  } catch (e) {
    return next(e);
  }
}

/** GET /resultados → Página aparte con los resultados de la búsqueda. */
async function renderResultados(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination({ ...req.query, limit: DEFAULT_LIMIT });
    const filtros = {
      q: (req.query.q || '').toString().trim().slice(0, 100) || null,
      categoria: (req.query.categoria || '').toString().trim() || null,
      departamento: (req.query.departamento || '').toString().trim() || null,
      ciudad: (req.query.ciudad || '').toString().trim() || null,
      pais: (req.query.pais || '').toString().trim() || null,
      page, limit, offset,
    };

    const [categorias, ubicaciones, data] = await Promise.all([
      categoriaModel.list(),
      ubicacionModel.getUbicaciones(),
      anuncioModel.list(filtros),
    ]);

    const categoriaActual = filtros.categoria
      ? categorias.find((c) => c.slug === filtros.categoria) || null
      : null;

    const meta = buildMeta(data.total, page, limit);

    let pageTitle = 'Resultados de búsqueda | DirectorioCerca';
    if (filtros.q && categoriaActual) {
      pageTitle = `«${filtros.q}» en ${categoriaActual.nombre} | DirectorioCerca`;
    } else if (filtros.q) {
      pageTitle = `Resultados para «${filtros.q}» | DirectorioCerca`;
    } else if (categoriaActual) {
      pageTitle = `${categoriaActual.nombre} | DirectorioCerca`;
    } else if (filtros.ciudad) {
      pageTitle = `Negocios en ${filtros.ciudad} | DirectorioCerca`;
    }

    return res.render('resultados', {
      title: pageTitle,
      meta: seo.metaFor({
        title: pageTitle,
        description: `Explora ${data.total} anuncios y servicios comerciales en Colombia con DirectorioCerca.`,
        url: `${env.appUrl}/resultados`,
        type: 'website',
      }),
      categorias,
      categoriaActual,
      ubicaciones,
      anuncios: data.rows,
      pagination: meta,
      filtros,
      queryString: buildQueryString(req.query),
    });
  } catch (e) {
    return next(e);
  }
}

function buildQueryString(query, overrides = {}) {
  const params = new URLSearchParams();
  Object.entries({ ...query, ...overrides }).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && k !== 'page') params.set(k, v);
  });
  return params.toString();
}

function whatsappPhoneNumber(phone) {
  const value = String(phone || '').trim();
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (/^(?:\+|00)/.test(value)) return digits.replace(/^00/, '');
  if (digits.startsWith('57')) return digits;
  return `57${digits.replace(/^0+/, '')}`;
}

/** GET /anuncio/:slug → Ficha del anuncio. */
async function renderAnuncio(req, res, next) {
  try {
    const anuncio = await anuncioModel.findBySlug(req.params.slug);
    if (!anuncio || anuncio.estado !== 'activo') {
      return res.status(404).render('404', { title: 'Anuncio no encontrado' });
    }

    const fotos = await fotoModel.listByAnuncio(anuncio.id);
    const jsonLd = seo.localBusinessJsonLd(anuncio, fotos);
    const keywords = seo.keywordsArray(anuncio.palabras_clave, anuncio.razon_social);
    const imgPrincipal = fotos[0]?.url || '/img/placeholder.jpg';
    const whatsappNumber = whatsappPhoneNumber(anuncio.telefono_movil);

    return res.render('anuncio', {
      title: `${anuncio.razon_social} | DirectorioCerca`,
      meta: seo.metaFor({
        title: `${anuncio.razon_social} — ${anuncio.categoria_nombre || 'Empresa'}`,
        description: (anuncio.descripcion_50 || '').slice(0, 160),
        url: `${env.appUrl}/anuncio/${anuncio.slug}`,
        image: imgPrincipal.startsWith('http') ? imgPrincipal : `${env.appUrl}${imgPrincipal}`,
        type: 'business.business',
        keywords: keywords.join(', '),
      }),
      anuncio,
      fotos,
      jsonLd: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
      keywords,
      cleanMobile: (anuncio.telefono_movil || '').replace(/[^0-9]/g, ''),
      whatsappDirectUrl: whatsappNumber
        ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hola, vi su anuncio "${anuncio.razon_social}" en DirectorioCerca y deseo información.`)}`
        : null,
      whatsappText: encodeURIComponent(`Mira este negocio en DirectorioCerca: ${anuncio.razon_social} → ${env.appUrl}/anuncio/${anuncio.slug}`),
      mapsEmbed: anuncio.latitud != null && anuncio.longitud != null
        ? `https://www.google.com/maps?q=${anuncio.latitud},${anuncio.longitud}&z=15&output=embed`
        : (anuncio.direccion
          ? `https://www.google.com/maps?q=${encodeURIComponent(`${anuncio.direccion} ${anuncio.ciudad || ''} ${anuncio.pais || ''}`)}&output=embed`
          : null),
    });
  } catch (e) {
    return next(e);
  }
}

/** GET /api/anuncios → JSON paginado. */
async function apiList(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination({ ...req.query, limit: DEFAULT_LIMIT });
    const data = await anuncioModel.list({
      q: (req.query.q || '').toString().trim().slice(0, 100) || null,
      categoria: (req.query.categoria || '').toString().trim() || null,
      departamento: (req.query.departamento || '').toString().trim() || null,
      ciudad: (req.query.ciudad || '').toString().trim() || null,
      pais: (req.query.pais || '').toString().trim() || null,
      page, limit, offset,
    });
    return res.json({ ok: true, data: data.rows, pagination: buildMeta(data.total, page, limit) });
  } catch (e) {
    return next(e);
  }
}

/** GET /api/anuncios/:slug → JSON del anuncio + fotos. */
async function apiGet(req, res, next) {
  try {
    const anuncio = await anuncioModel.findBySlug(req.params.slug);
    if (!anuncio || anuncio.estado !== 'activo') {
      return res.status(404).json({ ok: false, error: 'Anuncio no encontrado.' });
    }
    const fotos = await fotoModel.listByAnuncio(anuncio.id);
    const jsonLd = seo.localBusinessJsonLd(anuncio, fotos);
    return res.json({ ok: true, data: { ...anuncio, fotos, jsonLd } });
  } catch (e) {
    return next(e);
  }
}

async function apiCategorias(req, res, next) {
  try {
    res.json({ ok: true, data: await categoriaModel.list() });
  } catch (e) { next(e); }
}

async function apiUbicaciones(req, res, next) {
  try {
    const departamento = (req.query.departamento || '').toString().trim();
    if (departamento) {
      const data = await ubicacionModel.findDepartamentoBySlug(departamento);
      if (!data) return res.status(404).json({ ok: false, error: 'Departamento no encontrado.' });
      const ciudades = await ubicacionModel.listCiudadesByDepartamento(departamento);
      return res.json({ ok: true, data: { departamento: data, ciudades } });
    }
    return res.json({ ok: true, data: await ubicacionModel.getUbicaciones() });
  } catch (e) { next(e); }
}

module.exports = { renderIndex, renderResultados, renderAnuncio, apiList, apiGet, apiCategorias, apiUbicaciones, buildQueryString };
