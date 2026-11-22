// Capturas de las FICHAS del superadmin (conductor, cliente, restaurante y agente) a cuatro anchos, y
// la revisión de que ningún dato quede cortado ni montado (C-FICHA-SIN-CORTES, 22 nov 2026, Gerencia).
// Contra el servidor LOCAL del recorrido (.recorrido; ver scripts/recorrido/preparar.mjs). NO toca el
// sitio de pruebas ni producción. Datos inventados y neutros, sin ciudades ni personas reales.
//
// Uso: ETAPA=antes|despues node scripts/recorrido/capturas-fichas.mjs
//   → ~/Documents/Entregas/Divoox/panel-diseno/<etapa>-ficha-<cuál>-<ancho>.png
//   SALIDA_CAPTURAS=<carpeta> las deja en otra carpeta. SOLO_REVISAR=1 no guarda fotos.
// Termina con error (código 1) si en la etapa «despues» algo queda cortado, montado o desparejo.
/* eslint-disable security/detect-non-literal-fs-filename -- guion local: carpetas fijas */
import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CIUDAD_NEUTRA } from './neutro.mjs';
import { revisarCortes } from './revisar-cortes.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const ETAPA = process.env.ETAPA === 'despues' ? 'despues' : 'antes';
const SALIDA =
  process.env.SALIDA_CAPTURAS || join(homedir(), 'Documents', 'Entregas', 'Divoox', 'panel-diseno');
