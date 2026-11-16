import type { APIResponse } from '@playwright/test';
import {
  CASA,
  abrir,
  comercio,
  pagar,
  preparar,
  repartidor,
  repartir,
  type Ctx,
} from './ayudaStaging';
import { expect, test } from './fixtures';
import { esperarVentanaLibre } from './registroPausado';

/**
 * C-AUTORIZACION-VENCIDA (16 nov 2026) — todos los países con tarjeta; aquí EE. UU. (Miami).
 * La resolución de una autorización de tarjeta vencida, de punta a punta EN EL SITIO DE PRUEBAS con
 * Stripe en modo prueba de verdad (tarjeta de prueba `pm_card_visa`, la 4242), por la API como lo
 * hace el panel:
 * (a) pedido de comida pagado con la 4242, aceptado y listo; su autorización «de hace 97 horas» pone
 *     la pieza `autorizaciones` de la salud en «pendiente»;
 * (b) la autorización VENCE: la ruta de diagnóstico la anula de verdad en Stripe de prueba (Stripe
 *     no deja adelantar el reloj de un PaymentIntent suelto; una retención vencida queda igual,
 *     `canceled`). Al entregar, la captura falla: la liquidación queda «en revisión», el pedido
 *     entregado y la pieza `cobros` de la salud en `error` (503), como el pedido 407F;
 * (c) el superadmin consulta el estado real del cobro en Stripe; con el interruptor
 *     `RECOBRO_TARJETA_ACTIVO` apagado, «Volver a cobrar» responde 409 y no cobra nada;
 * (d) cierra «sin cobro» con nota (doble clic incluido): sale de revisión, la salud vuelve a verde,
 *     la conciliación del pedido contra Stripe cuadra, el día deja de esperar esa captura y el monto
 *     aparece en «lo que asumió Divoox»;
 * (e) «Volver a cobrar» con el interruptor ENCENDIDO: solo corre si el sitio de pruebas lo tiene
 *     encendido en su panel (no hay forma de encenderlo solo para esta corrida); si no, se salta y
 *     lo dice.
 * Imprime una línea «AV-x …» por paso con el pedido y el PaymentIntent para VERIFICAR-PAGOS.md.
 * Los puntos internos de pago solo aceptan llaves sk_test_: nunca dinero real.
 */
const STAGING = Boolean(process.env.RECORRIDO_URL);
test.skip(!STAGING, 'solo en el sitio de pruebas (Stripe en modo prueba de verdad)');
test.afterAll(async () => {
  test.setTimeout(90_000);
  await esperarVentanaLibre();
});
if (STAGING && !/staging\.tumbite\.com|tumbite-pruebas/.test(process.env.RECORRIDO_URL ?? ''))
  throw new Error('Esta prueba solo corre contra el sitio de pruebas.');

type EstadoAutorizacion = {
  liquidacion: { estado: string; monto: number; moneda: string; error: string | null };
  resolucion: Record<string, unknown> | null;
  cobroEncendido: boolean;
  stripe: {
    pago: string;
    estado: string;
    montoAutorizado: number;
    montoPorCapturar: number;
    montoCobrado: number;
    vencida: boolean;
    motivoCancelacion: string | null;
    canceladaEn: string | null;
    autorizadaEn: string | null;
    consentimiento: boolean;
    tarjeta: { marca: string; ultimos4: string } | null;
  } | null;
  aviso: string | null;
  sePuedeResolver: boolean;
  sePuedeCobrar: boolean;
  motivoSinCobro: string | null;
};
type Salud = { ok: boolean; piezas: Record<string, string> };
type DiaConciliado = {
  dia: string;
  cuadra: boolean;
  detalle: { stripeEsperado?: number; stripeCapturado?: number } & Record<string, unknown>;
};

/** Se llena en el primer caso: el segundo solo corre si el sitio tiene «Volver a cobrar» encendido. */
let recobroEncendidoEnPruebas: boolean | null = null;

const dinero = (c: number) => (c / 100).toFixed(2);

