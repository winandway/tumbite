import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * C-CONNECT-APAGADO (5 nov 2026, Gerencia): Stripe frenó la creación de cuentas conectadas de
 * Windoce. Causa: la billetera del panel pedía crear la cuenta en Stripe con la llave real cada vez
 * que un repartidor o restaurante la abría, con Connect sin activar: 17 intentos fallidos del 27 al
 * 30 oct. Ahora, con llave real, no se llama a Stripe hasta que Connect esté activado
 * (STRIPE_CONNECT_ACTIVO=1); la pantalla dice que los cobros al banco todavía no están activos.
 * EE. UU.
 */
function stripeFalso() {
  const llamadas: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    llamadas.push(url);
    if (url.includes('/account_sessions'))
      return new Response(JSON.stringify({ client_secret: 'accs_secret_x' }), { status: 200 });
    if (url.includes('/account_links'))
      return new Response(JSON.stringify({ url: 'https://connect.stripe.com/x' }), { status: 200 });
    if (url.includes('/accounts'))
      return new Response(JSON.stringify({ id: 'acct_1' }), { status: 200 });
    return new Response('{}', { status: 404 });
  });
  return llamadas;
}
afterEach(() => vi.unstubAllGlobals());

describe('C-CONNECT-APAGADO: con la llave real, nada de crear cuentas mientras Connect no esté activo', () => {
  for (const ruta of ['/datos/billetera/sesion', '/datos/billetera/conectar']) {
    it(`${ruta} responde 409 sin llamar a Stripe`, async () => {
      const llamadas = stripeFalso();
      const m = mundo({ STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_PUBLISHABLE_KEY: 'pk_live_x' });
      const rita = await m.cuenta('repartidor', 'Rita Connect');
      const r = await m.llamar('POST', ruta, {}, rita.token);
      expect(r.estado).toBe(409);
      expect(JSON.stringify(r.datos)).toMatch(/todavía no están activ|aren’t active yet/i);
      expect(llamadas.filter((u) => u.includes('stripe'))).toHaveLength(0);
    });
  }

  it('con Connect activado (STRIPE_CONNECT_ACTIVO=1) sí crea la cuenta', async () => {
    const llamadas = stripeFalso();
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_CONNECT_ACTIVO: '1' });
    const rita = await m.cuenta('repartidor', 'Rita Activa');
    const r = await m.llamar('POST', '/datos/billetera/conectar', {}, rita.token);
    expect(r.estado).toBe(200);
    expect(llamadas.some((u) => /\/accounts$/.test(u))).toBe(true);
  });
});

describe('C-STRIPE-SOLO-PRUEBA: toda prueba interna que toca Stripe exige llave sk_test_', () => {
  it('cada ruta de diagnóstico que usa Stripe se niega con la llave real', () => {
    const s = readFileSync(join(__dirname, 'diagnostico.ts'), 'utf8');
    const rutas = s.split(/\n(?=diagnostico\.(?:post|get)\()/).slice(1);
    const sinCandado = rutas
      .filter((p) => /crearStripe\(|stripe\.post|STRIPE_SECRET_KEY/.test(p))
      .filter((p) => !p.includes("startsWith('sk_test_')"))
      .map((p) => /diagnostico\.\w+\('([^']+)'/.exec(p)?.[1]);
    expect(sinCandado).toEqual([]);
  });
});
