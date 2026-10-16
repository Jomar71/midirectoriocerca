/**
 * models/suscripcion.model.js
 */
'use strict';

const { query } = require('../config/db');

const create = async ({ anuncioId, fechaInicio, fechaFin }) => {
  const { rows } = await query(
    `INSERT INTO suscripciones (anuncio_id, fecha_inicio, fecha_fin)
     VALUES ($1, $2, $3) RETURNING *`,
    [anuncioId, fechaInicio, fechaFin]
  );
  return rows[0];
};

const listByAnuncio = async (anuncioId) => {
  const { rows } = await query(
    'SELECT * FROM suscripciones WHERE anuncio_id = $1 ORDER BY fecha_inicio DESC',
    [anuncioId]
  );
  return rows;
};

const listVencidas = async () => {
  const { rows } = await query(
    `SELECT s.*, a.razon_social FROM suscripciones s
     JOIN anuncios a ON a.id = s.anuncio_id
     WHERE s.estado = 'activa' AND s.fecha_fin < CURRENT_DATE`
  );
  return rows;
};

const setEstado = async (id, estado) => {
  await query('UPDATE suscripciones SET estado = $2 WHERE id = $1', [id, estado]);
};

module.exports = { create, listByAnuncio, listVencidas, setEstado };
