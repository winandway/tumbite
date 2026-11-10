import {
  CASA,
  abrir,
  cerrar,
  comercio,
  pagar,
  preparar,
  repartidor,
  repartir,
} from './ayudaStaging';
import { expect, test } from './fixtures';
import { esperarVentanaLibre } from './registroPausado';

/**
 * A2 (10 nov 2026) — EE. UU. El circuito de pagos de COMIDA de punta a punta EN EL SITIO DE PRUEBAS,
 * con Stripe en modo prueba de verdad (tarjeta de prueba `pm_card_visa`, la 4242), por la API como
 * lo hacen las apps:
 * (a) compra: autorización al pedir, el restaurante acepta y marca listo, el repartidor recoge y
 *     entrega con foto, y se CAPTURA al entregar;
 * (b) el restaurante rechaza un pedido pagado y otro ya aceptado: la autorización queda ANULADA;
 * (c) un pedido ya listo: el restaurante no lo puede rechazar; pide la cancelación a soporte con
 *     motivo y soporte la aprueba (C-CANCELAR-LISTO): autorización ANULADA;
 * (d) queja del cliente por un plato que faltó y reembolso parcial hecho por soporte: UN reembolso
 *     en Stripe por el valor del plato;
 * (e) el reparto: la venta en la billetera del restaurante, la entrega y la propina en la del
 *     repartidor, y la conciliación de esos pedidos contra Stripe y el libro del día.
 * Imprime una línea «A2-x …» por paso con el pedido y el identificador del pago para
 * VERIFICAR-PAGOS.md. Los puntos internos de pago solo aceptan llaves sk_test_: nunca dinero real.
 * No toca Stripe Connect ni los retiros (pendientes de Richard): solo lee si están activos.
 */
const STAGING = Boolean(process.env.RECORRIDO_URL);
test.skip(!STAGING, 'solo en el sitio de pruebas (Stripe en modo prueba de verdad)');
test.afterAll(async () => {
  test.setTimeout(90_000);
  await esperarVentanaLibre();
});
if (STAGING && !/staging\.tumbite\.com|tumbite-pruebas/.test(process.env.RECORRIDO_URL ?? ''))
  throw new Error('Esta prueba solo corre contra el sitio de pruebas.');

