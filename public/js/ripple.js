/**
 * ripple.js — Efecto interactivo de onda de agua (CursorRipples) sobre una imagen.
 *
 * - Motor: librería `shaders` (WebGPU) cargada de forma diferida (lazy-load).
 * - Estructura: <Shader toneMapping="aces"> → ImageTexture → CursorRipples.
 * - Compatibilidad: detecta WebGPU y respeta prefers-reduced-motion. Si no es
 *   compatible (o falla el render), deja la imagen original estática visible.
 *
 * Uso en HTML (EJS): envolver la imagen en un contenedor con data-ripple y
 * marcar la imagen real como fallback accesible:
 *
 *   <div class="relative" data-ripple data-ripple-image="/img/foto.jpg">
 *     <img src="/img/foto.jpg" alt="..." class="...">
 *     <canvas class="dc-ripple-canvas" hidden aria-hidden="true"></canvas>
 *   </div>
 *
 * El módulo inserta el canvas sobre la imagen; si todo va bien, oculta la <img>
 * y pinta el shader. Si algo falla en cualquier punto, la <img> permanece.
 */
(function () {
  'use strict';

  var VENDOR_URL = '/vendor/shaders/js/index.js';
  var DECAY = 7.3;
  var RADIUS = 0.6;

  /** ¿El usuario pidió reducir el movimiento? */
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Carga (una sola vez) el módulo ESM de shaders desde el vendor. */
  var shadersPromise = null;
  function loadShaders() {
    if (!shadersPromise) {
      // El build de `shaders` (vía typegpu) referencia `process.env.NODE_ENV`,
      // que no existe en el navegador. Definimos un shim mínimo para que las
      // comprobaciones DEV/TEST queden en false (producción).
      if (typeof window.process === 'undefined') {
        window.process = { env: {} };
      }
      shadersPromise = import(VENDOR_URL);
    }
    return shadersPromise;
  }

  /** Monta el shader sobre un contenedor [data-ripple]. */
  async function mount(container) {
    var img = container.querySelector('img');
    var imageUrl = container.getAttribute('data-ripple-image') || (img && img.getAttribute('src'));
    if (!imageUrl) return;

    // El canvas se crea/dimensiona al tamaño del contenedor.
    var canvas = container.querySelector('.dc-ripple-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'dc-ripple-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      container.appendChild(canvas);
    }
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.removeAttribute('hidden');

    var mod;
    try {
      mod = await loadShaders();
    } catch (e) {
      console.warn('[ripple] no se pudo cargar el módulo shaders:', e);
      return; // fallo de carga → se queda la imagen original
    }

    var supported = true;
    try {
      supported = typeof mod.isWebGPUSupported === 'function' ? mod.isWebGPUSupported() : !!navigator.gpu;
    } catch (e) {
      supported = false;
    }
    if (!supported) {
      console.warn('[ripple] WebGPU no disponible; se usa la imagen estática.');
      return; // sin WebGPU → imagen original estática
    }

    // Predetermín: la imagen real es el fallback. Solo la ocultamos cuando el
    // shader confirma que está listo (onReady).
    var instance = null;
    var fallback = function () {
      try { if (instance) { instance.destroy(); instance = null; } } catch (e) {}
      canvas.style.display = 'none';
      if (img) img.style.visibility = '';
    };

    try {
      instance = await mod.createShader(
        canvas,
        {
          components: [
            {
              type: 'CursorRipples',
              id: 'ripple',
              props: { decay: DECAY, radius: RADIUS },
              // CursorRipples es un filtro (role: "filter"): deforma su ENTRADA,
              // así que la imagen debe ser su hijo, no un hermano.
              children: [
                { type: 'ImageTexture', id: 'foto', props: { url: imageUrl, objectFit: 'cover' } }
              ]
            }
          ]
        },
        {
          toneMapping: 'aces',
          disableTelemetry: true,
          onReady: function () {
            if (img) img.style.visibility = 'hidden';
            console.info('[ripple] shader listo en', imageUrl);
          },
          onError: function (reason) {
            console.warn('[ripple] error del shader (' + reason + ') en', imageUrl);
            fallback();
          }
        }
      );
    } catch (e) {
      console.warn('[ripple] createShader lanzó excepción:', e);
      fallback();
    }
  }

  /** Arranca: aplica a todas las imágenes marcadas, salvo reduced-motion. */
  function init() {
    if (prefersReducedMotion()) return; // accesibilidad: imagen estática
    var nodes = document.querySelectorAll('[data-ripple]');
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
