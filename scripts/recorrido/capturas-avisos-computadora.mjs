// Captura ORIGINAL de la tarjeta «Activar avisos» en el panel del restaurante abierto en una
// computadora (C-DOCS-SEMANA, 14 nov 2026) — todos los países; restaurante de prueba en Novi,
// Michigan. Contra el servidor local del recorrido (puerto 8790). Como en e2e/recorrido/avisosWeb.spec.ts,
// Chromium sin pantalla arranca «sin decidir» el permiso de avisos y nunca se pide al cargar.
// Guarda docs/capturas/recorrido/web-avisos-restaurante-computadora-<es|en>.png (a su ancho).
// Uso: node scripts/recorrido/capturas-avisos-computadora.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;

const navegador = await chromium.launch();
for (const idioma of ['es', 'en']) {
  const id = `${idioma}${Date.now().toString(36)}`;
  const r = await fetch(`${URL}/datos/cuentas/registro`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.82.${Math.floor(Math.random() * 200)}.${Date.now() % 250}`,
    },
    body: JSON.stringify({
      nombre: 'Restaurante de prueba',
      correo: `avisos.pc.${id}@recorrido.test`,
      clave: DATOS.clave,
      rol: 'restaurante',
    }),
  });
  if (!r.ok) throw new Error(`registro: ${r.status} ${await r.text()}`);
  const { token } = await r.json();
  const local = await fetch(`${URL}/datos/mi-restaurante`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      nombre: 'Pizzería de prueba',
      categoria: 'Pizza',
      telefono: '2480000000',
      direccion: '43000 Grand River Ave, Novi, MI',
      lat: 42.4806,
      lng: -83.4755,
    }),
  });
  if (!local.ok) throw new Error(`restaurante: ${local.status} ${await local.text()}`);
  const ctx = await navegador.newContext({
    viewport: { width: 1440, height: 900 },
    baseURL: URL,
    locale: idioma === 'en' ? 'en-US' : 'es-US',
  });
  await ctx.addInitScript(
    ([pase, i]) => {
      localStorage.setItem('tumbite.idioma', i);
      localStorage.setItem('tumbite.sesion', pase);
      const aviso = globalThis.Notification;
      if (aviso) {
        Object.defineProperty(aviso, 'permission', { get: () => 'default' });
        aviso.requestPermission = () => Promise.resolve('default');
      }
    },
    [token, idioma],
  );
  const p = await ctx.newPage();
  await p.goto('/restaurant/');
  await p.getByTestId('tarjeta-avisos-web').waitFor({ timeout: 60_000 });
  await new Promise((x) => setTimeout(x, 1_500));
  await p.screenshot({
    path: join(
      RAIZ,
      'docs',
      'capturas',
      'recorrido',
      `web-avisos-restaurante-computadora-${idioma}.png`,
    ),
  });
  await ctx.close();
}
await navegador.close();
console.log('captura de avisos en la computadora lista');
