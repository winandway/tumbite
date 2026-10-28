import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import {
  B,
  type M,
  empresa,
  envios,
  etiquetasDe,
  k,
  llamar,
  ruta,
  subir,
  vincular,
} from '../pruebas/flex';
import { reiniciarLimiteClaves } from '../flex/autorizacion';
import { TAREAS_RELOJ } from '../rutas/operacion';
import { saldoLibro } from '../internacional/libro';
import { cobrarComisionConductor, saldosConductor } from './conductor';
import { conciliarFinanzas } from './reloj';

/**
 * Divoox · Fase 4 de Flex: dinero (C-FIN-POLITICAS, C-FIN-BILLETERA, C-FIN-RECARGAS, C-FIN-RESERVAS,
 * C-FIN-COMISION, C-FIN-REEMBOLSOS, C-FIN-DISPUTAS, C-FIN-CONCILIACION, C-FIN-CONDUCTOR). SQLite en
 * memoria y Stripe SIMULADO (modo prueba). Ningún cobro real.
 */

const SECRETO = 'whsec_prueba';
const ENV = {
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_WEBHOOK_SECRET: SECRETO,
  STRIPE_PUBLISHABLE_KEY: 'pk_test_x',
};

type Intento = Record<string, unknown> & { id: string; status: string };
let intentos: Map<string, Intento>;
let llamadasStripe: { metodo: string; ruta: string; cuerpo: string }[];
let n = 0;

beforeEach(() => {
  reiniciarLimiteClaves();
  intentos = new Map();
  llamadasStripe = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const metodo = init?.method ?? 'GET';
    const cuerpo = String(init?.body ?? '');
    llamadasStripe.push({ metodo, ruta: u.pathname, cuerpo });
    const p = new URLSearchParams(cuerpo);
    if (u.pathname === '/v1/payment_intents' && metodo === 'POST') {
      // Stripe deduplica por la clave de idempotencia: la misma clave devuelve el mismo intento.
      const clave = (init?.headers as Record<string, string>)['idempotency-key'] ?? '';
      const ya = [...intentos.values()].find((x) => x._clave === clave);
      if (ya) return Response.json(ya);
      const id = `pi_${++n}`;
      const pi: Intento = {
        id,
        status: p.get('confirm') === 'true' ? 'processing' : 'requires_payment_method',
        client_secret: `${id}_secret`,
        amount: Number(p.get('amount')),
        currency: p.get('currency'),
        metadata: {
          tipo: p.get('metadata[tipo]'),
          recarga_empresa_id: p.get('metadata[recarga_empresa_id]'),
          empresa_id: p.get('metadata[empresa_id]'),
        },
        setup_future_usage: p.get('setup_future_usage'),
        _clave: clave,
      };
      intentos.set(id, pi);
      return Response.json(pi);
    }
    const piGet = /^\/v1\/payment_intents\/(pi_\d+)$/.exec(u.pathname);
    if (piGet && metodo === 'GET') return Response.json(intentos.get(piGet[1]!) ?? {});
    if (u.pathname === '/v1/refunds')
      return Response.json({ id: `re_${++n}`, status: 'succeeded' });
    if (u.pathname === '/v1/customers') return Response.json({ id: 'cus_1' });
    if (u.pathname.startsWith('/v1/payment_methods/'))
      return Response.json({ card: { brand: 'visa', last4: '4242' } });
    return Response.json({ id: 'x', status: 'succeeded' });
  });
});
afterEach(() => vi.unstubAllGlobals());