/** Comercio, plato, cliente, repartidor y una cuenta del equipo (Total) de esta corrida. */
async function escenario(x: Ctx, q: string) {
  const { dueno, rid } = await comercio(x, `rest.${q}`, 'Cubana');
  const plato = await x.request.post('/datos/mi-restaurante/platos', {
    headers: x.con(dueno.token),
    data: { nombreEs: 'Arroz con pollo', nombreEn: 'Chicken and rice', precioCentavos: 1800 },
  });
  expect(plato.ok(), await plato.text()).toBe(true);
  const platoId = ((await plato.json()) as { plato: { id: string } }).plato.id;
  await abrir(x, dueno.token);
  const cliente = await x.cuenta(`cliente.${q}`, 'cliente');
  const equipo = await x.cuenta(`soporte.${q}`, 'cliente', `Soporte ${q} ${x.id.slice(-4)}`);
  await x.sql(`UPDATE usuarios SET rol = 'admin' WHERE id = '${equipo.usuario.id}'`);
  const rep = await repartidor(x);
  return { dueno, rid, platoId, cliente, equipo, rep };
}
type Escenario = Awaited<ReturnType<typeof escenario>>;

/** Pedido pagado con la 4242, aceptado y listo; la autorización «vence» en Stripe y se entrega. */
async function entregaConAutorizacionVencida(x: Ctx, e: Escenario, q: string) {
  const r = await x.request.post('/datos/pedidos', {
    headers: x.con(e.cliente.token),
    data: {
      restauranteId: e.rid,
      lineas: [{ platoId: e.platoId, cantidad: 1 }],
      propinaCentavos: 200,
      entrega: 'puerta',
      direccion: '400 Calle de Ejemplo, Miami, FL',
      ...CASA,
    },
  });
  expect(r.status(), await r.text()).toBe(201);
  const { pedidoId, desglose } = (await r.json()) as {
    pedidoId: string;
    desglose: { totalCliente: number };
  };
  const autorizado = await pagar(x, pedidoId);
  expect(autorizado, 'se autoriza el total del recibo').toBe(desglose.totalCliente);
  const pi = String(
    (await x.sql(`SELECT stripe_sesion FROM pedidos WHERE id = '${pedidoId}'`))[0]?.stripe_sesion,
  );
  expect(pi).toMatch(/^pi_/);

  // El aviso de 96 horas: la autorización «de hace 97 horas» y el pedido todavía abierto.
  await x.sql(
    `UPDATE cobros SET autorizado_en = datetime('now', '-97 hours') WHERE pedido_id = '${pedidoId}'`,
  );
  const salud96 = await saludAhora(x);
  expect(salud96.piezas.autorizaciones, 'la salud avisa la autorización por vencer').toBe(
    'pendiente',
  );
  expect(salud96.piezas.autorizaciones).not.toBe('error');
  console.warn(
    `AV-${q}1 pedido ${pedidoId} (${pi}): autorizado ${dinero(autorizado)} con la tarjeta de prueba 4242; con la autorización de hace 97 horas la salud marca autorizaciones «${salud96.piezas.autorizaciones}» (no 503: ok=${String(salud96.ok)})`,
  );

  const delRestaurante = (ruta: string, data: object = {}) =>
    x.request.post(`/datos/restaurante/pedidos/${pedidoId}/${ruta}`, {
      headers: x.con(e.dueno.token),
      data,
    });
  expect((await delRestaurante('aceptar', { minutos: 5 })).ok()).toBe(true);
  expect((await delRestaurante('listo')).ok()).toBe(true);

  // La autorización VENCE en Stripe (de prueba) antes de la entrega.
  const vence = await x.request.post('/datos/interno/diagnostico/vencer-autorizacion', {
    headers: x.secreto,
    data: { pedidoId },
  });
  expect(vence.status(), await vence.text()).toBe(200);
  const v = (await vence.json()) as { pago: string; estado: string; motivo: string | null };
  expect(v).toMatchObject({ pago: pi, estado: 'canceled' });

  await repartir(x, pedidoId, e.rep);
  await expect
    .poll(
      async () =>
        (
          await x.sql(
            `SELECT p.estado || ':' || COALESCE(l.estado, '') || ':' || COALESCE(c.capturado_en, 'sin-capturar') AS e
               FROM pedidos p LEFT JOIN liquidaciones l ON l.pedido_id = p.id LEFT JOIN cobros c ON c.pedido_id = p.id
              WHERE p.id = '${pedidoId}'`,
          )
        )[0]?.e,
      { timeout: 90_000, message: 'entregado, la captura falla y la entrega queda en revisión' },
    )
    .toBe('entregado:revision:sin-capturar');
  const liq = (
    await x.sql(
      `SELECT monto, intentos, error, date(p.entregado_en) AS dia FROM liquidaciones l JOIN pedidos p ON p.id = l.pedido_id WHERE l.pedido_id = '${pedidoId}'`,
    )
  )[0]!;
  return {
    pedidoId,
    pi,
    total: desglose.totalCliente,
    monto: Number(liq.monto),
    dia: String(liq.dia),
    error: String(liq.error ?? ''),
    intentos: Number(liq.intentos),
  };
}

