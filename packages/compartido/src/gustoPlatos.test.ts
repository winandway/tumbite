import { describe, expect, it } from 'vitest';
import { GUSTO_MINIMO_VOTOS, platosDelPedido, resumenGusto, textoGusto } from './gustoPlatos';

describe('gusto por plato (C-GUSTO-PLATOS)', () => {
  it('con menos de 5 votos no muestra porcentaje', () => {
    const votos = [1, 1, 1, 0].map((g) => ({ platoId: 'a', gusta: g }));
    expect(GUSTO_MINIMO_VOTOS).toBe(5);
    expect(resumenGusto(votos)).toEqual({});
  });

  it('redondea el porcentaje de pulgares arriba y cuenta los votos', () => {
    const votos = [
      ...[1, 1, 1, 1, 1, 1, 0].map((g) => ({ platoId: 'a', gusta: g })),
      ...[0, 0, 0, 0, 0].map((g) => ({ platoId: 'b', gusta: g })),
    ];
    expect(resumenGusto(votos)).toEqual({
      a: { porcentaje: 86, votos: 7 },
      b: { porcentaje: 0, votos: 5 },
    });
  });

  it('solo acepta platos que estaban en el pedido', () => {
    const lineas = JSON.stringify([{ platoId: 'a' }, { platoId: 'b' }, { otro: 1 }]);
    expect([...platosDelPedido(lineas)].sort()).toEqual(['a', 'b']);
    expect(platosDelPedido('no es json').size).toBe(0);
  });

  it('el texto sale en los dos idiomas', () => {
    expect(textoGusto({ porcentaje: 92, votos: 40 }, 'es')).toBe('92 % (40)');
    expect(textoGusto({ porcentaje: 92, votos: 40 }, 'en')).toBe('92% (40)');
  });
});
