import { Hono } from 'hono';
import type { Env } from '../env';
import type { Variables } from '../sesion';
import { z } from 'zod';
import { base } from '../sesion';
import { ErrorStripe, type Stripe, crearStripe } from '../stripe';
import { ErrorDatos, leerCuerpo } from '../validar';
import { connectFrenado, crearCuentaConnect, paisDeCobros } from '../connectPaises';

/**
 * C-STRIPE-AVISOS (19 oct 2026): consultar y crear los avisos (webhooks) de Stripe desde el servidor,
 * el único que tiene la llave secreta (vive como secreto en el panel de YaDominios y nadie la ve).
 * Solo con el secreto del reloj, comparado en tiempo constante. Nunca devuelve la llave ni los
 * secretos de avisos existentes; el secreto del aviso nuevo se entrega UNA vez, al crearlo, para
 * guardarlo directo como variable secreta del sitio.
 */
export const stripeAvisos = new Hono<{ Bindings: Env; Variables: Variables }>();

/** Eventos de las cuentas conectadas (restaurantes y repartidores con Stripe Connect). */
export const EVENTOS_CONECTADAS = ['account.updated', 'payout.failed'];

async function iguales(a: string, b: string) {
  const h = async (x: string) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(x)));
  const [ha, hb] = await Promise.all([h(a), h(b)]);
  return a.length === b.length && ha.every((v, i) => v === hb.at(i));
}

stripeAvisos.use('/interno-stripe/*', async (c, next) => {
  const secreto = c.env.RELOJ_SECRETO;
  if (!secreto || !(await iguales(c.req.header('x-reloj-secreto') ?? '', secreto)))
    throw new ErrorDatos('No encontrado.', undefined, 404);
  await next();
});

type Aviso = {
  id: string;
  url: string;
  status: string;
  livemode: boolean;
  enabled_events: string[];
  metadata?: Record<string, string>;
};

const urlAviso = (env: Env) => `${(env.SITIO_URL ?? '').replace(/\/$/, '')}/datos/stripe/aviso`;

async function listar(env: Env) {
  const stripe = crearStripe(env.STRIPE_SECRET_KEY);
  if (!stripe) throw new ErrorDatos('Stripe no está configurado.', undefined, 409);
  // La cuenta es compartida: puede tener más de 100 avisos. Se recorren todas las páginas.
  const avisos: Aviso[] = [];
  let despues: string | undefined;
  for (let pagina = 0; pagina < 20; pagina++) {
    const r = await stripe.get<{ data: Aviso[]; has_more?: boolean }>('/webhook_endpoints', {
      limit: 100,
      ...(despues ? { starting_after: despues } : {}),
    });
    avisos.push(...r.data);
    if (!r.has_more || !r.data.length) break;
    despues = r.data.at(-1)!.id;
  }
  return { stripe, avisos };
}

/** El aviso de cuentas conectadas: creado por esta ruta (metadata) o a mano en el panel (sus eventos). */
const esConectadas = (a: Aviso, env: Env) =>
  a.url === urlAviso(env) &&
  (a.metadata?.tumbite === 'conectadas' || a.enabled_events.includes('account.updated'));

stripeAvisos.get('/interno-stripe/avisos', async (c) => {
  const { avisos: todos } = await listar(c.env);
  // La cuenta de Stripe de Windoce es compartida con otros negocios: solo se muestran los avisos que
  // apuntan a este sitio (perímetro de Divoox).
  const host = new URL(c.env.SITIO_URL ?? 'https://invalido.local').host;
  const avisos = todos.filter((a) => {
    try {
      return new URL(a.url).host === host;
    } catch {
      return false;
    }
  });
  return c.json({
    avisos: avisos.map((a) => ({
      id: a.id,
      url: a.url,
      estado: a.status,
      modoPrueba: !a.livemode,
      eventos: a.enabled_events,
      tumbite: a.metadata?.tumbite ?? null,
    })),
    faltaConectadas: !avisos.some((a) => esConectadas(a, c.env)),
  });
});

/** Eventos que necesita el aviso PRINCIPAL (pedidos, recargas, Flex · Fase 4). */
export const EVENTOS_PRINCIPAL = [
  'checkout.session.completed',
  'payment_intent.amount_capturable_updated',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.updated',
  'charge.dispute.closed',
  'transfer.created',
  'transfer.reversed',
  // C-PLUS: la suscripción se activa con la factura pagada y termina cuando Stripe la cierra.
  'invoice.paid',
  'customer.subscription.deleted',
];

/**
 * Agrega al aviso principal de ESTE sitio los eventos que le falten (nunca quita ninguno ni toca
 * avisos de otros sitios de la cuenta compartida). Idempotente.
 */
