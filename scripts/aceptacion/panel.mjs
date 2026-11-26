#!/usr/bin/env node
/**
 * C-ROBOT-PANEL (26 nov 2026, Gerencia con autorización de Richard). El robot del panel: corre las
 * líneas A1 a A9 de la lista de aceptación (sección 3) con Playwright contra el SITIO DE PRUEBAS y
 * deja el parte en registros/aceptacion/<fecha>/panel.json y panel.md, con la captura de cada línea
 * en la misma carpeta. Formato común: { seccion: "panel", empezo, termino, lineas: [{ id, titulo,
 * estado: "verde"|"rojo"|"no-se-pudo", motivo, captura }] }.
 *
 * Uso: node scripts/aceptacion/panel.mjs
 * (ACEPTACION_URL solo admite el sitio de pruebas; la clave de Soporte se lee del archivo privado.)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  RAIZ,
  carpetaCorrida,
  cuentasDemo,
  escribirSeccion,
  fechaCorrida,
  sitioDePruebas,
} from './comun.mjs';

/** Las nueve líneas de la sección 3, con el título de la lista (por si una no llegó a correr). */
const LINEAS = [
  [
    'A1',
    'Ver en Verificaciones a un conductor nuevo con sus papeles y su moto en la misma pantalla',
  ],
  ['A2', 'Aprobar o rechazar un papel y la moto, con motivo'],
  ['A3', 'Usar «Usar esta fecha» en la fecha de nacimiento leída del documento'],
  ['A4', 'Buscar por nombre, teléfono, placa o código desde la primera letra'],
  ['A5', 'Mandar un aviso a una zona (incluido el WhatsApp «lo que te falta») con vista previa'],
  ['A6', 'Abrir la campana'],
  ['A7', 'Ver los que esperan por ciudad («Maracaibo: 14 esperando»)'],
  ['A8', 'Editar un precio fijo del tabulador'],
  ['A9', 'Cargar saldo a un conductor o activar un regalo automático por ciudad'],
];

const url = sitioDePruebas();
const fecha = fechaCorrida();
const carpeta = carpetaCorrida(fecha);
const informe = join(carpeta, 'panel-playwright.json');
const clave = cuentasDemo()['demo.soporte@ejemplo.com'];
const empezo = new Date().toISOString();

let lineas;
if (!clave) {
  lineas = LINEAS.map(([id, titulo]) => ({
    id,
    titulo,
    estado: 'no-se-pudo',
    motivo:
      'no encontré la clave de la cuenta de Soporte de pruebas en el archivo privado de cuentas',
    captura: null,
  }));
} else {
  for (const [id] of LINEAS) rmSync(join(carpeta, `${id}.png`), { force: true });
  rmSync(informe, { force: true });
  const r = spawnSync(
    'npx',
    ['playwright', 'test', '-c', 'playwright.aceptacion-panel.config.ts'],
    {
      cwd: RAIZ,
      stdio: 'inherit',
      env: {
        ...process.env,
        ACEPTACION_URL: url,
        ACEPTACION_CARPETA: carpeta,
        ACEPTACION_JSON: informe,
        ACEPTACION_CLAVE_SOPORTE: clave,
        VUELTA_PRUEBAS: process.env.VUELTA_PRUEBAS || `robot-panel-${fecha}`,
      },
    },
  );
  lineas = leerInforme(r.status);
}

const { verdes, total } = escribirSeccion(
  'panel',
  { empezo, termino: new Date().toISOString(), lineas },
  fecha,
);
console.log(`\nParte del panel: ${verdes} de ${total} en verde → ${join(carpeta, 'panel.md')}`);

/** Saca de lo que dejó Playwright el estado, el motivo en palabras y la captura de cada línea. */
function leerInforme(codigo) {
  const pruebas = [];
  if (existsSync(informe)) {
    const recorrer = (s) => {
      for (const sp of s.specs ?? [])
        for (const t of sp.tests ?? []) pruebas.push({ titulo: sp.title, t });
      for (const hijo of s.suites ?? []) recorrer(hijo);
    };
    for (const s of JSON.parse(readFileSync(informe, 'utf8')).suites ?? []) recorrer(s);
  }
  return LINEAS.map(([id, titulo]) => {
    const p = pruebas.find((x) => x.titulo.startsWith(`${id} `));
    const captura = existsSync(join(carpeta, `${id}.png`)) ? join(carpeta, `${id}.png`) : null;
    if (!p)
      return {
        id,
        titulo,
        estado: 'no-se-pudo',
        motivo: `la prueba no llegó a correr (Playwright terminó con código ${codigo})`,
        captura,
      };
    const res = p.t.results?.at(-1) ?? {};
    const notas = p.t.annotations ?? res.annotations ?? [];
    const nota = (tipo) =>
      notas
        .filter((a) => a.type === tipo)
        .map((a) => a.description)
        .at(-1);
    const error = limpiar(res.error?.message ?? res.errors?.[0]?.message ?? '');
    // Lo que el sitio hizo de raro sin ser la línea (por ejemplo, una recarga) se dice, no se esconde.
    const tropiezos = [
      ...new Set(notas.filter((a) => a.type === 'tropiezo').map((a) => a.description)),
    ];
    const con = (m) =>
      tropiezos.length ? `${m}${m ? ' ' : ''}(Ojo: ${tropiezos.join('; ')}.)` : m;
    if (res.status === 'passed')
      return {
        id,
        titulo,
        estado: 'verde',
        motivo: con(nota('motivo') ?? ''),
        captura: nota('captura') ?? captura,
      };
    if (/NO-SE-PUDO:/.test(error))
      return {
        id,
        titulo,
        estado: 'no-se-pudo',
        motivo: con(error.replace(/^.*NO-SE-PUDO:\s*/s, '')),
        captura: nota('captura') ?? captura,
      };
    return {
      id,
      titulo,
      estado: 'rojo',
      motivo: con(error || `la prueba terminó en «${res.status ?? 'desconocido'}»`),
      captura: nota('captura') ?? captura,
    };
  });
}

/** El primer renglón útil del error, sin colores ni el detalle técnico de Playwright. */
function limpiar(texto) {
  // eslint-disable-next-line no-control-regex
  const plano = texto.replace(/\u001b\[[0-9;]*m/g, '');
  const lineas = plano
    .split('\n')
    .map((l) => l.trim().replace(/^(Error|NoSePudo):\s*/, ''))
    .filter(Boolean);
  // El mensaje propio de la prueba (en palabras) va antes del detalle técnico de Playwright.
  const tecnico =
    /^expect\(|^Expected|^Received|^Call log|^Timeout \d+ms|^Locator:|^element\(s\)|^- /;
  const primera = lineas.find((l) => !tecnico.test(l));
  // Sin mensaje propio, se dice qué se esperaba ver, en palabras sencillas.
  const loc = lineas.find((l) => l.startsWith('Locator:'));
  return (
    primera ?? (loc ? `no apareció en pantalla lo esperado (${loc.slice(8).trim()})` : '')
  ).slice(0, 400);
}
