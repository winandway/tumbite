// Capturas REALES de las cuentas de prueba (C-CUENTA-PRUEBA) para la AYUDA INTERNA del panel — todos
// los países. Arma un servidor LOCAL propio (carpeta .recorrido, solo servidor + el panel ya
// compilado), lo enciende, toma las capturas y lo apaga. NO toca el sitio de pruebas ni producción.
// Datos neutros: nombres de ejemplo y correos de ejemplo.com; ninguna persona real.
//   cuentas-prueba-lista-<es|en>   → Clientes con el filtro «Cuentas: De prueba» y la etiqueta «Prueba»
//   cuentas-prueba-marcar-<es|en>  → la ficha de un cliente con los tres puntos abiertos y «Marcar como prueba»
//   → ~/Divoox-privado/ayuda-interna/{originales,capturas} (privadas, fuera del repositorio)
// Antes: npm run build -w @tumbite/panel
// Uso: node scripts/recorrido/capturas-cuentas-prueba.mjs
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: carpetas fijas del repositorio y de la carpeta privada; `document` corre dentro del navegador */
import { execFileSync, execSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const PUERTO = '8792';
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
      'cf-connecting-ip': `10.84.0.${++ip % 250}`,
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

const L = {
  es: {
    locale: 'es-US',
    real: ['Laura Gómez', 'laura.gomez.es@ejemplo.com'],
    prueba: ['Soporte Prueba Pasajero', 'soporte.prueba.es@ejemplo.com'],
    filtro: 'De prueba',
    mas: 'Más acciones de la cuenta',
  },
  en: {
    locale: 'en-US',
    real: ['Laura Smith', 'laura.smith.en@ejemplo.com'],
    prueba: ['Support Test Rider', 'support.test.en@ejemplo.com'],
    filtro: 'Test',
    mas: 'More account actions',
  },
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
  const dueno = (
    await pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave })
  ).token;
  const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, dueno)).ruta;
  navegador = await chromium.launch();

  for (const idioma of ['es', 'en']) {
    const T = L[idioma];
    await sql('DELETE FROM intentos_limite').catch(() => null);
    const alta = async ([nombre, correo]) => {
      const r = await pedir('POST', '/datos/cuentas/registro', {
        nombre,
        correo,
        clave: DATOS.clave,
        rol: 'cliente',
        idioma,
      }).catch(() => pedir('POST', '/datos/cuentas/entrar', { correo, clave: DATOS.clave }));
      return (
        r.usuario?.id ?? (await pedir('GET', '/datos/cuentas/yo', undefined, r.token)).usuario.id
      );
    };
    const idReal = await alta(T.real);
    const idPrueba = await alta(T.prueba);
    await pedir('POST', `/datos/admin/usuarios/${idPrueba}/prueba`, { prueba: true }, dueno);
    await pedir('POST', `/datos/admin/usuarios/${idReal}/prueba`, { prueba: false }, dueno);

    const ctx = await navegador.newContext({
      baseURL: URL,
      viewport: { width: 1000, height: 760 },
      deviceScaleFactor: 1,
      locale: T.locale,
    });
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    await ctx.addCookies([
      { name: 'tumbite_sesion', value: dueno, domain: 'localhost', path: '/', httpOnly: true },
    ]);
    const s = await ctx.newPage();
    const privada = async (nombre) => {
      const png = join(ORIGINALES_PRIVADAS, `cuentas-prueba-${nombre}-${idioma}.png`);
      await s.screenshot({ path: png });
      execFileSync('cwebp', [
        '-quiet',
        '-q',
        '82',
        png,
        '-o',
        join(CAPTURAS_PRIVADAS, `cuentas-prueba-${nombre}-${idioma}.webp`),
      ]);
      console.log(`cuentas-prueba-${nombre}-${idioma}`);
    };

    // 1. Clientes con el filtro «Cuentas: De prueba»: la cuenta de prueba con su etiqueta.
    await s.goto(`/panel/${ruta}/customers`);
    await s.getByTestId('filtro-cuentas').waitFor({ timeout: 60_000 });
    await s.getByTestId('filtro-cuentas').selectOption('prueba');
    await s.getByTestId('etiqueta-prueba').first().waitFor({ timeout: 30_000 });
    await espera(800);
    await privada('lista');
    // Se deja el filtro como estaba (Reales), para la siguiente vuelta.
    await s.getByTestId('filtro-cuentas').selectOption('reales');
    await espera(1_800);

    // 2. La ficha de un cliente real: tres puntos → «Marcar como prueba».
    await s.goto(`/panel/${ruta}/customers/${idReal}`);
    await s.getByRole('button', { name: T.mas }).waitFor({ timeout: 60_000 });
    await s.getByRole('button', { name: T.mas }).click();
    await s.getByRole('menuitem').first().waitFor({ timeout: 30_000 });
    await espera(600);
    await privada('marcar');
    await ctx.close();
  }
} finally {
  await navegador?.close();
  apagar();
}
console.log('capturas de las cuentas de prueba listas en la carpeta privada de la ayuda interna');
