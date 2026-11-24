// C-VERIFICACION-UNICA y C-BARRA-ACTIVACION (23 nov 2026) — todos los países. Toma, contra un servidor
// LOCAL propio, las capturas de la ayuda interna «Verificación única y barra de activación»: un
// conductor real a medio camino (identidad enviada y su moto en revisión) y el superadmin abierto en
// su Verificación y en la bandeja. NO toca el sitio de pruebas ni producción. Datos neutros.
//   activacion-barra-<es|en>   → la barra de activación de su ficha en Verificaciones
//   activacion-bandeja-<es|en> → la pestaña Pendientes, ordenada «Más cerca de activarse»
//   → ~/Divoox-privado/ayuda-interna/{originales,capturas} (privadas, fuera del repositorio)
// En español, una ciudad de habla hispana (El Vigía); en inglés, Estados Unidos (Miami).
// Antes: npm run build -w @tumbite/panel
// Uso: PUERTO_CAMPANA=8797 node scripts/recorrido/capturas-activacion.mjs
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: carpetas fijas del repositorio y de la carpeta privada */
import { execFileSync, execSync, spawn } from 'node:child_process';
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
      'cf-connecting-ip': `10.87.0.${++ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
// Una foto neutra de verdad (silueta gris), para que las miniaturas no salgan rotas en la captura.
const JPEG = execFileSync('python3', [
  '-c',
  `import io,sys
from PIL import Image, ImageDraw
i = Image.new('RGB', (240, 240), (226, 229, 234))
d = ImageDraw.Draw(i)
d.ellipse((80, 40, 160, 120), fill=(160, 166, 175))
d.ellipse((40, 130, 200, 290), fill=(160, 166, 175))
b = io.BytesIO(); i.save(b, 'JPEG', quality=85); sys.stdout.buffer.write(b.getvalue())`,
]);
async function subir(ruta, token) {
  const r = await fetch(`${URL}${ruta}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'image/jpeg',
      'cf-connecting-ip': `10.87.1.${++ip % 250}`,
    },
    body: JPEG,
  });
  if (!r.ok) throw new Error(`${ruta}: ${r.status} ${(await r.text()).slice(0, 120)}`);
}
function guardar(png, nombre) {
  execFileSync('cwebp', [
    '-quiet',
    '-q',
    '82',
    png,
    '-o',
    join(CAPTURAS_PRIVADAS, `${nombre}.webp`),
  ]);
  console.log(`captura: ${nombre}`);
}

const L = {
  es: {
    locale: 'es-US',
    zona: {
      id: 'VE-MER-ELVIGIA',
      nombre: 'El Vigía',
      lat: 8.6136,
      lng: -71.6566,
      radioKm: 15,
      zonaHoraria: 'America/Caracas',
    },
    persona: ['Andrés Rojas', 'andres.rojas.activacion@ejemplo.com'],
    placa: { placa: 'AB1C23D' },
  },
  en: {
    locale: 'en-US',
    zona: null, // Miami ya está en la base
    persona: ['Michael Brown', 'michael.brown.activation@ejemplo.com'],
    placa: { placa: 'ABC1234', placaEstado: 'FL' },
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
  const token = (
    await pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave })
  ).token;
  const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, token)).ruta;
  navegador = await chromium.launch();

  for (const idioma of ['es', 'en']) {
    const T = L[idioma];
    if (T.zona) {
      const z = T.zona;
      await pedir(
        'POST',
        '/datos/interno/diagnostico/sql',
        {
          sql: `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
                VALUES ('${z.id}', '${z.nombre}', 'VE', 'USD', '${z.zonaHoraria}', ${z.lat}, ${z.lng}, ${z.radioKm}, 1)`,
        },
        undefined,
        { 'x-reloj-secreto': DATOS.relojSecreto },
      );
    }
    const zonaId = T.zona?.id ?? 'US-FL-MIAMI';
    // Un conductor a medio camino: identidad enviada y su moto con sus papeles, en revisión.
    const [nombre, correo] = T.persona;
    const c = await pedir('POST', '/datos/cuentas/registro', {
      nombre,
      correo,
      clave: DATOS.clave,
      rol: 'repartidor',
      idioma,
    });
    await pedir('PUT', '/datos/conductor/ciudad', { zonaId }, c.token);
    await pedir('GET', '/datos/conductor/verificacion', undefined, c.token);
    for (const pieza of ['doc_frente', 'doc_reverso', 'selfie'])
      await subir(`/datos/kyc/foto/${pieza}`, c.token);
    await pedir('POST', '/datos/kyc/enviar', { docTipo: 'licencia' }, c.token);
    const v = await pedir(
      'POST',
      '/datos/conductor/vehiculos',
      {
        tipo: 'moto',
        marca: 'Motos Divoox',
        modelo: 'M150',
        anio: 2023,
        color: 'Negro',
        ...T.placa,
      },
      c.token,
    );
    for (const t of ['registro', 'seguro', 'seguro_pasajeros', 'foto_frente'])
      await subir(`/datos/conductor/vehiculos/${v.id}/documentos?tipo=${t}`, c.token);
    await pedir('POST', `/datos/conductor/vehiculos/${v.id}/enviar`, {}, c.token).catch(() => null);

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

    await s.goto(`/panel/${ruta}/verifications/${c.usuario.id}`);
    const barra = s.getByTestId('barra-activacion');
    await barra.waitFor({ timeout: 60_000 });
    await espera(800);
    let png = join(ORIGINALES_PRIVADAS, `activacion-barra-${idioma}.png`);
    await barra.screenshot({ path: png });
    guardar(png, `activacion-barra-${idioma}`);

    await s.goto(`/panel/${ruta}/verifications`);
    await s.getByTestId('kyc-lista').waitFor({ timeout: 60_000 });
    await s.getByTestId('orden-bandeja').selectOption('cerca');
    // Solo la ciudad de esta pasada (en inglés, Estados Unidos; en español, El Vigía).
    await s
      .locator('select', { has: s.locator(`option[value="${zonaId}"]`) })
      .first()
      .selectOption(zonaId);
    await s.getByText(nombre).first().waitFor({ timeout: 30_000 });
    await espera(800);
    png = join(ORIGINALES_PRIVADAS, `activacion-bandeja-${idioma}.png`);
    await s.screenshot({ path: png });
    guardar(png, `activacion-bandeja-${idioma}`);
    await ctx.close();
  }
} finally {
  await navegador?.close();
  apagar();
}
console.log('capturas de la activación en la carpeta privada');
