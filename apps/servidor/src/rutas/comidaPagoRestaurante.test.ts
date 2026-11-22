import { describe, expect, it } from 'vitest';
import { saldoLibro } from '../internacional/libro';
import { vigilarPagosComida, saludPagoComida } from '../internacional/pagoComida';
import { borrarCuenta } from '../borrarCuenta';
import type { Env } from '../env';
import { abrirComida, escenarioVe, restauranteVe } from '../pruebas/comidaVe';

/**
 * C-COMIDA-PAGO-RESTAURANTE y C-SALDO-RESTAURANTE (22 nov 2026) — Venezuela (países con la bandera
 * `comidaPagoRestaurante`). El cliente le paga la comida DIRECTO al restaurante por pago móvil y el
 * envío al conductor; el conductor ya no adelanta nada en el local. Orden: el restaurante acepta, se
 * asegura un conductor, recién ahí el cliente ve los datos de pago del restaurante (monto en bolívares
 * congelado con la tasa y un vencimiento), escribe la referencia, el restaurante confirma «Me llegó»
 * y solo entonces se prepara y sale el conductor. Divoox cobra solo su comisión del envío, una vez,
 * del saldo prepago del conductor; el restaurante paga 0 % mientras su política esté en cero.
 */
const CASA = { lat: 8.6235, lng: -71.649 };
const CUENTA_RESTAURANTE = {
  clave: 'clave-segura-1',
  banco: 'Banco de ejemplo',
  telefono: '04140000000',
  documento: 'J-000000001',
  titular: 'Restaurante de ejemplo',
};

