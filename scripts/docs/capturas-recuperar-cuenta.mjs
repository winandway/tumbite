// C-RECUPERAR-WHATSAPP (27 nov 2026): capturas de «Recupera tu cuenta» para Docs, en español e inglés.
// Toma la pantalla REAL del panel (servidor de desarrollo en localhost:5173) con las respuestas del
// servidor simuladas: no le habla a Meta ni a ninguna cuenta. Datos neutros (números 555, sin ciudades).
// Uso: npm run dev -w @tumbite/panel   y luego   node scripts/docs/capturas-recuperar-cuenta.mjs
/* eslint-disable security/detect-object-injection -- guion local: el idioma sale de una lista fija */
/* global document */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const raiz = join(import.meta.dirname, '..', '..');
const originales = join(raiz, 'docs', 'capturas', 'recuperar-cuenta');
const publicas = join(raiz, 'apps', 'panel', 'public', 'docs');
const BASE = process.env.BASE ?? 'http://localhost:5173';

const DATOS = {
  es: { pais: 'VE', celular: '04145550100', ruta: '/es/forgot-password' },
  en: { pais: 'US', celular: '3135550100', ruta: '/forgot-password' },
};

async function guardar(pagina, nombre) {
  const png = join(originales, `${nombre}.png`);
  // Solo la pantalla (sin el pie con ciudades ni la burbuja de soporte) y sin casilla enfocada.
  await pagina.addStyleTag({ content: '.chat-soporte-burbuja{display:none!important}' });
  await pagina.evaluate(() => document.activeElement?.blur?.());
  await pagina.locator('main.acceso').screenshot({ path: png });
  execFileSync('cwebp', [
    '-quiet',
    '-q',
    '82',
    '-resize',
    '540',
    '0',
    png,
    '-o',
    join(publicas, `${nombre}.webp`),
  ]);
  console.log('lista', nombre);
}

const navegador = await chromium.launch();
for (const idioma of ['es', 'en']) {
  const d = DATOS[idioma];
  const ctx = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: idioma === 'en' ? 'en-US' : 'es-VE',
  });
  const pagina = await ctx.newPage();
  await pagina.route(
    (u) => u.pathname.startsWith('/datos/'),
    async (r) => {
      const u = r.request().url();
      if (u.includes('/datos/publico')) return r.fulfill({ json: { turnstileSitio: '' } });
      if (u.includes('/pais-sugerido')) return r.fulfill({ json: { pais: d.pais } });
      if (u.endsWith('/recuperar/verificar'))
        return r.fulfill({
          json: {
            ok: true,
            cuentas: [{ pase: 'pase-de-ejemplo', rol: 'cliente', nombre: 'Ana', correo: null }],
          },
        });
      if (u.includes('/recuperar/codigo')) return r.fulfill({ json: { ok: true } });
      return r.fulfill({ json: {} });
    },
  );
  await pagina.goto(`${BASE}${d.ruta}`);
  await pagina.evaluate(() => localStorage.clear());
  await pagina.reload();
  await pagina.locator('[data-testid="pais-telefono"]').selectOption(d.pais);
  await pagina
    .getByLabel(idioma === 'en' ? 'Cell phone' : 'Celular', { exact: true })
    .fill(d.celular);
  await pagina.waitForTimeout(300);
  await guardar(pagina, `recuperar-cuenta-inicio-${idioma}`);
  await pagina
    .getByRole('button', { name: idioma === 'en' ? 'Send me the code' : 'Mandarme el código' })
    .click();
  await pagina.getByLabel(idioma === 'en' ? '6-digit code' : 'Código de 6 números').fill('123456');
  await pagina.waitForTimeout(300);
  await guardar(pagina, `recuperar-cuenta-codigo-${idioma}`);
  await pagina
    .getByRole('button', { name: idioma === 'en' ? 'Verify the code' : 'Verificar el código' })
    .click();
  await pagina
    .getByLabel(idioma === 'en' ? 'New password' : 'Contraseña nueva')
    .fill('Ejemplo-2026');
  await pagina
    .getByLabel(idioma === 'en' ? 'Repeat the password' : 'Repite la contraseña')
    .fill('Ejemplo-2026');
  // El ojito abierto en la primera, para que se vea que se puede mirar lo escrito.
  await pagina
    .getByRole('button', { name: idioma === 'en' ? 'Show password' : 'Ver la contraseña' })
    .first()
    .click();
  await pagina.waitForTimeout(300);
  await guardar(pagina, `recuperar-cuenta-clave-${idioma}`);
  await ctx.close();
}
await navegador.close();
