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

  piezas.almacen = c.env.BUCKET ? 'ok' : 'pendiente';

  const env = revisarEnv(c.env as unknown as Record<string, unknown>);
  piezas.variables = env.ok ? 'ok' : 'error';
  piezas.stripe = c.env.STRIPE_SECRET_KEY ? 'ok' : 'pendiente';
  piezas.webhookStripe = c.env.STRIPE_WEBHOOK_SECRET ? 'ok' : 'pendiente';

  const algunError = Object.values(piezas).includes('error');
  return c.json({ servicio: MARCA.nombre, ok: !algunError, piezas }, algunError ? 503 : 200);
});

const RUTAS_PUBLICAS = new Set(['/', '/privacidad', '/terminos', '/soporte']);

/**
 * Todo lo que no es /datos lo sirven los estáticos. Las páginas de la app web
 * (landing, legales, panel) son una sola página: si el archivo no existe, se
 * entrega index.html y el navegador decide qué mostrar.
 */
app.notFound(async (c) => {
  if (c.req.path.startsWith('/datos/')) return c.json({ error: 'Esta dirección no existe.' }, 404);
  if (!c.env.ASSETS) return c.text('No encontrado', 404);
  let res = await c.env.ASSETS.fetch(c.req.raw);
  if (res.status === 404 && c.req.method === 'GET' && !/\.[a-z0-9]+$/i.test(c.req.path)) {
    res = await c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url), c.req.raw));
  }
  const respuesta = new Response(res.body, res);
  if (RUTAS_PUBLICAS.has(c.req.path) && res.ok) {
    // Caché de borde para las páginas públicas (sin cookies). El panel nunca se cachea.
    respuesta.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  }
  return respuesta;
});

app.onError((err, c) => {
  console.error('error no controlado', err);
  return c.json({ error: 'Algo salió mal de nuestro lado. Ya lo estamos revisando.' }, 500);
});
