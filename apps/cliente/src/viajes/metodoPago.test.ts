import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CotizacionViaje } from '@tumbite/compartido';
import { decisionDePago, metodoDisponible } from './metodoPago';

/**
 * C-METODO-PAGO-PANTALLA y C-SALDO-CLIENTE (25 nov 2026, Venezuela): la pantalla «Método de pago»
 * existe entre el precio y la solicitud, con el «Monto a pagar», la tarjeta del Saldo Divoox y las
 * formas de pago del país en los dos idiomas; y su cuenta es la misma del servidor.
 */
const leer = (archivo: string) => readFileSync(join(__dirname, archivo), 'utf8');

const cot = (extra: Partial<CotizacionViaje> = {}) =>
  ({
    id: 'cot-1',
    total: 300,
    moneda: 'USD',
    metodosPago: ['efectivo', 'pago_movil'],
    saldoDivoox: { disponible: 100, moneda: 'USD' },
    disponibles: { efectivo: true, pago_movil: true },
    ...extra,
  }) as CotizacionViaje;

describe('C-SALDO-CLIENTE: la cuenta de la pantalla de pago', () => {
  it('saldo que no alcanza: usa lo que hay y el resto se elige (efectivo o pago móvil)', () => {
    const d = decisionDePago(cot(), { metodo: 'efectivo', usarSaldo: true, reserva: false });
    expect(d).toMatchObject({
      conSaldo: true,
      saldoUsado: 100,
      resto: 200,
      cubreTodo: false,
      falta: false,
    });
    expect(d.cuerpo).toEqual({ metodoPago: 'efectivo', usarSaldo: true });
  });

  it('saldo que cubre todo: va como «saldo» y no hace falta elegir', () => {
    const d = decisionDePago(cot({ saldoDivoox: { disponible: 500, moneda: 'USD' } }), {
      metodo: 'pago_movil',
      usarSaldo: true,
      reserva: false,
    });
    expect(d).toMatchObject({ saldoUsado: 300, resto: 0, cubreTodo: true, saldoQueQueda: 200 });
    expect(d.cuerpo).toEqual({ metodoPago: 'saldo', usarSaldo: true });
  });

  it('primero el regalo de código, después el saldo', () => {
    const d = decisionDePago(
      cot({
        regalo: {
          codigo: 'X',
          nombreEs: '',
          nombreEn: '',
          tipo: 'monto',
          monto: 250,
          moneda: 'USD',
          bienvenida: false,
        },
      }),
      { metodo: 'efectivo', usarSaldo: true, reserva: false },
    );
    expect(d).toMatchObject({ despuesDelRegalo: 50, saldoUsado: 50, resto: 0, cubreTodo: true });
  });

  it('saldo cero, apagado por la persona o viaje reservado: no se usa', () => {
    for (const [c, usar, reserva] of [
      [cot({ saldoDivoox: { disponible: 0, moneda: 'USD' } }), true, false],
      [cot(), false, false],
      [cot(), true, true],
    ] as const) {
      const d = decisionDePago(c, { metodo: 'efectivo', usarSaldo: usar, reserva });
      expect(d.conSaldo).toBe(false);
      expect(d.cuerpo).toEqual({ metodoPago: 'efectivo' });
    }
  });

  it('Pago Móvil apagado: no vale como forma de pago y el botón dice por qué', () => {
    const c = cot({ disponibles: { efectivo: true, pago_movil: false } });
    expect(metodoDisponible(c, 'pago_movil')).toBe(false);
    expect(metodoDisponible(c, 'efectivo')).toBe(true);
    expect(decisionDePago(c, { metodo: 'pago_movil', usarSaldo: true, reserva: false }).falta).toBe(
      true,
    );
    // Sin dato del servidor (países de siempre), todo disponible como hoy.
    expect(metodoDisponible(cot({ disponibles: undefined }), 'tarjeta')).toBe(true);
  });
});

describe('C-METODO-PAGO-PANTALLA: la pantalla existe y Pedir viaje lleva a ella', () => {
  it('tiene el monto, el Saldo Divoox y las formas de pago, en español y en inglés', () => {
    const s = leer('MetodoPago.tsx');
    for (const texto of [
      "titulo: 'Método de pago'",
      "titulo: 'Payment method'",
      "montoAPagar: 'Monto a pagar'",
      "montoAPagar: 'Amount to pay'",
      "saldo: 'Saldo Divoox'",
      "saldo: 'Divoox Balance'",
      "sinSaldo: 'Sin saldo por ahora'",
      "pago_movil: 'Pago Móvil'",
      "efectivo: 'Efectivo'",
      "efectivo: 'Cash'",
    ])
      expect(s).toContain(texto);
    expect(s).toContain('<MontoEnMano');
    expect(s).toContain('TEXTO_METODO_NO_DISPONIBLE');
    expect(s).toContain('testID="pago-solicitar"');
    // Sin «pronto» ni ventanas de error.
    expect(s).not.toMatch(/[Pp]ronto|Alert\.alert/);
  });

  it('el botón del precio abre «Método de pago» y la solicitud sale de ahí', () => {
    const s = leer('PedirMoto.tsx');
    expect(s).toContain('<MetodoPago');
    expect(s).toContain('setVerPago(true)');
    expect(s).toContain('alSolicitar={(pago) => void pedir(pago)}');
    // Las píldoras de pago viejas ya no están en la tarjeta del precio.
    expect(s).not.toContain('C-PAGO-MOVIL-VIAJE: solo los métodos del país');
  });
});
