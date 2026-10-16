/**
 * models/foto.model.js
 */
'use strict';

const { query } = require('../config/db');

const listByAnuncio = async (anuncioId) => {
  const { rows } = await query(
    'SELECT id, anuncio_id, url, public_id, orden FROM fotos WHERE anuncio_id = $1 ORDER BY orden ASC, id ASC',
    [anuncioId]
  );
  return rows;
};

const countByAnuncio = async (anuncioId) => {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS n FROM fotos WHERE anuncio_id = $1',
    [anuncioId]
  );
  return rows[0].n;
};

const add = async (anuncioId, url, publicId, orden) => {
  const { rows } = await query(
    'INSERT INTO fotos (anuncio_id, url, public_id, orden) VALUES ($1, $2, $3, $4) RETURNING *',
    [anuncioId, url, publicId || null, orden]
  );
  return rows[0];
};

const nextOrden = async (anuncioId) => {
  const { rows } = await query(
    'SELECT COALESCE(MAX(orden), -1) + 1 AS next FROM fotos WHERE anuncio_id = $1',
    [anuncioId]
  );
  return rows[0].next;
};

const findById = async (id) => {
  const { rows } = await query('SELECT * FROM fotos WHERE id = $1', [id]);
  return rows[0] || null;
};

const remove = async (id) => {
  await query('DELETE FROM fotos WHERE id = $1', [id]);
};

const removeByAnuncio = async (anuncioId) => {
  await query('DELETE FROM fotos WHERE anuncio_id = $1', [anuncioId]);
};

const reorder = async (anuncioId, orderedIds) => {
  const { withTransaction } = require('../config/db');
  await withTransaction(async (client) => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await client.query('UPDATE fotos SET orden = $2 WHERE id = $1 AND anuncio_id = $3', [
        orderedIds[i], i, anuncioId,
      ]);
    }
  });
};

module.exports = { listByAnuncio, countByAnuncio, add, nextOrden, findById, remove, removeByAnuncio, reorder };
