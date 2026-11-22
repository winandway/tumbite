// Capturas del superadmin para el sistema de diseño del panel (C-PANEL-DISENO, 21 nov 2026, Gerencia).
// Contra el servidor LOCAL del recorrido (.recorrido, puerto 8790; ver scripts/recorrido/preparar.mjs).
// NO toca el sitio de pruebas ni producción. Datos inventados y neutros: «Ciudad de ejemplo»,
// conductores con nombres genéricos. Ningún dato real.
//
// Uso: ETAPA=antes|despues node scripts/recorrido/capturas-panel-diseno.mjs
//   → ~/Documents/Entregas/Divoox/panel-diseno/<etapa>-<pantalla>.png (internas: van a Gerencia)
//   SALIDA_CAPTURAS=<carpeta> las deja en otra carpeta (para revisar sin tocar las entregas).
// C-VERIFICACIONES-BANDEJA (22 nov 2026): Verificaciones se fotografía con su lista, la ficha abierta
// de una persona (fotos de ejemplo dibujadas aquí, sin ninguna persona real), su Configuración y el
// ancho de un celular (375 px).
/* eslint-disable security/detect-non-literal-fs-filename -- guion local: carpetas fijas */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CIUDAD_NEUTRA } from './neutro.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const ETAPA = process.env.ETAPA === 'despues' ? 'despues' : 'antes';
const SALIDA =
  process.env.SALIDA_CAPTURAS || join(homedir(), 'Documents', 'Entregas', 'Divoox', 'panel-diseno');
mkdirSync(SALIDA, { recursive: true });
const ZONA = 'VE-ZZ-EJEMPLO';

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.83.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
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
const huella = (t) => createHash('sha256').update(t).digest('hex');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ───────── Fotos de ejemplo (C-VERIFICACIONES-BANDEJA) ─────────
// Un documento y una cara DIBUJADOS aquí (sin ninguna persona real), subidos como los sube la app, y
// lo que «dijo» la comprobación automática de cada uno, para que la bandeja y la ficha se vean llenas.
let navegadorFotos = null;
async function dibujo(html, ancho, alto) {
  navegadorFotos ??= await chromium.launch();
  const pg = await navegadorFotos.newPage({ viewport: { width: ancho, height: alto } });
  await pg.setContent(
    `<body style="margin:0;font-family:Arial,sans-serif;background:#e9ebef">${html}</body>`,
  );
  const b = await pg.screenshot({ type: 'jpeg', quality: 80 });
  await pg.close();
  return b;
}
const tarjeta = (titulo, reverso) =>
  dibujo(
    `<div style="margin:20px;height:300px;border-radius:18px;background:#f7f7f2;border:2px solid #c9ccd2;padding:24px;box-sizing:border-box">
      <div style="font-weight:700;letter-spacing:2px;color:#4a5058">${titulo}</div>
      ${
        reverso
          ? '<div style="margin-top:40px;height:22px;background:#d5d8dd"></div><div style="margin-top:14px;height:22px;width:70%;background:#d5d8dd"></div><div style="margin-top:60px;font-family:monospace;color:#8a9099">IDZZZ000000000&lt;&lt;&lt;&lt;&lt;&lt;</div>'
          : '<div style="display:flex;gap:24px;margin-top:28px"><div style="width:130px;height:160px;border-radius:10px;background:#cfd3da"></div><div style="flex:1"><div style="height:18px;background:#d5d8dd;margin:8px 0"></div><div style="height:18px;width:80%;background:#d5d8dd;margin:14px 0"></div><div style="height:18px;width:60%;background:#d5d8dd;margin:14px 0"></div><div style="color:#8a9099;margin-top:22px">EJEMPLO 000000</div></div></div>'
      }
    </div>`,
    560,
    340,
  );
const cara = () =>
  dibujo(
    `<div style="width:400px;height:400px;display:flex;align-items:flex-end;justify-content:center;background:#dfe2e7">
      <div style="position:relative;width:260px;height:330px">
        <div style="position:absolute;left:70px;top:20px;width:120px;height:140px;border-radius:50%;background:#aab0b9"></div>
        <div style="position:absolute;left:0;top:170px;width:260px;height:180px;border-radius:130px 130px 0 0;background:#aab0b9"></div>
      </div></div>`,
    400,
    400,
  );
