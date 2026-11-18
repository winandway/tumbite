import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { claveEstadoPedido, textoPedidoSinCobrar } from './pedidoAlRecibir';

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

// Robot de Android (18 nov 2026): en «Mis pedidos» (lista y Mi cuenta) dos pedidos en efectivo, sin
// entregar, decían «Pagado». Con pago al recibir no dice «Pagado» hasta que se cobre: «Enviado».
describe('la etiqueta del estado en las listas de pedidos', () => {
  it('pagado al recibir y sin entregar = «Enviado»; con tarjeta, «Pagado»', () => {
    expect(claveEstadoPedido('pagado', 'efectivo')).toBe('enviado');
    expect(claveEstadoPedido('pagado', 'transferencia_repartidor')).toBe('enviado');
    expect(claveEstadoPedido('pagado', 'tarjeta')).toBe('pagado');
    expect(claveEstadoPedido('pagado', undefined)).toBe('pagado');
    expect(claveEstadoPedido('aceptado', 'efectivo')).toBe('aceptado');
  });
  it('todas las pantallas que pintan el estado usan la misma pieza y tienen «Enviado»', () => {
    for (const f of ['app/orders.tsx', 'app/account.tsx']) {
      const s = readFileSync(join(import.meta.dirname, f), 'utf8');
      expect(s, f).toMatch(/claveEstadoPedido\(p\.estado, p\.metodoPago\)/);
      expect(s, f).toMatch(/enviado: 'Enviado'/);
      expect(s, f).toMatch(/enviado: 'Sent'/);
    }
  });
});
