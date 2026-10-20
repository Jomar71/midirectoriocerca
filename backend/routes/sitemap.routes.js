/**
 * routes/sitemap.routes.js
 * Sitemap.xml dinámico y robots.txt.
 */
'use strict';

const express = require('express');
const anuncioModel = require('../models/anuncio.model');
const categoriaModel = require('../models/categoria.model');
const env = require('../config/env');

const router = express.Router();

router.get('/sitemap.xml', async (req, res) => {
  try {
    const [anuncios, categorias] = await Promise.all([
      anuncioModel.allActiveForSitemap(),
      categoriaModel.listSimple(),
    ]);

    const urls = [
      { loc: `${env.appUrl}/`, priority: '1.0', changefreq: 'daily' },
      { loc: `${env.appUrl}/nosotros`, priority: '0.5', changefreq: 'monthly' },
      { loc: `${env.appUrl}/terminos`, priority: '0.2', changefreq: 'yearly' },
      { loc: `${env.appUrl}/privacidad`, priority: '0.2', changefreq: 'yearly' },
      { loc: `${env.appUrl}/contacto`, priority: '0.5', changefreq: 'monthly' },
      ...categorias.map((c) => ({
        loc: `${env.appUrl}/?categoria=${c.slug}`, priority: '0.6', changefreq: 'weekly',
      })),
      ...anuncios.map((a) => ({
        loc: `${env.appUrl}/anuncio/${a.slug}`,
        lastmod: a.updated_at ? new Date(a.updated_at).toISOString() : undefined,
        priority: '0.8',
        changefreq: 'weekly',
      })),
    ];

    const body = urls.map((u) => `
  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('');

    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}
</urlset>`);
  } catch (e) {
    res.status(500).type('text/plain').send('Error generando el sitemap');
  }
});

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/admin

Sitemap: ${env.appUrl}/sitemap.xml
`);
});

module.exports = router;
