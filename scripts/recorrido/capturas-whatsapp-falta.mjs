/* global document */
// C-WHATSAPP-FALTA (25 nov 2026, encargo urgente de Richard) — todos los países. Contra un servidor
// LOCAL propio (nunca el sitio de pruebas ni producción, y SIN llamar a Meta: solo se usa la vista
// previa, que no envía), PRUEBA el botón «Mandarle por WhatsApp lo que le falta» y la sección de
// WhatsApp de «Recordatorios de registro», y toma las capturas de la ayuda interna:
//   whatsapp-falta-vista-<es|en>   → la ventana de la ficha en Verificaciones con el texto exacto
//   whatsapp-falta-zona-<es|en>    → «A todos los trabados de una zona» con la vista previa
//   → ~/Divoox-privado/ayuda-interna/{originales,capturas} (privadas, fuera del repositorio: C-AYUDA-INTERNA)
// Comprueba: ningún código crudo en pantalla, la consola sin errores y que nada se envió.
// En español, una ciudad de habla hispana (El Vigía); en inglés, Estados Unidos (Miami). Datos neutros.
// Antes: npm run build -w @tumbite/panel
// Uso: PUERTO_CAMPANA=8799 node scripts/recorrido/capturas-whatsapp-falta.mjs
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: carpetas fijas del repositorio y de la carpeta privada; claves es/en propias */
import { execFileSync, execSync, spawn } from 'node:child_process';
import { appendFileSync, cpSync, mkdirSync, readFileSync } from 'node:fs';
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
// Llaves de Meta DE MENTIRA y una dirección local que no existe: si algo intentara enviar, falla aquí
// (y la prueba lo detecta), nunca le llega a Meta.
appendFileSync(
  join(DIR, '.dev.vars'),
  [
    'META_WHATSAPP_TOKEN=token-recorrido-de-mentira',
    'META_WHATSAPP_PHONE_ID=1000000000000001',
    'META_WHATSAPP_API_URL=http://localhost:9',
  ].join('\n') + '\n',
);
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
      'cf-connecting-ip': `10.91.0.${++ip % 250}`,
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
      pais: 'VE',
      lat: 8.6136,
      lng: -71.6566,
      radioKm: 15,
      zonaHoraria: 'America/Caracas',
    },
    personas: [
      ['Carlos Méndez', 'carlos.mendez.whatsapp@ejemplo.com', '+584120000001'],
      ['Luisa Pérez', 'luisa.perez.whatsapp@ejemplo.com', '+584120000002'],
    ],
    asi: 'Así le llega por WhatsApp',
    tabla: 'Lo que le falta',
  },
  en: {
    locale: 'en-US',
    zona: null, // Miami ya está en la base
    personas: [
      ['James Wilson', 'james.wilson.whatsapp@ejemplo.com', '+13055550101'],
      ['Emily Carter', 'emily.carter.whatsapp@ejemplo.com', '+13055550102'],
    ],
    asi: 'This is what they get on WhatsApp',
    tabla: 'What is missing',
  },
};
const CRUDO =
  /\b(no_confirmo_por_whatsapp|plantilla_no_aprobada|pais_apagado|idioma_sin_plantilla|nada_que_le_toque|tope_paso|ya_hoy|vehiculo_enviar|sin_credenciales)\b/;

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
  // La plantilla aprobada (como si Meta lo hubiera dicho) y Venezuela encendido, Estados Unidos no.
  await pedir(
    'PUT',
    '/datos/admin/camila/whatsapp',
    {
      paises: { VE: true, US: false },
      topeDiario: 150,
      presupuestoDiaUsd: 3,
      costoUsd: 0.01,
      plantilla: { estado: 'APPROVED', categoria: 'UTILITY' },
    },
    token,
  );
  navegador = await chromium.launch(process.env.CANAL ? { channel: process.env.CANAL } : {});

  for (const idioma of ['es', 'en']) {
    const T = L[idioma];
    if (T.zona) {
      const z = T.zona;
      await sql(`INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
                 VALUES ('${z.id}', '${z.nombre}', '${z.pais}', 'USD', '${z.zonaHoraria}', ${z.lat}, ${z.lng}, ${z.radioKm}, 1)`);
    }
    const zonaId = T.zona?.id ?? 'US-FL-MIAMI';
    const ids = [];
    for (const [nombre, correo, telefono] of T.personas) {
      const c = await pedir('POST', '/datos/cuentas/registro', {
        nombre,
        correo,
        clave: DATOS.clave,
        rol: 'repartidor',
        idioma,
      });
      const id = c.usuario.id;
      ids.push(id);
      await pedir('PUT', '/datos/conductor/ciudad', { zonaId }, c.token);
      // Confirmó su celular con el código por WhatsApp (así queda en la base al escribirlo).
      await sql(
        `UPDATE usuarios SET es_prueba = 0, telefono = '${telefono}', telefono_verificado_en = datetime('now') WHERE id = '${id}'`,
      );
      await sql(`INSERT OR REPLACE INTO codigos_telefono (usuario_id, telefono, codigo_hash, intentos, enviados_hoy, canal)
                 VALUES ('${id}', '${telefono}', '-', 5, 1, 'whatsapp')`);
    }
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
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text()))
        fallos.push(`${idioma} consola: ${m.text()}`);
    });
    s.on('pageerror', (e) => fallos.push(`${idioma} página: ${e.message}`));

    // 1) La ventana de la ficha en Verificaciones, con el texto exacto.
    await s.goto(`/panel/${ruta}/verifications/${ids[0]}`);
    await s.getByTestId('whatsapp-falta-boton').waitFor({ timeout: 60_000 });
    await s.getByTestId('whatsapp-falta-boton').click();
    await s
      .getByTestId('whatsapp-falta-ventana')
      .getByText(T.asi)
      .waitFor({ timeout: 20_000 })
      .catch(() => {});
    await s.getByTestId('whatsapp-falta-ventana').waitFor({ timeout: 20_000 });
    await espera(800);
    let texto = await s.evaluate(() => document.body.innerText);
    let crudo = CRUDO.exec(texto);
    if (crudo) fallos.push(`${idioma}: código crudo en pantalla: ${crudo[0]}`);
    let png = join(ORIGINALES_PRIVADAS, `whatsapp-falta-vista-${idioma}.png`);
    await s.screenshot({ path: png, fullPage: false });
    guardar(png, `whatsapp-falta-vista-${idioma}`);
    await s.keyboard.press('Escape');

    // 2) «A todos los trabados de una zona», con la vista previa (no se envía nada).
    await s.goto(`/panel/${ruta}/signup-reminders`);
    await s.getByTestId('whatsapp-falta-ajustes').waitFor({ timeout: 60_000 });
    await s.getByTestId('whatsapp-falta-zona').selectOption(zonaId);
    await s
      .getByTestId('whatsapp-falta-ajustes')
      .getByRole('button', { name: /Ver a quién|See who/ })
      .click();
    await s.getByTestId('whatsapp-falta-tabla').waitFor({ timeout: 60_000 });
    await espera(600);
    texto = await s.evaluate(() => document.body.innerText);
    crudo = CRUDO.exec(texto);
    if (crudo) fallos.push(`${idioma}: código crudo en pantalla: ${crudo[0]}`);
    if (!texto.toLowerCase().includes(T.tabla.toLowerCase()))
      fallos.push(`${idioma}: no sale la tabla de la zona`);
    await s.addStyleTag({
      content: 'header, .pd-cabecera, [class*="cabecera"] { position: static !important; }',
    });
    png = join(ORIGINALES_PRIVADAS, `whatsapp-falta-zona-${idioma}.png`);
    await s.getByTestId('whatsapp-falta-ajustes').screenshot({ path: png });
    guardar(png, `whatsapp-falta-zona-${idioma}`);
    await ctx.close();
  }
  // Nada salió: la vista previa no escribe.
  const salidos = JSON.stringify(
    await sql("SELECT COUNT(*) AS n FROM rezagados_mensajes WHERE canal = 'whatsapp'"),
  );
  if (!/"n":0\b/.test(salidos)) fallos.push(`se escribió un mensaje de WhatsApp: ${salidos}`);
} finally {
  await navegador?.close();
  apagar();
}
if (fallos.length) {
  console.error(fallos.join('\n'));
  process.exit(1);
}
console.log(
  'WhatsApp «te falta» probado en el panel; capturas en la carpeta privada; nada enviado',
);
