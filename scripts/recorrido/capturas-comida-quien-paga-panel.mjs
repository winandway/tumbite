// Captura del panel de operaciones para la ayuda interna «Comida: quién paga qué»
// (C-COMIDA-VE-QUIEN-PAGA, 23 nov 2026) — Venezuela. Contra el servidor LOCAL del recorrido, con la
// cuenta del equipo del armado de Comida en Venezuela (corre después de capturas-comida-venezuela.mjs
// o de probar-comida-venezuela.mjs). C-AYUDA-INTERNA: las fotos del superadmin NO van al repositorio:
// quedan en la carpeta privada y se suben con `node scripts/docs/subir-ayuda-interna.mjs`. También deja
// en la carpeta privada la comprobación a ancho de celular (`comprobacion-comida-quien-paga-*`).
// Uso: node scripts/recorrido/capturas-comida-quien-paga-panel.mjs
/* eslint-disable security/detect-non-literal-fs-filename -- guion local: escribe en la carpeta privada de capturas */
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
const armado = await (
  await fetch(`${URL}/datos/interno/pruebas/comida-ve/armar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-reloj-secreto': DATOS.relojSecreto },
    body: '{}',
  })
).json();
const pase = armado.tokens?.equipo;
if (!pase) throw new Error('el armado de Comida en Venezuela no devolvió la cuenta del equipo');
const { ruta } = await (
  await fetch(`${URL}/datos/admin/ruta`, { headers: { authorization: `Bearer ${pase}` } })
).json();

const navegador = await chromium.launch();
try {
  for (const idioma of ['es', 'en'])
    for (const [ancho, alto, nombre] of [
      [1280, 1900, `comida-quien-paga-super-${idioma}`],
      [390, 2400, `comprobacion-comida-quien-paga-celular-${idioma}`],
    ]) {
      const ctx = await navegador.newContext({
        viewport: { width: ancho, height: alto },
        baseURL: URL,
        locale: idioma === 'en' ? 'en-US' : 'es-VE',
      });
      await ctx.addCookies([
        { name: 'tumbite_sesion', value: pase, domain: 'localhost', path: '/' },
      ]);
      await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
      const p = await ctx.newPage();
      await p.goto(`${idioma === 'es' ? '/es' : ''}/panel${ruta ? `/${ruta}` : ''}/flexfinance`);
      const bloque = p.getByTestId('comida-quien-paga');
      await bloque.waitFor({ timeout: 60_000 });
      await p.getByTestId('cqp-ejemplo').waitFor({ timeout: 30_000 });
      // La cabecera del panel queda fija arriba: se sube el bloque hasta dejar su título debajo.
      await bloque.evaluate((x) => {
        x.scrollIntoView({ block: 'start' });
        let caja = x.parentElement;
        while (caja && caja.scrollHeight <= caja.clientHeight + 4) caja = caja.parentElement;
        const quien = caja ?? globalThis.document.scrollingElement;
        quien.scrollTop += x.getBoundingClientRect().top - 100;
      });
      await p.waitForTimeout(800);
      const original = join(ORIGINALES_PRIVADAS, `${nombre}.png`);
      await p.screenshot({ path: original });
      if (ancho > 1000)
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
console.log('capturas de «Comida: quién paga qué» listas en la carpeta privada');
