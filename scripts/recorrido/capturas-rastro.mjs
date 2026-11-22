// Capturas REALES del rastro de actividad (C-RASTRO, 22 nov 2026) para la AYUDA INTERNA del panel y
// para Gerencia — todos los países. Contra el servidor LOCAL del recorrido (.recorrido, puerto 8790;
// ver scripts/recorrido/preparar.mjs), ya encendido. NO toca el sitio de pruebas ni producción.
// Datos inventados y neutros: «Ciudad de ejemplo», nombres genéricos, mapa sin rótulos.
//   rastro-actividad-<es|en>  → la sección «Actividad» de la ficha de un conductor
//   rastro-viaje-<es|en>      → la línea de tiempo de un viaje y el mapa con los pasos numerados
//   rastro-embudo-<es|en>     → la pantalla «Embudo de registro»
//   → ~/Divoox-privado/ayuda-interna/{originales,capturas} y copia en Documentos/Entregas/Divoox/panel-diseno
// Uso: node scripts/recorrido/capturas-rastro.mjs
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: carpetas fijas y los idiomas fijos «es» y «en» */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CAPTURAS_PRIVADAS, ORIGINALES_PRIVADAS } from '../docs/ayudaPrivada.mjs';
import { CIUDAD_NEUTRA, mapaSinRotulos } from './neutro.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const ENTREGA = join(homedir(), 'Documents', 'Entregas', 'Divoox', 'panel-diseno');
for (const d of [ORIGINALES_PRIVADAS, CAPTURAS_PRIVADAS, ENTREGA])
  mkdirSync(d, { recursive: true });
const ZONA = 'VE-ZZ-EJEMPLO';

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.84.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
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
const APP = (plataforma, pais) => ({
  'x-tumbite-app': `repartidor/0.9.4 ${plataforma}`,
  'cf-ipcountry': pais,
});

