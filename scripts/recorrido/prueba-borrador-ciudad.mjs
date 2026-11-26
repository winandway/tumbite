/* global document */
// C-BORRADOR-SIN-AVISO-VACIO y C-USAR-FECHA-LEIDA (25 nov 2026) — todos los países. Contra un servidor LOCAL
// propio (nunca el sitio de pruebas ni producción): abre la ficha de un conductor en Verificaciones y en
// la ficha del repartidor con borradores viejos sembrados en el navegador (una ciudad que ya no se puede
// elegir, un campo de una versión anterior) y exige que NO salga «Recuperamos lo que estabas
// escribiendo» sin haber escrito nada; después toca «Usar esta fecha» y exige la fecha guardada.
// Antes: npm run build -w @tumbite/panel
// Uso: CANAL=chrome node scripts/recorrido/prueba-borrador-ciudad.mjs
/* eslint-disable security/detect-non-literal-fs-filename -- guion local: carpetas fijas del repositorio y de la carpeta privada */
import { execSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const PUERTO = process.env.PUERTO_CAMPANA ?? '8797';
const DIR = join(RAIZ, '.recorrido');
execSync('node scripts/recorrido/preparar.mjs', {
  cwd: RAIZ,
  stdio: 'inherit',
  env: { ...process.env, SOLO_SERVIDOR: '1', PUERTO_RECORRIDO: PUERTO },
});
cpSync(join(RAIZ, 'apps/panel/dist'), join(DIR, 'sitio'), { recursive: true });
const DATOS = JSON.parse(readFileSync(join(DIR, 'datos.json'), 'utf8'));
const URL = DATOS.url;
mkdirSync(ORIGINALES_PRIVADAS, { recursive: true });
mkdirSync(CAPTURAS_PRIVADAS, { recursive: true });

const servidor = spawn(
  'npx',
  [
    'wrangler',
    'dev',
    '-c',
    '.recorrido/wrangler.jsonc',
    '--port',
    PUERTO,
    '--persist-to',
    '.recorrido/estado',
  ],
  { cwd: RAIZ, stdio: 'ignore', detached: true },
);
const apagar = () => {
  try {
    process.kill(-servidor.pid);
  } catch {
    /* ya estaba apagado */
  }
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.89.0.${++ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const sql = (s) =>
  pedir('POST', '/datos/interno/diagnostico/sql', { sql: s }, undefined, {
    'x-reloj-secreto': DATOS.relojSecreto,
  });
let navegador;
const fallos = [];
try {
  for (let i = 0; ; i++) {
    const ok = await fetch(`${URL}/datos/salud`)
      .then((r) => r.ok)
      .catch(() => false);
    if (ok) break;
    if (i > 90) throw new Error('el servidor local no encendió');
    await espera(2000);
  }
  const reg = await pedir('POST', '/datos/cuentas/registro', {
    nombre: 'Soporte Divoox',
    correo: DATOS.correoEquipo,
    clave: DATOS.clave,
    rol: 'cliente',
    idioma: 'es',
  }).catch(() => null);
  if (reg) await pedir('POST', '/datos/cuentas/hacer-admin', { semilla: DATOS.semilla }, reg.token);
  const token = (
    await pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave })
  ).token;
  const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, token)).ruta;
  navegador = await chromium.launch(process.env.CANAL ? { channel: process.env.CANAL } : {});
  const c = await pedir('POST', '/datos/cuentas/registro', {
    nombre: 'Carlos Méndez',
    correo: `carlos.sonda.${Date.now()}@ejemplo.com`,
    clave: DATOS.clave,
    rol: 'repartidor',
    idioma: 'es',
  });
  const id = c.usuario.id;
  await pedir('PUT', '/datos/conductor/ciudad', { zonaId: 'US-FL-MIAMI' }, c.token).catch(
    () => null,
  );
  const ctx = await navegador.newContext({
    baseURL: URL,
    viewport: { width: 1280, height: 900 },
    locale: 'es-US',
  });
  // Lo que puede tener un navegador real: borradores viejos que nadie escribió en esta versión (una
  // ciudad que ya no se puede elegir, un campo de una versión anterior). Solo la primera vez.
  await ctx.addInitScript((idc) => {
    localStorage.setItem('tumbite.idioma', 'es');
    if (sessionStorage.getItem('sembrado')) return;
    sessionStorage.setItem('sembrado', '1');
    localStorage.setItem(
      `tumbite.borrador.ciudad-conductor-${idc}.superadmin`,
      JSON.stringify({ zonaId: 'CIUDAD-QUE-YA-NO-ESTA', motivo: '' }),
    );
    localStorage.setItem(
      `tumbite.borrador.ciudad-base-conductor-${idc}.superadmin`,
      JSON.stringify({ zonaId: '', motivo: '', paso: 'confirmar' }),
    );
  }, id);
  // «Usar esta fecha»: lo leído de su cédula, sin fecha en la cuenta.
  await sql(
    `INSERT INTO datos_documento (usuario_id, nacimiento, confianza_nacimiento) VALUES ('${id}', '1974-03-10', 60)`,
  );
  await ctx.addCookies([
    { name: 'tumbite_sesion', value: token, domain: 'localhost', path: '/', httpOnly: true },
  ]);
  const s = await ctx.newPage();
  for (const pagina of [`verifications/${id}`, `drivers/${id}`, `verifications/${id}`]) {
    await s.goto(`/panel/${ruta}/${pagina}`);
    await espera(4000);
    const tres = s.getByRole('button', { name: /Más acciones de la cuenta/ }).first();
    if (pagina.startsWith('drivers') && (await tres.count())) {
      await tres.click();
      await s.getByRole('menuitem', { name: 'Cambiar ciudad' }).click();
      await espera(1500);
    }
    const avisos = await s.getByText('Recuperamos lo que estabas escribiendo').count();
    const llaves = await s.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith('tumbite.borrador.'))
        .map((k) => `${k}=${localStorage.getItem(k)}`),
    );
    console.log(`${pagina}: avisos=${avisos} borradores=${JSON.stringify(llaves)}`);
    if (avisos) {
      const donde = await s.evaluate(() =>
        [...document.querySelectorAll('.aviso-borrador')].map(
          (e) =>
            e.closest('form,[data-testid]')?.getAttribute('data-testid') ??
            e.parentElement?.className,
        ),
      );
      console.log('  en:', JSON.stringify(donde));
      fallos.push(`${pagina}: aviso de borrador sin haber escrito nada (${JSON.stringify(donde)})`);
    }
  }
  await s.goto(`/panel/${ruta}/verifications/${id}`);
  await s.getByRole('button', { name: 'Usar esta fecha' }).click({ timeout: 30_000 });
  await s
    .getByTestId('ficha-nacimiento')
    .filter({ hasText: '1974-03-10' })
    .first()
    .waitFor({ timeout: 20_000 });
  const fila = JSON.stringify(
    await sql(`SELECT fecha_nacimiento FROM usuarios WHERE id = '${id}'`),
  );
  if (!fila.includes('1974-03-10')) fallos.push(`«Usar esta fecha» no guardó la fecha (${fila})`);
  else console.log('«Usar esta fecha»: guardada');
  await s.setViewportSize({ width: 1280, height: 900 });
  await s.getByTestId('detalle-conductor').screenshot({
    path: join(ORIGINALES_PRIVADAS, 'activacion-ficha-usar-fecha-es.png'),
  });
} finally {
  await navegador?.close();
  apagar();
}
if (fallos.length) {
  console.error(fallos.join('\n'));
  process.exit(1);
}
console.log('sin avisos de borrador falsos');
