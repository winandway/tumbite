// Captura del panel de operaciones para la ayuda interna «¿Quién paga la comisión de los viajes?»
// (C-QUIEN-PAGA-VIAJES, 23 nov 2026) — Venezuela. Contra el servidor LOCAL del recorrido. Corre después
// de capturas-tarifa-servicio.mjs (deja la cuenta del equipo de las fotos). C-AYUDA-INTERNA: las fotos
// del superadmin NO van al repositorio: quedan en la carpeta privada y se suben con
// `node scripts/docs/subir-ayuda-interna.mjs`.
// Uso: node scripts/recorrido/capturas-quien-paga-panel.mjs
/* eslint-disable security/detect-non-literal-fs-filename -- guion local: escribe en la carpeta privada de capturas */
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
mkdirSync(ORIGINALES_PRIVADAS, { recursive: true });
mkdirSync(CAPTURAS_PRIVADAS, { recursive: true });
const sql = async (q) =>
  (
    await fetch(`${URL}/datos/interno/diagnostico/sql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-reloj-secreto': DATOS.relojSecreto },
      body: JSON.stringify({ sql: q }),
    })
  ).json();
const pase = randomBytes(24).toString('hex');
await sql(
  `INSERT INTO sesiones (id, usuario_id, expira_en) VALUES ('${createHash('sha256').update(pase).digest('hex')}', 'zz-mtve-a', datetime('now', '+30 minutes'))`,
);
const { ruta } = await (
  await fetch(`${URL}/datos/admin/ruta`, { headers: { authorization: `Bearer ${pase}` } })
).json();

const navegador = await chromium.launch();
try {
  for (const idioma of ['es', 'en']) {
    const ctx = await navegador.newContext({
      viewport: { width: 1280, height: 900 },
      baseURL: URL,
      locale: idioma === 'en' ? 'en-US' : 'es-VE',
    });
    await ctx.addCookies([{ name: 'tumbite_sesion', value: pase, domain: 'localhost', path: '/' }]);
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctx.newPage();
    await p.goto(`${idioma === 'es' ? '/es' : ''}/panel${ruta ? `/${ruta}` : ''}/flexfinance`);
    const bloque = p.getByTestId('quien-paga-viajes');
    await bloque.waitFor({ timeout: 60_000 });
    await p.getByTestId('quien-paga-reglas').waitFor({ timeout: 30_000 });
    // La cabecera del panel queda fija arriba: se sube el bloque hasta dejar su título debajo de ella.
    await bloque.evaluate((x) => {
      x.scrollIntoView({ block: 'start' });
      let caja = x.parentElement;
      while (caja && caja.scrollHeight <= caja.clientHeight + 4) caja = caja.parentElement;
      const quien = caja ?? globalThis.document.scrollingElement;
      quien.scrollTop += x.getBoundingClientRect().top - 100;
    });
    await p.waitForTimeout(800);
    const nombre = `quien-paga-viajes-super-${idioma}`;
    const original = join(ORIGINALES_PRIVADAS, `${nombre}.png`);
    await p.screenshot({ path: original });
    execFileSync('cwebp', [
      '-quiet',
      '-q',
      '82',
      original,
      '-o',
      join(CAPTURAS_PRIVADAS, `${nombre}.webp`),
    ]);
    await ctx.close();
  }
} finally {
  await navegador.close();
}
console.log('capturas de «¿Quién paga la comisión de los viajes?» listas en la carpeta privada');