stripeAvisos.post('/interno-stripe/avisos/principal/eventos', async (c) => {
  const { stripe, avisos } = await listar(c.env);
  // El principal es el de este sitio que recibe los PAGOS (puede escuchar también account.updated
  // si se creó a mano); el de cuentas conectadas solo lleva sus dos eventos o la marca «conectadas».
  const principal = avisos.find(
    (a) =>
      a.url === urlAviso(c.env) &&
      a.metadata?.tumbite !== 'conectadas' &&
      (a.enabled_events.includes('payment_intent.succeeded') || a.enabled_events.includes('*')),
  );
  if (!principal) throw new ErrorDatos('No hay aviso principal para este sitio.', undefined, 404);
  const faltan = EVENTOS_PRINCIPAL.filter(
    (e) => !principal.enabled_events.includes(e) && !principal.enabled_events.includes('*'),
  );
  if (!faltan.length) return c.json({ id: principal.id, agregados: [] });
  await stripe.post(
    `/webhook_endpoints/${principal.id}`,
    { enabled_events: [...principal.enabled_events, ...faltan] },
    `avisos-principal-${principal.id}-${faltan.join(',')}`,
  );
  return c.json({ id: principal.id, agregados: faltan });
});

stripeAvisos.post('/interno-stripe/avisos/conectadas', async (c) => {
  if (!c.env.SITIO_URL) throw new ErrorDatos('Falta SITIO_URL.', undefined, 409);
  const { stripe, avisos } = await listar(c.env);
  const ya = avisos.find((a) => esConectadas(a, c.env));
  if (ya) return c.json({ id: ya.id, creado: false });
  const nuevo = await stripe.post<{ id: string; secret: string }>(
    '/webhook_endpoints',
    {
      url: urlAviso(c.env),
      connect: true,
      enabled_events: EVENTOS_CONECTADAS,
      description: 'Divoox · cuentas conectadas (restaurantes y repartidores)',
      metadata: { tumbite: 'conectadas' },
    },
    `avisos-conectadas-${urlAviso(c.env)}`,
  );
  return c.json({ id: nuevo.id, secreto: nuevo.secret, creado: true }, 201);
});

/**
 * C-CONNECT-PASIVO (17 nov 2026): mirar, sin escribir nada en Stripe, cómo está la plataforma para
 * Connect: capacidades y requisitos de la cuenta de Windoce, cuántas cuentas conectadas hay y en qué
 * estado, el saldo disponible para transferir y si el freno de C-CONNECT-UN-INTENTO está puesto.
 * Solo con el secreto del reloj. No devuelve correos ni datos de personas.
 */
