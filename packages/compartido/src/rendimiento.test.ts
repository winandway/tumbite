import { describe, expect, it } from 'vitest';
import { rendimientoRestaurante } from './rendimiento';

// C-RENDIMIENTO-REST: ventas por hora y día en la hora del restaurante; clientes nuevos y que repiten.
describe('C-RENDIMIENTO-REST', () => {
  it('cuenta en la hora de Miami y separa clientes nuevos de los que ya habían pedido', () => {
    const r = rendimientoRestaurante(
      [
        // Jueves 29 oct, 12:30 en Miami (16:30 UTC).
        { pagadoEn: '2026-10-29 16:30:00', subtotal: 1500, clienteId: 'a' },
        { pagadoEn: '2026-10-29 16:45:00', subtotal: 1000, clienteId: 'b' },
        // Viernes 30 oct, 01:10 UTC = jueves 21:10 en Miami.
        { pagadoEn: '2026-10-30 01:10:00', subtotal: 500, clienteId: 'a' },
      ],
      'America/New_York',
      new Set(['b']),
    );
    expect(r.porHora[12]).toEqual({ pedidos: 2, ventas: 2500 });
    expect(r.porHora[21]).toEqual({ pedidos: 1, ventas: 500 });
    expect(r.porDia[4]).toEqual({ pedidos: 3, ventas: 3000 });
    expect(r.clientes).toEqual({ nuevos: 1, recurrentes: 1, nuevosQueVolvieron: 1 });
  });
});
