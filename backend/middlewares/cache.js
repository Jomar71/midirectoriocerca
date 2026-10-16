/**
 * middlewares/cache.js
 * Caché HTTP opcional con Redis para respuestas GET de la API pública.
 * Si Redis no está disponible, simplemente pasa al siguiente middleware.
 */
'use strict';

const redis = require('../config/redis');
const env = require('../config/env');

/**
 * @param {string} prefix  prefijo de las claves (p. ej. "anuncios")
 * @param {number} ttl     segundos de vida
 */
function cache(prefix, ttl = env.redis.ttl) {
  return async (req, res, next) => {
    if (!redis.isReady() || req.method !== 'GET') return next();

    const key = `${prefix}:${req.originalUrl}`;
    const cached = await redis.get(key);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    res.set('X-Cache', 'MISS');
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Solo cachea respuestas exitosas
      if (res.statusCode === 200 && body && body.ok !== false) {
        redis.set(key, body, ttl).catch(() => {});
      }
      return originalJson(body);
    };
    return next();
  };
}

/** Invalida el caché público (llamar tras cambios del admin). */
async function invalidatePublicCache() {
  await redis.delByPattern('anuncios:*');
  await redis.delByPattern('categorias:*');
  await redis.delByPattern('ubicaciones:*');
}

module.exports = { cache, invalidatePublicCache };
