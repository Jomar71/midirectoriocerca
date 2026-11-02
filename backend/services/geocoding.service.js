/**
 * services/geocoding.service.js
 * Geocodifica la ubicación de un anuncio con el cliente oficial de MapTiler.
 * Intenta primero la dirección completa y, si falla, reintenta con la calle
 * y luego con la ciudad para no perder la referencia geográfica.
 */
'use strict';

const { config, geocoding } = require('@maptiler/client');
const env = require('../config/env');
const ubicacionModel = require('../models/ubicacion.model');

config.apiKey = env.maptiler.apiKey || '';
config.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers || {});
  headers.set('Referer', `${env.appUrl}/`);
  return fetch(input, {
    ...init,
    headers,
    signal: AbortSignal.timeout(10000),
  });
};

const HOUSE_NUMBER_RE = /#|\b(?:n[°ºo]\.?|nro\.?|num\.?|número|numero)\s*\d/i;

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

function isColombia(pais) {
  const value = normalize(pais);
  return !value || value === 'colombia' || value === 'co';
}

function buildQuery(parts) {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
}

/** Quita el número de casa y conserva la vía (incluye letras). */
function toStreetOnly(direccion) {
  const original = String(direccion || '').trim();
  if (!original) return '';

  const marker = original.match(HOUSE_NUMBER_RE);
  const street = (marker ? original.slice(0, marker.index) : original)
    .replace(/[\s,;.-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return street;
}

/** Busca en el catálogo DANE el departamento de una ciudad escrita por el usuario. */
async function resolveDepartamento(ciudad) {
  if (!ciudad) return null;
  try {
    return await ubicacionModel.findDepartamentoByCity(ciudad);
  } catch (error) {
    console.warn(`[geocoding] No se pudo resolver el departamento de "${ciudad}": ${error.message}`);
    return null;
  }
}

function readResult(result) {
  const feature = result.features?.[0];
  const center = feature?.center;
  if (!Array.isArray(center) || center.length < 2) return null;

  const longitud = Number(center[0]);
  const latitud = Number(center[1]);
  if (!Number.isFinite(latitud) || latitud < -90 || latitud > 90
    || !Number.isFinite(longitud) || longitud < -180 || longitud > 180) {
    return null;
  }

  const types = Array.isArray(feature.place_type) ? feature.place_type : [];
  const kind = feature.properties?.kind || '';
  const precise = types.includes('address') || types.includes('street')
    || types.includes('poi') || types.includes('venue')
    || kind === 'street' || kind === 'address' || kind === 'road'
    || kind === 'poi' || kind === 'venue';

  return { latitud, longitud, precise };
}

async function queryMapTiler(query, countryCode) {
  const options = {
    apiKey: env.maptiler.apiKey,
    limit: 1,
    language: 'es',
  };
  if (countryCode) options.country = [countryCode];

  let result;
  try {
    result = await geocoding.forward(query, options);
  } catch (error) {
    throw new Error(`No fue posible consultar el geocodificador de MapTiler: ${error.message}`);
  }

  return readResult(result);
}

async function geocodeAddress({ direccion, ciudad, pais, departamento }) {
  if (!env.maptiler.apiKey || (!direccion && !ciudad)) return null;

  const colombia = isColombia(pais);
  const paisNombre = colombia ? 'Colombia' : String(pais || '').trim();
  const departamentoNombre = departamento
    || (colombia ? await resolveDepartamento(ciudad) : null);
  const countryCode = colombia ? 'co' : null;

  const attempts = [];
  const fullAddress = buildQuery([direccion, ciudad, departamentoNombre, paisNombre]);
  if (fullAddress) attempts.push(fullAddress);

  const street = toStreetOnly(direccion);
  if (street) {
    const streetQuery = buildQuery([street, ciudad, departamentoNombre, paisNombre]);
    if (streetQuery) attempts.push(streetQuery);
  }
  if (ciudad) {
    const cityQuery = buildQuery([ciudad, departamentoNombre, paisNombre]);
    if (cityQuery) attempts.push(cityQuery);
  }

  const tried = new Set();
  let fallback = null;
  for (const query of attempts) {
    if (tried.has(query)) continue;
    tried.add(query);

    const result = await queryMapTiler(query, countryCode);
    if (!result) continue;

    const coordinates = { latitud: result.latitud, longitud: result.longitud };
    if (result.precise) return coordinates;
    if (!fallback) fallback = coordinates;
  }

  return fallback;
}

module.exports = { geocodeAddress };
