/**
 * services/geocoding.service.js
 * Geocodifica la ubicación de un anuncio con el cliente oficial de MapTiler.
 * Construye una dirección completa (dirección, ciudad, departamento y Colombia)
 * y limita la búsqueda a Colombia para mejorar la precisión.
 */
'use strict';

const { config, geocoding } = require('@maptiler/client');
const env = require('../config/env');
const ubicacionModel = require('../models/ubicacion.model');

config.apiKey = env.maptiler.apiKey || '';
config.fetch = (input, init) => fetch(input, {
  ...init,
  signal: AbortSignal.timeout(10000),
});

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

function isColombia(pais) {
  const value = normalize(pais);
  return !value || value === 'colombia' || value === 'co';
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

async function geocodeAddress({ direccion, ciudad, pais, departamento }) {
  if (!env.maptiler.apiKey || (!direccion && !ciudad)) return null;

  const colombia = isColombia(pais);
  const paisNombre = colombia ? 'Colombia' : String(pais).trim();
  const departamentoNombre = departamento
    || (colombia ? await resolveDepartamento(ciudad) : null);
  const query = [direccion, ciudad, departamentoNombre, paisNombre]
    .filter(Boolean)
    .join(', ')
    .trim();
  if (!query) return null;

  const options = {
    apiKey: env.maptiler.apiKey,
    limit: 1,
    language: 'es',
  };
  if (colombia) options.country = ['co'];

  let result;
  try {
    result = await geocoding.forward(query, options);
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
