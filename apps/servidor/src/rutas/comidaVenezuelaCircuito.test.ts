import { describe, expect, it } from 'vitest';
import { TARIFAS_COMIDA_VENEZUELA } from '@tumbite/compartido';
import { saldoLibro } from '../internacional/libro';
import { abrirComida, escenarioVe, restauranteVe } from '../pruebas/comidaVe';

/**
 * C-COMIDA-VE-CIRCUITO (13 nov 2026) — Venezuela. El pedido de comida en El Vigía de punta a punta
 * por la API, como las apps y el panel: el restaurante venezolano se registra y carga su menú, el
 * repartidor recarga en dólares en el punto de venta del equipo, el cliente pide en efectivo o por
 * pago móvil, el restaurante acepta y marca listo, el repartidor paga en el local, recoge, entrega y
 * confirma el cobro; la comisión sale UNA vez del saldo prepago (la misma billetera de los viajes) y
 * la conciliación queda en verde. Sin saldo no hay oferta; si se cancela, lo apartado vuelve.
 */
const CASA = { lat: 8.6235, lng: -71.649 };

async function mundoVe() {
  const e = await escenarioVe();
  expect((await abrirComida(e)).estado).toBe(201);
  // El equipo escribe la tasa del día (bolívares por dólar): solo informativa.
  await e.m.llamar('PUT', '/datos/admin/tasas-referencia/VE', { tasa: 250 }, e.admin.token);
  const r = await restauranteVe(e);
  const pedir = (metodoPago: 'efectivo' | 'transferencia_repartidor', cantidad = 2) =>
    e.m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: r.rid,
        lineas: [{ platoId: r.platoId, cantidad }],
        propinaCentavos: 50,
        direccion: 'Calle 5 con avenida 3, El Vigía',
        ...CASA,
        metodoPago,
      },
      e.cliente.token,
    );
  async function repartidor(nombre: string) {
    const d = await e.m.cuenta('repartidor', nombre);
    const c = await e.m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 8.6222, lng: -71.6508 },
      d.token,
    );
    expect(c.estado).toBe(200);
    return d;
  }
  /** El equipo es su propio punto de venta en dólares (la moneda de El Vigía) y vende un código. */
  async function recargar(rep: { token: string }, monto: number) {
    const punto = await e.m.llamar(
      'POST',
      '/datos/admin/puntos-venta',
      { nombre: 'Punto Divoox El Vigía', pais: 'VE', usuarioId: e.admin.id, moneda: 'USD' },
      e.admin.token,
    );
    expect(punto.estado).toBe(201);
    await e.m.llamar(
      'POST',
      `/datos/admin/puntos-venta/${punto.datos.punto.id}/fondo`,
      { monto: monto * 10, comprobante: 'transferencia-equipo-001' },
      e.admin.token,
    );
    const codigo = await e.m.llamar('POST', '/datos/punto-venta/codigos', { monto }, e.admin.token);
    expect(codigo.estado).toBe(201);
    const canje = await e.m.llamar(
      'POST',
      '/datos/repartidor/recargar',
      { codigo: codigo.datos.codigo },
      rep.token,
    );
    expect(canje.estado).toBe(200);
    return canje.datos;
  }
  /** Su cuenta de pago móvil; el equipo la confirma (sin eso entra en vigor a las 24 horas). */
  async function pagoMovil(rep: { token: string }) {
    const cuenta = await e.m.llamar(
      'POST',
      '/datos/repartidor/cuentas-cobro',
      {
        clave: 'clave-segura-1',
        tipo: 'pago_movil',
        banco: 'Banco de Venezuela',
        titular: 'Repartidor El Vigía',
        identificador: '04141234567',
      },
      rep.token,
    );
    expect(cuenta.estado).toBe(201);
    expect(
      (
        await e.m.llamar(
          'PATCH',
          `/datos/admin/cuentas-cobro/${cuenta.datos.cuenta.id}`,
          {},
          e.admin.token,
        )
      ).estado,
    ).toBe(200);
  }
  const ofertas = async (rep: { token: string }) =>
    ((await e.m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token)).datos.ofertas ??
      []) as { id: string; metodoPago: string; moneda: string }[];
  const saldo = async (rep: { token: string }) =>
    (await e.m.llamar('GET', '/datos/repartidor/saldo-prepago', undefined, rep.token)).datos;
  async function pagarLocal(id: string, rep: { token: string }) {
    const l = await e.m.llamar(
      'GET',
      `/datos/repartidor/pedidos/${id}/pago-local`,
      undefined,
      rep.token,
    );
    return e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/pago-local`,
      { montoPagado: l.datos.montoEsperado, importeTicket: l.datos.subtotal, metodo: 'efectivo' },
      rep.token,
    );
  }
  /** El restaurante acepta, el repartidor acepta, el restaurante marca listo y el repartidor recoge. */
  async function hastaEnCamino(id: string, rep: { token: string }, yaAceptado = false) {
    if (!yaAceptado)
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
    expect((await ofertas(rep)).map((o) => o.id)).toContain(id);
    expect(
      (await e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token)).estado,
    ).toBe(200);
    expect(
      (await e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, r.dueno.token))
        .estado,
    ).toBe(200);
    expect((await pagarLocal(id, rep)).estado).toBe(201);
    expect((await e.m.recoger(id, rep.token, r.dueno.token)).estado).toBe(200);
  }
  const fila = (id: string) =>
    e.m.DB.prepare(
      'SELECT estado, moneda, metodo_pago, cobro_estado, conciliacion_estado, total, propina, ganancia, subtotal FROM pedidos WHERE id = ?',
    )
      .bind(id)
      .first<Record<string, string | number>>();
  const comisionesDe = (id: string) =>
    e.m.DB.prepare(
      "SELECT COUNT(*) AS n, COALESCE(SUM(monto), 0) AS s FROM libro WHERE pedido_id = ? AND bolsillo = 'comisiones'",
    )
      .bind(id)
      .first<{ n: number; s: number }>();
  return {
    e,
    r,
    pedir,
    repartidor,
    recargar,
    pagoMovil,
    ofertas,
    saldo,
    hastaEnCamino,
    fila,
    comisionesDe,
  };
}

describe('C-COMIDA-VE-CIRCUITO: comida en El Vigía de punta a punta', () => {
  it('efectivo: tarifas en dólares, comisión apartada al aceptar y cobrada una sola vez, conciliado', async () => {
    const w = await mundoVe();
    const rep = await w.repartidor('Repartidor El Vigía');
    await w.recargar(rep, 1000);
    const antes = await w.saldo(rep);
    expect(antes).toMatchObject({ pais: 'VE', moneda: 'USD', disponible: 1000 });
    // «Te alcanza para unos N pedidos» con la comisión de un pedido típico de El Vigía.
    expect(antes.comisionTipicaComida).toBeGreaterThan(0);
    expect(antes.pedidosAlcanzan).toBe(Math.floor(1000 / antes.comisionTipicaComida));

    const p = await w.pedir('efectivo');
    expect(p.estado).toBe(201);
    expect(p.datos.directo).toBe(true);
    const id = p.datos.pedidoId as string;
    // 2 arepas de 4,50 = 9,00; envío corto (1,50); servicio 5 % (0,45); propina 0,50.
    expect(p.datos.desglose).toMatchObject({
      subtotal: 900,
      envio: TARIFAS_COMIDA_VENEZUELA.envioBase,
      servicio: 45,
      propina: 50,
    });
    const f0 = await w.fila(id);
    expect(f0).toMatchObject({ moneda: 'USD', metodo_pago: 'efectivo', estado: 'pagado' });
    // El cliente ve el equivalente en bolívares del total en su pedido.
    const visto = await w.e.m.llamar('GET', `/datos/pedidos/${id}`, undefined, w.e.cliente.token);
    expect(visto.datos.pedido.referencia).toMatchObject({
      moneda: 'VES',
      monto: Number(f0?.total) * 250,
    });

    await w.hastaEnCamino(id, rep);
    const comision = Number((await w.fila(id))?.ganancia);
    expect(comision).toBeGreaterThan(0);
    expect(await w.saldo(rep)).toMatchObject({ disponible: 1000 - comision, reservado: comision });
    // El repartidor ve cuánto cobrar en mano (sin la propina) y su equivalente en bolívares.
    const estado = await w.e.m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    const aCobrar = Number(f0?.total) - Number(f0?.propina);
    expect(estado.datos.activo.referenciaCobro).toMatchObject({ monto: aCobrar * 250 });

    expect((await w.e.m.entregar(id, rep.token)).estado).toBe(200);
    const cobre = await w.e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/cobre`,
      { montoRecibido: aCobrar },
      rep.token,
    );
    expect(cobre.estado).toBe(200);
    expect(cobre.datos.cobroEstado).toBe('confirmado');
    expect(await w.fila(id)).toMatchObject({
      estado: 'entregado',
      cobro_estado: 'confirmado',
      conciliacion_estado: 'conciliado',
    });
    expect(await w.saldo(rep)).toMatchObject({ disponible: 1000 - comision, reservado: 0 });
    expect(await w.comisionesDe(id)).toEqual({ n: 1, s: comision });
    // Confirmar otra vez no cobra dos veces.
    expect(
      (
        await w.e.m.llamar(
          'POST',
          `/datos/repartidor/pedidos/${id}/cobre`,
          { montoRecibido: aCobrar },
          rep.token,
        )
      ).estado,
    ).toBe(409);
    expect(await w.comisionesDe(id)).toEqual({ n: 1, s: comision });
    expect(await saldoLibro(w.e.m.DB, rep.id, 'prepago', 'VE', 'USD')).toBe(1000 - comision);
  });

  it('pago móvil: solo se ofrece a quien tiene pago móvil; «sí me llegó» cierra el cobro y concilia', async () => {
    const w = await mundoVe();
    const sinCuenta = await w.repartidor('Sin pago móvil');
    await w.recargar(sinCuenta, 1000);
    const rep = await w.repartidor('Con pago móvil');
    await w.recargar(rep, 1000);
    await w.pagoMovil(rep);
    const p = await w.pedir('transferencia_repartidor');
    expect(p.estado).toBe(201);
    const id = p.datos.pedidoId as string;
    await w.e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 5 },
      w.r.dueno.token,
    );
    expect((await w.ofertas(sinCuenta)).map((o) => o.id)).not.toContain(id);
    await w.hastaEnCamino(id, rep, true);
    // El cliente ve a dónde pagar (los datos del pago móvil del repartidor).
    const seg = await w.e.m.llamar(
      'GET',
      `/datos/pedidos/${id}/seguimiento`,
      undefined,
      w.e.cliente.token,
    );
    expect(seg.datos.pedido.cuentaCobro).toMatchObject({ tipo: 'pago_movil' });
    expect((await w.e.m.entregar(id, rep.token)).estado).toBe(200);
    const si = await w.e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/pago-movil`,
      { recibido: true, referencia: '123456' },
      rep.token,
    );
    expect(si.estado).toBe(200);
    expect(si.datos.estado).toBe('recibido');
    const comision = Number((await w.fila(id))?.ganancia);
    expect(await w.fila(id)).toMatchObject({
      cobro_estado: 'confirmado',
      conciliacion_estado: 'conciliado',
    });
    expect(await w.comisionesDe(id)).toEqual({ n: 1, s: comision });
  });

  it('pago móvil: «no me llegó» abre un caso y se corrige UNA vez dentro de 30 minutos', async () => {
    const w = await mundoVe();
    const rep = await w.repartidor('Con pago móvil');
    await w.recargar(rep, 1000);
    await w.pagoMovil(rep);
    const p = await w.pedir('transferencia_repartidor');
    const id = p.datos.pedidoId as string;
    await w.hastaEnCamino(id, rep);
    expect((await w.e.m.entregar(id, rep.token)).estado).toBe(200);
    const no = await w.e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/pago-movil`,
      { recibido: false },
      rep.token,
    );
    expect(no.datos.estado).toBe('no_recibido');
    // El cobro sigue pendiente (la comisión apartada) y hay un caso abierto para soporte.
    expect(await w.fila(id)).toMatchObject({ cobro_estado: 'pendiente' });
    const caso = () =>
      w.e.m.DB.prepare('SELECT estado FROM incidencias_dinero WHERE referencia = ?')
        .bind(`pago-movil-pedido:${id}`)
        .first<{ estado: string }>();
    expect((await caso())?.estado).toBe('abierta');
    const corrige = await w.e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/pago-movil`,
      { recibido: true, referencia: '987654' },
      rep.token,
    );
    expect(corrige.datos).toMatchObject({ estado: 'recibido', corregido: true });
    expect((await caso())?.estado).toBe('resuelta');
    expect(await w.fila(id)).toMatchObject({
      cobro_estado: 'confirmado',
      conciliacion_estado: 'conciliado',
    });
    // Una segunda vuelta ya no la cambia el repartidor.
    const otra = await w.e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/pago-movil`,
      { recibido: false },
      rep.token,
    );
    expect(otra.estado).toBe(409);
  });

  it('sin saldo no recibe la oferta y aceptar se rechaza con el porqué', async () => {
    const w = await mundoVe();
    const pobre = await w.repartidor('Sin saldo');
    const s = await w.saldo(pobre);
    expect(s).toMatchObject({ disponible: 0, sinSaldoComida: true, pedidosAlcanzan: 0 });
    const p = await w.pedir('efectivo');
    const id = p.datos.pedidoId as string;
    await w.e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 5 },
      w.r.dueno.token,
    );
    expect((await w.ofertas(pobre)).map((o) => o.id)).not.toContain(id);
    await w.e.m.DB.prepare(
      "INSERT INTO ofertas (pedido_id, repartidor_id, estado) VALUES (?, ?, 'ofrecida')",
    )
      .bind(id, pobre.id)
      .run();
    const no = await w.e.m.llamar(
      'POST',
      `/datos/repartidor/ofertas/${id}/aceptar`,
      {},
      pobre.token,
    );
    expect(no.estado).toBe(409);
    expect(no.datos.error).toMatch(/saldo|balance/i);
  });

  it('si se cancela después de aceptar, lo apartado vuelve completo al saldo', async () => {
    const w = await mundoVe();
    const rep = await w.repartidor('Repartidor El Vigía');
    await w.recargar(rep, 1000);
    const p = await w.pedir('efectivo');
    const id = p.datos.pedidoId as string;
    await w.e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 5 },
      w.r.dueno.token,
    );
    expect((await w.ofertas(rep)).map((o) => o.id)).toContain(id);
    const ac = await w.e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    expect(ac.estado).toBe(200);
    const comision = Number((await w.fila(id))?.ganancia);
    expect(await w.saldo(rep)).toMatchObject({ disponible: 1000 - comision, reservado: comision });
    const c = await w.e.m.llamar(
      'POST',
      `/datos/admin/pedidos/${id}/cancelar`,
      { motivo: 'El restaurante se quedó sin gas' },
      w.e.admin.token,
    );
    expect(c.estado).toBe(200);
    expect(await w.saldo(rep)).toMatchObject({ disponible: 1000, reservado: 0 });
    expect(await w.comisionesDe(id)).toEqual({ n: 0, s: 0 });
  });
});
