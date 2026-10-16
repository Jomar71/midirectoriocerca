/**
 * services/cron.service.js
 * Tareas programadas diarias:
 *   1) Marca como "vencido" los anuncios cuya fecha_vencimiento ya pasó.
 *   2) Envía al administrador un aviso 30 días antes del vencimiento.
 */
'use strict';

const cron = require('node-cron');
const env = require('../config/env');
const anuncioModel = require('../models/anuncio.model');
const mailService = require('./mail.service');

async function runDailyChecks() {
  try {
    const vencidos = await anuncioModel.marcarVencidos();
    if (vencidos.length) {
      console.log(`[cron] ${vencidos.length} anuncio(s) marcados como vencidos.`);
    }

    const porVencer = await anuncioModel.findExpiring(env.cron.expiryWarningDays);
    if (porVencer.length) {
      await mailService.notifyExpiring(porVencer);
      await anuncioModel.markAvisoEnviado(porVencer.map((a) => a.id));
      console.log(`[cron] Aviso enviado por ${porVencer.length} anuncio(s) próximo(s) a vencer.`);
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

module.exports = { startCron, runDailyChecks };
