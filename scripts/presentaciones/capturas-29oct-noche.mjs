// Comprobación en pruebas y capturas reales de lo del 29 oct en la noche: «Tengo un problema» con
// plato equivocado y foto (cliente), «Tu año» (Driver) y «Modo tableta» (panel del restaurante).
// Entra con el pase de las cuentas demo por la API. No envía ninguna queja ni toca dinero.
// Uso: CLAVE_DEMO=… node scripts/presentaciones/capturas-29oct-noche.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const URL = 'https://staging.tumbite.com';
const CLAVE = process.env.CLAVE_DEMO;
if (!CLAVE) throw new Error('Falta CLAVE_DEMO.');
const SALIDA = join(process.cwd(), 'docs', 'capturas', 'hoy-29oct');
mkdirSync(SALIDA, { recursive: true });
const entrar = async (correo) =>
  (
    await (
      await fetch(`${URL}/datos/cuentas/entrar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ correo, clave: CLAVE }),
      })
    ).json()
  ).token;
const cli = await entrar('demo.cliente@ejemplo.com');
const rep = await entrar('demo.repartidor@ejemplo.com');
const rest = await entrar('demo.restaurante@ejemplo.com');
const pedidos = await (
  await fetch(`${URL}/datos/mis-pedidos`, { headers: { authorization: `Bearer ${cli}` } })
).json();
const entregado = pedidos.pedidos.find((p) => p.estado === 'entregado');
if (!entregado) throw new Error('La cuenta demo no tiene un pedido entregado.');

const nav = await chromium.launch();
const resultados = [];
for (const idioma of ['es', 'en']) {
  const en = idioma === 'en';
  const telefono = async (token) => {
    const ctx = await nav.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      locale: en ? 'en-US' : 'es-US',
    });
    await ctx.addInitScript(
      ([t, i]) => {
        localStorage.setItem('tumbite.sesion', t);
        localStorage.setItem('tumbite.idioma', i);
      },
      [token, idioma],
    );
    return ctx;
  };
  // Cliente: «Tengo un problema» → plato equivocado: salen los platos y la foto.
  const c1 = await telefono(cli);
  const p = await c1.newPage();
  await p.goto(`${URL}/app/order/${entregado.id}`, { waitUntil: 'networkidle' });
  await p
    .getByText(en ? 'Problems with your order? Tell us' : '¿Problemas con tu pedido? Cuéntanos')
    .first()
    .click();
  await p
    .getByRole('radio', {
      name: en ? 'I got the wrong order or item' : 'Me llegó otro pedido o algo distinto',
    })
    .click();
  await p.getByRole('checkbox').first().waitFor({ timeout: 20_000 });
  const platos = await p
    .getByText(en ? 'Which item was wrong? Check it.' : '¿Qué plato vino equivocado? Márcalo.')
    .count();
  const foto = await p
    .getByText(en ? 'Add a photo (optional)' : 'Agregar una foto (opcional)')
    .count();
  resultados.push(`cliente ${idioma}: platos ${platos}, foto ${foto}`);
  await p
    .getByText(en ? 'Add a photo (optional)' : 'Agregar una foto (opcional)')
    .scrollIntoViewIfNeeded();
  await p.screenshot({ path: join(SALIDA, `cliente-ayuda-pedido-${idioma}.png`) });
  await c1.close();
  // Driver: «Tu año» en Ganancias.
  const c2 = await telefono(rep);
  const q = await c2.newPage();
  await q.goto(`${URL}/driver/`, { waitUntil: 'networkidle' });
  await q.getByRole('tab', { name: en ? 'Earnings' : 'Ganancias' }).click();
  const anio = q.getByTestId('resumen-anual');
  const hay = await anio
    .waitFor({ timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  resultados.push(`driver ${idioma}: tu año ${hay ? 'visible' : 'NO está'}`);
  if (hay) {
    await anio.scrollIntoViewIfNeeded();
    await q.screenshot({ path: join(SALIDA, `repartidor-tu-ano-${idioma}.png`) });
  }
  await c2.close();
  // Panel del restaurante: botón «Modo tableta».
  const c3 = await nav.newContext({
    viewport: { width: 1280, height: 860 },
    locale: en ? 'en-US' : 'es-US',
  });
  await c3.addCookies([
    {
      name: 'tumbite_sesion',
      value: rest,
      domain: 'staging.tumbite.com',
      path: '/',
      secure: true,
      httpOnly: true,
    },
  ]);
  const r = await c3.newPage();
  await r.goto(`${URL}${en ? '' : '/es'}/panel/orders`, { waitUntil: 'networkidle' });
  const boton = r.getByRole('button', { name: en ? 'Tablet mode' : 'Modo tableta' });
  resultados.push(`panel ${idioma}: botón ${await boton.count()}`);
  await boton.click();
  await r.waitForTimeout(800);
  resultados.push(`panel ${idioma}: menú oculto ${await r.locator('.panel-menu').isHidden()}`);
  await r.screenshot({ path: join(SALIDA, `restaurante-modo-tableta-${idioma}.png`) });
  await c3.close();
}
await nav.close();
console.log(resultados.join('\n'));
