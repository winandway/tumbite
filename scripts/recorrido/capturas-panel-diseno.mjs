// Capturas del superadmin para el sistema de diseño del panel (C-PANEL-DISENO, 21 nov 2026, Gerencia).
// Contra el servidor LOCAL del recorrido (.recorrido, puerto 8790; ver scripts/recorrido/preparar.mjs).
// NO toca el sitio de pruebas ni producción. Datos inventados y neutros: «Ciudad de ejemplo»,
// conductores con nombres genéricos. Ningún dato real.
//
// Uso: ETAPA=antes|despues node scripts/recorrido/capturas-panel-diseno.mjs
//   → ~/Documents/Entregas/Divoox/panel-diseno/<etapa>-<pantalla>.png (internas: van a Gerencia)
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
const SALIDA = join(homedir(), 'Documents', 'Entregas', 'Divoox', 'panel-diseno');
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
  }
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
for (const [nombre, seccion] of [
  ['verificaciones', 'verifications'],
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
await navegador.close();
