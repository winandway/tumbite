import { describe, expect, it, vi } from 'vitest';
import { app } from './app';
import { crearBasePruebas } from './pruebas/d1';
import { asegurarEsquema } from './esquema';

/**
 * L1 (C-COBRO-AL-ENTREGAR) en la computadora, contra un Stripe simulado con varios pagos que se
 * porta como el real: una sola captura por pago, respuestas guardadas por clave, cancelar.
 * Comprueba que la prueba del sitio de pruebas funciona y que sus dos barreras la frenan.
 * La de verdad corre en staging, contra Stripe en modo prueba.
 */
function stripeVarios() {
  const pis = new Map<
    string,
    { id: string; status: string; amount: number; amount_received: number }
  >();
  const guardadas = new Map<string, { status: number; body: string }>();
  let n = 0;
  const resp = (status: number, cuerpo: unknown) =>
    new Response(JSON.stringify(cuerpo), { status });
  const fetchFalso = async (url: string, init?: RequestInit) => {
    const u = new URL(String(url));
    const metodo = String(init?.method ?? 'GET');
    const clave = (init?.headers as Record<string, string> | undefined)?.['idempotency-key'] ?? '';
    if (metodo === 'POST' && clave && guardadas.has(clave)) {
      const g = guardadas.get(clave)!;
      return new Response(g.body, { status: g.status });
    }
    const guardar = (r: Response) => {
      if (metodo === 'POST' && clave)
        void r
          .clone()
          .text()
          .then((b) => guardadas.set(clave, { status: r.status, body: b }));
      return r;
    };
    const body = new URLSearchParams(String(init?.body ?? ''));
    // /v1/payment_intents[/<id>[/capture|/cancel]], sin expresiones regulares ambiguas.
    const partes = u.pathname.split('/').filter(Boolean);
    if (partes[0] !== 'v1' || partes[1] !== 'payment_intents') return resp(200, { id: 'x' });
    const id = partes[2];
    const accion = partes[3];
    if (!id && metodo === 'POST') {
      const pi = {
        id: `pi_${++n}`,
        status: 'requires_capture',
        amount: Number(body.get('amount')),
        amount_received: 0,
      };
      pis.set(pi.id, pi);
      return guardar(resp(200, pi));
    }
    const pi = pis.get(id!);
    if (!pi) return resp(404, { error: { message: 'No such payment_intent' } });
    if (metodo === 'GET') return resp(200, pi);
    if (accion === 'capture') {
      if (pi.status !== 'requires_capture')
        return guardar(resp(400, { error: { message: `status ${pi.status}` } }));
      const monto = Number(body.get('amount_to_capture') ?? pi.amount);
      if (monto > pi.amount)
        return guardar(
          resp(400, { error: { message: 'amount_to_capture greater than amount_capturable' } }),
        );
      pi.status = 'succeeded';
      pi.amount_received = Number(body.get('amount_to_capture') ?? pi.amount);
      return guardar(resp(200, pi));
    }
    if (accion === 'cancel') {
      if (pi.status !== 'requires_capture')
        return guardar(resp(400, { error: { message: `status ${pi.status}` } }));
      pi.status = 'canceled';
      return guardar(resp(200, pi));
    }
    return resp(400, { error: { message: 'no soportado' } });
  };
  return { fetchFalso, pis };
}

const SECRETO_RELOJ = `prueba-${crypto.randomUUID()}`;

async function correr(host: string, llave: string) {
  const st = stripeVarios();
  vi.stubGlobal('fetch', st.fetchFalso);
  const DB = crearBasePruebas();
  await asegurarEsquema(DB);
  const res = await app.request(
    `https://${host}/datos/interno/diagnostico/l1`,
    { method: 'POST', headers: { 'x-reloj-secreto': SECRETO_RELOJ } },
    {
      DB,
      STRIPE_SECRET_KEY: llave,
      RELOJ_SECRETO: SECRETO_RELOJ,
      SITIO_URL: `https://${host}`,
    },
  );
  const datos = (await res.json()) as {
    ok: boolean;
    omitido?: string;
    casos?: { nombre: string; ok: boolean; detalle?: string }[];
  };
  return { datos, DB, st };
}

describe('L1 · cobro al entregar contra Stripe (simulado aquí, real en staging)', () => {
  it('en el sitio de pruebas con llaves de prueba: todos los casos en verde y no deja nada', async () => {
    const { datos, DB, st } = await correr('staging.tumbite.com', 'sk_test_x');
    const fallidos = (datos.casos ?? []).filter((x) => !x.ok);
    expect(fallidos, JSON.stringify(fallidos)).toEqual([]);
    expect(datos.ok).toBe(true);
    expect((datos.casos ?? []).length).toBeGreaterThanOrEqual(13);
    // Limpieza: ni pedidos, ni liquidaciones, ni usuarios, ni movimientos de la prueba.
    for (const [tabla, col] of [
      ['pedidos', 'id'],
      ['liquidaciones', 'pedido_id'],
      ['movimientos', 'pedido_id'],
      ['usuarios', 'id'],
    ] as const) {
      const f = await DB.prepare(
        `SELECT COUNT(*) AS n FROM ${tabla} WHERE ${col} LIKE 'zz-l1%'`,
      ).first<{ n: number }>();
      expect(Number(f?.n), tabla).toBe(0);
    }
    // Ninguna autorización de prueba quedó abierta en Stripe.
    expect([...st.pis.values()].filter((p) => p.status === 'requires_capture')).toEqual([]);
  });

  it('barrera 1 · con llaves reales (sk_live_) se niega sin tocar nada', async () => {
    const { datos, st } = await correr('staging.tumbite.com', 'sk_live_x');
    expect(datos.ok).toBe(false);
    expect(datos.omitido).toMatch(/modo prueba/);
    expect(st.pis.size).toBe(0);
  });

  it('barrera 2 · en el dominio de producción las pruebas de diagnóstico ni existen (y L1 además se niega)', async () => {
    const { datos, st } = await correr('tumbite.com', 'sk_test_x');
    expect(datos.ok).not.toBe(true);
    expect(JSON.stringify(datos)).toMatch(/Not found|sitio de pruebas/);
    expect(st.pis.size).toBe(0);
  });

  it('L1 está en la corrida del sitio de pruebas', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const guion = readFileSync(
      join(__dirname, '..', '..', '..', 'scripts', 'staging', 'probar-staging.mjs'),
      'utf8',
    );
    expect(guion).toMatch(/resultados\.L1 = await pedir\('l1'\)/);
  });
});
