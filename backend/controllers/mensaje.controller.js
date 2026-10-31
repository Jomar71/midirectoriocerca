/**
 * controllers/mensaje.controller.js
 * Formulario de contacto público (secretaría 24/7) y gestión de mensajes por el admin.
 */
'use strict';

const mensajeModel = require('../models/mensaje.model');
const anuncioModel = require('../models/anuncio.model');
const mailService = require('../services/mail.service');
const { parsePagination, buildMeta } = require('../utils/pagination');
const S = require('../utils/sanitize');

/** POST /api/contacto → guarda el mensaje y envía correo real. */
async function crear(req, res, next) {
  try {
    const nombre = S.cleanText(req.body.nombre, 120);
    const email = S.cleanText(req.body.email, 190);
    const telefono = S.cleanText(req.body.telefono, 40);
    const mensaje = S.cleanMultiline(req.body.mensaje, 3000);
    let anuncioId = parseInt(req.body.anuncio_id, 10) || null;
    const slug = S.cleanText(req.body.anuncio_slug, 220);

    if (!nombre || !S.isEmail(email) || !mensaje) {
      return res.status(422).json({ ok: false, error: 'Completa nombre, email válido y mensaje.' });
    }

    let anuncioNombre = 'DirectorioCerca';
    if (!anuncioId && slug) {
      const a = await anuncioModel.findBySlug(slug);
      if (a) { anuncioId = a.id; anuncioNombre = a.razon_social; }
    } else if (anuncioId) {
      const a = await anuncioModel.findById(anuncioId);
      if (a) anuncioNombre = a.razon_social;
    }

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip;
    await mensajeModel.create({ anuncioId, nombre, email, telefono, mensaje, ip });

    mailService.notifyNewMessage({ anuncio: anuncioNombre, nombre, email, telefono, mensaje })
      .then((result) => {
        if (!result.sent) console.warn('[mail] La solicitud se guardó, pero el transporte actual no envía correo real.');
      })
      .catch((e) => console.warn('[mail] No se pudo notificar al admin:', e.message));

    const responseMessage = '¡Gracias! Recibimos tu solicitud y nos pondremos en contacto contigo pronto.';
    return res.status(201).json({ ok: true, message: responseMessage });
  } catch (e) {
    return next(e);
  }
}

/** GET /api/admin/mensajes */
async function listAdmin(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const data = await mensajeModel.listAdmin({ leido: req.query.leido, page, limit, offset });
    return res.json({ ok: true, data: data.rows, pagination: buildMeta(data.total, page, limit) });
  } catch (e) { next(e); }
}

async function marcarLeido(req, res, next) {
  try {
    const leido = req.body.leido === undefined ? true : !!req.body.leido;
    await mensajeModel.marcarLeido(req.params.id, leido);
    return res.json({ ok: true });
  } catch (e) { next(e); }
}

async function eliminar(req, res, next) {
  try {
    await mensajeModel.remove(req.params.id);
    return res.json({ ok: true });
  } catch (e) { next(e); }
}

/** POST /api/admin/mensajes/:id/responder → responde por correo. */
async function responder(req, res, next) {
  try {
    const msg = await mensajeModel.findById(req.params.id);
    if (!msg) return res.status(404).json({ ok: false, error: 'Mensaje no encontrado.' });
    const respuesta = S.cleanMultiline(req.body.respuesta, 3000);
    if (!respuesta) return res.status(422).json({ ok: false, error: 'Escribe una respuesta.' });

    await mailService.sendReply({
      to: msg.email, nombre: msg.nombre, mensajeOriginal: msg.mensaje, respuesta,
    });
    await mensajeModel.marcarLeido(msg.id, true);
    return res.json({ ok: true, message: 'Respuesta enviada.' });
  } catch (e) { next(e); }
}

module.exports = { crear, listAdmin, marcarLeido, eliminar, responder };
