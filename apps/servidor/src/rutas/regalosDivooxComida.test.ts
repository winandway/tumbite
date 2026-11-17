import { describe, expect, it } from 'vitest';
import { saldoLibro } from '../internacional/libro';
import { EL_VIGIA, abrirComida, escenarioVe, restauranteVe } from '../pruebas/comidaVe';

/**
 * C-CUPON-DIVOOX (17 nov 2026) — Venezuela. Un pedido de comida en efectivo en El Vigía con el regalo
 * VIGIA: el cliente paga en mano solo la diferencia, el repartidor ve lo que paga Divoox y, al
 * conciliar, se le acredita en su saldo prepago una sola vez. Con tarjeta el regalo no se usa.
 */
const CASA = { lat: 8.6235, lng: -71.649 };
const APARATO = { 'x-aparato': 'aparato-cliente-el-vigia-1' };

async function mundoVe() {
  const e = await escenarioVe();
  expect((await abrirComida(e)).estado).toBe(201);
  const r = await restauranteVe(e);
  await e.m.DB.prepare(
    "UPDATE usuarios SET telefono = '+584145550101', telefono_canonico = '584145550101' WHERE id = ?",
  )
    .bind(e.cliente.id)
    .run();
  const cupon = await e.m.llamar(
    'POST',
    '/datos/admin/regalos-divoox',
    {
      codigo: 'VIGIA',
      nombreEs: 'Regalo de bienvenida El Vigía',
      nombreEn: 'El Vigía welcome gift',
      tipo: 'monto',
      valor: 200,
      servicios: ['comida', 'moto'],
      zonas: [EL_VIGIA.id],
      presupuesto: 10_000,
    },
    e.admin.token,
  );
  expect(cupon.estado).toBe(201);
  expect(cupon.datos.cupon.moneda).toBe('USD');
  await e.m.llamar('PATCH', '/datos/admin/regalos-divoox/VIGIA', { activo: true }, e.admin.token);
  const pedir = (cuerpo: Record<string, unknown>) =>
    e.m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: r.rid,
        lineas: [{ platoId: r.platoId, cantidad: 2 }],
        propinaCentavos: 50,
        direccion: 'Calle 5 con avenida 3, El Vigía',
        ...CASA,
        ...cuerpo,
      },
      e.cliente.token,
      APARATO,
    );
  return { e, r, pedir };
}

describe('C-CUPON-DIVOOX: comida en mano con el regalo de Divoox', () => {
  it('el carrito valida el código, el cliente paga en mano la diferencia y el repartidor recibe el regalo', async () => {
    const { e, r, pedir } = await mundoVe();
    const v = await e.m.llamar(
      'POST',
      '/datos/cupones/validar',
      { codigo: 'vigia', restauranteId: r.rid, subtotal: 900, envio: 150, base: 1095 },
      e.cliente.token,
      APARATO,
    );
    expect(v.estado).toBe(200);
    expect(v.datos).toMatchObject({ codigo: 'VIGIA', descuento: 200, tipo: 'regalo_divoox' });
    // Con tarjeta, no.
    expect((await pedir({ metodoPago: 'tarjeta', cupon: 'VIGIA' })).estado).toBe(409);
    const p = await pedir({ metodoPago: 'efectivo', cupon: 'VIGIA' });
    expect(p.estado).toBe(201);
    const id = p.datos.pedidoId as string;
    expect(p.datos.desglose.descuento).toBe(200);
    const f = await e.m.DB.prepare('SELECT total, propina, descuento FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ total: number; propina: number; descuento: number }>();
    expect(f?.descuento).toBe(200);

    // El repartidor: recarga, acepta, recoge, entrega y cobra en mano solo la diferencia.
    const rep = await e.m.cuenta('repartidor', 'Repartidor El Vigía');
    await e.m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 8.6222, lng: -71.6508 },
      rep.token,
    );
    await e.m.DB.prepare(
      "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES (?, ?, 'prepago', 'VE', 'USD', 1000, 'recarga_prueba', ?)",
    )
      .bind(crypto.randomUUID(), rep.id, `recarga:${rep.id}`)
      .run();
    expect(
      (
        await e.m.llamar(
          'POST',
          `/datos/restaurante/pedidos/${id}/aceptar`,
          { minutos: 5 },
          r.dueno.token,
        )
      ).estado,
    ).toBe(200);
    const ofertas = await e.m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    expect(ofertas.datos.ofertas.map((o: { id: string }) => o.id)).toContain(id);
    expect(
      (await e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token)).estado,
    ).toBe(200);
    const estado = await e.m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(estado.datos.activo.regaloDivoox).toBe(200);
    await e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, r.dueno.token);
    const l = await e.m.llamar(
      'GET',
      `/datos/repartidor/pedidos/${id}/pago-local`,
      undefined,
      rep.token,
    );
    await e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/pago-local`,
      { montoPagado: l.datos.montoEsperado, importeTicket: l.datos.subtotal, metodo: 'efectivo' },
      rep.token,
    );
    expect((await e.m.recoger(id, rep.token, r.dueno.token)).estado).toBe(200);
    expect((await e.m.entregar(id, rep.token)).estado).toBe(200);
    const enMano = Number(f?.total) - Number(f?.propina);
    const antes = await saldoLibro(e.m.DB, rep.id, 'prepago', 'VE', 'USD');
    const cobre = await e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/cobre`,
      { montoRecibido: enMano },
      rep.token,
    );
    expect(cobre.datos.cobroEstado).toBe('confirmado');
    const fin = await e.m.DB.prepare('SELECT conciliacion_estado FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ conciliacion_estado: string }>();
    expect(fin?.conciliacion_estado).toBe('conciliado');
    // Los 2,00 del regalo entran a su prepago, una vez.
    expect(await saldoLibro(e.m.DB, rep.id, 'prepago', 'VE', 'USD')).toBe(antes + 200);
    const { conciliarPedidoDirecto } = await import('../internacional/cobroDirecto');
    await conciliarPedidoDirecto(e.m.DB, id);
    expect(await saldoLibro(e.m.DB, rep.id, 'prepago', 'VE', 'USD')).toBe(antes + 200);
    const lista = await e.m.llamar('GET', '/datos/admin/regalos-divoox', undefined, e.admin.token);
    expect(lista.datos.cupones[0]).toMatchObject({ gastado: 200, apartado: 0, usos: 1 });
    // Ya lo usó: otro pedido con el mismo código no lo trae.
    expect((await pedir({ metodoPago: 'efectivo', cupon: 'VIGIA' })).estado).toBe(409);
  });

  it('si el pedido se cancela, el regalo vuelve al presupuesto', async () => {
    const { e, pedir } = await mundoVe();
    const p = await pedir({ metodoPago: 'efectivo', cupon: 'VIGIA' });
    expect(p.estado).toBe(201);
    await e.m.DB.prepare(
      "UPDATE pedidos SET estado = 'cancelado', cancelado_en = datetime('now') WHERE id = ?",
    )
      .bind(p.datos.pedidoId)
      .run();
    const { barrerRegalos } = await import('../regalosDivoox');
    expect(await barrerRegalos(e.m.DB)).toBe(1);
    const lista = await e.m.llamar('GET', '/datos/admin/regalos-divoox', undefined, e.admin.token);
    expect(lista.datos.cupones[0]).toMatchObject({ gastado: 0, apartado: 0, restante: 10_000 });
  });
});
