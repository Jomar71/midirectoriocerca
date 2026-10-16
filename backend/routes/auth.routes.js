/**
 * routes/auth.routes.js
 * Autenticación y páginas de acceso al panel (solo el administrador).
 */
'use strict';

const express = require('express');
const { body } = require('express-validator');
const authCtrl = require('../controllers/auth.controller');
const { handleValidation } = require('../middlewares/validate');
const { loginLimiter } = require('../middlewares/rateLimit');
const { requireAdmin, requireAdminPage } = require('../middlewares/auth');

const router = express.Router();

// ── Páginas ─────────────────────────────────────────────────────────────
router.get('/admin/login', (req, res) => {
  res.render('admin-login', { title: 'Acceso administrador', error: null });
});

router.get('/admin', (req, res) => res.redirect('/admin/panel'));

router.get('/admin/panel', requireAdminPage, (req, res) => {
  res.render('admin-panel', { title: 'Panel de administración', panelApi: '/api/admin' });
});

// ── API de sesión ───────────────────────────────────────────────────────
router.post(
  '/api/auth/login',
  loginLimiter,
  [
    body('email').trim().isEmail().withMessage('Email inválido.'),
    body('password').notEmpty().withMessage('La contraseña es obligatoria.'),
  ],
  handleValidation,
  authCtrl.login
);

router.post('/api/auth/logout', authCtrl.logout);
router.get('/api/auth/me', requireAdmin, authCtrl.me);
router.post('/api/auth/password', requireAdmin, authCtrl.changePassword);

module.exports = router;