async function mundoPago(conCuenta = true) {
  const e = await escenarioVe();
  expect((await abrirComida(e, {}, { pagoRestaurante: true })).estado).toBe(201);
  await e.m.llamar('PUT', '/datos/admin/tasas-referencia/VE', { tasa: 250 }, e.admin.token);
  const r = await restauranteVe(e);
  if (conCuenta) {
    const cu = await e.m.llamar(
      'POST',
      '/datos/restaurante/cuenta-cobro',
      CUENTA_RESTAURANTE,
      r.dueno.token,
    );
    expect(cu.estado).toBe(201);
  }
  const env = { DB: e.m.DB, ...e.m.extra } as unknown as Env;
  const pedir = (metodoPago: 'efectivo' | 'transferencia_repartidor' = 'efectivo') =>
    e.m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: r.rid,
        lineas: [{ platoId: r.platoId, cantidad: 2 }],
        propinaCentavos: 50,
        direccion: 'Calle de ejemplo 1',
        ...CASA,
        metodoPago,
      },
      e.cliente.token,
    );
  async function conductor(nombre = 'Conductor de ejemplo', saldo = 1000) {
    const d = await e.m.cuenta('repartidor', nombre);
    await e.m.DB.prepare("INSERT OR IGNORE INTO kyc (usuario_id, selfie) VALUES (?, 'kyc/selfie')")
      .bind(d.id)
      .run();
    expect(
      (
        await e.m.llamar(
          'POST',
          '/datos/repartidor/conectar',
          { conectado: true, lat: 8.6222, lng: -71.6508 },
          d.token,
        )
      ).estado,
    ).toBe(200);
    if (saldo > 0) {
      const punto = await e.m.llamar(
        'POST',
        '/datos/admin/puntos-venta',
        { nombre: 'Punto de ejemplo', pais: 'VE', usuarioId: e.admin.id, moneda: 'USD' },
        e.admin.token,
      );
      await e.m.llamar(
        'POST',
        `/datos/admin/puntos-venta/${punto.datos.punto.id}/fondo`,
        { monto: saldo * 2, comprobante: 'transferencia-equipo-001' },
        e.admin.token,
      );
      const codigo = await e.m.llamar(
        'POST',
        '/datos/punto-venta/codigos',
        { monto: saldo },
        e.admin.token,
      );
      const canje = await e.m.llamar(
        'POST',
        '/datos/repartidor/recargar',
        { codigo: codigo.datos.codigo },
        d.token,
      );
      expect(canje.estado).toBe(200);
    }
    return d;
  }
  const aceptarRest = (id: string) =>
    e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 20 }, r.dueno.token);
  const ofertas = async (rep: { token: string }) =>
    ((await e.m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token)).datos.ofertas ??
      []) as {
      id: string;
      adelantoLocal: number;
      enManoCobro: { monto: number } | null;
      pagoComida?: { estado: string; listoParaIr: boolean } | null;
    }[];
  const tomar = (id: string, rep: { token: string }) =>
    e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
  const reportar = (id: string, referencia: string, token = e.cliente.token) =>
    e.m.llamar('POST', `/datos/pedidos/${id}/pago-comida`, { referencia }, token);
  const responder = (id: string, llego: boolean) =>
    e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/pago-comida`, { llego }, r.dueno.token);
  const listo = (id: string) =>
    e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, r.dueno.token);
  const pago = (id: string) =>
    e.m.DB.prepare('SELECT * FROM pagos_comida WHERE pedido_id = ?')
      .bind(id)
      .first<Record<string, string | number | null>>();
  const pedido = (id: string) =>
    e.m.DB.prepare(
      'SELECT estado, total, propina, subtotal, ganancia, comision, pago_restaurante, cobro_estado, conciliacion_estado, repartidor_id FROM pedidos WHERE id = ?',
    )
      .bind(id)
      .first<Record<string, string | number | null>>();
  const comisionesDe = (id: string) =>
    e.m.DB.prepare(
      "SELECT COUNT(*) AS n, COALESCE(SUM(monto), 0) AS s FROM libro WHERE pedido_id = ? AND bolsillo = 'comisiones'",
    )
      .bind(id)
      .first<{ n: number; s: number }>();
  const caso = (referencia: string) =>
    e.m.DB.prepare('SELECT estado FROM incidencias_dinero WHERE referencia = ?')
      .bind(referencia)
      .first<{ estado: string }>();
  /** Pedido creado, aceptado por el restaurante y tomado por el conductor: el cliente ya puede pagar. */
  async function hastaPorPagar(rep?: { id: string; token: string }) {
    const c = rep ?? (await conductor());
    const p = await pedir();
    expect(p.estado).toBe(201);
    const id = p.datos.pedidoId as string;
    expect((await aceptarRest(id)).estado).toBe(200);
    expect((await ofertas(c)).map((o) => o.id)).toContain(id);
    expect((await tomar(id, c)).estado).toBe(200);
    return { id, rep: c };
  }
  return {
    e,
    r,
    env,
    pedir,
    conductor,
    aceptarRest,
    ofertas,
    tomar,
    reportar,
    responder,
    listo,
    pago,
    pedido,
    comisionesDe,
    caso,
    hastaPorPagar,
  };
}

describe('C-COMIDA-PAGO-RESTAURANTE: el cliente le paga la comida directo al restaurante', () => {
  it('circuito feliz: conductor asegurado antes del pago, bolívares congelados, referencia, «Me llegó», recién ahí listo y recogida; el conductor cobra solo el envío y la comisión sale una vez', async () => {
    const w = await mundoPago();
    const rep = await w.conductor();
    const p = await w.pedir();
    expect(p.estado).toBe(201);
    const id = p.datos.pedidoId as string;
    // Restaurante al 0 %: lo que le toca es la comida completa.
    const f0 = await w.pedido(id);
    expect(f0).toMatchObject({
      estado: 'pagado',
      subtotal: 900,
      comision: 0,
      pago_restaurante: 900,
    });
    expect(p.datos.pagoComida).toMatchObject({ estado: 'esperando_conductor', comida: 900 });
    const envio = Number(f0?.total) - Number(f0?.propina) - 900;
    expect(p.datos.pagoComida.envioAlConductor).toBe(envio);
    expect(await w.pago(id)).toMatchObject({ estado: 'esperando_conductor', monto: 900 });
    // Antes de tener conductor nadie paga.
    expect((await w.reportar(id, '123456')).estado).toBe(409);

    expect((await w.aceptarRest(id)).estado).toBe(200);
    // La oferta sale de inmediato (no espera el tiempo de cocina) y el conductor no adelanta nada.
    const oferta = (await w.ofertas(rep)).find((o) => o.id === id);
    expect(oferta).toBeTruthy();
    expect(oferta?.adelantoLocal).toBe(0);
    expect(oferta?.enManoCobro?.monto).toBe(envio);
    // Sin pago confirmado no se marca listo.
    expect((await w.listo(id)).estado).toBe(409);

    expect((await w.tomar(id, rep)).estado).toBe(200);
    const pc = await w.pago(id);
    expect(pc).toMatchObject({ estado: 'por_pagar', moneda_ref: 'VES', monto_ref: 900 * 250 });
    expect(Number(pc?.tasa)).toBe(250);
    // El cliente ve a dónde pagar, cuánto en bolívares, con qué tasa y hasta cuándo.
    const seg = await w.e.m.llamar(
      'GET',
      `/datos/pedidos/${id}/seguimiento`,
      undefined,
      w.e.cliente.token,
    );
    const vista = seg.datos.pedido.pagoComida;
    expect(vista).toMatchObject({
      estado: 'por_pagar',
      comida: 900,
      montoLocal: { moneda: 'VES', monto: 225000, tasa: 250 },
      cuenta: {
        banco: CUENTA_RESTAURANTE.banco,
        telefono: CUENTA_RESTAURANTE.telefono,
        documento: CUENTA_RESTAURANTE.documento,
        titular: CUENTA_RESTAURANTE.titular,
      },
    });
    expect(vista.segundosParaVencer).toBeGreaterThan(800);
    expect(vista.segundosParaVencer).toBeLessThanOrEqual(900);
    // El conductor espera: el cliente está pagando.
    const est0 = await w.e.m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(est0.datos.activo.pagoComida).toMatchObject({ estado: 'por_pagar', listoParaIr: false });
    expect(est0.datos.activo.enManoCobro.monto).toBe(envio);
    // Sin confirmación no se recoge, y el flujo viejo de pago en el local no aplica.
    const enRest = { lat: 8.6225, lng: -71.651 };
    expect(
      (await w.e.m.foto(`/datos/repartidor/pedidos/${id}/foto-recogida`, rep.token, enRest)).estado,
    ).toBe(409);
    expect(
      (
        await w.e.m.llamar(
          'POST',
          `/datos/repartidor/pedidos/${id}/pago-local`,
          { montoPagado: 900, importeTicket: 900, metodo: 'efectivo' },
          rep.token,
        )
      ).estado,
    ).toBe(409);

    // La referencia es obligatoria.
    expect((await w.reportar(id, '')).estado).toBe(400);
    const rep1 = await w.reportar(id, '123456');
    expect(rep1.estado).toBe(200);
    expect(rep1.datos.pagoComida.estado).toBe('reportado');
    // Doble toque: igual, sin error.
    expect((await w.reportar(id, '123456')).estado).toBe(200);
    // El restaurante ve el pago en su lista, con la referencia.
    const lista = await w.e.m.llamar(
      'GET',
      '/datos/restaurante/pedidos',
      undefined,
      w.r.dueno.token,
    );
    const enLista = (lista.datos.pedidos as { id: string; pagoComida?: unknown }[]).find(
      (x) => x.id === id,
    );
    expect(enLista?.pagoComida).toMatchObject({ estado: 'reportado', referencia: '123456' });

    const si = await w.responder(id, true);
    expect(si.estado).toBe(200);
    expect(si.datos.pagoComida.estado).toBe('confirmado');
    expect((await w.responder(id, true)).estado).toBe(200);
    const est1 = await w.e.m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(est1.datos.activo.pagoComida).toMatchObject({ estado: 'confirmado', listoParaIr: true });

    expect((await w.listo(id)).estado).toBe(200);
    expect((await w.e.m.recoger(id, rep.token, w.r.dueno.token)).estado).toBe(200);
    expect((await w.e.m.entregar(id, rep.token)).estado).toBe(200);
    const cobre = await w.e.m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/cobre`,
      { montoRecibido: envio },
      rep.token,
    );
    expect(cobre.estado).toBe(200);
    expect(cobre.datos.cobroEstado).toBe('confirmado');
    const fin = await w.pedido(id);
    expect(fin).toMatchObject({
      estado: 'entregado',
      cobro_estado: 'confirmado',
      conciliacion_estado: 'conciliado',
    });
    const comision = Number(fin?.ganancia);
    expect(comision).toBeGreaterThan(0);
    expect(await w.comisionesDe(id)).toEqual({ n: 1, s: comision });
    expect(await saldoLibro(w.e.m.DB, rep.id, 'prepago', 'VE', 'USD')).toBe(1000 - comision);
    // Nada del restaurante en el saldo prepago: está al 0 %.
    expect(await saldoLibro(w.e.m.DB, `restaurante:${w.r.rid}`, 'prepago', 'VE', 'USD')).toBe(0);
    // Divoox nunca tuvo el dinero de la comida: queda escrito como pagado directo por el cliente.
    const directo = await w.e.m.DB.prepare(
      "SELECT monto FROM libro WHERE pedido_id = ? AND concepto = 'pagado_directo_por_cliente'",
    )
      .bind(id)
      .first<{ monto: number }>();
    expect(directo?.monto).toBe(900);
  });

  it('sin conductor a tiempo se cancela y nadie pagó', async () => {
    const w = await mundoPago();
    const p = await w.pedir();
    const id = p.datos.pedidoId as string;
    expect((await w.aceptarRest(id)).estado).toBe(200);
    await vigilarPagosComida(w.env, w.e.m.DB);
    expect((await w.pedido(id))?.estado).toBe('aceptado');
    await w.e.m.DB.prepare(
      "UPDATE pedidos SET aceptado_en = datetime('now', '-11 minutes') WHERE id = ?",
    )
      .bind(id)
      .run();
    await vigilarPagosComida(w.env, w.e.m.DB);
    expect((await w.pedido(id))?.estado).toBe('cancelado');
    expect(await w.pago(id)).toMatchObject({ estado: 'cancelado', devolucion_estado: 'no_aplica' });
    const seg = await w.e.m.llamar(
      'GET',
      `/datos/pedidos/${id}/seguimiento`,
      undefined,
      w.e.cliente.token,
    );
    expect(seg.datos.pedido.motivoCancelacion).toBe('sin_conductor');
  });

  it('el pago vencido sin referencia se cancela, nadie pagó y lo apartado vuelve al conductor', async () => {
    const w = await mundoPago();
    const { id, rep } = await w.hastaPorPagar();
    await w.e.m.DB.prepare(
      "UPDATE pagos_comida SET vence_en = datetime('now', '-1 minutes') WHERE pedido_id = ?",
    )
      .bind(id)
      .run();
    // Reportar un pago vencido no se acepta.
    expect((await w.reportar(id, '555555')).estado).toBe(409);
    await vigilarPagosComida(w.env, w.e.m.DB);
    expect((await w.pedido(id))?.estado).toBe('cancelado');
    expect(await w.pago(id)).toMatchObject({ estado: 'vencido', devolucion_estado: 'no_aplica' });
    expect(await saldoLibro(w.e.m.DB, rep.id, 'prepago', 'VE', 'USD')).toBe(1000);
    expect(await w.comisionesDe(id)).toEqual({ n: 0, s: 0 });
  });

  it('el restaurante que no responde recibe avisos y a los 10 minutos se cancela con caso y devolución pendiente', async () => {
    const w = await mundoPago();
    const { id } = await w.hastaPorPagar();
    expect((await w.reportar(id, '123456')).estado).toBe(200);
    const evento = (ev: string) =>
      w.e.m.DB.prepare('SELECT 1 AS si FROM bitacora_pedidos WHERE pedido_id = ? AND evento = ?')
        .bind(id, ev)
        .first();
    const atrasar = (min: number) =>
      w.e.m.DB.prepare(
        `UPDATE pagos_comida SET reportado_en = datetime('now', '-${min} minutes') WHERE pedido_id = ?`,
      )
        .bind(id)
        .run();
    await atrasar(3);
    await vigilarPagosComida(w.env, w.e.m.DB);
    expect(await evento('pago_comida_aviso_1')).toBeTruthy();
    await atrasar(6);
    await vigilarPagosComida(w.env, w.e.m.DB);
    expect(await evento('pago_comida_aviso_2')).toBeTruthy();
    expect((await w.pedido(id))?.estado).toBe('aceptado');
    await atrasar(11);
    await vigilarPagosComida(w.env, w.e.m.DB);
    expect((await w.pedido(id))?.estado).toBe('cancelado');
    expect(await w.pago(id)).toMatchObject({ estado: 'cancelado', devolucion_estado: 'pendiente' });
    expect((await w.caso(`devolucion-comida:${id}`))?.estado).toBe('abierta');
    // El restaurante devuelve el dinero al cliente y lo marca con su referencia.
    const dev = await w.e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/pago-comida/devolucion`,
      { referencia: '998877' },
      w.r.dueno.token,
    );
    expect(dev.estado).toBe(200);
    expect(await w.pago(id)).toMatchObject({
      devolucion_estado: 'hecha',
      devolucion_referencia: '998877',
    });
    expect((await w.caso(`devolucion-comida:${id}`))?.estado).toBe('resuelta');
  });

  it('«No me llegó» abre un caso; el cliente corrige la referencia UNA vez y el restaurante corrige a «sí» UNA vez', async () => {
    const w = await mundoPago();
    const { id } = await w.hastaPorPagar();
    expect((await w.reportar(id, '111111')).estado).toBe(200);
    const no = await w.responder(id, false);
    expect(no.estado).toBe(200);
    expect(no.datos.pagoComida.estado).toBe('no_llego');
    expect((await w.caso(`pago-comida:${id}`))?.estado).toBe('abierta');
    expect((await w.listo(id)).estado).toBe(409);
    // El cliente ve que puede corregir y corrige.
    const seg = await w.e.m.llamar(
      'GET',
      `/datos/pedidos/${id}/seguimiento`,
      undefined,
      w.e.cliente.token,
    );
    expect(seg.datos.pedido.pagoComida).toMatchObject({ estado: 'no_llego', puedeCorregir: true });
    const corrige = await w.reportar(id, '222222');
    expect(corrige.estado).toBe(200);
    expect(await w.pago(id)).toMatchObject({ estado: 'reportado', referencia: '222222' });
    // Otro «no»: el cliente ya no puede corregir otra vez.
    expect((await w.responder(id, false)).estado).toBe(200);
    expect((await w.reportar(id, '333333')).estado).toBe(409);
    // El restaurante se equivocó: lo corrige a «sí» dentro de los 30 minutos y el caso se cierra.
    const si = await w.responder(id, true);
    expect(si.estado).toBe(200);
    expect(si.datos.pagoComida.estado).toBe('confirmado');
    expect((await w.caso(`pago-comida:${id}`))?.estado).toBe('resuelta');
    // Y ya no lo vuelve a cambiar él.
    expect((await w.responder(id, false)).estado).toBe(409);
    expect((await w.listo(id)).estado).toBe(200);
  });

  it('cancelar después de confirmado deja la devolución pendiente y el restaurante la marca hecha', async () => {
    const w = await mundoPago();
    const { id, rep } = await w.hastaPorPagar();
    expect((await w.reportar(id, '123456')).estado).toBe(200);
    expect((await w.responder(id, true)).estado).toBe(200);
    const c = await w.e.m.llamar(
      'POST',
      `/datos/admin/pedidos/${id}/cancelar`,
      { motivo: 'El restaurante se quedó sin gas' },
      w.e.admin.token,
    );
    expect(c.estado).toBe(200);
    expect(await w.pago(id)).toMatchObject({ estado: 'cancelado', devolucion_estado: 'pendiente' });
    expect((await w.caso(`devolucion-comida:${id}`))?.estado).toBe('abierta');
    expect(await saldoLibro(w.e.m.DB, rep.id, 'prepago', 'VE', 'USD')).toBe(1000);
    // Solo el restaurante del pedido marca la devolución, con su referencia.
    expect(
      (
        await w.e.m.llamar(
          'POST',
          `/datos/restaurante/pedidos/${id}/pago-comida/devolucion`,
          { referencia: '' },
          w.r.dueno.token,
        )
      ).estado,
    ).toBe(400);
    const dev = await w.e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/pago-comida/devolucion`,
      { referencia: '445566' },
      w.r.dueno.token,
    );
    expect(dev.estado).toBe(200);
    expect(dev.datos.pagoComida.devolucion).toMatchObject({
      estado: 'hecha',
      referencia: '445566',
    });
    // Repetirlo no cambia nada.
    expect(
      (
        await w.e.m.llamar(
          'POST',
          `/datos/restaurante/pedidos/${id}/pago-comida/devolucion`,
          { referencia: '445566' },
          w.r.dueno.token,
        )
      ).estado,
    ).toBe(200);
  });

  it('un restaurante sin cuenta de cobro no recibe pedidos de pago directo', async () => {
    const w = await mundoPago(false);
    const p = await w.pedir();
    expect(p.estado).toBe(409);
    expect(p.datos.error).toMatch(/pago|payment/i);
    const n = await w.e.m.DB.prepare('SELECT COUNT(*) AS n FROM pagos_comida').first<{
      n: number;
    }>();
    expect(n?.n).toBe(0);
    // Su app sabe que le falta la cuenta.
    const cu = await w.e.m.llamar(
      'GET',
      '/datos/restaurante/cuenta-cobro',
      undefined,
      w.r.dueno.token,
    );
    expect(cu.estado).toBe(200);
    expect(cu.datos).toMatchObject({ cuenta: null, exigida: true });
    // La cuenta pide la contraseña.
    expect(
      (
        await w.e.m.llamar(
          'POST',
          '/datos/restaurante/cuenta-cobro',
          { ...CUENTA_RESTAURANTE, clave: 'otra-clave' },
          w.r.dueno.token,
        )
      ).estado,
    ).toBe(403);
  });

  it('dos conductores a la vez: solo uno toma el pedido y el pago se pide una sola vez', async () => {
    const w = await mundoPago();
    const a = await w.conductor('Conductor A');
    const b = await w.conductor('Conductor B');
    const p = await w.pedir();
    const id = p.datos.pedidoId as string;
    expect((await w.aceptarRest(id)).estado).toBe(200);
    await w.ofertas(a);
    await w.e.m.DB.prepare(
      "INSERT OR IGNORE INTO ofertas (pedido_id, repartidor_id, estado) VALUES (?, ?, 'ofrecida'), (?, ?, 'ofrecida')",
    )
      .bind(id, a.id, id, b.id)
      .run();
    const [ra, rb] = await Promise.all([w.tomar(id, a), w.tomar(id, b)]);
    expect([ra.estado, rb.estado].sort()).toEqual([200, 409]);
    const eventos = await w.e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM bitacora_pedidos WHERE pedido_id = ? AND evento = 'pago_comida_pedido'",
    )
      .bind(id)
      .first<{ n: number }>();
    expect(eventos?.n).toBe(1);
  });
});

