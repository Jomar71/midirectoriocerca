/**
 * middlewares/auth.js
 * Autenticación del administrador único mediante JWT en cookie httpOnly.
 */
'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signToken(payload) {
  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

/** Establece la cookie de sesión segura. */
function setAuthCookie(res, token) {
  res.cookie(env.jwt.cookieName, token, {
    httpOnly: true,
    secure: env.isProd,          // solo HTTPS en producción
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8,  // 8 horas
    path: '/',
  });
}

function clearAuthCookie(res) {
  res.clearCookie(env.jwt.cookieName, { path: '/' });
}

/** Extrae y verifica el token de la cookie o cabecera Authorization. */
function getToken(req) {
  if (req.cookies && req.cookies[env.jwt.cookieName]) return req.cookies[env.jwt.cookieName];
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

/** Middleware: exige un administrador autenticado. */
function requireAdmin(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: 'No autenticado.' });
  }
  try {
    const payload = jwt.verify(token, env.jwt.secret);
    if (payload.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Acceso denegado.' });
    }
    req.admin = { id: payload.id, email: payload.email };
    return next();
  } catch {
    clearAuthCookie(res);
    return res.status(401).json({ ok: false, error: 'Sesión expirada o inválida.' });
  }
}

/** Para vistas HTML: redirige al login si no hay sesión. */
function requireAdminPage(req, res, next) {
  const token = getToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, env.jwt.secret);
      if (payload.role === 'admin') { req.admin = payload; return next(); }
    } catch { /* inválido */ }
  }
  return res.redirect('/admin/login');
}

module.exports = {
  signToken, setAuthCookie, clearAuthCookie, getToken, requireAdmin, requireAdminPage,
};