async function fotosDeEjemplo(id, token, i) {
  for (const [pieza, imagen] of [
    ['doc_frente', await tarjeta('DOCUMENTO DE EJEMPLO', false)],
    ['doc_reverso', await tarjeta('DOCUMENTO DE EJEMPLO', true)],
    ['selfie', await cara()],
  ]) {
    const r = await fetch(`${URL}/datos/kyc/foto/${pieza}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'image/jpeg',
        'cf-connecting-ip': `10.84.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
      },
      body: imagen,
    });
    if (!r.ok) throw new Error(`foto ${pieza}: ${r.status}`);
  }
  // Lo que «dijo» la comprobación automática: todo en verde para una, una duda para otra.
  const reversoIlegible = i === 1;
  for (const [paso, columna, clase, color, json] of [
    [
      'doc_frente',
      'doc_frente',
      'identidad_frente',
      'verde',
      '{"clase":"identidad_frente","legible":true,"nombre":"EJEMPLO","pais":"VE"}',
    ],
    [
      'doc_reverso',
      'doc_reverso',
      'identidad_reverso',
      reversoIlegible ? 'amarillo' : 'verde',
      `{"clase":"identidad_reverso","legible":${reversoIlegible ? 'false' : 'true'}}`,
    ],
    ['cara', 'selfie', 'cara', 'verde', '{"clase":"cara","legible":true}'],
  ])
    await sql(
      `INSERT INTO verificacion_fotos (id, conductor_id, paso, clave, pais, ia_color, ia_clase, ia_confianza, ia_json)
       SELECT '${id}-${paso}', usuario_id, '${paso}', ${columna}, 'VE', '${color}', '${clase}', 90, '${json}'
         FROM kyc WHERE usuario_id = '${id}' AND ${columna} IS NOT NULL`,
    );
  await sql(
    `INSERT OR REPLACE INTO verificacion_caras (conductor_id, resultado, confianza, color) VALUES ('${id}', '${i === 2 ? 'dudoso' : 'misma'}', 88, '${i === 2 ? 'amarillo' : 'verde'}')`,
  );
}

// ───────── Datos de ejemplo (una sola vez por base) ─────────
const ya = await sql(
  `SELECT COUNT(*) AS n FROM usuarios WHERE correo LIKE 'diseno-%@recorrido.test'`,
);
const sembrado = Number(ya?.filas?.[0]?.n ?? ya?.results?.[0]?.n ?? 0) > 0;
if (!sembrado) {
  await sql(
    `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
     VALUES ('${ZONA}', '${CIUDAD_NEUTRA.es}', 'VE', 'VES', 'America/Caracas', 8.6, -71.1, 20, 1)`,
  );
  const gente = [
    ['Ana R.', 'pendiente', '-3 hours'],
    ['Luis M.', 'pendiente', '-30 hours'],
    ['Carla P.', 'pendiente', '-50 minutes'],
    ['Jorge T.', 'aprobado', '-3 days'],
    ['Marta G.', 'rechazado', '-2 days'],
    ['Pedro S.', 'sin_enviar', null],
  ];
  for (const [i, [nombre, estado, cuando]] of gente.entries()) {
    const r = await pedir('POST', '/datos/cuentas/registro', {
      nombre,
      correo: `diseno-${i}@recorrido.test`,
      clave: DATOS.clave,
      rol: 'repartidor',
      idioma: 'es',
    });
    const id = r.usuario.id;
    await sql(`UPDATE usuarios SET zona_id = '${ZONA}' WHERE id = '${id}'`);
    await sql(
      `INSERT INTO repartidores (usuario_id, zona_id, ubicacion_en) VALUES ('${id}', '${ZONA}', datetime('now'))
       ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id, ubicacion_en = excluded.ubicacion_en`,
    );
    if (cuando)
      await sql(
        `INSERT INTO kyc (usuario_id, estado, enviado_en) VALUES ('${id}', '${estado}', datetime('now', '${cuando}'))
         ON CONFLICT(usuario_id) DO UPDATE SET estado = excluded.estado, enviado_en = excluded.enviado_en`,
      );
    await sql(
      `UPDATE sesiones SET expira_en = datetime('now', '+2 hours') WHERE id = '${huella(r.token)}'`,
    );
    if (estado === 'pendiente') await fotosDeEjemplo(id, r.token, i);
  }
  await navegadorFotos?.close();
}

