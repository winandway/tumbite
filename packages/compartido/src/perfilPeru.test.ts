import { describe, expect, it } from 'vitest';
import { DECIMALES_MONEDA, formatearMonto, textoAMonto } from './dinero';
import { nombreFormaPago } from './formaDePago';
import {
  CIUDAD_ICA,
  PUNTOS_ICA,
  dniPeruValido,
  placaPeruValida,
  telefonoPeruValido,
} from './perfilPeru';
import {
  METODOS_PAGO_VIAJE,
  TARIFA_CARRO_PERU,
  TARIFA_MOTO_PERU,
  carrerasQueAlcanzan,
  documentosDelConductor,
  esPagoACelular,
  perfilPasajeros,
  tarifaDeMercado,
} from './perfilPasajeros';
import { MONEDA_REFERENCIA } from './tasaReferencia';
import { numeroEmergencia } from './viajes';

/**
 * C-PERFIL-PERU (19 nov 2026) — Perú. El país en una sola pieza: soles, Yape y Plin en mano, papeles
 * del conductor peruano y la ciudad de Ica. Sin esto, Perú se comportaba como Estados Unidos (dólares,
 * tarjeta y antecedentes con proveedor). Ficha: docs/investigaciones-rea/2026-11-19-ica-peru.md.
 */
describe('perfil de Perú', () => {
  it('el sol lleva dos decimales y se pinta como soles, nunca como dólares', () => {
    expect(DECIMALES_MONEDA.get('PEN')).toBe(2);
    const texto = formatearMonto(1250, 'PEN', 'es').replace(/\s/g, ' ');
    expect(texto).toContain('S/');
    expect(texto).toContain('12.50');
    expect(texto).not.toContain('$');
    expect(formatearMonto(1250, 'PEN', 'en')).not.toContain('$');
    expect(textoAMonto('10', 'PEN')).toBe(1000);
  });

  it('Perú tiene su propio perfil: no hereda el de Estados Unidos', () => {
    const p = perfilPasajeros('pe');
    expect(p.pais).toBe('PE');
    expect(p.antecedentes).toBe('documentos');
    expect(p.monedaViajes).toBe('PEN');
    expect(p.placaNacional).toBe(true);
    expect(p.metodosPago).toEqual(['efectivo', 'yape', 'plin']);
    expect(p.metodosPago).not.toContain('tarjeta');
    expect(p.metodosPago).not.toContain('pago_movil');
  });

  it('Yape y Plin son métodos de viaje, se pagan al celular del conductor y tienen nombre', () => {
    expect(METODOS_PAGO_VIAJE).toContain('yape');
    expect(METODOS_PAGO_VIAJE).toContain('plin');
    expect(esPagoACelular('yape')).toBe(true);
    expect(esPagoACelular('plin')).toBe(true);
    expect(esPagoACelular('pago_movil')).toBe(true);
    expect(esPagoACelular('efectivo')).toBe(false);
    expect(esPagoACelular('tarjeta')).toBe(false);
    expect(nombreFormaPago('yape', 'es')).toBe('Yape');
    expect(nombreFormaPago('plin', 'en')).toBe('Plin');
  });

  it('pide la licencia y los antecedentes al conductor, y esos papeles cumplen los requisitos', () => {
    const p = perfilPasajeros('PE');
    expect(documentosDelConductor(p, 'moto')).toEqual(['licencia_moto', 'antecedentes_penales']);
    expect(documentosDelConductor(p, 'carro')).toEqual([
      'licencia_conducir',
      'antecedentes_penales',
    ]);
    expect(p.requisitosDeDocumento.antecedentes_penales).toEqual(['antecedentes_pasajeros']);
  });

  it('trae la tarifa de mercado de Ica en céntimos de sol, con su mínimo', () => {
    expect(tarifaDeMercado('PE', 'moto')).toBe(TARIFA_MOTO_PERU);
    expect(tarifaDeMercado('pe', 'carro')).toBe(TARIFA_CARRO_PERU);
    expect(tarifaDeMercado('PE', 'envios')).toBeNull();
    expect(TARIFA_MOTO_PERU.minimo).toBeGreaterThanOrEqual(TARIFA_MOTO_PERU.base);
    expect(TARIFA_CARRO_PERU.minimo).toBeGreaterThan(TARIFA_MOTO_PERU.minimo);
    // Venezuela no cambia.
    expect(tarifaDeMercado('VE', 'moto')?.base).toBe(50);
  });

  it('con 10 soles y 8 % de comisión alcanza para unas doce carreras de 10 soles', () => {
    expect(carrerasQueAlcanzan(1000, 80)).toBe(12);
  });

  it('Ica es una ciudad de Perú en soles, con hora de Lima y sus puntos dentro del radio', () => {
    expect(CIUDAD_ICA.id).toMatch(/^[A-Z]{2}-[A-Z0-9]{2,3}-[A-Z0-9-]{2,30}$/);
    expect(CIUDAD_ICA.pais).toBe('PE');
    expect(CIUDAD_ICA.moneda).toBe('PEN');
    expect(CIUDAD_ICA.zonaHoraria).toBe('America/Lima');
    expect(PUNTOS_ICA.length).toBeGreaterThanOrEqual(15);
    for (const p of PUNTOS_ICA) {
      const km = Math.hypot(
        (p.lat - CIUDAD_ICA.lat) * 111,
        (p.lng - CIUDAD_ICA.lng) * 111 * Math.cos((CIUDAD_ICA.lat * Math.PI) / 180),
      );
      expect(km, p.es).toBeLessThanOrEqual(CIUDAD_ICA.radioKm);
      expect(p.en.length).toBeGreaterThan(2);
    }
  });

  it('valida el DNI, el celular y la placa de Perú', () => {
    expect(dniPeruValido('00000000')).toBe(true);
    expect(dniPeruValido('1234567')).toBe(false);
    expect(dniPeruValido('12345678a')).toBe(false);
    expect(telefonoPeruValido('+51 900 000 000')).toBe(true);
    expect(telefonoPeruValido('900000000')).toBe(true);
    expect(telefonoPeruValido('800000000')).toBe(false);
    expect(telefonoPeruValido('+51 90000000')).toBe(false);
    expect(placaPeruValida('ABC-123')).toBe(true);
    expect(placaPeruValida('A1B234')).toBe(true);
    expect(placaPeruValida('1234-AB')).toBe(true);
    expect(placaPeruValida('AB')).toBe(false);
  });

  it('Perú cobra solo en soles: no entra en la doble moneda de Venezuela', () => {
    expect(MONEDA_REFERENCIA.has('PE')).toBe(false);
    expect(numeroEmergencia('PE')).toBe('105');
  });
});
