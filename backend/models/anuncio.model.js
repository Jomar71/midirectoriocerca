/**
 * models/anuncio.model.js
 * Consultas de anuncios: listado público con filtros y full-text,
 * listado de administrador, CRUD y operaciones de vencimiento.
 */
'use strict';

const { query } = require('../config/db');

const PUBLIC_COLS = `
  a.id, a.razon_social, a.slug, a.descripcion_50, a.direccion,
  a.telefono_fijo, a.telefono_movil, a.email, a.sitio_web,
  a.youtube, a.facebook, a.instagram, a.tiktok, a.otras_redes,
  a.categoria_id, a.ciudad, a.pais, a.latitud, a.longitud,
  a.palabras_clave, a.estado, a.fecha_inicio, a.fecha_vencimiento,
  a.cambios_usados, a.created_at, a.updated_at,
  c.nombre AS categoria_nombre, c.slug AS categoria_slug,
  (SELECT url FROM fotos f WHERE f.anuncio_id = a.id ORDER BY f.orden ASC LIMIT 1) AS foto_principal
`;

/**
 * Construye el WHERE dinámico para listados.
 * @returns {{ where:string, params:Array }}
 */
function buildFilters({ q, categoria, ciudad, departamento, pais, soloActivos = true } = {}) {
  const clauses = [];
  const params = [];

  if (soloActivos) clauses.push("a.estado = 'activo'");

  if (categoria) {
    params.push(categoria);
    clauses.push(`c.slug = $${params.length}`);
  }
  if (departamento) {
    params.push(departamento);
    clauses.push(`a.ciudad IS NOT NULL AND EXISTS (
      SELECT 1 FROM ciudades ci
      JOIN departamentos dp ON dp.id = ci.departamento_id
      WHERE dp.slug = $${params.length}
        AND (unaccent(lower(a.ciudad)) = unaccent(lower(ci.nombre))
             OR unaccent(lower(a.ciudad)) = unaccent(lower(split_part(ci.nombre, ',', 1))))
    )`);
  }
  if (ciudad) {
    params.push(ciudad);
    clauses.push(`a.ciudad = $${params.length}`);
  }
  if (pais) {
    params.push(pais);
    clauses.push(`a.pais = $${params.length}`);
  }
  if (q) {
    params.push(q);
    const i = params.length;
    // Full-text ponderado + similitud difusa (pg_trgm) como respaldo
    clauses.push(`(
      a.search_vector @@ plainto_tsquery('spanish', $${i})
      OR a.razon_social ILIKE '%' || $${i} || '%'
      OR a.palabras_clave ILIKE '%' || $${i} || '%'
      OR a.ciudad ILIKE '%' || $${i} || '%'
      OR a.razon_social % $${i}
    )`);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

/** Listado público paginado. */
async function list({ q, categoria, ciudad, departamento, pais, page = 1, limit = 20, offset = 0 }) {
  const { where, params } = buildFilters({ q, categoria, ciudad, departamento, pais, soloActivos: true });

  const countSql = `SELECT COUNT(*)::int AS total
                    FROM anuncios a LEFT JOIN categorias c ON c.id = a.categoria_id
                    ${where}`;
  const total = (await query(countSql, params)).rows[0].total;

  const orderRank = q
    ? `ts_rank(a.search_vector, plainto_tsquery('spanish', $${params.length + 1})) DESC, a.created_at DESC`
    : 'a.created_at DESC';

  const dataParams = q ? [...params, q, limit, offset] : [...params, limit, offset];
  const limIdx = dataParams.length - 1;
  const offIdx = dataParams.length;

  const dataSql = `
    SELECT ${PUBLIC_COLS}
    FROM anuncios a LEFT JOIN categorias c ON c.id = a.categoria_id
    ${where}
    ORDER BY ${orderRank}
    LIMIT $${limIdx} OFFSET $${offIdx}`;

  const rows = (await query(dataSql, dataParams)).rows;
  return { rows, total };
}

/** Listado de administrador (todos los estados, con búsqueda). */
async function listAdmin({ q, estado, categoria, page = 1, limit = 20, offset = 0 }) {
  const clauses = [];
  const params = [];
  if (estado) { params.push(estado); clauses.push(`a.estado = $${params.length}`); }
  if (categoria) { params.push(categoria); clauses.push(`c.slug = $${params.length}`); }
  if (q) {
    params.push(q);
    clauses.push(`(a.razon_social ILIKE '%' || $${params.length} || '%'
      OR a.email ILIKE '%' || $${params.length} || '%'
      OR a.ciudad ILIKE '%' || $${params.length} || '%')`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const total = (await query(
    `SELECT COUNT(*)::int AS total FROM anuncios a LEFT JOIN categorias c ON c.id = a.categoria_id ${where}`,
    params
  )).rows[0].total;

  const dataParams = [...params, limit, offset];
  const sql = `
    SELECT ${PUBLIC_COLS}, a.aviso_30_enviado,
      (SELECT COUNT(*)::int FROM fotos f WHERE f.anuncio_id = a.id) AS total_fotos
    FROM anuncios a LEFT JOIN categorias c ON c.id = a.categoria_id
    ${where}
    ORDER BY a.created_at DESC
    LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;
  const rows = (await query(sql, dataParams)).rows;
  return { rows, total };
}

const findBySlug = async (slug) => {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLS} FROM anuncios a
     LEFT JOIN categorias c ON c.id = a.categoria_id
     WHERE a.slug = $1 LIMIT 1`,
    [slug]
  );
  return rows[0] || null;
};

const findById = async (id) => {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLS}, a.aviso_30_enviado FROM anuncios a
     LEFT JOIN categorias c ON c.id = a.categoria_id
     WHERE a.id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

const slugExists = async (slug, exceptId = null) => {
  const { rows } = exceptId
    ? await query('SELECT 1 FROM anuncios WHERE slug = $1 AND id <> $2 LIMIT 1', [slug, exceptId])
    : await query('SELECT 1 FROM anuncios WHERE slug = $1 LIMIT 1', [slug]);
  return rows.length > 0;
};

const create = async (data) => {
  const { rows } = await query(
    `INSERT INTO anuncios
      (razon_social, slug, descripcion_50, direccion, telefono_fijo, telefono_movil, email,
       sitio_web, youtube, facebook, instagram, tiktok, otras_redes, categoria_id,
       ciudad, pais, latitud, longitud, palabras_clave, estado, fecha_inicio, fecha_vencimiento)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     RETURNING id`,
    [
      data.razon_social, data.slug, data.descripcion_50, data.direccion, data.telefono_fijo,
      data.telefono_movil, data.email, data.sitio_web, data.youtube, data.facebook,
      data.instagram, data.tiktok, data.otras_redes || null, data.categoria_id, data.ciudad,
      data.pais, data.latitud, data.longitud, data.palabras_clave, data.estado || 'activo',
      data.fecha_inicio, data.fecha_vencimiento,
    ]
  );
  return rows[0].id;
};

const update = async (id, data) => {
  const { rows } = await query(
    `UPDATE anuncios SET
      razon_social = $2, slug = $3, descripcion_50 = $4, direccion = $5,
      telefono_fijo = $6, telefono_movil = $7, email = $8, sitio_web = $9,
      youtube = $10, facebook = $11, instagram = $12, tiktok = $13, otras_redes = $14,
      categoria_id = $15, ciudad = $16, pais = $17, latitud = $18, longitud = $19,
      palabras_clave = $20, estado = $21, fecha_inicio = $22, fecha_vencimiento = $23
     WHERE id = $1 RETURNING id`,
    [
      id, data.razon_social, data.slug, data.descripcion_50, data.direccion, data.telefono_fijo,
      data.telefono_movil, data.email, data.sitio_web, data.youtube, data.facebook,
      data.instagram, data.tiktok, data.otras_redes || null, data.categoria_id, data.ciudad,
      data.pais, data.latitud, data.longitud, data.palabras_clave, data.estado,
      data.fecha_inicio, data.fecha_vencimiento,
    ]
  );
  return rows[0] || null;
};

const remove = async (id) => {
  await query('DELETE FROM anuncios WHERE id = $1', [id]);
};

const setEstado = async (id, estado) => {
  await query('UPDATE anuncios SET estado = $2 WHERE id = $1', [id, estado]);
};

const setVencimiento = async (id, fecha) => {
  await query(
    `UPDATE anuncios SET fecha_vencimiento = $2, estado = 'activo', aviso_30_enviado = FALSE
     WHERE id = $1`,
    [id, fecha]
  );
};

const registrarCambio = async (id) => {
  const { rows } = await query(
    `UPDATE anuncios SET cambios_usados = LEAST(cambios_usados + 1, 6)
     WHERE id = $1 RETURNING cambios_usados`,
    [id]
  );
  return rows[0]?.cambios_usados ?? null;
};

/** Anuncios activos que vencen dentro de N días y aún no se avisó. */
const findExpiring = async (dias = 30) => {
  const { rows } = await query(
    `SELECT id, razon_social, slug, email, fecha_vencimiento
     FROM anuncios
     WHERE estado = 'activo'
       AND aviso_30_enviado = FALSE
       AND fecha_vencimiento BETWEEN CURRENT_DATE AND (CURRENT_DATE + ($1 || ' days')::interval)
     ORDER BY fecha_vencimiento ASC`,
    [dias]
  );
  return rows;
};

const markAvisoEnviado = async (ids) => {
  if (!ids.length) return;
  await query('UPDATE anuncios SET aviso_30_enviado = TRUE WHERE id = ANY($1::bigint[])', [ids]);
};

/** Marca como vencidos los anuncios cuya fecha pasó. Devuelve las filas afectadas. */
const marcarVencidos = async () => {
  const { rows } = await query(
    `UPDATE anuncios SET estado = 'vencido'
     WHERE estado = 'activo' AND fecha_vencimiento < CURRENT_DATE
     RETURNING id, razon_social`
  );
  return rows;
};

/** Todas las URLs activas para el sitemap. */
const allActiveForSitemap = async () => {
  const { rows } = await query(
    `SELECT slug, updated_at FROM anuncios WHERE estado = 'activo' ORDER BY updated_at DESC`
  );
  return rows;
};

const stats = async () => {
  const { rows } = await query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE estado = 'activo')::int AS activos,
      COUNT(*) FILTER (WHERE estado = 'vencido')::int AS vencidos,
      COUNT(*) FILTER (WHERE estado = 'deshabilitado')::int AS deshabilitados,
      COUNT(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes
    FROM anuncios`);
  return rows[0];
};

module.exports = {
  list, listAdmin, findBySlug, findById, slugExists, create, update, remove,
  setEstado, setVencimiento, registrarCambio, findExpiring, markAvisoEnviado,
  marcarVencidos, allActiveForSitemap, stats,
};
