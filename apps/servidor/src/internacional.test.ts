import { describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { saldoLibro } from './internacional/libro';

/**
 * Fase 2 · modelo internacional (C-COBRO-DIRECTO): pruebas 7 a 16 de la ficha
 * docs/investigaciones-rea/2026-10-18-stripe-internacional-y-cobro-directo.md. Sin Stripe real.
 * El país de prueba es US (la zona de siempre) con los interruptores encendidos solo aquí.
 */
async function escenario(config: Record<string, unknown> = {}) {
  const llamadasStripe: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    llamadasStripe.push(`${init?.method ?? 'GET'} ${url}`);
    return new Response(
      JSON.stringify({ id: 'pi_x', client_secret: 'pi_x_secret', status: 'succeeded' }),
      { status: 200 },
    );
  });
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
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
  await m.llamar(
    'PUT',
    '/datos/admin/paises/US',
    {
      efectivoActivo: true,
      recargasPuntoVentaActivas: true,
      comisionPb: 1000,
      cargoFijo: 0,
      ...config,
    },
    admin.token,
  );
  const pedir = (extra: Record<string, unknown> = {}) =>
    m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 2 }],
        propinaCentavos: 200,
        direccion: '300 Calle Prueba',
        lat: 25.775,
        lng: -80.195,
        metodoPago: 'efectivo',
        ...extra,
      },
      cliente.token,
    );
  async function repartidor(nombre: string) {
    const d = await m.cuenta('repartidor', nombre);
    await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.771, lng: -80.191 },
      d.token,
    );
    return d;
  }
  /** Un punto de venta con fondo, y un código por `monto` para el repartidor. */
  async function recargar(rep: { token: string }, monto: number) {
    const duenoPunto = await m.cuenta('cliente', 'Tienda Recargas');
    const punto = await m.llamar(
      'POST',
      '/datos/admin/puntos-venta',
      { nombre: 'Tienda Esquina', pais: 'US', usuarioId: duenoPunto.id },
      admin.token,
    );
    await m.llamar(
      'POST',
      `/datos/admin/puntos-venta/${punto.datos.punto.id}/fondo`,
      { monto: monto * 10, comprobante: 'transferencia-001' },
      admin.token,
    );
    const codigo = await m.llamar(
      'POST',
      '/datos/punto-venta/codigos',
      { monto },
      duenoPunto.token,
    );
    const canje = await m.llamar(
      'POST',
      '/datos/repartidor/recargar',
      { codigo: codigo.datos.codigo },
      rep.token,
    );
    return { punto: punto.datos.punto, duenoPunto, codigo: codigo.datos, canje };
  }
  const ofertasDe = async (rep: { token: string }) =>
    (await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token)).datos.ofertas as {
      id: string;
    }[];
  return { m, dueno, admin, cliente, rid, pedir, repartidor, recargar, ofertasDe, llamadasStripe };
}

