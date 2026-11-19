import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from './pruebas/ayuda';

/**
 * C-CONNECT-PAIS y C-CONNECT-UN-INTENTO (17 nov 2026). Cada cuenta conectada nace con el país de su
 * zona y el acuerdo que Stripe permite ahí (EE. UU. completo, Colombia «recipient»); un país sin
 * perfil no llama a Stripe; y el PRIMER rechazo de Stripe al crear una cuenta frena todos los
 * intentos siguientes (el 5 nov, 17 intentos fallidos seguidos hicieron que Stripe pausara Connect).
 * Todos los países.
 */
const SECRETO = 's'.repeat(40);

function stripeFalso(rechazar = false) {
  const llamadas: { metodo: string; url: string; cuerpo: string }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    llamadas.push({ metodo, url, cuerpo: decodeURIComponent(String(init?.body ?? '')) });
    if (url.endsWith('/v1/accounts') && metodo === 'POST')
      return rechazar
        ? new Response(
            JSON.stringify({
              error: { message: 'Your account is temporarily restricted from creating accounts.' },
            }),
            { status: 400, headers: { 'request-id': 'req_prueba123' } },
          )
        : new Response(JSON.stringify({ id: 'acct_nueva' }), { status: 200 });
    if (url.includes('/v1/account_links'))
      return new Response(JSON.stringify({ url: 'https://connect.stripe.com/setup/e/x' }), {
        status: 200,
      });
    if (url.includes('/v1/account_sessions'))
      return new Response(JSON.stringify({ client_secret: 'accs_x' }), { status: 200 });
    if (/\/v1\/account(\?|$)/.test(url))
      return new Response(
        JSON.stringify({
          id: 'acct_plataforma',
          country: 'US',
          charges_enabled: true,
          payouts_enabled: true,
          capabilities: { transfers: 'active' },
          requirements: { currently_due: [], disabled_reason: null },
          email: 'dueno@no-debe-salir.example',
        }),
        { status: 200 },
      );
    if (url.includes('/v1/accounts'))
      return new Response(
        JSON.stringify({
          data: [
            {
              id: 'acct_vieja',
              type: 'express',
              country: 'CO',
              email: 'persona@no-debe-salir.example',
              requirements: { disabled_reason: 'platform_paused' },
            },
          ],
          has_more: false,
        }),
        { status: 200 },
      );
    if (url.includes('/v1/balance'))
      return new Response(
        JSON.stringify({ available: [{ amount: 500, currency: 'usd' }], pending: [] }),
        { status: 200 },
      );
    return new Response('{}', { status: 404 });
  });
  return llamadas;
}
const creaciones = (ll: { metodo: string; url: string; cuerpo: string }[]) =>
  ll.filter((l) => l.metodo === 'POST' && l.url.endsWith('/v1/accounts'));

async function conZona(m: ReturnType<typeof mundo>, usuarioId: string, pais: string) {
  const zona = `${pais}-PRUEBA`;
  await m.DB.prepare(
    "INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa) VALUES (?, ?, ?, 'USD', 'America/New_York', 0, 0, 10, 1)",
  )
    .bind(zona, `Zona ${pais}`, pais)
    .run();
  await m.DB.prepare(
    "INSERT INTO repartidores (usuario_id, tipo, zona_id) VALUES (?, 'independiente', ?) ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id",
  )
    .bind(usuarioId, zona)
    .run();
}

afterEach(() => vi.unstubAllGlobals());

