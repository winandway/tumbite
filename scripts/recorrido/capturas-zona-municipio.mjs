// C-ZONA-MUNICIPIO (24 nov 2026) — todos los países. Comprueba EN PANTALLA, contra un servidor LOCAL
// propio, que en Zonas del superadmin el municipio se guarda, se ve y filtra la lista, y toma las
// capturas de la ayuda interna. NO toca el sitio de pruebas ni producción. Datos neutros.
//   zona-municipio-lista-<es|en> → la lista de Zonas filtrada por un municipio
//   zona-municipio-nueva-<es|en> → el formulario de zona nueva con la casilla de municipio
//   → ~/Divoox-privado/ayuda-interna/{originales,capturas} (privadas, fuera del repositorio)
// Antes: npm run build -w @tumbite/panel
// Uso: PUERTO_MUNICIPIO=8797 node scripts/recorrido/capturas-zona-municipio.mjs
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: carpetas fijas del repositorio y de la carpeta privada */
import { execFileSync, execSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
// Otro puerto que el del recorrido (8790), por si otra sesión lo está usando.
const PUERTO = process.env.PUERTO_MUNICIPIO ?? '8797';
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

const L = {
  es: {
    locale: 'es-US',
    zonas: [
      ['VE-MER-ELVIGIA', 'El Vigía', 'VE', 8.6159, -71.6442, 'MER', 'El Vigía'],
      ['VE-MER-TUCANI', 'Tucaní', 'VE', 8.9796, -71.2808, 'MER', 'Tucaní'],
    ],
    filtro: 'alberto-adriani',
    nueva: ['VE-MER-ZEA', 'Ciudad de ejemplo', 'MER', 'Zea'],
  },
  en: {
    locale: 'en-US',
    zonas: [
      ['US-MI-NOVI', 'Novi', 'US', 42.4806, -83.4755, 'MI', 'Oakland County'],
      ['US-MI-DETROIT', 'Detroit', 'US', 42.3314, -83.0458, 'MI', 'Wayne County'],
    ],
    filtro: 'oakland-county',
    nueva: ['US-MI-TROY', 'Example City', 'MI', 'Oakland County'],
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
  }).catch(() =>
    pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave }),
  );
  await pedir('POST', '/datos/cuentas/hacer-admin', { semilla: DATOS.semilla }, reg.token).catch(
    () => null,
  );
  const token = (
    await pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave })
  ).token;
  const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, token)).ruta;
  navegador = await chromium.launch();

  for (const idioma of ['es', 'en']) {
    const T = L[idioma];
    // Cada idioma con las ciudades de su país (C-CAPTURAS-POR-IDIOMA): solo las suyas en la lista.
    await sql("DELETE FROM zonas WHERE id LIKE 'VE-%' OR id LIKE 'US-MI-%'").catch(() => null);
    await sql('DELETE FROM preferencias_internas').catch(() => null);
    for (const [id, nombre, pais, lat, lng, region, municipio] of T.zonas)
      await pedir(
        'PUT',
        '/datos/admin/zonas',
        { id, nombre, pais, lat, lng, radioKm: 10, activa: false, region, idioma, municipio },
        token,
      );
    const lista = (await pedir('GET', '/datos/admin/zonas', undefined, token)).zonas;
    for (const [id, , , , , , municipio] of T.zonas) {
      const z = lista.find((x) => x.id === id);
      comprobar(
        Boolean(z?.municipioNombre),
        `${idioma}: ${id} quedó con municipio (${municipio} → ${z?.municipioNombre})`,
      );
    }

    const ctx = await navegador.newContext({
      baseURL: URL,
      viewport: { width: 1180, height: 900 },
      deviceScaleFactor: 1,
      locale: T.locale,
    });
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    await ctx.addCookies([
      { name: 'tumbite_sesion', value: token, domain: 'localhost', path: '/', httpOnly: true },
    ]);
    const s = await ctx.newPage();
    const privada = async (nombre, objeto) => {
      const png = join(ORIGINALES_PRIVADAS, `zona-municipio-${nombre}-${idioma}.png`);
      await (objeto ?? s).screenshot({ path: png });
      execFileSync('cwebp', [
        '-quiet',
        '-q',
        '82',
        png,
        '-o',
        join(CAPTURAS_PRIVADAS, `zona-municipio-${nombre}-${idioma}.webp`),
      ]);
      console.log(`captura: zona-municipio-${nombre}-${idioma}`);
    };

    // 1. La lista filtrada por un municipio: solo sus zonas, con su municipio a la vista.
    await s.goto(`/panel/${ruta}/zones`);
    await s.getByTestId('filtro-municipio').waitFor({ timeout: 60_000 });
    await s.getByTestId(`zona-municipio-${T.zonas[0][0]}`).waitFor({ timeout: 30_000 });
    await s.getByTestId('filtro-municipio').selectOption(T.filtro);
    await espera(800);
    comprobar(
      (await s.getByTestId(`zona-municipio-${T.zonas[1][0]}`).count()) === 0,
      `${idioma}: el filtro deja solo las zonas de ese municipio`,
    );
    // La captura empieza en el filtro: arriba quedan las ciudades de la web, que no son de esta guía.
    const etiqueta = s.getByTestId('filtro-municipio').locator('xpath=ancestor::label');
    await etiqueta.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await espera(400);
    const caja = await etiqueta.boundingBox();
    const recorte = caja
      ? { x: caja.x - 16, y: caja.y - 16, width: caja.width + 32, height: 520 }
      : undefined;
    await privada(
      'lista',
      recorte ? { screenshot: (o) => s.screenshot({ ...o, clip: recorte }) } : undefined,
    );

    // 2. La zona nueva con su municipio escrito (la lista sugiere los del país).
    const [codigo, nombre, region, municipio] = T.nueva;
    const form = s.locator('form.tarjeta-form');
    const casillas = form.locator('input');
    await casillas.nth(0).fill(codigo);
    await casillas.nth(1).fill(nombre);
    await casillas.nth(2).fill(region);
    await s.getByTestId('municipio-nueva').fill(municipio);
    await espera(600);
    if (idioma === 'es') {
      const opciones = await s
        .locator('#municipios-nueva option')
        .evaluateAll((os) => os.map((o) => o.value));
      comprobar(
        opciones.includes('Alberto Adriani (El Vigía), Mérida') &&
          opciones.includes('Caracciolo Parra Olmedo (Tucaní), Mérida'),
        'es: la lista sugiere El Vigía y Tucaní',
      );
    }
    await form.scrollIntoViewIfNeeded();
    await privada('nueva', form);
    // Se deja el filtro en «Todos» para la vuelta siguiente.
    await s.getByTestId('filtro-municipio').selectOption('');
    await espera(1_800);
    await ctx.close();
  }
  await sql("DELETE FROM zonas WHERE id LIKE 'VE-%' OR id LIKE 'US-MI-%'").catch(() => null);
} finally {
  await navegador?.close();
  apagar();
}
console.log('municipio de las zonas comprobado en pantalla; capturas en la carpeta privada');
