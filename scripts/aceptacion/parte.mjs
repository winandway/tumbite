#!/usr/bin/env node
/**
 * El parte de la mañana de la lista de aceptación (C-ROBOT-NOCTURNO). Junta lo que dejaron los tres
 * robots en registros/aceptacion/<fecha>/ y escribe ~/Gerencia/partes/ACEPTACION-<fecha>.md, en
 * palabras, línea por línea. Una sección que no corrió sale como «no corrió», nunca como verde.
 * La corre la noche al terminar y otra vez a las 7:00 (por si la noche se cortó).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { carpetaCorrida, fechaCorrida } from './comun.mjs';

const fecha = fechaCorrida();
const carpeta = carpetaCorrida(fecha);
const SECCIONES = [
  ['apps', 'Apps (conductor y pasajero, en el iPhone simulado)'],
  ['panel', 'Panel de control'],
  ['camila', 'Examen de Camila'],
];

const icono = (e) => (e === 'verde' ? '🟢' : e === 'rojo' ? '🔴' : '⚪');
const salida = [`# Parte de la lista de aceptación — ${fecha}`, ''];
const resumen = [];
for (const [clave, nombre] of SECCIONES) {
  const ruta = join(carpeta, `${clave}.json`);
  if (!existsSync(ruta)) {
    resumen.push(`- ⚪ ${nombre}: no corrió esta noche.`);
    continue;
  }
  const d = JSON.parse(readFileSync(ruta, 'utf8'));
  const verdes = d.lineas.filter((l) => l.estado === 'verde').length;
  const rojas = d.lineas.filter((l) => l.estado === 'rojo').length;
  resumen.push(
    `- ${rojas ? '🔴' : verdes === d.lineas.length ? '🟢' : '⚪'} ${nombre}: ${verdes} de ${d.lineas.length} en verde${rojas ? `, ${rojas} en rojo` : ''}${typeof d.nota === 'number' ? ` (nota ${d.nota} de ${d.de ?? 50})` : ''}.`,
  );
  salida.push(`## ${nombre}`, '');
  for (const l of d.lineas) {
    salida.push(
      `- ${icono(l.estado)} **${l.id}** ${l.titulo}${l.estado === 'verde' ? '' : ` — ${l.motivo || 'sin motivo'}`}${l.captura ? `  \n  captura: ${isAbsolute(l.captura) ? l.captura : join(carpeta, l.captura)}` : ''}`,
    );
  }
  salida.push('');
}
salida.splice(2, 0, ...resumen, '', `Capturas y detalle: ${carpeta}`, '');
const texto = salida.join('\n');
writeFileSync(join(carpeta, 'PARTE.md'), texto);
const partes = process.env.ACEPTACION_PARTES || join(homedir(), 'Gerencia/partes');
mkdirSync(partes, { recursive: true });
writeFileSync(join(partes, `ACEPTACION-${fecha}.md`), texto);
console.log(texto);
