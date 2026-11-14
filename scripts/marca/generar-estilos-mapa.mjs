#!/usr/bin/env node
// C-MAPA-DIA-NOCHE (14 nov 2026) — todos los países. Escribe en identidad-divoox/ los estilos del
// mapa de Google de Divoox (día y noche, formato clásico y formato de la consola de Google) desde
// la única fuente: packages/compartido/src/estiloMapaDivoox.ts. Una prueba exige que sean iguales.
// Uso: node scripts/marca/generar-estilos-mapa.mjs   (Node 24 lee el .ts directamente)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { ARCHIVOS_ESTILO_MAPA } = await import(
  join(RAIZ, 'packages/compartido/src/estiloMapaDivoox.ts')
);
for (const [nombre, estilo] of Object.entries(ARCHIVOS_ESTILO_MAPA)) {
  // Los nombres salen de una lista fija del código, no de fuera.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  writeFileSync(join(RAIZ, 'identidad-divoox', nombre), JSON.stringify(estilo, null, 2) + '\n');
  console.log(`escrito identidad-divoox/${nombre}`);
}
