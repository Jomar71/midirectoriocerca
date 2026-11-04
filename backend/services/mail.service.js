/**
 * services/mail.service.js
 * Envío de correo real con Nodemailer.
 * transport:
 *   - smtp     : envía mediante tu proveedor (Gmail, Brevo, SendGrid, Zoho, Mailgun...).
 *   - ethereal : crea una cuenta de prueba gratis y devuelve la URL para ver el correo.
 *   - json     : no envía; imprime el correo en consola (desarrollo).
 */
'use strict';

const nodemailer = require('nodemailer');
const env = require('../config/env');
const S = require('../utils/sanitize');

let transporter = null;
let etherealPreview = '';

async function initMailer() {
  if (env.mail.transport === 'smtp') {
    if (env.mail.service) {
      transporter = nodemailer.createTransport({
        service: env.mail.service,
        auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
      });
      console.log(`[mail] SMTP configurado con servicio "${env.mail.service}".`);
    } else {
      if (!env.mail.host) throw new Error('MAIL_HOST o MAIL_SERVICE es obligatorio para enviar correos por SMTP.');
      transporter = nodemailer.createTransport({
        host: env.mail.host,
        port: env.mail.port,
        secure: env.mail.secure,
        auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      });
      console.log(`[mail] SMTP configurado (${env.mail.host}:${env.mail.port}).`);
    }
  } else if (env.mail.transport === 'ethereal') {
    const test = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: test.user, pass: test.pass },
    });
    console.log('[mail] Ethereal listo. Revisa los correos en https://ethereal.email');
  } else {
    transporter = nodemailer.createTransport({ jsonTransport: true });
    console.log('[mail] Modo JSON: los correos se imprimen en consola (MAIL_TRANSPORT=json). No se envía a destinatarios reales.');
  }
}

async function send({ to, subject, html, replyTo }) {
  if (!transporter) await initMailer();

  // Detección temprana: en modo json no llega nada al destinatario
  if (env.mail.transport === 'json') {
    console.log('[mail] ⚠  MAIL_TRANSPORT=json — el correo NO se envía. Configura MAIL_TRANSPORT=smtp en .env');
    console.log('[mail] (simulado) →', to, '|', subject);
    return { sent: false, simulated: true, transport: 'json', previewUrl: null };
  }

  // Verificación de credenciales antes de intentar el envío
  if (env.mail.transport === 'smtp' && !env.mail.user) {
    throw new Error('SMTP sin credenciales: agrega MAIL_USER y MAIL_PASS en .env');
  }

  const info = await transporter.sendMail({
    from: env.mail.from,
    to,
    subject,
    html,
    replyTo,
  });

  const url = nodemailer.getTestMessageUrl(info);
  if (url) etherealPreview = url;

  if (env.mail.transport === 'ethereal') {
    console.log(`[mail] Ethereal: revisa el correo en ${url}`);
  } else {
    console.log(`[mail] ✓ SMTP aceptó el mensaje para ${to} (id: ${info.messageId || 'sin id'}).`);
  }

  return {
    info,
    previewUrl: url || etherealPreview || null,
    sent: true,
    simulated: false,
    transport: env.mail.transport,
  };
}

const base = (title, body) => `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
    <div style="background:#0f172a;padding:20px 24px;border-radius:12px 12px 0 0">
      <h1 style="color:#fff;margin:0;font-size:20px">DirectorioCerca</h1>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">
      <h2 style="font-size:18px;margin-top:0">${title}</h2>
      ${body}
      <p style="color:#6b7280;font-size:12px;margin-top:24px">Mensaje automático de DirectorioCerca. No respondas directamente a este correo si es un aviso del sistema.</p>
    </div>
  </div>`;

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[char]);

/** Notifica al correo de contacto del anuncio (o al administrador si no tiene). */
async function notifyNewMessage({ anuncio, anuncioEmail, nombre, email, telefono, mensaje }) {
  const to = anuncioEmail || env.mail.adminEmail;
  const body = `
    <p>Has recibido un nuevo mensaje a través del formulario de una ficha de DirectorioCerca.</p>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#6b7280">Nombre</td><td>${escapeHtml(nombre)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Email</td><td>${escapeHtml(email)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Teléfono</td><td>${escapeHtml(telefono || '—')}</td></tr>
    </table>
    <p style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;white-space:pre-wrap">${escapeHtml(mensaje)}</p>`;
  return send({
    to,
    subject: `Nuevo mensaje en "${anuncio}"`,
    html: base('Nuevo mensaje de contacto', body),
    replyTo: email,
  });
}

/** Aviso al administrador: anuncios próximos a vencer. */
async function notifyExpiring(anuncios) {
  const rows = anuncios.map((a) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${a.razon_social}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${S.formatDateOnly(a.fecha_vencimiento)}</td>
    </tr>`).join('');
  const body = `
    <p>Los siguientes anuncios vencen pronto. Renuévalos o deshabilítalos desde el panel:</p>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr><th style="text-align:left;padding:8px">Anuncio</th><th style="text-align:left;padding:8px">Vence</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p><a href="${env.appUrl}/admin/panel" style="color:#2563eb">Ir al panel</a></p>`;
  return send({ to: env.mail.adminEmail, subject: `${anuncios.length} anuncio(s) próximo(s) a vencer`, html: base('Aviso de vencimiento', body) });
}

/** Aviso estrictamente privado al cliente / afiliado sobre su vencimiento. */
async function notifyClientExpiring({ to, razonSocial, fechaVencimiento }) {
  if (!to) return { sent: false, error: 'El cliente no tiene correo electrónico registrado.' };
  const fechaStr = S.formatDateOnly(fechaVencimiento);
  const body = `
    <p>Estimado(a) <strong>${escapeHtml(razonSocial)}</strong>,</p>
    <p>Le recordamos que su afiliación a MiDirectorioCerca vence el próximo <strong>${fechaStr}</strong>. Para mantener su ficha activa en nuestro directorio, por favor comuníquese con nosotros para realizar su renovación. Estamos a su disposición.</p>
    <p style="margin-top:24px">Atentamente,<br><strong>El equipo de MiDirectorioCerca.</strong></p>`;

  const result = await send({
    to,
    subject: 'Aviso Importante: Renovación de su afiliación en MiDirectorioCerca',
    html: base('Aviso Importante de Renovación', body),
  });

  return {
    to,
    sent: result.sent,
    simulated: result.simulated,
    previewUrl: result.previewUrl,
    transport: result.transport,
  };
}

/** Respuesta del administrador a un mensaje recibido. */
async function sendReply({ to, nombre, mensajeOriginal, respuesta }) {
  const body = `
    <p>Hola ${nombre},</p>
    <p style="white-space:pre-wrap">${respuesta}</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
    <p style="color:#6b7280;font-size:13px">Tu mensaje original:</p>
    <p style="color:#6b7280;font-size:13px;white-space:pre-wrap">${mensajeOriginal}</p>`;
  return send({ to, subject: 'Respuesta a tu mensaje — DirectorioCerca', html: base('Respuesta del anunciante', body) });
}

module.exports = { initMailer, send, notifyNewMessage, notifyExpiring, notifyClientExpiring, sendReply };
