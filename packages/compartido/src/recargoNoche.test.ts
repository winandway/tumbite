import { describe, expect, it } from 'vitest';
import {
  type DesgloseViaje,
  conRecargoNoche,
  esHoraDeNoche,
  esquemaTarifaViaje,
  horaLocal,
  recargoNocheDe,
} from './viajes';
import { esDeNoche } from './seguridadViaje';

/**
 * C-RECARGO-NOCHE (25 nov 2026, Richard) — Venezuela (El Vigía) y cualquier ciudad que lo encienda.
 * De noche el precio del viaje sube el porcentaje de la tarifa; la noche va de 21:00 (incluida) a
 * 06:00 (sin incluir) en la hora de la ciudad, la misma de la seguridad del viaje.
 */
const CARACAS = 'America/Caracas'; // UTC-4 todo el año
/** Una hora local de Venezuela (día 26 nov 2026) como instante. */
const enVenezuela = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 26, h + 4, m));

const dg = (total: number): DesgloseViaje => ({
  base: 0,
  distancia: 0,
  tiempo: 0,
  ajusteMinimo: 0,
  dinamico: 0,
  cargoFijo: 0,
  redondeo: 0,
  total,
});

describe('C-RECARGO-NOCHE: las horas de la noche', () => {
  it('20:59 no, 21:00 sí, 05:59 sí, 06:00 no (hora de Venezuela)', () => {
    expect(esHoraDeNoche(enVenezuela(20, 59), CARACAS)).toBe(false);
    expect(esHoraDeNoche(enVenezuela(21, 0), CARACAS)).toBe(true);
    expect(esHoraDeNoche(enVenezuela(23, 30), CARACAS)).toBe(true);
    expect(esHoraDeNoche(enVenezuela(5, 59), CARACAS)).toBe(true);
    expect(esHoraDeNoche(enVenezuela(6, 0), CARACAS)).toBe(false);
    expect(esHoraDeNoche(enVenezuela(12, 0), CARACAS)).toBe(false);
  });

  it('cuenta la hora de la CIUDAD, no la del servidor: las 21:00 de Venezuela son la 01:00 en UTC', () => {
    const t = enVenezuela(21, 0);
    expect(t.getUTCHours()).toBe(1);
    expect(horaLocal(t, CARACAS)).toBe(21);
    // A las 18:00 de Venezuela ya son las 22:00 en UTC: no es de noche en El Vigía.
    expect(esHoraDeNoche(enVenezuela(18, 0), CARACAS)).toBe(false);
    expect(esHoraDeNoche(enVenezuela(18, 0), 'UTC')).toBe(true);
  });

  it('acepta otras horas de la ciudad (también una noche que no cruza la medianoche)', () => {
    expect(esHoraDeNoche(enVenezuela(22, 0), CARACAS, 22, 5)).toBe(true);
    expect(esHoraDeNoche(enVenezuela(21, 30), CARACAS, 22, 5)).toBe(false);
    expect(esHoraDeNoche(enVenezuela(1, 0), CARACAS, 0, 4)).toBe(true);
    expect(esHoraDeNoche(enVenezuela(4, 0), CARACAS, 0, 4)).toBe(false);
    expect(esHoraDeNoche(enVenezuela(1, 0), CARACAS, 3, 3)).toBe(false);
  });

  it('la seguridad del viaje usa la misma noche', () => {
    for (const h of [20, 21, 5, 6])
      expect(esDeNoche(enVenezuela(h, 0), CARACAS)).toBe(esHoraDeNoche(enVenezuela(h, 0), CARACAS));
  });
});

describe('C-RECARGO-NOCHE: el recargo', () => {
  const t = { recargoNochePb: 3000, redondeo: 1 };

  it('de noche suma el 30 % y lo deja en el desglose; de día no cambia nada', () => {
    const noche = conRecargoNoche(dg(300), t, enVenezuela(22), CARACAS);
    expect(noche.total).toBe(390);
    expect(noche.recargoNoche).toBe(90);
    expect(noche.recargoNochePb).toBe(3000);
    const dia = conRecargoNoche(dg(300), t, enVenezuela(10), CARACAS);
    expect(dia).toEqual(dg(300));
    expect(dia.recargoNoche).toBeUndefined();
  });

  it('nunca pasa el precio × 1,30: el recargo se redondea hacia abajo al paso de la ciudad', () => {
    expect(recargoNocheDe(100, t)).toBe(30);
    expect(recargoNocheDe(333, t)).toBe(99);
    // Con un paso de 25 centavos: 1,00 × 0,30 = 0,30 → 0,25 (nunca 0,50).
    expect(recargoNocheDe(100, { recargoNochePb: 3000, redondeo: 25 })).toBe(25);
    for (const p of [100, 150, 200, 299, 1500, 9000]) {
      const total = conRecargoNoche(dg(p), t, enVenezuela(23), CARACAS).total;
      expect(total).toBeLessThanOrEqual(Math.floor(p * 1.3));
      expect(total).toBeGreaterThan(p);
    }
  });

  it('sin recargo en la tarifa (o en 0) no cambia nada, de día ni de noche', () => {
    expect(conRecargoNoche(dg(300), { redondeo: 1 }, enVenezuela(23), CARACAS).total).toBe(300);
    expect(
      conRecargoNoche(dg(300), { recargoNochePb: 0, redondeo: 1 }, enVenezuela(23), CARACAS).total,
    ).toBe(300);
  });

  it('la tarifa acepta el recargo de 0 a 100 % y las horas de 0 a 23', () => {
    const base = { base: 0, porKm: 33, porMinuto: 0, minimo: 100 };
    expect(esquemaTarifaViaje.safeParse({ ...base, recargoNochePb: 3000 }).success).toBe(true);
    expect(esquemaTarifaViaje.safeParse({ ...base, recargoNochePb: 10_001 }).success).toBe(false);
    expect(esquemaTarifaViaje.safeParse({ ...base, nocheDesdeH: 24 }).success).toBe(false);
    expect(esquemaTarifaViaje.safeParse({ ...base, nocheDesdeH: 21, nocheHastaH: 6 }).success).toBe(
      true,
    );
    // C-TABULADOR-VIGIA: el umbral de los precios de la zona puede ser 0.
    expect(esquemaTarifaViaje.parse({ ...base, umbralPrecioZonaPb: 0 }).umbralPrecioZonaPb).toBe(0);
  });
});
