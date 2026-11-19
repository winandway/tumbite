import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEXTOS_VIAJE } from './textos';

/**
 * C-OFERTA-SIN-COBRO (19 nov 2026) — todos los países. Cuando el regalo de Divoox cubre todo el
 * viaje, la oferta mostraba «Cobras en efectivo al terminar $0.00 / Bs. 0,00» en cifra grande y
 * verde: un cero protagonista que confunde. Ahora dice en palabras que no cobra nada en mano (lo que
 * paga Divoox sigue en su línea aparte). En ROJO antes del cambio: no existían el texto ni la rama.
 */
describe('C-OFERTA-SIN-COBRO · con el viaje cubierto por el regalo no se pinta un cero grande', () => {
  const s = readFileSync(join(import.meta.dirname, 'OfertaViaje.tsx'), 'utf8');
  it('la oferta de viaje no pinta el cobro grande cuando el monto en mano es cero', () => {
    expect(s).toMatch(/oferta\.enMano\.monto > 0 \?/);
    expect(s).toMatch(/testID="oferta-viaje-sin-cobro"/);
    expect(s).toMatch(/t\.noCobrasEnMano/);
  });
  it('la pantalla del viaje tampoco pinta un cero grande', () => {
    const v = readFileSync(join(import.meta.dirname, 'ViajeActivo.tsx'), 'utf8');
    expect(v).toMatch(/\(cobroEnMano\(false\)\?\.monto \?\? 0\) > 0 \?/);
    expect(v).toMatch(/testID="viaje-sin-cobro"/);
  });
  it('el texto existe en español y en inglés', () => {
    expect(TEXTOS_VIAJE.es.oferta.noCobrasEnMano).toMatch(/No cobras nada en mano/);
    expect(TEXTOS_VIAJE.en.oferta.noCobrasEnMano).toMatch(/Nothing to collect/);
  });
});
