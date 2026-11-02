import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { conciliar } from './conciliacion';

/**
 * C-PROMO-RESTAURANTE (BRE-5, 2 nov 2026), como «Promotions» de DoorDash Merchant: el restaurante
 * arma su promoción y la paga él. Se aplica sola en los pedidos con tarjeta, sale de su
 * liquidación (pago_restaurante y el movimiento «venta»), Divoox no pone dinero y la conciliación
 * sigue cuadrando. Nace APAGADA con interruptor en el superadmin. Todos los países.
 */
afterEach(() => vi.unstubAllGlobals());

async function escena() {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(JSON.stringify({ id: 'pi_x', client_secret: 'pi_x_s' }), { status: 200 }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin', 'Soporte Promos');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
  const plato = await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Cubano', precioCentavos: 1500 },
    dueno.token,
  );
  await m.abrir(dueno.token);
  const pedir = (extra: Record<string, unknown> = {}) =>
    m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 2 }],
        propinaCentavos: 300,
        direccion: '300 Calle Prueba',
        lat: 25.775,
        lng: -80.195,
        ...extra,
      },
      cliente.token,
    );
  const crear = (cuerpo: Record<string, unknown>, token = dueno.token) =>
    m.llamar(
      'POST',
      '/datos/mi-restaurante/promociones',
      { iniciaEn: '2020-01-01', venceEn: '2099-01-01', ...cuerpo },
      token,
    );
  const encender = (encendidas: boolean) =>
    m.llamar('PUT', '/datos/admin/promociones', { encendidas }, admin.token);
  return { m, dueno, admin, cliente, rid, plato, pedir, crear, encender };
}

