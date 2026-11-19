import { describe, expect, it } from 'vitest';
import {
  BORRADOR_CUENTA,
  aUnidadMenor,
  cuentaActiva,
  enmascarado,
  estadoCuenta,
  cedulaValida,
  falloCuenta,
  identificadorPagoMovil,
  identificadorVisible,
  telefonoPagoMovilValido,
  falloRecarga,
  montosRapidos,
  tipoElegido,
} from './logica';

/** C-CUENTA-COBRO-CONDUCTOR y C-RECARGA-TARJETA-ALOJADA (19 nov 2026 — Venezuela y Perú). */
describe('la cuenta donde le pagan los pasajeros', () => {
  const PERU = ['yape', 'plin'];
  it('en Perú pide elegir Yape o Plin, titular y un celular peruano; y siempre la contraseña', () => {
    const v = { ...BORRADOR_CUENTA };
    expect(falloCuenta(v, '', PERU)).toBe('tipo');
    v.tipo = 'yape';
    expect(falloCuenta(v, '', PERU)).toBe('titular');
    v.titular = 'Titular de ejemplo';
    v.identificador = '12345';
    expect(falloCuenta(v, '', PERU)).toBe('identificador');
    v.identificador = '900 000 000';
    expect(falloCuenta(v, '', PERU)).toBe('clave');
    expect(falloCuenta(v, 'x', PERU)).toBeNull();
  });
  it('en Venezuela no pregunta el tipo (solo hay pago móvil) y pide banco, teléfono y cédula', () => {
    const VE = ['pago_movil'];
    const v = { ...BORRADOR_CUENTA, titular: 'Nombre del titular', identificador: '0412-0000000' };
    expect(tipoElegido(v, VE)).toBe('pago_movil');
    expect(falloCuenta(v, 'x', VE)).toBe('banco');
    const conBanco = { ...v, banco: 'Banco de ejemplo' };
    // C-CUENTA-COBRO-VENEZUELA: sin la cédula el pasajero no puede hacer el pago móvil.
    expect(falloCuenta(conBanco, 'x', VE)).toBe('cedula');
    expect(falloCuenta({ ...conBanco, cedula: 'V-00000000' }, 'x', VE)).toBeNull();
    // Un celular peruano (nueve cifras) no es un teléfono de pago móvil.
    expect(
      falloCuenta({ ...conBanco, cedula: 'V-00000000', identificador: '900000000' }, 'x', VE),
    ).toBe('identificador');
  });
  it('C-CUENTA-COBRO-VENEZUELA: teléfono y cédula se guardan juntos como los ve el pasajero', () => {
    expect(telefonoPagoMovilValido('0412 000 00 00')).toBe(true);
    expect(telefonoPagoMovilValido('+58 412-0000000')).toBe(true);
    expect(telefonoPagoMovilValido('412000000')).toBe(false);
    expect(cedulaValida('v-00.000.000')).toBe(true);
    expect(cedulaValida('00000000')).toBe(true);
    expect(cedulaValida('J-000000000')).toBe(true);
    expect(cedulaValida('abc')).toBe(false);
    expect(identificadorPagoMovil('+58 412-0000000', '00.000.000')).toBe(
      '0412-0000000 · V-00000000',
    );
    expect(identificadorPagoMovil('04120000000', 'e-00000000')).toBe('0412-0000000 · E-00000000');
    // De la cuenta guardada se muestra el final del teléfono, nunca la cédula.
    expect(
      identificadorVisible({ tipo: 'pago_movil', identificador: '0412-0001234 · V-00009999' }),
    ).toMatch(/1234$/);
    expect(identificadorVisible({ tipo: 'yape', identificador: '900001234' })).toMatch(/1234$/);
  });
  it('muestra solo el final del número y dice si ya está en vigor', () => {
    expect(enmascarado('900000000')).toBe('•••••0000');
    const c = {
      id: 'c1',
      tipo: 'yape',
      banco: '',
      titular: 'Titular de ejemplo',
      identificador: '900000000',
      verificacion: 'declarada' as const,
      activa: true,
      vigente: false,
    };
    expect(cuentaActiva([{ ...c, id: 'vieja', activa: false }, c])?.id).toBe('c1');
    expect(estadoCuenta(c)).toBe('espera');
    expect(estadoCuenta({ ...c, vigente: true })).toBe('en_vigor');
  });
});

describe('la recarga con tarjeta', () => {
  it('ofrece el mínimo y dos montos redondos por encima, sin pasar del máximo', () => {
    expect(montosRapidos(3000, 1_000_000)).toEqual([3000, 5000, 10000]);
    expect(montosRapidos(3000, 6000)).toEqual([3000, 5000]);
    expect(montosRapidos(0, 6000)).toEqual([]);
  });
  it('lee el monto escrito con coma o punto y rechaza lo que no es un monto', () => {
    expect(aUnidadMenor('30')).toBe(3000);
    expect(aUnidadMenor('30,5')).toBe(3050);
    expect(aUnidadMenor('30.55')).toBe(3055);
    expect(aUnidadMenor('30.555')).toBeNull();
    expect(aUnidadMenor('abc')).toBeNull();
  });
  it('no deja recargar menos del mínimo con tarjeta ni más del máximo', () => {
    expect(falloRecarga(null, 3000, 100000)).toBe('monto');
    expect(falloRecarga(1000, 3000, 100000)).toBe('minimo');
    expect(falloRecarga(200000, 3000, 100000)).toBe('maximo');
    expect(falloRecarga(3000, 3000, 100000)).toBeNull();
  });
});
