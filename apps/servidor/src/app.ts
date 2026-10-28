import { DOMINIO_PRINCIPAL, redireccionDominio } from './dominio';
import { guardarError, saludErrores } from './errores';
import { saludBandeja } from './internacional/bandeja';
import { finanzasAdmin } from './finanzas/rutasAdmin';
import { saludBilleteras } from './finanzas/reloj';
import { blindarStripeEnPruebas, entornoDe, problemasDeEntorno } from './entorno';
import { saludRetiros } from './retiros';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { MARCA, direccionNueva, enIdiomaDireccion, panelNuevo } from '@tumbite/compartido';
import { type Env, revisarEnv } from './env';
import { usarStripeLocal } from './stripe';
import { enIdiomaDePeticion, idiomaDeLaPeticion } from './mensajesEn';
import { cabecerasSeguridad, limiteIntentos, limiteIntentosPersistente } from './seguridad';
import { type Variables, cargarSesion } from './sesion';
import { ErrorDatos } from './validar';
import { asegurarEsquema, columnasFaltantes, ultimoErrorEsquema } from './esquema';
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
import { diagnostico } from './rutas/diagnostico';
import { saludServicios, servicios } from './rutas/servicios';
import { buscar } from './rutas/buscar';
import { avisos } from './rutas/avisos';
import { repartidorGrandes } from './rutas/repartidorGrandes';
import { interno, saludTiempoReal } from './rutas/interno';
import { saludReloj } from './reloj';
import { alertarCanario } from './canario';
import { versionMinimaApp } from './versionApp';
import { saludDisputas } from './disputas';
import { internacional } from './rutas/internacional';
import { favoritos } from './rutas/favoritos';
import { flex } from './flex';
import { cupones } from './rutas/cupones';
import { direcciones } from './rutas/direcciones';
import { restauranteMas } from './rutas/restauranteMas';
import { stripeAvisos } from './rutas/stripeAvisos';
import { saludLibro } from './internacional/libro';
import { viajes } from './rutas/viajes';
import { saludViajes, viajesPasajero } from './rutas/viajesPasajero';
import { lugares } from './rutas/lugares';
import { saludExclusividad } from './operaciones';
import { correoConfigurado, ultimoErrorCorreo } from './correo';
import { ultimoErrorAviso } from './notificaciones';
import { smsConfigurado, ultimoErrorSms } from './sms';
import { ultimaConciliacion } from './conciliacion';
import { estadoRespaldo, fechaUltimoRespaldo, respaldo, ultimoErrorRespaldo } from './respaldo';
import { VERSION_SERVIDOR } from './version';
import { saludTransiciones } from './esquemaPedidos';
import { saludCobros } from './liquidaciones';

