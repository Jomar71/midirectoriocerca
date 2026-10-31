/**
 * services/geocoding.service.js
 * Geocodifica la ubicación de un anuncio con MapTiler.
 */
'use strict';

const env = require('../config/env');

async function geocodeAddress({ direccion, ciudad, pais }) {
  const query = [direccion, ciudad, pais].filter(Boolean).join(', ').trim();
  if (!query || !env.maptiler.apiKey) return null;

  const url = new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json`);
  url.searchParams.set('key', env.maptiler.apiKey);
  url.searchParams.set('limit', '1');
  url.searchParams.set('language', 'es');

  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json', Origin: env.appUrl },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error('No fue posible conectar con el servicio de geocodificación de MapTiler.');
  }

  if (!response.ok) {
    throw new Error(`MapTiler Geocoding devolvió HTTP ${response.status}.`);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('MapTiler Geocoding devolvió una respuesta inválida.');
  }

  const center = result.features?.[0]?.center;
  if (!Array.isArray(center) || center.length < 2) return null;

  const longitud = Number(center[0]);
  const latitud = Number(center[1]);
  if (!Number.isFinite(latitud) || latitud < -90 || latitud > 90
    || !Number.isFinite(longitud) || longitud < -180 || longitud > 180) {
    return null;
  }

  return { latitud, longitud };
}

module.exports = { geocodeAddress };