async function firmar(cuerpo: string) {
  const t = Math.floor(Date.now() / 1000);
  const llave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRETO),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const f = await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(`${t}.${cuerpo}`));
  return `t=${t},v1=${[...new Uint8Array(f)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}
async function aviso(
  m: M,
  tipo: string,
  obj: Record<string, unknown>,
  id = `evt_${++n}`,
  firmado = true,
) {
  const cuerpo = JSON.stringify({ id, type: tipo, data: { object: obj } });
  const res = await m.crudo('/datos/stripe/aviso', {
    method: 'POST',
    body: cuerpo,
    headers: { 'stripe-signature': firmado ? await firmar(cuerpo) : 't=1,v1=00' },
  });
  return res.status;
}

/** Empresa con recargas encendidas en EE. UU. y, si se pide, una política de 0,25 por paquete. */
async function escenario(opciones: { tarifa?: number | null } = {}) {
  const m = mundo(ENV);
  const admin = await m.cuenta('admin');
  const e = await empresa(m);
  const cfg = await llamar(
    m,
    'PUT',
    '/datos/admin/finanzas/recargas-config/US',
    {
      activas: true,
      minimo: 500,
      maximo: 100_000,
      sugeridos: [1000, 2000, 5000, 10000],
      automaticaPermitida: true,
    },
    admin.token,
  );
  expect(cfg.estado).toBe(200);
  if (opciones.tarifa !== null) {
    const p = await llamar(
      m,
      'POST',
      '/datos/admin/finanzas/politicas',
      {
        nombre: 'Flex EE. UU.',
        servicio: 'flex',
        tipoCuenta: 'empresa',
        pais: 'US',
        modalidad: 'prepago',
        moneda: 'USD',
        regla: { tipo: 'por_paquete', monto: opciones.tarifa ?? 25 },
        motivo: 'Tarifa de prueba',
      },
      admin.token,
    );
    expect(p.estado).toBe(201);
  }
  return { m, admin, e };
}

async function recargar(
  m: M,
  e: { id: string; dueno: { token: string } },
  monto: number,
  clave = k(),
) {
  const r = await llamar(
    m,
    'POST',
    `${B}/empresas/${e.id}/billetera/recargas`,
    { monto },
    e.dueno.token,
    {
      'idempotency-key': clave,
    },
  );
  expect(r.estado).toBe(201);
  const pi = intentos.get([...intentos.keys()].at(-1)!)!;
  return { recargaId: r.datos.recarga.id as string, pi, respuesta: r };
}
async function confirmarPago(m: M, pi: Intento, extra: Record<string, unknown> = {}) {
  pi.status = 'succeeded';
  return aviso(m, 'payment_intent.succeeded', {
    id: pi.id,
    amount_received: pi.amount,
    currency: pi.currency,
    metadata: pi.metadata,
    payment_method: 'pm_card_visa',
    setup_future_usage: pi.setup_future_usage,
    ...extra,
  });
}
const billetera = async (m: M, e: { id: string; dueno: { token: string } }) =>
  (await llamar(m, 'GET', `${B}/empresas/${e.id}/billetera`, undefined, e.dueno.token)).datos;

/** Una ruta lista para asignar, con su conductor propio. */
async function rutaLista(
  m: M,
  e: Awaited<ReturnType<typeof empresa>>,
  paquetes: number,
  prefijo = 'R',
) {
  const cond = await m.cuenta('repartidor');
  await vincular(m, e, cond.id, 'propio');
  const rutaId = await ruta(m, e, await envios(m, e, paquetes, 1, prefijo));
  return { cond, rutaId };
}
const asignar = (
  m: M,
  e: { id: string; dueno: { token: string } },
  rutaId: string,
  conductorId: string,
) =>
  llamar(
    m,
    'POST',
    `${B}/empresas/${e.id}/rutas/${rutaId}/asignar`,
    { conductorId },
    e.dueno.token,
  );

async function salir(m: M, rutaId: string, cond: { token: string }, faltantes = 0) {
  const C = `${B}/conductor/rutas/${rutaId}`;
  expect((await llamar(m, 'POST', `${C}/aceptar`, {}, cond.token)).estado).toBe(200);
  await llamar(m, 'POST', `${C}/llegada-centro`, { lat: 25.77, lng: -80.19 }, cond.token);
  const etiquetas = await etiquetasDe(m, rutaId);
  for (const [i, c] of etiquetas.entries()) {
    if (i < faltantes) {
      const paq = await m.DB.prepare('SELECT id FROM paquetes WHERE codigo_etiqueta = ?')
        .bind(c)
        .first<{ id: string }>();
      expect(
        (
          await llamar(
            m,
            'POST',
            `${C}/faltante`,
            { paqueteId: paq!.id, motivo: 'no estaba' },
            cond.token,
          )
        ).estado,
      ).toBe(200);
      continue;
    }
    await llamar(m, 'POST', `${C}/escanear`, { codigo: `dvx:${c}` }, cond.token);
  }
  expect(
    (await llamar(m, 'POST', `${C}/iniciar`, { lat: 25.77, lng: -80.19 }, cond.token)).estado,
  ).toBe(200);
  const det = await llamar(m, 'GET', C, undefined, cond.token);
  return { C, paradas: det.datos.ruta.paradas as any[] };
}
async function entregar(m: M, C: string, cond: { token: string }, paradaId: string, clave = k()) {
  const foto = (await subir(m, `${C}/paradas/${paradaId}/prueba`, cond.token)).datos.pruebaId;
  return llamar(m, 'POST', `${C}/paradas/${paradaId}/entregar`, { fotoId: foto }, cond.token, {
    'idempotency-key': clave,
  });
}

describe('C-FIN-RECARGAS · recargas con Stripe en modo prueba', () => {
  it('queda pendiente hasta el aviso FIRMADO y se acredita una sola vez (aviso repetido, otro evento, otra clave)', async () => {
    const { m, e } = await escenario();
    const clave = k();
    const r1 = await recargar(m, e, 5000, clave);
    expect(r1.respuesta.datos.clientSecret).toBe(`${r1.pi.id}_secret`);
    // Doble clic: la misma clave devuelve la misma recarga y el mismo intento.
    const r2 = await recargar(m, e, 5000, clave);
    expect(r2.recargaId).toBe(r1.recargaId);
    expect(
      (await m.DB.prepare('SELECT COUNT(*) AS n FROM recargas_empresa').first<{ n: number }>())!.n,
    ).toBe(1);
    expect((await billetera(m, e)).saldo.disponible).toBe(0);
    // Sin firma válida no se procesa nada.
    expect(
      await aviso(
        m,
        'payment_intent.succeeded',
        { id: r1.pi.id, amount_received: 5000, currency: 'usd', metadata: r1.pi.metadata },
        'evt_x',
        false,
      ),
    ).toBe(400);
    expect((await billetera(m, e)).saldo.disponible).toBe(0);
    const ev = `evt_${++n}`;
    expect(
      await aviso(
        m,
        'payment_intent.succeeded',
        { id: r1.pi.id, amount_received: 5000, currency: 'usd', metadata: r1.pi.metadata },
        ev,
      ),
    ).toBe(200);
    expect(
      await aviso(
        m,
        'payment_intent.succeeded',
        { id: r1.pi.id, amount_received: 5000, currency: 'usd', metadata: r1.pi.metadata },
        ev,
      ),
    ).toBe(200);
    expect(await confirmarPago(m, r1.pi)).toBe(200); // otro evento del mismo pago
    const b = await billetera(m, e);
    expect(b.saldo).toMatchObject({ disponible: 5000, reservado: 0, deuda: 0, total: 5000 });
    const comp = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/comprobantes`,
      undefined,
      e.dueno.token,
    );
    expect(comp.datos.comprobantes).toHaveLength(1);
    expect(comp.datos.comprobantes[0]).toMatchObject({ tipo: 'recarga', monto: 5000 });
    expect(comp.datos.comprobantes[0].numero).toMatch(/^DVX-\d{4}-000001$/);
  });

  it('no acredita si el monto, la moneda o la empresa no cuadran; el pago rechazado o cancelado no suma', async () => {
    const { m, e } = await escenario();
    const otra = await empresa(m, 'Otra');
    const r = await recargar(m, e, 2000);
    await aviso(m, 'payment_intent.succeeded', {
      id: r.pi.id,
      amount_received: 1999,
      currency: 'usd',
      metadata: r.pi.metadata,
    });
    await aviso(m, 'payment_intent.succeeded', {
      id: r.pi.id,
      amount_received: 2000,
      currency: 'eur',
      metadata: r.pi.metadata,
    });
    await aviso(m, 'payment_intent.succeeded', {
      id: r.pi.id,
      amount_received: 2000,
      currency: 'usd',
      metadata: { ...(r.pi.metadata as object), empresa_id: otra.id },
    });
    expect((await billetera(m, e)).saldo.disponible).toBe(0);
    expect((await billetera(m, otra)).saldo.disponible).toBe(0);
    await aviso(m, 'payment_intent.payment_failed', {
      id: r.pi.id,
      metadata: r.pi.metadata,
      last_payment_error: { message: 'Your card was declined.' },
    });
    let rec = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/billetera/recargas/${r.recargaId}`,
      undefined,
      e.dueno.token,
    );
    expect(rec.datos.recarga).toMatchObject({
      estado: 'pendiente',
      motivo: 'Your card was declined.',
    });
    await aviso(m, 'payment_intent.canceled', { id: r.pi.id, metadata: r.pi.metadata });
    rec = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/billetera/recargas/${r.recargaId}`,
      undefined,
      e.dueno.token,
    );
    expect(rec.datos.recarga.estado).toBe('cancelada');
    expect((await billetera(m, e)).saldo.disponible).toBe(0);
  });

  it('límites del país: apagadas o fuera del mínimo y el máximo, no se abre ningún cobro', async () => {
    const m = mundo(ENV);
    const e = await empresa(m);
    const r = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/billetera/recargas`,
      { monto: 5000 },
      e.dueno.token,
    );
    expect(r.estado).toBe(409);
    const { m: m2, e: e2 } = await escenario();
    expect(
      (
        await llamar(
          m2,
          'POST',
          `${B}/empresas/${e2.id}/billetera/recargas`,
          { monto: 100 },
          e2.dueno.token,
        )
      ).estado,
    ).toBe(409);
    expect(
      (
        await llamar(
          m2,
          'POST',
          `${B}/empresas/${e2.id}/billetera/recargas`,
          { monto: 200_000 },
          e2.dueno.token,
        )
      ).estado,
    ).toBe(409);
    expect(llamadasStripe.filter((x) => x.ruta === '/v1/payment_intents')).toHaveLength(0);
  });
});

describe('C-FIN-RESERVAS y C-FIN-COMISION · reservas y comisiones en las rutas', () => {
  it('el ejemplo comercial: recarga 50, 40 entregas a 0,25, se descuentan 10 y quedan 40', async () => {
    const { m, e } = await escenario({ tarifa: 25 });
    const r = await recargar(m, e, 5000);
    await confirmarPago(m, r.pi);
    const { cond, rutaId } = await rutaLista(m, e, 40);
    expect((await asignar(m, e, rutaId, cond.id)).estado).toBe(200);
    expect((await billetera(m, e)).saldo).toMatchObject({ disponible: 4000, reservado: 1000 });
    const { C, paradas } = await salir(m, rutaId, cond);
    for (const p of paradas) expect((await entregar(m, C, cond, p.id)).estado).toBe(200);
    expect((await billetera(m, e)).saldo).toMatchObject({ disponible: 4000, reservado: 0 });
    expect((await llamar(m, 'POST', `${C}/cerrar`, {}, cond.token)).estado).toBe(200);
    const b = await billetera(m, e);
    expect(b.saldo).toMatchObject({ disponible: 4000, reservado: 0, total: 4000 });
    expect(await saldoLibro(m.DB, 'tumbite', 'comisiones', 'US', 'USD')).toBe(1000);
    const com = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/billetera/comisiones`,
      undefined,
      e.dueno.token,
    );
    expect(com.datos).toMatchObject({ totalCobrado: 1000, paquetesFacturados: 40 });
    const comp = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/comprobantes?tipo=comisiones_ruta`,
      undefined,
      e.dueno.token,
    );
    expect(comp.datos.comprobantes[0]).toMatchObject({ monto: 1000, tipo: 'comisiones_ruta' });
  }, 60_000);

  it('entrega repetida, reintentos y la cola sin conexión no cobran dos veces; lo no entregado no se cobra', async () => {
    const { m, e } = await escenario({ tarifa: 25 });
    await confirmarPago(m, (await recargar(m, e, 2000)).pi);
    const { cond, rutaId } = await rutaLista(m, e, 3);
    await asignar(m, e, rutaId, cond.id);
    const { C, paradas } = await salir(m, rutaId, cond);
    const clave = k();
    for (let i = 0; i < 3; i++) await entregar(m, C, cond, paradas[0].id, clave);
    await entregar(m, C, cond, paradas[0].id); // otra clave: «ya entregado», sin cobro
    await llamar(
      m,
      'POST',
      `${C}/paradas/${paradas[1].id}/incidencia`,
      { motivo: 'ausente', proximaAccion: 'reintentar' },
      cond.token,
    );
    const paq = paradas[1].paquetes[0].id;
    await llamar(m, 'POST', `${C}/paquetes/${paq}/reintentar`, {}, cond.token);
    await entregar(m, C, cond, paradas[1].id);
    await llamar(
      m,
      'POST',
      `${C}/paradas/${paradas[2].id}/incidencia`,
      { motivo: 'ausente', proximaAccion: 'devolver' },
      cond.token,
    );
    const dev = await llamar(m, 'POST', `${C}/devolucion`, {}, cond.token);
    for (const d of dev.datos.devoluciones)
      await llamar(m, 'POST', `${C}/devolucion/entregar`, { codigo: d.codigoEtiqueta }, cond.token);
    expect((await llamar(m, 'POST', `${C}/cerrar`, {}, cond.token)).estado).toBe(200);
    expect((await llamar(m, 'POST', `${C}/cerrar`, {}, cond.token)).estado).toBe(200);
    // 2 entregados × 25 = 50; el devuelto no se cobra.
    expect(await saldoLibro(m.DB, 'tumbite', 'comisiones', 'US', 'USD')).toBe(50);
    expect((await billetera(m, e)).saldo).toMatchObject({ disponible: 1950, reservado: 0 });
  }, 60_000);

  it('saldo insuficiente: la ruta no sale y nada queda a medias', async () => {
    const { m, e } = await escenario({ tarifa: 25 });
    await confirmarPago(m, (await recargar(m, e, 500)).pi);
    const { cond, rutaId } = await rutaLista(m, e, 40);
    const r = await asignar(m, e, rutaId, cond.id);
    expect(r.estado).toBe(409);
    expect(r.datos.campo).toBe('billetera');
    expect(
      (await m.DB.prepare('SELECT estado FROM rutas_flex WHERE id = ?')
        .bind(rutaId)
        .first<{ estado: string }>())!.estado,
    ).toBe('borrador');
    expect((await billetera(m, e)).saldo).toMatchObject({ disponible: 500, reservado: 0 });
    expect(
      (await m.DB.prepare("SELECT COUNT(*) AS n FROM paquetes WHERE estado = 'asignado'").first<{
        n: number;
      }>())!.n,
    ).toBe(0);
  });

  it('dos rutas a la vez no pueden gastar el mismo saldo: solo una se reserva', async () => {
    const { m, e } = await escenario({ tarifa: 25 });
    await confirmarPago(m, (await recargar(m, e, 1000)).pi);
    const a = await rutaLista(m, e, 40, 'A');
    const b = await rutaLista(m, e, 40, 'B');
    const [x, y] = await Promise.all([
      asignar(m, e, a.rutaId, a.cond.id),
      asignar(m, e, b.rutaId, b.cond.id),
    ]);
    expect([x.estado, y.estado].sort()).toEqual([200, 409]);
    expect((await billetera(m, e)).saldo).toMatchObject({ disponible: 0, reservado: 1000 });
  });

  it('retirar, cancelar o dejar vencer la oferta devuelven lo apartado; un faltante en el centro también', async () => {
    const { m, e } = await escenario({ tarifa: 25 });
    await confirmarPago(m, (await recargar(m, e, 5000)).pi);
    const { cond, rutaId } = await rutaLista(m, e, 4);
    await asignar(m, e, rutaId, cond.id);
    expect((await billetera(m, e)).saldo.reservado).toBe(100);
    await llamar(m, 'POST', `${B}/empresas/${e.id}/rutas/${rutaId}/retirar`, {}, e.dueno.token);
    expect((await billetera(m, e)).saldo).toMatchObject({ disponible: 5000, reservado: 0 });
    await asignar(m, e, rutaId, cond.id);
    await llamar(m, 'POST', `${B}/empresas/${e.id}/rutas/${rutaId}/cancelar`, {}, e.dueno.token);
    expect((await billetera(m, e)).saldo).toMatchObject({ disponible: 5000, reservado: 0 });
    // Oferta que vence sola.
    const red = await m.cuenta('repartidor');
    await vincular(m, e, red.id, 'red');
    const r2 = await ruta(m, e, await envios(m, e, 2, 1, 'O'));
    await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${r2}/ofrecer`,
      { conductorId: red.id, minutos: 5 },
      e.dueno.token,
    );
    expect((await billetera(m, e)).saldo.reservado).toBe(50);
    await m.DB.prepare(
      "UPDATE rutas_flex SET oferta_vence_en = datetime('now', '-1 minutes') WHERE id = ?",
    )
      .bind(r2)
      .run();
    const tarea = TAREAS_RELOJ.find((t) => t.nombre === 'flex_ofertas')!;
    await tarea.correr({ DB: m.DB, ...m.extra } as never, m.DB);
    expect((await billetera(m, e)).saldo).toMatchObject({ disponible: 5000, reservado: 0 });
    // Faltante: al salir, lo apartado por el paquete que no estaba vuelve.
    const r3 = await rutaLista(m, e, 3, 'F');
    await asignar(m, e, r3.rutaId, r3.cond.id);
    expect((await billetera(m, e)).saldo.reservado).toBe(75);
    await salir(m, r3.rutaId, r3.cond, 1);
    expect((await billetera(m, e)).saldo).toMatchObject({ disponible: 4950, reservado: 50 });
  }, 60_000);

  it('la tarifa queda congelada: cambiar la política después no altera lo ya apartado ni lo cobrado', async () => {
    const { m, admin, e } = await escenario({ tarifa: 25 });
    await confirmarPago(m, (await recargar(m, e, 5000)).pi);
    const { cond, rutaId } = await rutaLista(m, e, 2);
    await asignar(m, e, rutaId, cond.id);
    const pol = (await llamar(m, 'GET', '/datos/admin/finanzas/politicas', undefined, admin.token))
      .datos.politicas[0];
    expect(
      (
        await llamar(
          m,
          'POST',
          `/datos/admin/finanzas/politicas/${pol.id}/cerrar`,
          { motivo: 'cambio de tarifa' },
          admin.token,
        )
      ).estado,
    ).toBe(200);
    await llamar(
      m,
      'POST',
      '/datos/admin/finanzas/politicas',
      {
        nombre: 'Nueva',
        servicio: 'flex',
        tipoCuenta: 'empresa',
        pais: 'US',
        modalidad: 'prepago',
        moneda: 'USD',
        regla: { tipo: 'por_paquete', monto: 99 },
        motivo: 'Tarifa nueva',
      },
      admin.token,
    );
    const { C, paradas } = await salir(m, rutaId, cond);
    for (const p of paradas) await entregar(m, C, cond, p.id);
    await llamar(m, 'POST', `${C}/cerrar`, {}, cond.token);
    expect(await saldoLibro(m.DB, 'tumbite', 'comisiones', 'US', 'USD')).toBe(50);
  }, 60_000);

  it('sin política no se aparta ni se cobra nada (Flex sigue funcionando gratis)', async () => {
    const { m, e } = await escenario({ tarifa: null });
    const { cond, rutaId } = await rutaLista(m, e, 2);
    expect((await asignar(m, e, rutaId, cond.id)).estado).toBe(200);
    expect(
      (await m.DB.prepare(
        "SELECT COUNT(*) AS n FROM libro WHERE cuenta_id LIKE 'empresa:%'",
      ).first<{ n: number }>())!.n,
    ).toBe(0);
  });
});

