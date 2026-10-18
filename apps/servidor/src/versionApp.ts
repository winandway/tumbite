import type { MiddlewareHandler } from 'hono';
import type { Env } from './env';
import type { Variables } from './sesion';
import { enIdiomaDePeticion, idiomaDeLaPeticion } from './mensajesEn';

export const MENSAJE_ACTUALIZAR =
  'Hay una versión nueva de la app. Actualízala desde la tienda para seguir.';

/** «cliente/0.3.1» → { app: 'cliente', version: [0, 3, 1] }; cualquier otra cosa → null. */
export function leerCabeceraApp(valor: string | undefined) {
  const m = /^(cliente|repartidor|restaurante)\/(\d+)\.(\d+)\.(\d+)/.exec(valor ?? '');
  if (!m) return null;
  return { app: m[1]!, version: [Number(m[2]), Number(m[3]), Number(m[4])] as const };
}

/** «cliente=0.2.0,repartidor=0.1.5» (o «0.2.0» para todas) → mínimo por app. */
export function minimosDe(
  valor: string | undefined,
): Map<string, readonly [number, number, number]> {
  const r = new Map<string, readonly [number, number, number]>();
  for (const parte of (valor ?? '').split(',')) {
    const p = parte.trim();
    if (!p) continue;
    const [app, ver] = p.includes('=') ? (p.split('=') as [string, string]) : ['*', p];
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(ver?.trim() ?? '');
    if (m) r.set(app!.trim(), [Number(m[1]), Number(m[2]), Number(m[3])]);
  }
  return r;
}

export function esMenor(a: readonly number[], b: readonly number[]): boolean {
  const [a0 = 0, a1 = 0, a2 = 0] = a;
  const [b0 = 0, b1 = 0, b2 = 0] = b;
  if (a0 !== b0) return a0 < b0;
  if (a1 !== b1) return a1 < b1;
  return a2 < b2;
}

/**
 * Versión mínima de cada app (F16 de la auditoría). Las apps mandan `x-tumbite-app: cliente/0.1.0`;
 * si la variable `APP_VERSION_MINIMA` dice que esa versión ya no sirve, TODA la API responde 426
 * con un mensaje claro y la app pide actualizar. La web (sin cabecera) y las rutas públicas no se
 * tocan. Sin variable, nada cambia.
 */
export const versionMinimaApp: MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> = async (c, next) => {
  const minimos = minimosDe(c.env.APP_VERSION_MINIMA);
  if (!minimos.size) return next();
  const cab = leerCabeceraApp(c.req.header('x-tumbite-app'));
  if (!cab) return next();
  const minimo = minimos.get(cab.app) ?? minimos.get('*');
  if (!minimo || !esMenor(cab.version, minimo)) return next();
  return c.json(
    {
      error: enIdiomaDePeticion(
        MENSAJE_ACTUALIZAR,
        idiomaDeLaPeticion((n) => c.req.header(n)),
      ),
      campo: 'version',
      actualizar: true,
    },
    426,
  );
};
