import { describe, expect, it } from 'vitest';
import {
  efectivoEnMano,
  enDolares,
  esquemaCobroEntrega,
  leerTasaBcv,
  validarCobro,
} from './flexCobro';

const c = (x: Record<string, unknown>) =>
  esquemaCobroEntrega.parse({ metodo: 'efectivo_usd', monto: 2500, moneda: 'USD', ...x });

describe('C-FLEX-COBRO · Venezuela: cobro contra entrega', () => {
  it('el monto en la misma moneda tiene que estar completo (el vuelto es aparte)', () => {
    expect(validarCobro({ monto: 2500, moneda: 'USD' }, c({}))).toEqual({
      ok: true,
      otraMoneda: false,
    });
    expect(validarCobro({ monto: 2500, moneda: 'USD' }, c({ monto: 3000 })).ok).toBe(true);
    expect(validarCobro({ monto: 2500, moneda: 'USD' }, c({ monto: 2000 }))).toEqual({
      ok: false,
      error: 'monto_incompleto',
    });
  });

  it('cada método va con su moneda', () => {
    expect(validarCobro({ monto: 2500, moneda: 'USD' }, c({ metodo: 'efectivo_ves' }))).toEqual({
      ok: false,
      error: 'moneda_del_metodo',
    });
    expect(
      validarCobro(
        { monto: 2500, moneda: 'USD' },
        c({ metodo: 'zelle', moneda: 'VES', referencia: '1234' }),
      ),
    ).toEqual({ ok: false, error: 'moneda_del_metodo' });
    // Punto de venta acepta las dos.
    expect(
      validarCobro(
        { monto: 2500, moneda: 'USD' },
        c({ metodo: 'punto_venta', moneda: 'VES', monto: 90_000 }),
      ),
    ).toEqual({ ok: true, otraMoneda: true });
  });

  it('pago móvil, transferencia y Zelle exigen la referencia', () => {
    const pm = c({ metodo: 'pago_movil', moneda: 'VES', monto: 90_000 });
    expect(validarCobro({ monto: 2500, moneda: 'USD' }, pm)).toEqual({
      ok: false,
      error: 'falta_referencia',
    });
    expect(validarCobro({ monto: 2500, moneda: 'USD' }, { ...pm, referencia: '0123456' })).toEqual({
      ok: true,
      otraMoneda: true,
    });
  });

  it('el efectivo en la mano suma solo efectivo no liquidado, por moneda', () => {
    expect(
      efectivoEnMano([
        { metodo: 'efectivo_usd', monto: 2500, moneda: 'USD', liquidado: false },
        { metodo: 'efectivo_usd', monto: 1000, moneda: 'USD', liquidado: true },
        { metodo: 'efectivo_ves', monto: 50_000, moneda: 'VES', liquidado: false },
        { metodo: 'zelle', monto: 2500, moneda: 'USD', liquidado: false },
      ]),
    ).toEqual({ USD: 2500, VES: 50_000 });
  });
});

describe('C-FLEX-TASA · Venezuela: tasa del día y equivalencia en dólares', () => {
  it('lee la tasa del Banco Central con su coma decimal y su fecha', () => {
    const html = `<div id="dolar" class="x"><span> USD</span></div><div><strong class="strong-tb">888,11830000</strong></div>
      Fecha Valor: <span content="2026-10-28T00:00:00-04:00">Miércoles</span>`;
    expect(leerTasaBcv(html)).toEqual({ tasa: 888.1183, fecha: '2026-10-28' });
    expect(leerTasaBcv('<html>sin tasa</html>')).toBeNull();
    expect(leerTasaBcv('<div id="dolar"><strong>1.234,50</strong></div>')).toEqual({
      tasa: 1234.5,
      fecha: null,
    });
  });

  it('convierte bolívares a dólares con la tasa, y sin tasa no inventa', () => {
    expect(enDolares(2500, 'USD', null)).toBe(2500);
    expect(enDolares(92_000, 'VES', 888.1183)).toBe(104);
    expect(enDolares(92_000, 'VES', null)).toBeNull();
  });
});
