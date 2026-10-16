/**
 * models/mensaje.model.js
 */
'use strict';

const { query } = require('../config/db');

const create = async ({ anuncioId, nombre, email, telefono, mensaje, ip }) => {
  const { rows } = await query(
    `INSERT INTO mensajes (anuncio_id, nombre, email, telefono, mensaje, ip)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [anuncioId || null, nombre, email, telefono || null, mensaje, ip || null]
  );
  return rows[0].id;
};

const listAdmin = async ({ leido, page = 1, limit = 20, offset = 0 }) => {
  const clauses = [];
  const params = [];
  if (leido === 'true' || leido === true) { clauses.push('m.leido = TRUE'); }
  if (leido === 'false' || leido === false) { clauses.push('m.leido = FALSE'); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const total = (await query(`SELECT COUNT(*)::int AS total FROM mensajes m ${where}`, params)).rows[0].total;
  const dataParams = [...params, limit, offset];
  const { rows } = await query(
    `SELECT m.*, a.razon_social, a.slug AS anuncio_slug
     FROM mensajes m LEFT JOIN anuncios a ON a.id = m.anuncio_id
     ${where}
     ORDER BY m.fecha DESC
     LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    dataParams
  );
  return { rows, total };
};

const findById = async (id) => {
  const { rows } = await query(
    `SELECT m.*, a.razon_social, a.slug AS anuncio_slug
     FROM mensajes m LEFT JOIN anuncios a ON a.id = m.anuncio_id
     WHERE m.id = $1`,
    [id]
  );
  return rows[0] || null;
};

const marcarLeido = async (id, leido = true) => {
  await query('UPDATE mensajes SET leido = $2 WHERE id = $1', [id, leido]);
};

const remove = async (id) => {
  await query('DELETE FROM mensajes WHERE id = $1', [id]);
};

const countNoLeidos = async () => {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM mensajes WHERE leido = FALSE');
  return rows[0].n;
};

module.exports = { create, listAdmin, findById, marcarLeido, remove, countNoLeidos };