async function saludAhora(x: Ctx): Promise<Salud> {
  const r = await x.request.get('/datos/salud', { headers: { 'cache-control': 'no-cache' } });
  return (await r.json()) as Salud;
}

/** Otras entregas del sitio de pruebas (de otras corridas) en revisión o atrasadas. */
async function otrasEnRevision(x: Ctx, pedidoId: string) {
  return Number(
    (
      await x.sql(
        `SELECT COUNT(*) AS n FROM liquidaciones WHERE pedido_id <> '${pedidoId}' AND (estado = 'revision'
           OR (estado IN ('pendiente', 'capturando', 'reintentar') AND creado_en < datetime('now', '-2 hours')))`,
      )
    )[0]?.n ?? 0,
  );
}

const leerEstado = async (x: Ctx, token: string, pedidoId: string) => {
  const r = await x.request.get(`/datos/admin/liquidaciones/${pedidoId}/autorizacion`, {
    headers: x.con(token),
  });
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()) as EstadoAutorizacion;
};

async function conciliarPedido(x: Ctx, pedidoId: string) {
  const r = await x.request.post('/datos/interno/diagnostico/conciliacion', {
    headers: x.secreto,
    data: { pedidos: [pedidoId] },
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
}

async function diaConciliado(x: Ctx, token: string, dia: string, recalcular: boolean) {
  const r = await x.request.get(`/datos/admin/conciliacion${recalcular ? `?dia=${dia}` : ''}`, {
    headers: x.con(token),
  });
  expect(r.status(), await r.text()).toBe(200);
  const fila = ((await r.json()) as { conciliaciones: DiaConciliado[] }).conciliaciones.find(
    (d) => d.dia === dia,
  );
  expect(fila, `la conciliación del día ${dia}`).toBeTruthy();
  const falta =
    Number(fila!.detalle.stripeEsperado ?? 0) - Number(fila!.detalle.stripeCapturado ?? 0);
  return { fila: fila!, falta };
}

async function absorbido(x: Ctx, token: string) {
  const r = await x.request.get('/datos/admin/liquidaciones', { headers: x.con(token) });
  expect(r.status(), await r.text()).toBe(200);
  const d = (await r.json()) as {
    revision: { pedidoId: string }[];
    absorbidoSinCobro: { mes: string; moneda: string; pedidos: number; monto: number }[];
  };
  const mes = new Date().toISOString().slice(0, 7);
  const usd = d.absorbidoSinCobro.find((a) => a.mes === mes && a.moneda === 'USD');
  return { revision: d.revision, monto: usd?.monto ?? 0, pedidos: usd?.pedidos ?? 0 };
}

/** Si algo falló a mitad, la entrega de la prueba no se queda en revisión (la salud quedaría en rojo). */
async function limpiar(x: Ctx, token: string, pedidoId: string | null) {
  if (!pedidoId) return;
  const f = await x
    .sql(`SELECT estado FROM liquidaciones WHERE pedido_id = '${pedidoId}'`)
    .catch(() => []);
  if (f[0]?.estado !== 'revision') return;
  await x.request.post(`/datos/admin/liquidaciones/${pedidoId}/autorizacion/sin-cobro`, {
    headers: x.con(token),
    data: { nota: 'Limpieza de la prueba de autorización vencida (la corrida falló a mitad).' },
  });
}

async function soltar(x: Ctx, e: Escenario | null) {
  if (!e) return;
  await x.request.patch('/datos/mi-restaurante/abierto', {
    headers: x.con(e.dueno.token),
    data: { abierto: false },
  });
  await x.request.post('/datos/repartidor/conectar', {
    headers: x.con(e.rep.token),
    data: { conectado: false },
  });
  await x
    .sql(`UPDATE usuarios SET rol = 'cliente' WHERE id = '${e.equipo.usuario.id}'`)
    .catch(() => undefined);
}

test('AV: autorización vencida al entregar → en revisión → Volver a cobrar apagado (409) → cerrar sin cobro', async ({
  request,
}) => {
  test.setTimeout(560_000);
  const x = await preparar(request);
  let e: Escenario | null = null;
  let pedidoId: string | null = null;
  try {
    e = await escenario(x, 'av');
    const ent = await entregaConAutorizacionVencida(x, e, 'a');
    pedidoId = ent.pedidoId;
    expect(ent.monto, 'la entrega espera cobrar el total').toBe(ent.total);
    expect(ent.error).toMatch(/canceled/);
    const salud = await saludAhora(x);
    expect(salud.piezas.cobros, 'una entrega en revisión pone «cobros» en error').toBe('error');
    expect(salud.ok, 'y la salud responde 503').toBe(false);
    console.warn(
      `AV-b pedido ${ent.pedidoId} (${ent.pi}): la autorización venció en Stripe de prueba (anulada antes de entregar); el repartidor entregó con foto y deslizar; la captura falló (${ent.intentos} intento, «${ent.error}»): entregado, liquidación en revisión, nada capturado; salud cobros «${salud.piezas.cobros}», ok=${String(salud.ok)} (503)`,
    );

    // (c) El superadmin: la lista de revisión, el estado REAL en Stripe y «Volver a cobrar» apagado.
    const antesAbs = await absorbido(x, e.equipo.token);
    expect(antesAbs.revision.map((r) => r.pedidoId)).toContain(ent.pedidoId);
    const est = await leerEstado(x, e.equipo.token, ent.pedidoId);
    expect(est.liquidacion).toMatchObject({ estado: 'revision', monto: ent.total, moneda: 'USD' });
    expect(est.stripe).toMatchObject({
      pago: ent.pi,
      estado: 'canceled',
      vencida: true,
      montoAutorizado: ent.total,
      montoCobrado: 0,
      consentimiento: true,
    });
    expect(est.stripe?.tarjeta?.ultimos4).toBe('4242');
    expect(est.aviso).toBeNull();
    expect(est.sePuedeResolver).toBe(true);
    recobroEncendidoEnPruebas = est.cobroEncendido;
    const cobrar = await request.post(
      `/datos/admin/liquidaciones/${ent.pedidoId}/autorizacion/cobrar`,
      { headers: x.con(e.equipo.token), data: { nota: 'Prueba AV' } },
    );
    if (!est.cobroEncendido) {
      expect(est.sePuedeCobrar, 'apagado: el panel no ofrece cobrar').toBe(false);
      expect(cobrar.status(), await cobrar.text()).toBe(409);
      expect(await cobrar.text()).toMatch(/apagado/);
      const sigue = await x.sql(
        `SELECT l.estado, p.stripe_sesion, (SELECT COUNT(*) FROM aprobaciones_dinero a WHERE a.objeto = p.id) AS aprob
           FROM liquidaciones l JOIN pedidos p ON p.id = l.pedido_id WHERE l.pedido_id = '${ent.pedidoId}'`,
      );
      expect(sigue[0]).toMatchObject({ estado: 'revision', stripe_sesion: ent.pi });
      expect(Number(sigue[0]?.aprob), 'ni siquiera pide la segunda firma').toBe(0);
    } else {
      // Encendido en el panel del sitio de pruebas: este caso no cobra (lo hace el segundo).
      await cobrar.dispose();
      test.info().annotations.push({
        type: 'aviso',
        description: 'El sitio de pruebas tiene RECOBRO_TARJETA_ACTIVO encendido.',
      });
    }
    console.warn(
      `AV-c pedido ${ent.pedidoId}: el superadmin ve en Stripe ${String(est.stripe?.estado)} (motivo ${String(est.stripe?.motivoCancelacion)}, cancelado ${String(est.stripe?.canceladaEn)}), autorizado ${dinero(Number(est.stripe?.montoAutorizado))}, cobrado ${dinero(Number(est.stripe?.montoCobrado))}, tarjeta ${String(est.stripe?.tarjeta?.marca)} •••• ${String(est.stripe?.tarjeta?.ultimos4)}, permiso del cliente ${String(est.stripe?.consentimiento)}, motivoSinCobro ${String(est.motivoSinCobro)}; Volver a cobrar ${est.cobroEncendido ? 'ENCENDIDO en el sitio de pruebas' : `APAGADO: sePuedeCobrar ${String(est.sePuedeCobrar)} y la ruta responde ${cobrar.status()}`}`,
    );

    // Antes de cerrar: la conciliación del pedido lo marca y el día espera esa captura.
    const concAntes = await conciliarPedido(x, ent.pedidoId);
    expect(concAntes.c.ok, 'en revisión la conciliación lo marca').toBe(false);
    expect(JSON.stringify(concAntes.c.casos)).toMatch(/entregado sin captura/);
    const diaAntes = await diaConciliado(x, e.equipo.token, ent.dia, true);

    // (d) Cerrar sin cobro: sin nota no se puede; con nota, y con doble clic, una sola resolución.
    const sinNota = await request.post(
      `/datos/admin/liquidaciones/${ent.pedidoId}/autorizacion/sin-cobro`,
      { headers: x.con(e.equipo.token), data: { nota: 'no' } },
    );
    expect(sinNota.status(), await sinNota.text()).toBe(400);
    const nota = `Prueba AV ${x.id}: la autorización venció antes de entregar; Divoox asume el pedido.`;
    const cerrar = () =>
      request.post(`/datos/admin/liquidaciones/${ent.pedidoId}/autorizacion/sin-cobro`, {
        headers: x.con(e!.equipo.token),
        data: { nota },
      });
    const [c1, c2] = await Promise.all([cerrar(), cerrar()]);
    const cuerpos = await Promise.all(
      [c1, c2].map(async (r: APIResponse) => [r.status(), await r.text()] as const),
    );
    expect(
      cuerpos.map(([s]) => s),
      `doble clic: ${JSON.stringify(cuerpos)}`,
    ).toEqual([200, 200]);
    expect(cuerpos.map(([, t]) => (JSON.parse(t) as { estado: string }).estado)).toEqual([
      'no_aplica',
      'no_aplica',
    ]);
    const otra = await cerrar();
    expect(otra.status()).toBe(200);
    expect(await otra.json()).toMatchObject({ estado: 'no_aplica', yaEstaba: true });
    const resol = await x.sql(
      `SELECT COUNT(*) AS n, MAX(detalle) AS detalle FROM bitacora_pedidos WHERE pedido_id = '${ent.pedidoId}' AND evento = 'autorizacion_resuelta'`,
    );
    expect(Number(resol[0]?.n), 'una sola resolución anotada').toBe(1);
    expect(String(resol[0]?.detalle)).toContain('sin_cobro');

    const despues = await leerEstado(x, e.equipo.token, ent.pedidoId);
    expect(despues.liquidacion.estado).toBe('no_aplica');
    expect(despues.resolucion, 'la ficha dice quién cerró y su nota').toBeTruthy();
    const otras = await otrasEnRevision(x, ent.pedidoId);
    const saludFin = await saludAhora(x);
    if (otras === 0) {
      expect(saludFin.piezas.cobros, 'sin entregas en revisión «cobros» vuelve a verde').toBe('ok');
    } else {
      test.info().annotations.push({
        type: 'aviso',
        description: `«cobros» sigue en ${saludFin.piezas.cobros}: hay ${otras} entregas de otras corridas en revisión o atrasadas`,
      });
    }
    const concDespues = await conciliarPedido(x, ent.pedidoId);
    expect(concDespues.c.ok, concDespues.resumen).toBe(true);
    // El día ya conciliado se recalculó solo al cerrar (sin pedirlo): dejó de esperar esa captura.
    const diaDespues = await diaConciliado(x, e.equipo.token, ent.dia, false);
    expect(
      diaAntes.falta - diaDespues.falta,
      'el día deja de esperar la captura de esta entrega',
    ).toBe(ent.total);
    const despuesAbs = await absorbido(x, e.equipo.token);
    expect(despuesAbs.revision.map((r) => r.pedidoId)).not.toContain(ent.pedidoId);
    expect(despuesAbs.monto - antesAbs.monto, 'lo que asumió Divoox sube por el total').toBe(
      ent.total,
    );
    expect(despuesAbs.pedidos - antesAbs.pedidos).toBe(1);
    console.warn(
      `AV-d pedido ${ent.pedidoId} (${ent.pi}): sin nota 400; cerrado sin cobro con nota y doble clic (dos 200, una sola resolución; el tercero «yaEstaba»): liquidación no_aplica; salud cobros «${saludFin.piezas.cobros}» (ok=${String(saludFin.ok)}; otras entregas en revisión: ${otras}); ${concDespues.resumen}; día ${ent.dia}: faltaba capturar ${dinero(diaAntes.falta)} y ahora ${dinero(diaDespues.falta)} (el día ${diaDespues.fila.cuadra ? 'cuadra' : 'NO cuadra por otras corridas'}); lo que asumió Divoox este mes: ${dinero(antesAbs.monto)} → ${dinero(despuesAbs.monto)} (${despuesAbs.pedidos} entregas)`,
    );
    pedidoId = null;
  } finally {
    if (e) await limpiar(x, e.equipo.token, pedidoId);
    await soltar(x, e);
  }
});

test('AV-e: Volver a cobrar con la tarjeta guardada (solo si el sitio de pruebas lo tiene encendido)', async ({
  request,
}) => {
  test.skip(
    recobroEncendidoEnPruebas !== true,
    'RECOBRO_TARJETA_ACTIVO está apagado en el sitio de pruebas: se enciende solo en su panel (no hay forma de encenderlo solo para esta corrida). Sin probar en staging.',
  );
  test.setTimeout(560_000);
  const x = await preparar(request);
  let e: Escenario | null = null;
  let pedidoId: string | null = null;
  try {
    e = await escenario(x, 'ave');
    const ent = await entregaConAutorizacionVencida(x, e, 'e');
    pedidoId = ent.pedidoId;
    const est = await leerEstado(x, e.equipo.token, ent.pedidoId);
    expect(est.sePuedeCobrar, JSON.stringify(est)).toBe(true);
    // Doble clic: un solo cobro en Stripe.
    const cobrar = () =>
      request.post(`/datos/admin/liquidaciones/${ent.pedidoId}/autorizacion/cobrar`, {
        headers: x.con(e!.equipo.token),
        data: { nota: `Prueba AV-e ${x.id}` },
      });
    const respuestas = await Promise.all([cobrar(), cobrar()]);
    const vistos = await Promise.all(
      respuestas.map(async (r) => [r.status(), await r.text()] as const),
    );
    expect(
      vistos.some(([s]) => s === 200),
      `al menos uno cobra: ${JSON.stringify(vistos)}`,
    ).toBe(true);
    for (const [s, t] of vistos) expect([200, 409], t).toContain(s);
    await expect
      .poll(
        async () =>
          (
            await x.sql(
              `SELECT l.estado || ':' || COALESCE(l.pi, '') || ':' || p.stripe_sesion AS e FROM liquidaciones l JOIN pedidos p ON p.id = l.pedido_id WHERE l.pedido_id = '${ent.pedidoId}'`,
            )
          )[0]?.e,
        { timeout: 90_000, message: 'la liquidación cierra con el pago nuevo' },
      )
      .toMatch(/^capturada:/);
    const f = (
      await x.sql(
        `SELECT p.stripe_sesion AS pi, c.capturado, (SELECT COUNT(*) FROM bitacora_pedidos b WHERE b.pedido_id = p.id AND b.evento LIKE 'cobro_reautorizado:%') AS reaut
           FROM pedidos p JOIN cobros c ON c.pedido_id = p.id WHERE p.id = '${ent.pedidoId}'`,
      )
    )[0]!;
    const nuevo = String(f.pi);
    expect(nuevo).toMatch(/^pi_/);
    expect(nuevo, 'el pedido apunta al cobro nuevo').not.toBe(ent.pi);
    expect(Number(f.capturado)).toBe(ent.total);
    expect(Number(f.reaut)).toBe(1);
    // Un solo cobro de reemplazo en Stripe y la conciliación lo reconoce (viejo anulado, nuevo cobrado).
    const conc = await conciliarPedido(x, ent.pedidoId);
    expect(conc.c.ok, conc.resumen).toBe(true);
    const errCorreo = await x
      .sql(
        `SELECT COUNT(*) AS n FROM errores_servidor WHERE ruta LIKE '%correo_cliente:${ent.pedidoId}%'`,
      )
      .catch(() => [{ n: -1 }]);
    console.warn(
      `AV-e pedido ${ent.pedidoId}: autorización vencida (${ent.pi}); Volver a cobrar con doble clic: ${JSON.stringify(vistos.map(([s]) => s))}; un solo cobro nuevo ${nuevo} por ${dinero(ent.total)}; liquidación capturada; ${conc.resumen}; errores del correo al cliente: ${String(errCorreo[0]?.n)} (en el sitio de pruebas el correo a cuentas @recorrido.test no sale a nadie: se omite a propósito)`,
    );
    pedidoId = null;
  } finally {
    if (e) await limpiar(x, e.equipo.token, pedidoId);
    await soltar(x, e);
  }
});
