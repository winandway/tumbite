import { describe, expect, it } from 'vitest';
import { patronVibracionOferta } from './accesibilidadRepartidor';

describe('C-AUDITIVA-REPARTIDOR: vibración de las ofertas', () => {
  it('con dificultad auditiva la oferta vibra más largo y más veces', () => {
    const normal = patronVibracionOferta(false);
    const fuerte = patronVibracionOferta(true);
    expect(normal).toEqual([0, 400, 200, 400]);
    const suma = (p: number[]) => p.reduce((a, b) => a + b, 0);
    expect(suma(fuerte)).toBeGreaterThan(suma(normal) * 2);
    expect(fuerte.length).toBeGreaterThan(normal.length);
  });
});
