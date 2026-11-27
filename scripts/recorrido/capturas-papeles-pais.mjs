// C-PAPELES-POR-PAIS (27 nov 2026) — Venezuela y Estados Unidos. Comprueba EN PANTALLA, contra un
// servidor LOCAL propio, que en la configuración de cada país sale la tarjeta «Papeles que se le piden
// al conductor en este país» con sus papeles y si frenan o solo se piden, y toma las capturas de la
// ayuda interna. NO toca el sitio de pruebas ni producción. Datos neutros.
//   papeles-lista-pais-<es|en> → la tarjeta de papeles del país (es: Venezuela; en: Estados Unidos)
//   → ~/Divoox-privado/ayuda-interna/{originales,capturas} (privadas, fuera del repositorio)
// Antes: npm run build -w @tumbite/panel
// Uso: PUERTO_PAPELES=8799 node scripts/recorrido/capturas-papeles-pais.mjs
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: carpetas fijas del repositorio y de la carpeta privada */
import { execFileSync, execSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
// Otro puerto que el del recorrido (8790), municipios (8797) y lugares (8798).
const PUERTO = process.env.PUERTO_PAPELES ?? '8799';
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
async function pedir(metodo, ruta, cuerpo, token) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.88.0.${++ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const comprobar = (ok, que) => {
  if (!ok) throw new Error(`NO: ${que}`);
  console.log(`ok: ${que}`);
};

// Cada idioma con su país (C-CAPTURAS-POR-IDIOMA).
const L = {
  es: { locale: 'es-US', pais: 'VE', ve: ['Licencia', 'RCV'], frena: 'Frena las carreras' },
  en: {
    locale: 'en-US',
    pais: 'US',
    ve: ['Vehicle insurance', 'Vehicle registration'],
    frena: 'Blocks trips',
  },
};

let navegador;
try {
  for (let i = 0; ; i++) {
    const ok = await fetch(`${URL}/datos/salud`)
      .then(() => true)
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
  }).catch(() =>
    pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave }),
  );
  await pedir('POST', '/datos/cuentas/hacer-admin', { semilla: DATOS.semilla }, reg.token).catch(
    () => null,
  );
  const token = (
    await pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave })
  ).token;
  navegador = await chromium.launch();

  for (const idioma of ['es', 'en']) {
    const T = L[idioma];
    const ctx = await navegador.newContext({
      baseURL: URL,
      viewport: { width: 1180, height: 1000 },
      deviceScaleFactor: 1,
      locale: T.locale,
    });
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    await ctx.addCookies([
      { name: 'tumbite_sesion', value: token, domain: 'localhost', path: '/', httpOnly: true },
    ]);
    const s = await ctx.newPage();
    await s.goto('/panel/money');
    await s.getByRole('tab', { name: T.pais, exact: true }).click({ timeout: 60_000 });
    const tarjeta = s.getByTestId('papeles-pais');
    await tarjeta.waitFor({ timeout: 60_000 });
    await tarjeta.scrollIntoViewIfNeeded();
    await espera(800);
    const texto = await tarjeta.innerText();
    for (const v of T.ve) comprobar(texto.includes(v), `${idioma}: la lista muestra «${v}»`);
    comprobar(texto.includes(T.frena), `${idioma}: dice «${T.frena}»`);
    if (idioma === 'en')
      comprobar(!/Pago móvil|Bs\b|Vigía|RCV/.test(texto), 'en: nada de Venezuela en la lista');
    const png = join(ORIGINALES_PRIVADAS, `papeles-lista-pais-${idioma}.png`);
    // La tarjeta entera pasa de 4000 px: la foto es su parte de arriba, con los primeros papeles.
    // Medida en coordenadas de la página (la captura es de la página entera, no de la ventana).
    const caja = await tarjeta.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const v = el.ownerDocument.defaultView;
      return { x: r.x + v.scrollX, y: r.y + v.scrollY, width: r.width, height: r.height };
    });
    await s.screenshot({
      path: png,
      fullPage: true,
      clip: { x: caja.x, y: caja.y, width: caja.width, height: Math.min(caja.height, 1100) },
    });
    execFileSync('cwebp', [
      '-quiet',
      '-q',
      '82',
      png,
      '-o',
      join(CAPTURAS_PRIVADAS, `papeles-lista-pais-${idioma}.webp`),
    ]);
    console.log(`captura: papeles-lista-pais-${idioma}`);
    await ctx.close();
  }
} finally {
  await navegador?.close();
  apagar();
}
console.log('papeles por país comprobados en pantalla; capturas en la carpeta privada');
