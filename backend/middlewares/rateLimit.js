/**
 * middlewares/rateLimit.js
 * Limitación de peticiones para proteger login, contacto y API.
 */
'use strict';

const rateLimit = require('express-rate-limit');

const message = (msg) => ({ ok: false, error: msg });

/** Login del administrador: máximo 5 intentos por 15 min por IP. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('Demasiados intentos de inicio de sesión. Inténtalo en 15 minutos.'),
  skipSuccessfulRequests: true,
});

/** Formulario de contacto: 5 mensajes por hora por IP. */
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('Has enviado demasiados mensajes. Espera una hora antes de reintentar.'),
});

/** API general: 300 peticiones por 15 min por IP. */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('Demasiadas peticiones. Inténtalo más tarde.'),
});

module.exports = { loginLimiter, contactLimiter, apiLimiter };