stripeAvisos.get('/interno-stripe/plataforma', async (c) => {
  const stripe = crearStripe(c.env.STRIPE_SECRET_KEY);
  if (!stripe) throw new ErrorDatos('Stripe no está configurado.', undefined, 409);
  type Requisitos = {
    currently_due?: string[];
    past_due?: string[];
    eventually_due?: string[];
    disabled_reason?: string | null;
    errors?: { code: string; reason: string; requirement: string }[];
  };
  type Cuenta = {
    id: string;
    type?: string;
    country?: string;
    created?: number;
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
    details_submitted?: boolean;
    capabilities?: Record<string, string>;
    requirements?: Requisitos;
    tos_acceptance?: { service_agreement?: string };
    metadata?: Record<string, string>;
  };
  const [plataforma, conectadas, saldo] = await Promise.all([
    stripe.get<Cuenta>('/account'),
    stripe.get<{ data: Cuenta[]; has_more?: boolean }>('/accounts', { limit: 100 }),
    stripe.get<{
      available: { amount: number; currency: string }[];
      pending: { amount: number; currency: string }[];
    }>('/balance'),
  ]);
  const frenado = await connectFrenado(base(c));
  return c.json({
    modoPrueba: (c.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_'),
    connectActivo: c.env.STRIPE_CONNECT_ACTIVO === '1',
    frenado: frenado ? (JSON.parse(frenado) as unknown) : null,
    plataforma: {
      id: plataforma.id,
      pais: plataforma.country,
      cobrosActivos: plataforma.charges_enabled,
      pagosActivos: plataforma.payouts_enabled,
      capacidades: plataforma.capabilities,
      requisitos: plataforma.requirements,
    },
    conectadas: {
      cuantas: conectadas.data.length,
      hayMas: Boolean(conectadas.has_more),
      cuentas: conectadas.data.map((a) => ({
        id: a.id,
        tipo: a.type,
        pais: a.country,
        creada: a.created ? new Date(a.created * 1000).toISOString() : null,
        acuerdo: a.tos_acceptance?.service_agreement ?? null,
        datosCompletos: a.details_submitted,
        pagosActivos: a.payouts_enabled,
        capacidades: a.capabilities,
        bloqueo: a.requirements?.disabled_reason ?? null,
        faltan: a.requirements?.currently_due ?? [],
        divoox: a.metadata?.usuario_id ? true : false,
      })),
    },
    saldo: { disponible: saldo.available, pendiente: saldo.pending },
  });
});

/** Enlace estable para completar el alta: abre siempre un enlace fresco de Stripe (los de Stripe caducan). */
const enlaceEstable = (env: Env, token: string) =>
  `${(env.SITIO_URL ?? 'https://divoox.com').replace(/\/$/, '')}/datos/connect/continuar/${token}`;

async function enlaceDeAlta(env: Env, stripe: Stripe, cuenta: string, token: string) {
  const sitio = (env.SITIO_URL ?? 'https://divoox.com').replace(/\/$/, '');
  return stripe.post<{ url: string }>('/account_links', {
    account: cuenta,
    type: 'account_onboarding',
    refresh_url: enlaceEstable(env, token),
    return_url: `${sitio}/wallet/ready`,
  });
}

/**
 * C-CONNECT-UN-INTENTO: el alta supervisada de UNA cuenta conectada (la primera de cada país la hace
 * el equipo con una cuenta «Soporte»). Un solo intento: si Stripe la rechaza, queda el freno y se
 * devuelve el mensaje exacto de Stripe, sin reintentar. Si la persona ya tiene cuenta, no crea otra.
 * Devuelve un enlace estable de Divoox que siempre abre un enlace de alta fresco de Stripe.
 */
stripeAvisos.post('/interno-stripe/connect/alta', async (c) => {
  const stripe = crearStripe(c.env.STRIPE_SECRET_KEY);
  if (!stripe) throw new ErrorDatos('Stripe no está configurado.', undefined, 409);
  const { usuarioId, pais } = await leerCuerpo(
    c,
    z.object({ usuarioId: z.string().min(1), pais: z.string().length(2).optional() }),
  );
  const db = base(c);
  const u = await db
    .prepare(
      "SELECT id, correo, rol FROM usuarios WHERE id = ? AND rol IN ('restaurante', 'repartidor')",
    )
    .bind(usuarioId)
    .first<{ id: string; correo: string; rol: string }>();
  if (!u) throw new ErrorDatos('No existe ese restaurante o repartidor.', 'usuarioId', 404);
  let fila = await db
    .prepare('SELECT stripe_cuenta FROM cuentas_stripe WHERE usuario_id = ?')
    .bind(u.id)
    .first<{ stripe_cuenta: string }>();
  const elegido = (pais ?? (await paisDeCobros(db, u))).toUpperCase();
  let creada = false;
  if (!fila) {
    try {
      const id = await crearCuentaConnect(db, stripe, u, elegido);
      await db
        .prepare('INSERT INTO cuentas_stripe (usuario_id, stripe_cuenta) VALUES (?, ?)')
        .bind(u.id, id)
        .run();
      fila = { stripe_cuenta: id };
      creada = true;
    } catch (e) {
      if (e instanceof ErrorStripe)
        return c.json(
          {
            rechazada: true,
            estadoStripe: e.estado,
            mensajeStripe: e.message,
            codigoStripe: e.codigo ?? null,
            solicitudStripe: e.solicitud ?? null,
          },
          422,
        );
      throw e;
    }
  }
  const token = [...crypto.getRandomValues(new Uint8Array(24))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  await db
    .prepare(
      "INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
    )
    .bind(`connect_enlace:${token}`, JSON.stringify({ cuenta: fila.stripe_cuenta, usuario: u.id }))
    .run();
  return c.json(
    {
      cuenta: fila.stripe_cuenta,
      pais: elegido,
      creada,
      enlace: enlaceEstable(c.env, token),
    },
    creada ? 201 : 200,
  );
});

/** El enlace estable: pide a Stripe un enlace de alta fresco y lleva a la persona allí. */
stripeAvisos.get('/connect/continuar/:token', async (c) => {
  const token = c.req.param('token');
  if (!/^[0-9a-f]{48}$/.test(token)) throw new ErrorDatos('No encontrado.', undefined, 404);
  const f = await base(c)
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(`connect_enlace:${token}`)
    .first<{ valor: string }>();
  const stripe = crearStripe(c.env.STRIPE_SECRET_KEY);
  if (!f || !stripe) throw new ErrorDatos('Este enlace ya no sirve.', undefined, 404);
  const { cuenta } = JSON.parse(f.valor) as { cuenta: string };
  const enlace = await enlaceDeAlta(c.env, stripe, cuenta, token);
  return c.redirect(enlace.url, 302);
});
