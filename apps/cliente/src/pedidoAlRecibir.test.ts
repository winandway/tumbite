import { describe, expect, it } from 'vitest';
import { textoPedidoSinCobrar } from './pedidoAlRecibir';

/**
 * C-PAGO-AL-RECIBIR-TEXTO (robot de Android, 18 nov 2026): un pedido de comida pagado en efectivo al
 * recibir decía «Pago recibido. Esperando que el restaurante lo acepte.». Nadie había pagado todavía.
 */
describe('el estado «pagado» de un pedido que se paga al recibir', () => {
  it('no dice que se recibió un pago (efectivo o transferencia al repartidor)', () => {
    for (const metodo of ['efectivo', 'transferencia_repartidor'] as const)
      for (const idioma of ['es', 'en'] as const)
        for (const tienda of [false, true]) {
          const t = textoPedidoSinCobrar('pagado', metodo, tienda, idioma);
          expect(t).toBeTruthy();
          expect(t).not.toMatch(/Pago recibido|Payment received/);
        }
    expect(textoPedidoSinCobrar('pagado', 'efectivo', false, 'es')).toBe(
      'Pedido enviado. Esperando que el restaurante lo acepte.',
    );
  });
  it('con tarjeta, o en otro estado, sigue el texto de siempre', () => {
    expect(textoPedidoSinCobrar('pagado', 'tarjeta', false, 'es')).toBeNull();
    expect(textoPedidoSinCobrar('pagado', undefined, false, 'es')).toBeNull();
    expect(textoPedidoSinCobrar('aceptado', 'efectivo', false, 'es')).toBeNull();
  });
});
