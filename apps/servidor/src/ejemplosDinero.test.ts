import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { calcularPedido } from '@tumbite/compartido';

/**
 * Candado C-EJEMPLOS-AL-DIA (13 oct 2026, pedido de Richard: «actualizar toda la información que
 * esté con los precios viejos»): los ejemplos de dinero que se publican se recalculan con la
 * calculadora de la app y los precios de fábrica vigentes. Si cambian los precios y un ejemplo
 * queda viejo, esta prueba se pone en rojo.
 */
const raiz = join(__dirname, '..', '..', '..');
const leer = (...r: string[]) => readFileSync(join(raiz, ...r), 'utf8');
const es = (c: number) => (c / 100).toFixed(2).replace('.', ',');
const en = (c: number) => `$${(c / 100).toFixed(2)}`;

describe('los ejemplos de dinero publicados están al día', () => {
  it('«Cómo funciona»: pedido de 30 dólares, plan Inicial, 2 km, propina de 4', () => {
    const d = calcularPedido({
      lineas: [{ precioCentavos: 3000, cantidad: 1 }],
      plan: 'inicial',
      propina: 400,
      distanciaKm: 2,
    });
    const pagina = leer('apps', 'panel', 'src', 'sitio', 'ComoFunciona.tsx');
    for (const monto of [
      d.totalCliente,
      d.pagoRestaurante,
      d.pagoRepartidor,
      d.gananciaPlataforma,
    ]) {
      expect(pagina, `falta ${es(monto)} USD`).toContain(`${es(monto)} USD`);
      expect(pagina, `falta ${en(monto)}`).toContain(en(monto));
    }
    expect(pagina).toContain(`envío ${es(d.envio)}`);
    expect(pagina).toContain(`servicio ${es(d.servicio)}`);
  });

  it('«Un pedido de punta a punta»: el pedido de la prueba (18,50 de comida, propina 3,70)', () => {
    const d = calcularPedido({
      lineas: [
        { precioCentavos: 1400, cantidad: 1 },
        { precioCentavos: 450, cantidad: 1 },
      ],
      plan: 'inicial',
      propina: 370,
      distanciaKm: 2,
    });
    const guias = leer('apps', 'panel', 'src', 'sitio', 'docs', 'guias.ts');
    const punto = (c: number) => (c / 100).toFixed(2);
    expect(guias).toContain(`el cliente pagó ${punto(d.totalCliente)} dólares`);
    expect(guias).toContain(`envío ${punto(d.envio)}, servicio ${punto(d.servicio)}`);
    expect(guias).toContain(`recibió ${punto(d.pagoRestaurante)}`);
    expect(guias).toContain(`Tumbite se quedó con ${punto(d.gananciaPlataforma)}`);
    expect(guias).toContain(`the customer paid ${en(d.totalCliente)}`);
  });
});
