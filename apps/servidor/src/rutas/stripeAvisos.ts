import { Hono } from 'hono';
import type { Env } from '../env';
import type { Variables } from '../sesion';
import { crearStripe } from '../stripe';
import { ErrorDatos } from '../validar';

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
