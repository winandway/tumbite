import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-BOTON-EN-FILA (15 nov 2026, Richard lo vio en Driver para iPhone) — todos los países. El botón
 * «Verificar», al lado de la casilla del número del pedido, vivía en una caja de 120 de ancho y en
 * el iPhone partía la palabra: «Verifica» arriba y «r» abajo. Ningún `Boton` de las apps va dentro
 * de una caja de ancho fijo: al lado de una casilla se usa `enFila` (una línea, el ancho de su
 * palabra, también en inglés y con letra grande).
 */
const RAIZ = join(__dirname, '..', '..', '..');
const CARPETAS = [
  'apps/cliente/src',
  'apps/repartidor/src',
  'apps/restaurante/src',
  'packages/movil/src',
];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return n === 'node_modules' ? [] : archivos(ruta);
    return /\.tsx$/.test(n) ? [ruta] : [];
  });
}

describe('candado: un botón al lado de una casilla nunca parte su palabra', () => {
  it('ningún Boton vive dentro de una caja de ancho fijo', () => {
    const malos: string[] = [];
    for (const carpeta of CARPETAS)
      for (const f of archivos(join(RAIZ, carpeta))) {
        const codigo = readFileSync(f, 'utf8');
        if (/<View style=\{\{[^}]*\bwidth: \d+[^}]*\}\}>\s*<Boton\b/.test(codigo))
          malos.push(f.replace(RAIZ, ''));
      }
    expect(malos).toEqual([]);
  });

  it('la pieza del botón en fila va en una sola línea y no se encoge', () => {
    const ui = readFileSync(join(RAIZ, 'packages/movil/src/ui.tsx'), 'utf8');
    expect(ui).toMatch(/numberOfLines=\{enFila \? 1 : undefined\}/);
    expect(ui).toMatch(/botonEnFila: \{[^}]*flexShrink: 0[^}]*\}/);
    expect(ui).not.toMatch(/botonEnFila: \{[^}]*\bwidth:/);
  });

  it('«Verificar» de Driver y «Enviar» del chat usan el botón en fila', () => {
    const driver = readFileSync(join(RAIZ, 'apps/repartidor/src/Inicio.tsx'), 'utf8');
    expect(driver).toMatch(/texto=\{t\.verificar\}[\s\S]{0,160}\benFila\b/);
    const chat = readFileSync(join(RAIZ, 'packages/movil/src/ChatPedido.tsx'), 'utf8');
    expect(chat).toMatch(/texto=\{t\.enviar\}[\s\S]{0,160}\benFila\b/);
  });
});
