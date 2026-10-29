/* global window */
// Capturas reales del sitio de pruebas para las presentaciones (29 oct 2026). Entra con el pase de
// las cuentas demo por la API (sin escribir contraseñas en la página).
// Uso: CLAVE_DEMO=… node scripts/presentaciones/capturas.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const URL = 'https://staging.tumbite.com';
const CLAVE = process.env.CLAVE_DEMO;
if (!CLAVE) throw new Error('Falta CLAVE_DEMO (la de las cuentas demo de pruebas).');
const SALIDA = join(process.cwd(), 'docs', 'capturas', 'presentaciones');
mkdirSync(SALIDA, { recursive: true });

async function api(metodo, ruta, cuerpo, token) {
  const r = await fetch(URL + ruta, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return r.json();
}
const sesion = (correo) => api('POST', '/datos/cuentas/entrar', { correo, clave: CLAVE });
const cli = await sesion('demo.cliente@ejemplo.com');
const rest = await sesion('demo.restaurante@ejemplo.com');
const mio = await api('GET', '/datos/mi-restaurante', undefined, rest.token);
const rid = mio.restaurante.id;
const platos = mio.platos.filter(
  (p) => p.disponible && !(p.grupos ?? []).some((g) => g.minimo > 0),
);

// Un pedido en grupo de muestra con dos platos (no cobra nada; se cancela al final).
const g = await api('POST', '/datos/grupos', { restauranteId: rid }, cli.token);
for (const p of platos.slice(0, 2))
  await api('POST', `/datos/grupos/${g.codigo}/items`, { platoId: p.id, cantidad: 1 }, cli.token);

const nav = await chromium.launch();
for (const idioma of ['es', 'en']) {
  const ctx = await nav.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: idioma === 'en' ? 'en-US' : 'es-US',
  });
  await ctx.addInitScript(
    ([token, i]) => {
      localStorage.setItem('tumbite.sesion', token);
      localStorage.setItem('tumbite.idioma', i);
    },
    [cli.token, idioma],
  );
  const p = await ctx.newPage();
  await p.goto(`${URL}/app/group/${g.codigo}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: join(SALIDA, `cliente-grupo-${idioma}.png`) });
  await ctx.close();

  // Panel del restaurante: «Conectar tu punto de venta».
  const c2 = await nav.newContext({
    viewport: { width: 1280, height: 900 },
    locale: idioma === 'en' ? 'en-US' : 'es-US',
  });
  await c2.addCookies([
    {
      name: 'tumbite_sesion',
      value: rest.token,
      domain: 'staging.tumbite.com',
      path: '/',
      secure: true,
      httpOnly: true,
    },
  ]);
  const q = await c2.newPage();
  await q.goto(`${URL}${idioma === 'es' ? '/es' : ''}/panel/restaurant`, {
    waitUntil: 'networkidle',
  });
  await q.waitForTimeout(1500);
  const pos = q.getByRole('heading', {
    name: idioma === 'en' ? 'Connect your point of sale' : 'Conectar tu punto de venta',
  });
  if (await pos.count()) {
    await pos.scrollIntoViewIfNeeded();
    await q.evaluate(() => window.scrollBy(0, -40));
    await q.screenshot({ path: join(SALIDA, `restaurante-punto-de-venta-${idioma}.png`) });
  } else console.log('sin sección de punto de venta', idioma);
  await q.goto(`${URL}${idioma === 'es' ? '/es' : ''}/panel/orders`, { waitUntil: 'networkidle' });
  await q.waitForTimeout(1500);
  await q.screenshot({ path: join(SALIDA, `restaurante-pedidos-imprimir-${idioma}.png`) });
  await c2.close();
}

// La comanda impresa, con los dos platos de muestra (sin la orden de imprimir).
const c3 = await nav.newContext({ viewport: { width: 330, height: 420 }, deviceScaleFactor: 2 });
const h = await c3.newPage();
const lineas = platos
  .slice(0, 2)
  .map((x) => `<tr><td class="c">1×</td><td>${x.nombreEs}</td></tr>`)
  .join('');
await h.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:monospace;font-size:13px;width:300px;margin:12px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:14px;margin:6px 0}table{width:100%;border-collapse:collapse}td{padding:3px 0}.c{width:34px;font-weight:bold}
.n{border-top:1px dashed #000;margin-top:8px;padding-top:6px}</style></head><body><h1>#A1B2</h1><div>${mio.restaurante.nombre}</div><div>29 oct, 7:30 p.m.</div>
<h2>A DOMICILIO</h2><table>${lineas}</table><div class="n"><b>Notas:</b> Sin cebolla, por favor</div></body></html>`);
await h.screenshot({ path: join(SALIDA, 'restaurante-comanda-es.png'), fullPage: true });
await c3.close();
await nav.close();
await api('POST', `/datos/grupos/${g.codigo}/cancelar`, {}, cli.token);
console.log('listo');
