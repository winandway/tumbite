/* global window */
// Capturas reales del sitio de pruebas (29 oct 2026): entra con el pase de las cuentas demo por la API
// (sin escribir contraseñas en la página). Uso: CLAVE_DEMO=… SALIDA=carpeta node scripts/recorrido/capturas-staging-29oct.mjs
import { chromium } from '@playwright/test';
const URL = 'https://staging.tumbite.com';
const CLAVE = process.env.CLAVE_DEMO;
if (!CLAVE) throw new Error('Falta CLAVE_DEMO (la de las cuentas demo de pruebas).');
const SALIDA = process.env.SALIDA;
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
const sesion = async (correo) => api('POST', '/datos/cuentas/entrar', { correo, clave: CLAVE });
const cli = await sesion('demo.cliente@ejemplo.com');
const rest = await sesion('demo.restaurante@ejemplo.com');
const mios = await api('GET', '/datos/mis-pedidos', undefined, cli.token);
const entregado = mios.pedidos.find((p) => p.estado === 'entregado');
const rep = await api('GET', `/datos/pedidos/${entregado.id}/repetir`, undefined, cli.token);
const carrito = {
  restauranteId: rep.restaurante.id,
  restauranteNombre: rep.restaurante.nombre,
  plan: rep.restaurante.plan,
  restLat: rep.restaurante.lat,
  restLng: rep.restaurante.lng,
  moneda: rep.restaurante.moneda,
  esTienda: rep.restaurante.esTienda,
  lineas: rep.lineas.map((l) => ({ ...l, clave: `${l.platoId}:` })),
};
const navegador = await chromium.launch();
for (const idioma of ['es', 'en']) {
  const ctx = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: idioma === 'en' ? 'en-US' : 'es-US',
    geolocation: { latitude: 25.78, longitude: -80.2 },
    permissions: ['geolocation'],
  });
  await ctx.addInitScript(
    ([token, uid, c, i]) => {
      localStorage.setItem('tumbite.sesion', token);
      localStorage.setItem(`tumbite.carrito.${uid}`, c);
      localStorage.setItem('tumbite.idioma', i);
    },
    [cli.token, cli.usuario.id, JSON.stringify(carrito), idioma],
  );
  const p = await ctx.newPage();
  await p.goto(`${URL}/app/cart`, { waitUntil: 'networkidle' });
  const programar = p.getByRole('radio', { name: idioma === 'en' ? 'Schedule' : 'Programar' });
  await programar.click();
  await p.waitForTimeout(800);
  const franja = p.getByRole('radio').filter({ hasText: /\d/ }).nth(2);
  await franja.click().catch(() => {});
  await p.waitForTimeout(600);
  await p
    .getByText(idioma === 'en' ? 'When do you want it?' : '¿Cuándo lo quieres?')
    .scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, -80));
  await p.screenshot({ path: `${SALIDA}/cliente-programar-${idioma}.png` });
  await p.goto(`${URL}/app`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  const fila = p.getByTestId('pedir-otra-vez');
  if (await fila.count()) {
    await fila.scrollIntoViewIfNeeded();
    await p.evaluate(() => window.scrollBy(0, -60));
    await p.screenshot({ path: `${SALIDA}/cliente-pedir-otra-vez-${idioma}.png` });
  } else console.log('sin fila pedir otra vez', idioma);
  await ctx.close();
  // Panel del restaurante (cookie de sesión), tablero.
  const c2 = await navegador.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
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
  await q.goto(`${URL}${idioma === 'es' ? '/es' : ''}/panel`, { waitUntil: 'networkidle' });
  await q.waitForTimeout(1500);
  await q.screenshot({
    path: `${SALIDA}/restaurante-tablero-rendimiento-${idioma}.png`,
    fullPage: true,
  });
  await c2.close();
}
await navegador.close();
console.log('listo');
