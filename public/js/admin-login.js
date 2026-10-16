/* public/js/admin-login.js — Inicio de sesión del administrador */
(function () {
  const form = document.getElementById('login-form');
  const msg = document.getElementById('login-msg');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    msg.textContent = 'Verificando...';
    msg.className = 'text-sm text-center text-neutral-500';

    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo iniciar sesión');
      msg.textContent = 'Acceso correcto. Entrando...';
      msg.className = 'text-sm text-center text-success-600';
      window.location.href = '/admin/panel';
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'text-sm text-center text-error-500';
      btn.disabled = false;
    }
  });
})();
