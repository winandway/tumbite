import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { avisoViajeLargo, KM_VIAJE_LARGO } from './viajeLargo';

/**
 * C-VIAJE-LARGO-A-LA-VISTA (25 nov 2026) — todos los países. Con el destino en cualquier punto del
 * país (C-DESTINO-EN-EL-PAIS), la oferta avisa en grande la distancia total y a dónde va, antes de
 * aceptar. En ROJO antes del cambio: no existían el aviso ni su lugar en la oferta.
 */
describe('C-VIAJE-LARGO-A-LA-VISTA', () => {
  it('un viaje de 45 km avisa «Viaje largo: 45 km» y a dónde va; en inglés, en millas', () => {
    expect(avisoViajeLargo(45_000, 'Destino del viaje', 'es')).toEqual({
      titulo: 'Viaje largo: 45 km',
      hasta: 'Hasta: Destino del viaje',
    });
    expect(avisoViajeLargo(45_000, 'Destino del viaje', 'en')).toEqual({
      titulo: 'Long trip: 28 mi',
      hasta: 'To: Destino del viaje',
    });
  });

  it('un viaje corto o sin distancia no avisa nada', () => {
    expect(avisoViajeLargo(KM_VIAJE_LARGO * 1000 - 1, 'Cerca', 'es')).toBeNull();
    expect(avisoViajeLargo(null, 'Cerca', 'es')).toBeNull();
  });

  it('la oferta lo pinta justo debajo de lo que gana, antes del mapa y de la ruta', () => {
    const s = readFileSync(join(import.meta.dirname, 'OfertaViaje.tsx'), 'utf8');
    const ganancia = s.indexOf('testID="oferta-viaje-ganancia"');
    const largo = s.indexOf('testID="oferta-viaje-largo"');
    expect(largo).toBeGreaterThan(ganancia);
    expect(largo).toBeLessThan(s.indexOf('testID="oferta-viaje-mapa"'));
    expect(s).toContain('avisoViajeLargo(');
  });
});
