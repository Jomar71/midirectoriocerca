/**
 * models/categoria.model.js
 */
'use strict';

const { query } = require('../config/db');

const list = async () => {
  const { rows } = await query(
    `SELECT c.*, COUNT(a.id) FILTER (WHERE a.estado = 'activo')::int AS total_anuncios
     FROM categorias c
     LEFT JOIN anuncios a ON a.categoria_id = c.id
     GROUP BY c.id
     ORDER BY c.orden ASC, c.nombre ASC`
  );
  return rows;
};

const listSimple = async () => {
  const { rows } = await query('SELECT id, nombre, slug, icono FROM categorias ORDER BY orden, nombre');
  return rows;
};

const findById = async (id) => {
  const { rows } = await query('SELECT * FROM categorias WHERE id = $1', [id]);
  return rows[0] || null;
};

const findBySlug = async (slug) => {
  const { rows } = await query('SELECT * FROM categorias WHERE slug = $1', [slug]);
  return rows[0] || null;
};

const create = async ({ nombre, slug, icono }) => {
  const { rows } = await query(
    'INSERT INTO categorias (nombre, slug, icono) VALUES ($1, $2, $3) RETURNING *',
    [nombre, slug, icono || null]
  );
  return rows[0];
};

const update = async (id, { nombre, slug, icono, orden }) => {
  const { rows } = await query(
    `UPDATE categorias SET nombre = $2, slug = $3, icono = $4, orden = COALESCE($5, orden)
     WHERE id = $1 RETURNING *`,
    [id, nombre, slug, icono || null, orden ?? null]
  );
  return rows[0] || null;
};

const remove = async (id) => {
  await query('DELETE FROM categorias WHERE id = $1', [id]);
};

module.exports = { list, listSimple, findById, findBySlug, create, update, remove };
