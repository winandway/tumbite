// C-TUMBITE-REDIRIGE (27 nov 2026, Richard): YaDominios Cloud sirve los archivos fijos ANTES que el
// servidor. Con las páginas (.html) en la raíz del paquete, tumbite.com/, tumbite.com/app/ y todas las
// páginas prerenderizadas respondían 200 sin pasar nunca por el 301 a divoox.com, y Google las
// indexaba como copia. Este paso mueve TODAS las páginas a la carpeta interna «_paginas/» (misma ruta
// por dentro): la plataforma ya no encuentra una página en la dirección pública, la petición llega al
// servidor, y el servidor redirige (tumbite.com) o la entrega desde «_paginas/» (divoox.com).
// Los demás archivos (scripts, estilos, imágenes, robots.txt, sitemap.xml) se quedan donde están.
// Uso: node scripts/paginas-por-servidor.mjs <carpeta del paquete>
import { mkdirSync, readdirSync, renameSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CARPETA = '_paginas';

/** Mueve cada .html del paquete a <paquete>/_paginas/<misma ruta>. Devuelve cuántas movió. */
export function moverPaginas(paquete) {
  const destinoRaiz = join(paquete, CARPETA);
  const paginas = [];
  const recorrer = (d) => {
    for (const n of readdirSync(d)) {
      const r = join(d, n);
      if (r === destinoRaiz) continue;
      if (statSync(r).isDirectory()) recorrer(r);
      else if (n.endsWith('.html')) paginas.push(r);
    }
  };
  recorrer(paquete);
  for (const origen of paginas) {
    const destino = join(destinoRaiz, relative(paquete, origen));
    mkdirSync(dirname(destino), { recursive: true });
    renameSync(origen, destino);
  }
  return paginas.length;
}

/** Las páginas que quedaron fuera de «_paginas/» (debe ser ninguna). */
export function paginasSueltas(paquete) {
  const sueltas = [];
  const recorrer = (d) => {
    for (const n of readdirSync(d)) {
      const r = join(d, n);
      if (r === join(paquete, CARPETA)) continue;
      if (statSync(r).isDirectory()) recorrer(r);
      else if (n.endsWith('.html')) sueltas.push(relative(paquete, r));
    }
  };
  recorrer(paquete);
  return sueltas;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const paquete = process.argv[2];
  if (!paquete) {
    console.error('Uso: node scripts/paginas-por-servidor.mjs <carpeta>');
    process.exit(2);
  }
  const n = moverPaginas(paquete);
  const sueltas = paginasSueltas(paquete);
  if (n === 0 || sueltas.length) {
    console.error(
      `paginas-por-servidor: ${n} movidas; sueltas: ${sueltas.join(', ') || 'ninguna'}`,
    );
    process.exit(1);
  }
  console.log(`paginas-por-servidor: ${n} páginas en ${CARPETA}/ (las sirve el servidor)`);
}
