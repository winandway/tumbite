// Capturas REALES del panel de operaciones para la ayuda interna «?» sobre Perú (C-PERFIL-PERU,
// 19 nov 2026). Perú. Contra el servidor LOCAL del recorrido, DESPUÉS de capturas-peru.mjs (que deja
// Ica abierta y Perú con sus recargas encendidas): la configuración de dinero de Perú (interruptores y
// «Recarga mínima con tarjeta») y la compuerta de producción del país en «Moto · Abrir y aprobar».
// C-AYUDA-INTERNA: son del superadmin, así que NO van al repositorio: quedan en la carpeta privada
// (~/Divoox-privado/ayuda-interna) y las sube scripts/docs/subir-ayuda-interna.mjs.
// Uso: node scripts/recorrido/capturas-peru-interno.mjs
/* eslint-disable security/detect-non-literal-fs-filename -- guion local: carpetas fijas del repositorio y la carpeta privada */
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const CARPETA = process.env.CARPETA_RECORRIDO ?? '.recorrido';
const DATOS = JSON.parse(readFileSync(join(RAIZ, CARPETA, 'datos.json'), 'utf8'));
const URL = DATOS.url;
mkdirSync(ORIGINALES_PRIVADAS, { recursive: true });
mkdirSync(CAPTURAS_PRIVADAS, { recursive: true });

async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const token = randomBytes(24).toString('hex');
await pedir(
  'POST',
  '/datos/interno/diagnostico/sql',
  {
    sql: `INSERT INTO sesiones (id, usuario_id, expira_en) VALUES ('${createHash('sha256').update(token).digest('hex')}', 'zz-mtpe-a', datetime('now', '+60 minutes'))`,
  },
  undefined,
  { 'x-reloj-secreto': DATOS.relojSecreto },
);
const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, token)).ruta;
// En este servidor local el guion de punta a punta abrió la compuerta de Perú para poder probar. En
// producción está CERRADA: se cierra aquí para que la captura muestre lo que el equipo va a encontrar.
for (const servicio of ['moto', 'carro'])
  await pedir('PUT', `/datos/admin/pasajeros-pais/PE/${servicio}`, { abierto: false }, token);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const navegador = await chromium.launch();
const hechas = [];
try {
  for (const idioma of ['es', 'en']) {
    const ctx = await navegador.newContext({
      viewport: { width: 1280, height: 900 },
      baseURL: URL,
      locale: idioma === 'en' ? 'en-US' : 'es-US',
    });
    await ctx.addCookies([{ name: 'tumbite_sesion', value: token, url: URL, httpOnly: true }]);
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctx.newPage();
    const foto = async (nombre) => {
      const png = join(ORIGINALES_PRIVADAS, `peru-${nombre}-${idioma}.png`);
      await p.screenshot({ path: png });
      execFileSync('cwebp', [
        '-quiet',
        '-q',
        '82',
        png,
        '-o',
        join(CAPTURAS_PRIVADAS, `peru-${nombre}-${idioma}.webp`),
      ]);
      hechas.push(`${nombre}-${idioma}`);
    };
    // 1. Dinero: la configuración de Perú, con la recarga mínima con tarjeta.
    await p.goto(`${idioma === 'en' ? '' : '/es'}/panel/money`);
    await p.getByRole('tab', { name: 'PE', exact: true }).click({ timeout: 60_000 });
    await p.getByTestId('recarga-tarjeta-min').waitFor({ timeout: 30_000 });
    await p
      .getByTestId('recarga-tarjeta-min')
      .evaluate((x) => x.scrollIntoView({ block: 'center' }));
    await espera(900);
    await foto('super-dinero');
    // 2. Moto · Abrir y aprobar: la compuerta de producción de Perú (cerrada).
    await p.goto(`${idioma === 'en' ? '' : '/es'}/panel/${ruta}/moto`);
    await p.getByTestId('super-moto').waitFor({ timeout: 60_000 });
    await p.getByTestId('pais-PE').waitFor({ timeout: 30_000 });
    await p.getByTestId('pais-PE').evaluate((x) => x.scrollIntoView({ block: 'center' }));
    await espera(900);
    await foto('super-compuerta');
    await ctx.close();
  }
} finally {
  await navegador.close();
}
console.log(`capturas internas de Perú listas en la carpeta privada: ${hechas.join(', ')}`);
