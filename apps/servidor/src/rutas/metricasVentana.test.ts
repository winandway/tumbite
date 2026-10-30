import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';
import { metricasRepartidor } from './repartidorGrandes';

/**
 * C-METRICAS-VENTANA (30 oct 2026, auditoría de Divoox Rewards): dos defectos de las métricas del
 * repartidor. (1) Las notas que fueron culpa del restaurante se quitaban DESPUÉS de tomar las
 * últimas 100: la ventana quedaba con menos de 100 y se perdían notas viejas que sí cuentan.
 * (2) Un pedido sin hora de aceptación o de entrega contaba como puntual.
 */
async function base() {
  const m = mundo();
  const dueno = await m.cuenta('restaurante');
  const cliente = await m.cuenta('cliente');
  const rep = await m.cuenta('repartidor');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  let n = 0;
  const pedido = async (o: {
    aceptado?: string | null;
    entregado?: string;
    estrellas?: number;
    culpa?: boolean;
    hace: number;
  }) => {
    const id = `ped-v-${n++}`;
    await m.DB.prepare(
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, repartidor_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, lat, lng, tiempo_prep_min, distancia_km, aceptado_en, entregado_en)
       VALUES (?, ?, ?, ?, 'entregado', '[]', 1000, 200, 100, 0, 100, 1400, 150, 850, 400, 0, 0, 'basico', 'Dirección', 25.78, -80.2, 15, 3, ?, ?)`,
    )
      .bind(
        id,
        cliente.id,
        rid,
        rep.id,
        o.aceptado === undefined ? `2026-10-01 10:00:00` : o.aceptado,
        o.entregado ?? `2026-10-01 10:20:00`,
      )
      .run();
    if (o.estrellas != null)
      await m.DB.prepare(
        "INSERT INTO calificaciones (pedido_id, estrellas_repartidor, culpa_restaurante, creado_en) VALUES (?, ?, ?, datetime('now', ?))",
      )
        .bind(id, o.estrellas, o.culpa ? 1 : 0, `-${o.hace} minutes`)
        .run();
  };
  return { m, rep, pedido };
}

describe('C-METRICAS-VENTANA', () => {
  it('la ventana de estrellas son las últimas 100 que CUENTAN, sin las que fueron culpa del restaurante', async () => {
    const { m, rep, pedido } = await base();
    // Las 100 más nuevas: 90 de 5 estrellas y 10 de 1 estrella por culpa del restaurante.
    for (let i = 0; i < 100; i++)
      await pedido({ estrellas: i < 10 ? 1 : 5, culpa: i < 10, hace: i + 1 });
    // Más viejas: 10 de 1 estrella que SÍ cuentan (fueron del repartidor).
    for (let i = 0; i < 10; i++) await pedido({ estrellas: 1, hace: 200 + i });
    const r = await metricasRepartidor(m.DB, rep.id);
    expect(r.clientes.cuantas).toBe(100);
    expect(r.clientes.promedio).toBe(4.6);
    expect(r.clientes.excluidas).toBe(10);
  });

  it('un pedido sin hora de aceptación no cuenta como puntual: queda fuera de la cuenta', async () => {
    const { m, rep, pedido } = await base();
    // Uno tarde (2 horas) y otro sin hora de aceptación.
    await pedido({ aceptado: '2026-10-01 08:00:00', entregado: '2026-10-01 10:00:00', hace: 1 });
    await pedido({ aceptado: null, entregado: '2026-10-01 10:30:00', hace: 2 });
    const r = await metricasRepartidor(m.DB, rep.id);
    expect(r.puntualidad).toEqual({ porcentaje: 0, de: 1 });
  });
});
