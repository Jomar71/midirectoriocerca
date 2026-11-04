/**
 * services/whatsapp.service.js
 * Servicio de envío de mensajes de WhatsApp a afiliados.
 * Admite integración vía WhatsApp Cloud API (Meta), API/Webhook externa
 * o simulación controlada (con generación de enlace wa.me) si no hay proveedor configurado.
 */
'use strict';

const env = require('../config/env');

/**
 * Normaliza el número telefónico al formato internacional de WhatsApp (sin '+' ni guiones).
 */
function formatWhatsAppNumber(phone) {
  if (!phone) return null;
  const cleaned = String(phone).replace(/[^0-9+]/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('+')) return cleaned.replace(/\+/g, '');
  if (cleaned.startsWith('00')) return cleaned.slice(2);
  // Si es un celular colombiano estándar (10 dígitos que inicia en 3)
  if (/^3\d{9}$/.test(cleaned)) return `57${cleaned}`;
  return cleaned;
}

/**
 * Construye el texto oficial de renovación.
 */
function buildRenewalMessage(razonSocial, fechaVencimientoFormateada) {
  return `Estimado(a) ${razonSocial}, le recordamos que su afiliación a MiDirectorioCerca vence el próximo ${fechaVencimientoFormateada}. Para mantener su ficha activa en nuestro directorio, por favor comuníquese con nosotros para realizar su renovación. Estamos a su disposición. Atentamente, El equipo de MiDirectorioCerca.`;
}

/**
 * Envía un mensaje privado por WhatsApp.
 * @returns {Promise<{ sent: boolean, simulated: boolean, waUrl: string, error?: string }>}
 */
async function sendWhatsAppMessage({ phone, razonSocial, fechaVencimiento }) {
  const normalizedNumber = formatWhatsAppNumber(phone);
  if (!normalizedNumber) {
    return { sent: false, simulated: false, error: 'Número de WhatsApp inválido o no suministrado.' };
  }

  const message = buildRenewalMessage(razonSocial, fechaVencimiento);
  const waUrl = `https://wa.me/${normalizedNumber}?text=${encodeURIComponent(message)}`;

  // 1. WhatsApp Cloud API (Meta Oficial)
  if (env.whatsapp.token && env.whatsapp.phoneNumberId) {
    try {
      const endpoint = `https://graph.facebook.com/v19.0/${env.whatsapp.phoneNumberId}/messages`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.whatsapp.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: normalizedNumber,
          type: 'text',
          text: { preview_url: false, body: message },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || `HTTP ${res.status}`);
      }
      console.log(`[whatsapp] Mensaje oficial enviado a +${normalizedNumber} (${razonSocial}).`);
      return { sent: true, simulated: false, waUrl };
    } catch (err) {
      console.warn(`[whatsapp] Error enviando WhatsApp a +${normalizedNumber}:`, err.message);
      return { sent: false, simulated: false, waUrl, error: err.message };
    }
  }

  // 2. Webhook o Gateway personalizado (Evolution API, UltraMsg, Z-API, Baileys, etc.)
  if (env.whatsapp.apiUrl) {
    try {
      const res = await fetch(env.whatsapp.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(env.whatsapp.token ? { Authorization: `Bearer ${env.whatsapp.token}` } : {}),
        },
        body: JSON.stringify({
          phone: normalizedNumber,
          message,
          razon_social: razonSocial,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log(`[whatsapp] Webhook ejecutado para +${normalizedNumber} (${razonSocial}).`);
      return { sent: true, simulated: false, waUrl };
    } catch (err) {
      console.warn(`[whatsapp] Error en Webhook de WhatsApp:`, err.message);
      return { sent: false, simulated: false, waUrl, error: err.message };
    }
  }

  // 3. Modo seguro / simulado (sin API de terceros configurada)
  console.log(`[whatsapp] (Privado / Simulado) → Para: +${normalizedNumber} (${razonSocial})`);
  console.log(`           "${message}"`);
  return { sent: false, simulated: true, waUrl };
}

module.exports = {
  formatWhatsAppNumber,
  buildRenewalMessage,
  sendWhatsAppMessage,
};

