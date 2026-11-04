/**
 * services/cron.service.js
 * Tareas programadas diarias (por defecto 8:00 AM):
 *   1) Marca como "vencido" los anuncios cuya fecha_vencimiento ya pasó.
 *   2) Envía notificación estrictamente privada al cliente (Email + WhatsApp)
 *      cuando faltan 30 días para su vencimiento.
 *   3) Actualiza el estado de notificación en la BD para evitar duplicados.
 */
'use strict';

const cron = require('node-cron');
const env = require('../config/env');
const anuncioModel = require('../models/anuncio.model');
const mailService = require('./mail.service');
const whatsappService = require('./whatsapp.service');
const S = require('../utils/sanitize');

/**
 * Envía un aviso privado de renovación a un cliente específico por Correo y WhatsApp.
 */
async function enviarAvisoPrivadoCliente(anuncio) {
  const fechaStr = S.formatDateOnly(anuncio.fecha_vencimiento);
  const resultados = { email: null, whatsapp: null };

  // 1. Envío por Email (privado al cliente)
  if (anuncio.email) {
    try {
      resultados.email = await mailService.notifyClientExpiring({
        to: anuncio.email,
        razonSocial: anuncio.razon_social,
        fechaVencimiento: anuncio.fecha_vencimiento,
      });
      console.log(`[notificacion] Email de renovación enviado a ${anuncio.email} (${anuncio.razon_social}).`);
    } catch (err) {
      console.error(`[notificacion] Error enviando email a ${anuncio.email}:`, err.message);
      resultados.email = { error: err.message };
    }
  }

  // 2. Envío por WhatsApp (privado al cliente)
  if (anuncio.telefono_movil) {
    try {
      resultados.whatsapp = await whatsappService.sendWhatsAppMessage({
        phone: anuncio.telefono_movil,
        razonSocial: anuncio.razon_social,
        fechaVencimiento: fechaStr,
      });
    } catch (err) {
      console.error(`[notificacion] Error enviando WhatsApp a ${anuncio.telefono_movil}:`, err.message);
      resultados.whatsapp = { error: err.message };
    }
  }

  // Determinar si al menos un canal fue exitoso o simulado
  const emailOk = resultados.email && !resultados.email.error;
  const waOk = resultados.whatsapp && !resultados.whatsapp.error;
  if (emailOk || waOk) {
    await anuncioModel.markNotificacionEnviada(anuncio.id, 'enviado');
  } else if (!anuncio.email && !anuncio.telefono_movil) {
    await anuncioModel.markNotificacionEnviada(anuncio.id, 'fallido');
  }

  return resultados;
}

async function runDailyChecks() {
  try {
    // 1. Marca como "vencido" los anuncios cuya fecha pasó y sincroniza estados de afiliación
    const vencidos = await anuncioModel.marcarVencidos();
    if (vencidos.length) {
      console.log(`[cron] ${vencidos.length} anuncio(s) marcados como vencidos.`);
    }

    // 2. Busca anuncios a 30 días de vencer con estado_notificacion pendiente
    const porVencer = await anuncioModel.findExpiring(env.cron.expiryWarningDays);
    if (porVencer.length) {
      console.log(`[cron] Procesando avisos privados para ${porVencer.length} cliente(s) a vencer...`);
      for (const cliente of porVencer) {
        // eslint-disable-next-line no-await-in-loop
        await enviarAvisoPrivadoCliente(cliente);
      }

      // Opcional: resumen diario consolidado para el administrador
      try {
        await mailService.notifyExpiring(porVencer);
      } catch (err) {
        console.warn('[cron] No se pudo enviar el resumen al administrador:', err.message);
      }
      console.log(`[cron] Finalizada la notificación privada a los afiliados.`);
    }
  } catch (e) {
    console.error('[cron] Error en la revisión diaria:', e.message);
  }
}

function startCron() {
  if (!cron.validate(env.cron.daily)) {
    console.warn('[cron] Expresión CRON_DAILY inválida:', env.cron.daily);
    return;
  }
  cron.schedule(env.cron.daily, runDailyChecks, { timezone: env.cron.tz });
  console.log(`[cron] Programado con "${env.cron.daily}" en zona ${env.cron.tz}.`);
}

module.exports = { startCron, runDailyChecks, enviarAvisoPrivadoCliente };
