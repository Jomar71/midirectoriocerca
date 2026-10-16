/**
 * models/admin.model.js
 * Acceso a datos del administrador único del sistema.
 */
'use strict';

const { query } = require('../config/db');

const findByEmail = async (email) => {
  const { rows } = await query(
    'SELECT * FROM administrador WHERE LOWER(email) = LOWER($1) LIMIT 1',
    [email]
  );
  return rows[0] || null;
};

const findById = async (id) => {
  const { rows } = await query('SELECT * FROM administrador WHERE id = $1 LIMIT 1', [id]);
  return rows[0] || null;
};

const count = async () => {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM administrador');
  return rows[0].n;
};

const create = async ({ nombre, email, passwordHash }) => {
  const { rows } = await query(
    `INSERT INTO administrador (nombre, email, password_hash)
     VALUES ($1, $2, $3) RETURNING id, nombre, email, created_at`,
    [nombre, email, passwordHash]
  );
  return rows[0];
};

const updatePassword = async (id, passwordHash) => {
  await query('UPDATE administrador SET password_hash = $2 WHERE id = $1', [id, passwordHash]);
};

const touchLastLogin = async (id) => {
  await query('UPDATE administrador SET ultimo_login = NOW() WHERE id = $1', [id]);
};

module.exports = { findByEmail, findById, count, create, updatePassword, touchLastLogin };
