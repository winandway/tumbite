import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from './app';
import { crearBasePruebas } from './pruebas/d1';
import { asegurarEsquema } from './esquema';

/**
 * C-AUTORIZACION-VENCIDA: la ruta de diagnóstico que simula, en el SITIO DE PRUEBAS, que la
 * autorización de la tarjeta venció (anula el PaymentIntent en Stripe modo prueba). Aquí con un
 * Stripe simulado; la de verdad la usa `e2e/recorrido/autorizacionVencidaStaging.spec.ts`.
 * Barreras: el secreto del reloj, el dominio de pruebas y las llaves sk_test_.
 */
const SECRETO = `prueba-${crypto.randomUUID()}`;

function stripeFalso(estado = 'requires_capture') {
  const llamadas: { metodo: string; ruta: string; cuerpo: string }[] = [];
  const pi = { id: 'pi_diag1', status: estado, cancellation_reason: null as string | null };
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const ruta = new URL(String(url)).pathname;
    const metodo = String(init?.method ?? 'GET');
    llamadas.push({ metodo, ruta, cuerpo: String(init?.body ?? '') });
    if (ruta === '/v1/payment_intents/pi_diag1' && metodo === 'GET')
      return new Response(JSON.stringify(pi));
    if (ruta === '/v1/payment_intents/pi_diag1/cancel' && metodo === 'POST') {
      pi.status = 'canceled';
      pi.cancellation_reason = new URLSearchParams(String(init?.body ?? '')).get(
        'cancellation_reason',
      );
      return new Response(JSON.stringify(pi));
    }
    return new Response(JSON.stringify({ error: { message: 'no' } }), { status: 404 });
  });
  return { llamadas, pi };
}

async function base(capturado = false) {
  const DB = crearBasePruebas();
  await asegurarEsquema(DB);
  // Solo importan el pedido y su cobro: sin cliente ni comercio de verdad.
  await DB.prepare('PRAGMA foreign_keys = OFF').run();
  await DB.batch([
    DB.prepare(
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, stripe_pago, stripe_sesion, pagado_en)
       VALUES ('zz-diag1', 'u1', 'r1', 'en_camino', '[]', 2000, 0, 0, 0, 0, 2000, 0, 0, 0, 0, 0, 'inicial', 'x', 'pi_diag1', 'pi_diag1', datetime('now'))`,
    ),
    DB.prepare(
      `INSERT INTO cobros (pedido_id, autorizado_en, capturado_en) VALUES ('zz-diag1', datetime('now'), ${capturado ? "datetime('now')" : 'NULL'})`,
    ),
  ]);
  return DB;
}

async function pedir(host: string, llave: string, DB: D1Database, secreto = SECRETO) {
  return app.request(
    `https://${host}/datos/interno/diagnostico/vencer-autorizacion`,
    {
      method: 'POST',
      headers: { 'x-reloj-secreto': secreto, 'content-type': 'application/json' },
      body: JSON.stringify({ pedidoId: 'zz-diag1' }),
    },
    { DB, STRIPE_SECRET_KEY: llave, RELOJ_SECRETO: SECRETO, SITIO_URL: `https://${host}` },
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('diagnóstico · vencer la autorización de un pedido (solo sitio de pruebas, Stripe de prueba)', () => {
  it('en pruebas con sk_test_: anula el PaymentIntent autorizado en Stripe', async () => {
    const st = stripeFalso();
    const r = await pedir('staging.tumbite.com', 'sk_test_x', await base());
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await r.json()).toEqual({ pago: 'pi_diag1', estado: 'canceled', motivo: 'abandoned' });
    expect(st.llamadas.filter((l) => l.metodo === 'POST').map((l) => l.ruta)).toEqual([
      '/v1/payment_intents/pi_diag1/cancel',
    ]);
  });

  it('con llaves reales (sk_live_) se niega sin tocar Stripe', async () => {
    const st = stripeFalso();
    const r = await pedir('staging.tumbite.com', 'sk_live_x', await base());
    expect(r.status).toBe(409);
    expect(st.llamadas).toEqual([]);
  });

  it('en el dominio de producción no existe (404) y no toca Stripe', async () => {
    for (const host of ['tumbite.com', 'divoox.com']) {
      const st = stripeFalso();
      const r = await pedir(host, 'sk_test_x', await base());
      expect(r.status, host).toBe(404);
      expect(st.llamadas).toEqual([]);
    }
  });

  it('sin el secreto del reloj no existe (404)', async () => {
    const st = stripeFalso();
    const r = await pedir('staging.tumbite.com', 'sk_test_x', await base(), 'otro-secreto-xx');
    expect(r.status).toBe(404);
    expect(st.llamadas).toEqual([]);
  });

  it('un pago ya capturado o que no está autorizado no se anula (409)', async () => {
    let st = stripeFalso();
    expect((await pedir('staging.tumbite.com', 'sk_test_x', await base(true))).status).toBe(409);
    expect(st.llamadas).toEqual([]);
    vi.unstubAllGlobals();
    st = stripeFalso('succeeded');
    expect((await pedir('staging.tumbite.com', 'sk_test_x', await base())).status).toBe(409);
    expect(st.llamadas.filter((l) => l.metodo === 'POST')).toEqual([]);
  });
});
