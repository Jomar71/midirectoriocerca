/**
 * middlewares/error.js
 * Manejo centralizado de errores y rutas no encontradas.
 */
'use strict';

const env = require('../config/env');

function notFound(req, res, next) {
  // Si es una petición de API, responde JSON; si no, página 404.
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'Recurso no encontrado.' });
  }
  return res.status(404).render('404', { title: 'Página no encontrada' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('[error]', err);

  let message = err.message || 'Error interno del servidor.';
  if (err.type === 'entity.too.large') {
    message = 'El archivo o la solicitud es demasiado grande.';
    return res.status(413).json({ ok: false, error: message });
  }

  const payload = {
    ok: false,
    error: status >= 500 && env.isProd ? 'Error interno del servidor.' : message,
  };

  if (req.path.startsWith('/api/')) {
    return res.status(status).json(payload);
  }
  return res.status(status).render('error', {
    title: 'Error',
    status,
    message: payload.error,
  });
}

module.exports = { notFound, errorHandler };
