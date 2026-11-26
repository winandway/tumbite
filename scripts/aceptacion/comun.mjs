/**
 * Piezas comunes de los robots de la lista de aceptación (C-ROBOT-NOCTURNO, 26 nov 2026, Gerencia
 * con autorización de Richard): robot de las apps (Maestro), robot del panel (Playwright) y examen de
 * Camila. Los tres corren SOLO contra el sitio de pruebas y con cuentas de prueba. La lista vive en
 * ~/Gerencia/LISTA-DE-ACEPTACION-DIVOOX.md.
 *
 * Cada robot deja `registros/aceptacion/<fecha>/<seccion>.json` con el mismo formato:
 * { seccion, empezo, termino, lineas: [{ id, titulo, estado: 'verde'|'rojo'|'no-se-pudo', motivo, captura? }] }
 * y `parte.mjs` los junta en el parte de la mañana para Gerencia.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Solo el sitio de pruebas. Cualquier otro destino se rechaza antes de tocar nada. */
export const SITIOS_PERMITIDOS = [
  'https://staging.tumbite.com',
  'https://tumbite-pruebas.sitios.dev',
];
export function sitioDePruebas() {
  const url = (process.env.ACEPTACION_URL || SITIOS_PERMITIDOS[0]).replace(/\/$/, '');
  if (!SITIOS_PERMITIDOS.includes(url)) {
    throw new Error(`El robot solo corre contra el sitio de pruebas, no contra ${url}.`);
  }
  return url;
}

/** Fecha de la corrida (hora de Michigan): la noche del 26 al 27 es el parte del 27. */
export function fechaCorrida() {
  if (process.env.ACEPTACION_FECHA) return process.env.ACEPTACION_FECHA;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Detroit' }).format(new Date());
}

export function carpetaCorrida(fecha = fechaCorrida()) {
  const c = join(process.env.ACEPTACION_SALIDA || join(RAIZ, 'registros/aceptacion'), fecha);
  mkdirSync(c, { recursive: true });
  return c;
}

/**
 * Las cuentas demo del sitio de pruebas se leen en el momento desde el archivo privado (fuera de
 * git). Nunca se copian al repositorio. Devuelve { correo: clave }.
 */
export function cuentasDemo() {
  const ruta =
    process.env.ACEPTACION_CUENTAS || '/Users/windocellc/Divoox/docs/CUENTAS-DE-PRUEBA.md';
  const salida = {};
  if (!existsSync(ruta)) return salida;
  for (const linea of readFileSync(ruta, 'utf8').split('\n')) {
    const m = linea.match(/\|\s*([a-z0-9.+_-]+@ejemplo\.com)\s*\|\s*([^|\s]+)\s*\|/i);
    if (m && !salida[m[1]]) salida[m[1]] = m[2];
  }
  return salida;
}

/** Correo de una cuenta nueva del robot: dominio `.test`, que el sitio de pruebas reconoce como guion. */
export function correoRobot(prefijo) {
  return `${prefijo}-${Date.now().toString(36)}@aceptacion.test`;
}

export function escribirSeccion(seccion, datos, fecha = fechaCorrida()) {
  const carpeta = carpetaCorrida(fecha);
  const json = { seccion, ...datos };
  writeFileSync(join(carpeta, `${seccion}.json`), JSON.stringify(json, null, 2));
  const verdes = json.lineas.filter((l) => l.estado === 'verde').length;
  const md = [
    `# ${seccion} — ${fecha}`,
    '',
    `${verdes} de ${json.lineas.length} en verde.`,
    '',
    ...json.lineas.map(
      (l) =>
        `- ${l.estado === 'verde' ? '🟢' : l.estado === 'rojo' ? '🔴' : '⚪'} ${l.id} ${l.titulo}: ${l.motivo || 'bien'}${l.captura ? ` (captura: ${l.captura})` : ''}`,
    ),
    '',
  ].join('\n');
  writeFileSync(join(carpeta, `${seccion}.md`), md);
  return { carpeta, verdes, total: json.lineas.length };
}
