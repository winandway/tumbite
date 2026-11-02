import { describe, expect, it } from 'vitest';
import { CONFIG_DINERO_INICIAL } from './bolsillos';
import { explicarTarifas } from './explicacionTarifas';

describe('C-TARIFAS-EXPLICADAS', () => {
  it('explica cada cargo con los números reales de la configuración', () => {
    const l = explicarTarifas(CONFIG_DINERO_INICIAL, 'USD', 'es');
    expect(l.map((x) => x.clave)).toEqual(['envio', 'servicio', 'pequeno', 'propina']);
    const texto = l.map((x) => x.texto).join(' ');
    expect(texto).toContain('$3.99');
    expect(texto).toContain('5 %');
    expect(texto).toContain('$10.00');
    expect(texto).toContain('100 %');
  });

  it('si la configuración cambia, la explicación cambia (nada escrito a mano)', () => {
    const c = { ...CONFIG_DINERO_INICIAL, pedidoMinimo: 1500, cargoPedidoPequeno: 300 };
    const pequeno = explicarTarifas(c, 'USD', 'en').find((x) => x.clave === 'pequeno');
    expect(pequeno?.texto).toContain('$15.00');
    expect(pequeno?.texto).toContain('$3.00');
  });

  it('el impuesto solo se explica donde se cobra', () => {
    const conImpuesto = { ...CONFIG_DINERO_INICIAL, impuestoPb: 700 };
    expect(explicarTarifas(conImpuesto, 'USD', 'en').some((x) => x.clave === 'impuesto')).toBe(
      true,
    );
    expect(
      explicarTarifas(CONFIG_DINERO_INICIAL, 'USD', 'en').some((x) => x.clave === 'impuesto'),
    ).toBe(false);
  });

  it('los dos idiomas explican los mismos cargos', () => {
    const c = { ...CONFIG_DINERO_INICIAL, impuestoPb: 700 };
    expect(explicarTarifas(c, 'USD', 'es').map((x) => x.clave)).toEqual(
      explicarTarifas(c, 'USD', 'en').map((x) => x.clave),
    );
    expect(explicarTarifas(c, 'USD', 'en')[0]?.texto).toMatch(/^Delivery/);
  });
});
