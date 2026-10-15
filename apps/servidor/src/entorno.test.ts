import { describe, expect, it } from 'vitest';
import { app } from './app';
import { blindarStripeEnPruebas, problemasDeEntorno } from './entorno';
import { crearBasePruebas } from './pruebas/d1';

describe('C-ENTORNOS-SEPARADOS en el servidor', () => {
  it('pruebas con llaves reales o producción con llaves de prueba: error', () => {
    expect(
      problemasDeEntorno('staging.tumbite.com', { STRIPE_SECRET_KEY: 'sk_live_x' }),
    ).toHaveLength(1);
    expect(
      problemasDeEntorno('tumbite.com', {
        STRIPE_SECRET_KEY: 'sk_test_x',
        STRIPE_PUBLISHABLE_KEY: 'pk_test_x',
      }),
    ).toHaveLength(2);
    expect(problemasDeEntorno('tumbite.com', { SITIO_URL: 'https://staging.tumbite.com' })).toEqual(
      ['SITIO_URL apunta a pruebas'],
    );
    expect(
      problemasDeEntorno('staging.tumbite.com', {
        STRIPE_SECRET_KEY: 'sk_test_x',
        SITIO_URL: 'https://staging.tumbite.com',
      }),
    ).toEqual([]);
    expect(
      problemasDeEntorno('tumbite.com', {
        STRIPE_SECRET_KEY: 'sk_live_x',
        SITIO_URL: 'https://tumbite.com',
      }),
    ).toEqual([]);
    expect(problemasDeEntorno('localhost', { STRIPE_SECRET_KEY: 'sk_live_x' })).toEqual([]);
  });

  it('en pruebas una llave real de Stripe se ignora: no puede cobrar dinero real', () => {
    const env = { STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_PUBLISHABLE_KEY: 'pk_live_x' };
    blindarStripeEnPruebas('staging.tumbite.com', env);
    expect(env).toEqual({ STRIPE_SECRET_KEY: undefined, STRIPE_PUBLISHABLE_KEY: undefined });
    const prod = { STRIPE_SECRET_KEY: 'sk_live_x' };
    blindarStripeEnPruebas('tumbite.com', prod);
    expect(prod.STRIPE_SECRET_KEY).toBe('sk_live_x');
  });

  it('la salud lo dice en rojo (y el semáforo frena)', async () => {
    const DB = crearBasePruebas();
    const r = await app.request(
      'https://tumbite.com/datos/salud',
      {},
      { DB, STRIPE_SECRET_KEY: 'sk_test_x' },
    );
    const d = (await r.json()) as { ok: boolean; piezas: Record<string, string> };
    expect(d.piezas.entorno).toBe('error');
    expect(d.ok).toBe(false);
  });
});
