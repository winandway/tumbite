import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { MARCA, direccionNueva, enIdiomaDireccion, panelNuevo } from '@tumbite/compartido';
import { type Env, revisarEnv } from './env';
import { usarStripeLocal } from './stripe';
import { enIdiomaDePeticion, idiomaDeLaPeticion } from './mensajesEn';
import { cabecerasSeguridad, limiteIntentos } from './seguridad';
import { type Variables, cargarSesion } from './sesion';
import { ErrorDatos } from './validar';
import { asegurarEsquema, ultimoErrorEsquema } from './esquema';
import { cuentas } from './rutas/cuentas';
import { catalogo } from './rutas/catalogo';
import { dinero } from './rutas/dinero';
import { pedidos } from './rutas/pedidos';
import { operacion } from './rutas/operacion';
import { regalos } from './rutas/regalos';
import { zonas } from './rutas/zonas';
import { espera } from './rutas/espera';
import { tickets } from './rutas/tickets';
import { franquicias } from './rutas/franquicias';
import { superadmin } from './rutas/superadmin';
import { kyc } from './rutas/kyc';
import { fotos, media } from './rutas/fotos';
import { correoConfigurado, ultimoErrorCorreo } from './correo';
import { ultimoErrorAviso } from './notificaciones';
import { smsConfigurado, ultimoErrorSms } from './sms';
import { estadoRespaldo, fechaUltimoRespaldo, respaldo, ultimoErrorRespaldo } from './respaldo';

