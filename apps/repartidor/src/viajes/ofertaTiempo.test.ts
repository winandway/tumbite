import { describe, expect, it } from 'vitest';
import { venceOferta } from './ofertaTiempo';

/**
 * C-OFERTA-TIEMPO-REAL (revisor, 18 nov): la oferta cuenta desde que llegó con los segundos del
 * servidor, menos un segundo de margen (la respuesta tardó en llegar); sin ese dato, su hora.
 */
describe('cuándo vence la oferta en el teléfono', () => {
  it('con los segundos del servidor, desde que llegó y con un segundo de margen', () => {
    expect(venceOferta({ segundosRestantes: 30, expiraEn: '2000-01-01 00:00:00' }, 1_000_000)).toBe(
      1_029_000,
    );
  });
  it('nunca antes de llegar', () => {
    expect(venceOferta({ segundosRestantes: 0, expiraEn: '2000-01-01 00:00:00' }, 5_000)).toBe(
      5_000,
    );
  });
  it('sin los segundos (servidor viejo), su hora de vencimiento', () => {
    expect(venceOferta({ expiraEn: '2026-11-18 10:00:30' }, 0)).toBe(
      Date.parse('2026-11-18T10:00:30Z'),
    );
  });
});
