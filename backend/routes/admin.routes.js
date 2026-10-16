/**
 * routes/admin.routes.js
 * Rutas del panel. TODAS protegidas con requireAdmin (solo el administrador).
 */
'use strict';

const express = require('express');
const multer = require('multer');
const adminCtrl = require('../controllers/admin.controller');
const mensajeCtrl = require('../controllers/mensaje.controller');
const csvCtrl = require('../controllers/csv.controller');
const { requireAdmin } = require('../middlewares/auth');
const { fotosUpload } = require('../middlewares/upload');

const router = express.Router();

// Toda la API del panel exige sesión de administrador.
router.use('/api/admin', requireAdmin);

// ── Dashboard ───────────────────────────────────────────────────────────
router.get('/api/admin/dashboard', adminCtrl.dashboard);

// ── Anuncios ────────────────────────────────────────────────────────────
router.get('/api/admin/anuncios', adminCtrl.listAnuncios);
router.post('/api/admin/anuncios', fotosUpload, adminCtrl.createAnuncio);
router.get('/api/admin/anuncios/:id', adminCtrl.getAnuncio);
router.put('/api/admin/anuncios/:id', fotosUpload, adminCtrl.updateAnuncio);
router.delete('/api/admin/anuncios/:id', adminCtrl.deleteAnuncio);
router.patch('/api/admin/anuncios/:id/estado', adminCtrl.setEstado);
router.post('/api/admin/anuncios/:id/renovar', adminCtrl.renovar);

// ── Fotos ───────────────────────────────────────────────────────────────
router.post('/api/admin/anuncios/:id/fotos', fotosUpload, adminCtrl.subirFotos);
router.put('/api/admin/anuncios/:id/fotos/orden', adminCtrl.reordenarFotos);
router.delete('/api/admin/fotos/:id', adminCtrl.eliminarFoto);

// ── Categorías ──────────────────────────────────────────────────────────
router.get('/api/admin/categorias', adminCtrl.listCategorias);
router.post('/api/admin/categorias', adminCtrl.createCategoria);
router.put('/api/admin/categorias/:id', adminCtrl.updateCategoria);
router.delete('/api/admin/categorias/:id', adminCtrl.deleteCategoria);

// ── Mensajes ────────────────────────────────────────────────────────────
router.get('/api/admin/mensajes', mensajeCtrl.listAdmin);
router.patch('/api/admin/mensajes/:id/leido', mensajeCtrl.marcarLeido);
router.post('/api/admin/mensajes/:id/responder', mensajeCtrl.responder);
router.delete('/api/admin/mensajes/:id', mensajeCtrl.eliminar);

// ── Importación CSV ─────────────────────────────────────────────────────
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
router.post('/api/admin/importar-csv', csvUpload.single('archivo'), csvCtrl.importar);

module.exports = router;
