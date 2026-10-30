/* global document */
// Repaso en celular (375 px) de las pantallas principales en el sitio de pruebas (29 oct 2026):
// fotos de cada una y lista de lo que se ve roto (errores de consola, textos sin traducir, cajas que
// se salen del ancho). Solo mira: no paga, no pide, no cambia nada.
// Uso: CLAVE_DEMO=… node scripts/presentaciones/repaso-celular.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const URL = 'https://staging.tumbite.com';
const CLAVE = process.env.CLAVE_DEMO;
if (!CLAVE) throw new Error('Falta CLAVE_DEMO.');
const SALIDA = join(process.cwd(), 'docs', 'capturas', 'repaso-celular');
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
const pases = new Map(
  Object.entries({
    cliente: await entrar('demo.cliente@ejemplo.com'),
    repartidor: await entrar('demo.repartidor@ejemplo.com'),
    restaurante: await entrar('demo.restaurante@ejemplo.com'),
  }),
);
const PANTALLAS = [
  ['cliente', '/app/'],
  ['cliente', '/app/restaurants'],
  ['cliente', '/app/search'],
  ['cliente', '/app/orders'],
  ['cliente', '/app/favorites'],
  ['cliente', '/app/account'],
  ['cliente', '/app/notifications'],
  ['cliente', '/app/cart'],
  ['cliente', '/app/stores'],
  ['cliente', '/app/ride'],
  ['repartidor', '/driver/'],
  ['restaurante', '/restaurant/'],
];
const nav = await chromium.launch();
const hallazgos = [];
for (const idioma of ['es', 'en'])
  for (const [quien, ruta] of PANTALLAS) {
    const ctx = await nav.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
      locale: idioma === 'en' ? 'en-US' : 'es-US',
    });
    await ctx.addInitScript(
      ([t, i]) => {
        localStorage.setItem('tumbite.sesion', t);
        localStorage.setItem('tumbite.idioma', i);
      },
      [pases.get(quien), idioma],
    );
    const p = await ctx.newPage();
    const errores = [];
    p.on('pageerror', (e) => errores.push(`error: ${e.message.slice(0, 160)}`));
    p.on('console', (m) => {
      if (m.type() === 'error' && !/cloudflareinsights|Content Security Policy/.test(m.text()))
        errores.push(`consola: ${m.text().slice(0, 160)}`);
    });
    p.on('response', (r) => {
      if (r.url().includes('/datos/') && r.status() >= 500)
        errores.push(`servidor ${r.status()}: ${r.url().replace(URL, '')}`);
    });
    await p
      .goto(`${URL}${ruta}`, { waitUntil: 'networkidle' })
      .catch((e) => errores.push(String(e)));
    await p.waitForTimeout(2500);
    // Se sale del ancho del celular.
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > 380) errores.push(`ancho ${ancho} px (se sale de 375)`);
    // Textos del otro idioma a la vista (señal de traducción faltante).
    const texto = await p.evaluate(() => document.body.innerText);
    const delOtro =
      idioma === 'en'
        ? texto.match(/\b(Pedidos|Ganancias|Inicio|Perfil|Buscar|Tu pedido|Cerrar sesión)\b/g)
        : texto.match(/\b(Orders|Earnings|Home|Profile|Search|Your order|Log out)\b/g);
    if (delOtro) errores.push(`otro idioma: ${[...new Set(delOtro)].join(', ')}`);
    const nombre = `${quien}${ruta.replace(/\//g, '-').replace(/-$/, '')}-${idioma}`;
    await p.screenshot({ path: join(SALIDA, `${nombre}.png`) });
    hallazgos.push(`${nombre}: ${errores.length ? errores.join(' | ') : 'ok'}`);
    await ctx.close();
  }
await nav.close();
console.log(hallazgos.join('\n'));