export const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// C-DOMINIO-DIVOOX: las páginas viven en divoox.com; la API sigue respondiendo en los dos.
app.use('*', async (c, next) => {
  const destino = redireccionDominio(new URL(c.req.url), c.req.method);
  if (destino) return c.redirect(destino, 301);
  await next();
});
app.use('*', cabecerasSeguridad);
// C-ENTORNOS-SEPARADOS: el sitio de pruebas nunca usa una llave real de Stripe.
app.use('*', async (c, next) => {
  blindarStripeEnPruebas(new URL(c.req.url).host, c.env);
  await next();
});
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
  if (/^\/(datos|media|panel|app|driver|restaurant|t)(\/|$)/.test(ruta)) return next();
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
app.use('/datos/cuentas/entrar', limiteIntentosPersistente(10, 60_000));
app.use('/datos/cuentas/registro', limiteIntentosPersistente(10, 60_000));
app.use('/datos/cuentas/recuperar', limiteIntentosPersistente(5, 60_000));
app.use('/datos/cuentas/confirmar/reenviar', limiteIntentos(3, 60_000));
app.use('/datos/cuentas/restablecer', limiteIntentosPersistente(10, 60_000));
app.use('/datos/mi-restaurante/fotos', limiteIntentos(30, 60_000));
app.use('/datos/viajes/cotizar', limiteIntentos(30, 60_000));
app.use('/datos/publico/viaje/*', limiteIntentos(60, 60_000));
// Cada búsqueda de Google cuesta: tope por persona (red).
app.use('/datos/lugares/*', limiteIntentos(40, 60_000));
// F16: una app vieja recibe 426 «actualiza» en toda la API (lo público y la web no se tocan).
app.use('/datos/*', (c, next) =>
  ['/datos/publico', '/datos/version', '/datos/salud'].includes(c.req.path)
    ? next()
    : versionMinimaApp(c, next),
);
app.use('/datos/*', async (c, next) => {
  if (c.env.DB) await asegurarEsquema(c.env.DB, entornoDe(c.req.url));
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
  const entorno = problemasDeEntorno(new URL(c.req.url).host, c.env);
  if (entorno.length) console.error('salud: entorno', entorno.join(' · '));
  piezas.entorno = entorno.length ? 'error' : 'ok';
  if (c.env.DB) piezas.esquema = ultimoErrorEsquema || columnasFaltantes.length ? 'error' : 'ok';

  const env = revisarEnv(c.env as unknown as Record<string, unknown>);
  piezas.variables = env.ok ? 'ok' : 'error';
  piezas.stripe = c.env.STRIPE_SECRET_KEY ? 'ok' : 'pendiente';
  piezas.webhookStripe = c.env.STRIPE_WEBHOOK_SECRET ? 'ok' : 'pendiente';
  piezas.webhookStripeConectadas = c.env.STRIPE_WEBHOOK_SECRET_CONECTADAS ? 'ok' : 'pendiente';
  // Escudo anti-robots: con la secreta sin la pública, la web y las apps no podrían entrar (F5).
  piezas.turnstile = !c.env.TURNSTILE_SECRET_KEY
    ? 'pendiente'
    : c.env.TURNSTILE_SITE_KEY
      ? 'ok'
      : 'error';
  piezas.correo = !correoConfigurado(c.env) ? 'pendiente' : ultimoErrorCorreo ? 'error' : 'ok';
  piezas.avisosCelular = ultimoErrorAviso ? 'error' : 'ok';
  piezas.sms = !smsConfigurado(c.env) ? 'pendiente' : ultimoErrorSms ? 'error' : 'ok';
  if (c.env.DB) {
    const ult = await ultimaConciliacion(c.env.DB).catch(() => null);
    piezas.dinero = !ult ? 'pendiente' : Number(ult.cuadra) === 1 ? 'ok' : 'error';
  }
  // Fase 0: retiros sin doble pago (disparadores puestos, conciliación al día, nada en revisión).
  if (c.env.DB)
    piezas.retiros = await saludRetiros(c.env, c.env.DB).catch((e: unknown) => {
      console.error('salud: retiros', e);
      return 'error' as const;
    });
  // Fase 1: catálogo de servicios (Moto y Carro apagados, disparadores puestos). Moto se admite
  // encendida solo en el sitio de pruebas (C-MOTO-SOLO-PRUEBAS).
  if (c.env.DB)
    piezas.servicios = await saludServicios(c.env.DB, entornoDe(c.req.url)).catch((e: unknown) => {
      console.error('salud: servicios', e);
      return 'error' as const;
    });
  // Divoox Moto · M7: ningún viaje cerrado con comisión apartada ni deudas sin su viaje.
  if (c.env.DB)
    piezas.viajes = await saludViajes(c.env.DB).catch((e: unknown) => {
      console.error('salud: viajes', e);
      return 'error' as const;
    });
  // Fase 2: tiempo real (apagado = «pendiente»; las apps siguen con la consulta normal).
  if (c.env.DB)
    piezas.tiempoReal = await saludTiempoReal(c.env, c.env.DB).catch((e: unknown) => {
      console.error('salud: tiempo real', e);
      return 'pendiente' as const;
    });
  // Fase 3: exclusividad (cero inconsistencias entre pedidos, operaciones y ocupación).
  if (c.env.DB)
    piezas.exclusividad = await saludExclusividad(c.env.DB).catch((e: unknown) => {
      console.error('salud: exclusividad', e);
      return 'error' as const;
    });
  // Reloj seguro: vueltas buenas a tiempo, sin rachas de errores ni tareas críticas fallidas.
  if (c.env.DB)
    piezas.reloj = await saludReloj(c.env, c.env.DB).catch((e: unknown) => {
      console.error('salud: reloj', e);
      return 'error' as const;
    });
  // C-TRANSICIONES-PEDIDO: el disparador que impide los saltos de estado de los pedidos existe.
  if (c.env.DB)
    piezas.transiciones = await saludTransiciones(c.env.DB).catch((e: unknown) => {
      console.error('salud: transiciones', e);
      return 'error' as const;
    });
  // Fase 2: el libro internacional nunca deja un prepago, una reserva ni un fondo de punto en negativo.
  if (c.env.DB)
    piezas.libro = await saludLibro(c.env.DB).catch((e: unknown) => {
      console.error('salud: libro', e);
      return 'error' as const;
    });
  // Disputas (contracargos) sin responder que vencen pronto: rojo para que alguien las atienda.
  if (c.env.DB)
    piezas.disputas = await saludDisputas(c.env.DB).catch((e: unknown) => {
      console.error('salud: disputas', e);
      return 'error' as const;
    });
  // C-ERRORES-VISIBLES: errores no controlados en la última hora («pendiente», para revisar).
  if (c.env.DB)
    piezas.errores = await saludErrores(c.env.DB).catch((e: unknown) => {
      console.error('salud: errores', e);
      return 'error' as const;
    });
  // C-BANDEJA-DINERO: casos del cobro en mano esperando a soporte («pendiente», no es un error).
  if (c.env.DB)
    piezas.bandeja = await saludBandeja(c.env.DB).catch((e: unknown) => {
      console.error('salud: bandeja', e);
      return 'error' as const;
    });
  // C-COBRO-AL-ENTREGAR: ningún cobro de una entrega en revisión ni atrasado más de 2 horas.
  if (c.env.DB)
    piezas.cobros = await saludCobros(c.env.DB).catch((e: unknown) => {
      console.error('salud: cobros', e);
      return 'error' as const;
    });
  // Flex · Fase 4: la última conciliación de las billeteras de empresa no encontró diferencias.
  if (c.env.DB)
    piezas.billeteras = await saludBilleteras(c.env.DB).catch((e: unknown) => {
      console.error('salud: billeteras', e);
      return 'error' as const;
    });
  let fechaRespaldo: string | null = null;
  if (!c.env.BUCKET) piezas.respaldo = 'pendiente';
  else {
    fechaRespaldo = await fechaUltimoRespaldo(c.env.BUCKET).catch(() => null);
    piezas.respaldo = ultimoErrorRespaldo ? 'error' : estadoRespaldo(fechaRespaldo);
  }

  const algunError = Object.values(piezas).includes('error');
  // F11: un correo al equipo cuando una pieza pasa a rojo y otro cuando se recupera.
  if (c.env.DB)
    await alertarCanario(c.env, c.env.DB, piezas).catch((e: unknown) =>
      console.error('salud: alertas del canario', e),
    );
  return c.json(
    {
      servicio: MARCA.nombre,
      ok: !algunError,
      piezas,
      ultimoRespaldo: fechaRespaldo,
      version: VERSION_SERVIDOR,
    },
    algunError ? 503 : 200,
  );
});

