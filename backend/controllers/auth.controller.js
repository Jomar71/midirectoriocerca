/**
 * controllers/auth.controller.js
 * Login/logout del administrador único.
 */
'use strict';

const bcrypt = require('bcryptjs');
const adminModel = require('../models/admin.model');
const { signToken, setAuthCookie, clearAuthCookie } = require('../middlewares/auth');

async function login(req, res, next) {
  try {
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '');

    const admin = await adminModel.findByEmail(email);
    // Comparación en tiempo constante para no filtrar si el email existe.
    const hash = admin ? admin.password_hash : '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid';
    const ok = await bcrypt.compare(password, hash);

    if (!admin || !ok) {
      return res.status(401).json({ ok: false, error: 'Credenciales incorrectas.' });
    }

    const token = signToken({ id: admin.id, email: admin.email, role: 'admin' });
    setAuthCookie(res, token);
    await adminModel.touchLastLogin(admin.id);

    return res.json({ ok: true, admin: { id: admin.id, nombre: admin.nombre, email: admin.email } });
  } catch (e) {
    return next(e);
  }
}

function logout(req, res) {
  clearAuthCookie(res);
  return res.json({ ok: true });
}

async function me(req, res) {
  const admin = await adminModel.findById(req.admin.id);
  if (!admin) return res.status(401).json({ ok: false, error: 'No autenticado.' });
  return res.json({ ok: true, admin: { id: admin.id, nombre: admin.nombre, email: admin.email } });
}

async function changePassword(req, res, next) {
  try {
    const { actual, nueva } = req.body;
    if (!nueva || String(nueva).length < 8) {
      return res.status(422).json({ ok: false, error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    }
    const admin = await adminModel.findById(req.admin.id);
    const ok = await bcrypt.compare(String(actual || ''), admin.password_hash);
    if (!ok) return res.status(401).json({ ok: false, error: 'La contraseña actual no es correcta.' });

    const hash = await bcrypt.hash(String(nueva), 12);
    await adminModel.updatePassword(admin.id, hash);
    return res.json({ ok: true, message: 'Contraseña actualizada.' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { login, logout, me, changePassword };
