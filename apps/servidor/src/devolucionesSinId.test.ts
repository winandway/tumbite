import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, llevarA, mundo } from './pruebas/ayuda';

/**
 * LAN-1 · C-DEVOLUCION-SIN-ID: la devolución después de entregar (superadmin, control dual y queja
 * guiada) cuando Stripe responde SIN id, con error o la respuesta se pierde. Nunca queda una fila en
 * `devoluciones` ni un movimiento al restaurante o al repartidor sin su reembolso confirmado, y el
 * reintento con la misma clave da UN solo reembolso en Stripe. SQLite en memoria y Stripe SIMULADO
 * con su regla de idempotencia (la misma clave con otros datos es un error 400, como el real).
 */
type Modo = 'ok' | 'sinId' | 'error' | 'perdida' | 'rechazo';
type Reembolso = {
  id: string;
  amount: number;
  status: string;
  cuerpo: string;
  metadata: Record<string, string>;
};
let modo: Modo = 'ok';
let reembolsos: Map<string, Reembolso>;
let totalCobrado = 0;
const SECRETO_RELOJ = `prueba-${crypto.randomUUID()}`;

beforeEach(() => {
  modo = 'ok';
  reembolsos = new Map();
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const metodo = init?.method ?? 'GET';
    if (u.pathname === '/v1/refunds' && metodo === 'POST') {
      if (modo === 'error')
        return Response.json({ error: { message: 'api_error' } }, { status: 500 });
      if (modo === 'rechazo')
        return Response.json({ error: { message: 'charge_already_refunded' } }, { status: 400 });
      const clave = new Headers(init?.headers).get('idempotency-key') ?? '';
      const cuerpo = String(init?.body ?? '');
      let r = reembolsos.get(clave);
      if (r && r.cuerpo !== cuerpo)
        return Response.json(
          {
            error: {
              message: 'Keys for idempotent requests can only be used with the same parameters',
            },
          },
          { status: 400 },
        );
      if (!r) {
        const p = new URLSearchParams(cuerpo);
        const metadata: Record<string, string> = {};
        for (const [k, v] of p) {
          const m = /^metadata\[(.+)\]$/.exec(k);
          if (m) metadata[m[1]!] = v;
        }
        r = {
          id: `re_${reembolsos.size + 1}`,
          amount: Number(p.get('amount')),
          status: 'succeeded',
          cuerpo,
          metadata,
        };
        reembolsos.set(clave, r);
      }
      if (modo === 'sinId') return Response.json({ object: 'refund' });
      if (modo === 'perdida') throw new TypeError('fetch failed');
      return Response.json({ id: r.id, amount: r.amount, status: r.status, metadata: r.metadata });
    }
    if (u.pathname === '/v1/refunds')
      return Response.json({
        data: [...reembolsos.values()].map((x) => ({
          id: x.id,
          amount: x.amount,
          status: x.status,
          metadata: x.metadata,
        })),
      });
    if (/^\/v1\/payment_intents\/pi_1$/.test(u.pathname))
      return Response.json({ id: 'pi_1', status: 'succeeded', amount_received: totalCobrado });
    if (u.pathname === '/v1/transfers') return Response.json({ data: [] });
    return Response.json({ id: 'pi_sesion', client_secret: 'x', status: 'succeeded' });
  });
});
afterEach(() => vi.unstubAllGlobals());

