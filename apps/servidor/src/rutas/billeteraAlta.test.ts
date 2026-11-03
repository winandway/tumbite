import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * C-ALTA-COBROS-DENTRO (SIG-5, 3 nov 2026): el restaurante y el repartidor dan de alta sus cobros
 * dentro de Divoox con el componente de Stripe Connect (Account Sessions), como manda Stripe para
 * los marketplaces. La página alojada de Stripe queda solo de respaldo. EE. UU.
 */
function stripeFalso() {
  const llamadas: { url: string; cuerpo: string }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    llamadas.push({ url, cuerpo: decodeURIComponent(String(init?.body ?? '')) });
    if (url.includes('/account_sessions'))
      return new Response(JSON.stringify({ client_secret: 'accs_secret_x' }), { status: 200 });
    if (url.includes('/accounts'))
      return new Response(JSON.stringify({ id: 'acct_1' }), { status: 200 });
    return new Response('{}', { status: 404 });
  });
  return llamadas;
}

afterEach(() => vi.unstubAllGlobals());

const LLAVES = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PUBLISHABLE_KEY: 'pk_test_x' };

describe('C-ALTA-COBROS-DENTRO: alta de cobros dentro de Divoox', () => {
  it('da la sesión del componente de alta con la cuenta del usuario, una sola cuenta por persona', async () => {
    const llamadas = stripeFalso();
    const m = mundo(LLAVES);
    const rita = await m.cuenta('repartidor', 'Rita Alta');
    const r = await m.llamar('POST', '/datos/billetera/sesion', {}, rita.token);
    expect(r.estado).toBe(200);
    expect(r.datos).toEqual({ clientSecret: 'accs_secret_x', clavePublica: 'pk_test_x' });
    const sesion = llamadas.find((l) => l.url.includes('/account_sessions'))!;
    expect(sesion.cuerpo).toContain('account=acct_1');
    expect(sesion.cuerpo).toContain('components[account_onboarding][enabled]=true');
    // La segunda vez reutiliza la cuenta: no crea otra en Stripe.
    await m.llamar('POST', '/datos/billetera/sesion', {}, rita.token);
    expect(llamadas.filter((l) => /\/accounts$/.test(l.url))).toHaveLength(1);
  });

  it('sin la llave publicable responde 422 para que la pantalla use la página de Stripe', async () => {
    stripeFalso();
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
    const dueno = await m.cuenta('restaurante', 'Rosa Alta');
    const r = await m.llamar('POST', '/datos/billetera/sesion', {}, dueno.token);
    expect(r.estado).toBe(422);
  });

  it('un cliente no puede pedir la sesión de cobros', async () => {
    stripeFalso();
    const m = mundo(LLAVES);
    const ana = await m.cuenta('cliente', 'Ana Alta');
    const r = await m.llamar('POST', '/datos/billetera/sesion', {}, ana.token);
    expect(r.estado).toBe(403);
  });
});