test('A2: compra, anulaciones, cancelar un pedido listo, reembolso parcial y reparto del dinero', async ({
  request,
}) => {
  test.setTimeout(540_000);
  const x = await preparar(request);
  const { dueno, rid } = await comercio(x, 'rest.a2', 'Cubana');
  const equipo = await x.cuenta('soporte.a2', 'cliente', `Soporte A2 ${x.id.slice(-4)}`);
  let rep: { token: string; usuario: { id: string } } | null = null;
  const dinero = (c: number) => (c / 100).toFixed(2);
  try {
    const plato = async (nombreEs: string, nombreEn: string, precioCentavos: number) => {
      const r = await request.post('/datos/mi-restaurante/platos', {
        headers: x.con(dueno.token),
        data: { nombreEs, nombreEn, precioCentavos },
      });
      expect(r.ok(), await r.text()).toBe(true);
      return ((await r.json()) as { plato: { id: string } }).plato.id;
    };
    const arroz = await plato('Arroz con pollo', 'Chicken and rice', 1500);
    const jugo = await plato('Jugo natural', 'Fresh juice', 500);
    await abrir(x, dueno.token);
    const cliente = await x.cuenta('cliente.a2', 'cliente');
    const pedir = async (propinaCentavos: number) => {
      const r = await request.post('/datos/pedidos', {
        headers: x.con(cliente.token),
        data: {
          restauranteId: rid,
          lineas: [
            { platoId: arroz, cantidad: 1 },
            { platoId: jugo, cantidad: 1 },
          ],
          propinaCentavos,
          entrega: 'puerta',
          direccion: '400 Calle de Ejemplo, Miami, FL',
          ...CASA,
        },
      });
      expect(r.status(), await r.text()).toBe(201);
      return (await r.json()) as { pedidoId: string; desglose: { totalCliente: number } };
    };
    const delRestaurante = (pedidoId: string, ruta: string, data: object = {}) =>
      request.post(`/datos/restaurante/pedidos/${pedidoId}/${ruta}`, {
        headers: x.con(dueno.token),
        data,
      });
    const fila = async (pedidoId: string) =>
      (
        await x.sql(
          `SELECT p.estado, p.total, p.propina, p.pago_restaurante, p.pago_repartidor, p.ganancia, p.stripe_sesion AS pi,
                  c.capturado, c.capturado_en, c.cancelado_en
             FROM pedidos p LEFT JOIN cobros c ON c.pedido_id = p.id WHERE p.id = '${pedidoId}'`,
        )
      )[0]!;
    const conciliar = async (pedidos: string[]) => {
      const r = await request.post('/datos/interno/diagnostico/conciliacion', {
        headers: x.secreto,
        data: { pedidos },
      });
      expect(r.ok(), await r.text()).toBe(true);
      const c = (await r.json()) as {
        ok: boolean;
        casos: { nombre: string; ok: boolean; detalle?: string }[];
      };
      return {
        c,
        resumen: `conciliación ${c.ok ? 'cuadra' : 'NO cuadra'} (${c.casos.map((y) => `${y.ok ? 'ok' : 'NO'} ${y.nombre}${y.ok ? '' : ` — ${y.detalle ?? ''}`}`).join('; ')})`,
      };
    };
    /** Cancelado, con la autorización anulada y nada capturado. */
    const anulado = async (pedidoId: string) => {
      await expect
        .poll(
          async () => {
            const f = await fila(pedidoId);
            return `${String(f.estado)}:${f.cancelado_en ? 'anulado' : 'sin-anular'}:${f.capturado_en ? 'capturado' : 'sin-capturar'}`;
          },
          { timeout: 60_000, message: 'cancelado con la autorización anulada' },
        )
        .toBe('cancelado:anulado:sin-capturar');
      return fila(pedidoId);
    };

    // (b1) Rechazo con el pedido PAGADO: se anula la autorización.
    const b1 = await pedir(0);
    const b1Autorizado = await pagar(x, b1.pedidoId);
    expect(b1Autorizado).toBe(b1.desglose.totalCliente);
    const rechazo1 = await delRestaurante(b1.pedidoId, 'rechazar');
    expect(rechazo1.status(), await rechazo1.text()).toBe(200);
    const fb1 = await anulado(b1.pedidoId);
    console.warn(
      `A2-b1 pedido ${b1.pedidoId} (${String(fb1.pi)}): autorizado ${dinero(b1Autorizado)}; el restaurante lo rechazó en «pagado»: cancelado, autorización anulada, nada capturado`,
    );

    // (b2) Rechazo con el pedido ya ACEPTADO: también se anula.
    const b2 = await pedir(0);
    const b2Autorizado = await pagar(x, b2.pedidoId);
    expect((await delRestaurante(b2.pedidoId, 'aceptar', { minutos: 5 })).ok()).toBe(true);
    const rechazo2 = await delRestaurante(b2.pedidoId, 'rechazar');
    expect(rechazo2.status(), await rechazo2.text()).toBe(200);
    const fb2 = await anulado(b2.pedidoId);
    console.warn(
      `A2-b2 pedido ${b2.pedidoId} (${String(fb2.pi)}): autorizado ${dinero(b2Autorizado)}; el restaurante lo rechazó en «aceptado»: cancelado, autorización anulada, nada capturado`,
    );

    // (c) Pedido ya LISTO: el restaurante no lo rechaza solo; lo pide a soporte y soporte aprueba.
    const cc = await pedir(0);
    const ccAutorizado = await pagar(x, cc.pedidoId);
    expect((await delRestaurante(cc.pedidoId, 'aceptar', { minutos: 5 })).ok()).toBe(true);
    expect((await delRestaurante(cc.pedidoId, 'listo')).ok()).toBe(true);
    expect(
      (await delRestaurante(cc.pedidoId, 'rechazar')).status(),
      'un pedido listo no se rechaza por cuenta propia',
    ).toBe(409);
    const pide = await delRestaurante(cc.pedidoId, 'pedir-cancelacion', { motivo: 'agotado' });
    expect(pide.status(), await pide.text()).toBe(201);
    const solicitudId = ((await pide.json()) as { solicitud: { id: string } }).solicitud.id;
    expect(String((await fila(cc.pedidoId)).estado), 'pedirlo no cancela nada').toBe('listo');
    await x.sql(`UPDATE usuarios SET rol = 'admin' WHERE id = '${equipo.usuario.id}'`);
    const aprueba = await request.post(`/datos/admin/cancelaciones/${solicitudId}/aprobar`, {
      headers: x.con(equipo.token),
      data: { nota: 'Prueba A2 del circuito de pagos' },
    });
    expect(aprueba.status(), await aprueba.text()).toBe(200);
    const otraVez = await request.post(`/datos/admin/cancelaciones/${solicitudId}/aprobar`, {
      headers: x.con(equipo.token),
      data: {},
    });
    expect(otraVez.status(), 'aprobar dos veces no hace nada más').toBe(409);
    const fc = await anulado(cc.pedidoId);
    console.warn(
      `A2-c pedido ${cc.pedidoId} (${String(fc.pi)}): autorizado ${dinero(ccAutorizado)}; listo; rechazar responde 409; el restaurante pidió la cancelación (motivo «agotado», solicitud ${solicitudId}) y soporte la aprobó: cancelado, autorización anulada, nada capturado`,
    );

    // (a) Compra completa con repartidor: autoriza al pedir y CAPTURA al entregar.
    rep = await repartidor(x);
    const a = await pedir(300);
    const aAutorizado = await pagar(x, a.pedidoId);
    expect(aAutorizado).toBe(a.desglose.totalCliente);
    expect((await fila(a.pedidoId)).capturado_en, 'al pedir solo se autoriza').toBeNull();
    expect((await delRestaurante(a.pedidoId, 'aceptar', { minutos: 5 })).ok()).toBe(true);
    expect((await delRestaurante(a.pedidoId, 'listo')).ok()).toBe(true);
    await repartir(x, a.pedidoId, rep);
    const fin = await cerrar(x, a.pedidoId);
    expect(fin.total).toBe(a.desglose.totalCliente);
    const fa = await fila(a.pedidoId);
    console.warn(
      `A2-a pedido ${a.pedidoId} (${String(fa.pi)}): total ${dinero(fin.total)}, autorizado ${dinero(aAutorizado)} al pedir, aceptado, listo, recogido con código y foto, entregado en la puerta con foto, capturado ${dinero(Number(fa.capturado))} al entregar; ${fin.resumen}`,
    );
    expect(fin.c.ok, JSON.stringify(fin.c.casos)).toBe(true);

    // (e) El reparto del dinero: billeteras del restaurante y del repartidor.
    const movs = await x.sql(
      `SELECT usuario_id, concepto, SUM(monto) AS monto FROM movimientos WHERE pedido_id = '${a.pedidoId}' GROUP BY usuario_id, concepto`,
    );
    const de = (usuario: string, concepto: string) =>
      Number(movs.find((m) => m.usuario_id === usuario && m.concepto === concepto)?.monto ?? 0);
    const venta = de(dueno.usuario.id, 'venta');
    const entrega = de(rep.usuario.id, 'entrega');
    const propina = de(rep.usuario.id, 'propina');
    expect(venta, 'la venta del restaurante es su pago').toBe(Number(fa.pago_restaurante));
    expect(venta).toBeGreaterThan(0);
    expect(propina, 'la propina entera va al repartidor').toBe(300);
    expect(entrega, 'el repartidor cobra la entrega').toBeGreaterThan(0);
    const billetera = async (token: string) =>
      (await (await request.get('/datos/billetera', { headers: x.con(token) })).json()) as {
        saldo: number;
        cuentaConectada: boolean;
        pagosActivos: boolean;
        retirosActivos: boolean;
      };
    const bRest = await billetera(dueno.token);
    const bRep = await billetera(rep.token);
    expect(bRest.saldo, 'el saldo del restaurante es la venta').toBe(venta);
    expect(bRep.saldo, 'el saldo del repartidor es la entrega más la propina').toBe(
      entrega + propina,
    );
    console.warn(
      `A2-e pedido ${a.pedidoId}: cobrado al cliente ${dinero(fin.total)}; restaurante: venta ${dinero(venta)} (saldo de su billetera ${dinero(bRest.saldo)}); repartidor: entrega ${dinero(entrega)} + propina ${dinero(propina)} (saldo de su billetera ${dinero(bRep.saldo)}; pago_repartidor guardado ${dinero(Number(fa.pago_repartidor))}); ganancia de Divoox guardada ${dinero(Number(fa.ganancia))}; retiros activos: ${String(bRest.retirosActivos)}; cuenta de cobros conectada: restaurante ${String(bRest.cuentaConectada)}, repartidor ${String(bRep.cuentaConectada)}`,
    );

    // (d) Queja por un plato que faltó y reembolso parcial hecho por soporte.
    const queja = await request.post('/datos/quejas', {
      headers: x.con(cliente.token),
      data: {
        tipo: 'queja',
        pedidoId: a.pedidoId,
        texto: 'Prueba A2: el jugo no llegó en la bolsa.',
        motivo: 'articulo_faltante',
        platoIds: [jugo],
      },
    });
    expect(queja.status(), await queja.text()).toBe(201);
    const q = (await queja.json()) as { propuesta: number; reembolso: number; ticketId: string };
    expect(q.propuesta, 'la propuesta es el valor del plato que faltó').toBe(500);
    if (!q.reembolso) {
      const devolver = await request.post(`/datos/admin/pedidos/${a.pedidoId}/devolver`, {
        headers: x.con(equipo.token),
        data: {
          montoCentavos: q.propuesta,
          motivo: 'Prueba A2: faltó el jugo',
          cargarA: 'tumbite',
        },
      });
      expect(devolver.status(), await devolver.text()).toBe(200);
    }
    const devs = await x.sql(
      `SELECT monto, cargar_a, stripe_reembolso FROM devoluciones WHERE pedido_id = '${a.pedidoId}'`,
    );
    expect(devs).toHaveLength(1);
    expect(Number(devs[0]?.monto)).toBe(500);
    expect(String(devs[0]?.stripe_reembolso ?? '')).toMatch(/^re_/);
    // La devolución la asume Divoox: las billeteras no cambian.
    expect((await billetera(dueno.token)).saldo).toBe(venta);
    expect((await billetera(rep.token)).saldo).toBe(entrega + propina);
    const todo = await conciliar([a.pedidoId, b1.pedidoId, b2.pedidoId, cc.pedidoId]);
    console.warn(
      `A2-d pedido ${a.pedidoId}: queja «artículo faltante» (caso ${q.ticketId}), propuesta ${dinero(q.propuesta)}; ${q.reembolso ? 'reembolso automático' : 'reembolso hecho por soporte'} de ${dinero(500)} a cargo de Divoox, UN reembolso en Stripe (${String(devs[0]?.stripe_reembolso)}); las billeteras no cambian; los cuatro pedidos contra Stripe: ${todo.resumen}`,
    );
    expect(todo.c.ok, JSON.stringify(todo.c.casos)).toBe(true);
  } finally {
    await request.patch('/datos/mi-restaurante/abierto', {
      headers: x.con(dueno.token),
      data: { abierto: false },
    });
    if (rep)
      await request.post('/datos/repartidor/conectar', {
        headers: x.con(rep.token),
        data: { conectado: false },
      });
    await x
      .sql(`UPDATE usuarios SET rol = 'cliente' WHERE id = '${equipo.usuario.id}'`)
      .catch(() => undefined);
  }
});
