/* public/js/admin-panel.js
   Panel de administración (SPA ligera). Todas las llamadas van a /api/admin. */
(function () {
  const API = window.PANEL_API || '/api/admin';
  const state = { anunciosPage: 1, msgFilter: '', categorias: [], anuncioEditando: null, ubicaciones: null };

  // ── Helpers ──────────────────────────────────────────────────────────
  async function api(path, options = {}) {
    const res = await fetch(API + path, { credentials: 'include', ...options });
    if (res.status === 401) { window.location.href = '/admin/login'; throw new Error('Sesión expirada'); }
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : {};
    if (!res.ok || data.ok === false) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }

  function toast(text, type = 'ok') {
    const el = document.getElementById('toast');
    const cls = {
      ok:   'bg-success-500',
      err:  'bg-error-600',
      warn: 'bg-amber-500',
      info: 'bg-primary-600',
    };
    el.className = `fixed bottom-5 right-5 z-[60] px-4 py-3 rounded-xl text-white font-medium shadow-lg ${cls[type] || cls.ok}`;
    el.classList.remove('hidden');
    el.textContent = text;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add('hidden'), type === 'warn' || type === 'info' ? 6000 : 3500);
  }

  /**
   * Muestra un modal de resultado de notificación con botón directo a WhatsApp.
   * Nunca usa window.open asíncrono (que los navegadores bloquean).
   */
  function mostrarResultadoNotificacion(res, nombre) {
    // Elimina modal anterior si existe
    const anterior = document.getElementById('modal-notif-resultado');
    if (anterior) anterior.remove();

    const emailOk   = res.canales?.email?.sent;
    const emailSim  = res.canales?.email?.simulated;
    const emailErr  = res.canales?.email?.error;
    const waOk      = res.canales?.whatsapp?.sent;
    const waUrl     = res.canales?.whatsapp?.waUrl || res.waUrl;

    const emailHtml = emailOk
      ? `<span class="text-success-600 font-semibold">✓ Correo enviado</span>`
      : emailSim
        ? `<span class="text-amber-700 font-semibold">⚠ Correo en modo simulación (MAIL_TRANSPORT=json). No llegó.</span>`
        : emailErr
          ? `<span class="text-error-600 font-semibold">✗ Correo falló: ${esc(emailErr)}</span>`
          : `<span class="text-neutral-400">— Sin correo registrado</span>`;

    const waHtml = waOk
      ? `<span class="text-success-600 font-semibold">✓ WhatsApp enviado vía API</span>`
      : waUrl
        ? `<div class="flex items-center gap-3 mt-1">
             <span class="text-amber-700 text-sm">Sin API automática — haz clic para enviar ahora:</span>
             <a id="btn-wa-modal" href="${esc(waUrl)}" target="_blank" rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">
               <svg class="w-4 h-4 fill-white shrink-0" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
               Enviar por WhatsApp
             </a>
           </div>`
        : `<span class="text-neutral-400">— Sin teléfono registrado</span>`;

    const wrapper = document.createElement('div');
    wrapper.id = 'modal-notif-resultado';
    wrapper.className = 'fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm';
    wrapper.innerHTML = `
      <div class="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
        <div class="flex items-start justify-between mb-4">
          <h3 class="text-base font-semibold text-neutral-800 dark:text-neutral-100">
            Resultado del aviso privado — ${esc(nombre)}
          </h3>
          <button id="cerrar-notif" class="ml-4 text-neutral-400 hover:text-neutral-600 text-xl leading-none">&times;</button>
        </div>
        <dl class="space-y-3 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">Correo electrónico</dt>
            <dd>${emailHtml}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">WhatsApp</dt>
            <dd>${waHtml}</dd>
          </div>
          ${emailSim ? `<div class="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <strong>¿Por qué no llega el correo?</strong> <code>MAIL_TRANSPORT=json</code> en tu <code>.env</code> solo simula el envío. Agrega las variables SMTP reales y reinicia el servidor. Ver instrucciones en la sección de diagnóstico.
          </div>` : ''}
        </dl>
        <div class="mt-5 flex justify-end">
          <button id="cerrar-notif-btn" class="px-4 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-sm font-medium text-neutral-700">Cerrar</button>
        </div>
      </div>`;
    document.body.appendChild(wrapper);

    const cerrar = () => wrapper.remove();
    document.getElementById('cerrar-notif').addEventListener('click', cerrar);
    document.getElementById('cerrar-notif-btn').addEventListener('click', cerrar);
    wrapper.addEventListener('click', (e) => { if (e.target === wrapper) cerrar(); });
  }

  function focusables(container) {
    return container.querySelectorAll('a[href], button:not([disabled]), textarea:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])');
  }
  function trapFocus(container, e) {
    const items = focusables(container);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  let lastFocused = null;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const estadoBadge = (e) => {
    const colors = { activo: 'bg-success-100 text-success-700', vencido: 'bg-error-50 text-error-700', deshabilitado: 'bg-neutral-200 text-neutral-600', pendiente: 'bg-warning-50 text-warning-700' };
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${colors[e] || 'bg-neutral-100'}">${esc(e)}</span>`;
  };

  const afiliacionBadge = (afiliacion, dias) => {
    if (afiliacion === 'Vencida') {
      return `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 ring-1 ring-rose-300">Vencida</span>`;
    }
    if (afiliacion === 'Por Vencer') {
      const diasTxt = dias != null ? ` (${dias}d)` : '';
      return `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 ring-1 ring-amber-300">Por Vencer${diasTxt}</span>`;
    }
    if (afiliacion === 'Deshabilitada') {
      return `<span class="px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-200 text-neutral-600">Deshabilitada</span>`;
    }
    return `<span class="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Activa</span>`;
  };

  const notificacionBadge = (notif) => {
    if (notif === 'enviado') {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700"><svg class="w-3 h-3 text-primary-600" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>Enviado</span>`;
    }
    if (notif === 'fallido') {
      return `<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700">Fallido</span>`;
    }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500">Pendiente</span>`;
  };
  const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—');

  // ── Navegación por pestañas ──────────────────────────────────────────
  const navItems = document.querySelectorAll('.nav-item');
  function activate(tab) {
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== tab));
    navItems.forEach((n) => {
      const on = n.dataset.tab === tab;
      n.classList.toggle('is-active', on);
      if (on) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current');
    });
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'anuncios') loadAnuncios();
    if (tab === 'categorias') loadCategorias();
    if (tab === 'mensajes') loadMensajes();
  }
  navItems.forEach((n) => n.addEventListener('click', () => activate(n.dataset.tab)));

  // ── Sesión ───────────────────────────────────────────────────────────
  async function loadMe() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) document.getElementById('admin-name').textContent = data.admin.nombre;
      else window.location.href = '/admin/login';
    } catch { window.location.href = '/admin/login'; }
  }
  document.getElementById('logout').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/admin/login';
  });

  // ── Dashboard ────────────────────────────────────────────────────────
  async function loadDashboard() {
    try {
      const { data } = await api('/dashboard');
      const s = data.stats;
      const cards = [
        ['Total de anuncios', s.total, 'bg-neutral-900'],
        ['Activos', s.activos, 'bg-success-500'],
        ['Vencidos', s.vencidos, 'bg-error-500'],
        ['Mensajes sin leer', data.mensajes_no_leidos, 'bg-primary-600'],
      ];
      document.getElementById('stats-cards').innerHTML = cards.map(([label, val, color]) => `
        <div class="rounded-2xl bg-white border border-neutral-200 p-5">
          <span class="block h-1 w-10 rounded-full ${color}" aria-hidden="true"></span>
          <p class="text-sm text-neutral-500 mt-4">${label}</p>
          <p class="font-display text-3xl font-bold text-neutral-900 mt-0.5 dc-tabular">${val}</p>
        </div>`).join('');

      const pv = document.getElementById('por-vencer');
      pv.innerHTML = data.por_vencer.length
        ? data.por_vencer.map((a) => `
            <div class="flex items-center justify-between py-3">
              <div>
                <span class="font-medium text-neutral-800">${esc(a.razon_social)}</span>
                <span class="ml-2 text-xs font-bold text-amber-800 bg-amber-100 ring-1 ring-amber-300 px-2 py-0.5 rounded-full">Por Vencer</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm text-neutral-500">Vence: ${fmtDate(a.fecha_vencimiento)}</span>
                ${a.whatsapp_url ? `<a href="${esc(a.whatsapp_url)}" target="_blank" rel="noopener noreferrer" class="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-semibold transition-colors inline-flex items-center gap-1 border border-emerald-200" title="Abrir chat de WhatsApp con el mensaje ya redactado"><svg class="w-3.5 h-3.5 fill-emerald-600" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>WhatsApp</a>` : ''}
                <button class="dash-notificar text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 font-semibold transition-colors" data-id="${a.id}" data-name="${esc(a.razon_social)}">Avisar</button>
              </div>
            </div>`).join('')
        : '<p class="text-sm text-neutral-400 py-3">No hay anuncios próximos a vencer.</p>';

      pv.querySelectorAll('.dash-notificar').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm(`¿Enviar aviso privado de renovación a "${b.dataset.name}" (Email y WhatsApp)?`)) return;
        b.disabled = true;
        try {
          const res = await api(`/anuncios/${b.dataset.id}/notificar-vencimiento`, { method: 'POST' });
          mostrarResultadoNotificacion(res, b.dataset.name);
          loadDashboard();
        } catch (e) { toast(e.message, 'err'); }
        finally { b.disabled = false; }
      }));

      const badge = document.getElementById('badge-mensajes');
      if (data.mensajes_no_leidos > 0) { badge.textContent = data.mensajes_no_leidos; badge.classList.remove('hidden'); }
      else badge.classList.add('hidden');
    } catch (e) { toast(e.message, 'err'); }
  }

  // ── Anuncios ─────────────────────────────────────────────────────────
  async function loadAnuncios() {
    const q = encodeURIComponent(document.getElementById('f-q').value || '');
    const estado = encodeURIComponent(document.getElementById('f-estado').value || '');
    try {
      const { data, pagination } = await api(`/anuncios?page=${state.anunciosPage}&limit=20&q=${q}&estado=${estado}`);
      const cont = document.getElementById('tabla-anuncios');
      if (!data.length) { cont.innerHTML = '<p class="p-6 text-neutral-500 text-sm">Sin anuncios.</p>'; }
      else {
        cont.innerHTML = `
          <table class="w-full text-sm min-w-[780px]">
            <caption class="sr-only">Listado de anuncios</caption>
            <thead>
              <tr class="text-left text-xs uppercase tracking-wider text-neutral-500 border-b border-neutral-100">
                <th scope="col" class="px-4 py-3 font-semibold">Anuncio</th>
                <th scope="col" class="px-4 py-3 font-semibold">Categoría</th>
                <th scope="col" class="px-4 py-3 font-semibold">Ubicación</th>
                <th scope="col" class="px-4 py-3 font-semibold">Afiliación</th>
                <th scope="col" class="px-4 py-3 font-semibold">Vence</th>
                <th scope="col" class="px-4 py-3 font-semibold">Aviso Privado</th>
                <th scope="col" class="px-4 py-3 font-semibold">Fotos</th>
                <th scope="col" class="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-100">
              ${data.map((a) => `
                <tr class="hover:bg-neutral-50 transition-colors">
                  <td class="px-4 py-3">
                    <div class="font-medium text-neutral-800">${esc(a.razon_social)}</div>
                    <a href="/anuncio/${esc(a.slug)}" target="_blank" class="text-xs text-primary-600 hover:underline">ver ficha pública</a>
                  </td>
                  <td class="px-4 py-3 text-neutral-500">${esc(a.categoria_nombre || '—')}</td>
                  <td class="px-4 py-3 text-neutral-500">${esc([a.ciudad, a.pais].filter(Boolean).join(', ') || '—')}</td>
                  <td class="px-4 py-3">${afiliacionBadge(a.estado_afiliacion, a.dias_restantes)}</td>
                  <td class="px-4 py-3 text-neutral-500">${fmtDate(a.fecha_vencimiento)}</td>
                  <td class="px-4 py-3">${notificacionBadge(a.estado_notificacion)}</td>
                  <td class="px-4 py-3 text-neutral-500">${a.total_fotos}/${11}</td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">
                    <button class="act-edit text-primary-600 hover:text-primary-700 font-medium" data-id="${a.id}">Editar</button>
                    <button class="act-renovar ml-2 text-success-600 hover:text-success-700 font-medium" data-id="${a.id}">Renovar</button>
                    <button class="act-notificar ml-2 text-amber-700 hover:text-amber-800 font-semibold" data-id="${a.id}" data-name="${esc(a.razon_social)}" title="Enviar recordatorio privado al correo y WhatsApp del cliente">Reenviar Aviso</button>
                    ${a.whatsapp_url ? `<a href="${esc(a.whatsapp_url)}" target="_blank" rel="noopener noreferrer" class="ml-2 inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold text-xs bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md transition-colors border border-emerald-200" title="Abrir chat de WhatsApp con el mensaje ya redactado"><svg class="w-3.5 h-3.5 fill-emerald-600" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>WhatsApp</a>` : ''}
                    <button class="act-del ml-2 text-error-500 hover:text-error-600 font-medium" data-id="${a.id}" data-name="${esc(a.razon_social)}" data-afiliacion="${esc(a.estado_afiliacion)}">Eliminar</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>`;

        wireAnuncioActions();
      }
      renderPaginador(pagination);
    } catch (e) { toast(e.message, 'err'); }
  }

  function renderPaginador(p) {
    const cont = document.getElementById('paginador-anuncios');
    if (!p || p.totalPages <= 1) { cont.innerHTML = ''; return; }
    let html = '';
    for (let i = 1; i <= p.totalPages; i++) {
      html += `<button data-page="${i}" ${i === p.page ? 'aria-current="page"' : ''} aria-label="Página ${i}" class="px-3 py-1.5 rounded-lg border text-sm ${i === p.page ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-neutral-200'}">${i}</button>`;
    }
    cont.innerHTML = html;
    cont.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.anunciosPage = Number(b.dataset.page); loadAnuncios(); }));
  }

  function wireAnuncioActions() {
    document.querySelectorAll('.act-edit').forEach((b) => b.addEventListener('click', () => openModal(Number(b.dataset.id))));

    // Reenvío manual de aviso de renovación (privado al cliente)
    document.querySelectorAll('.act-notificar').forEach((b) => b.addEventListener('click', async () => {
      const id = b.dataset.id;
      const name = b.dataset.name;
      if (!confirm(`¿Enviar aviso privado de renovación a "${name}" por Correo y WhatsApp?`)) return;
      b.disabled = true;
      try {
        const res = await api(`/anuncios/${id}/notificar-vencimiento`, { method: 'POST' });
        // Muestra modal con resultado detallado y botón directo de WhatsApp (sin popup blocker)
        mostrarResultadoNotificacion(res, name);
        loadAnuncios();
        loadDashboard();
      } catch (e) {
        toast(e.message, 'err');
      } finally {
        b.disabled = false;
      }
    }));

    // Eliminación protegida contra borrado accidental de clientes por vencer o vencidos
    document.querySelectorAll('.act-del').forEach((b) => b.addEventListener('click', async () => {
      const id = b.dataset.id;
      const name = b.dataset.name;
      const afiliacion = b.dataset.afiliacion;
      const esVencidoOPorVencer = afiliacion === 'Por Vencer' || afiliacion === 'Vencida';

      let queryParams = '';
      if (esVencidoOPorVencer) {
        const mensajeAlerta = `Este cliente tiene una afiliación vencida/por vencer. ¿Está seguro de que desea eliminar su ficha permanentemente?`;
        if (!confirm(mensajeAlerta)) return;
        queryParams = '?confirmar_vencido=true';
      } else {
        if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
      }

      try {
        await api(`/anuncios/${id}${queryParams}`, { method: 'DELETE' });
        toast('Anuncio eliminado');
        loadAnuncios();
        loadDashboard();
      } catch (e) {
        if (e.message && e.message.includes('vencida/por vencer')) {
          if (confirm(`${e.message}\n\n¿Desea forzar la eliminación definitiva?`)) {
            try {
              await api(`/anuncios/${id}?confirmar_vencido=true`, { method: 'DELETE' });
              toast('Anuncio eliminado permanentemente');
              loadAnuncios();
              loadDashboard();
            } catch (err2) {
              toast(err2.message, 'err');
            }
          }
        } else {
          toast(e.message, 'err');
        }
      }
    }));

    document.querySelectorAll('.act-renovar').forEach((b) => b.addEventListener('click', async () => {
      try {
        const r = await api(`/anuncios/${b.dataset.id}/renovar`, { method: 'POST' });
        toast(r.message);
        loadAnuncios();
        loadDashboard();
      } catch (e) { toast(e.message, 'err'); }
    }));
  }

  document.getElementById('f-buscar').addEventListener('click', () => { state.anunciosPage = 1; loadAnuncios(); });

  // ── Modal anuncio ────────────────────────────────────────────────────
  const modal = document.getElementById('modal-anuncio');
  const formAnuncio = document.getElementById('form-anuncio');

  async function loadCategoriasSelect() {
    if (!state.categorias.length) {
      const { data } = await api('/categorias');
      state.categorias = data;
    }
    document.getElementById('sel-categoria').innerHTML =
      '<option value="">Sin categoría</option>' +
      state.categorias.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  }

  // ── Catálogo geográfico (departamentos y ciudades de Colombia) ───────
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  async function loadUbicaciones() {
    if (state.ubicaciones) return state.ubicaciones;
    try {
      const res = await fetch('/api/ubicaciones', { credentials: 'include' });
      const data = await res.json();
      state.ubicaciones = data.ok ? data.data : { departamentos: [], ciudades: [] };
    } catch { state.ubicaciones = { departamentos: [], ciudades: [] }; }
    return state.ubicaciones;
  }

  function fillDepartamentosSelect() {
    const sel = document.getElementById('sel-departamento');
    if (sel.dataset.filled) return;
    sel.innerHTML = '<option value="">— Fuera de Colombia / otro —</option>' +
      state.ubicaciones.departamentos.map((d) => `<option value="${esc(d.slug)}">${esc(d.nombre)}</option>`).join('');
    sel.dataset.filled = '1';
  }

  function fillDatalist(deptSlug) {
    const dl = document.getElementById('lista-ciudades');
    const cities = state.ubicaciones.ciudades.filter((c) => !deptSlug || c.departamento_slug === deptSlug);
    dl.innerHTML = cities.map((c) => `<option value="${esc(c.nombre)}"></option>`).join('');
  }

  function syncDepartamentoHidden() {
    const sel = document.getElementById('sel-departamento');
    const hidden = document.getElementById('in-departamento');
    const dept = state.ubicaciones.departamentos.find((d) => d.slug === sel.value);
    hidden.value = dept ? dept.nombre : '';
  }

  function syncDepartamentoFromCiudad(ciudad) {
    const sel = document.getElementById('sel-departamento');
    const city = state.ubicaciones.ciudades.find((c) => norm(c.nombre) === norm(ciudad));
    sel.value = city ? city.departamento_slug : '';
    fillDatalist(sel.value);
    syncDepartamentoHidden();
  }

  document.getElementById('sel-departamento').addEventListener('change', (e) => {
    fillDatalist(e.target.value);
    syncDepartamentoHidden();
    const pais = document.getElementById('in-pais');
    if (e.target.value && !pais.value) pais.value = 'Colombia';
  });

  document.getElementById('in-ciudad').addEventListener('change', (e) => {
    if (e.target.value) syncDepartamentoFromCiudad(e.target.value);
  });

  async function openModal(id) {
    lastFocused = document.activeElement;
    await Promise.all([loadCategoriasSelect(), loadUbicaciones()]);
    fillDepartamentosSelect();
    formAnuncio.reset();
    document.getElementById('fotos-actuales').innerHTML = '';
    document.getElementById('in-fotos').disabled = false;
    document.getElementById('form-msg').textContent = '';
    state.anuncioEditando = id || null;
    document.getElementById('modal-title').textContent = id ? 'Editar anuncio' : 'Nuevo anuncio';

    if (id) {
      try {
        const { data } = await api(`/anuncios/${id}`);
        Object.entries(data).forEach(([k, v]) => {
          const field = formAnuncio.elements[k];
          if (field && k !== 'fotos') {
            if (field.type === 'date' && v) {
              field.value = String(v).slice(0, 10);
            } else {
              field.value = v == null ? '' : v;
            }
          }
        });
        if (data.categoria_id) formAnuncio.elements['categoria_id'].value = data.categoria_id;
        syncDepartamentoFromCiudad(data.ciudad);
        const fotosActuales = document.getElementById('fotos-actuales');
        fotosActuales.innerHTML = data.fotos.map((f) => `
          <div class="relative w-20 h-16 rounded-lg overflow-hidden border border-neutral-200">
            <img src="${esc(f.url)}" onerror="this.onerror=null;this.src='/img/placeholder.jpg';" class="w-full h-full object-cover">
            <button type="button" class="foto-del absolute top-0 right-0 bg-error-600 text-white text-xs w-5 h-5" data-id="${f.id}" aria-label="Eliminar foto">&times;</button>
          </div>`).join('');
        if (data.fotos.length >= 11) {
          document.getElementById('in-fotos').disabled = true;
          fotosActuales.insertAdjacentHTML('beforeend', '<p class="w-full text-xs text-neutral-500">Límite de 11 fotos alcanzado. Elimina una para subir otra.</p>');
        }
        document.querySelectorAll('.foto-del').forEach((b) => b.addEventListener('click', async () => {
          try {
            await api(`/fotos/${b.dataset.id}`, { method: 'DELETE' });
            b.closest('div').remove();
            document.getElementById('in-fotos').disabled = false;
            const aviso = document.querySelector('#fotos-actuales p');
            if (aviso) aviso.remove();
            toast('Foto eliminada');
          } catch (e) { toast(e.message, 'err'); }
        }));
      } catch (e) { toast(e.message, 'err'); return; }
    } else {
      document.getElementById('sel-departamento').value = '';
      fillDatalist('');
      syncDepartamentoHidden();
    }
    modal.classList.remove('hidden');
    const firstField = document.getElementById('in-razon-social');
    if (firstField) firstField.focus();
  }
  function closeAnuncioModal() {
    modal.classList.add('hidden');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  document.getElementById('btn-nuevo').addEventListener('click', () => openModal(null));
  document.getElementById('modal-close').addEventListener('click', closeAnuncioModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeAnuncioModal(); });

  formAnuncio.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('form-msg');
    const btn = formAnuncio.querySelector('button[type="submit"]');
    btn.disabled = true;
    msg.textContent = 'Guardando...'; msg.className = 'text-sm text-neutral-500';

    const fd = new FormData(formAnuncio);

    try {
      let result;
      if (state.anuncioEditando) {
        result = await api(`/anuncios/${state.anuncioEditando}`, { method: 'PUT', body: fd });
      } else {
        result = await api('/anuncios', { method: 'POST', body: fd });
      }
      toast(result.message || 'Anuncio guardado');
      closeAnuncioModal();
      loadAnuncios();
    } catch (err) {
      msg.textContent = err.message; msg.className = 'text-sm text-error-600';
    } finally { btn.disabled = false; }
  });

  // ── Categorías ───────────────────────────────────────────────────────
  async function loadCategorias() {
    try {
      const { data } = await api('/categorias');
      state.categorias = data;
      const cont = document.getElementById('lista-categorias');
      cont.innerHTML = data.map((c) => `
        <div class="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors">
          <div class="flex items-center gap-2">
            <span class="font-medium text-neutral-800">${esc(c.nombre)}</span>
            <span class="text-xs text-neutral-500 bg-neutral-100 rounded-full px-2 py-0.5">${c.total_anuncios} anuncios</span>
          </div>
          <button class="cat-del text-error-500 hover:text-error-600 text-sm font-medium" data-id="${c.id}" data-name="${esc(c.nombre)}">Eliminar</button>
        </div>`).join('') || '<p class="p-6 text-neutral-500 text-sm">Sin categorías.</p>';
      cont.querySelectorAll('.cat-del').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm(`¿Eliminar la categoría "${b.dataset.name}"?`)) return;
        try { await api(`/categorias/${b.dataset.id}`, { method: 'DELETE' }); toast('Categoría eliminada'); loadCategorias(); }
        catch (e) { toast(e.message, 'err'); }
      }));
    } catch (e) { toast(e.message, 'err'); }
  }

  document.getElementById('form-categoria').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try { await api('/categorias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); toast('Categoría creada'); e.target.reset(); loadCategorias(); }
    catch (err) { toast(err.message, 'err'); }
  });

  // ── Mensajes ─────────────────────────────────────────────────────────
  async function loadMensajes() {
    try {
      const q = state.msgFilter ? `&leido=${state.msgFilter}` : '';
      const { data } = await api(`/mensajes?limit=50${q}`);
      const cont = document.getElementById('lista-mensajes');
      cont.innerHTML = data.map((m) => `
        <div class="bg-white rounded-2xl border ${m.leido ? 'border-neutral-200' : 'border-primary-300'} p-4">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="font-medium text-neutral-800 flex flex-wrap items-center gap-2">
                ${esc(m.nombre)}
                <span class="text-sm text-neutral-500 font-normal">${esc(m.email)}</span>
                ${!m.leido ? '<span class="text-xs font-semibold text-primary-600 bg-primary-50 rounded-full px-2 py-0.5">Nuevo</span>' : ''}
              </p>
              <p class="text-xs text-neutral-500 mt-0.5">${m.anuncio_slug ? `Anuncio: ${esc(m.razon_social)}` : 'Contacto general'} · ${fmtDate(m.fecha)}</p>
              <p class="text-neutral-600 mt-2 whitespace-pre-wrap">${esc(m.mensaje)}</p>
              ${m.telefono ? `<p class="text-sm text-neutral-500 mt-1">Tel: ${esc(m.telefono)}</p>` : ''}
            </div>
            <div class="shrink-0 flex flex-col gap-2 text-sm text-right">
              <button class="msg-reply text-primary-600 hover:text-primary-700 font-medium" data-id="${m.id}" data-nombre="${esc(m.nombre)}" data-msg="${esc(m.mensaje)}">Responder</button>
              ${!m.leido ? `<button class="msg-read text-neutral-500 hover:text-neutral-700" data-id="${m.id}">Marcar leído</button>` : ''}
              <button class="msg-del text-error-500 hover:text-error-600" data-id="${m.id}">Eliminar</button>
            </div>
          </div>
        </div>`).join('') || '<p class="text-neutral-500 text-sm">Sin mensajes.</p>';

      cont.querySelectorAll('.msg-reply').forEach((b) => b.addEventListener('click', () => openMsgModal(b.dataset.id, b.dataset.nombre, b.dataset.msg)));
      cont.querySelectorAll('.msg-read').forEach((b) => b.addEventListener('click', async () => {
        try {
          await api(`/mensajes/${b.dataset.id}/leido`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leido: true }) });
          loadMensajes();
        } catch (e) { toast(e.message, 'err'); }
      }));
      cont.querySelectorAll('.msg-del').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('¿Eliminar mensaje?')) return;
        try {
          await api(`/mensajes/${b.dataset.id}`, { method: 'DELETE' });
          loadMensajes();
        } catch (e) { toast(e.message, 'err'); }
      }));
    } catch (e) { toast(e.message, 'err'); }
  }

  document.querySelectorAll('.msg-filter').forEach((b) => b.addEventListener('click', () => {
    state.msgFilter = b.dataset.filtroMsg;
    document.querySelectorAll('.msg-filter').forEach((x) => {
      const on = x === b;
      x.classList.toggle('is-active', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    loadMensajes();
  }));

  const modalMsg = document.getElementById('modal-mensaje');
  function openMsgModal(id, nombre, mensaje) {
    lastFocused = document.activeElement;
    modalMsg.dataset.id = id;
    document.getElementById('msg-detalle').innerHTML = `<strong>${esc(nombre)}</strong><br>${esc(mensaje)}`;
    const ta = document.getElementById('msg-respuesta');
    ta.value = '';
    modalMsg.classList.remove('hidden');
    ta.focus();
  }
  function closeMsgModal() {
    modalMsg.classList.add('hidden');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }
  document.getElementById('msg-cerrar').addEventListener('click', closeMsgModal);
  modalMsg.addEventListener('click', (e) => { if (e.target === modalMsg) closeMsgModal(); });
  document.getElementById('msg-enviar').addEventListener('click', async () => {
    const respuesta = document.getElementById('msg-respuesta').value.trim();
    if (!respuesta) return;
    try {
      await api(`/mensajes/${modalMsg.dataset.id}/responder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ respuesta }) });
      toast('Respuesta enviada');
      closeMsgModal();
      loadMensajes();
    } catch (e) { toast(e.message, 'err'); }
  });

  // ── Importar CSV ─────────────────────────────────────────────────────
  document.getElementById('form-csv').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const out = document.getElementById('csv-result');
    out.innerHTML = '<p class="text-neutral-500 text-sm">Importando...</p>';
    try {
      const res = await fetch(`${API}/importar-csv`, { method: 'POST', credentials: 'include', body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error al importar');
      const r = data.report;
      out.innerHTML = `
        <p class="text-success-600 font-medium">${esc(data.message)}</p>
        ${r.errors.length ? `<div class="mt-2 text-sm text-error-600"><p class="font-medium">Errores:</p><ul class="list-disc ml-5">${r.errors.map((x) => `<li>Línea ${x.line}: ${esc(x.error)}</li>`).join('')}</ul></div>` : ''}
        ${r.warnings?.length ? `<div class="mt-2 text-sm text-amber-700"><p class="font-medium">Ubicaciones sin coordenadas:</p><ul class="list-disc ml-5">${r.warnings.map((x) => `<li>Línea ${x.line}: ${esc(x.razon_social)} — ${esc(x.warning)}</li>`).join('')}</ul></div>` : ''}`;
      toast('Importación completada');
    } catch (err) {
      out.innerHTML = `<p class="text-error-600 text-sm">${esc(err.message)}</p>`;
    }
  });

  // ── Teclado: cerrar con Esc y atrapar el foco en los modales ─────────
  document.addEventListener('keydown', (e) => {
    const abierto = !modal.classList.contains('hidden') ? modal : (!modalMsg.classList.contains('hidden') ? modalMsg : null);
    if (!abierto) return;
    if (e.key === 'Escape') { e.preventDefault(); (abierto === modal ? closeAnuncioModal : closeMsgModal)(); return; }
    if (e.key === 'Tab') trapFocus(abierto, e);
  });

  // ── Inicio ───────────────────────────────────────────────────────────
  loadMe();
  activate('dashboard');
})();
