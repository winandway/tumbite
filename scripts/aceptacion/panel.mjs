#!/usr/bin/env node
/**
 * C-ROBOT-PANEL (26 nov 2026, Gerencia con autorización de Richard). El robot del panel: corre las
 * líneas A1 a A9 de la lista de aceptación (sección 3) con Playwright (e2e/aceptacion/panel) contra el
 * SITIO DE PRUEBAS, con un conductor y un pasajero de robot creados por la API. Cada línea se anota en
 * registros/aceptacion/<fecha>/panel.jsonl con su captura, y aquí se junta en panel.json y panel.md.
 * Una línea en rojo es un fallo del producto: se dice, no se arregla.
 *
 * Uso: node scripts/aceptacion/panel.mjs
 */
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { anotar, carpetaParte, cerrarSeccion } from './base-pruebas.mjs';
import { RAIZ, fechaCorrida, sitioDePruebas } from './comun.mjs';

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
const empezo = new Date().toISOString();
rmSync(join(carpetaParte(), 'panel.jsonl'), { force: true });
const r = spawnSync('npx', ['playwright', 'test', '-c', 'playwright.aceptacion-panel.config.ts'], {
  cwd: RAIZ,
  stdio: 'inherit',
  env: {
    ...process.env,
    ACEPTACION_URL: url,
    VUELTA_PRUEBAS: process.env.VUELTA_PRUEBAS || `robot-panel-${fecha}`,
  },
});
// Si Playwright se cae antes de empezar (por ejemplo, no pudo crear el conductor), se dice en el parte.
if (r.status !== 0)
  anotar('panel', 'PANEL', 'rojo', `Playwright terminó con código ${r.status}: mira noche.log`);
const { verdes, total, carpeta } = cerrarSeccion('panel', Object.fromEntries(LINEAS), {
  empezo,
  sitio: url,
});
console.log(`\nParte del panel: ${verdes} de ${total} en verde → ${join(carpeta, 'panel.md')}`);
