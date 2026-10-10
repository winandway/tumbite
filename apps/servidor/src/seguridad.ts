import type { MiddlewareHandler } from 'hono';

/** Cabeceras de seguridad en TODAS las respuestas. */
export const cabecerasSeguridad: MiddlewareHandler = async (c, next) => {
  await next();
  // Las respuestas que vienen de los estáticos traen cabeceras de solo lectura:
  // se copian antes de tocarlas (si no, el servidor revienta con un 500).
  try {
    c.res.headers.set('X-Content-Type-Options', 'nosniff');
  } catch {
    c.res = new Response(c.res.body, c.res);
  }
  const h = c.res.headers;
  h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=(self)');
  h.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' https://js.stripe.com https://challenges.cloudflare.com; " +
      "frame-src https://js.stripe.com https://challenges.cloudflare.com; img-src 'self' data: https:; " +
      "style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.stripe.com; frame-ancestors 'none'",
  );
};

/**
 * Límite de intentos por IP y ruta. Vive en memoria del aislado: frena ráfagas
 * de un mismo origen. Para el login y los pagos se refuerza con Turnstile.
 */
export function limiteIntentos(maximo: number, ventanaMs: number): MiddlewareHandler {
  const registro = new Map<string, { cuenta: number; desde: number }>();
  return async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') ?? 'desconocida';
    const llave = `${ip}:${c.req.path}`;
    const ahora = Date.now();
    const r = registro.get(llave);
    if (!r || ahora - r.desde > ventanaMs) {
      registro.set(llave, { cuenta: 1, desde: ahora });
    } else if (++r.cuenta > maximo) {
      return c.json({ error: 'Demasiados intentos. Espera un momento y vuelve a probar.' }, 429);
    }
    await next();
  };
}