describe('cobro directo: pedido en efectivo de punta a punta (C-COBRO-DIRECTO)', () => {
  it('sin el interruptor del país, la API rechaza efectivo; con él, el pedido nace confirmado y Stripe no se toca', async () => {
    const e = await escenario({ efectivoActivo: false });
    const no = await e.pedir();
    expect(no.estado).toBe(409);
    expect(no.datos.campo).toBe('metodoPago');
    await e.m.llamar('PUT', '/datos/admin/paises/US', { efectivoActivo: true }, e.admin.token);
    const si = await e.pedir();
    expect(si.estado).toBe(201);
    expect(si.datos.directo).toBe(true);
    const f = await e.m.DB.prepare(
      'SELECT estado, metodo_pago, cobro_estado, conciliacion_estado FROM pedidos WHERE id = ?',
    )
      .bind(si.datos.pedidoId)
      .first<Record<string, string>>();
    expect(f).toMatchObject({
      estado: 'pagado',
      metodo_pago: 'efectivo',
      cobro_estado: 'pendiente',
      conciliacion_estado: 'pendiente',
    });
    expect(e.llamadasStripe.filter((l) => /payment_intents|customers/.test(l))).toHaveLength(0);
  });

  it('sin saldo prepago el pedido en efectivo no se le ofrece ni se le deja aceptar; con recarga por código sí, y la comisión queda reservada', async () => {
    const e = await escenario();
    const p = await e.pedir();
    const id = p.datos.pedidoId as string;
    await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 5 },
      e.dueno.token,
    );
    const rep = await e.repartidor('Rafa Rep');
    expect(await e.ofertasDe(rep)).toHaveLength(0);
    // Forzar la oferta a mano para comprobar que aceptar también se niega sin saldo.
    await e.m.DB.prepare(
      "INSERT INTO ofertas (pedido_id, repartidor_id, estado) VALUES (?, ?, 'ofrecida')",
    )
      .bind(id, rep.id)
      .run();
    const sinSaldo = await e.m.llamar(
      'POST',
      `/datos/repartidor/ofertas/${id}/aceptar`,
      {},
      rep.token,
    );
    expect(sinSaldo.estado).toBe(409);
    expect(sinSaldo.datos.error).toMatch(/saldo|balance/i);
    const { canje } = await e.recargar(rep, 1000);
    expect(canje.estado).toBe(200);
    expect(canje.datos.disponible).toBe(1000);
    // La oferta forzada se borra: así el despacho real puede volver a ofrecérselo (un rechazo o
    // vencimiento no se repite al mismo repartidor).
    await e.m.DB.prepare('DELETE FROM ofertas WHERE pedido_id = ?').bind(id).run();
    const ofertas = await e.ofertasDe(rep);
    expect(ofertas.map((o) => o.id)).toEqual([id]);
    expect(
      (await e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token)).estado,
    ).toBe(200);
    // Comisión: 10 % de la comida (3000) = 300, apartada del prepago.
    const saldo = await e.m.llamar('GET', '/datos/repartidor/saldo-prepago', undefined, rep.token);
    expect(saldo.datos).toMatchObject({ disponible: 700, reservado: 300 });
  });

  it('entrega + «cobré» el total → conciliado: la comisión pasa a Tumbite; la entrega no crea abonos en la billetera', async () => {
    const e = await escenario();
    const p = await e.pedir();
    const id = p.datos.pedidoId as string;
    const total = p.datos.desglose.totalCliente as number;
    await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 5 },
      e.dueno.token,
    );
    const rep = await e.repartidor('Rafa Rep');
    await e.recargar(rep, 1000);
    expect((await e.ofertasDe(rep)).map((o) => o.id)).toEqual([id]);
    await e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, e.dueno.token);
    await e.m.recoger(id, rep.token, e.dueno.token);
    // Marcar entregado NO cambia el cobro (tres estados separados).
    expect((await e.m.entregar(id, rep.token)).estado).toBe(200);
    let f = await e.m.DB.prepare(
      'SELECT estado, cobro_estado, conciliacion_estado FROM pedidos WHERE id = ?',
    )
      .bind(id)
      .first<Record<string, string>>();
    expect(f).toMatchObject({
      estado: 'entregado',
      cobro_estado: 'pendiente',
      conciliacion_estado: 'pendiente',
    });
    // Nada de dinero por Tumbite: ni venta al restaurante ni entrega al repartidor en movimientos.
    const mov = await e.m.DB.prepare('SELECT COUNT(*) AS n FROM movimientos WHERE pedido_id = ?')
      .bind(id)
      .first<{ n: number }>();
    expect(Number(mov?.n)).toBe(0);
    // «Cobré» el total sin propina (la propina en efectivo es del repartidor y queda fuera).
    const cobre = await e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/cobre`,
      { montoRecibido: total - 200, nota: 'billete de 50' },
      rep.token,
    );
    expect(cobre.estado).toBe(200);
    expect(cobre.datos.cobroEstado).toBe('confirmado');
    f = await e.m.DB.prepare('SELECT cobro_estado, conciliacion_estado FROM pedidos WHERE id = ?')
      .bind(id)
      .first<Record<string, string>>();
    expect(f).toMatchObject({ cobro_estado: 'confirmado', conciliacion_estado: 'conciliado' });
    expect(await saldoLibro(e.m.DB, 'tumbite', 'comisiones', 'US', 'USD')).toBe(300);
    const saldo = await e.m.llamar('GET', '/datos/repartidor/saldo-prepago', undefined, rep.token);
    expect(saldo.datos).toMatchObject({ disponible: 700, reservado: 0 });
    // Segundo «cobré»: no se repite.
    expect(
      (
        await e.m.llamar(
          'POST',
          `/datos/repartidor/pedidos/${id}/cobre`,
          { montoRecibido: 1, nota: '' },
          rep.token,
        )
      ).estado,
    ).toBe(409);
    // Reconstrucción: cuánto pagó el cliente, qué recibió cada uno, qué ganó Tumbite.
    const libro = await e.m.llamar(
      'GET',
      `/datos/admin/libro/pedido/${id}`,
      undefined,
      e.admin.token,
    );
    const conceptos = libro.datos.movimientos.map((x: { concepto: string }) => x.concepto);
    expect(conceptos).toEqual(
      expect.arrayContaining([
        'reserva_comision',
        'cobro_efectivo',
        'comision_cobrada',
        'pagado_en_local_por_repartidor',
      ]),
    );
  });

  it('pago de menos → con_diferencia y deuda del cliente; el cliente con deuda no puede pedir en efectivo', async () => {
    const e = await escenario();
    const p = await e.pedir();
    const id = p.datos.pedidoId as string;
    const total = p.datos.desglose.totalCliente as number;
    await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 5 },
      e.dueno.token,
    );
    const rep = await e.repartidor('Rafa Rep');
    await e.recargar(rep, 1000);
    expect((await e.ofertasDe(rep)).map((o) => o.id)).toEqual([id]);
    await e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, e.dueno.token);
    await e.m.recoger(id, rep.token, e.dueno.token);
    await e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/cobre`,
      { montoRecibido: total - 200 - 500, nota: 'le faltaron 5' },
      rep.token,
    );
    await e.m.entregar(id, rep.token);
    const f = await e.m.DB.prepare(
      'SELECT cobro_estado, conciliacion_estado FROM pedidos WHERE id = ?',
    )
      .bind(id)
      .first<Record<string, string>>();
    expect(f).toMatchObject({ cobro_estado: 'parcial', conciliacion_estado: 'con_diferencia' });
    const deuda = await e.m.llamar('GET', '/datos/mi-deuda', undefined, e.cliente.token);
    expect(deuda.datos.deuda).toBe(500);
    // La comisión completa igual se cobra (300) y no se le cobra de más al repartidor.
    expect(await saldoLibro(e.m.DB, 'tumbite', 'comisiones', 'US', 'USD')).toBe(300);
    const otro = await e.pedir();
    expect(otro.estado).toBe(409);
    expect(otro.datos.error).toMatch(/saldo pendiente|outstanding/);
  });

  it('cliente que no paga: el pedido se cancela, la comisión reservada vuelve y el cliente queda con deuda', async () => {
    const e = await escenario();
    const p = await e.pedir();
    const id = p.datos.pedidoId as string;
    await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 5 },
      e.dueno.token,
    );
    const rep = await e.repartidor('Rafa Rep');
    await e.recargar(rep, 1000);
    expect((await e.ofertasDe(rep)).map((o) => o.id)).toEqual([id]);
    await e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, e.dueno.token);
    await e.m.recoger(id, rep.token, e.dueno.token);
    const r = await e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/no-pago`,
      { motivo: 'se niega a pagar' },
      rep.token,
    );
    expect(r.estado).toBe(200);
    const f = await e.m.DB.prepare('SELECT estado, cobro_estado FROM pedidos WHERE id = ?')
      .bind(id)
      .first<Record<string, string>>();
    expect(f).toMatchObject({ estado: 'cancelado', cobro_estado: 'no_pagado' });
    const saldo = await e.m.llamar('GET', '/datos/repartidor/saldo-prepago', undefined, rep.token);
    expect(saldo.datos).toMatchObject({ disponible: 1000, reservado: 0 });
    expect(
      (await e.m.llamar('GET', '/datos/mi-deuda', undefined, e.cliente.token)).datos.deuda,
    ).toBe(p.datos.desglose.totalCliente - 200);
  });

  it('soltar el pedido o cancelarlo libera la reserva; nada queda en negativo', async () => {
    const e = await escenario();
    const p = await e.pedir();
    const id = p.datos.pedidoId as string;
    await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 5 },
      e.dueno.token,
    );
    const rep = await e.repartidor('Rafa Rep');
    await e.recargar(rep, 300);
    expect((await e.ofertasDe(rep)).map((o) => o.id)).toEqual([id]);
    await e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    expect(
      (await e.m.llamar('GET', '/datos/repartidor/saldo-prepago', undefined, rep.token)).datos,
    ).toMatchObject({ disponible: 0, reservado: 300 });
    await e.m.llamar(
      'POST',
      `/datos/admin/pedidos/${id}/soltar-repartidor`,
      { motivo: 'prueba' },
      e.admin.token,
    );
    expect(
      (await e.m.llamar('GET', '/datos/repartidor/saldo-prepago', undefined, rep.token)).datos,
    ).toMatchObject({ disponible: 300, reservado: 0 });
    await e.m.llamar(
      'POST',
      `/datos/admin/pedidos/${id}/cancelar`,
      { motivo: 'prueba' },
      e.admin.token,
    );
    const salud = (await (await e.m.crudo('/datos/salud', { method: 'GET' })).json()) as {
      piezas: Record<string, string>;
    };
    expect(salud.piezas.libro).toBe('ok');
  });
});

describe('recargas por punto de venta (C-COBRO-DIRECTO)', () => {
  it('el código se canjea una sola vez, el punto no emite más de su fondo, anular devuelve el fondo y adivinar se bloquea', async () => {
    const e = await escenario();
    const rep = await e.repartidor('Rafa Rep');
    const { punto, duenoPunto, codigo } = await e.recargar(rep, 1000);
    // Segundo canje del mismo código: «ya se usó».
    const repetido = await e.m.llamar(
      'POST',
      '/datos/repartidor/recargar',
      { codigo: codigo.codigo },
      rep.token,
    );
    expect(repetido.estado).toBe(409);
    expect(
      (await e.m.llamar('GET', '/datos/repartidor/saldo-prepago', undefined, rep.token)).datos
        .disponible,
    ).toBe(1000);
    // El punto tenía 10 000; emitió 1000; no puede emitir 20 000.
    const demasiado = await e.m.llamar(
      'POST',
      '/datos/punto-venta/codigos',
      { monto: 20_000 },
      duenoPunto.token,
    );
    expect(demasiado.estado).toBe(409);
    const estado = await e.m.llamar('GET', '/datos/punto-venta', undefined, duenoPunto.token);
    expect(estado.datos.fondo).toBe(9000);
    // Emitir y anular devuelve el fondo; anular uno canjeado no se puede.
    const otro = await e.m.llamar(
      'POST',
      '/datos/punto-venta/codigos',
      { monto: 500 },
      duenoPunto.token,
    );
    expect(
      (await e.m.llamar('GET', '/datos/punto-venta', undefined, duenoPunto.token)).datos.fondo,
    ).toBe(8500);
    expect(
      (
        await e.m.llamar(
          'POST',
          `/datos/punto-venta/codigos/${otro.datos.id}/anular`,
          {},
          duenoPunto.token,
        )
      ).estado,
    ).toBe(200);
    expect(
      (await e.m.llamar('GET', '/datos/punto-venta', undefined, duenoPunto.token)).datos.fondo,
    ).toBe(9000);
    expect(
      (
        await e.m.llamar(
          'POST',
          `/datos/punto-venta/codigos/${codigo.id}/anular`,
          {},
          duenoPunto.token,
        )
      ).estado,
    ).toBe(409);
    // Diez códigos inventados → bloqueo por una hora.
    for (let i = 0; i < 10; i++)
      expect(
        (
          await e.m.llamar(
            'POST',
            '/datos/repartidor/recargar',
            { codigo: `AAAA-BBBB-${String(1000 + i)}` },
            rep.token,
          )
        ).estado,
      ).toBe(409);
    const bloqueado = await e.m.llamar(
      'POST',
      '/datos/repartidor/recargar',
      { codigo: codigo.codigo },
      rep.token,
    );
    expect(bloqueado.datos.error).toMatch(/Demasiados intentos|Too many/);
    void punto;
  });

  it('dos canjes simultáneos del mismo código: solo uno acredita', async () => {
    const e = await escenario();
    const rep = await e.repartidor('Rafa Rep');
    const otroRep = await e.repartidor('Rosa Rep');
    const duenoPunto = await e.m.cuenta('cliente', 'Tienda');
    const punto = await e.m.llamar(
      'POST',
      '/datos/admin/puntos-venta',
      { nombre: 'Tienda', pais: 'US', usuarioId: duenoPunto.id },
      e.admin.token,
    );
    await e.m.llamar(
      'POST',
      `/datos/admin/puntos-venta/${punto.datos.punto.id}/fondo`,
      { monto: 5000, comprobante: 'c-1' },
      e.admin.token,
    );
    const codigo = await e.m.llamar(
      'POST',
      '/datos/punto-venta/codigos',
      { monto: 1000 },
      duenoPunto.token,
    );
    const [a, b] = await Promise.all([
      e.m.llamar('POST', '/datos/repartidor/recargar', { codigo: codigo.datos.codigo }, rep.token),
      e.m.llamar(
        'POST',
        '/datos/repartidor/recargar',
        { codigo: codigo.datos.codigo },
        otroRep.token,
      ),
    ]);
    expect([a.estado, b.estado].sort()).toEqual([200, 409]);
    const total =
      (await saldoLibro(e.m.DB, rep.id, 'prepago', 'US', 'USD')) +
      (await saldoLibro(e.m.DB, otroRep.id, 'prepago', 'US', 'USD'));
    expect(total).toBe(1000);
  });

  it('la recarga con tarjeta queda pendiente hasta el aviso de Stripe y se acredita una sola vez', async () => {
    const e = await escenario({ recargasStripeActivas: true });
    const rep = await e.repartidor('Rafa Rep');
    const r = await e.m.llamar(
      'POST',
      '/datos/repartidor/recargas/stripe',
      { monto: 2500 },
      rep.token,
    );
    expect(r.estado).toBe(201);
    expect(
      (await e.m.llamar('GET', '/datos/repartidor/saldo-prepago', undefined, rep.token)).datos
        .disponible,
    ).toBe(0);
    const { acreditarRecargaStripe } = await import('./internacional/recargas');
    const obj = {
      id: 'pi_rec',
      amount_received: 2500,
      metadata: { recarga_id: r.datos.recargaId },
    };
    expect(await acreditarRecargaStripe(e.m.DB, obj)).toBe(true);
    await acreditarRecargaStripe(e.m.DB, obj);
    expect(
      (await e.m.llamar('GET', '/datos/repartidor/saldo-prepago', undefined, rep.token)).datos
        .disponible,
    ).toBe(2500);
    // Monto distinto al pedido: no se acredita.
    const r2 = await e.m.llamar(
      'POST',
      '/datos/repartidor/recargas/stripe',
      { monto: 1000 },
      rep.token,
    );
    expect(
      await acreditarRecargaStripe(e.m.DB, {
        id: 'pi_rec2',
        amount_received: 999,
        metadata: { recarga_id: r2.datos.recargaId },
      }),
    ).toBe(false);
    expect(
      (await e.m.llamar('GET', '/datos/repartidor/saldo-prepago', undefined, rep.token)).datos
        .disponible,
    ).toBe(2500);
  });
});
