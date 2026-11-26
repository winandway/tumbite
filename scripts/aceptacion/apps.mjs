#!/usr/bin/env node
/**
 * Robot de las apps (Maestro) de la lista de aceptación — C-ROBOT-NOCTURNO (26 nov 2026). Recorre la
 * app compilada contra el SITIO DE PRUEBAS en el iPhone simulado de esta Mac, con cuentas de prueba
 * (correo `.test`: el sitio de pruebas no les pide ni manda código de celular). No gasta dinero, no
 * toca las tiendas ni las cuentas o la zona de revisión.
 *
 * Cada flujo de `maestro/` declara en su cabecera la línea de la lista que comprueba:
 *   # linea: C1
 *   # titulo: Crear cuenta desde Maracaibo
 *   # app: repartidor
 * El parte queda en registros/aceptacion/<fecha>/apps.json y apps.md, con una captura por línea.
 *
 * Uso: node scripts/aceptacion/apps.mjs [--solo C1,P2] [--instalar]
 *   --instalar  reinstala las apps de apks-pruebas/ios-simulador antes de correr.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  RAIZ,
  carpetaCorrida,
  correoRobot,
  cuentasDemo,
  escribirSeccion,
  sitioDePruebas,
} from './comun.mjs';

const args = process.argv.slice(2);
const solo = (() => {
  const i = args.indexOf('--solo');
  return i >= 0 ? new Set(args[i + 1].split(',').map((s) => s.trim().toUpperCase())) : null;
})();

/** Las líneas de apps de ~/Gerencia/LISTA-DE-ACEPTACION-DIVOOX.md (conductor y pasajero). */
const LINEAS_LISTA = [
  ['C1', 'Crear la cuenta desde cualquier ciudad'],
  ['C2', 'Verificar el celular con el código'],
  ['C3', 'Poner la fecha de nacimiento'],
  ['C4', 'Subir los papeles con «Tomar foto» y «Subir desde archivos»'],
  ['C5', 'Registrar la moto y enviarla'],
  ['C6', 'Cerrar la app a mitad del registro y volver'],
  ['C7', 'Ver lo que le falta, en la app y por WhatsApp'],
  ['C8', 'Conectarse cuando ya está aprobado'],
  ['C9', 'Recibir un viaje, aceptarlo y terminarlo'],
  ['C10', 'Cobrar en efectivo, con Pago Móvil o con Saldo Divoox'],
  ['C11', 'Marcar «Voy de regreso»'],
  ['C12', 'Escribirle a Camila'],
  ['C13', 'Cerrar sesión'],
  ['P1', 'Crear la cuenta con el celular'],
  ['P2', 'Pedir una moto en El Vigía a un destino del tabulador'],
  ['P3', 'Pedir a un destino que no está en la hoja'],
  ['P4', 'Ver la pantalla «Método de pago»'],
  ['P5', 'Usar la primera carrera gratis o el saldo de regalo'],
  ['P6', 'Cancelar un viaje'],
  ['P7', 'Seguir al conductor y recibir el viaje terminado'],
  ['P8', 'Pedir ayuda a Camila'],
];

const APPS = {
  repartidor: 'com.windoce.tumbite.driver',
  cliente: 'com.windoce.tumbite',
};

function simuladorEncendido() {
  const salida = execFileSync('xcrun', ['simctl', 'list', 'devices', 'booted'], { encoding: 'utf8' });
  const m = salida.match(/\(([0-9A-F-]{36})\)/);
  if (m) return m[1];
  // De noche nadie lo enciende: se enciende el iPhone de pruebas.
  const lista = execFileSync('xcrun', ['simctl', 'list', 'devices', 'available'], { encoding: 'utf8' });
  const iphone = lista.match(/iPhone 18 Pro \(([0-9A-F-]{36})\)/) ?? lista.match(/iPhone[^(]*\(([0-9A-F-]{36})\)/);
  if (!iphone) throw new Error('No hay un iPhone simulado en esta Mac.');
  execFileSync('xcrun', ['simctl', 'boot', iphone[1]]);
  execFileSync('xcrun', ['simctl', 'bootstatus', iphone[1], '-b']);
  return iphone[1];
}

function precioKm9() {
  const hora = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', hour: 'numeric', hourCycle: 'h23' }).format(new Date()),
  );
  return hora >= 21 || hora < 6 ? '3[.,]90' : '3[.,]00';
}

function leerCabecera(ruta) {
  const cab = {};
  for (const l of readFileSync(ruta, 'utf8').split('\n')) {
    const m = l.match(/^#\s*(linea|titulo|app|tambien):\s*(.+)$/);
    if (m) cab[m[1]] = m[2].trim();
    else if (l.trim() && !l.startsWith('#')) break;
  }
  return cab;
}

function flujos() {
  const carpeta = join(RAIZ, 'maestro');
  const lista = [];
  for (const sub of ['repartidor', 'cliente']) {
    const dir = join(carpeta, sub);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith('.yaml')) continue;
      const ruta = join(dir, f);
      const cab = leerCabecera(ruta);
      if (!cab.linea) continue;
      if (solo && !solo.has(cab.linea.toUpperCase())) continue;
      lista.push({ ruta, ...cab, app: cab.app || sub });
    }
  }
  return lista;
}

function instalar(udid) {
  for (const app of Object.keys(APPS)) {
    const ruta = join(RAIZ, 'apks-pruebas/ios-simulador', `tumbite-${app}.app`);
    if (existsSync(ruta)) execFileSync('xcrun', ['simctl', 'install', udid, ruta]);
  }
}