describe('C-CONNECT-PAIS: la cuenta nace con el país de la zona', () => {
  it('Colombia: Express con acuerdo «recipient» y solo transferencias', async () => {
    const ll = stripeFalso();
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_CONNECT_ACTIVO: '1' });
    const rita = await m.cuenta('repartidor', 'Rita Bogotá');
    await conZona(m, rita.id, 'CO');
    const r = await m.llamar('POST', '/datos/billetera/conectar', {}, rita.token);
    expect(r.estado).toBe(200);
    const [alta] = creaciones(ll);
    expect(alta?.cuerpo).toContain('country=CO');
    expect(alta?.cuerpo).toContain('tos_acceptance[service_agreement]=recipient');
    expect(alta?.cuerpo).toContain('capabilities[transfers][requested]=true');
    // Solo lo que el modelo necesita (pedido de Stripe, 18 nov): nada de pagos con tarjeta ni otras.
    expect(alta?.cuerpo.match(/capabilities\[[a-z_]+\]/g)).toEqual(['capabilities[transfers]']);
  });

  it('EE. UU.: sin acuerdo «recipient»', async () => {
    const ll = stripeFalso();
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_CONNECT_ACTIVO: '1' });
    const rita = await m.cuenta('repartidor', 'Rita Novi');
    await conZona(m, rita.id, 'US');
    await m.llamar('POST', '/datos/billetera/conectar', {}, rita.token);
    const [alta] = creaciones(ll);
    expect(alta?.cuerpo).toContain('country=US');
    expect(alta?.cuerpo).not.toContain('service_agreement');
    expect(alta?.cuerpo).toContain('type=express');
    expect(alta?.cuerpo.match(/capabilities\[[a-z_]+\]/g)).toEqual(['capabilities[transfers]']);
  });

  it('Venezuela (sin perfil): 409 y ni una llamada a Stripe', async () => {
    const ll = stripeFalso();
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_CONNECT_ACTIVO: '1' });
    const rita = await m.cuenta('repartidor', 'Rita El Vigía');
    await conZona(m, rita.id, 'VE');
    const r = await m.llamar('POST', '/datos/billetera/conectar', {}, rita.token);
    expect(r.estado).toBe(409);
    expect(ll.filter((l) => l.url.includes('stripe'))).toHaveLength(0);
  });
});

describe('C-CONNECT-UN-INTENTO: un rechazo de Stripe frena todo intento siguiente', () => {
  it('después del primer rechazo, otra persona ya no llega a Stripe y la salud lo marca', async () => {
    const ll = stripeFalso(true);
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_CONNECT_ACTIVO: '1' });
    const a = await m.cuenta('repartidor', 'Primera');
    const b = await m.cuenta('restaurante', 'Segunda');
    const r1 = await m.llamar('POST', '/datos/billetera/conectar', {}, a.token);
    expect(r1.estado).toBeGreaterThanOrEqual(400);
    const r2 = await m.llamar('POST', '/datos/billetera/conectar', {}, b.token);
    const r3 = await m.llamar('POST', '/datos/billetera/conectar', {}, a.token);
    expect(r2.estado).toBe(409);
    expect(r3.estado).toBe(409);
    expect(creaciones(ll)).toHaveLength(1);
    const salud = (await m.llamar('GET', '/datos/salud')).datos as { piezas: { connect: string } };
    expect(salud.piezas.connect).toBe('error');
  });

  it('con Connect apagado, el freno se ve como «atrasado» y no tumba la salud (503)', async () => {
    stripeFalso(true);
    const m = mundo({
      STRIPE_SECRET_KEY: 'sk_live_x',
      RELOJ_SECRETO: SECRETO,
      SITIO_URL: 'https://divoox.test',
    });
    const rita = await m.cuenta('restaurante', 'Soporte Freno');
    await m.crudo('/datos/interno-stripe/connect/alta', {
      method: 'POST',
      headers: { 'x-reloj-secreto': SECRETO, 'content-type': 'application/json' },
      body: JSON.stringify({ usuarioId: rita.id }),
    });
    const salud = await m.llamar('GET', '/datos/salud');
    expect((salud.datos as { piezas: { connect: string } }).piezas.connect).toBe('atrasado');
    expect(salud.estado).not.toBe(503);
  });
});

