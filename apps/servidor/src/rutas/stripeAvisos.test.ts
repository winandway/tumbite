import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * C-STRIPE-AVISOS: el equipo consulta y crea los avisos (webhooks) de Stripe desde el propio servidor,
 * que es el único que tiene la llave secreta. Solo con el secreto del reloj; nunca muestra la llave.
 */
const SECRETO = 'r'.repeat(40);
const URL_SITIO = 'https://tumbite.test';

function conStripe(existentes: Record<string, unknown>[] = []) {
  const llamadas: { metodo: string; url: string; cuerpo: string }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    llamadas.push({ metodo: init?.method ?? 'GET', url, cuerpo: String(init?.body ?? '') });
    if (url.includes('/v1/webhook_endpoints') && (init?.method ?? 'GET') === 'GET')
      return new Response(JSON.stringify({ data: existentes }), { status: 200 });
    if (url.includes('/v1/webhook_endpoints'))
      return new Response(
        JSON.stringify({
          id: 'we_nuevo',
          secret: 'whsec_nuevo',
          url: `${URL_SITIO}/datos/stripe/aviso`,
        }),
        { status: 200 },
      );
    return new Response('{}', { status: 200 });
  });
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x', RELOJ_SECRETO: SECRETO, SITIO_URL: URL_SITIO });
  const pedir = (metodo: string, ruta: string, secreto = SECRETO) =>
    m.crudo(ruta, { method: metodo, headers: { 'x-reloj-secreto': secreto } });
  return { m, llamadas, pedir };
}

describe('avisos de Stripe desde el servidor (C-STRIPE-AVISOS)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sin el secreto del reloj no existe (404) y nunca se llama a Stripe', async () => {
    const { pedir, llamadas } = conStripe();
    expect((await pedir('GET', '/datos/interno-stripe/avisos', 'malo')).status).toBe(404);
    expect((await pedir('POST', '/datos/interno-stripe/avisos/conectadas', '')).status).toBe(404);
    expect(llamadas.filter((l) => l.url.includes('stripe'))).toHaveLength(0);
  });

  it('lista los avisos sin secretos y dice si falta el de cuentas conectadas', async () => {
    const { pedir } = conStripe([
      {
        id: 'we_1',
        url: `${URL_SITIO}/datos/stripe/aviso`,
        status: 'enabled',
        livemode: false,
        enabled_events: ['payment_intent.succeeded'],
        metadata: {},
        secret: 'whsec_no_debe_salir',
      },
      // La cuenta de Stripe es compartida con otros negocios: sus avisos nunca se muestran.
      {
        id: 'we_otro',
        url: 'https://otro-negocio.example/webhook',
        status: 'enabled',
        livemode: false,
        enabled_events: ['charge.succeeded'],
        metadata: {},
      },
    ]);
    const r = await pedir('GET', '/datos/interno-stripe/avisos');
    expect(r.status).toBe(200);
    const d = (await r.json()) as { avisos: Record<string, unknown>[]; faltaConectadas: boolean };
    expect(d.faltaConectadas).toBe(true);
    expect(d.avisos[0]).toMatchObject({ id: 'we_1', estado: 'enabled', modoPrueba: true });
    expect(JSON.stringify(d)).not.toContain('whsec_');
    expect(d.avisos).toHaveLength(1);
    expect(JSON.stringify(d)).not.toContain('otro-negocio');
  });

  it('crea el de cuentas conectadas una sola vez (connect, eventos de cuentas) y entrega su secreto solo al crearlo', async () => {
    const { pedir, llamadas } = conStripe();
    const r = await pedir('POST', '/datos/interno-stripe/avisos/conectadas');
    expect(r.status).toBe(201);
    const d = (await r.json()) as { id: string; secreto: string; creado: boolean };
    expect(d).toEqual({ id: 'we_nuevo', secreto: 'whsec_nuevo', creado: true });
    const creado = llamadas.find(
      (l) => l.metodo === 'POST' && l.url.includes('/v1/webhook_endpoints'),
    )!;
    const p = new URLSearchParams(creado.cuerpo);
    expect(p.get('connect')).toBe('true');
    expect(p.get('url')).toBe(`${URL_SITIO}/datos/stripe/aviso`);
    const eventos = [...p.entries()]
      .filter(([k]) => k.startsWith('enabled_events'))
      .map(([, v]) => v);
    expect(eventos.sort()).toEqual(['account.updated', 'payout.failed']);
    expect(p.get('metadata[tumbite]')).toBe('conectadas');
  });

  it('si ya existe, no crea otro ni muestra secreto', async () => {
    const { pedir, llamadas } = conStripe([
      {
        id: 'we_c',
        url: `${URL_SITIO}/datos/stripe/aviso`,
        status: 'enabled',
        livemode: false,
        enabled_events: ['account.updated', 'payout.failed'],
        metadata: { tumbite: 'conectadas' },
      },
    ]);
    const r = await pedir('POST', '/datos/interno-stripe/avisos/conectadas');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ id: 'we_c', creado: false });
    expect(llamadas.filter((l) => l.metodo === 'POST' && l.url.includes('webhook'))).toHaveLength(
      0,
    );
  });
});
