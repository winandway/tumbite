// Capturas reales de la app Driver en el sitio de pruebas para su presentación (29 oct 2026):
// turnos, seguridad, calificaciones (repartidor destacado) y el mapa con las zonas de más pedidos.
// Entra con el pase de la cuenta demo por la API (sin escribir contraseñas en la página).
// Uso: CLAVE_DEMO=… node scripts/presentaciones/capturas-repartidor.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const URL = 'https://staging.tumbite.com';
const CLAVE = process.env.CLAVE_DEMO;
if (!CLAVE) throw new Error('Falta CLAVE_DEMO (la de las cuentas demo de pruebas).');
const SALIDA = join(process.cwd(), 'docs', 'capturas', 'presentaciones');
mkdirSync(SALIDA, { recursive: true });

const r = await fetch(`${URL}/datos/cuentas/entrar`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ correo: 'demo.repartidor@ejemplo.com', clave: CLAVE }),
});
const { token } = await r.json();
if (!token) throw new Error('No se pudo entrar con la cuenta demo del repartidor.');

const nav = await chromium.launch();
for (const idioma of ['es', 'en']) {
  const en = idioma === 'en';
  const ctx = await nav.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: en ? 'en-US' : 'es-US',
    geolocation: { latitude: 25.7617, longitude: -80.1918 },
    permissions: ['geolocation'],
  });
  await ctx.addInitScript(
    ([t, i]) => {
      localStorage.setItem('tumbite.sesion', t);
      localStorage.setItem('tumbite.idioma', i);
    },
    [token, idioma],
  );
  const p = await ctx.newPage();
  const abrir = async () => {
    await p.goto(`${URL}/driver/`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2000);
  };
  const foto = (n) => p.screenshot({ path: join(SALIDA, `repartidor-${n}-${idioma}.png`) });
  const delMenu = async (texto) => {
    await p
      .getByRole('button', { name: /^(Menu|Menú)$/ })
      .first()
      .click();
    await p.getByRole('button', { name: texto }).first().click();
    await p.waitForTimeout(2000);
  };

  await abrir();
  await foto('inicio');
  await delMenu(en ? 'My shifts' : 'Mis turnos');
  await foto('turnos');
  await abrir();
  await delMenu(en ? 'Safety' : 'Seguridad');
  await foto('seguridad');
  await abrir();
  await p.getByRole('tab', { name: en ? 'Profile' : 'Perfil' }).click();
  await p.getByRole('button', { name: en ? 'My ratings' : 'Mis calificaciones' }).click();
  await p.getByTestId('calificaciones').waitFor({ timeout: 20_000 });
  await p.waitForTimeout(1000);
  await foto('destacado');
  await ctx.close();
  console.log('listo', idioma);
}
await nav.close();
