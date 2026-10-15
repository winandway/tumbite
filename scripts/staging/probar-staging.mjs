#!/usr/bin/env node
/**
 * Pruebas S1–S8 de ARQUITECTURA-MULTISERVICIO-V1.2 contra el SITIO DE PRUEBAS de YaDominios Cloud.
 * Fase 0 (15 oct 2026). NUNCA contra producción: se niega si el sitio o la dirección no son de pruebas.
 *
 * Uso (las llaves NO van en el repositorio; se pasan solo en la línea de comandos):
 *   YAD_SITIO=<nombre-del-sitio-de-pruebas> YAD_TOKEN=<token de base de datos del sitio de pruebas> \
 *   URL_PRUEBAS=https://staging.tumbite.com ADMIN_TOKEN=<sesión de admin del sitio de pruebas> \
 *   node scripts/staging/probar-staging.mjs
 */
const SITIO = process.env.YAD_SITIO ?? '';
const TOKEN = process.env.YAD_TOKEN ?? '';
const URL = (process.env.URL_PRUEBAS ?? 'https://staging.tumbite.com').replace(/\/$/, '');
const ADMIN = process.env.ADMIN_TOKEN ?? '';
const API = 'https://yapanel.yadominios.com/api/hosting/db/query';

if (!SITIO || !TOKEN) {
  console.error('Faltan YAD_SITIO y YAD_TOKEN (del sitio de PRUEBAS).');
  process.exit(2);
}
if (
  SITIO === 'tumbite' ||
  !/prueba|staging|test/i.test(SITIO) ||
  !/staging\.|prueba|sitios\.dev/.test(URL)
) {
  console.error(`Me niego: «${SITIO}» / ${URL} no parecen el sitio de pruebas.`);
  process.exit(2);
}

let ok = 0;
let mal = 0;
const caso = (nombre, cond, detalle = '') => {
  console.log(`${cond ? 'OK   ' : 'FALLA'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  if (cond) ok++;
  else mal++;
};
async function sql(q, params = []) {
  const t0 = performance.now();
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sitio: SITIO, token: TOKEN, sql: q, params }),
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${cuerpo.error ?? ''}`);
  return { ...cuerpo, ms: performance.now() - t0 };
}
const sufijo = Math.random().toString(36).slice(2, 10);

// S1 — schema.sql con disparadores de varias sentencias
const disp = await sql(
  "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name IN ('retiros_descuenta_saldo','retiros_fallido_devuelve','retiros_transicion_valida')",
);
caso('S1 · los 3 disparadores de retiros existen en la base de pruebas', disp.results.length === 3);
const salud = await (await fetch(`${URL}/datos/salud`)).json();
caso(
  'S1 · la salud del sitio de pruebas ve los retiros sanos',
  ['ok', 'pendiente'].includes(salud.piezas?.retiros),
  `retiros=${salud.piezas?.retiros}`,
);

// S2 (Fase 0) — los disparadores de retiros funcionan en el motor real
const u = `zz-s2-${sufijo}`;
await sql(
  "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES (?, ?, 'Prueba S2', 'repartidor', 'x')",
  [u, `${u}@prueba.invalid`],
);
try {
  await sql(
    "INSERT INTO movimientos (id, usuario_id, monto, concepto) VALUES (?, ?, 1000, 'ajuste')",
    [`m-${u}`, u],
  );
  await sql(
    "INSERT INTO retiros (id, usuario_id, stripe_cuenta, monto_centavos) VALUES (?, ?, 'acct_prueba', 1000)",
    [`r-${u}`, u],
  );
  const s1 = await sql('SELECT COALESCE(SUM(monto),0) AS s FROM movimientos WHERE usuario_id = ?', [
    u,
  ]);
  caso('S2 · pedir el retiro descuenta el saldo en la misma sentencia', s1.results[0].s === 0);
  let bloqueado = false;
  try {
    await sql("UPDATE retiros SET estado = 'confirmado' WHERE id = ?", [`r-${u}`]);
  } catch {
    bloqueado = true;
  }
  caso('S2 · RAISE(ABORT) bloquea una transición no permitida', bloqueado);
  await sql("UPDATE retiros SET estado = 'enviando' WHERE id = ?", [`r-${u}`]);
  await sql("UPDATE retiros SET estado = 'fallido' WHERE id = ?", [`r-${u}`]);
  const s2 = await sql('SELECT COALESCE(SUM(monto),0) AS s FROM movimientos WHERE usuario_id = ?', [
    u,
  ]);
  caso('S2 · un rechazo devuelve el saldo una vez', s2.results[0].s === 1000);
  let fk = false;
  try {
    await sql(
      "INSERT INTO retiros (id, usuario_id, stripe_cuenta, monto_centavos) VALUES (?, 'no-existe', 'acct', 100)",
      [`r2-${u}`],
    );
  } catch {
    fk = true;
  }
  caso('S2 · las llaves foráneas están activas', fk);
} finally {
  await sql('DELETE FROM movimientos WHERE usuario_id = ?', [u]).catch(() => {});
  await sql('DELETE FROM retiros WHERE usuario_id = ?', [u]).catch(() => {});
  await sql('DELETE FROM usuarios WHERE id = ?', [u]).catch(() => {});
}