mkdirSync(SALIDA, { recursive: true });
const ZONA = 'VE-ZZ-EJEMPLO';
const ANCHOS = [1280, 1440, 1920, 760];

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.85.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const sql = async (q) => {
  const d = await pedir('POST', '/datos/interno/diagnostico/sql', { sql: q }, undefined, {
    'x-reloj-secreto': DATOS.relojSecreto,
  });
  return d.filas ?? d.results ?? [];
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ───────── Datos de ejemplo: lo MÁS largo que puede traer una ficha ─────────
// Correo largo y frenado, teléfono con código de país, verificación aprobada por la ruta anterior.
const CORREO_LARGO = 'conductor.de.ejemplo.con.un.correo.bastante.largo@recorrido.test';
await sql(
  `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
   VALUES ('${ZONA}', '${CIUDAD_NEUTRA.es}', 'VE', 'VES', 'America/Caracas', 8.6, -71.1, 20, 1)`,
);
async function cuenta(correo, nombre, rol) {
  const ya = await sql(`SELECT id FROM usuarios WHERE correo = '${correo}'`);
  if (ya[0]?.id) return ya[0].id;
  const r = await pedir('POST', '/datos/cuentas/registro', {
    nombre,
    correo,
    clave: DATOS.clave,
    rol,
    idioma: 'es',
  });
  await sql(
    `UPDATE usuarios SET zona_id = '${ZONA}', telefono = '+584145550100', fecha_nacimiento = '1990-01-01' WHERE id = '${r.usuario.id}'`,
  );
  return r.usuario.id;
}
const conductor = await cuenta(CORREO_LARGO, 'Conductor de Ejemplo', 'repartidor');
await sql(
  `INSERT INTO repartidores (usuario_id, zona_id, conectado, lat, lng, ubicacion_en) VALUES ('${conductor}', '${ZONA}', 1, 8.61, -71.11, datetime('now', '-3 hours'))
   ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id, conectado = 1, lat = excluded.lat, lng = excluded.lng, ubicacion_en = excluded.ubicacion_en`,
);
await sql(
  `INSERT INTO kyc (usuario_id, estado, doc_tipo, doc_frente, doc_reverso, selfie, enviado_en, revisado_en)
   VALUES ('${conductor}', 'aprobado', 'licencia', 'kyc/ejemplo-frente', 'kyc/ejemplo-reverso', 'kyc/ejemplo-cara', datetime('now', '-1 days'), datetime('now', '-20 hours'))
   ON CONFLICT(usuario_id) DO UPDATE SET estado = excluded.estado, doc_tipo = excluded.doc_tipo, doc_frente = excluded.doc_frente,
     doc_reverso = excluded.doc_reverso, selfie = excluded.selfie, enviado_en = excluded.enviado_en, revisado_en = excluded.revisado_en`,
);
await sql(
  `INSERT OR IGNORE INTO correos_rebotados (correo, motivo) VALUES ('${CORREO_LARGO}', 'buzon lleno')`,
);
// Como una cuenta de antes del rastro: sin pasos anotados (la ficha los lee de sus fuentes reales).
if (ETAPA === 'antes') await sql(`DELETE FROM embudo_cuenta WHERE usuario_id = '${conductor}'`);
const cliente = await cuenta(
  'cliente.de.ejemplo.con.un.correo.bastante.largo@recorrido.test',
  'Cliente de Ejemplo',
  'cliente',
);
const duenio = await cuenta(
  'restaurante.de.ejemplo.con.un.correo.largo@recorrido.test',
  'Encargada de Ejemplo',
  'restaurante',
);
await sql(
  `INSERT OR IGNORE INTO restaurantes (id, dueno_id, nombre, estado, telefono, direccion, zona_id)
   VALUES ('rest-ficha-ejemplo', '${duenio}', 'Restaurante de Ejemplo', 'aprobado', '+584145550101', 'Avenida de ejemplo con un nombre bastante largo, local 12', '${ZONA}')`,
);

// ───────── El equipo ─────────
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
// El agente se crea como lo crea el equipo (si ya existe, se usa el que hay).
let agente = (await sql(`SELECT id FROM agentes ORDER BY creado_en LIMIT 1`).catch(() => []))[0]
  ?.id;
if (!agente)
  agente = await pedir(
    'POST',
    '/datos/admin/agentes',
    {
      nombre: 'Agente de Ejemplo',
      correo: 'agente.de.ejemplo.con.un.correo.bastante.largo@recorrido.test',
      telefono: '+584145550102',
      zonaId: ZONA,
      direccion: 'Avenida de ejemplo con un nombre bastante largo, local 12',
      horario: 'Lunes a sábado, de 8:00 a. m. a 6:00 p. m.',
    },
    equipo,
  )
    .then((d) => d.agente?.id ?? d.id ?? null)
    .catch((e) => {
      console.warn(`capturas-fichas: no se pudo crear el agente de ejemplo (${e.message})`);
      return null;
    });

const FICHAS = [
  ['conductor', `drivers/${conductor}`],
  ['cliente', `customers/${cliente}`],
  ['restaurante', 'restaurants/rest-ficha-ejemplo'],
  // La ficha del agente no tiene dirección propia: se abre desde su lista.
  ...(agente ? [['agente', 'agents']] : []),
];

const navegador = await chromium.launch();
const fallos = [];
for (const ancho of ANCHOS) {
  const ctx = await navegador.newContext({
    baseURL: URL,
    viewport: { width: ancho, height: 900 },
    deviceScaleFactor: 1,
    locale: 'es-VE',
  });
  await ctx.addInitScript(() => localStorage.setItem('tumbite.idioma', 'es'));
  await ctx.addCookies([
    { name: 'tumbite_sesion', value: equipo, domain: 'localhost', path: '/', httpOnly: true },
  ]);
  const p = await ctx.newPage();
  for (const [nombre, seccion] of FICHAS) {
    await p.goto(`/panel/${ruta}/${seccion}`);
    await p.getByTestId('armazon').waitFor({ timeout: 60_000 });
    await p.waitForLoadState('networkidle').catch(() => null);
    if (nombre === 'agente') {
      await p.locator('tbody tr').first().getByRole('button').last().click();
      await p.waitForLoadState('networkidle').catch(() => null);
    }
    await espera(1200);
    const vistos = await p.evaluate(revisarCortes);
    for (const v of vistos) fallos.push(`${nombre} a ${ancho}: ${v}`);
    if (!process.env.SOLO_REVISAR) {
      const archivo = `${ETAPA}-ficha-${nombre}-${ancho === 760 ? 'estrecha' : ancho}.png`;
      await p.screenshot({ path: join(SALIDA, archivo), fullPage: true });
      console.log(`capturas-fichas: ${archivo}`);
    }
  }
  await ctx.close();
}
await navegador.close();
console.log(
  fallos.length
    ? `capturas-fichas: ${fallos.length} cosas cortadas, montadas o desparejas:\n- ${fallos.join('\n- ')}`
    : 'capturas-fichas: nada cortado, montado ni desparejo en ninguna ficha ni ancho',
);
if (fallos.length && ETAPA === 'despues') process.exit(1);
