import { describe, expect, it } from 'vitest';
import { CIUDAD_EL_VIGIA, CIUDAD_PRUEBAS_EL_VIGIA } from './index';

/**
 * C-EL-VIGIA-UNA-ZONA (14 nov 2026, Venezuela): Comida, Moto, Carro y Envíos usan UNA sola zona de
 * pruebas en El Vigía (VE-MER-ELVIGIA). La integración había dejado una segunda (VE-VIG-CENTRO)
 * para Carro y Moto: dos ciudades distintas en el mismo lugar.
 */
describe('C-EL-VIGIA-UNA-ZONA', () => {
  it('Carro y Moto usan la misma zona que Comida', () => {
    expect(CIUDAD_EL_VIGIA.id).toBe('VE-MER-ELVIGIA');
    expect(CIUDAD_EL_VIGIA).toEqual(CIUDAD_PRUEBAS_EL_VIGIA);
    expect([CIUDAD_EL_VIGIA.lat, CIUDAD_EL_VIGIA.lng, CIUDAD_EL_VIGIA.radioKm]).toEqual([
      8.6219, -71.6506, 15,
    ]);
  });
});
