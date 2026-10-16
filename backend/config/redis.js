/**
 * config/redis.js
 * Cliente Redis opcional (caché de consultas frecuentes).
 * Si REDIS_ENABLED=false o falla la conexión, el sistema funciona sin caché.
 */
'use strict';

const env = require('./env');

let client = null;
let ready = false;

async function initRedis() {
  if (!env.redis.enabled) {
    console.log('[redis] Deshabilitado (REDIS_ENABLED=false).');
    return null;
  }
  try {
    const Redis = require('ioredis');
    client = new Redis(env.redis.url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
    });
    client.on('ready', () => { ready = true; console.log('[redis] Conectado.'); });
    client.on('error', (e) => { ready = false; console.warn('[redis] Error:', e.message); });
    client.on('end', () => { ready = false; });
    await client.connect();
    return client;
  } catch (e) {
    console.warn('[redis] No se pudo inicializar, se continúa sin caché:', e.message);
    ready = false;
    client = null;
    return null;
  }
}

const isReady = () => env.redis.enabled && ready && client;

async function get(key) {
  if (!isReady()) return null;
  try {
    const val = await client.get(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

async function set(key, value, ttl = env.redis.ttl) {
  if (!isReady()) return;
  try { await client.set(key, JSON.stringify(value), 'EX', ttl); } catch { /* noop */ }
}

/** Invalida todas las claves de un patrón (p. ej. "anuncios:*"). */
async function delByPattern(pattern) {
  if (!isReady()) return;
  try {
    const stream = client.scanStream({ match: pattern, count: 100 });
    const keys = [];
    for await (const chunk of stream) keys.push(...chunk);
    if (keys.length) await client.del(keys);
  } catch { /* noop */ }
}

module.exports = { initRedis, get, set, delByPattern, isReady };
