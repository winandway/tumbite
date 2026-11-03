// Capturas reales de C-ALTA-COBROS-DENTRO (SIG-5) en el sitio de pruebas: «Beneficios» del panel del
// restaurante con el formulario seguro de Stripe abierto dentro de Divoox, en español e inglés.
// Uso: node scripts/docs/capturas-alta-cobros.mjs   (Stripe en modo prueba; no se escribe ningún dato)
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const SITIO = 'https://staging.tumbite.com';
const fila = readFileSync('docs/CUENTAS-DE-PRUEBA.md', 'utf8')
  .split('\n')
  .find((l) => l.includes('demo.restaurante@ejemplo.com'));
const CLAVE = fila.split('|')[4].trim().replace(/`/g, '');
const r = await fetch(`${SITIO}/datos/cuentas/entrar`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ correo: 'demo.restaurante@ejemplo.com', clave: CLAVE }),
});
const { token } = await r.json();
const navegador = await chromium.launch();
try {
  for (const idioma of ['es', 'en']) {
    const ctx = await navegador.newContext({
      viewport: { width: 1366, height: 900 },
      deviceScaleFactor: 2,
      locale: idioma === 'en' ? 'en-US' : 'es-US',
    });
    await ctx.addCookies([
      {
        name: 'tumbite_sesion',
        value: token,
        domain: 'staging.tumbite.com',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ]);
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctx.newPage();
    const errores = [];
    p.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
    await p.goto(`${SITIO}${idioma === 'en' ? '' : '/es'}/panel/earnings`, {
      waitUntil: 'networkidle',
    });
    await p.screenshot({ path: `docs/capturas/restaurante-cobros-conectar-${idioma}.png` });
    await p
      .getByRole('button', {
        name:
          idioma === 'es'
            ? /Conectar mi cuenta|Terminar de conectar/
            : /Connect my bank|Finish connecting/,
      })
      .click();
    await p.getByTestId('alta-cobros').waitFor({ timeout: 30000 });
    await p.waitForTimeout(8000);
    const alta = p.getByTestId('alta-cobros');
    await alta.scrollIntoViewIfNeeded();
    await alta.screenshot({ path: `docs/capturas/restaurante-cobros-formulario-${idioma}.png` });
    console.log(idioma, 'url:', p.url(), 'errores:', errores.slice(0, 3));
    await ctx.close();
  }
} finally {
  await navegador.close();
}