// ───────── Datos de ejemplo (una sola vez por base) ─────────
await sql(
  `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
   VALUES ('${ZONA}', '${CIUDAD_NEUTRA.es}', 'VE', 'VES', 'America/Caracas', 8.6, -71.1, 20, 1)`,
);
const OPERACION = 'ejemplo-rastro-viaje-0001';
const ya = await sql(`SELECT conductor_id AS id FROM operaciones WHERE id = '${OPERACION}'`);
let conductor = ya?.filas?.[0]?.id ?? ya?.results?.[0]?.id;
if (!conductor) {
  // Si una corrida anterior quedó a medias, sus cuentas de ejemplo se apartan (cambian de correo).
  await sql(
    `UPDATE usuarios SET correo = 'viejo-' || id || '@recorrido.test', correo_canonico = NULL WHERE correo LIKE 'rastro-%@recorrido.test'`,
  );
  // Gente que se quedó en distintos pasos, para que el embudo tenga forma.
  const gente = [
    ['Conductor de Ejemplo', 'android', 'VE', 'todo'],
    ['Ana R.', 'android', 'VE', 'fotos'],
    ['Luis M.', 'android', 'VE', 'correo'],
    ['Carla P.', 'web', 'VE', 'correo'],
    ['Jorge T.', 'ios', 'CO', 'cuenta'],
    ['Marta G.', 'android', 'VE', 'cuenta'],
    ['Pedro S.', 'android', 'VE', 'cuenta'],
  ];
  const foto = (id, paso, color, n) =>
    sql(
      `INSERT INTO verificacion_fotos (id, conductor_id, paso, clave, pais, ia_color, ia_clase, ia_confianza, ia_json)
       VALUES ('rastro-foto-' || lower(hex(randomblob(6))), '${id}', '${paso}', 'ejemplo/${n}', 'VE', '${color}', 'ok', 90, '{}')`,
    );
  let n = 0;
  for (const [i, [nombre, plataforma, pais, hasta]] of gente.entries()) {
    const r = await pedir(
      'POST',
      '/datos/cuentas/registro',
      {
        nombre,
        correo: `rastro-${i}@recorrido.test`,
        clave: DATOS.clave,
        rol: 'repartidor',
        idioma: 'es',
      },
      undefined,
      APP(plataforma, pais),
    );
    const id = r.usuario.id;
    if (i === 0) conductor = id;
    await sql(`UPDATE usuarios SET zona_id = '${ZONA}' WHERE id = '${id}'`);
    await sql(
      `UPDATE sesiones SET expira_en = datetime('now', '+2 hours') WHERE id = '${huella(r.token)}'`,
    );
    if (hasta === 'cuenta') continue;
    await sql(`UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = '${id}'`);
    if (hasta === 'correo') continue;
    await foto(id, 'cara', i === 0 ? 'verde' : 'amarillo', ++n);
    await foto(id, 'doc_frente', 'verde', ++n);
    if (hasta === 'fotos') continue;
    await sql(
      `INSERT INTO repartidores (usuario_id, zona_id, lat, lng, ubicacion_en) VALUES ('${id}', '${ZONA}', 8.61, -71.11, datetime('now'))
       ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id`,
    );
    await sql(
      `INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, plazas, estado)
       VALUES ('rastro-veh-' || lower(hex(randomblob(4))), '${id}', 'moto', 'Marca', 'Modelo', 'Negro', 'EJEMPLO' || abs(random() % 90 + 10), 'ZZ', 2022, 1, 'aprobado')`,
    );
    await sql(
      `INSERT INTO kyc (usuario_id, estado, doc_tipo, enviado_en, revisado_en) VALUES ('${id}', 'aprobado', 'licencia', datetime('now', '-2 hours'), datetime('now', '-1 hours'))
       ON CONFLICT(usuario_id) DO UPDATE SET estado = 'aprobado', enviado_en = excluded.enviado_en, revisado_en = excluded.revisado_en`,
    );
    await sql(`UPDATE repartidores SET conectado = 1 WHERE usuario_id = '${id}'`);
  }
  // Tres personas más que abrieron el registro y no crearon la cuenta (solo contadores).
  for (const paso of ['abrio', 'abrio', 'abrio', 'abrio', 'formulario', 'formulario', 'revisar'])
    await pedir(
      'POST',
      '/datos/rastro/paso',
      { app: 'repartidor', paso },
      undefined,
      APP('android', 'VE'),
    );
  for (let i = 0; i < 7; i++) {
    await pedir(
      'POST',
      '/datos/rastro/paso',
      { app: 'repartidor', paso: 'abrio' },
      undefined,
      APP('android', 'VE'),
    );
    await pedir(
      'POST',
      '/datos/rastro/paso',
      { app: 'repartidor', paso: 'formulario' },
      undefined,
      APP('android', 'VE'),
    );
    await pedir(
      'POST',
      '/datos/rastro/paso',
      { app: 'repartidor', paso: 'revisar' },
      undefined,
      APP('android', 'VE'),
    );
  }
  // Un viaje de ejemplo ya terminado, con dónde estaba el conductor en cada paso.
  const pasajera = (
    await pedir('POST', '/datos/cuentas/registro', {
      nombre: 'Pasajera de Ejemplo',
      correo: `rastro-pasajera-${Date.now()}@recorrido.test`,
      clave: DATOS.clave,
      rol: 'cliente',
      idioma: 'es',
    })
  ).usuario.id;
  await sql(
    `INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, conductor_id, zona_id, estado_general, creado_en)
     VALUES ('${OPERACION}', 'moto', 'viaje_pasajero', '${pasajera}', '${conductor}', '${ZONA}', 'terminada', datetime('now', '-40 minutes'))`,
  );
  await sql(
    `INSERT INTO viajes (operacion_id, estado, ultimo_actor, ultima_clave, pin_recogida, origen_lat, origen_lng, origen_direccion, destino_lat, destino_lng, destino_direccion, pasajeros, metodo_pago, total_final_centavos, asignado_en, llego_en, iniciado_en, terminado_en)
     VALUES ('${OPERACION}', 'terminado', 'conductor', 'ejemplo-rastro', '0000', 8.6, -71.1, 'Punto de recogida', 8.624, -71.082, 'Destino del viaje', 1, 'efectivo', 250,
             datetime('now', '-39 minutes'), datetime('now', '-33 minutes'), datetime('now', '-31 minutes'), datetime('now', '-19 minutes'))`,
  );
  const evento = (antes, nuevo, rol, quien, cuando, lat, lng) =>
    sql(
      `INSERT INTO eventos_operacion (operacion_id, tipo, estado_anterior, estado_nuevo, actor_id, actor_rol, datos_json, creado_en)
       VALUES ('${OPERACION}', 'transicion', '${antes}', '${nuevo}', ${quien ? `'${quien}'` : 'NULL'}, '${rol}',
               json_object('motivo', NULL, 'lat', ${lat}, 'lng', ${lng}), datetime('now', '${cuando}'))`,
    );
  await evento('pago_pendiente', 'buscando', 'sistema', null, '-40 minutes', 'NULL', 'NULL');
  await evento('buscando', 'asignado', 'conductor', conductor, '-39 minutes', 8.588, -71.112);
  await evento('asignado', 'conductor_llego', 'conductor', conductor, '-33 minutes', 8.6, -71.1);
  await evento(
    'conductor_llego',
    'en_curso',
    'conductor',
    conductor,
    '-31 minutes',
    8.6001,
    -71.1001,
  );
  await evento('en_curso', 'terminado', 'conductor', conductor, '-19 minutes', 8.624, -71.082);
}

