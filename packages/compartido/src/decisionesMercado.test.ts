import { describe, expect, it } from 'vitest';
import {
  REGLA_COMIDA_LISTO,
  repartoCancelacionListo,
  retiroMinimo,
  topeReembolsoSinRevision,
} from './decisionesMercado';

// C-DECISIONES-MERCADO (13 nov 2026, todos los países): las tres decisiones que estaban abiertas,
// cerradas con el estándar del mercado. Ficha: docs/investigaciones-rea/2026-11-13-decisiones-mercado.md.
describe('C-DECISIONES-MERCADO: retiro mínimo', () => {
  it('10 dólares en USD; sin cifra para otra moneda (no hay retiros ahí)', () => {
    expect(retiroMinimo('USD')).toBe(1_000);
    expect(retiroMinimo('COP')).toBeNull();
  });
});

describe('C-DECISIONES-MERCADO: tope del reembolso automático sin revisión humana', () => {
  it('por país, en su moneda; un país sin cifra no devuelve solo', () => {
    expect(topeReembolsoSinRevision('US')).toBe(1_500);
    expect(topeReembolsoSinRevision('CO')).toBe(30_000);
    expect(topeReembolsoSinRevision('VE')).toBe(500);
    expect(topeReembolsoSinRevision('MX')).toBeNull();
  });
});

describe('C-DECISIONES-MERCADO: pedido ya listo que se cancela', () => {
  const pedido = { total: 3_000, comida: 2_000, envio: 399, propina: 300 };
  it('el cliente que cancela con la comida hecha paga la comida; recupera envío y propina; el restaurante cobra', () => {
    expect(REGLA_COMIDA_LISTO.cliente).toMatchObject({ restauranteCobraComida: true });
    expect(repartoCancelacionListo('cliente', pedido)).toEqual({
      reembolsoCliente: 699,
      comidaAlRestaurante: 2_000,
      asumeComida: 'cliente',
    });
  });
  it('por causa del restaurante: el cliente recupera todo y el restaurante no cobra', () => {
    expect(repartoCancelacionListo('restaurante', pedido)).toEqual({
      reembolsoCliente: 3_000,
      comidaAlRestaurante: 0,
      asumeComida: 'restaurante',
    });
  });
  it('por causa de Divoox o del reparto: el cliente recupera todo y Divoox le paga la comida al restaurante', () => {
    expect(repartoCancelacionListo('divoox', pedido)).toEqual({
      reembolsoCliente: 3_000,
      comidaAlRestaurante: 2_000,
      asumeComida: 'divoox',
    });
  });
  it('nunca devuelve más que el total ni menos que cero', () => {
    const raro = { total: 500, comida: 2_000, envio: 399, propina: 300 };
    expect(repartoCancelacionListo('cliente', raro).reembolsoCliente).toBe(500);
    expect(
      repartoCancelacionListo('cliente', { ...raro, envio: 0, propina: 0 }).reembolsoCliente,
    ).toBe(0);
  });
});
