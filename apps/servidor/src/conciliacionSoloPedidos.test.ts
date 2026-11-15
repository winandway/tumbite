import { describe, expect, it } from 'vitest';
import { ayer, conciliar, conciliarAyer, saludDinero } from './conciliacion';
import { mundo } from './pruebas/ayuda';

/**
 * C-CONCILIACION-SOLO-PEDIDOS (15 nov 2026, todos los países). La conciliación diaria es la de los
 * pedidos. El 14 nov el sitio de pruebas marcó el día como descuadrado porque los guiones de Carro con
 * tarjeta de prueba le abonaron al conductor sus viajes y sus propinas (movimientos «entrega» y
 * «propina» sin pedido) y la conciliación los contó como pagos de reparto de Comida: 56,57 dólares «de
 * más». La salud quedó en rojo y el semáforo frenó la publicación de todos.
 */
const env = { ENTORNO: 'pruebas' } as never;

async function abonoDeViaje(m: ReturnType<typeof mundo>, dia: string) {
  const c = await m.cuenta('repartidor', 'Conductor Viajes');
  for (const [i, concepto, monto] of [
    [1, 'entrega', 1201],
    [2, 'propina', 200],
  ] as const)
    await m.DB.prepare(
      'INSERT INTO movimientos (id, usuario_id, pedido_id, monto, concepto, referencia, creado_en) VALUES (?, ?, NULL, ?, ?, ?, ?)',
    )
      .bind(`mov-viaje-${i}`, c.id, monto, concepto, `viaje:prueba:${i}`, `${dia} 12:00:00`)
      .run();
}

describe('C-CONCILIACION-SOLO-PEDIDOS', () => {
  it('lo que gana un conductor por un viaje con tarjeta no descuadra la conciliación de pedidos', async () => {
    const m = mundo();
    await m.cuenta('admin', 'Soporte Divoox');
    const dia = ayer();
    await abonoDeViaje(m, dia);
    const r = await conciliar(m.DB, dia);
    expect(r.detalle.cuadraRepartidores).toBe('sí');
    expect(r.cuadra).toBe(true);
  });

  it('un día que no cuadró se vuelve a calcular solo (como mucho una vez por hora) y la salud se limpia', async () => {
    const m = mundo();
    await m.cuenta('admin', 'Soporte Divoox');
    const dia = ayer();
    // Como quedó en el sitio de pruebas: el día guardado en rojo por la cuenta vieja.
    const guardar = (creado: string) =>
      m.DB.prepare(
        `INSERT OR REPLACE INTO conciliaciones (dia, pedidos, vendido, capturado, devuelto, abonado, retirado, cuadra, detalle, creado_en)
         VALUES (?, 0, 0, 0, 0, 1401, 0, 0, '{"cuadraRepartidores":"NO"}', datetime('now', ?))`,
      )
        .bind(dia, creado)
        .run();
    await abonoDeViaje(m, dia);
    await guardar('-5 minutes');
    expect(await saludDinero(m.DB)).toBe('error');
    // Recién calculada: no se repite.
    expect(await conciliarAyer(env, m.DB)).toBeNull();
    expect(await saludDinero(m.DB)).toBe('error');
    // Con más de una hora en rojo y sin excusa: se recalcula con la cuenta correcta.
    await guardar('-2 hours');
    expect((await conciliarAyer(env, m.DB))?.cuadra).toBe(true);
    expect(await saludDinero(m.DB)).toBe('ok');
    // Ya cuadra: no se vuelve a tocar.
    expect(await conciliarAyer(env, m.DB)).toBeNull();
  });
});
