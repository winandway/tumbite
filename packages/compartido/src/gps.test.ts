import { describe, expect, it } from 'vitest';
import { llegadaConfiable, saltoImposible } from './gps';


const casa = { lat: 25.7725, lng: -80.187 };
const t0 = 1_000_000_000;
const en = (lat: number, lng: number, precisionM: number, s: number) => ({
  lat,
  lng,
  precisionM,
  en: t0 + s * 1000,
});

describe('llegada confiable (C-GPS-SERIO)', () => {
  it('con dos lecturas precisas y coherentes en la puerta, llegó', () => {
    const r = llegadaConfiable(
      [en(25.7726, -80.1871, 12, 0), en(25.7725, -80.187, 9, 10)],
      casa,
      200,
      t0 + 12_000,
    );
    expect(r).toEqual({ llego: true, motivo: 'ok' });
  });
  it('una sola lectura no alcanza', () => {
    expect(llegadaConfiable([en(25.7725, -80.187, 9, 0)], casa, 200, t0 + 1000).motivo).toBe(
      'sin-lecturas',
    );
  });
  it('lecturas imprecisas (edificios) no cuentan', () => {
    expect(
      llegadaConfiable(
        [en(25.7725, -80.187, 150, 0), en(25.7725, -80.187, 9, 5)],
        casa,
        200,
        t0 + 6000,
      ).motivo,
    ).toBe('imprecisa');
  });
  it('dos lecturas que no coinciden entre sí no cuentan', () => {
    expect(
      llegadaConfiable([en(25.7725, -80.187, 9, 0), en(25.775, -80.19, 9, 5)], casa, 200, t0 + 6000)
        .motivo,
    ).toBe('incoherente');
  });
  it('lecturas viejas no cuentan', () => {
    expect(
      llegadaConfiable(
        [en(25.7725, -80.187, 9, 0), en(25.7725, -80.187, 9, 5)],
        casa,
        200,
        t0 + 400_000,
      ).motivo,
    ).toBe('sin-lecturas');
  });
  it('un salto imposible delata un GPS simulado', () => {
    expect(saltoImposible(en(25.7725, -80.187, 9, 0), en(25.9, -80.3, 9, 5))).toBe(true);
    expect(saltoImposible(en(25.7725, -80.187, 9, 0), en(25.7735, -80.188, 9, 5))).toBe(false);
  });

});

describe('GPS como los estudios (G2: 30 m, unos 80 m y ubicación simulada)', () => {
  it('una lectura de ±45 m ya no alcanza: se exigen 30 m', () => {
    expect(
      llegadaConfiable(
        [en(25.7725, -80.187, 45, 0), en(25.7725, -80.187, 9, 5)],
        casa,
        undefined,
        t0 + 6000,
      ).motivo,
    ).toBe('imprecisa');
  });
  it('a unos 120 m de la puerta todavía no llegó (radio de la puerta, unos 80 m)', () => {
    // 0,0011 grados de latitud son unos 122 m.
    expect(
      llegadaConfiable(
        [en(25.7736, -80.187, 9, 0), en(25.7736, -80.187, 9, 5)],
        casa,
        undefined,
        t0 + 6000,
      ).motivo,
    ).toBe('lejos');
  });
  it('a unos 50 m de la puerta sí llegó', () => {
    expect(
      llegadaConfiable(
        [en(25.77295, -80.187, 9, 0), en(25.77295, -80.187, 9, 5)],
        casa,
        undefined,
        t0 + 6000,
      ),
    ).toEqual({ llego: true, motivo: 'ok' });
  });
  it('una lectura marcada como simulada por el celular nunca cuenta', () => {
    expect(
      llegadaConfiable(
        [{ ...en(25.7725, -80.187, 5, 0), simulada: true }, en(25.7725, -80.187, 9, 5)],
        casa,
        undefined,
        t0 + 6000,
      ).motivo,
    ).toBe('simulada');
  });
});