/** Versión y commit con que se COMPILÓ este servidor (C-VERSION-DEL-ARTEFACTO). Público: no lleva secretos. */
app.get('/datos/version', (c) =>
  c.json({ servidor: VERSION_SERVIDOR }, 200, { 'Cache-Control': 'no-store' }),
);

/** Datos públicos que la landing y las apps leen sin sesión (el WhatsApp de soporte, por ahora). */
app.get('/datos/publico', (c) =>
  c.json(
    {
      whatsapp: c.env.WHATSAPP_SOPORTE ?? '',
      whatsappVentas: c.env.WHATSAPP_VENTAS ?? '',
      correoSoporte: 'go@windoce.com',
      stripePublica: c.env.STRIPE_PUBLISHABLE_KEY ?? '',
      // Clave pública del escudo anti-robots: vacía = apagado (F5).
      turnstileSitio: c.env.TURNSTILE_SITE_KEY ?? '',
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
  '/flex',
  '/track',
]);
const esRutaPublica = (rutaConIdioma: string) => {
  // /es/... es la misma página pública en español (el inglés va sin prefijo).
  const ruta =
    rutaConIdioma === '/es' || rutaConIdioma.startsWith('/es/')
      ? rutaConIdioma.slice(3) || '/'
      : rutaConIdioma;
  return RUTAS_PUBLICAS.has(ruta) || /^\/(docs|country|city|food)\//.test(ruta);
};
// C-DOMINIO-DIVOOX: la etiqueta canónica que pone el servidor apunta a la dirección principal.
export const urlCanonica = (ruta: string) => `https://${DOMINIO_PRINCIPAL}${ruta}`;

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
  for (const base of ['/app', '/driver', '/restaurant'])
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
    // Las apps web viven en /app (cliente), /driver y /restaurant: sus rutas internas caen en su raíz.
    const raiz = raizDeApp(c.req.path);
    res = await c.env.ASSETS.fetch(
      new Request(new URL(raiz, c.req.url), { method: c.req.method, headers: c.req.raw.headers }),
    );
  }
  let respuesta = new Response(res.body, res);
  // Las conversaciones de tickets (/t/<codigo>) son privadas: ningún buscador las guarda.
  // Igual el viaje compartido (/ride/<codigo>, M6): privado y en vivo.
  if (c.req.path.startsWith('/t/') || c.req.path.startsWith('/ride/'))
    respuesta.headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (esRutaPublica(c.req.path) && res.ok) {
    // Caché de borde para las páginas públicas (sin cookies). El panel nunca se cachea.
    respuesta.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    // La etiqueta canónica dice la dirección de ESTA página (el index.html trae la de la portada
    // para todas; sin esto Google cree que privacidad y términos son copias de la portada).
    respuesta = conCanonica(respuesta, urlCanonica(c.req.path));
  }
  return respuesta;
});

