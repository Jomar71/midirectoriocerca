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

let transporter = null;
let etherealPreview = '';

async function initMailer() {
  if (env.mail.transport === 'smtp') {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
    });
    console.log(`[mail] SMTP configurado (${env.mail.host}:${env.mail.port}).`);
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
    console.log('[mail] Modo JSON: los correos se imprimen en consola.');
  }
}

async function send({ to, subject, html, replyTo }) {
  if (!transporter) await initMailer();
  const info = await transporter.sendMail({
    from: env.mail.from,
    to,
    subject,
    html,
    replyTo,
  });
  if (env.mail.transport === 'json' && info.message) {
    console.log('[mail] (json) →', to, '|', subject);
  }
  const url = nodemailer.getTestMessageUrl(info);
  if (url) etherealPreview = url;
  return { info, previewUrl: url || etherealPreview };
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

/** Notifica al administrador de un nuevo mensaje de contacto. */
async function notifyNewMessage({ anuncio, nombre, email, telefono, mensaje }) {
  const body = `
    <p>Has recibido un mensaje en el anuncio <strong>${anuncio}</strong>.</p>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#6b7280">Nombre</td><td>${nombre}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Email</td><td>${email}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Teléfono</td><td>${telefono || '—'}</td></tr>
    </table>
    <p style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;white-space:pre-wrap">${mensaje}</p>
    <p><a href="${env.appUrl}/admin/panel" style="color:#2563eb">Abrir el panel de administración</a></p>`;
  return send({ to: env.mail.adminEmail, subject: `Nuevo mensaje en "${anuncio}"`, html: base('Nuevo mensaje de contacto', body), replyTo: email });
}

/** Autorrespuesta al visitante que usó el formulario. */
async function autoReply({ to, nombre, anuncio }) {
  const body = `
    <p>Hola ${nombre},</p>
    <p>Hemos recibido tu mensaje para <strong>${anuncio}</strong>. El propietario del negocio se pondrá en contacto contigo a la mayor brevedad.</p>
    <p>Gracias por usar DirectorioCerca.</p>`;
  return send({ to, subject: 'Hemos recibido tu mensaje', html: base('Gracias por contactarnos', body) });
}

/** Aviso al administrador: anuncios próximos a vencer. */
async function notifyExpiring(anuncios) {
  const rows = anuncios.map((a) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${a.razon_social}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${String(a.fecha_vencimiento).slice(0, 10)}</td>
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

module.exports = { initMailer, send, notifyNewMessage, autoReply, notifyExpiring, sendReply };
