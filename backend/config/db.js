/**
 * config/db.js
 * Pool de conexiones PostgreSQL (node-postgres).
 * Todas las consultas usan parámetros ($1, $2 ...) para evitar SQL Injection.
 */
'use strict';

const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  ...(env.db.connectionString
    ? { connectionString: env.db.connectionString }
    : {
        host: env.db.host,
        port: env.db.port,
        user: env.db.user,
        password: env.db.password,
        database: env.db.database,
      }),
  ssl: env.db.ssl,
  max: 20,                      // máximo de conexiones concurrentes
  idleTimeoutMillis: 30000,     // cierra conexiones inactivas
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  // No tumbamos el proceso por un error de una conexión ociosa.
  console.error('[db] Error inesperado en cliente PostgreSQL:', err.message);
});

/**
 * Helper de consulta.
 * @param {string} text  SQL con placeholders $1, $2...
 * @param {Array}  params valores
 */
const query = (text, params) => pool.query(text, params);

/**
 * Ejecuta un callback dentro de una transacción.
 */
const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const testConnection = async () => {
  const { rows } = await pool.query('SELECT NOW() AS now');
  return rows[0].now;
};

module.exports = { pool, query, withTransaction, testConnection };
