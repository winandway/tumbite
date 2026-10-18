import type { MiddlewareHandler } from 'hono';
import { enIdiomaDePeticion, idiomaDeLaPeticion } from './mensajesEn';

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
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://api.stripe.com; frame-ancestors 'none'",
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
      const mensaje = 'Demasiados intentos. Espera un momento y vuelve a probar.';
      return c.json(
        {
          error: enIdiomaDePeticion(
            mensaje,
            idiomaDeLaPeticion((n) => c.req.header(n)),
          ),
        },
        429,
      );
    }
    await next();
  };
}

/**
 * Límite de intentos por IP y ruta guardado en la base: sobrevive a que el aislado se reinicie
 * o a que haya varios aislados a la vez (F19 de la auditoría, C-INTENTOS). Sin base, cae al
 * límite en memoria. La tabla se crea sola la primera vez (corre antes del esquema).
 */
export function limiteIntentosPersistente(
  maximo: number,
  ventanaMs: number,
): MiddlewareHandler<{ Bindings: { DB?: D1Database } }> {
  const enMemoria = limiteIntentos(maximo, ventanaMs);
  const tablaLista = new WeakSet<D1Database>();
  const segundos = Math.max(1, Math.round(ventanaMs / 1000));
  return async (c, next) => {
    const db = c.env.DB;
    if (!db) return enMemoria(c, next);
    if (!tablaLista.has(db)) {
      await db
        .prepare(
          "CREATE TABLE IF NOT EXISTS intentos_limite (llave TEXT PRIMARY KEY, cuenta INTEGER NOT NULL DEFAULT 0, desde TEXT NOT NULL DEFAULT (datetime('now')))",
        )
        .run();
      tablaLista.add(db);
    }
    const ip = c.req.header('cf-connecting-ip') ?? 'desconocida';
    const llave = `${ip}:${c.req.path}`;
    const vencida = `datetime('now', '-${segundos} seconds')`;
    const fila = await db
      .prepare(
        `INSERT INTO intentos_limite (llave, cuenta, desde) VALUES (?, 1, datetime('now'))
         ON CONFLICT(llave) DO UPDATE SET
           cuenta = CASE WHEN desde < ${vencida} THEN 1 ELSE cuenta + 1 END,
           desde = CASE WHEN desde < ${vencida} THEN datetime('now') ELSE desde END
         RETURNING cuenta`,
      )
      .bind(llave)
      .first<{ cuenta: number }>();
    if (Number(fila?.cuenta ?? 0) > maximo)
      return c.json(
        {
          error: enIdiomaDePeticion(
            'Demasiados intentos. Espera un momento y vuelve a probar.',
            idiomaDeLaPeticion((n) => c.req.header(n)),
          ),
        },
        429,
      );
    await next();
  };
}
