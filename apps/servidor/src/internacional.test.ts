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
  /** Paso 2 y 3 del recorrido aprobado: el repartidor paga la comida en el local y registra el ticket. */
  async function pagarLocal(
    id: string,
    rep: { token: string },
    extra: Partial<{ montoPagado: number; importeTicket: number; metodo: string }> = {},
  ) {
    const l = await m.llamar(
      'GET',
      `/datos/repartidor/pedidos/${id}/pago-local`,
      undefined,
      rep.token,
    );
    return m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/pago-local`,
      {
        montoPagado: l.datos.montoEsperado,
        importeTicket: l.datos.subtotal,
        metodo: 'efectivo',
        ...extra,
      },
      rep.token,
    );
  }
  const ofertasDe = async (rep: { token: string }) =>
    (await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token)).datos.ofertas as {
      id: string;
    }[];
  return {
    m,
    dueno,
    admin,
    cliente,
    rid,
    pedir,
    repartidor,
    recargar,
    pagarLocal,
    ofertasDe,
    llamadasStripe,
  };
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
    await e.pagarLocal(id, rep);
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

  it('la conciliación diaria no mezcla el cobro en mano con el de Stripe: el día cuadra y los pedidos en mano van aparte, por moneda (C-CONCILIACION-DIRECTA)', async () => {
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
    await e.pagarLocal(id, rep);
    await e.m.recoger(id, rep.token, e.dueno.token);
    expect((await e.m.entregar(id, rep.token)).estado).toBe(200);
    await e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/cobre`,
      { montoRecibido: total - 200, nota: '' },
      rep.token,
    );
    // Otro pedido en mano, cancelado: en mano no hubo devolución de dinero por Tumbite.
    const otro = await e.pedir();
    await e.m.llamar('POST', `/datos/pedidos/${otro.datos.pedidoId}/cancelar`, {}, e.cliente.token);
    const { conciliar } = await import('./conciliacion');
    const c = await conciliar(e.m.DB, new Date().toISOString().slice(0, 10));
    expect(c.cuadra).toBe(true);
    expect(c.vendido).toBe(0);
    expect(c.devuelto).toBe(0);
    expect(c.detalle).toMatchObject({ directos_USD: 1, directosConDiferencia_USD: 0 });
  });

  it('un pedido cobrado en mano no se deja en un lugar seguro: el camino es «El cliente no pagó»', async () => {
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
    await e.pagarLocal(id, rep);
    await e.m.recoger(id, rep.token, e.dueno.token);
    // El cliente no aparece desde hace 10 minutos (como si hubiera esperado lo que pide la regla).
    await e.m.DB.prepare(
      "INSERT OR REPLACE INTO hitos_pedido (pedido_id, hito, creado_en) VALUES (?, 'no_aparece', datetime('now', '-10 minutes'))",
    )
      .bind(id)
      .run();
    const casa = await e.m.DB.prepare('SELECT lat, lng FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ lat: number; lng: number }>();
    await e.m.envejecerGps(id);
    await e.m.ubicar(rep.token, casa!);
    await e.m.ubicar(rep.token, casa!);
    const seguro = await e.m.foto(
      `/datos/repartidor/pedidos/${id}/entregado?modo=seguro&nota=Recepcion`,
      rep.token,
      casa!,
    );
    expect(seguro.estado).toBe(409);
    expect(String(seguro.datos.error)).toMatch(/paid in person/);
    const f = await e.m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ estado: string }>();
    expect(f?.estado).toBe('en_camino');
  });

  it('después de confirmar el cobro ya no se puede marcar «el cliente no pagó»: el pedido no se cancela y la comisión no vuelve', async () => {
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
    await e.pagarLocal(id, rep);
    await e.m.recoger(id, rep.token, e.dueno.token);
    const cobre = await e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/cobre`,
      { montoRecibido: total - 200, nota: '' },
      rep.token,
    );
    expect(cobre.estado).toBe(200);
    const no = await e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/no-pago`,
      { motivo: 'no pagó' },
      rep.token,
    );
    expect(no.estado).toBe(409);
    const f = await e.m.DB.prepare('SELECT estado, cobro_estado FROM pedidos WHERE id = ?')
      .bind(id)
      .first<Record<string, string>>();
    expect(f).toMatchObject({ estado: 'en_camino', cobro_estado: 'confirmado' });
    const deuda = await e.m.DB.prepare('SELECT COUNT(*) AS n FROM libro WHERE referencia = ?')
      .bind(`deuda:${id}`)
      .first<{ n: number }>();
    expect(Number(deuda?.n)).toBe(0);
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
    await e.pagarLocal(id, rep);
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
    await e.pagarLocal(id, rep);
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

describe('pago de la comida en el local y casos límite (C-COBRO-DIRECTO-LOCAL)', () => {
  /** Pedido directo aceptado por el restaurante y por un repartidor con saldo, ya listo para recoger. */
  async function hastaListo(e: Awaited<ReturnType<typeof escenario>>, extra = {}) {
    const p = await e.pedir(extra);
    const id = p.datos.pedidoId as string;
    await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 5 },
      e.dueno.token,
    );
    const rep = await e.repartidor('Rafa Rep');
    await e.recargar(rep, 1000);
    // Las ofertas se reparten cuando el repartidor abre la app.
    expect((await e.ofertasDe(rep)).map((o) => o.id)).toContain(id);
    await e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, e.dueno.token);
    return { id, rep, total: p.datos.desglose.totalCliente as number, desglose: p.datos.desglose };
  }
  const conceptosDe = async (e: Awaited<ReturnType<typeof escenario>>, id: string) =>
    (await e.m.llamar('GET', `/datos/admin/libro/pedido/${id}`, undefined, e.admin.token)).datos
      .movimientos as { concepto: string; monto: number; cuentaId: string }[];

  it('sin registrar el pago en el local no sale; el registro es único, el restaurante lo ve y lo confirma al entregar', async () => {
    const e = await escenario();
    const { id, rep, desglose } = await hastaListo(e);
    // Sin el pago registrado, la foto de recogida no sirve (el pedido no sale).
    const sinPago = await e.m.recoger(id, rep.token, e.dueno.token);
    expect(sinPago.estado).toBe(409);
    expect(sinPago.datos.error).toMatch(/registra lo que pagaste|record what you paid/i);
    // Ni siquiera se guarda la foto de recogida: la compuerta está en la foto y en la confirmación.
    expect(
      await e.m.DB.prepare("SELECT 1 FROM evidencias WHERE pedido_id = ? AND tipo = 'recogida'")
        .bind(id)
        .first(),
    ).toBeNull();
    const ver = await e.m.llamar(
      'GET',
      `/datos/repartidor/pedidos/${id}/pago-local`,
      undefined,
      rep.token,
    );
    // Lo que paga en el mostrador es la comida menos la comisión de Tumbite (no la financia Tumbite).
    expect(ver.datos).toMatchObject({
      montoEsperado: desglose.pagoRestaurante,
      subtotal: 3000,
      registrado: null,
    });
    const r = await e.pagarLocal(id, rep, { metodo: 'tarjeta_propia' });
    expect(r.estado).toBe(201);
    expect(r.datos.registrado).toMatchObject({
      metodo: 'tarjeta_propia',
      diferenciaPago: 0,
      diferenciaTicket: 0,
    });
    // Reintento: no duplica.
    expect((await e.pagarLocal(id, rep)).estado).toBe(409);
    const restaurante = await e.m.llamar(
      'GET',
      `/datos/restaurante/pedidos/${id}/pago-local`,
      undefined,
      e.dueno.token,
    );
    expect(restaurante.datos.registrado.montoPagado).toBe(desglose.pagoRestaurante);
    expect((await e.m.recoger(id, rep.token, e.dueno.token)).estado).toBe(200);
    const fila = await e.m.DB.prepare(
      'SELECT confirmado_restaurante_en FROM pagos_local WHERE pedido_id = ?',
    )
      .bind(id)
      .first<{ confirmado_restaurante_en: string | null }>();
    expect(fila?.confirmado_restaurante_en).toBeTruthy();
    // Una tarjeta ajena al pedido: otro repartidor no ve ni registra nada.
    const otro = await e.repartidor('Otro Rep');
    expect(
      (await e.m.llamar('GET', `/datos/repartidor/pedidos/${id}/pago-local`, undefined, otro.token))
        .estado,
    ).toBe(404);
  });

  it('foto del ticket: se sube después de registrar el pago, la ven el restaurante, el cliente y soporte, y no un extraño', async () => {
    const e = await escenario();
    const { id, rep } = await hastaListo(e);
    const donde = { lat: 25.77, lng: -80.19 };
    // Antes de registrar el pago no hay dónde guardarla.
    expect(
      (await e.m.foto(`/datos/repartidor/pedidos/${id}/foto-ticket`, rep.token, donde)).estado,
    ).toBe(409);
    await e.pagarLocal(id, rep);
    const f = await e.m.foto(`/datos/repartidor/pedidos/${id}/foto-ticket`, rep.token, donde);
    expect(f.estado).toBe(200);
    const fila = await e.m.DB.prepare('SELECT ticket_clave FROM pagos_local WHERE pedido_id = ?')
      .bind(id)
      .first<{ ticket_clave: string | null }>();
    expect(fila?.ticket_clave?.startsWith(`evidencias/${id}/ticket-`)).toBe(true);
    const ver = (token: string) =>
      e.m.crudo(`/datos/pedidos/${id}/evidencia/ticket`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      });
    for (const t of [e.dueno.token, e.cliente.token, e.admin.token, rep.token])
      expect((await ver(t)).status).toBe(200);
    const extrano = await e.m.cuenta('cliente', 'Otro');
    expect((await ver(extrano.token)).status).toBe(404);
    // El equipo del restaurante (staff) también la ve; un restaurante ajeno, no.
    const staff = await e.m.cuenta('restaurante', 'Beto Staff');
    const correoStaff = (await e.m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
      .bind(staff.id)
      .first<{ correo: string }>())!.correo;
    await e.m.llamar(
      'POST',
      '/datos/mi-restaurante/equipo',
      { correo: correoStaff, rol: 'staff' },
      e.dueno.token,
    );
    expect((await ver(staff.token)).status).toBe(200);
    const otroRest = await e.m.cuenta('restaurante', 'Otro Dueño');
    expect((await ver(otroRest.token)).status).toBe(404);
    const datos = await e.m.llamar(
      'GET',
      `/datos/repartidor/pedidos/${id}/pago-local`,
      undefined,
      rep.token,
    );
    expect(datos.datos.registrado.conFotoTicket).toBe(true);
    // Repetir la foto no deja la anterior huérfana en el almacén.
    const bucket = e.m.extra.BUCKET as R2Bucket;
    const primera = fila!.ticket_clave!;
    expect(
      (await e.m.foto(`/datos/repartidor/pedidos/${id}/foto-ticket`, rep.token, donde)).estado,
    ).toBe(200);
    expect(await bucket.get(primera)).toBeNull();
    // Retención: a los 30 días se borra SOLO si el pedido quedó conciliado; con diferencia se queda.
    const { depurarFotos } = await import('./conciliacion');
    await e.m.DB.prepare(
      "UPDATE pagos_local SET creado_en = datetime('now', '-31 days') WHERE pedido_id = ?",
    )
      .bind(id)
      .run();
    await e.m.DB.prepare("UPDATE pedidos SET conciliacion_estado = 'con_diferencia' WHERE id = ?")
      .bind(id)
      .run();
    await depurarFotos(e.m.DB, bucket);
    const sigue = await e.m.DB.prepare('SELECT ticket_clave FROM pagos_local WHERE pedido_id = ?')
      .bind(id)
      .first<{ ticket_clave: string | null }>();
    expect(sigue?.ticket_clave).not.toBeNull();
    await e.m.DB.prepare("UPDATE pedidos SET conciliacion_estado = 'conciliado' WHERE id = ?")
      .bind(id)
      .run();
    await depurarFotos(e.m.DB, bucket);
    const borrada = await e.m.DB.prepare('SELECT ticket_clave FROM pagos_local WHERE pedido_id = ?')
      .bind(id)
      .first<{ ticket_clave: string | null }>();
    expect(borrada?.ticket_clave).toBeNull();
    expect(await bucket.get(sigue!.ticket_clave!)).toBeNull();
  });

  it('ticket e importe distintos: no frenan la entrega, quedan anotados y la conciliación sale «con diferencia»', async () => {
    const e = await escenario();
    const { id, rep, total, desglose } = await hastaListo(e);
    const r = await e.pagarLocal(id, rep, {
      montoPagado: desglose.pagoRestaurante + 150,
      importeTicket: 3300,
    });
    expect(r.datos.registrado).toMatchObject({ diferenciaPago: 150, diferenciaTicket: 300 });
    await e.m.recoger(id, rep.token, e.dueno.token);
    await e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/cobre`,
      { montoRecibido: total - 200 },
      rep.token,
    );
    await e.m.entregar(id, rep.token);
    const f = await e.m.DB.prepare(
      'SELECT cobro_estado, conciliacion_estado FROM pedidos WHERE id = ?',
    )
      .bind(id)
      .first<Record<string, string>>();
    expect(f).toMatchObject({ cobro_estado: 'confirmado', conciliacion_estado: 'con_diferencia' });
    const local = (await conceptosDe(e, id)).find(
      (x) => x.concepto === 'pagado_en_local_por_repartidor',
    );
    expect(local?.monto).toBe(desglose.pagoRestaurante + 150);
    const ev = await e.m.DB.prepare(
      "SELECT detalle FROM bitacora_pedidos WHERE pedido_id = ? AND evento = 'pago_local_diferencia'",
    )
      .bind(id)
      .first<{ detalle: string }>();
    expect(ev?.detalle).toMatch(/pago \+150 · ticket \+300/);
  });

  it('cancelación ANTES de comprar: solo vuelve la reserva; DESPUÉS de comprar: la comida queda como pérdida pendiente de decisión, una sola vez', async () => {
    const e = await escenario();
    // Antes de comprar.
    const a = await hastaListo(e);
    await e.m.llamar(
      'POST',
      `/datos/admin/pedidos/${a.id}/cancelar`,
      { motivo: 'prueba' },
      e.admin.token,
    );
    expect((await conceptosDe(e, a.id)).map((x) => x.concepto)).not.toContain(
      'comida_comprada_sin_entregar',
    );
    // Después de comprar (mundo nuevo: el repartidor anterior sigue libre y se llevaría la oferta).
    const e2 = await escenario();
    const b = await hastaListo(e2);
    await e2.pagarLocal(b.id, b.rep);
    // El repartidor no puede soltarlo: ya pagó la comida.
    const soltar = await e2.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${b.id}/soltar`,
      { motivo: 'me voy' },
      b.rep.token,
    );
    expect(soltar.estado).toBe(409);
    await e2.m.llamar(
      'POST',
      `/datos/admin/pedidos/${b.id}/cancelar`,
      { motivo: 'prueba' },
      e2.admin.token,
    );
    const filas = (await conceptosDe(e2, b.id)).filter(
      (x) => x.concepto === 'comida_comprada_sin_entregar',
    );
    expect(filas).toHaveLength(1);
    expect(filas[0]?.monto).toBe(-b.desglose.pagoRestaurante);
    const saldo = await e2.m.llamar(
      'GET',
      '/datos/repartidor/saldo-prepago',
      undefined,
      b.rep.token,
    );
    expect(saldo.datos.reservado).toBe(0);
    // Soporte suelta al repartidor después de comprar: también queda la pérdida y el siguiente paga lo suyo.
    const e3 = await escenario();
    const c = await hastaListo(e3);
    await e3.pagarLocal(c.id, c.rep);
    await e3.m.llamar(
      'POST',
      `/datos/admin/pedidos/${c.id}/soltar-repartidor`,
      { motivo: 'se accidentó' },
      e3.admin.token,
    );
    expect((await conceptosDe(e3, c.id)).map((x) => x.concepto)).toContain(
      'comida_comprada_sin_entregar',
    );
    expect(
      await e3.m.DB.prepare('SELECT 1 FROM pagos_local WHERE pedido_id = ?').bind(c.id).first(),
    ).toBeNull();
  });

  it('cliente que no paga después de comprar la comida: deuda del cliente y pérdida del repartidor pendiente de decisión', async () => {
    const e = await escenario();
    const { id, rep } = await hastaListo(e);
    await e.pagarLocal(id, rep);
    await e.m.recoger(id, rep.token, e.dueno.token);
    await e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/no-pago`,
      { motivo: 'no abrió' },
      rep.token,
    );
    const conceptos = (await conceptosDe(e, id)).map((x) => x.concepto);
    expect(conceptos).toEqual(
      expect.arrayContaining(['cliente_no_pago', 'comida_comprada_sin_entregar']),
    );
    const ev = await e.m.DB.prepare(
      "SELECT 1 FROM bitacora_pedidos WHERE pedido_id = ? AND evento = 'perdida_pendiente_decision'",
    )
      .bind(id)
      .first();
    expect(ev).not.toBeNull();
  });

  it('transferencia: pendiente de verificar no cierra nada; duplicada deja el excedente escrito; la propina no cuenta como excedente; la confirmación es manual y queda quién, cuánto y cuándo', async () => {
    const e = await escenario({ transferenciaRepartidorActiva: true });
    const t = await hastaListo(e, { metodoPago: 'transferencia_repartidor' });
    await e.pagarLocal(t.id, t.rep);
    await e.m.recoger(t.id, t.rep.token, e.dueno.token);
    const pend = await e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${t.id}/transferencia-pendiente`,
      { nota: 'dice que ya transfirió' },
      t.rep.token,
    );
    expect(pend.estado).toBe(200);
    expect((await e.m.entregar(t.id, t.rep.token)).estado).toBe(200);
    let f = await e.m.DB.prepare(
      'SELECT cobro_estado, conciliacion_estado FROM pedidos WHERE id = ?',
    )
      .bind(t.id)
      .first<Record<string, string>>();
    expect(f).toMatchObject({ cobro_estado: 'pendiente', conciliacion_estado: 'pendiente' });
    expect(
      (await e.m.llamar('GET', '/datos/repartidor/saldo-prepago', undefined, t.rep.token)).datos
        .reservado,
    ).toBe(300);
    // Llegó dos veces: el repartidor confirma lo que de verdad vio (el doble).
    const esperado = t.total - 200;
    await e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${t.id}/cobre`,
      { montoRecibido: esperado * 2, nota: 'llegó repetida' },
      t.rep.token,
    );
    f = await e.m.DB.prepare(
      'SELECT cobro_estado, conciliacion_estado, cobro_confirmado_por, cobro_confirmado_en, monto_recibido FROM pedidos WHERE id = ?',
    )
      .bind(t.id)
      .first<Record<string, string>>();
    expect(f).toMatchObject({
      cobro_estado: 'confirmado',
      conciliacion_estado: 'con_diferencia',
      cobro_confirmado_por: 'repartidor',
    });
    expect(f?.cobro_confirmado_en).toBeTruthy();
    const ex = (await conceptosDe(e, t.id)).find(
      (x) => x.concepto === 'excedente_cliente_por_devolver',
    );
    // Excedente = lo recibido − lo esperado − la propina (que es del repartidor).
    expect(ex?.monto).toBe(-(esperado * 2 - esperado - 200));
    const ev = await e.m.DB.prepare(
      "SELECT detalle FROM bitacora_pedidos WHERE pedido_id = ? AND evento = 'cobro_confirmado'",
    )
      .bind(t.id)
      .first<{ detalle: string }>();
    expect(ev?.detalle).toMatch(/confirmación manual del repartidor/);
    // La comisión se cobra una sola vez (300), aunque se reintente la conciliación.
    expect(await saldoLibro(e.m.DB, 'tumbite', 'comisiones', 'US', 'USD')).toBe(300);
    // Con propina en mano (recibió el total con la propina): no es excedente.
    const e2 = await escenario({ transferenciaRepartidorActiva: true });
    const u = await hastaListo(e2);
    await e2.pagarLocal(u.id, u.rep);
    await e2.m.recoger(u.id, u.rep.token, e2.dueno.token);
    await e2.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${u.id}/cobre`,
      { montoRecibido: u.total },
      u.rep.token,
    );
    await e2.m.entregar(u.id, u.rep.token);
    const g = await e2.m.DB.prepare('SELECT conciliacion_estado FROM pedidos WHERE id = ?')
      .bind(u.id)
      .first<{ conciliacion_estado: string }>();
    expect(g?.conciliacion_estado).toBe('conciliado');
  });

  it('transferencia que nunca llegó o fue a otra cuenta: el repartidor confirma 0, el cliente queda con deuda y puede abrir una disputa', async () => {
    const e = await escenario({ transferenciaRepartidorActiva: true });
    const t = await hastaListo(e, { metodoPago: 'transferencia_repartidor' });
    await e.pagarLocal(t.id, t.rep);
    await e.m.recoger(t.id, t.rep.token, e.dueno.token);
    await e.m.entregar(t.id, t.rep.token);
    await e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${t.id}/cobre`,
      { montoRecibido: 0, nota: 'no llegó' },
      t.rep.token,
    );
    const f = await e.m.DB.prepare(
      'SELECT cobro_estado, conciliacion_estado FROM pedidos WHERE id = ?',
    )
      .bind(t.id)
      .first<Record<string, string>>();
    expect(f).toMatchObject({ cobro_estado: 'no_pagado', conciliacion_estado: 'con_diferencia' });
    expect(
      (await e.m.llamar('GET', '/datos/mi-deuda', undefined, e.cliente.token)).datos.deuda,
    ).toBe(t.total - 200);
    const disputa = await e.m.llamar(
      'POST',
      `/datos/pedidos/${t.id}/disputa-cobro`,
      { motivo: 'transferí a la cuenta que salía en la app' },
      e.cliente.token,
    );
    expect(disputa.estado).toBe(201);
  });

  it('devolución en un pedido pagado en mano: no se toca Stripe y el error lo explica', async () => {
    const e = await escenario();
    const { id, rep, total } = await hastaListo(e);
    await e.pagarLocal(id, rep);
    await e.m.recoger(id, rep.token, e.dueno.token);
    await e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/cobre`,
      { montoRecibido: total - 200 },
      rep.token,
    );
    await e.m.entregar(id, rep.token);
    const antes = e.llamadasStripe.length;
    const r = await e.m.llamar(
      'POST',
      `/datos/admin/pedidos/${id}/devolver`,
      { montoCentavos: 500, motivo: 'faltó un plato', cargarA: 'tumbite' },
      e.admin.token,
    );
    expect(r.estado).toBe(409);
    expect(r.datos.error).toMatch(/pagó en mano|paid in hand/);
    expect(e.llamadasStripe.length).toBe(antes);
  });

  it('dos aceptaciones simultáneas con saldo para una sola comisión: solo una aparta, nada queda en negativo', async () => {
    const e = await escenario();
    const p1 = (await e.pedir()).datos.pedidoId as string;
    const p2 = (await e.pedir()).datos.pedidoId as string;
    for (const id of [p1, p2])
      await e.m.llamar(
        'POST',
        `/datos/restaurante/pedidos/${id}/aceptar`,
        { minutos: 5 },
        e.dueno.token,
      );
    const rep = await e.repartidor('Rafa Rep');
    await e.recargar(rep, 300);
    await e.ofertasDe(rep);
    const r = await Promise.all(
      [p1, p2].map((id) =>
        e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token),
      ),
    );
    const saldo = await e.m.llamar('GET', '/datos/repartidor/saldo-prepago', undefined, rep.token);
    expect(saldo.datos).toMatchObject({ disponible: 0, reservado: 300 });
    expect(r.filter((x) => x.estado === 200).length).toBeLessThanOrEqual(1);
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

  it('recargas endurecidas: comprobante repetido = 409, punto desactivado = códigos sin valor, soporte anula y el fondo vuelve, el reintento tras una caída acredita una sola vez', async () => {
    const e = await escenario();
    const duenoPunto = await e.m.cuenta('cliente', 'Tienda Dos');
    const punto = await e.m.llamar(
      'POST',
      '/datos/admin/puntos-venta',
      { nombre: 'Tienda Dos', pais: 'US', usuarioId: duenoPunto.id },
      e.admin.token,
    );
    const pid = punto.datos.punto.id as string;
    const fondo = (comprobante: string) =>
      e.m.llamar(
        'POST',
        `/datos/admin/puntos-venta/${pid}/fondo`,
        { monto: 5000, comprobante },
        e.admin.token,
      );
    expect((await fondo('pago-001')).estado).toBe(200);
    // El mismo comprobante otra vez no suma y se dice (antes respondía 200 sin sumar).
    expect((await fondo('pago-001')).estado).toBe(409);
    const emitir = () =>
      e.m.llamar('POST', '/datos/punto-venta/codigos', { monto: 1000 }, duenoPunto.token);
    const a = await emitir();
    const b = await emitir();
    const rep = await e.repartidor('Rafa Rep');
    // Reintento tras una caída: el código quedó canjeado por él, pero el saldo no llegó.
    await e.m.DB.prepare(
      "UPDATE codigos_recarga SET estado = 'canjeado', canjeado_por = ?, canjeado_en = datetime('now') WHERE id = ?",
    )
      .bind(rep.id, a.datos.id)
      .run();
    const canje = (codigo: string) =>
      e.m.llamar('POST', '/datos/repartidor/recargar', { codigo }, rep.token);
    expect((await canje(a.datos.codigo)).estado).toBe(200);
    expect((await canje(a.datos.codigo)).estado).toBe(409);
    const saldo = await e.m.llamar('GET', '/datos/repartidor/saldo-prepago', undefined, rep.token);
    expect(saldo.datos.disponible).toBe(1000);
    // Soporte desactiva el punto: el código que quedaba en la calle ya no sirve.
    await e.m.DB.prepare('UPDATE puntos_venta SET activo = 0 WHERE id = ?').bind(pid).run();
    expect((await canje(b.datos.codigo)).estado).toBe(409);
    // Soporte lo anula (código perdido o robado) y el fondo vuelve al punto, una sola vez.
    const anular = () =>
      e.m.llamar('POST', `/datos/admin/codigos-recarga/${b.datos.id}/anular`, {}, e.admin.token);
    expect((await anular()).estado).toBe(200);
    expect((await anular()).estado).toBe(409);
    const { saldoLibro, cuentaPunto } = await import('./internacional/libro');
    expect(await saldoLibro(e.m.DB, cuentaPunto(pid), 'punto', 'US', 'USD')).toBe(4000);
    // Solo soporte puede anular por esta ruta.
    expect(
      (await e.m.llamar('POST', `/datos/admin/codigos-recarga/${b.datos.id}/anular`, {}, rep.token))
        .estado,
    ).toBe(403);
  });

  it('el tope semanal de recargas también vale para la tarjeta (cuenta las pendientes)', async () => {
    const e = await escenario({ recargasStripeActivas: true, recargasSemanaMax: 2 });
    const rep = await e.repartidor('Rafa Rep');
    const pedir = () =>
      e.m.llamar('POST', '/datos/repartidor/recargas/stripe', { monto: 1000 }, rep.token);
    expect((await pedir()).estado).toBe(201);
    expect((await pedir()).estado).toBe(201);
    expect((await pedir()).estado).toBe(409);
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

describe('pantallas del cobro directo en las apps y Docs (C-COBRO-DIRECTO)', () => {
  it('la ruta pública /datos/pais dice qué formas de pago hay, según el país de la zona', async () => {
    const e = await escenario({ efectivoActivo: true, transferenciaRepartidorActiva: false });
    const p = await e.m.llamar('GET', '/datos/pais', undefined, e.cliente.token);
    expect(p.datos).toMatchObject({
      pais: 'US',
      moneda: 'USD',
      efectivoActivo: true,
      transferenciaRepartidorActiva: false,
    });
    expect((await e.m.crudo('/datos/pais', { method: 'GET' })).status).toBe(200);
  });

  it('las tres apps y Docs tienen las piezas: pago al recibir, «Cobré» / «No pagó», saldo prepago, ticket y guías es/en', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const raiz = join(__dirname, '..', '..', '..');
    const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');
    const cart = leer('apps/cliente/src/app/cart.tsx');
    expect(cart).toContain("'/datos/pais'");
    expect(cart).toContain('metodoPago');
    expect(cart).toContain('r.directo');
    const orden = leer('apps/cliente/src/app/order/[id].tsx');
    expect(orden).toContain('cuentaCobro');
    expect(orden).toContain('/disputa-cobro');
    const rep = leer('apps/repartidor/src/Inicio.tsx');
    expect(rep).toContain('/cobre');
    expect(rep).toContain('/no-pago');
    expect(rep).toContain('testID="sin-lugar-seguro"');
    expect(rep).toContain('/datos/repartidor/saldo-prepago');
    expect(rep).toContain('/datos/repartidor/recargar');
    expect(leer('apps/restaurante/src/Inicio.tsx')).toContain('pagoDirecto');
    // C-COBRO-DIRECTO-LOCAL: el repartidor registra el pago en el local; el restaurante ve cuánto cobrar.
    expect(rep).toContain('<PagoEnLocal');
    expect(rep).toContain('/transferencia-pendiente');
    const local = leer('apps/repartidor/src/grandes/PagoEnLocal.tsx');
    expect(local).toContain('/pago-local');
    expect(local).toContain('tarjeta_propia');
    expect(leer('apps/restaurante/src/Inicio.tsx')).toContain(
      '/datos/restaurante/pedidos/${pedidoId}/pago-local',
    );
    const guias = leer('apps/panel/src/sitio/docs/guias.ts');
    expect(guias.match(/id: 'pay-on-delivery'/g)).toHaveLength(2);
    expect(guias.match(/id: 'cash-orders-and-top-ups'/g)).toHaveLength(2);
  });
});
