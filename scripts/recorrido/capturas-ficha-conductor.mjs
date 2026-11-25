/* global document, getComputedStyle */
// Encargo de Richard en la ficha del conductor (25 nov 2026) — todos los países. Contra un servidor LOCAL
// propio (nunca el sitio de pruebas ni producción), PRUEBA la ficha de un conductor con su moto
// registrada y sin enviar, y toma las capturas de la ayuda interna:
//   activacion-ficha-sin-enviar-<es|en> → la ficha en Verificaciones: «Espera al equipo» arriba, la
//                                          moto sin enviar con fotos, placa, papeles y sus botones
//   activacion-ficha-servicios-<es|en>  → «Servicios y requisitos»: lo que falta de verdad, en colores
//   → ~/Divoox-privado/ayuda-interna/{originales,capturas} (privadas, fuera del repositorio: C-AYUDA-INTERNA)
// Comprueba: ningún código crudo en pantalla, «Cambiar ciudad» sin «Recuperamos…» sin haber escrito,
// «Aprobar la moto» deja la moto aprobada, la consola sin errores y que a 375 px no se desborda.
// En español, una ciudad de habla hispana (El Vigía); en inglés, Estados Unidos (Miami). Datos neutros.
// Antes: npm run build -w @tumbite/panel
// Uso: PUERTO_CAMPANA=8799 node scripts/recorrido/capturas-ficha-conductor.mjs
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: carpetas fijas del repositorio y de la carpeta privada */
import { execFileSync, execSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const PUERTO = process.env.PUERTO_CAMPANA ?? '8799';
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
      'cf-connecting-ip': `10.89.1.${++ip % 250}`,
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
    persona: ['Carlos Méndez', 'carlos.mendez.ficha@ejemplo.com', { placa: 'AD3E45F' }],
    aprobar: 'Aprobar la moto',
    esperando: 'Esperando que el conductor la envíe',
    cambiarCiudad: 'Cambiar ciudad',
    recuperado: 'Recuperamos lo que estabas escribiendo',
  },
  en: {
    locale: 'en-US',
    zona: null, // Miami ya está en la base
    persona: [
      'James Wilson',
      'james.wilson.profile@ejemplo.com',
      { placa: 'JKL4321', placaEstado: 'FL' },
    ],
    aprobar: 'Approve the motorcycle',
    esperando: 'Waiting for the driver to send it',
    cambiarCiudad: 'Change city',
    recuperado: 'We restored what you were typing',
  },
};
const CRUDO =
  /\b(vehiculo_incompatible|proximamente|sin_habilitacion|en_revision|no_disponible_zona|requisitos_faltantes|pendiente_aprobacion|actualizar_app|sin_enviar)\b/;

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

  for (const idioma of ['es', 'en']) {
    const T = L[idioma];
    if (T.zona) {
      const z = T.zona;
      await sql(`INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
                 VALUES ('${z.id}', '${z.nombre}', 'VE', 'USD', '${z.zonaHoraria}', ${z.lat}, ${z.lng}, ${z.radioKm}, 1)`);
    }
    const zonaId = T.zona?.id ?? 'US-FL-MIAMI';
    const [nombre, correo, placa] = T.persona;
    const c = await pedir('POST', '/datos/cuentas/registro', {
      nombre,
      correo,
      clave: DATOS.clave,
      rol: 'repartidor',
      idioma,
    });
    const id = c.usuario.id;
    await pedir('PUT', '/datos/conductor/ciudad', { zonaId }, c.token);
    const v = await pedir(
      'POST',
      '/datos/conductor/vehiculos',
      { tipo: 'moto', marca: 'Motos Divoox', modelo: 'M150', anio: 2023, color: 'Negro', ...placa },
      c.token,
    );
    // Fotos y seguro subidos, sin enviar. El registro (subido antes de que el envío fuera solo) se pone
    // directo en la base local para que la moto siga «sin enviar» y se pueda aprobar desde la ficha.
    for (const t of ['foto_frente', 'foto_placa', 'seguro'])
      await subir(`/datos/conductor/vehiculos/${v.id}/documentos?tipo=${t}`, c.token);
    await sql(`INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave)
               SELECT 'reg-${v.id}', vehiculo_id, 'registro', clave FROM vehiculo_documentos
                WHERE vehiculo_id = '${v.id}' AND tipo = 'foto_frente' LIMIT 1`);
    await sql(
      `UPDATE vehiculos SET estado = 'registrado' WHERE id = '${v.id}' AND estado = 'registrado'`,
    );
    await sql(`UPDATE usuarios SET es_prueba = 0 WHERE id = '${id}'`);
    // Un borrador vacío viejo de «Cambiar ciudad» (el caso que vio Richard).
    const ctx = await navegador.newContext({
      baseURL: URL,
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1,
      locale: T.locale,
    });
    await ctx.addInitScript(
      ([i, llave]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem(llave, JSON.stringify({ zonaId: '', motivo: '' }));
      },
      [idioma, `tumbite.borrador.ciudad-conductor-${id}.superadmin`],
    );
    await ctx.addCookies([
      { name: 'tumbite_sesion', value: token, domain: 'localhost', path: '/', httpOnly: true },
    ]);
    const s = await ctx.newPage();
    s.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text()))
        fallos.push(`${idioma} consola: ${m.text()}`);
    });
    s.on('pageerror', (e) => fallos.push(`${idioma} página: ${e.message}`));
    s.on('dialog', (d) => void d.accept());

    await s.goto(`/panel/${ruta}/verifications/${id}`);
    await s.getByTestId(`sin-enviar-${v.id}`).waitFor({ timeout: 60_000 });
    await s.getByTestId('espera-equipo').waitFor({ timeout: 20_000 });
    await s
      .getByTestId('detalle-conductor')
      .getByTestId('servicio-moto')
      .waitFor({ timeout: 20_000 });
    await espera(1200);
    const texto = await s.evaluate(() => document.body.innerText);
    const crudo = CRUDO.exec(texto);
    if (crudo) fallos.push(`${idioma}: código crudo en pantalla: ${crudo[0]}`);
    if (!texto.includes(T.esperando) && !/lo puedes aprobar|you can approve it/.test(texto))
      fallos.push(`${idioma}: no sale el estado del vehículo sin enviar`);
    let png = join(ORIGINALES_PRIVADAS, `activacion-ficha-sin-enviar-${idioma}.png`);
    await s.screenshot({ path: png, fullPage: true });
    guardar(png, `activacion-ficha-sin-enviar-${idioma}`);
    // La cabecera fija no tapa el recorte de una sección.
    await s.addStyleTag({
      content: 'header, .pd-cabecera, [class*="cabecera"] { position: static !important; }',
    });
    png = join(ORIGINALES_PRIVADAS, `activacion-ficha-servicios-${idioma}.png`);
    await s.getByTestId('revision-servicios').screenshot({ path: png });
    guardar(png, `activacion-ficha-servicios-${idioma}`);

    // Aprobar desde la ficha: la moto queda aprobada.
    await s.getByTestId(`aprobar-sin-enviar-${v.id}`).click();
    // Aprobada, deja de estar «sin enviar»: su tarjeta se va de la ficha.
    await s.getByTestId(`sin-enviar-${v.id}`).waitFor({ state: 'detached', timeout: 20_000 });
    const fila = await sql(`SELECT estado FROM vehiculos WHERE id = '${v.id}'`);
    const estado = JSON.stringify(fila);
    if (!estado.includes('aprobado'))
      fallos.push(`${idioma}: la moto no quedó aprobada (${estado})`);
    console.log(`${idioma}: moto ${estado.includes('aprobado') ? 'aprobada' : 'SIN aprobar'}`);

    // La ficha del conductor: «Cambiar ciudad» sin el aviso de borrador (no se escribió nada).
    await s.goto(`/panel/${ruta}/drivers/${id}`);
    await s.getByTestId('detalle-conductor').waitFor({ timeout: 60_000 });
    const tres = s
      .getByRole('button', { name: /Más acciones de la cuenta|More account actions/ })
      .first();
    if (!(await tres.count())) fallos.push(`${idioma}: no encontré los tres puntos de la ficha`);
    else {
      await tres.click();
      const opcion = s.getByRole('menuitem', { name: T.cambiarCiudad });
      if (await opcion.count()) {
        await opcion.click();
        await s.getByTestId('cambiar-ciudad-repartidor').waitFor({ timeout: 20_000 });
        await espera(800);
        if (await s.getByText(T.recuperado).count())
          fallos.push(`${idioma}: «Cambiar ciudad» avisa un borrador sin haber escrito nada`);
        else console.log(`${idioma}: «Cambiar ciudad» sin aviso de borrador`);
      } else fallos.push(`${idioma}: no encontré «${T.cambiarCiudad}» en los tres puntos`);
    }
    // A 375 px no se desborda.
    await s.goto(`/panel/${ruta}/verifications/${id}`);
    await s.getByTestId('detalle-conductor').waitFor({ timeout: 60_000 });
    await s.setViewportSize({ width: 375, height: 812 });
    await espera(800);
    const ancho = await s.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > 380) {
      const culpables = await s.evaluate(() => {
        const recortado = (e) => {
          for (let a = e.parentElement; a; a = a.parentElement)
            if (['auto', 'hidden', 'scroll', 'clip'].includes(getComputedStyle(a).overflowX))
              return true;
          return false;
        };
        return [...document.querySelectorAll('body *')]
          .filter((e) => e.getBoundingClientRect().right > 380 && !recortado(e))
          .slice(0, 6)
          .map(
            (e) =>
              `${e.tagName}.${String(e.className).slice(0, 40)} «${(e.textContent ?? '').slice(0, 30)}»`,
          );
      });
      fallos.push(`${idioma}: la ficha se desborda a 375 px (${ancho}): ${culpables.join(' | ')}`);
    }
    png = join(ORIGINALES_PRIVADAS, `activacion-ficha-celular-${idioma}.png`);
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
console.log('ficha del conductor probada; capturas en la carpeta privada; sin errores de consola');
