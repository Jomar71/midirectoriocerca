/**
 * routes/public.routes.js
 * Rutas públicas: páginas renderizadas (SEO) y API de solo lectura + contacto.
 */
'use strict';

const express = require('express');
const { body } = require('express-validator');
const anuncioCtrl = require('../controllers/anuncio.controller');
const mensajeCtrl = require('../controllers/mensaje.controller');
const { handleValidation } = require('../middlewares/validate');
const { contactLimiter } = require('../middlewares/rateLimit');
const { cache } = require('../middlewares/cache');

const router = express.Router();

// ── Páginas (server-side para SEO) ──────────────────────────────────────
router.get('/', anuncioCtrl.renderIndex);
router.get('/anuncio/:slug', anuncioCtrl.renderAnuncio);
router.get('/nosotros', (_req, res) => res.render('nosotros', { titulo: 'Nosotros — Quiénes somos | DirectorioCerca' }));
router.get('/terminos', (_req, res) => res.render('terminos', { titulo: 'Términos y condiciones | DirectorioCerca' }));
router.get('/privacidad', (_req, res) => res.render('privacidad', { titulo: 'Políticas y privacidad | DirectorioCerca' }));
router.get('/contacto', (_req, res) => res.render('contacto', { titulo: 'Contáctanos | DirectorioCerca' }));

// ── API pública ─────────────────────────────────────────────────────────
router.get('/api/anuncios', cache('anuncios'), anuncioCtrl.apiList);
router.get('/api/anuncios/:slug', anuncioCtrl.apiGet);
router.get('/api/categorias', cache('categorias'), anuncioCtrl.apiCategorias);
router.get('/api/ubicaciones', cache('ubicaciones'), anuncioCtrl.apiUbicaciones);

// Formulario de contacto (secretaría 24/7)
router.post(
  '/api/contacto',
  contactLimiter,
  [
    body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio.').isLength({ max: 120 }),
    body('email').trim().isEmail().withMessage('Email inválido.'),
    body('mensaje').trim().notEmpty().withMessage('El mensaje es obligatorio.').isLength({ max: 3000 }),
  ],
  handleValidation,
  mensajeCtrl.crear
);

module.exports = router;
