// Una sola captura del panel con una cuenta de demostración (para revisar una pantalla suelta).
// Uso: CLAVE_DEMO=… node scripts/panel/captura-una.mjs <base> <correo> <ruta> <archivo.png> [ancho] [idioma]
// En <ruta>, «@admin» se cambia por la dirección privada del superadmin (nunca se imprime).
import { chromium } from '@playwright/test';

const [base, correo, ruta, archivo, ancho = '1440', idioma = 'es'] = process.argv.slice(2);
const navegador = await chromium.launch();
const ctx = await navegador.newContext({
  viewport: { width: Number(ancho), height: Number(ancho) < 600 ? 812 : 900 },
});
await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
const p = await ctx.newPage();
const errores = [];
p.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
p.on('pageerror', (e) => errores.push(String(e)));
const r = await p.request.post(`${base}/datos/cuentas/entrar`, {
  data: { correo, clave: process.env.CLAVE_DEMO },
});
if (!r.ok()) throw new Error(`no entra: ${r.status()}`);
let destino = ruta;
if (ruta.includes('@admin')) {
  const a = await (await p.request.get(`${base}/datos/admin/ruta`)).json();
  destino = ruta.replace('@admin', `/panel/${a.ruta}`);
}
if (ruta.includes('@flex')) {
  const e = await (await p.request.get(`${base}/datos/v1/flex/empresas`)).json();
  destino = ruta.replace('@flex', `/panel/business/${e.empresas?.[0]?.id ?? ''}`);
}
await p.goto(`${base}${destino}`, { waitUntil: 'networkidle' }).catch(() => undefined);
await p.waitForTimeout(900);
if (process.env.ABRIR_MENU) await p.locator('.pd-hamburguesa').click();
if (process.env.CLIC) await p.locator(process.env.CLIC).first().click();
await p.waitForTimeout(300);
await p.screenshot({ path: archivo, fullPage: process.env.SOLO_VISTA !== '1' });
const sobra = await p.evaluate('document.documentElement.scrollWidth - window.innerWidth');
console.log(
  'listo',
  archivo,
  'sobra a lo ancho:',
  sobra,
  errores.length
    ? `errores: ${errores
        .slice(0, 3)
        .join(' | ')
        .replace(/control-[0-9a-f]+/g, 'control-…')}`
    : '',
);
await navegador.close();