// S3 — UPDATE … FROM json_each con 10.000 muestras
const t3 = `zz_s3_${sufijo}`;
await sql(`CREATE TABLE ${t3} (id TEXT PRIMARY KEY, lat REAL, t TEXT)`);
try {
  await sql(
    `INSERT INTO ${t3} WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < 9999) SELECT 'c' || i, 0, '2026-01-01' FROM n`,
  );
  const muestras = JSON.stringify(
    Array.from({ length: 10000 }, (_, i) => ({ c: `c${i}`, lat: 25.7, t: '2026-10-15 10:00:00' })),
  );
  const r = await sql(
    `UPDATE ${t3} SET lat = m.lat, t = m.t FROM (SELECT json_extract(value,'$.c') AS c, json_extract(value,'$.lat') AS lat, json_extract(value,'$.t') AS t FROM json_each(?)) AS m WHERE ${t3}.id = m.c AND m.t > ${t3}.t`,
    [muestras],
  );
  const n = await sql(`SELECT COUNT(*) AS n FROM ${t3} WHERE lat = 25.7`);
  caso(
    'S3 · UPDATE … FROM json_each con 10.000 muestras',
    n.results[0].n === 10000,
    `ida y vuelta ${r.ms.toFixed(0)} ms`,
  );
} finally {
  await sql(`DROP TABLE ${t3}`).catch(() => {});
}

// S4 — tiempo de consultas típicas (ida y vuelta por HTTP; el tiempo en la base es menor)
const tiempos = [];
for (let i = 0; i < 20; i++)
  tiempos.push(
    (
      await sql(
        "SELECT id, estado FROM pedidos WHERE estado IN ('aceptado','listo') AND repartidor_id IS NULL LIMIT 20",
      )
    ).ms,
  );
tiempos.sort((a, b) => a - b);
console.log(
  `INFO  S4 · consulta de despacho: mediana ${tiempos[10].toFixed(0)} ms ida y vuelta (incluye la red)`,
);

// S5 — 50 «aceptaciones» simultáneas de la misma fila: gana una
const t5 = `zz_s5_${sufijo}`;
await sql(`CREATE TABLE ${t5} (id INTEGER PRIMARY KEY, conductor TEXT)`);
try {
  await sql(`INSERT INTO ${t5} (id) VALUES (1)`);
  const r = await Promise.all(
    Array.from({ length: 50 }, (_, i) =>
      sql(`UPDATE ${t5} SET conductor = ? WHERE id = 1 AND conductor IS NULL`, [`c${i}`]).catch(
        (e) => ({ error: String(e) }),
      ),
    ),
  );
  const ganadores = r.filter((x) => Number(x.rowsWritten ?? 0) > 0).length;
  caso(
    'S5 · 50 aceptaciones simultáneas: gana una sola',
    ganadores === 1,
    `ganadores=${ganadores}`,
  );
} finally {
  await sql(`DROP TABLE ${t5}`).catch(() => {});
}

// S6 — exclusividad comida ↔ viaje: sus disparadores entran en la fase 3 (no en la fase 0)
console.log('PEND  S6 · se ejecuta al publicar la fase 3 (conductor_ocupacion) en pruebas');

// S7 — batch que falla a la mitad se deshace entero (ruta de diagnóstico, solo admin)
if (ADMIN) {
  const r = await fetch(`${URL}/datos/admin/diagnostico/lote-atomico`, {
    method: 'POST',
    headers: { authorization: `Bearer ${ADMIN}` },
  });
  const d = await r.json();
  caso('S7 · un batch que falla a la mitad no deja nada', d.atomico === true, JSON.stringify(d));
} else console.log('PEND  S7 · falta ADMIN_TOKEN de una cuenta admin del sitio de pruebas');

// S8 — Comida sigue respondiendo con los cambios puestos
for (const r of [
  '/',
  '/app/',
  '/driver/',
  '/restaurant/',
  '/panel',
  '/datos/salud',
  '/datos/restaurantes',
]) {
  const code = (await fetch(`${URL}${r}`)).status;
  caso(`S8 · ${r} responde 200`, code === 200, String(code));
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
