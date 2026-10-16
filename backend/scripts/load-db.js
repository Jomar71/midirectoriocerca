/**
 * scripts/load-db.js
 * Aplica database.sql sobre la base de datos apuntada por DATABASE_URL
 * (ideal para bases gestionadas en la nube, donde no se puede CREATE DATABASE).
 * No crea la base de datos. Uso: npm run db:load
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const env = require('../config/env');

const SQL_FILE = path.resolve(__dirname, '..', '..', 'database.sql');

(async () => {
  const config = env.db.connectionString
    ? { connectionString: env.db.connectionString, ssl: env.db.ssl }
    : {
        host: env.db.host,
        port: env.db.port,
        user: env.db.user,
        password: env.db.password,
        database: env.db.database,
        ssl: env.db.ssl,
      };

  const client = new Client(config);
  try {
    await client.connect();
    await client.query(fs.readFileSync(SQL_FILE, 'utf8'));
    console.log('[load-db] Esquema, índices, categorías y catálogo aplicados correctamente.');
  } catch (e) {
    console.error('[load-db] Error:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