export const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use('*', cabecerasSeguridad);
// Stripe simulado solo en la computadora del programador (ver stripe.ts). En producción no existe.
app.use('*', async (c, next) => {
  usarStripeLocal((c.env as unknown as Record<string, unknown>).STRIPE_API_URL);
  await next();
});
// Una sola dirección oficial: www.tumbite.com manda a tumbite.com (Google no ve dos copias).
app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  if (url.hostname.startsWith('www.')) {
    url.hostname = url.hostname.slice(4);
    return c.redirect(url.toString(), 301);
  }
  await next();
});
// El inglés es el idioma principal y todas las direcciones van en inglés (regla de Richard,
// 13 oct 2026). Lo viejo que ya circuló sigue funcionando con 301, con sus parámetros:
// «/privacidad» (que era la página en español) → «/es/privacy»; «/en/terminos» → «/terms».
// Candado C-INGLES-PRINCIPAL.
app.use('*', async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') return next();
  const url = new URL(c.req.url);
  const ruta = url.pathname;
  // El panel también va en inglés: «/panel/pedidos» → «/panel/orders».
  const panel = panelNuevo(ruta);
  if (panel) return c.redirect(`${panel}${url.search}`, 301);
  // Las pantallas de la app web del cliente también pasaron a inglés.
  const partesApp = ruta.split('/');
  const pantallaNueva = new Map([
    ['pedido', 'order'],
    ['restaurante', 'restaurant'],
    ['carrito', 'cart'],
    ['cuenta', 'account'],
  ]).get(partesApp[2] ?? '');
  if (partesApp[1] === 'app' && pantallaNueva) {
    const resto = partesApp.slice(3).join('/');
    return c.redirect(`/app/${pantallaNueva}${resto ? `/${resto}` : ''}${url.search}`, 301);
  }
  // La app web del repartidor se llama /driver (antes /repartidor).
  if (ruta === '/repartidor' || ruta.startsWith('/repartidor/'))
    return c.redirect(`/driver${ruta.slice(11)}${url.search}`, 301);
  if (/^\/(datos|media|panel|app|driver|t)(\/|$)/.test(ruta)) return next();
  let destino: string | null = null;
  if (ruta === '/en' || ruta.startsWith('/en/')) {
    const resto = ruta.slice(3) || '/';
    destino = direccionNueva(resto) ?? resto;
  } else {
    const espanol = ruta === '/es' || ruta.startsWith('/es/');
    const base = espanol ? ruta.slice(3) || '/' : ruta;
    const nueva = direccionNueva(base);
    if (nueva) destino = enIdiomaDireccion(nueva, 'es');
  }
  if (!destino) return next();
  return c.redirect(`${destino}${url.search}`, 301);
});
// Las apps nativas no mandan «Origin». Esto solo abre la puerta a la vista web de las apps en la
// computadora del programador. Nunca se abre a sitios ajenos.
app.use(
  '/datos/*',
  cors({
    origin: (origen) => (/^http:\/\/localhost:(8081|8082|8083)$/.test(origen) ? origen : null),
    allowHeaders: ['content-type', 'authorization', 'cf-turnstile-response', 'x-idioma'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  }),
);
const limiteGeneral = limiteIntentos(120, 60_000);
// Los avisos de Stripe llegan de sus servidores y ya vienen firmados: no se frenan por IP.
app.use('/datos/*', (c, next) =>
  c.req.path === '/datos/stripe/aviso' ? next() : limiteGeneral(c, next),
);
app.use('/datos/cuentas/entrar', limiteIntentos(10, 60_000));
app.use('/datos/cuentas/registro', limiteIntentos(10, 60_000));
app.use('/datos/cuentas/recuperar', limiteIntentos(5, 60_000));
app.use('/datos/cuentas/confirmar/reenviar', limiteIntentos(3, 60_000));
app.use('/datos/cuentas/restablecer', limiteIntentos(10, 60_000));
app.use('/datos/mi-restaurante/fotos', limiteIntentos(30, 60_000));
app.use('/datos/*', async (c, next) => {
  if (c.env.DB) await asegurarEsquema(c.env.DB);
  await next();
});
app.use('/datos/*', cargarSesion);

/**
 * Canario de salud. Cada pieza dice ok / error / pendiente. Nada falla en silencio:
 * si una pieza se cae, aquí se ve.
 */
app.get('/datos/salud', async (c) => {
  const piezas: Record<string, 'ok' | 'error' | 'pendiente' | 'atrasado'> = {};

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
  if (c.env.DB) piezas.esquema = ultimoErrorEsquema ? 'error' : 'ok';

  const env = revisarEnv(c.env as unknown as Record<string, unknown>);
  piezas.variables = env.ok ? 'ok' : 'error';
  piezas.stripe = c.env.STRIPE_SECRET_KEY ? 'ok' : 'pendiente';
  piezas.webhookStripe = c.env.STRIPE_WEBHOOK_SECRET ? 'ok' : 'pendiente';
  piezas.correo = !correoConfigurado(c.env) ? 'pendiente' : ultimoErrorCorreo ? 'error' : 'ok';
  piezas.avisosCelular = ultimoErrorAviso ? 'error' : 'ok';
  piezas.sms = !smsConfigurado(c.env) ? 'pendiente' : ultimoErrorSms ? 'error' : 'ok';
  let fechaRespaldo: string | null = null;
  if (!c.env.BUCKET) piezas.respaldo = 'pendiente';
  else {
    fechaRespaldo = await fechaUltimoRespaldo(c.env.BUCKET).catch(() => null);
    piezas.respaldo = ultimoErrorRespaldo ? 'error' : estadoRespaldo(fechaRespaldo);
  }

  const algunError = Object.values(piezas).includes('error');
  return c.json(
    {
      servicio: MARCA.nombre,
      ok: !algunError,
      piezas,
      ultimoRespaldo: fechaRespaldo,
    },
    algunError ? 503 : 200,
  );
});

/** Datos públicos que la landing y las apps leen sin sesión (el WhatsApp de soporte, por ahora). */
app.get('/datos/publico', (c) =>
  c.json(
    {
      whatsapp: c.env.WHATSAPP_SOPORTE ?? '',
      correoSoporte: 'support@tumbite.com',
      stripePublica: c.env.STRIPE_PUBLISHABLE_KEY ?? '',
    },
    200,
    {
      'Cache-Control': 'public, max-age=0, s-maxage=60',
    },
  ),
);

const RUTAS_PUBLICAS = new Set([
  '/',
  '/how-it-works',
  '/privacy',
  '/terms',
  '/restaurant-terms',
  '/driver-terms',
  '/delete-account',
  '/support',
  '/docs',
]);
const esRutaPublica = (rutaConIdioma: string) => {
  // /es/... es la misma página pública en español (el inglés va sin prefijo).
  const ruta =
    rutaConIdioma === '/es' || rutaConIdioma.startsWith('/es/')
      ? rutaConIdioma.slice(3) || '/'
      : rutaConIdioma;
  return RUTAS_PUBLICAS.has(ruta) || /^\/(docs|country|city|food)\//.test(ruta);
};
const DOMINIO = 'tumbite.com';

export function conCanonica(res: Response, href: string): Response {
  if (!res.headers.get('content-type')?.includes('text/html')) return res;
  if (typeof HTMLRewriter === 'undefined') return res;
  return new HTMLRewriter()
    .on('link[rel="canonical"]', {
      element(e) {
        e.setAttribute('href', href);
      },
    })
    .transform(res);
}

/**
 * Todo lo que no es /datos lo sirven los estáticos. Las páginas de la app web
 * (landing, legales, panel) son una sola página: si el archivo no existe, se
 * entrega index.html y el navegador decide qué mostrar.
 */
/** A qué raíz cae una ruta de página que no existe como archivo. */
export function raizDeApp(ruta: string): string {
  for (const base of ['/app', '/driver'])
    if (ruta === base || ruta.startsWith(`${base}/`)) return `${base}/`;
  return '/';
}

app.notFound(async (c) => {
  if (c.req.path.startsWith('/datos/'))
    return c.json(
      {
        error: enIdiomaDePeticion(
          'Esta dirección no existe.',
          idiomaDeLaPeticion((n) => c.req.header(n)),
        ),
      },
      404,
    );
  if (!c.env.ASSETS) return c.text('No encontrado', 404);
  let res = await c.env.ASSETS.fetch(c.req.raw);
  const esPagina =
    (c.req.method === 'GET' || c.req.method === 'HEAD') && !/\.[a-z0-9]+$/i.test(c.req.path);
  if (res.status === 404 && esPagina) {
    // Se pide la raíz «/», no «/index.html»: la plataforma redirige /index.html a / (307)
    // y eso mandaba a la persona a la portada en vez de a la página que pidió.
    // Las apps web viven en /app (cliente) y /driver: sus rutas internas caen en su raíz.
    const raiz = raizDeApp(c.req.path);
    res = await c.env.ASSETS.fetch(
      new Request(new URL(raiz, c.req.url), { method: c.req.method, headers: c.req.raw.headers }),
    );
  }
  let respuesta = new Response(res.body, res);
  // Las conversaciones de tickets (/t/<codigo>) son privadas: ningún buscador las guarda.
  if (c.req.path.startsWith('/t/')) respuesta.headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (esRutaPublica(c.req.path) && res.ok) {
    // Caché de borde para las páginas públicas (sin cookies). El panel nunca se cachea.
    respuesta.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    // La etiqueta canónica dice la dirección de ESTA página (el index.html trae la de la portada
    // para todas; sin esto Google cree que privacidad y términos son copias de la portada).
    respuesta = conCanonica(
      respuesta,
      `https://${DOMINIO}${c.req.path === '/' ? '/' : c.req.path}`,
    );
  }
  return respuesta;
});

app.route('/datos/cuentas', cuentas);
app.route('/datos', catalogo);
app.route('/datos', dinero);
app.route('/datos', pedidos);
app.route('/datos', operacion);
app.route('/datos', regalos);
app.route('/datos', zonas);
app.route('/datos', espera);
app.route('/datos', tickets);
app.route('/datos', franquicias);
app.route('/datos', superadmin);
app.route('/datos', kyc);
app.route('/datos', fotos);
app.route('/', media);
app.route('/datos', respaldo);

app.onError((err, c) => {
  // Cada mensaje sale en el idioma de quien pidió (el inglés es el principal).
  const idioma = idiomaDeLaPeticion((n) => c.req.header(n));
  if (err instanceof ErrorDatos)
    return c.json({ error: enIdiomaDePeticion(err.message, idioma), campo: err.campo }, err.estado);
  console.error('error no controlado', err);
  return c.json(
    {
      error: enIdiomaDePeticion('Algo salió mal de nuestro lado. Ya lo estamos revisando.', idioma),
    },
    500,
  );
});
