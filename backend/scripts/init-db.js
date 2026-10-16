/**
 * scripts/init-db.js
 * Crea la base de datos (si no existe) y ejecuta database.sql.
 * Uso: npm run db:init
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const env = require('../config/env');

const SQL_FILE = path.resolve(__dirname, '..', '..', 'database.sql');

function baseConfig(database) {
  return env.db.connectionString
    ? { connectionString: env.db.connectionString, ssl: env.db.ssl }
    : {
        host: env.db.host,
        port: env.db.port,
        user: env.db.user,
        password: env.db.password,
        database,
        ssl: env.db.ssl,
      };
}

async function ensureDatabase() {
  const admin = new Client(baseConfig('postgres'));
  await admin.connect();
  const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [env.db.database]);
  if (rows.length === 0) {
    // El nombre de la BD no se puede parametrizar; se valida contra inyección.
    const safe = env.db.database.replace(/[^a-zA-Z0-9_]/g, '');
    await admin.query(`CREATE DATABASE "${safe}"`);
    console.log(`[init-db] Base de datos "${safe}" creada.`);
  } else {
    console.log(`[init-db] La base de datos "${env.db.database}" ya existe.`);
  }
  await admin.end();
}

async function runSchema() {
  const sql = fs.readFileSync(SQL_FILE, 'utf8');
  const client = new Client(baseConfig(env.db.database));
  await client.connect();
  await client.query(sql);      // protocolo simple: admite múltiples sentencias
  await client.end();
  console.log('[init-db] Esquema, índices y categorías aplicados correctamente.');
}

(async () => {
  try {
    await ensureDatabase();
    await runSchema();
    console.log('[init-db] Listo. Ejecuta ahora: npm run db:seed');
  } catch (e) {
    console.error('[init-db] Error:', e.message);
    process.exit(1);
  }
})();