describe('promociones del restaurante (C-PROMO-RESTAURANTE)', () => {
  it('nacen apagadas: el restaurante no puede crearlas y no se aplica nada', async () => {
    const e = await escena();
    expect(
      (await e.m.llamar('GET', '/datos/admin/promociones', undefined, e.admin.token)).datos,
    ).toEqual({
      encendidas: false,
    });
    const r = await e.crear({ tipo: 'porcentaje', valor: 2000 });
    expect(r.estado).toBe(409);
    const mias = await e.m.llamar(
      'GET',
      '/datos/mi-restaurante/promociones',
      undefined,
      e.dueno.token,
    );
    expect(mias.datos).toMatchObject({ disponible: false, promociones: [] });
    // Solo el superadmin enciende.
    expect(
      (await e.m.llamar('PUT', '/datos/admin/promociones', { encendidas: true }, e.dueno.token))
        .estado,
    ).toBe(403);
  });

  it('20 % de descuento: sale del pago del restaurante; Divoox y el repartidor quedan igual', async () => {
    const e = await escena();
    const sin = await e.pedir();
    await e.encender(true);
    expect((await e.crear({ tipo: 'porcentaje', valor: 2000, topeCentavos: 500 })).estado).toBe(
      201,
    );
    // El cliente ve la insignia en la lista y en la ficha.
    const lista = await e.m.llamar(
      'GET',
      '/datos/restaurantes?lat=25.78&lng=-80.2',
      undefined,
      e.cliente.token,
    );
    const enLista = lista.datos.restaurantes.find((x: { id: string }) => x.id === e.rid);
    expect(enLista.promocion).toMatchObject({ tipo: 'porcentaje', valor: 2000, topeCentavos: 500 });
    const ficha = await e.m.llamar(
      'GET',
      `/datos/restaurantes/${e.rid}`,
      undefined,
      e.cliente.token,
    );
    expect(ficha.datos.promociones).toHaveLength(1);

    const con = await e.pedir();
    expect(con.estado).toBe(201);
    const a = sin.datos.desglose;
    const b = con.datos.desglose;
    // 20 % de 30 dólares son 6, con tope de 5.
    expect(b.descuentoRestaurante).toBe(500);
    expect(b.totalCliente).toBe(a.totalCliente - 500);
    expect(b.pagoRestaurante).toBe(a.pagoRestaurante - 500);
    expect(b.gananciaPlataforma).toBe(a.gananciaPlataforma);
    expect(b.pagoRepartidor).toBe(a.pagoRepartidor);
    expect(b.comisionRestaurante).toBe(a.comisionRestaurante);
    const f = await e.m.DB.prepare(
      'SELECT p.pago_restaurante, pp.descuento FROM pedidos p JOIN pedidos_promocion pp ON pp.pedido_id = p.id WHERE p.id = ?',
    )
      .bind(con.datos.pedidoId)
      .first<{ pago_restaurante: number; descuento: number }>();
    expect(f).toEqual({ pago_restaurante: b.pagoRestaurante, descuento: 500 });
    // El cliente lo ve en su pedido.
    const ver = await e.m.llamar(
      'GET',
      `/datos/pedidos/${con.datos.pedidoId}`,
      undefined,
      e.cliente.token,
    );
    expect(ver.datos.pedido.descuentoRestaurante).toBe(500);
    // La app manda el total que vio: si no contó la promoción, se le devuelve el correcto.
    const viejo = await e.pedir({ totalEsperado: a.totalCliente });
    expect(viejo.estado).toBe(409);
    expect(viejo.datos.nuevoTotal).toBe(b.totalCliente);
  });

  it('se entrega, la venta abonada es la de la promoción y la conciliación cuadra', async () => {
    const e = await escena();
    await e.encender(true);
    await e.crear({ tipo: 'gasta_ahorra', valor: 400, minimoSubtotal: 2500 });
    const p = await e.pedir();
    const id = p.datos.pedidoId as string;
    expect(p.datos.desglose.descuentoRestaurante).toBe(400);
    await e.m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
    )
      .bind(id)
      .run();
    const rep = await e.m.cuenta('repartidor', 'Rita Promo');
    await e.m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.771, lng: -80.191 },
      rep.token,
    );
    await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 5 },
      e.dueno.token,
    );
    await e.m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, e.dueno.token);
    await e.m.recoger(id, rep.token, e.dueno.token);
    expect((await e.m.entregar(id, rep.token)).estado).toBe(200);
    const venta = await e.m.DB.prepare(
      "SELECT monto FROM movimientos WHERE pedido_id = ? AND usuario_id = ? AND concepto = 'venta'",
    )
      .bind(id, e.dueno.id)
      .first<{ monto: number }>();
    expect(venta?.monto).toBe(p.datos.desglose.pagoRestaurante);
    const hoy = new Date().toISOString().slice(0, 10);
    const c = await conciliar(e.m.DB, hoy);
    expect(c.detalle.cuadraRestaurantes).toBe('sí');
    expect(c.detalle.cuadraRepartidores).toBe('sí');
    // El restaurante ve el uso y lo que le costó.
    const mias = await e.m.llamar(
      'GET',
      '/datos/mi-restaurante/promociones',
      undefined,
      e.dueno.token,
    );
    expect(mias.datos.promociones[0]).toMatchObject({ usos: 1, costoCentavos: 400, vigente: true });
  });

  it('envío gratis lo paga el restaurante y sigue al envío si cambia la dirección', async () => {
    const e = await escena();
    await e.encender(true);
    await e.crear({ tipo: 'envio_gratis' });
    const p = await e.pedir();
    const d = p.datos.desglose;
    expect(d.descuentoRestaurante).toBe(d.envio);
    const id = p.datos.pedidoId as string;
    const cambio = await e.m.llamar(
      'PATCH',
      `/datos/pedidos/${id}/direccion`,
      { direccion: '900 Calle Lejos', lat: 25.86, lng: -80.19, aceptarTotal: true },
      e.cliente.token,
    );
    expect(cambio.estado).toBe(200);
    const f = await e.m.DB.prepare(
      'SELECT p.envio, p.total, p.pago_restaurante, pp.descuento FROM pedidos p JOIN pedidos_promocion pp ON pp.pedido_id = p.id WHERE p.id = ?',
    )
      .bind(id)
      .first<{ envio: number; total: number; pago_restaurante: number; descuento: number }>();
    expect(f!.envio).toBeGreaterThan(d.envio);
    expect(f!.descuento).toBe(f!.envio);
    expect(f!.total).toBe(d.totalCliente);
    expect(f!.pago_restaurante).toBe(d.pagoRestaurante - (f!.envio - d.envio));
  });

  it('reglas: fechas, mínimo, tope de usos, porcentaje de 1 a 50, terminar y solo el manager', async () => {
    const e = await escena();
    await e.encender(true);
    expect((await e.crear({ tipo: 'porcentaje', valor: 6000 })).estado).toBe(400);
    expect(
      (await e.crear({ tipo: 'gasta_ahorra', valor: 3000, minimoSubtotal: 2000 })).estado,
    ).toBe(400);
    expect((await e.crear({ tipo: 'gasta_ahorra', valor: 0, minimoSubtotal: 2000 })).estado).toBe(
      400,
    );
    expect(
      (await e.crear({ tipo: 'envio_gratis', iniciaEn: '2099-01-02', venceEn: '2099-01-01' }))
        .estado,
    ).toBe(400);
    // Todavía no empieza: no se aplica.
    await e.crear({ tipo: 'envio_gratis', iniciaEn: '2099-01-01', venceEn: '2099-02-01' });
    expect((await e.pedir()).datos.desglose.descuentoRestaurante).toBe(0);
    // Mínimo no alcanzado: no se aplica.
    await e.crear({ tipo: 'gasta_ahorra', valor: 500, minimoSubtotal: 9000 });
    expect((await e.pedir()).datos.desglose.descuentoRestaurante).toBe(0);
    // Un solo uso: el segundo pedido ya no la lleva.
    const una = await e.crear({ tipo: 'porcentaje', valor: 1000, usosMax: 1 });
    expect((await e.pedir()).datos.desglose.descuentoRestaurante).toBe(300);
    expect((await e.pedir()).datos.desglose.descuentoRestaurante).toBe(0);
    const id = una.datos.promociones.find((x: { tipo: string }) => x.tipo === 'porcentaje').id;
    // Terminarla: solo el dueño o un manager, y una sola vez.
    const otro = await e.m.cuenta('restaurante', 'Otro Local');
    expect(
      (
        await e.m.llamar(
          'PATCH',
          `/datos/mi-restaurante/promociones/${id}`,
          { activa: false },
          otro.token,
        )
      ).estado,
    ).toBe(404);
    const fin = await e.m.llamar(
      'PATCH',
      `/datos/mi-restaurante/promociones/${id}`,
      { activa: false },
      e.dueno.token,
    );
    expect(fin.estado).toBe(200);
    expect(
      (
        await e.m.llamar(
          'PATCH',
          `/datos/mi-restaurante/promociones/${id}`,
          { activa: false },
          e.dueno.token,
        )
      ).estado,
    ).toBe(404);
    // Apagadas desde el superadmin: dejan de aplicarse al momento.
    await e.crear({ tipo: 'porcentaje', valor: 1000 });
    expect((await e.pedir()).datos.desglose.descuentoRestaurante).toBe(300);
    await e.encender(false);
    expect((await e.pedir()).datos.desglose.descuentoRestaurante).toBe(0);
  });

  it('el panel, la app del restaurante y la app del cliente usan la misma pieza', () => {
    const raiz = join(__dirname, '..', '..', '..');
    const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');
    expect(leer('apps/panel/src/panel/Promociones.tsx')).toContain(
      '/datos/mi-restaurante/promociones',
    );
    expect(leer('apps/restaurante/src/Promociones.tsx')).toContain(
      '/datos/mi-restaurante/promociones',
    );
    expect(leer('apps/cliente/src/app/cart.tsx')).toContain('calcularConPromocion');
    expect(leer('apps/panel/src/panel/SuperPromociones.tsx')).toContain('/datos/admin/promociones');
  });
});