describe('C-SALDO-RESTAURANTE: el saldo prepago del restaurante', () => {
  async function conSaldo() {
    const w = await mundoPago();
    await w.e.m.llamar(
      'PUT',
      '/datos/admin/paises/VE',
      {
        saldoRestaurante: {
          recargasActivas: true,
          minimo: 100,
          maximo: 100_000,
          instruccionesEs: 'Paga por pago móvil a la cuenta de Divoox que te indique el equipo.',
          instruccionesEn: 'Pay by mobile payment to the Divoox account our team gives you.',
        },
      },
      w.e.admin.token,
    );
    return w;
  }
  const saldoDe = (w: Awaited<ReturnType<typeof mundoPago>>) =>
    saldoLibro(w.e.m.DB, `restaurante:${w.r.rid}`, 'prepago', 'VE', 'USD');
  async function politica(w: Awaited<ReturnType<typeof mundoPago>>, pb: number, legal: boolean) {
    const r = await w.e.m.llamar(
      'POST',
      '/datos/admin/finanzas/politicas',
      {
        nombre: `Comida · restaurantes · VE ${pb}`,
        servicio: 'food',
        tipoCuenta: 'restaurante',
        pais: 'VE',
        modalidad: 'prepago',
        moneda: 'USD',
        regla: { tipo: 'porcentaje', pb },
        motivo: 'Comisión de restaurantes de prueba',
        revisionLegalAprobada: legal,
        revisionLegalNota: legal ? 'Revisión legal de prueba aprobada' : '',
      },
      w.e.admin.token,
    );
    expect(r.estado).toBe(201);
  }
  async function cicloConfirmado(w: Awaited<ReturnType<typeof mundoPago>>) {
    const { id } = await w.hastaPorPagar();
    expect((await w.reportar(id, `${Math.floor(100000 + Math.random() * 899999)}`)).estado).toBe(
      200,
    );
    expect((await w.responder(id, true)).estado).toBe(200);
    return id;
  }

  it('recarga declarada con referencia y comprobante, acreditada una sola vez; carga manual del equipo', async () => {
    const w = await conSaldo();
    const s0 = await w.e.m.llamar('GET', '/datos/restaurante/saldo', undefined, w.r.dueno.token);
    expect(s0.estado).toBe(200);
    expect(s0.datos).toMatchObject({ pais: 'VE', moneda: 'USD', disponible: 0, sinSaldo: false });
    expect(s0.datos.recargas.activas).toBe(true);
    const foto = await w.e.m.foto('/datos/restaurante/saldo/comprobante', w.r.dueno.token);
    expect(foto.estado).toBe(201);
    const declarar = (referencia: string) =>
      w.e.m.llamar(
        'POST',
        '/datos/restaurante/saldo/recargas',
        {
          monto: 2000,
          referencia,
          banco: 'Banco de ejemplo',
          comprobanteId: foto.datos.comprobanteId,
        },
        w.r.dueno.token,
      );
    const d = await declarar('778899');
    expect(d.estado).toBe(201);
    expect(d.datos.recarga).toMatchObject({ estado: 'pendiente', monto: 2000 });
    expect((await declarar('778899')).estado).toBe(409);
    expect(await saldoDe(w)).toBe(0);
    const lista = await w.e.m.llamar(
      'GET',
      '/datos/admin/finanzas/restaurantes-saldo/recargas',
      undefined,
      w.e.admin.token,
    );
    expect((lista.datos.recargas as { id: string }[]).map((x) => x.id)).toContain(
      d.datos.recarga.id,
    );
    const ac = await w.e.m.llamar(
      'POST',
      `/datos/admin/finanzas/restaurantes-saldo/recargas/${d.datos.recarga.id}/acreditar`,
      {},
      w.e.admin.token,
    );
    expect(ac.estado).toBe(200);
    expect(await saldoDe(w)).toBe(2000);
    expect(
      (
        await w.e.m.llamar(
          'POST',
          `/datos/admin/finanzas/restaurantes-saldo/recargas/${d.datos.recarga.id}/acreditar`,
          {},
          w.e.admin.token,
        )
      ).estado,
    ).toBe(409);
    expect(await saldoDe(w)).toBe(2000);
    const carga = await w.e.m.llamar(
      'POST',
      `/datos/admin/finanzas/restaurantes/${w.r.rid}/saldo`,
      { monto: 500, motivo: 'Regalo de arranque', comprobante: '' },
      w.e.admin.token,
    );
    expect(carga.estado).toBe(200);
    expect(await saldoDe(w)).toBe(2500);
  });

  it('con la política en 0 % no se descuenta nada al confirmar', async () => {
    const w = await conSaldo();
    await politica(w, 0, true);
    await w.e.m.llamar(
      'POST',
      `/datos/admin/finanzas/restaurantes/${w.r.rid}/saldo`,
      { monto: 500, motivo: 'Regalo de arranque', comprobante: '' },
      w.e.admin.token,
    );
    await cicloConfirmado(w);
    expect(await saldoDe(w)).toBe(500);
  });

  it('con comisión mayor que cero y revisión legal se descuenta al confirmar; sin revisión legal no; sin saldo no recibe pedidos', async () => {
    const sinLegal = await conSaldo();
    await politica(sinLegal, 1000, false);
    await sinLegal.e.m.llamar(
      'POST',
      `/datos/admin/finanzas/restaurantes/${sinLegal.r.rid}/saldo`,
      { monto: 500, motivo: 'Regalo de arranque', comprobante: '' },
      sinLegal.e.admin.token,
    );
    await cicloConfirmado(sinLegal);
    expect(await saldoDe(sinLegal)).toBe(500);

    const w = await conSaldo();
    await politica(w, 1000, true);
    // Sin saldo: el restaurante no recibe el pedido (409) y lo sabe en su app.
    const p0 = await w.pedir();
    expect(p0.estado).toBe(409);
    const s = await w.e.m.llamar('GET', '/datos/restaurante/saldo', undefined, w.r.dueno.token);
    expect(s.datos).toMatchObject({ sinSaldo: true, comision: { activa: true } });
    await w.e.m.llamar(
      'POST',
      `/datos/admin/finanzas/restaurantes/${w.r.rid}/saldo`,
      { monto: 500, motivo: 'Regalo de arranque', comprobante: '' },
      w.e.admin.token,
    );
    const id = await cicloConfirmado(w);
    // 10 % de 9,00 = 0,90, una sola vez, a las comisiones de Divoox.
    expect(await saldoDe(w)).toBe(410);
    expect((await w.responder(id, true)).estado).toBe(200);
    expect(await saldoDe(w)).toBe(410);
    const c = await w.e.m.DB.prepare(
      "SELECT COUNT(*) AS n, COALESCE(SUM(monto), 0) AS s FROM libro WHERE pedido_id = ? AND concepto = 'comision_restaurante' AND bolsillo = 'comisiones'",
    )
      .bind(id)
      .first<{ n: number; s: number }>();
    expect(c).toEqual({ n: 1, s: 90 });
  });
});