// La red del servidor local es la de esta computadora: en las fotos va una red de ejemplo, sin lugar real.
await sql(
  `UPDATE rastro_cuenta SET pais_red = 'VE', region_red = NULL, ciudad_red = '${CIUDAD_NEUTRA.es}', red = 'Operadora de ejemplo'`,
);
await sql(`UPDATE embudo_cuenta SET pais = 'VE'`);
await sql(
  `DELETE FROM embudo_anonimo WHERE pais <> 'VE' AND EXISTS (SELECT 1 FROM embudo_anonimo WHERE pais = 'VE')`,
);
await sql(`UPDATE embudo_anonimo SET pais = 'VE'`);

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

const navegador = mapaSinRotulos(await chromium.launch());
for (const idioma of ['es', 'en']) {
  await sql(`UPDATE zonas SET nombre = '${CIUDAD_NEUTRA[idioma]}' WHERE id = '${ZONA}'`);
  await sql(
    `UPDATE rastro_cuenta SET ciudad_red = '${CIUDAD_NEUTRA[idioma]}', red = '${idioma === 'es' ? 'Operadora de ejemplo' : 'Sample carrier'}'`,
  );
  const ctx = await navegador.newContext({
    baseURL: URL,
    viewport: { width: 1366, height: 900 },
    deviceScaleFactor: 2,
    locale: idioma === 'es' ? 'es-VE' : 'en-US',
  });
  await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
  await ctx.addCookies([
    { name: 'tumbite_sesion', value: equipo, domain: 'localhost', path: '/', httpOnly: true },
  ]);
  const p = await ctx.newPage();
  const guardar = async (nombre, blanco) => {
    const png = join(ORIGINALES_PRIVADAS, `rastro-${nombre}-${idioma}.png`);
    await (blanco ?? p).screenshot({ path: png, ...(blanco ? {} : { fullPage: true }) });
    execFileSync('cwebp', [
      '-quiet',
      '-q',
      '82',
      png,
      '-o',
      join(CAPTURAS_PRIVADAS, `rastro-${nombre}-${idioma}.webp`),
    ]);
    copyFileSync(png, join(ENTREGA, `rastro-${nombre}-${idioma}.png`));
    console.log(`capturas-rastro: rastro-${nombre}-${idioma}`);
  };
  const prefijo = idioma === 'es' ? '/es' : '';
  // 1. La actividad de la cuenta en la ficha del conductor.
  await p.goto(`${prefijo}/panel/${ruta}/drivers/${conductor}`);
  const actividad = p.getByTestId('actividad');
  await actividad.waitFor({ timeout: 60_000 });
  await p.getByTestId('actividad-sigue').waitFor({ timeout: 30_000 });
  // La cabecera fija del panel no debe tapar la tarjeta en la foto.
  await p.addStyleTag({ content: 'header, [class*="cabecera"] { position: static !important; }' });
  await actividad.scrollIntoViewIfNeeded();
  await espera(800);
  await guardar('actividad', actividad);
  // 2. La línea de tiempo del viaje con el mapa.
  await p.goto(`${prefijo}/panel/${ruta}/rides/${OPERACION}`);
  await p.locator('.ficha-linea').first().waitFor({ timeout: 60_000 });
  await p.waitForLoadState('networkidle').catch(() => null);
  await espera(2500);
  await guardar('viaje');
  // 3. El embudo de registro.
  await p.goto(`${prefijo}/panel/${ruta}/signups`);
  await p.getByTestId('embudo').waitFor({ timeout: 60_000 });
  await p.locator('.embudo-tabla tbody tr').first().waitFor({ timeout: 30_000 });
  await espera(800);
  await guardar('embudo');
  await ctx.close();
}
await sql(`UPDATE zonas SET nombre = '${CIUDAD_NEUTRA.es}' WHERE id = '${ZONA}'`);
await navegador.close();
