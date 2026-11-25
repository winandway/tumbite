/* global document */
// C-VERIFICACIONES-VEHICULOS y C-MENU-POR-USO (25 nov 2026) — todos los países. Toma, contra un servidor
// LOCAL propio, las capturas de la ayuda interna: la pestaña «Vehículos» de Verificaciones (una moto
// que espera revisión, con su conductor, su placa y sus fotos) y el menú del panel ordenado por uso.
// Además PRUEBA la pantalla: aprueba la moto desde la pestaña y exige que el número de la pestaña baje y
// que la consola no tenga errores. NO toca el sitio de pruebas ni producción. Datos neutros.
//   activacion-vehiculos-<es|en> → Verificaciones, pestaña Vehículos, «Esperan revisión»
//   menu-por-uso-<es|en>         → el menú lateral del superadmin
//   → ~/Divoox-privado/ayuda-interna/{originales,capturas} (privadas, fuera del repositorio: C-AYUDA-INTERNA)
// En español, una ciudad de habla hispana (El Vigía); en inglés, Estados Unidos (Miami).
// Antes: npm run build -w @tumbite/panel
// Uso: PUERTO_CAMPANA=8798 node scripts/recorrido/capturas-verificaciones-todo.mjs
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: carpetas fijas del repositorio y de la carpeta privada */
import { execFileSync, execSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const PUERTO = process.env.PUERTO_CAMPANA ?? '8798';
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
      'cf-connecting-ip': `10.88.0.${++ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
// Fotos neutras de verdad (un rectángulo gris con una figura), para que las miniaturas no salgan rotas.
const JPEG = execFileSync('python3', [
  '-c',
  `import io,sys
from PIL import Image, ImageDraw
i = Image.new('RGB', (320, 240), (226, 229, 234))
d = ImageDraw.Draw(i)
d.rectangle((40, 120, 280, 180), fill=(160, 166, 175))
d.ellipse((50, 160, 110, 220), fill=(120, 126, 135))
d.ellipse((210, 160, 270, 220), fill=(120, 126, 135))
b = io.BytesIO(); i.save(b, 'JPEG', quality=85); sys.stdout.buffer.write(b.getvalue())`,
]);
async function subir(ruta, token) {
  const r = await fetch(`${URL}${ruta}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'image/jpeg',
      'cf-connecting-ip': `10.88.1.${++ip % 250}`,
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
    enRevision: ['Andrés Rojas', 'andres.rojas.vehiculos@ejemplo.com', { placa: 'AB1C23D' }],
    sinEnviar: ['Luis Pérez', 'luis.perez.vehiculos@ejemplo.com', { placa: 'AC2D34E' }],
    pestana: /^Vehículos/,
    aprobar: 'Aprobar la moto',
  },
  en: {
    locale: 'en-US',
    zona: null, // Miami ya está en la base
    enRevision: [
      'Michael Brown',
      'michael.brown.vehicles@ejemplo.com',
      { placa: 'ABC1234', placaEstado: 'FL' },
    ],
    sinEnviar: [
      'David Miller',
      'david.miller.vehicles@ejemplo.com',
      { placa: 'XYZ5678', placaEstado: 'FL' },
    ],
    pestana: /^Vehicles/,
    aprobar: 'Approve motorbike',
  },
};

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
  });
  await pedir('POST', '/datos/cuentas/hacer-admin', { semilla: DATOS.semilla }, reg.token);
  const token = (
    await pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave })
  ).token;
  const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, token)).ruta;
  // CANAL=chrome usa el Chrome de la computadora si no están los navegadores de Playwright.
  navegador = await chromium.launch(process.env.CANAL ? { channel: process.env.CANAL } : {});

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
    const conductor = async ([nombre, correo, placa], enviar) => {
      const c = await pedir('POST', '/datos/cuentas/registro', {
        nombre,
        correo,
        clave: DATOS.clave,
        rol: 'repartidor',
        idioma,
      });
      await pedir('PUT', '/datos/conductor/ciudad', { zonaId }, c.token);
      const v = await pedir(
        'POST',
        '/datos/conductor/vehiculos',
        {
          tipo: 'moto',
          marca: 'Motos Divoox',
          modelo: 'M150',
          anio: 2023,
          color: 'Negro',
          ...placa,
        },
        c.token,
      );
      if (enviar) {
        for (const t of ['foto_frente', 'foto_placa', 'registro', 'seguro'])
          await subir(`/datos/conductor/vehiculos/${v.id}/documentos?tipo=${t}`, c.token).catch(
            () => null,
          );
        await pedir('POST', `/datos/conductor/vehiculos/${v.id}/enviar`, {}, c.token).catch(
          () => null,
        );
      }
      // Cuentas reales en la base local (la bandeja enseña las reales por defecto).
      await pedir(
        'POST',
        '/datos/interno/diagnostico/sql',
        { sql: `UPDATE usuarios SET es_prueba = 0 WHERE id = '${c.usuario.id}'` },
        undefined,
        { 'x-reloj-secreto': DATOS.relojSecreto },
      );
      return c;
    };
    await conductor(T.enRevision, true);
    await conductor(T.sinEnviar, false);

    const ctx = await navegador.newContext({
      baseURL: URL,
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1,
      locale: T.locale,
    });
    await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    await ctx.addCookies([
      { name: 'tumbite_sesion', value: token, domain: 'localhost', path: '/', httpOnly: true },
    ]);
    const s = await ctx.newPage();
    s.on('console', (m) => {
      if (m.type() === 'error') fallos.push(`${idioma} consola: ${m.text()}`);
    });
    s.on('pageerror', (e) => fallos.push(`${idioma} página: ${e.message}`));

    await s.goto(`/panel/${ruta}/verifications`);
    const pestana = s.getByTestId('pestana-vehiculos');
    await pestana.waitFor({ timeout: 60_000 });
    await pestana.click();
    await s
      .locator('select', { has: s.locator(`option[value="${zonaId}"]`) })
      .first()
      .selectOption(zonaId);
    await s.getByText(T.enRevision[0]).first().waitFor({ timeout: 30_000 });
    await espera(1200);
    let png = join(ORIGINALES_PRIVADAS, `activacion-vehiculos-${idioma}.png`);
    await s.screenshot({ path: png });
    guardar(png, `activacion-vehiculos-${idioma}`);

    // El menú lateral entero, ordenado por uso.
    // Alto de sobra para que el menú quepa entero, sin cortarse al final.
    await s.setViewportSize({ width: 1280, height: 2300 });
    await espera(600);
    const menu = s.locator('nav.panel-menu');
    png = join(ORIGINALES_PRIVADAS, `menu-por-uso-${idioma}.png`);
    await menu.screenshot({ path: png });
    await s.setViewportSize({ width: 1280, height: 900 });
    guardar(png, `menu-por-uso-${idioma}`);

    // La prueba de verdad: aprobar los papeles y la moto ahí mismo y ver bajar el número.
    const antes = await pestana.textContent();
    const fila = s.getByTestId('vehiculo-fila').filter({ hasText: T.enRevision[0] });
    s.on('dialog', (d) => void d.accept());
    const aprobarDoc = fila.getByRole('button', { name: /^(Aprobar documento|Approve document)$/ });
    for (let i = 0; i < 8 && (await aprobarDoc.count()) > 0; i++) {
      await aprobarDoc.first().click();
      await espera(900);
    }
    await fila.getByRole('button', { name: T.aprobar }).click();
    await s.waitForFunction(
      (a) => document.querySelector('[data-testid="pestana-vehiculos"]')?.textContent !== a,
      antes,
      { timeout: 20_000 },
    );
    console.log(`${idioma}: pestaña antes «${antes}», después «${await pestana.textContent()}»`);
    // La lista «Sin enviar» trae al que no mandó su moto, sin botón de aprobar.
    await s.getByTestId('vehiculos-registrado').click();
    await s.getByText(T.sinEnviar[0]).first().waitFor({ timeout: 20_000 });
    png = join(ORIGINALES_PRIVADAS, `activacion-vehiculos-sin-enviar-${idioma}.png`);
    await s.screenshot({ path: png });
    // A 375 px no se desborda.
    await s.setViewportSize({ width: 375, height: 812 });
    await espera(600);
    const ancho = await s.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > 380) fallos.push(`${idioma}: la pestaña se desborda a 375 px (${ancho})`);
    png = join(ORIGINALES_PRIVADAS, `activacion-vehiculos-celular-${idioma}.png`);
    await s.screenshot({ path: png, fullPage: false });
    await ctx.close();
  }
} finally {
  await navegador?.close();
  apagar();
}
if (fallos.length) {
  console.error(fallos.join('\n'));
  process.exit(1);
}
console.log('capturas de Verificaciones y del menú en la carpeta privada; sin errores de consola');
