/**
 * services/seo.service.js
 * Genera metadatos SEO: Open Graph, Twitter Card y datos estructurados
 * Schema.org (LocalBusiness) para cada anuncio.
 */
'use strict';

const env = require('../config/env');

/** Construye las 10 palabras clave (o las que existan) como array. */
function keywordsArray(palabrasClave, razonSocial) {
  const list = String(palabrasClave || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
  if (!list.length && razonSocial) list.push(razonSocial);
  return list;
}

/** JSON-LD Schema.org LocalBusiness a partir de un anuncio. */
function localBusinessJsonLd(anuncio, fotos = []) {
  const url = `${env.appUrl}/anuncio/${anuncio.slug}`;
  const images = fotos.map((f) => (f.url.startsWith('http') ? f.url : `${env.appUrl}${f.url}`));
  const sameAs = [anuncio.sitio_web, anuncio.facebook, anuncio.instagram, anuncio.tiktok, anuncio.youtube]
    .filter(Boolean);

  const data = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: anuncio.razon_social,
    description: anuncio.descripcion_50,
    url,
    image: images.length ? images : undefined,
    telephone: anuncio.telefono_movil || anuncio.telefono_fijo || undefined,
    email: anuncio.email || undefined,
    keywords: keywordsArray(anuncio.palabras_clave, anuncio.razon_social).join(', '),
    address: {
      '@type': 'PostalAddress',
      streetAddress: anuncio.direccion || undefined,
      addressLocality: anuncio.ciudad || undefined,
      addressCountry: anuncio.pais || undefined,
    },
    sameAs: sameAs.length ? sameAs : undefined,
  };

  if (anuncio.latitud != null && anuncio.longitud != null) {
    data.geo = {
      '@type': 'GeoCoordinates',
      latitude: Number(anuncio.latitud),
      longitude: Number(anuncio.longitud),
    };
  }
  return data;
}

/** Metadatos Open Graph / Twitter / SEO para una página. */
function metaFor({ title, description, url, image, type = 'website', keywords }) {
  return {
    title,
    description,
    url,
    image,
    type,
    keywords,
    appUrl: env.appUrl,
  };
}

module.exports = { localBusinessJsonLd, keywordsArray, metaFor };
