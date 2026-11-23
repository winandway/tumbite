// C-VERIFICACIONES-EN-VIVO (23 nov 2026, Richard) — todos los países. Comprueba EN PANTALLA, contra un
// servidor LOCAL propio: con el superadmin abierto en Verificaciones, una persona envía su verificación
// desde OTRA sesión y la fila aparece sola (sin recargar), resaltada, y el sonido se dispara UNA vez (se
// cuenta la llamada de reproducción); al recargar no vuelve a sonar. Toma la captura de la ayuda interna.
// NO toca el sitio de pruebas ni producción. Datos neutros (ejemplo.com).
//   campana-verificaciones-<es|en> → Verificaciones con la fila nueva resaltada y los interruptores
//   → ~/Divoox-privado/ayuda-interna/{originales,capturas} (privadas, fuera del repositorio)
// Antes: npm run build -w @tumbite/panel
// Uso: PUERTO_CAMPANA=8796 node scripts/recorrido/capturas-verificaciones-en-vivo.mjs
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: carpetas fijas del repositorio y de la carpeta privada */
/* global window -- lo que corre dentro del navegador (addInitScript y evaluate) */
import { execFileSync, execSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
// Otro puerto que el del recorrido (8790), por si otra sesión lo está usando.
const PUERTO = process.env.PUERTO_CAMPANA ?? '8796';
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
      'cf-connecting-ip': `10.86.0.${++ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const sql = (q) =>
  pedir('POST', '/datos/interno/diagnostico/sql', { sql: q }, undefined, {
    'x-reloj-secreto': DATOS.relojSecreto,
  });
const comprobar = (ok, que) => {
  if (!ok) throw new Error(`NO: ${que}`);
  console.log(`ok: ${que}`);
};

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const L = {
  es: { locale: 'es-US', persona: ['Laura Gómez', 'laura.gomez.kyc@ejemplo.com'] },
  en: { locale: 'en-US', persona: ['Laura Smith', 'laura.smith.kyc@ejemplo.com'] },
};

let navegador;
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
    nombre: 'Divoox Soporte',
    correo: DATOS.correoEquipo,
    clave: DATOS.clave,
    rol: 'cliente',
    idioma: 'es',
  });
  await pedir('POST', '/datos/cuentas/hacer-admin', { semilla: DATOS.semilla }, reg.token);
  const token = (
    await pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave })
  ).token;
  const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, token)).ruta;
  navegador = await chromium.launch();

  for (const idioma of ['es', 'en']) {
    const T = L[idioma];
    await sql('DELETE FROM intentos_limite').catch(() => null);
    const contexto = async () => {
      const ctx = await navegador.newContext({
        baseURL: URL,
        viewport: { width: 1180, height: 760 },
        deviceScaleFactor: 1,
        locale: T.locale,
      });
      await ctx.addInitScript((i) => {
        localStorage.setItem('tumbite.idioma', i);
        // Se cuenta cada reproducción de sonido (no hace falta oírlo).
        window.__sonidos = [];
        const Original = window.Audio;
        window.Audio = function (src) {
          const a = new Original(src);
          a.play = () => {
            window.__sonidos.push(src);
            return Promise.resolve();
          };
          return a;
        };
      }, idioma);
      await ctx.addCookies([
        { name: 'tumbite_sesion', value: token, domain: 'localhost', path: '/', httpOnly: true },
      ]);
      return ctx;
    };
    const ctx = await contexto();
    const s = await ctx.newPage();
    const sonidos = () => s.evaluate(() => window.__sonidos.length);
    await s.goto(`/panel/${ruta}/verifications`);
    await s.getByTestId('controles-avisos').waitFor({ timeout: 60_000 });
    await espera(7_000); // la primera marca es la base

    // Desde OTRA sesión: una persona sube sus fotos y envía su verificación por la ruta de verdad.
    const [nombre, correo] = T.persona;
    const cuenta = await pedir('POST', '/datos/cuentas/registro', {
      nombre,
      correo,
      clave: DATOS.clave,
      rol: 'repartidor',
      idioma,
    });
    for (const pieza of ['doc_frente', 'doc_reverso', 'selfie']) {
      const r = await fetch(`${URL}/datos/kyc/foto/${pieza}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${cuenta.token}`,
          'content-type': 'image/jpeg',
          'cf-connecting-ip': `10.86.1.${++ip % 250}`,
        },
        body: JPEG,
      });
      if (!r.ok) throw new Error(`foto ${pieza}: ${r.status}`);
    }
    await pedir('POST', '/datos/kyc/enviar', { docTipo: 'licencia' }, cuenta.token);
    const enviada = Date.now();

    // Aparece sola, resaltada, y suena UNA vez.
    const fila = s.locator('.kyc-fila-nueva', { hasText: nombre });
    await fila.waitFor({ timeout: 30_000 });
    console.log(
      `${idioma}: la fila apareció sola en ${Math.round((Date.now() - enviada) / 1000)} s`,
    );
    comprobar((await sonidos()) === 1, `${idioma}: el sonido se disparó una vez`);
    await espera(600);
    const png = join(ORIGINALES_PRIVADAS, `campana-verificaciones-${idioma}.png`);
    await s.screenshot({ path: png });
    execFileSync('cwebp', [
      '-quiet',
      '-q',
      '82',
      png,
      '-o',
      join(CAPTURAS_PRIVADAS, `campana-verificaciones-${idioma}.webp`),
    ]);
    console.log(`captura: campana-verificaciones-${idioma}`);
    await espera(12_000);
    comprobar((await sonidos()) === 1, `${idioma}: no volvió a sonar por lo mismo`);

    // Recargar: la fila sigue, el sonido no vuelve.
    await s.reload();
    await s.getByText(nombre).first().waitFor({ timeout: 60_000 });
    await espera(12_000);
    comprobar((await sonidos()) === 0, `${idioma}: al recargar no vuelve a sonar`);

    // El correo al equipo: UNO por persona, anotado con su resultado.
    const aviso = await sql(
      `SELECT destinos, ok, substr(motivo, 1, 80) AS motivo FROM avisos_verificacion WHERE usuario_id = '${cuenta.usuario.id}'`,
    );
    console.log(
      `${idioma}: correo al equipo anotado → ${JSON.stringify(aviso.resultados ?? aviso)}`,
    );
    await ctx.close();
  }
} finally {
  await navegador?.close();
  apagar();
}
console.log('verificaciones en vivo comprobadas en pantalla; captura en la carpeta privada');