/** Lo que Maestro dijo al fallar, en una línea que se entienda. */
function motivoDeFallo(texto) {
  const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  // El paso que falló (Maestro lo marca «FAILED») y, si lo dice, la causa.
  const paso = lineas.find((l) => /\.\.\. FAILED$/.test(l) && !/^Run /.test(l));
  const causa = lineas.find((l) => /^(Assertion is false|Element not found)/.test(l));
  const clave = paso ? `${paso.replace(/\.\.\. FAILED$/, '')}${causa ? ` (${causa})` : ''}` : null;
  return (clave || lineas.at(-1) || 'falló sin decir por qué').replace(/\x1b\[[0-9;]*m/g, '').slice(0, 300);
}

async function main() {
  const base = sitioDePruebas();
  const udid = simuladorEncendido();
  if (args.includes('--instalar')) instalar(udid);
  const carpeta = carpetaCorrida();
  const capturas = join(carpeta, 'apps');
  mkdirSync(capturas, { recursive: true });
  const demo = cuentasDemo();
  const empezo = new Date().toISOString();
  const lineas = [];
  // Ubicación del teléfono: El Vigía (Venezuela), ciudad de prueba de la lista.
  spawnSync('xcrun', ['simctl', 'location', udid, 'set', '8.6219,-71.6510']);

  for (const f of flujos()) {
    const id = f.linea.toUpperCase();
    const salidaPrueba = join(capturas, id);
    mkdirSync(salidaPrueba, { recursive: true });
    const env = {
      APP_ID: APPS[f.app],
      SITIO: base,
      CORREO_NUEVO: correoRobot(`robot-${f.app}-${id.toLowerCase()}`),
      CLAVE_NUEVA: `Robot-${Date.now().toString(36)}-Noche9`,
      NOMBRE_NUEVO: 'Robot Nocturno',
      // Celular de Venezuela que existe (Movistar 0414) y distinto en cada cuenta: un teléfono no abre
      // dos cuentas. Al sitio de pruebas no le llega ningún código para un correo «.test».
      CELULAR_NUEVO: `414${String(randomInt(10 ** 7)).padStart(7, '0')}`,
      CORREO_DEMO_CONDUCTOR: 'demo.repartidor@ejemplo.com',
      CLAVE_DEMO_CONDUCTOR: demo['demo.repartidor@ejemplo.com'] ?? '',
      CORREO_DEMO_CLIENTE: 'demo.cliente@ejemplo.com',
      CLAVE_DEMO_CLIENTE: demo['demo.cliente@ejemplo.com'] ?? '',
      // Tabulador de El Vigía: KM 9 vale 3,00 de día y 3,90 de 9 pm a 6 am (hora de Venezuela).
      PRECIO_KM9: precioKm9(),
      CAPTURA: join(salidaPrueba, 'final'),
    };
    const parametros = Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]);
    process.stdout.write(`── ${id} ${f.titulo} … `);
    const r = spawnSync(
      'maestro',
      ['--device', udid, 'test', ...parametros, '--test-output-dir', salidaPrueba, f.ruta],
      { encoding: 'utf8', timeout: 15 * 60_000, env: { ...process.env, MAESTRO_CLI_NO_ANALYTICS: '1' } },
    );
    // Captura de cómo quedó la pantalla, pase o no pase.
    const foto = join(salidaPrueba, 'pantalla.png');
    spawnSync('xcrun', ['simctl', 'io', udid, 'screenshot', foto]);
    const verde = r.status === 0;
    const motivo = verde ? '' : motivoDeFallo(`${r.stdout}\n${r.stderr}`);
    console.log(verde ? 'verde' : `ROJO: ${motivo}`);
    lineas.push({
      id,
      titulo: f.titulo,
      estado: verde ? 'verde' : r.error ? 'no-se-pudo' : 'rojo',
      motivo,
      captura: foto.replace(`${carpeta}/`, ''),
    });
    // Un recorrido que comprueba también otra línea (C1 cubre C2: entra sin pedir código).
    for (const otra of (f.tambien ?? '').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean)) {
      lineas.push({ ...lineas.at(-1), id: otra, titulo: `${LINEAS_LISTA.find(([i]) => i === otra)?.[1] ?? otra} (dentro de ${id})` });
    }
    // Cada línea arranca con la app limpia (sin sesión de la anterior).
    spawnSync('xcrun', ['simctl', 'terminate', udid, APPS[f.app]]);
  }

  // Las líneas de la lista que todavía no tienen recorrido salen en el parte, nunca escondidas.
  if (!solo) {
    const hechas = new Set(lineas.map((l) => l.id));
    for (const [id, titulo] of LINEAS_LISTA) {
      if (!hechas.has(id)) {
        lineas.push({ id, titulo, estado: 'no-se-pudo', motivo: 'todavía sin recorrido automático' });
      }
    }
    lineas.sort((a, b) => a.id.localeCompare(b.id, 'es', { numeric: true }));
  }

  const { verdes, total } = escribirSeccion('apps', {
    empezo,
    termino: new Date().toISOString(),
    sitio: base,
    lineas,
  });
  console.log(`apps: ${verdes} de ${total} en verde. Parte en ${carpeta}`);
}

main().catch((e) => {
  console.error(e);
  escribirSeccion('apps', {
    empezo: new Date().toISOString(),
    termino: new Date().toISOString(),
    lineas: [{ id: 'APPS', titulo: 'Robot de las apps', estado: 'no-se-pudo', motivo: String(e.message || e) }],
  });
  process.exit(1);
});