async function escenario() {
  const m = mundo(
    { STRIPE_SECRET_KEY: 'sk_test_x', YAD_TOKEN: 'x'.repeat(40), RELOJ_SECRETO: SECRETO_RELOJ },
    { host: 'staging.tumbite.com' },
  );
  const dueno = await m.cuenta('restaurante');
  const repartidor = await m.cuenta('repartidor');
  const admin = await m.cuenta('admin', 'Soporte Pide');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
  const cubano = await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Cubano', precioCentavos: 1500 },
    dueno.token,
  );
  const jugo = await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Jugo', precioCentavos: 500 },
    dueno.token,
  );
  await m.abrir(dueno.token);
  const p = await m.llamar(
    'POST',
    '/datos/pedidos',
    {
      restauranteId: rid,
      lineas: [
        { platoId: cubano.datos.plato.id, cantidad: 10 },
        { platoId: jugo.datos.plato.id, cantidad: 2 },
      ],
      propinaCentavos: 0,
      direccion: '300 Calle Prueba',
      lat: 25.775,
      lng: -80.195,
    },
    cliente.token,
  );
  const id = p.datos.pedidoId as string;
  totalCobrado = p.datos.desglose.totalCliente as number;
  await m.DB.prepare(
    "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1', stripe_sesion = 'pi_1', repartidor_id = ? WHERE id = ?",
  )
    .bind(repartidor.id, id)
    .run();
  await m.DB.prepare(
    "INSERT OR REPLACE INTO cobros (pedido_id, capturado_en, capturado) VALUES (?, datetime('now'), ?)",
  )
    .bind(id, totalCobrado)
    .run();
  await llevarA(m.DB, id, 'entregado');
  const filas = async () =>
    (await m.DB.prepare('SELECT COUNT(*) AS n FROM devoluciones WHERE pedido_id = ?')
      .bind(id)
      .first<{ n: number }>())!.n;
  const cargos = async () =>
    (await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM movimientos WHERE concepto = 'ajuste' AND referencia LIKE ?",
    )
      .bind(`devolucion:${id}:%`)
      .first<{ n: number }>())!.n;
  /** La conciliación del sitio de pruebas: cada reembolso de Stripe explicado por su fila exacta. */
  const conciliacion = async () => {
    const c = await m.llamar(
      'POST',
      '/datos/interno/diagnostico/conciliacion',
      { pedidos: [id] },
      undefined,
      { 'x-reloj-secreto': SECRETO_RELOJ },
    );
    expect(c.estado).toBe(200);
    return (c.datos.casos as { nombre: string; ok: boolean; detalle?: string }[]).find((x) =>
      x.nombre.startsWith('cada cobro de hoy'),
    )!;
  };
  return {
    m,
    admin,
    cliente,
    dueno,
    repartidor,
    id,
    jugoId: jugo.datos.plato.id as string,
    filas,
    cargos,
    conciliacion,
  };
}

const devolver = (e: Awaited<ReturnType<typeof escenario>>, monto: number, idioma = 'es') =>
  e.m.llamar(
    'POST',
    `/datos/admin/pedidos/${e.id}/devolver`,
    { montoCentavos: monto, motivo: 'Llegó frío', cargarA: 'restaurante' },
    e.admin.token,
    { 'x-idioma': idioma },
  );

