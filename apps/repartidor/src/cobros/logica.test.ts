import { describe, expect, it } from 'vitest';
import {
  BORRADOR_CUENTA,
  aUnidadMenor,
  cuentaActiva,
  enmascarado,
  estadoCuenta,
  falloCuenta,
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
  it('en Venezuela no pregunta el tipo (solo hay pago móvil) y pide el banco', () => {
    const v = { ...BORRADOR_CUENTA, titular: 'Titular de ejemplo', identificador: '0412-0000000' };
    expect(tipoElegido(v, ['pago_movil'])).toBe('pago_movil');
    expect(falloCuenta(v, 'x', ['pago_movil'])).toBe('banco');
    expect(falloCuenta({ ...v, banco: 'Banco de ejemplo' }, 'x', ['pago_movil'])).toBeNull();
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