describe('rutas internas de Connect (solo con el secreto del reloj)', () => {
  const armar = (rechazar = false) => {
    const ll = stripeFalso(rechazar);
    const m = mundo({
      STRIPE_SECRET_KEY: 'sk_live_x',
      RELOJ_SECRETO: SECRETO,
      SITIO_URL: 'https://divoox.test',
    });
    const interno = (metodo: string, ruta: string, cuerpo?: unknown, secreto = SECRETO) =>
      m.crudo(ruta, {
        method: metodo,
        headers: { 'x-reloj-secreto': secreto, 'content-type': 'application/json' },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
    return { ll, m, interno };
  };

  it('sin el secreto no existen y no llaman a Stripe', async () => {
    const { ll, interno } = armar();
    expect((await interno('GET', '/datos/interno-stripe/plataforma', undefined, 'x')).status).toBe(
      404,
    );
    expect(
      (await interno('POST', '/datos/interno-stripe/connect/alta', { usuarioId: 'u' }, 'x')).status,
    ).toBe(404);
    expect(ll).toHaveLength(0);
  });

  it('la revisión pasiva solo lee (GET) y no devuelve correos', async () => {
    const { ll, interno } = armar();
    const r = await interno('GET', '/datos/interno-stripe/plataforma');
    expect(r.status).toBe(200);
    const d = (await r.json()) as { conectadas: { cuantas: number }; plataforma: { id: string } };
    expect(d.plataforma.id).toBe('acct_plataforma');
    expect(d.conectadas.cuantas).toBe(1);
    expect(JSON.stringify(d)).not.toContain('no-debe-salir');
    expect(ll.every((l) => l.metodo === 'GET')).toBe(true);
  });

  it('el alta crea UNA cuenta con el país pedido y da un enlace estable que lleva a Stripe', async () => {
    const { ll, m, interno } = armar();
    const rita = await m.cuenta('repartidor', 'Soporte Cobros Colombia');
    const r = await interno('POST', '/datos/interno-stripe/connect/alta', {
      usuarioId: rita.id,
      pais: 'CO',
    });
    expect(r.status).toBe(201);
    const d = (await r.json()) as { cuenta: string; enlace: string; pais: string };
    expect(d).toMatchObject({ cuenta: 'acct_nueva', pais: 'CO' });
    expect(d.enlace).toMatch(/^https:\/\/divoox\.test\/datos\/connect\/continuar\/[0-9a-f]{48}$/);
    // Repetir no crea otra cuenta.
    await interno('POST', '/datos/interno-stripe/connect/alta', { usuarioId: rita.id, pais: 'CO' });
    expect(creaciones(ll)).toHaveLength(1);
    const ir = await m.crudo(new URL(d.enlace).pathname, { method: 'GET', redirect: 'manual' });
    expect(ir.status).toBe(302);
    expect(ir.headers.get('location')).toBe('https://connect.stripe.com/setup/e/x');
  });

  it('si Stripe la rechaza, devuelve su mensaje exacto, deja el freno y no reintenta', async () => {
    const { ll, m, interno } = armar(true);
    const rita = await m.cuenta('restaurante', 'Soporte Restaurante');
    const r = await interno('POST', '/datos/interno-stripe/connect/alta', { usuarioId: rita.id });
    expect(r.status).toBe(422);
    expect(await r.json()).toMatchObject({
      rechazada: true,
      mensajeStripe: 'Your account is temporarily restricted from creating accounts.',
      solicitudStripe: 'req_prueba123',
    });
    const freno = await m.DB.prepare(
      "SELECT valor FROM config WHERE clave = 'connect_frenado'",
    ).first<{
      valor: string;
    }>();
    expect(JSON.parse(freno?.valor ?? '{}')).toMatchObject({ solicitud: 'req_prueba123' });
    const r2 = await interno('POST', '/datos/interno-stripe/connect/alta', { usuarioId: rita.id });
    expect(r2.status).toBe(409);
    expect(creaciones(ll)).toHaveLength(1);
  });
});