describe('C-FIN-REEMBOLSOS y C-FIN-DISPUTAS · reversiones sin saldos negativos', () => {
  it('reembolso desde el superadmin (con contraseña) y su aviso posterior no descuentan dos veces', async () => {
    const { m, admin, e } = await escenario();
    const r = await recargar(m, e, 5000);
    await confirmarPago(m, r.pi);
    const sinClave = await llamar(
      m,
      'POST',
      `/datos/admin/finanzas/recargas/${r.recargaId}/reembolsar`,
      { monto: 2000, motivo: 'pedido por la empresa', clave: 'mala' },
      admin.token,
    );
    expect(sinClave.estado).toBe(403);
    const ok = await llamar(
      m,
      'POST',
      `/datos/admin/finanzas/recargas/${r.recargaId}/reembolsar`,
      { monto: 2000, motivo: 'pedido por la empresa', clave: 'clave-segura-1' },
      admin.token,
    );
    expect(ok.estado).toBe(200);
    expect(llamadasStripe.filter((x) => x.ruta === '/v1/refunds')).toHaveLength(1);
    await aviso(m, 'charge.refunded', {
      id: 'ch_1',
      payment_intent: r.pi.id,
      amount_refunded: 2000,
    });
    await aviso(m, 'charge.refunded', {
      id: 'ch_1',
      payment_intent: r.pi.id,
      amount_refunded: 2000,
    });
    expect((await billetera(m, e)).saldo).toMatchObject({ disponible: 3000, deuda: 0 });
    // No se devuelve más de lo disponible.
    expect(
      (
        await llamar(
          m,
          'POST',
          `/datos/admin/finanzas/recargas/${r.recargaId}/reembolsar`,
          { monto: 3001, motivo: 'pedido por la empresa', clave: 'clave-segura-1' },
          admin.token,
        )
      ).estado,
    ).toBe(409);
  });

  it('un reembolso hecho en Stripe mayor que el disponible deja deuda, frena rutas nuevas y la próxima recarga la paga', async () => {
    const { m, e } = await escenario({ tarifa: 25 });
    const r = await recargar(m, e, 5000);
    await confirmarPago(m, r.pi);
    const { cond, rutaId } = await rutaLista(m, e, 40);
    await asignar(m, e, rutaId, cond.id); // 1000 apartados, 4000 disponibles
    await aviso(m, 'charge.refunded', {
      id: 'ch_2',
      payment_intent: r.pi.id,
      amount_refunded: 5000,
    });
    let b = await billetera(m, e);
    expect(b.saldo).toMatchObject({ disponible: 0, reservado: 1000, deuda: 1000 });
    expect(b.suspendida).toBe(true);
    const otra = await rutaLista(m, e, 1, 'S');
    const frenada = await asignar(m, e, otra.rutaId, otra.cond.id);
    expect(frenada.estado).toBe(409);
    expect(frenada.datos.campo).toBe('billetera');
    // La ruta que ya salió sigue: no se toca.
    expect(
      (await m.DB.prepare('SELECT estado FROM rutas_flex WHERE id = ?')
        .bind(rutaId)
        .first<{ estado: string }>())!.estado,
    ).toBe('asignada');
    // Cancelar la ruta: lo apartado paga primero la deuda.
    await llamar(m, 'POST', `${B}/empresas/${e.id}/rutas/${rutaId}/cancelar`, {}, e.dueno.token);
    b = await billetera(m, e);
    expect(b.saldo).toMatchObject({ disponible: 0, reservado: 0, deuda: 0 });
    // Con deuda y saldo a la vez (defensa extra), tampoco sale una ruta nueva.
    await m.DB.prepare(
      "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('d1', ?, 'deuda_cliente', 'US', 'USD', 100, 'prueba', 'deuda_prueba'), ('p1', ?, 'prepago', 'US', 'USD', 5000, 'prueba', 'prepago_prueba')",
    )
      .bind(`empresa:${e.id}`, `empresa:${e.id}`)
      .run();
    const conDeuda = await asignar(m, e, otra.rutaId, otra.cond.id);
    expect(conDeuda.estado).toBe(409);
    expect(conDeuda.datos.error).toMatch(/pendiente|outstanding|pending/i);
    await confirmarPago(m, (await recargar(m, e, 2000)).pi);
    b = await billetera(m, e);
    expect(b.saldo).toMatchObject({ disponible: 6900, deuda: 0 });
    expect(b.suspendida).toBe(false);
    expect(
      await saldoLibro(m.DB, `empresa:${e.id}`, 'prepago', 'US', 'USD'),
    ).toBeGreaterThanOrEqual(0);
  });

  it('disputa: retiene lo disputado; ganada lo libera; perdida lo quita y lo que faltaba queda como deuda', async () => {
    const { m, e } = await escenario();
    const r1 = await recargar(m, e, 3000);
    await confirmarPago(m, r1.pi);
    await aviso(m, 'charge.dispute.created', {
      id: 'dp_1',
      payment_intent: r1.pi.id,
      amount: 3000,
      status: 'needs_response',
      reason: 'fraudulent',
    });
    await aviso(m, 'charge.dispute.created', {
      id: 'dp_1',
      payment_intent: r1.pi.id,
      amount: 3000,
      status: 'needs_response',
      reason: 'fraudulent',
    });
    expect((await billetera(m, e)).saldo).toMatchObject({ disponible: 0, reservado: 3000 });
    await aviso(m, 'charge.dispute.closed', {
      id: 'dp_1',
      payment_intent: r1.pi.id,
      amount: 3000,
      status: 'won',
    });
    expect((await billetera(m, e)).saldo).toMatchObject({ disponible: 3000, reservado: 0 });
    // Perdida con parte ya gastada: 1000 retenidos de 3000 disputados → 2000 de deuda.
    await m.DB.prepare(
      "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('g1', ?, 'prepago', 'US', 'USD', -2000, 'gasto_prueba', 'gasto_prueba')",
    )
      .bind(`empresa:${e.id}`)
      .run();
    await aviso(m, 'charge.dispute.created', {
      id: 'dp_2',
      payment_intent: r1.pi.id,
      amount: 3000,
      status: 'needs_response',
    });
    expect((await billetera(m, e)).saldo).toMatchObject({ disponible: 0, reservado: 1000 });
    await aviso(m, 'charge.dispute.closed', {
      id: 'dp_2',
      payment_intent: r1.pi.id,
      amount: 3000,
      status: 'lost',
    });
    await aviso(m, 'charge.dispute.closed', {
      id: 'dp_2',
      payment_intent: r1.pi.id,
      amount: 3000,
      status: 'lost',
    });
    expect((await billetera(m, e)).saldo).toMatchObject({
      disponible: 0,
      reservado: 0,
      deuda: 2000,
    });
  });
});

