import { describe, expect, it } from 'vitest';
import {
  type TarifaViaje,
  cargoEspera,
  cotizarViaje,
  esquemaCotizarViaje,
  esquemaTarifaViaje,
  estimarRuta,
} from './viajes';

const t = (x: Partial<TarifaViaje> = {}): TarifaViaje =>
  esquemaTarifaViaje.parse({ base: 100, porKm: 50, porMinuto: 10, minimo: 300, ...x });

describe('C-VIAJE-PRECIO-FIJO: precio fijo de un viaje', () => {
  it('suma base, kilómetros y minutos', () => {
    const d = cotizarViaje(t(), { distanciaM: 10_000, duracionS: 1200 });
    expect(d).toEqual({
      base: 100,
      distancia: 500,
      tiempo: 200,
      ajusteMinimo: 0,
      dinamico: 0,
      total: 800,
    });
  });

  it('un viaje corto cuesta el mínimo, con el ajuste a la vista', () => {
    const d = cotizarViaje(t(), { distanciaM: 1000, duracionS: 120 });
    expect(d.base + d.distancia + d.tiempo).toBe(170);
    expect(d.ajusteMinimo).toBe(130);
    expect(d.total).toBe(300);
  });

  it('el recargo dinámico nunca pasa el tope de la tarifa', () => {
    const sinTope = cotizarViaje(t(), { distanciaM: 10_000, duracionS: 1200 }, 30_000);
    expect(sinTope.dinamico).toBe(0);
    const conTope = cotizarViaje(
      t({ topeDinamicoPb: 15_000 }),
      { distanciaM: 10_000, duracionS: 1200 },
      30_000,
    );
    expect(conTope.dinamico).toBe(400);
    expect(conTope.total).toBe(1200);
    // Un multiplicador por debajo de 1 no abarata (eso sería una promoción, otra cosa).
    expect(cotizarViaje(t(), { distanciaM: 10_000, duracionS: 1200 }, 5_000).total).toBe(800);
  });

  it('redondea al paso de la ciudad (pesos de cien en cien)', () => {
    const cop = t({ base: 2000, porKm: 750, porMinuto: 120, minimo: 4500, redondeo: 100 });
    const d = cotizarViaje(cop, { distanciaM: 5300, duracionS: 790 });
    expect(d.total % 100).toBe(0);
    expect(d.total).toBe(Math.round((2000 + 3975 + 1580) / 100) * 100);
  });

  it('rechaza distancias o tiempos que no son enteros', () => {
    expect(() => cotizarViaje(t(), { distanciaM: -1, duracionS: 10 })).toThrow();
    expect(() => cotizarViaje(t(), { distanciaM: 10, duracionS: 1.5 })).toThrow();
  });

  it('la tarifa no admite montos negativos ni topes absurdos', () => {
    expect(
      esquemaTarifaViaje.safeParse({ base: -1, porKm: 1, porMinuto: 1, minimo: 1 }).success,
    ).toBe(false);
    expect(
      esquemaTarifaViaje.safeParse({
        base: 1,
        porKm: 1,
        porMinuto: 1,
        minimo: 1,
        topeDinamicoPb: 50_000,
      }).success,
    ).toBe(false);
    expect(esquemaTarifaViaje.parse({ base: 1, porKm: 1, porMinuto: 1, minimo: 1 })).toMatchObject({
      esperaGratisS: 300,
      cancelacionGratisS: 120,
      topeDinamicoPb: 10_000,
      redondeo: 1,
    });
  });
});

describe('ruta estimada y espera', () => {
  it('estima la distancia por calle y un tiempo mínimo de un minuto', () => {
    const a = { lat: 4.65, lng: -74.05 };
    const r = estimarRuta('moto', a, { lat: 4.66, lng: -74.05 });
    expect(r.distanciaM).toBeGreaterThan(1400);
    expect(r.distanciaM).toBeLessThan(1500);
    expect(estimarRuta('moto', a, a)).toEqual({ distanciaM: 0, duracionS: 60 });
  });

  it('la espera es gratis hasta el límite y luego se cobra por minuto empezado', () => {
    const x = t({ esperaGratisS: 300, porMinutoEspera: 25 });
    expect(cargoEspera(x, 300)).toBe(0);
    expect(cargoEspera(x, 301)).toBe(25);
    expect(cargoEspera(x, 420)).toBe(50);
  });

  it('la solicitud exige servicio de viaje y direcciones', () => {
    const p = { lat: 1, lng: 1, direccion: 'Calle 1' };
    expect(esquemaCotizarViaje.safeParse({ servicio: 'moto', origen: p, destino: p }).success).toBe(
      true,
    );
    expect(
      esquemaCotizarViaje.safeParse({ servicio: 'comida', origen: p, destino: p }).success,
    ).toBe(false);
  });
});