describe('LAN-1 · devolución con Stripe sin id, con error o sin respuesta (C-DEVOLUCION-SIN-ID)', () => {
  it('superadmin: Stripe sin id → 503 en palabras es/en, sin fila ni cargo; el reintento da un solo reembolso', async () => {
    const e = await escenario();
    modo = 'sinId';
    const es = await devolver(e, 700);
    expect(es.estado).toBe(503);
    expect(es.datos.error).toMatch(/Stripe no confirmó la devolución/);
    const en = await devolver(e, 700, 'en');
    expect(en.estado).toBe(503);
    expect(en.datos.error).toMatch(/Stripe didn’t confirm the refund/);
    expect(await e.filas()).toBe(0);
    expect(await e.cargos()).toBe(0);
    // Mientras no se reintenta, la conciliación lo muestra: Stripe tiene un reembolso sin explicar.
    expect((await e.conciliacion()).ok).toBe(false);
    modo = 'ok';
    const ok = await devolver(e, 700);
    expect(ok.estado).toBe(200);
    expect(reembolsos.size).toBe(1);
    expect(await e.filas()).toBe(1);
    expect(await e.cargos()).toBe(1);
    const c = await e.conciliacion();
    expect(c.ok, c.detalle).toBe(true);
  });

  it('superadmin: Stripe con error → 503 en palabras, nada escrito; respuesta perdida → igual, y el reintento no devuelve dos veces', async () => {
    const e = await escenario();
    modo = 'error';
    const r1 = await devolver(e, 600);
    expect(r1.estado).toBe(503);
    expect(r1.datos.error).toMatch(/Stripe no confirmó la devolución/);
    expect(reembolsos.size).toBe(0);
    modo = 'rechazo';
    const r0 = await devolver(e, 600, 'en');
    expect(r0.estado).toBe(409);
    expect(r0.datos.error).toBe(
      'Stripe didn’t accept the refund. Check the amount and the charge in Stripe.',
    );
    modo = 'perdida';
    const r2 = await devolver(e, 600);
    expect(r2.estado).toBe(503);
    expect(r2.datos.error).toMatch(/Stripe no confirmó la devolución/);
    expect(reembolsos.size).toBe(1); // Stripe sí lo hizo, la respuesta no llegó.
    expect(await e.filas()).toBe(0);
    expect(await e.cargos()).toBe(0);
    modo = 'ok';
    expect((await devolver(e, 600)).estado).toBe(200);
    expect(reembolsos.size).toBe(1);
    expect(await e.filas()).toBe(1);
    expect((await e.conciliacion()).ok).toBe(true);
  });

  it('control dual: la aprobación con Stripe sin id queda «fallida» sin fila ni cargo; la nueva solicitud da un solo reembolso', async () => {
    const e = await escenario();
    const jefa = await e.m.cuenta('admin', 'Soporte Finanzas');
    const pedir = () =>
      e.m.llamar(
        'POST',
        `/datos/admin/pedidos/${e.id}/devolver`,
        { montoCentavos: 12_000, motivo: 'Pedido completo mal', cargarA: 'repartidor' },
        e.admin.token,
      );
    const aprobar = (aid: string) =>
      e.m.llamar(
        'POST',
        `/datos/admin/aprobaciones-dinero/${aid}/aprobar`,
        { clave: 'clave-segura-1' },
        jefa.token,
      );
    const s1 = await pedir();
    expect(s1.estado).toBe(202);
    modo = 'sinId';
    const a1 = await aprobar(s1.datos.aprobacion.id);
    expect(a1.estado).toBe(503);
    const f = await e.m.DB.prepare('SELECT estado, error FROM aprobaciones_dinero WHERE id = ?')
      .bind(s1.datos.aprobacion.id)
      .first<{ estado: string; error: string }>();
    expect(f).toMatchObject({ estado: 'fallida' });
    expect(f!.error).toMatch(/Stripe no confirmó/);
    expect(await e.filas()).toBe(0);
    expect(await e.cargos()).toBe(0);
    modo = 'ok';
    const s2 = await pedir();
    expect(s2.estado).toBe(202);
    expect((await aprobar(s2.datos.aprobacion.id)).estado).toBe(200);
    expect(reembolsos.size).toBe(1);
    expect(await e.filas()).toBe(1);
    expect(await e.cargos()).toBe(1);
    expect((await e.conciliacion()).ok).toBe(true);
  });

  it('queja guiada: con Stripe sin id el ticket se abre sin decir que se devolvió y sin fila', async () => {
    const e = await escenario();
    await e.m.llamar(
      'PUT',
      '/datos/admin/quejas-config',
      { reembolsoAuto: true, topeCentavos: 1500 },
      e.admin.token,
    );
    modo = 'sinId';
    const q = await e.m.llamar(
      'POST',
      '/datos/quejas',
      {
        pedidoId: e.id,
        texto: 'Faltaron los dos jugos',
        motivo: 'articulo_faltante',
        platoIds: [e.jugoId],
      },
      e.cliente.token,
    );
    expect(q.estado).toBe(201);
    expect(q.datos.reembolso).toBe(0);
    expect(await e.filas()).toBe(0);
    // Soporte reintenta desde el superadmin con el mismo monto: un solo reembolso en Stripe.
    modo = 'ok';
    const r = await e.m.llamar(
      'POST',
      `/datos/admin/pedidos/${e.id}/devolver`,
      { montoCentavos: 1000, motivo: 'queja: jugos', cargarA: 'tumbite' },
      e.admin.token,
    );
    expect(r.estado).toBe(200);
    expect(reembolsos.size).toBe(1);
    expect(await e.filas()).toBe(1);
    expect((await e.conciliacion()).ok).toBe(true);
  });
  it('las guardas de antes de Stripe no llaman a Stripe: sin repartidor o una config dañada', async () => {
    const e = await escenario();
    await e.m.DB.prepare('UPDATE pedidos SET repartidor_id = NULL WHERE id = ?').bind(e.id).run();
    const r = await e.m.llamar(
      'POST',
      `/datos/admin/pedidos/${e.id}/devolver`,
      { montoCentavos: 300, motivo: 'Llegó frío', cargarA: 'repartidor' },
      e.admin.token,
    );
    expect(r.estado).toBe(409);
    expect(r.datos.campo).toBe('cargarA');
    expect(reembolsos.size).toBe(0);
    await e.m.DB.prepare(
      "INSERT OR REPLACE INTO config (clave, valor) VALUES ('quejas', 'no es json')",
    ).run();
    const { leerConfigQuejas, CONFIG_QUEJAS_INICIAL } = await import('./devoluciones');
    expect(await leerConfigQuejas(e.m.DB)).toEqual(CONFIG_QUEJAS_INICIAL);
  });
});
