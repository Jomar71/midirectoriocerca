/* public/js/anuncio.js — Galería con lightbox y formulario de contacto del anuncio */
(function () {
  // ── Galería ──────────────────────────────────────────────────────────
  const main = document.getElementById('galeria-principal');
  const thumbs = Array.from(document.querySelectorAll('.gal-thumb'));
  let current = 0;
  const sources = thumbs.length
    ? thumbs.map((t) => t.dataset.src)
    : (main ? [main.src] : []);

  function show(i) {
    if (!sources.length) return;
    current = (i + sources.length) % sources.length;
    if (main) main.src = sources[current];
    thumbs.forEach((t, k) => {
      t.classList.toggle('border-primary-600', k === current);
      t.classList.toggle('border-neutral-200', k !== current);
      t.classList.toggle('dark:border-slate-600', k !== current);
    });
    const lb = document.getElementById('lb-img');
    if (lb && !document.getElementById('lightbox').classList.contains('hidden')) lb.src = sources[current];
  }

  thumbs.forEach((t, i) => t.addEventListener('click', () => show(i)));
  const prev = document.getElementById('gal-prev');
  const next = document.getElementById('gal-next');
  if (prev) prev.addEventListener('click', (e) => { e.stopPropagation(); show(current - 1); });
  if (next) next.addEventListener('click', (e) => { e.stopPropagation(); show(current + 1); });

  // ── Lightbox ─────────────────────────────────────────────────────────
  const lightbox = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbClose = document.getElementById('lb-close');
  let lastFocused = null;
  const open = () => {
    if (!lightbox) return;
    lastFocused = document.activeElement;
    lbImg.src = sources[current] || (main && main.src);
    lightbox.classList.remove('hidden');
    lightbox.classList.add('flex');
    if (lbClose) lbClose.focus();
  };
  const close = () => {
    if (!lightbox) return;
    lightbox.classList.add('hidden');
    lightbox.classList.remove('flex');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  };

  const gal = document.getElementById('galeria');
  if (gal) {
    gal.addEventListener('click', open);
    gal.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  }
  if (lightbox) {
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) close(); });
    if (lbClose) lbClose.addEventListener('click', close);
    document.getElementById('lb-prev').addEventListener('click', () => show(current - 1));
    document.getElementById('lb-next').addEventListener('click', () => show(current + 1));
  }
  document.addEventListener('keydown', (e) => {
    if (!lightbox || lightbox.classList.contains('hidden')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
    if (e.key === 'Tab') {
      const items = lightbox.querySelectorAll('button');
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // ── Formulario de contacto 24/7 ──────────────────────────────────────
  const form = document.getElementById('contacto-form');
  const msg = document.getElementById('contacto-msg');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    msg.textContent = 'Enviando...';
    msg.className = 'text-sm text-neutral-500';
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const res = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo enviar');
      msg.textContent = '¡Mensaje enviado! Te contactaremos pronto.';
      msg.className = 'text-sm text-success-600';
      form.reset();
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'text-sm text-error-600';
    } finally {
      btn.disabled = false;
    }
  });
})();
