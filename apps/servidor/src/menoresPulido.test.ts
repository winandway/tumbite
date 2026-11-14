import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './env';
import { mundo } from './pruebas/ayuda';
import { anularAutorizacionProgramada } from './viajesCobro';

/**
 * Menores del revisor del pulido (14 nov 2026, todos los países):
 * - C-PROGRAMADO-ANULAR-REINTENTO: si Stripe responde `idempotency_key_in_use` (la primera petición
 *   sigue en curso), se repite una vez tras una espera corta antes de darla por perdida;
 * - C-RELOJ-PAUSA-DIAGNOSTICO: la herramienta del tiempo real dice «reloj en pausa» según el sitio
 *   de la petición, no por la constante;
 * - C-NOINDEX-ES: el viaje compartido en español (/es/ride/…) tampoco lo guardan los buscadores.
 * (C-PROGRAMADO-CANCELAR-PRIMERO tiene su prueba en rutas/viajesProgramados.test.ts.)
 */
afterEach(() => vi.unstubAllGlobals());

const COBRO = { operacionId: 'op-1', cliente: 'cus_1', pm: 'pm_1', monto: 1000, moneda: 'USD' };

describe('C-PROGRAMADO-ANULAR-REINTENTO', () => {
  it('ante idempotency_key_in_use espera y repite una vez; si quedó retenida, la anula', async () => {
    const llamadas: string[] = [];
    let intentos = 0;
    vi.stubGlobal('fetch', async (url: string) => {
      llamadas.push(String(url));
      if (/\/payment_intents$/.test(String(url))) {
        intentos++;
        return intentos === 1
          ? new Response(
              JSON.stringify({ error: { code: 'idempotency_key_in_use', message: 'en curso' } }),
              { status: 409 },
            )
          : new Response(JSON.stringify({ id: 'pi_1', status: 'requires_capture' }), {
              status: 200,
            });
      }
      return new Response(JSON.stringify({ id: 'pi_1', status: 'canceled' }), { status: 200 });
    });
    const m = mundo();
    const env = { STRIPE_SECRET_KEY: 'sk_test_x' } as unknown as Env;
    expect(await anularAutorizacionProgramada(env, m.DB, COBRO, 1)).toBe(true);
    expect(intentos).toBe(2);
    expect(llamadas.some((u) => u.endsWith('/payment_intents/pi_1/cancel'))).toBe(true);
  });

  it('un rechazo de verdad no se repite', async () => {
    let intentos = 0;
    vi.stubGlobal('fetch', async () => {
      intentos++;
      return new Response(JSON.stringify({ error: { code: 'card_declined' } }), { status: 402 });
    });
    const m = mundo();
    const env = { STRIPE_SECRET_KEY: 'sk_test_x' } as unknown as Env;
    expect(await anularAutorizacionProgramada(env, m.DB, COBRO, 1)).toBe(false);
    expect(intentos).toBe(1);
  });
});

describe('C-RELOJ-PAUSA-DIAGNOSTICO y C-NOINDEX-ES', () => {
  it('la herramienta del tiempo real dice la pausa según el sitio (local: no hay pausa)', async () => {
    const SEC = `reloj-${crypto.randomUUID()}`;
    const vivo = async (host: string) => {
      const m = mundo({ RELOJ_SECRETO: SEC }, { host });
      const r = await m.crudo('/datos/interno/diagnostico/vivo', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-reloj-secreto': SEC },
        body: JSON.stringify({ accion: 'leer', k: 'abcdef12' }),
      });
      return (await r.json()) as { relojEnPausa?: boolean };
    };
    expect((await vivo('staging.tumbite.com')).relojEnPausa).toBe(true);
    expect((await vivo('localhost:8790')).relojEnPausa).toBe(false);
  });

  it('el viaje compartido en español lleva noindex, como el de inglés', async () => {
    const ASSETS = {
      fetch: async () =>
        new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
    };
    const m = mundo({ ASSETS } as never, { host: 'divoox.com' });
    for (const ruta of ['/ride/abc123', '/es/ride/abc123', '/es/t/abc123'])
      expect((await m.crudo(ruta, { method: 'GET' })).headers.get('x-robots-tag'), ruta).toBe(
        'noindex, nofollow',
      );
  });
});
