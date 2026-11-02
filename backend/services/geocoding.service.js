/**
 * services/geocoding.service.js
 * Geocodifica la ubicación de un anuncio con el cliente oficial de MapTiler.
 */
'use strict';

const { config, geocoding } = require('@maptiler/client');
const env = require('../config/env');

config.apiKey = env.maptiler.apiKey || '';
config.fetch = (input, init) => fetch(input, {
  ...init,
  signal: AbortSignal.timeout(10000),
});

async function geocodeAddress({ direccion, ciudad, pais }) {
  const query = [direccion, ciudad, pais].filter(Boolean).join(', ').trim();
  if (!query || !env.maptiler.apiKey) return null;

  let result;
  try {
    result = await geocoding.forward(query, {
      apiKey: env.maptiler.apiKey,
      limit: 1,
      language: 'es',
    });
  } catch (error) {
    throw new Error(`No fue posible consultar el geocodificador de MapTiler: ${error.message}`);
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
