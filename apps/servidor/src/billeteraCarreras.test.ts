import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';

/**
 * C-GANANCIAS-CARRERAS (robot de Android, 18 nov 2026): un viaje de moto pagado entero con regalo
 * salía «0 entregas» en Ganancias. La billetera dice el viaje de cada movimiento (el cobro con
 * tarjeta y el regalo de Divoox que lo pagó) para que Driver lo cuente como UNA carrera.
 */
describe('la billetera dice el viaje de cada movimiento', () => {
  it('regalo de un viaje y cobro con tarjeta llevan su viaje; el regalo de comida, no', async () => {
    const m = mundo();
    const c = await m.cuenta('repartidor');
    await m.DB.prepare(
      "INSERT INTO cupones_divoox (codigo, tipo, valor, presupuesto) VALUES ('PRUEBA', 'monto', 500, 10000)",
    ).run();
    await m.DB.batch([
      m.DB.prepare(
        `INSERT INTO usos_cupon_divoox (id, codigo, cliente_id, telefono, aparato, servicio, zona_id, pais, operacion_id, monto, moneda)
         VALUES ('uso-moto', 'PRUEBA', 'cli', '+1', 'ap', 'moto', 'Z', 'VE', 'op-moto', 113, 'USD'),
                ('uso-comida', 'PRUEBA', 'cli2', '+2', 'ap2', 'comida', 'Z', 'VE', 'ped-1', 100, 'USD')`,
      ),
      m.DB.prepare(
        `INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia) VALUES
           ('g1', ?1, 113, 'regalo', 'regalo-divoox:uso-moto'),
           ('g2', ?1, 100, 'regalo', 'regalo-divoox:uso-comida'),
           ('t1', ?1, 300, 'entrega', 'viaje-tarjeta-op-carro')`,
      ).bind(c.id),
    ]);
    const r = await m.llamar('GET', '/datos/billetera', undefined, c.token);
    expect(r.estado).toBe(200);
    const porId = new Map(
      (r.datos.movimientos as { id: string; operacionId: string | null }[]).map((x) => [
        x.id,
        x.operacionId,
      ]),
    );
    expect(porId.get('g1')).toBe('op-moto');
    expect(porId.get('t1')).toBe('op-carro');
    expect(porId.get('g2')).toBeNull();
  });
});
