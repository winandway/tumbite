// Robots de aceptación de Divoox (C-ROBOT-NOCTURNO, 26 nov 2026). Lo que necesitan el robot del panel
// y el examen de Camila para preparar sus cuentas: la base del sitio de pruebas por la llave de
// YaDominios, la API como la usan las apps, celulares de guion y el parte por pasos. C-ROBOTS-SOLO-PRUEBAS: todo corre SOLO contra el sitio de pruebas, con cuentas de robot
// cuyo correo es de un dominio que no puede existir («@robots.invalid»): el sitio de pruebas no les
// manda códigos reales (C-GUIONES-SIN-CODIGO-REAL), no prenden el pánico (C-PANICO-SOLO-REALES) y
// nunca se confunden con las cuentas ni la zona de revisión de las tiendas. No se paga nada.
import { createHash, randomInt } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { carpetaCorrida, escribirSeccion, sitioDePruebas } from './comun.mjs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const URL_PRUEBAS = sitioDePruebas();
export const SITIO_PRUEBAS = 'tumbite-pruebas';
export const DOMINIO_ROBOT = 'robots.invalid';
const YAPANEL = 'https://yapanel.yadominios.com/api/sitio/v1';

/** Correos y nombres que NUNCA toca un robot: las cuentas de revisión de las tiendas. */
export const PROHIBIDO = /revisor|review|apple|google/i;

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** La llave de «Acceso para IA» del SITIO DE PRUEBAS (la guardó guardar-llave-pruebas.sh). */
export function llavePruebas() {
  if (process.env.YADOMINIOS_LLAVE_PRUEBAS) return process.env.YADOMINIOS_LLAVE_PRUEBAS;
  const zsh = join(homedir(), '.zshrc');
  if (existsSync(zsh)) {
    const m = readFileSync(zsh, 'utf8').match(/^export YADOMINIOS_LLAVE_PRUEBAS=(.+)$/m);
    if (m) return m[1].replace(/^['"]|['"]$/g, '');
  }
  throw new Error(
    'Falta la llave del sitio de pruebas (bash scripts/staging/guardar-llave-pruebas.sh).',
  );
}

async function yapanel(herramienta, cuerpo = {}) {
  const r = await fetch(`${YAPANEL}/${herramienta}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${llavePruebas()}`, 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!d.ok) throw new Error(`${herramienta}: ${r.status} ${JSON.stringify(d).slice(0, 300)}`);
  return d.resultado;
}

let comprobado = false;
/** PARADA si la llave no es la del sitio de pruebas (nunca producción). */
export async function exigirSitioDePruebas() {
  if (comprobado) return;
  const e = await yapanel('estado_del_sitio');
  if (e?.nombre !== SITIO_PRUEBAS || (e.dominios ?? []).includes('tumbite.com'))
    throw new Error(`PARADA: la llave abre «${e?.nombre}», no el sitio de pruebas.`);
  comprobado = true;
}

/** Una consulta a la base del sitio de pruebas. Los valores van escapados con `q()`. */
export async function sql(consulta) {
  await exigirSitioDePruebas();
  const r = await yapanel('consultar_base', { sql: consulta });
  return r?.results ?? [];
}
export const q = (v) =>
  v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

/** Una llamada a la API del sitio de pruebas, como la hacen las apps. */
export async function api(
  metodo,
  ruta,
  cuerpo,
  { token, app, idioma = 'es', cabeceras = {} } = {},
) {
  const h = { 'content-type': 'application/json', 'x-idioma': idioma, ...cabeceras };
  if (token) h.authorization = `Bearer ${token}`;
  if (app) h['x-tumbite-app'] = app;
  for (let i = 0; ; i++) {
    const r = await fetch(`${URL_PRUEBAS}${ruta}`, {
      method: metodo,
      headers: h,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const d = await r.json().catch(() => ({}));
    // El registro admite pocas cuentas por minuto desde la misma dirección (C-REGISTRO-PAUSADO).
    if (r.status === 429 && i < 4) {
      await dormir(20_000);
      continue;
    }
    if (r.status >= 500 && i < 2) {
      await dormir(3_000);
      continue;
    }
    return { estado: r.status, d };
  }
}

/** Sello de la noche: todas las cuentas de esta corrida lo llevan en el correo. */
export const SELLO =
  process.env.ROBOT_SELLO ??
  new Date().toISOString().slice(0, 10).replace(/-/g, '') + randomInt(1000);

export const correoRobot = (papel) => `robot.${papel}.${SELLO}.${randomInt(1e6)}@${DOMINIO_ROBOT}`;

/** Un celular que existe en su país y es distinto en cada cuenta (C-CELULAR-DE-GUION). */
export function celularRobot(pais = 'US') {
  const c = (n) => String(randomInt(10 ** n)).padStart(n, '0');
  if (pais === 'VE') return `+58${['412', '414', '424', '416', '426'][randomInt(5)]}${c(7)}`;
  const area = ['305', '786', '248', '313', '212', '415', '617', '702', '404', '512'][
    randomInt(10)
  ];
  let central = 520 + randomInt(80);
  if (central === 555) central = 556;
  return `+1${area}${central}${c(4)}`;
}

/** Marca la cuenta como de prueba (C-CUENTA-PRUEBA) y su correo como confirmado. */
export async function marcarCuentaRobot(correo) {
  if (!correo.endsWith(`@${DOMINIO_ROBOT}`)) throw new Error('solo cuentas de robot');
  await sql(
    `UPDATE usuarios SET es_prueba = 1, correo_confirmado_en = COALESCE(correo_confirmado_en, datetime('now')) WHERE correo = ${q(correo)}`,
  );
}

/**
 * El código de seis cifras que se le mandó a una cuenta (se lee de su huella en la base, como lo
 * leería el teléfono). A las cuentas de robot el sitio de pruebas no les manda nada, así que esto
 * solo sirve si alguna vez se prueba la puerta con una cuenta que sí la tiene.
 */
export async function codigoCelular(usuarioId) {
  for (let i = 0; i < 20; i++) {
    const [f] = await sql(
      `SELECT codigo_hash FROM codigos_telefono WHERE usuario_id = ${q(usuarioId)}`,
    );
    const hash = f?.codigo_hash;
    if (hash && hash !== '-') {
      for (let n = 0; n < 1_000_000; n++) {
        const c = String(n).padStart(6, '0');
        if (createHash('sha256').update(`${usuarioId}:${c}`).digest('hex') === hash) return c;
      }
    }
    await dormir(1_000);
  }
  return null;
}

// ── El parte (formato común de scripts/aceptacion: registros/aceptacion/<fecha>/<sección>.json) ───

/** Carpeta de la noche: registros/aceptacion/<fecha> (la misma que usan apps, panel y parte). */
export function carpetaParte() {
  const dir = process.env.PARTE_DIR ?? carpetaCorrida();
  mkdirSync(join(dir, 'capturas'), { recursive: true });
  return dir;
}

/**
 * Anota un paso de una línea de la lista. estado: 'verde' | 'rojo' | 'omitida' (en el parte sale como
 * «no se pudo», con su motivo). Se va guardando en <robot>.jsonl; `cerrarSeccion` lo junta.
 */
export function anotar(robot, linea, estado, detalle, captura) {
  if (!['verde', 'rojo', 'omitida'].includes(estado)) throw new Error(`estado raro: ${estado}`);
  const fila = {
    robot,
    linea,
    estado,
    detalle: String(detalle ?? '').slice(0, 800),
    captura,
    cuando: new Date().toISOString(),
  };
  appendFileSync(join(carpetaParte(), `${robot}.jsonl`), JSON.stringify(fila) + '\n');
  const marca = estado === 'verde' ? 'VERDE' : estado === 'rojo' ? 'ROJO ' : 'OMITE';
  console.log(`[${marca}] ${linea} · ${fila.detalle}`);
  return fila;
}

/**
 * Junta lo anotado en <robot>.jsonl y escribe la sección en el formato de comun.mjs. Una línea con
 * varios pasos (C1 en seis ciudades) es roja si uno es rojo; los motivos se juntan. `titulos` da el
 * nombre de la lista de cada línea; las que no se anotaron salen como «no se pudo».
 */
export function cerrarSeccion(robot, titulos, extra = {}) {
  const ruta = join(carpetaParte(), `${robot}.jsonl`);
  const filas = existsSync(ruta)
    ? readFileSync(ruta, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];
  const ids = [...new Set([...Object.keys(titulos), ...filas.map((f) => f.linea)])];
  const lineas = ids.map((id) => {
    const de = filas.filter((f) => f.linea === id);
    if (!de.length)
      return { id, titulo: titulos[id] ?? id, estado: 'no-se-pudo', motivo: 'no llegó a correr' };
    const estado = de.some((f) => f.estado === 'rojo')
      ? 'rojo'
      : de.every((f) => f.estado === 'verde')
        ? 'verde'
        : 'no-se-pudo';
    return {
      id,
      titulo: titulos[id] ?? id,
      estado,
      motivo: de
        .map((f) => f.detalle)
        .filter(Boolean)
        .join(' · ')
        .slice(0, 1500),
      captura: de.map((f) => f.captura).find(Boolean) ?? null,
    };
  });
  return escribirSeccion(robot, { termino: new Date().toISOString(), ...extra, lineas });
}
