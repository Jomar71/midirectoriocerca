/**
 * models/ubicacion.model.js
 * Catálogo geográfico de Colombia (departamentos y ciudades) cargado desde
 * el dataset oficial DANE – DIVIPOLA. Solo lectura desde la web pública;
 * el catálogo se carga con "npm run db:init".
 */
'use strict';

const { query } = require('../config/db');

/**
 * Departamentos con su capital, número de ciudades y número de anuncios
 * activos publicados en cada uno. La comparación ciudad↔catálogo es tolerante
 * (sin acentos ni mayúsculas) para reconocer datos históricos de texto libre.
 */
const listDepartamentos = async () => {
  const { rows } = await query(
    `SELECT d.id, d.codigo, d.nombre, d.slug, d.capital,
       (SELECT COUNT(*)::int FROM ciudades c WHERE c.departamento_id = d.id) AS total_ciudades,
       (SELECT COUNT(*)::int FROM anuncios a
          WHERE a.estado = 'activo'
            AND a.ciudad IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM ciudades c2
              WHERE c2.departamento_id = d.id
                AND (unaccent(lower(a.ciudad)) = unaccent(lower(c2.nombre))
                     OR unaccent(lower(a.ciudad)) = unaccent(lower(split_part(c2.nombre, ',', 1))))
            )
       ) AS total_anuncios
     FROM departamentos d
     ORDER BY d.nombre ASC`
  );
  return rows;
};

/** Todas las ciudades con el slug/nombre de su departamento (para selects). */
const listCiudades = async () => {
  const { rows } = await query(
    `SELECT c.id, c.departamento_id, c.nombre, c.es_capital, c.tipo,
            d.nombre AS departamento_nombre, d.slug AS departamento_slug
     FROM ciudades c
     JOIN departamentos d ON d.id = c.departamento_id
     ORDER BY d.nombre ASC, c.es_capital DESC, c.nombre ASC`
  );
  return rows;
};

/** Ciudades de un departamento (por slug). */
const listCiudadesByDepartamento = async (slug) => {
  const { rows } = await query(
    `SELECT c.id, c.nombre, c.es_capital, c.tipo, c.latitud, c.longitud
     FROM ciudades c
     JOIN departamentos d ON d.id = c.departamento_id
     WHERE d.slug = $1
     ORDER BY c.es_capital DESC, c.nombre ASC`,
    [slug]
  );
  return rows;
};

const findDepartamentoBySlug = async (slug) => {
  const { rows } = await query('SELECT * FROM departamentos WHERE slug = $1 LIMIT 1', [slug]);
  return rows[0] || null;
};

/**
 * Datos para los menús de filtro de la página pública.
 * @returns {{ departamentos:Array, ciudades:Array, paises:Array }}
 */
const getUbicaciones = async () => {
  const [departamentos, ciudades, paises] = await Promise.all([
    listDepartamentos(),
    listCiudades(),
    query(
      `SELECT pais, COUNT(*)::int AS total FROM anuncios
       WHERE estado = 'activo' AND pais IS NOT NULL
       GROUP BY pais ORDER BY pais ASC`
    ),
  ]);
  return { departamentos, ciudades, paises: paises.rows };
};

/**
 * Agrupa la lista plana de ciudades por departamento (para <optgroup>).
 */
const groupByDepartamento = (ciudades) => {
  const map = new Map();
  for (const c of ciudades) {
    if (!map.has(c.departamento_slug)) {
      map.set(c.departamento_slug, {
        departamento_nombre: c.departamento_nombre,
        departamento_slug: c.departamento_slug,
        ciudades: [],
      });
    }
    map.get(c.departamento_slug).ciudades.push({
      id: c.id,
      nombre: c.nombre,
      es_capital: c.es_capital,
    });
  }
  return [...map.values()];
};

module.exports = {
  listDepartamentos,
  listCiudades,
  listCiudadesByDepartamento,
  findDepartamentoBySlug,
  getUbicaciones,
  groupByDepartamento,
};
