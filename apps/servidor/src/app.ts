import { Hono } from 'hono';
import { MARCA } from '@tumbite/compartido';
import { type Env, revisarEnv } from './env';
import { cabecerasSeguridad, limiteIntentos } from './seguridad';

export const app = new Hono<{ Bindings: Env }>();

app.use('*', cabecerasSeguridad);
app.use('/datos/*', limiteIntentos(120, 60_000));

/**
 * Canario de salud. Cada pieza dice ok / error / pendiente. Nada falla en silencio:
 * si una pieza se cae, aquí se ve.
 */
app.get('/datos/salud', async (c) => {
  const piezas: Record<string, 'ok' | 'error' | 'pendiente'> = {};

  if (!c.env.DB) {
    piezas.base = 'pendiente';
  } else {
    try {
      await c.env.DB.prepare('SELECT 1').first();
      piezas.base = 'ok';
    } catch (e) {
      console.error('salud: la base no responde', e);
      piezas.base = 'error';
    }
  }

  const env = revisarEnv(c.env as unknown as Record<string, unknown>);
  piezas.variables = env.ok ? 'ok' : 'error';
  piezas.stripe = c.env.STRIPE_SECRET_KEY ? 'ok' : 'pendiente';
  piezas.webhookStripe = c.env.STRIPE_WEBHOOK_SECRET ? 'ok' : 'pendiente';

  const algunError = Object.values(piezas).includes('error');
  return c.json({ servicio: MARCA.nombre, ok: !algunError, piezas }, algunError ? 503 : 200);
});

app.notFound((c) =>
  c.req.path.startsWith('/datos/')
    ? c.json({ error: 'Esta dirección no existe.' }, 404)
    : c.env.ASSETS
      ? c.env.ASSETS.fetch(c.req.raw)
      : c.text('No encontrado', 404),
);

app.onError((err, c) => {
  console.error('error no controlado', err);
  return c.json({ error: 'Algo salió mal de nuestro lado. Ya lo estamos revisando.' }, 500);
});
