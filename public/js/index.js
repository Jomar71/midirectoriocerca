/* public/js/index.js — Página principal: filtro dependiente Departamento→Ciudad + contacto 24/7 */

/* Filtro dependiente: al elegir un departamento, el select de ciudades
   se rellena solo con las ciudades de ese departamento. */
(function () {
  const dept = document.getElementById('filtro-departamento');
  const city = document.getElementById('filtro-ciudad');
  if (!dept || !city) return;

  const groups = Array.from(city.querySelectorAll('optgroup')).map((g) => ({
    dept: g.dataset.dept,
    label: g.label,
    cities: Array.from(g.querySelectorAll('option')).map((o) => ({ value: o.value, text: o.textContent })),
  }));

  dept.addEventListener('change', () => {
    const selected = dept.value;
    const previous = city.value;
    city.innerHTML = '';
    city.appendChild(new Option('Todas las ciudades', ''));
    groups
      .filter((g) => !selected || g.dept === selected)
      .forEach((g) => {
        const og = document.createElement('optgroup');
        og.label = g.label;
        og.dataset.dept = g.dept;
        g.cities.forEach((c) => og.appendChild(new Option(c.text, c.value)));
        city.appendChild(og);
      });
    if (Array.from(city.options).some((o) => o.value === previous)) city.value = previous;
  });
})();

/* Contacto general (asistencia 24/7) */
(function () {
  const form = document.getElementById('contacto-form');
  if (!form) return;
  const msg = document.getElementById('contacto-msg');

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
      msg.textContent = data.message || 'Solicitud recibida.';
      msg.className = 'text-sm text-success-600';
      form.reset();
    } catch (err) {
      msg.textContent = err.message || 'Error al enviar el mensaje';
      msg.className = 'text-sm text-error-600';
    } finally {
      btn.disabled = false;
    }
  });
})();
