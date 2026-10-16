import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Candado C-UBICACION-NO-FRENA (13 oct 2026, lo destapó el recorrido completo): la portada del
 * cliente esperaba la ubicación antes de pedir los restaurantes y, si el teléfono no contestaba,
 * la lista no salía nunca. Ahora la lista sale enseguida y la ubicación tiene un tope.
 * Desde el Hito 1 (C-CATALOGO-ESTABLE) la lista vive en comida/useRestaurantes.ts, compartida por
 * el inicio y Comida.
 */
const leer = (...r: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...r), 'utf8');

describe('la ubicación nunca frena la lista de restaurantes', () => {
  const gancho = leer('apps', 'cliente', 'src', 'comida', 'useRestaurantes.ts');
  it('los restaurantes se piden sin esperar la ubicación', () => {
    // La lista se pide (sin await) ANTES de esperar el GPS.
    expect(gancho).toMatch(
      /const primera = lista\.cargar\(guardado\);\s*const gps = await gpsReciente\(\);/,
    );
    expect(gancho).not.toMatch(/await lista\.cargar\(guardado\)/);
    expect(gancho).not.toMatch(/\?\? \(await (miUbicacion|gpsReciente)\(\)\)/);
  });
  it('el inicio y Comida usan esa misma lista', () => {
    for (const pantalla of [['Inicio.tsx'], ['app', 'restaurants.tsx']])
      expect(leer('apps', 'cliente', 'src', ...pantalla)).toMatch(/useRestaurantes\(/);
  });
  it('la ubicación tiene un tope de espera', () => {
    expect(leer('apps', 'cliente', 'src', 'ubicacion.ts')).toMatch(/conLimite\(/);
  });
});
