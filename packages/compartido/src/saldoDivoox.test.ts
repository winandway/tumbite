import { describe, expect, it } from 'vitest';
import { perfilPasajeros } from './perfilPasajeros';
import { pagaEnMano, precioConRegalo } from './regaloDivoox';
import { cuentaConSaldo, enManoCon } from './saldoDivoox';

/** C-SALDO-CLIENTE (25 nov 2026): la cuenta única del Saldo Divoox y su encendido por país. */
describe('C-SALDO-CLIENTE: una sola cuenta de «en mano»', () => {
  it('total − regalo − saldo, nunca menos de cero', () => {
    expect(pagaEnMano(300, { monto: 50 }, 100)).toBe(150);
    expect(pagaEnMano(300, null, 500)).toBe(0);
    expect(pagaEnMano(300, { monto: 50 })).toBe(250);
  });

  it('el saldo cubre hasta donde alcanza, después del regalo', () => {
    expect(
      cuentaConSaldo({ total: 300, regalo: { monto: 50 }, saldoDisponible: 100, usarSaldo: true }),
    ).toMatchObject({ saldoUsado: 100, resto: 150, cubreTodo: false });
    expect(cuentaConSaldo({ total: 300, saldoDisponible: 1000, usarSaldo: true })).toMatchObject({
      saldoUsado: 300,
      resto: 0,
      cubreTodo: true,
      saldoQueQueda: 700,
    });
    expect(cuentaConSaldo({ total: 300, saldoDisponible: 1000, usarSaldo: false })).toMatchObject({
      saldoUsado: 0,
      resto: 300,
    });
  });

  it('el precio del viaje en las pantallas dice lo cubierto por el saldo', () => {
    expect(precioConRegalo(300, null, 100)).toMatchObject({
      saldo: 100,
      aPagar: 200,
      tachado: false,
    });
    expect(precioConRegalo(300, { monto: 250 }, 100)).toMatchObject({
      regalo: 250,
      saldo: 50,
      aPagar: 0,
      gratis: false,
    });
  });

  it('los bolívares del resto salen con la misma tasa fijada', () => {
    const base = {
      monto: 300,
      moneda: 'USD',
      local: { moneda: 'VES', tasa: 40, fecha: '2026-11-25', monto: 12000 },
      sinTasa: false,
    };
    expect(enManoCon(base, 100)).toEqual({
      ...base,
      monto: 100,
      local: { ...base.local, monto: 4000 },
    });
    expect(enManoCon(null, 100)).toBeNull();
  });

  it('encendido solo en Venezuela; apagado en los demás países', () => {
    expect(perfilPasajeros('VE').saldoDivoox).toBe(true);
    expect(perfilPasajeros('US').saldoDivoox).toBe(false);
    expect(perfilPasajeros('PE').saldoDivoox).toBe(false);
    expect(perfilPasajeros('CO').saldoDivoox).toBe(false);
  });
});
