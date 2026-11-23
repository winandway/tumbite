import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG_DINERO_INICIAL } from './bolsillos';
import { TARIFAS_COMIDA_VENEZUELA } from './comidaVenezuela';
import { explicarTarifas } from './explicacionTarifas';

const leer = (ruta: string) => readFileSync(resolve(__dirname, '../../..', ruta), 'utf8');

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

describe('C-COMIDA-VE-QUIEN-PAGA: el cliente nunca ve un cargo en cero', () => {
  it('en Venezuela no se explica una tarifa de servicio ni un cargo por pedido pequeño que no existen', () => {
    for (const idioma of ['es', 'en'] as const) {
      const claves = explicarTarifas(TARIFAS_COMIDA_VENEZUELA, 'USD', idioma).map((x) => x.clave);
      expect(claves).toEqual(['envio', 'propina']);
    }
  });

  it('el carrito solo pinta el envío, la tarifa de servicio y el cargo pequeño si son mayores que 0', () => {
    const carrito = leer('apps/cliente/src/app/cart.tsx');
    for (const [linea, monto] of [
      ['envio', 'd.envio'],
      ['servicio', 'd.servicio'],
      ['pequeno', 'd.cargoPedidoPequeno'],
    ] as const) {
      const antes = carrito.split(`fila(t.${linea},`).slice(0, -1);
      expect(antes.length, linea).toBeGreaterThan(0);
      for (const a of antes)
        expect(a.endsWith(`${monto} > 0 && `), `t.${linea} sin «${monto} > 0 &&»`).toBe(true);
    }
  });

  it('la pantalla del pedido no enseña montos en cero', () => {
    const pedido = leer('apps/cliente/src/app/order/[id].tsx');
    expect(pedido).toMatch(
      /\[t\.servicio, p\.servicio \?\? 0\][\s\S]{0,400}\.filter\(\(\[, monto\]\) => monto !== 0\)/,
    );
  });
});