describe('C-FIN-BILLETERA · separación, permisos, auditoría y libro inmutable', () => {
  it('una empresa no ve la billetera de otra; un operador no ve finanzas; una clave de API no recarga', async () => {
    const { m, e } = await escenario();
    const otra = await empresa(m, 'Otra');
    expect(
      (await llamar(m, 'GET', `${B}/empresas/${e.id}/billetera`, undefined, otra.dueno.token))
        .estado,
    ).toBe(404);
    const clave = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/claves`,
      { nombre: 'ERP', permisos: ['envios.ver'] },
      e.dueno.token,
    );
    expect(
      (
        await llamar(
          m,
          'POST',
          `${B}/empresas/${e.id}/billetera/recargas`,
          { monto: 1000 },
          undefined,
          { 'x-api-key': clave.datos.clave.secreto },
        )
      ).estado,
    ).toBe(403);
  });

  it('ajuste manual: solo admin, con su contraseña y motivo; nunca deja negativo; queda auditado e inmutable', async () => {
    const { m, admin, e } = await escenario();
    const cli = await m.cuenta('cliente');
    expect(
      (
        await llamar(
          m,
          'POST',
          `/datos/admin/finanzas/empresas/${e.id}/ajuste`,
          { monto: 1000, motivo: 'compensación acordada', clave: 'clave-segura-1' },
          cli.token,
        )
      ).estado,
    ).toBe(403);
    expect(
      (
        await llamar(
          m,
          'POST',
          `/datos/admin/finanzas/empresas/${e.id}/ajuste`,
          { monto: 1000, motivo: 'corto', clave: 'clave-segura-1' },
          admin.token,
        )
      ).estado,
    ).toBe(400);
    const ok = await llamar(
      m,
      'POST',
      `/datos/admin/finanzas/empresas/${e.id}/ajuste`,
      { monto: 1000, motivo: 'compensación acordada', clave: 'clave-segura-1' },
      admin.token,
    );
    expect(ok.estado).toBe(200);
    expect(ok.datos.saldo.disponible).toBe(1000);
    expect(
      (
        await llamar(
          m,
          'POST',
          `/datos/admin/finanzas/empresas/${e.id}/ajuste`,
          { monto: -1001, motivo: 'corrección de un error', clave: 'clave-segura-1' },
          admin.token,
        )
      ).estado,
    ).toBe(409);
    const aud = await m.DB.prepare(
      "SELECT actor_id FROM finanzas_auditoria WHERE accion = 'billetera.ajuste_manual'",
    ).all();
    expect(aud.results).toEqual([{ actor_id: admin.id }]);
    await expect(
      m.DB.prepare('UPDATE finanzas_auditoria SET accion = ?').bind('x').run(),
    ).rejects.toThrow(/auditoria_inmutable/);
    await expect(m.DB.prepare('UPDATE libro SET monto = 999999').run()).rejects.toThrow(
      /libro_inmutable/,
    );
    await expect(m.DB.prepare('DELETE FROM libro').run()).rejects.toThrow(/libro_inmutable/);
    await expect(m.DB.prepare('DELETE FROM comprobantes').run()).rejects.toThrow(
      /comprobante_inmutable/,
    );
  });

  it('las políticas no se editan ni se cierran hacia atrás, y una nueva no empieza en el pasado', async () => {
    const { m, admin } = await escenario();
    const pol = (await llamar(m, 'GET', '/datos/admin/finanzas/politicas', undefined, admin.token))
      .datos.politicas[0];
    await expect(
      m.DB.prepare("UPDATE politicas_financieras SET regla_json = '{}' WHERE id = ?")
        .bind(pol.id)
        .run(),
    ).rejects.toThrow(/politica_inmutable/);
    expect(
      (
        await llamar(
          m,
          'POST',
          `/datos/admin/finanzas/politicas/${pol.id}/cerrar`,
          { desde: '2020-01-01', motivo: 'hacia atrás' },
          admin.token,
        )
      ).estado,
    ).toBe(409);
    const vieja = await llamar(
      m,
      'POST',
      '/datos/admin/finanzas/politicas',
      {
        nombre: 'Vieja',
        servicio: 'flex',
        tipoCuenta: 'empresa',
        pais: 'US',
        modalidad: 'prepago',
        moneda: 'USD',
        regla: { tipo: 'por_paquete', monto: 1 },
        vigenteDesde: '2020-01-01',
        motivo: 'retroactiva',
      },
      admin.token,
    );
    expect(vieja.estado).toBe(409);
  });
});

describe('C-FIN-CONCILIACION · conciliación y recuperación', () => {
  it('recupera una recarga cuyo aviso se perdió (le pregunta a Stripe) y detecta descuadres', async () => {
    const { m, e } = await escenario();
    const r = await recargar(m, e, 2000);
    r.pi.status = 'succeeded';
    r.pi.amount_received = 2000;
    await m.DB.prepare(
      "UPDATE recargas_empresa SET creado_en = datetime('now', '-20 minutes') WHERE id = ?",
    )
      .bind(r.recargaId)
      .run();
    const env = { DB: m.DB, ...m.extra, ...ENV } as never;
    const res = await conciliarFinanzas(env, m.DB);
    expect(res).toMatchObject({ ok: true, recargasRecuperadas: 1 });
    expect((await billetera(m, e)).saldo.disponible).toBe(2000);
    // Un movimiento de recarga sin su recarga: la conciliación lo ve y la salud se pone en rojo.
    await m.DB.prepare(
      "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('x1', ?, 'prepago', 'US', 'USD', 100, 'recarga_empresa', 'recarga_empresa:falsa:prepago')",
    )
      .bind(`empresa:${e.id}`)
      .run();
    const mal = await conciliarFinanzas(env, m.DB);
    expect(mal.ok).toBe(false);
    expect(mal.problemas.map((p) => p.tipo)).toContain('movimiento_sin_recarga');
    const salud = await m.crudo('/datos/salud', { method: 'GET' });
    expect(((await salud.json()) as any).piezas.billeteras).toBe('error');
  });

  it('las tareas de dinero van en el reloj existente', () => {
    const nombres = TAREAS_RELOJ.map((t) => t.nombre);
    expect(nombres).toEqual(
      expect.arrayContaining(['fin_conciliacion', 'fin_recarga_automatica', 'fin_alertas_saldo']),
    );
  });

  it('recarga automática: solo con la opción encendida, tarjeta guardada y saldo bajo el umbral; una por hora', async () => {
    const { m, e } = await escenario();
    const r = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/billetera/recargas`,
      { monto: 1000, guardarMetodo: true },
      e.dueno.token,
    );
    const pi = intentos.get([...intentos.keys()].at(-1)!)!;
    expect(pi.setup_future_usage).toBe('off_session');
    await confirmarPago(m, pi);
    expect((await billetera(m, e)).config.metodoGuardado).toBe('visa •••• 4242');
    expect(r.estado).toBe(201);
    const cfg = await llamar(
      m,
      'PUT',
      `${B}/empresas/${e.id}/billetera/config`,
      {
        alertaSaldo: 500,
        avisosCorreo: false,
        recargaAutomatica: { activa: true, umbral: 2000, monto: 5000 },
      },
      e.dueno.token,
    );
    expect(cfg.estado).toBe(200);
    const tarea = TAREAS_RELOJ.find((t) => t.nombre === 'fin_recarga_automatica')!;
    const env = { DB: m.DB, ...m.extra, ...ENV } as never;
    expect(await tarea.correr(env, m.DB)).toMatchObject({ creadas: 1 });
    expect(await tarea.correr(env, m.DB)).toMatchObject({ creadas: 0 });
    const auto = intentos.get([...intentos.keys()].at(-1)!)!;
    expect(llamadasStripe.at(-1)?.cuerpo).toContain('off_session=true');
    await confirmarPago(m, auto);
    expect((await billetera(m, e)).saldo.disponible).toBe(6000);
  });
});