// ───────── El equipo (cuenta del recorrido hecha administradora) ─────────
const reg = await pedir('POST', '/datos/cuentas/registro', {
  nombre: 'Divoox Soporte',
  correo: DATOS.correoEquipo,
  clave: DATOS.clave,
  rol: 'cliente',
  idioma: 'es',
}).catch(() => null);
const t0 =
  reg?.token ??
  (await pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave }))
    .token;
await pedir('POST', '/datos/cuentas/hacer-admin', { semilla: DATOS.semilla }, t0).catch(() => null);
const equipo = (
  await pedir('POST', '/datos/cuentas/entrar', { correo: DATOS.correoEquipo, clave: DATOS.clave })
).token;
const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, equipo)).ruta;

const navegador = await chromium.launch();
const ctx = await navegador.newContext({
  baseURL: URL,
  viewport: { width: 1366, height: 900 },
  deviceScaleFactor: 1,
  locale: 'es-VE',
});
await ctx.addInitScript(() => localStorage.setItem('tumbite.idioma', 'es'));
await ctx.addCookies([
  { name: 'tumbite_sesion', value: equipo, domain: 'localhost', path: '/', httpOnly: true },
]);
const p = await ctx.newPage();
// La ficha abierta: la primera persona pendiente con fotos.
const conFotos = await sql(
  `SELECT k.usuario_id AS id FROM kyc k JOIN usuarios u ON u.id = k.usuario_id
    WHERE u.correo LIKE 'diseno-%@recorrido.test' AND k.estado = 'pendiente' AND k.doc_frente IS NOT NULL
    ORDER BY k.enviado_en LIMIT 1`,
);
const fichaId = (conFotos?.filas ?? conFotos?.results ?? [])[0]?.id ?? '';
for (const [nombre, seccion] of [
  ['verificaciones', 'verifications'],
  ...(fichaId ? [['verificaciones-ficha', `verifications/${fichaId}`]] : []),
  ['verificaciones-configuracion', 'verifications/settings'],
  ['repartidores', 'drivers'],
  ['zonas', 'zones'],
]) {
  await p.goto(`/panel/${ruta}/${seccion}`);
  await p.getByTestId('armazon').waitFor({ timeout: 60_000 });
  await p.waitForLoadState('networkidle').catch(() => null);
  await espera(1500);
  await p.screenshot({ path: join(SALIDA, `${ETAPA}-${nombre}.png`), fullPage: true });
  console.log(`capturas-panel-diseno: ${ETAPA}-${nombre}.png`);
}
// Verificaciones en el ancho de un celular (375 px).
{
  const cel = await navegador.newContext({
    baseURL: URL,
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    locale: 'es-VE',
  });
  await cel.addInitScript(() => localStorage.setItem('tumbite.idioma', 'es'));
  await cel.addCookies([
    { name: 'tumbite_sesion', value: equipo, domain: 'localhost', path: '/', httpOnly: true },
  ]);
  const pc = await cel.newPage();
  for (const [nombre, seccion] of [
    ['verificaciones-celular', 'verifications'],
    ...(fichaId ? [['verificaciones-ficha-celular', `verifications/${fichaId}`]] : []),
  ]) {
    await pc.goto(`/panel/${ruta}/${seccion}`);
    await pc.getByTestId('armazon').waitFor({ timeout: 60_000 });
    await pc.waitForLoadState('networkidle').catch(() => null);
    await espera(1500);
    await pc.screenshot({ path: join(SALIDA, `${ETAPA}-${nombre}.png`), fullPage: true });
    console.log(`capturas-panel-diseno: ${ETAPA}-${nombre}.png`);
  }
  await cel.close();
}
await navegador.close();