describe('C-COMIDA-PAGO-RESTAURANTE: canario, borrado y países sin la bandera', () => {
  it('la pieza «pagoComida» de la salud está en verde y se pone en rojo con un pago atascado', async () => {
    const w = await mundoPago();
    expect(await saludPagoComida(w.e.m.DB)).toBe('ok');
    const salud = await w.e.m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.pagoComida).toBe('ok');
    const { id } = await w.hastaPorPagar();
    await w.e.m.DB.prepare(
      "UPDATE pagos_comida SET vence_en = datetime('now', '-30 minutes') WHERE pedido_id = ?",
    )
      .bind(id)
      .run();
    expect(await saludPagoComida(w.e.m.DB)).toBe('error');
  });

  it('borrar la cuenta quita la foto del pago del cliente y los datos de la cuenta de cobro del restaurante', async () => {
    const w = await mundoPago();
    const { id } = await w.hastaPorPagar();
    expect((await w.reportar(id, '123456')).estado).toBe(200);
    const foto = await w.e.m.foto(
      `/datos/pedidos/${id}/pago-comida/comprobante`,
      w.e.cliente.token,
    );
    expect(foto.estado).toBe(200);
    expect((await w.pago(id))?.comprobante_clave).toBeTruthy();
    // Un pedido en curso no deja borrar la cuenta: se cierra primero (soporte lo cancela).
    expect(
      (
        await w.e.m.llamar(
          'POST',
          `/datos/admin/pedidos/${id}/cancelar`,
          { motivo: 'Cierre de la prueba' },
          w.e.admin.token,
        )
      ).estado,
    ).toBe(200);
    await borrarCuenta(w.env, w.e.m.DB, { id: w.e.cliente.id, correo: 'x@ejemplo.com' });
    expect((await w.pago(id))?.comprobante_clave).toBeNull();
    const dueno = await w.e.m.DB.prepare('SELECT dueno_id FROM restaurantes WHERE id = ?')
      .bind(w.r.rid)
      .first<{ dueno_id: string }>();
    await borrarCuenta(w.env, w.e.m.DB, { id: String(dueno?.dueno_id), correo: 'y@ejemplo.com' });
    const cu = await w.e.m.DB.prepare(
      'SELECT telefono, documento, titular, activa FROM cuentas_cobro_restaurante WHERE restaurante_id = ?',
    )
      .bind(w.r.rid)
      .first();
    expect(cu).toMatchObject({ telefono: '', documento: '', activa: 0 });
  });

  it('con la bandera apagada Venezuela sigue con el pago en el local de siempre (sin pago directo)', async () => {
    const e = await escenarioVe();
    expect((await abrirComida(e)).estado).toBe(201);
    const ve = (await e.m.llamar('GET', '/datos/admin/paises/VE', undefined, e.admin.token)).datos;
    expect(ve.config.comidaPagoRestaurante).toBe(false);
    const r = await restauranteVe(e);
    const p = await e.m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: r.rid,
        lineas: [{ platoId: r.platoId, cantidad: 2 }],
        propinaCentavos: 50,
        direccion: 'Calle de ejemplo 1',
        ...CASA,
        metodoPago: 'efectivo',
      },
      e.cliente.token,
    );
    expect(p.estado).toBe(201);
    expect(p.datos.pagoComida ?? null).toBeNull();
    const f = await e.m.DB.prepare('SELECT comision, pago_restaurante FROM pedidos WHERE id = ?')
      .bind(p.datos.pedidoId)
      .first<{ comision: number; pago_restaurante: number }>();
    expect(f?.comision).toBeGreaterThan(0);
    expect(f?.pago_restaurante).toBeLessThan(900);
    const n = await e.m.DB.prepare('SELECT COUNT(*) AS n FROM pagos_comida').first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  it('de fábrica solo Venezuela trae la bandera; Estados Unidos nunca', async () => {
    const { configPaisDeFabrica } = await import('../internacional/paises');
    expect(configPaisDeFabrica('VE').comidaPagoRestaurante).toBe(true);
    expect(configPaisDeFabrica('US').comidaPagoRestaurante).toBe(false);
    expect(configPaisDeFabrica('CO').comidaPagoRestaurante).toBe(false);
    expect(configPaisDeFabrica('PE').comidaPagoRestaurante).toBe(false);
  });
});

