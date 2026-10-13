import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Candado C-UBICACION-NO-FRENA (13 oct 2026, lo destapó el recorrido completo): la portada del
 * cliente esperaba la ubicación antes de pedir los restaurantes y, si el teléfono no contestaba,
 * la lista no salía nunca. Ahora la lista sale enseguida y la ubicación tiene un tope.
 */
const leer = (...r: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...r), 'utf8');

describe('la ubicación nunca frena la lista de restaurantes', () => {
  const inicio = leer('apps', 'cliente', 'src', 'Inicio.tsx');
  it('los restaurantes se piden sin esperar la ubicación', () => {
    // La lista se pide (sin await) ANTES de esperar la ubicación.
    expect(inicio).toMatch(/const primera = cargar\(null\);\s*const p = await miUbicacion\(\);/);
    expect(inicio).not.toMatch(/await cargar\(null\)/);
    expect(inicio).not.toMatch(/\?\? \(await miUbicacion\(\)\)/);
  });
  it('la ubicación tiene un tope de espera', () => {
    expect(leer('apps', 'cliente', 'src', 'ubicacion.ts')).toMatch(/conLimite\(/);
  });
});
