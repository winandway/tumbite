// C-FICHA-SIN-CORTES (22 nov 2026, Gerencia). Corre DENTRO de la página (page.evaluate): devuelve en
// palabras todo lo que en una ficha del panel queda cortado, montado sobre otra tarjeta o desparejo.
// La usan las capturas de las fichas y la prueba del recorrido; no depende de nada de fuera.
/* global document, window, getComputedStyle */
export function revisarCortes() {
  const fallos = [];
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const dice = (e) =>
    `«${(e.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)}» (${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? `.${e.className.split(' ')[0]}` : ''})`;
  const zona = document.querySelector('.pd-contenido') ?? document.body;
  // 1. La página no se desliza de lado.
  if (document.documentElement.scrollWidth > window.innerWidth + 1)
    fallos.push(
      `la página se desliza de lado (${document.documentElement.scrollWidth} px en ${window.innerWidth})`,
    );
  // 2. Nada se sale de su tarjeta ni queda recortado dentro de ella.
  const tarjetas = [...zona.querySelectorAll('.tarjeta-form, .super-tarjeta, .pd-tarjeta')].filter(
    visible,
  );
  for (const t of tarjetas) {
    const caja = t.getBoundingClientRect();
    for (const e of t.querySelectorAll('*')) {
      if (!visible(e) || e.closest('[role="menu"], [role="dialog"], .leaflet-container, table'))
        continue;
      const r = e.getBoundingClientRect();
      if (r.right > caja.right + 1 || r.left < caja.left - 1)
        fallos.push(`se sale de su tarjeta: ${dice(e)}`);
      const s = getComputedStyle(e);
      const recorta = s.overflowX === 'hidden' || s.overflowX === 'clip';
      if (recorta && e.scrollWidth > e.clientWidth + 1 && e.children.length === 0)
        fallos.push(`queda cortado: ${dice(e)}`);
    }
  }
  // 3. Dos tarjetas hermanas no se pisan.
  for (const grupo of zona.querySelectorAll('.super-dos, .super-tarjetas')) {
    const hijos = [...grupo.children].filter(visible).map((h) => h.getBoundingClientRect());
    for (const [i, a] of hijos.entries())
      for (const b of hijos.slice(i + 1)) {
        if (
          a.left < b.right - 1 &&
          b.left < a.right - 1 &&
          a.top < b.bottom - 1 &&
          b.top < a.bottom - 1
        )
          fallos.push('dos tarjetas se pisan');
      }
  }
  // 4. Las cifras van en filas parejas: ninguna tarjeta sola en la última fila.
  for (const fila of zona.querySelectorAll('.super-tarjetas')) {
    const hijos = [...fila.children].filter(visible).map((h) => h.getBoundingClientRect());
    if (hijos.length < 3) continue;
    const filas = new Map();
    for (const h of hijos) filas.set(Math.round(h.top), (filas.get(Math.round(h.top)) ?? 0) + 1);
    const cuentas = [...filas.values()];
    const anchos = hijos.map((h) => Math.round(h.width));
    const completa = cuentas.at(-1) === cuentas[0] || Math.max(...anchos) - Math.min(...anchos) > 4;
    if (cuentas.length > 1 && cuentas.at(-1) === 1 && !completa)
      fallos.push(`cifras desparejas: ${cuentas.join(' + ')} (una tarjeta sola en la última fila)`);
    if (cuentas.length > 1 && window.innerWidth >= 1280)
      fallos.push(
        `las cifras no caben en una fila a ${window.innerWidth} px: ${cuentas.join(' + ')}`,
      );
  }
  return [...new Set(fallos)];
}