describe('C-SALDO-RESTAURANTE: la tabla de políticas acepta restaurantes', () => {
  it('la tabla vieja (solo empresa y conductor) se rehace una vez sin perder filas ni sus disparadores', async () => {
    const { crearBasePruebas } = await import('../pruebas/d1');
    const { POLITICAS_FINANCIERAS_DDL, politicasViejas, rehacerPoliticasFinancieras } =
      await import('../esquemaPoliticas');
    const db = crearBasePruebas();
    const vieja = POLITICAS_FINANCIERAS_DDL.replace(", 'restaurante'", '');
    expect(politicasViejas(vieja)).toBe(true);
    expect(politicasViejas(POLITICAS_FINANCIERAS_DDL)).toBe(false);
    await db.prepare('DROP TABLE politicas_financieras').run();
    await db.prepare(vieja).run();
    await db
      .prepare(
        `INSERT INTO politicas_financieras (id, servicio, tipo_cuenta, pais, modalidad, moneda, regla_json, vigente_desde)
         VALUES ('vieja-1', 'ride', 'conductor', 'VE', 'prepago', 'USD', '{"tipo":"porcentaje","pb":1000}', '2026-11-01 00:00:00')`,
      )
      .run();
    expect(await rehacerPoliticasFinancieras(db)).toBe(true);
    expect(await rehacerPoliticasFinancieras(db)).toBe(false);
    const fila = await db
      .prepare('SELECT tipo_cuenta, regla_json FROM politicas_financieras WHERE id = ?')
      .bind('vieja-1')
      .first();
    expect(fila).toMatchObject({ tipo_cuenta: 'conductor' });
    await db
      .prepare(
        `INSERT INTO politicas_financieras (id, servicio, tipo_cuenta, pais, modalidad, moneda, regla_json, vigente_desde)
         VALUES ('rest-1', 'food', 'restaurante', 'VE', 'prepago', 'USD', '{"tipo":"porcentaje","pb":0}', '2026-11-22 00:00:00')`,
      )
      .run();
    const n = await db
      .prepare('SELECT COUNT(*) AS n FROM politicas_financieras')
      .first<{ n: number }>();
    expect(n?.n).toBe(2);
  });
});
