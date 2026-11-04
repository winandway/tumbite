import { afterEach, expect, it, vi } from 'vitest';
import type { Env } from './env';
import { mundo } from './pruebas/ayuda';
import { enviarSms, usarTiempoTwilio } from './sms';

/**
 * C-LLAMADAS-CON-LIMITE (3 nov 2026): un Twilio que no contesta no deja colgada la petición. El SMS de
 * respaldo de «llegó a la puerta» sale dentro de la ubicación del repartidor; sin límite, esa
 * ubicación se quedaba esperando para siempre (recorrido de staging, pedido en efectivo). EE. UU.
 */
afterEach(() => {
  vi.unstubAllGlobals();
  usarTiempoTwilio(null);
});

it('si Twilio nunca contesta, enviarSms termina a tiempo y dice que falló', async () => {
  usarTiempoTwilio(50);
  vi.stubGlobal(
    'fetch',
    (_e: string, init: RequestInit) =>
      new Promise((_ok, falla) => {
        init.signal?.addEventListener('abort', () => falla(new Error('tiempo agotado')));
      }),
  );
  const m = mundo();
  const env = {
    TWILIO_ACCOUNT_SID: 'AC_prueba',
    TWILIO_AUTH_TOKEN: 'token_prueba',
    TWILIO_FROM: '+18665550100',
  } as unknown as Env;
  const t = Date.now();
  const r = await Promise.race([
    enviarSms(env, m.DB, {
      usuarioId: 'u1',
      pedidoId: null,
      tipo: 'llego',
      telefono: '+13055550100',
      texto: 'Prueba',
    }),
    new Promise((ok) => setTimeout(() => ok('colgado'), 3000)),
  ]);
  expect(r).toBe(false);
  expect(Date.now() - t).toBeLessThan(2000);
});
