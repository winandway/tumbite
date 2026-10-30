import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

/**
 * C-CALIFICACION-PUBLICA (30 oct 2026): el cliente ve las estrellas del restaurante (promedio y
 * número de opiniones de pedidos verificados) en la lista, el buscador y la ficha, y las reseñas
 * con comentario en la ficha. Con menos de 10 opiniones no se muestra promedio (como DoorDash).
 */
async function restauranteConOpiniones(n: number, estrellas: (i: number) => number) {
  const m = mundo();
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente', 'Ana García');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
  for (let i = 0; i < n; i++) {
    const p = `ped-cal-${i}`;
    await m.DB.prepare(
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, lat, lng, aceptado_en, pagado_en)
       VALUES (?, ?, ?, 'entregado', '[]', 1000, 200, 100, 0, 100, 1400, 150, 850, 400, 0, 0, 'basico', 'Dirección', 25.78, -80.2, datetime('now'), datetime('now'))`,
    )
      .bind(p, cliente.id, rid)
      .run();
    await m.DB.prepare(
      `INSERT INTO calificaciones (pedido_id, estrellas_restaurante, comentario, respuesta, creado_en)
       VALUES (?, ?, ?, ?, datetime('now', ?))`,
    )
      .bind(
        p,
        estrellas(i),
        i % 2 ? '' : `Muy rica ${i}`,
        i === 0 ? 'Gracias por tu pedido' : null,
        `-${i} minutes`,
      )
      .run();
  }
  return { m, rid };
}

describe('C-CALIFICACION-PUBLICA', () => {
  it('con 12 opiniones, la lista, el buscador y la ficha traen el promedio y la cuenta', async () => {
    const { m, rid } = await restauranteConOpiniones(12, (i) => (i < 9 ? 5 : 4));
    const lista = await m.llamar('GET', '/datos/restaurantes?lat=25.78&lng=-80.2');
    expect(lista.datos.restaurantes[0].calificacion).toEqual({ promedio: 4.8, total: 12 });
    const det = await m.llamar('GET', `/datos/restaurantes/${rid}`);
    expect(det.datos.restaurante.calificacion).toEqual({ promedio: 4.8, total: 12 });
    const busca = await m.llamar('GET', '/datos/buscar?q=a&lat=25.78&lng=-80.2');
    for (const r of busca.datos.restaurantes ?? [])
      expect(r.calificacion).toEqual({ promedio: 4.8, total: 12 });
  });

  it('las reseñas públicas: solo con comentario, nombre de pila, la respuesta del restaurante y lo más nuevo primero', async () => {
    const { m, rid } = await restauranteConOpiniones(12, () => 5);
    const res = await m.llamar('GET', `/datos/restaurantes/${rid}/resenas`);
    expect(res.estado).toBe(200);
    expect(res.datos.calificacion).toEqual({ promedio: 5, total: 12 });
    expect(res.datos.resenas).toHaveLength(6);
    expect(res.datos.resenas[0]).toMatchObject({
      cliente: 'Ana',
      estrellas: 5,
      comentario: 'Muy rica 0',
      respuesta: 'Gracias por tu pedido',
    });
    expect(JSON.stringify(res.datos)).not.toContain('García');
    expect(JSON.stringify(res.datos)).not.toContain('ped-cal');
  });

  it('con menos de 10 opiniones no hay promedio ni reseñas públicas', async () => {
    const { m, rid } = await restauranteConOpiniones(9, () => 5);
    const det = await m.llamar('GET', `/datos/restaurantes/${rid}`);
    expect(det.datos.restaurante.calificacion).toBeNull();
    const res = await m.llamar('GET', `/datos/restaurantes/${rid}/resenas`);
    expect(res.datos).toEqual({ calificacion: null, resenas: [] });
  });
});