describe('C-FIN-CONDUCTOR · prepago de conductores, por mercado', () => {
  it('sin revisión legal no cobra; con ella cobra el 10 % de 8,00 una sola vez y nunca toca lo retirable', async () => {
    const { m, admin } = await escenario({ tarifa: null });
    const cond = await m.cuenta('repartidor');
    await m.DB.prepare(
      "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('r1', ?, 'prepago', 'US', 'USD', 1000, 'recarga_stripe', 'recarga:prueba')",
    )
      .bind(cond.id)
      .run();
    const pol = await llamar(
      m,
      'POST',
      '/datos/admin/finanzas/politicas',
      {
        nombre: 'Express conductores',
        servicio: 'express',
        tipoCuenta: 'conductor',
        pais: 'US',
        modalidad: 'prepago',
        moneda: 'USD',
        regla: { tipo: 'porcentaje', pb: 1000 },
        motivo: 'Mercado de prueba',
      },
      admin.token,
    );
    const ctx = {
      servicio: 'express' as const,
      pais: 'US',
      moneda: 'USD',
      conductorId: cond.id,
      valor: 800,
    };
    expect(await cobrarComisionConductor(m.DB, { ...ctx, operacionRef: 'op1' })).toMatchObject({
      cobrado: false,
      motivo: 'sin_politica',
    });
    await llamar(
      m,
      'POST',
      `/datos/admin/finanzas/politicas/${pol.datos.politica.id}/revision-legal`,
      { aprobada: true, nota: 'Revisión legal y comercial del mercado de prueba' },
      admin.token,
    );
    expect(await cobrarComisionConductor(m.DB, { ...ctx, operacionRef: 'op1' })).toMatchObject({
      cobrado: true,
      monto: 80,
    });
    expect(await cobrarComisionConductor(m.DB, { ...ctx, operacionRef: 'op1' })).toMatchObject({
      motivo: 'ya_cobrada',
    });
    const s = await saldosConductor(m.DB, cond.id, 'US', 'USD');
    expect(s).toMatchObject({ prepago: 920, gananciasDisponibles: 0 });
    // Sin saldo suficiente no se cobra (nunca negativo).
    expect(
      await cobrarComisionConductor(m.DB, { ...ctx, operacionRef: 'op2', valor: 100_000 }),
    ).toMatchObject({ cobrado: false, motivo: 'saldo_insuficiente' });
    expect((await saldosConductor(m.DB, cond.id, 'US', 'USD')).prepago).toBe(920);
  });
});
