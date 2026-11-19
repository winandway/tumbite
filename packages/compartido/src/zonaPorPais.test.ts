import { describe, expect, it } from 'vitest';
import { zonaDeFabrica } from './zonaPorPais';
import { CIUDAD_ICA } from './perfilPeru';

describe('C-ZONA-POR-PAIS: una ciudad nueva nace con la moneda y la hora de su país', () => {
  it('Perú en soles y hora de Lima, igual que la ciudad de Ica', () => {
    expect(zonaDeFabrica('pe')).toEqual({
      moneda: CIUDAD_ICA.moneda,
      zonaHoraria: CIUDAD_ICA.zonaHoraria,
    });
  });
  it('Venezuela cobra en dólares con hora de Caracas; lo desconocido, como Estados Unidos', () => {
    expect(zonaDeFabrica('VE')).toEqual({ moneda: 'USD', zonaHoraria: 'America/Caracas' });
    expect(zonaDeFabrica('US')).toEqual({ moneda: 'USD', zonaHoraria: 'America/New_York' });
    expect(zonaDeFabrica('ZZ')).toEqual(zonaDeFabrica('US'));
    expect(zonaDeFabrica(null)).toEqual(zonaDeFabrica('US'));
  });
});