app.route('/datos/cuentas', cuentas);
app.route('/datos', catalogo);
app.route('/datos', dinero);
app.route('/datos', diagnostico);
app.route('/datos', servicios);
app.route('/datos', buscar);
app.route('/datos', avisos);
app.route('/datos', repartidorGrandes);
app.route('/datos', viajes);
app.route('/datos', viajesPasajero);
app.route('/datos', lugares);
app.route('/datos', interno);
app.route('/datos', pedidos);
app.route('/datos', operacion);
app.route('/datos', regalos);
app.route('/datos', zonas);
app.route('/datos', espera);
app.route('/datos', tickets);
app.route('/datos', franquicias);
app.route('/datos', superadmin);
app.route('/datos', internacional);
app.route('/datos', favoritos);
app.route('/datos', cupones);
app.route('/datos', direcciones);
app.route('/datos', restauranteMas);
app.route('/datos', stripeAvisos);
app.route('/datos', kyc);
app.route('/datos', fotos);
app.route('/', media);
app.route('/datos', respaldo);
app.route('/datos/v1/flex', flex);
app.route('/datos', finanzasAdmin);

app.onError(async (err, c) => {
  // Cada mensaje sale en el idioma de quien pidió (el inglés es el principal).
  const idioma = idiomaDeLaPeticion((n) => c.req.header(n));
  if (err instanceof ErrorDatos)
    return c.json({ error: enIdiomaDePeticion(err.message, idioma), campo: err.campo }, err.estado);
  console.error('error no controlado', err);
  // C-ERRORES-VISIBLES: queda escrito para poder diagnosticarlo después (si la base responde).
  if (c.env.DB)
    await guardarError(c.env.DB, c.req.method, c.req.path, err).catch((e: unknown) =>
      console.error('no se pudo guardar el error', e),
    );
  return c.json(
    {
      error: enIdiomaDePeticion('Algo salió mal de nuestro lado. Ya lo estamos revisando.', idioma),
    },
    500,
  );
});
