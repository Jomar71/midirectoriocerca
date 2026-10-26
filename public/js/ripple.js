/**
 * ripple.js — Efecto interactivo de onda de agua (CursorRipples) sobre una imagen.
 *
 * - Motor principal: librería `shaders` (WebGPU) cargada de forma diferida.
 * - Fallback: WebGL (compatible con móviles y tablets sin WebGPU).
 * - Compatibilidad: respeta prefers-reduced-motion. Si ningún motor está
 *   disponible, deja la imagen original estática visible.
 *
 * Uso en HTML (EJS): envolver la imagen en un contenedor con data-ripple y
 * marcar la imagen real como fallback accesible:
 *
 *   <div class="relative" data-ripple data-ripple-image="/img/foto.jpg">
 *     <img src="/img/foto.jpg" alt="..." class="...">
 *     <canvas class="dc-ripple-canvas" hidden aria-hidden="true"></canvas>
 *   </div>
 */
(function () {
  'use strict';

  var VENDOR_URL = '/vendor/shaders/js/index.js';
  var DECAY = 7.3;
  var RADIUS = 0.6;

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function probeWebGPU() {
    return new Promise(function (resolve) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        resolve(false);
      }, 2500);
      navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }).then(function (adapter) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(!!adapter);
      }, function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  var webgpuProbe = null;
  function hasUsableWebGPU() {
    if (!webgpuProbe) {
      webgpuProbe = (async function () {
        if (typeof navigator === 'undefined' || !navigator.gpu || typeof navigator.gpu.requestAdapter !== 'function') {
          return false;
        }
        try {
          return await probeWebGPU();
        } catch (e) {
          return false;
        }
      })();
    }
    return webgpuProbe;
  }

  function getCanvas(container) {
    var canvas = container.querySelector('.dc-ripple-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'dc-ripple-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      var img = container.querySelector('img');
      if (img && img.parentNode === container) container.insertBefore(canvas, img.nextSibling);
      else container.appendChild(canvas);
    }
    return canvas;
  }

  function prepareWebGPUCanvas(canvas) {
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.pointerEvents = 'none';
    canvas.removeAttribute('hidden');
  }

  function hideCanvas(canvas, img) {
    canvas.style.display = 'none';
    canvas.setAttribute('hidden', '');
    if (img) img.style.visibility = '';
  }

  var shadersPromise = null;
  function loadShaders() {
    if (!shadersPromise) {
      if (typeof window.process === 'undefined') {
        window.process = { env: {} };
      }
      shadersPromise = import(VENDOR_URL);
    }
    return shadersPromise;
  }

  function mountWebGL(container, imageUrl) {
    var oldCanvas = container.querySelector('.dc-ripple-canvas');
    var img = container.querySelector('img');
    if (img) img.style.visibility = '';

    var canvas = document.createElement('canvas');
    canvas.className = 'dc-ripple-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.hidden = true;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    if (oldCanvas && oldCanvas.parentNode) {
      oldCanvas.parentNode.insertBefore(canvas, oldCanvas);
      oldCanvas.parentNode.removeChild(oldCanvas);
    } else if (img && img.parentNode === container) {
      container.insertBefore(canvas, img.nextSibling);
    } else {
      container.appendChild(canvas);
    }

    var gl = null;
    try {
      gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true })
        || canvas.getContext('experimental-webgl', { alpha: true, antialias: true, premultipliedAlpha: true });
    } catch (e) {
      gl = null;
    }
    if (!gl) {
      hideCanvas(canvas, img);
      return;
    }

    function compile(type, source) {
      var shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    var vertexSource = [
      'attribute vec2 aPos;',
      'varying vec2 vUv;',
      'void main() {',
      '  vUv = aPos * 0.5 + 0.5;',
      '  gl_Position = vec4(aPos, 0.0, 1.0);',
      '}'
    ].join('\n');

    var fragmentSource = [
      'precision mediump float;',
      'varying vec2 vUv;',
      'uniform sampler2D uTex;',
      'uniform vec2 uTexSize;',
      'uniform vec2 uCanvasSize;',
      'uniform vec2 uPointer;',
      'uniform float uTime;',
      'uniform float uStrength;',
      'void main() {',
      '  vec2 uv = vUv;',
      '  float aspect = uCanvasSize.x / max(uCanvasSize.y, 1.0);',
      '  vec2 p = vec2(uv.x * aspect, uv.y);',
      '  vec2 ptr = vec2(uPointer.x * aspect, uPointer.y);',
      '  vec2 delta = p - ptr;',
      '  float d = length(delta);',
      '  vec2 dir = delta / max(d, 0.0001);',
      '  float ring = sin(d * 38.0 - uTime * 5.0);',
      '  float amp = exp(-d * 7.5) * 0.035 * uStrength;',
      '  uv += dir * ring * amp;',
      '  uv.x += sin(uv.y * 13.0 + uTime * 1.1) * 0.0016;',
      '  uv.y += cos(uv.x * 11.0 - uTime * 0.9) * 0.0016;',
      '  float imageAspect = uTexSize.x / max(uTexSize.y, 1.0);',
      '  vec2 scale = vec2(1.0);',
      '  if (aspect > imageAspect) {',
      '    scale.y = imageAspect / aspect;',
      '  } else {',
      '    scale.x = aspect / imageAspect;',
      '  }',
      '  vec2 tuv = (uv - 0.5) * scale + 0.5;',
      '  gl_FragColor = texture2D(uTex, tuv);',
      '}'
    ].join('\n');

    var vertex = compile(gl.VERTEX_SHADER, vertexSource);
    var fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) {
      hideCanvas(canvas, img);
      return;
    }

    var program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      hideCanvas(canvas, img);
      return;
    }
    gl.useProgram(program);

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var uTex = gl.getUniformLocation(program, 'uTex');
    var uTexSize = gl.getUniformLocation(program, 'uTexSize');
    var uCanvasSize = gl.getUniformLocation(program, 'uCanvasSize');
    var uPointer = gl.getUniformLocation(program, 'uPointer');
    var uTime = gl.getUniformLocation(program, 'uTime');
    var uStrength = gl.getUniformLocation(program, 'uStrength');

    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(uTex, 0);

    var pointer = { x: 0.5, y: 0.5 };
    var smoothX = 0.5;
    var smoothY = 0.5;
    var smoothStrength = 0.7;
    var lastInteraction = 0;
    var startedAt = performance.now();
    var running = false;
    var raf = 0;
    var visible = true;
    var lastWidth = 0;
    var lastHeight = 0;
    var dpr = 0;
    var resizeObserver = null;
    var intersectionObserver = null;

    function resize() {
      var rect = container.getBoundingClientRect();
      var width = Math.max(1, Math.round(rect.width));
      var height = Math.max(1, Math.round(rect.height));
      var nextDpr = Math.min(window.devicePixelRatio || 1, 2);
      if (width === lastWidth && height === lastHeight && nextDpr === dpr && canvas.width) return;
      lastWidth = width;
      lastHeight = height;
      dpr = nextDpr;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uCanvasSize, width, height);
    }

    function render(now) {
      if (!running) return;
      resize();
      var time = (now - startedAt) / 1000;
      var idle = now - lastInteraction;
      var targetX;
      var targetY;
      var targetStrength;
      if (idle < 1600) {
        targetX = pointer.x;
        targetY = pointer.y;
        targetStrength = 1.15;
      } else {
        targetX = 0.5 + Math.cos(time * 0.35) * 0.18;
        targetY = 0.5 + Math.sin(time * 0.27) * 0.14;
        targetStrength = 0.7;
      }
      smoothX += (targetX - smoothX) * 0.08;
      smoothY += (targetY - smoothY) * 0.08;
      smoothStrength += (targetStrength - smoothStrength) * 0.06;
      gl.uniform2f(uPointer, smoothX, smoothY);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uStrength, smoothStrength);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    }

    function start() {
      if (running || !visible || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(render);
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function setPointer(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer.x = (clientX - rect.left) / rect.width;
      pointer.y = 1 - (clientY - rect.top) / rect.height;
      lastInteraction = performance.now();
    }

    function onPointerMove(event) {
      if (event.touches && event.touches.length) {
        setPointer(event.touches[0].clientX, event.touches[0].clientY);
      } else if (typeof event.clientX === 'number') {
        setPointer(event.clientX, event.clientY);
      }
    }

    function onPointerStart(event) {
      if (event.touches && event.touches.length) {
        setPointer(event.touches[0].clientX, event.touches[0].clientY);
      } else if (typeof event.clientX === 'number') {
        setPointer(event.clientX, event.clientY);
      }
      start();
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerStart, { passive: true });
    window.addEventListener('touchstart', onPointerStart, { passive: true });
    window.addEventListener('resize', resize);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else start();
    });

    canvas.addEventListener('webglcontextlost', function (event) {
      event.preventDefault();
      stop();
      hideCanvas(canvas, img);
    });

    canvas.addEventListener('webglcontextrestored', function () {
      mountWebGL(container, imageUrl);
    });

    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    }

    if ('IntersectionObserver' in window) {
      intersectionObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          visible = entry.isIntersecting;
          if (visible) start();
          else stop();
        });
      }, { rootMargin: '120px' });
      intersectionObserver.observe(container);
    }

    var source = new Image();
    source.decoding = 'async';
    source.onload = function () {
      try {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.uniform2f(uTexSize, source.naturalWidth, source.naturalHeight);
      } catch (e) {
        hideCanvas(canvas, img);
        return;
      }
      canvas.hidden = false;
      canvas.style.display = 'block';
      if (img) img.style.visibility = 'hidden';
      resize();
      start();
    };
    source.onerror = function () {
      hideCanvas(canvas, img);
    };
    source.src = imageUrl;
    if (source.complete && source.naturalWidth) source.onload();
  }

  async function mount(container) {
    var img = container.querySelector('img');
    var imageUrl = container.getAttribute('data-ripple-image') || (img && img.getAttribute('src'));
    if (!imageUrl) return;

    if (!await hasUsableWebGPU()) {
      mountWebGL(container, imageUrl);
      return;
    }

    var canvas = getCanvas(container);
    prepareWebGPUCanvas(canvas);

    var mod;
    try {
      mod = await loadShaders();
    } catch (e) {
      mountWebGL(container, imageUrl);
      return;
    }

    var supported = true;
    try {
      supported = typeof mod.isWebGPUSupported === 'function' ? mod.isWebGPUSupported() : !!navigator.gpu;
    } catch (e) {
      supported = false;
    }
    if (!supported) {
      mountWebGL(container, imageUrl);
      return;
    }

    var instance = null;
    var fallbackDone = false;
    var fallback = function () {
      if (fallbackDone) return;
      fallbackDone = true;
      try { if (instance) { instance.destroy(); instance = null; } } catch (e) {}
      hideCanvas(canvas, img);
      mountWebGL(container, imageUrl);
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
            if (!fallbackDone && img) img.style.visibility = 'hidden';
          },
          onError: function (reason) {
            console.warn('[ripple] error del shader (' + reason + ') en', imageUrl);
            fallback();
          }
        }
      );
      if (fallbackDone && instance) {
        try { instance.destroy(); } catch (e) {}
        instance = null;
      }
    } catch (e) {
      console.warn('[ripple] createShader lanzó excepción:', e);
      fallback();
    }
  }

  function init() {
    if (prefersReducedMotion()) return;
    var nodes = document.querySelectorAll('[data-ripple]');
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
