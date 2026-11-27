import type { MiddlewareHandler } from 'hono';
import { PREFIJO_VISTA_PREVIA, esHostVistaPrevia } from '@tumbite/compartido';
import type { Env } from './env';

/**
 * C-VISTA-PREVIA-RAMA (26 nov 2026) — todos los países. Cada rama «fase-*» se prueba en su propia
 * vista previa de Cloudflare (divoox-preview-<rama>.windoce1.workers.dev) con su PROPIA base D1.
 *
 * Candado: una vista previa nunca puede atender con la base de producción ni con la del sitio de
 * pruebas compartido. Al crear la base, el guion de vistas previas le escribe una marca en `config`
 * (`vista_previa_base` = nombre de la base). Aquí, en un dominio de vista previa, se exige que:
 *   - el worker diga el nombre de su base (VISTA_PREVIA_BASE) y empiece por «divoox-preview-»;
 *   - la base tenga esa misma marca.
 * Producción y el sitio compartido nunca tienen esa marca: si por error una vista previa quedara
 * conectada a una de ellas, responde 503 a todo y no lee ni escribe nada más.
 * Fuera de un dominio de vista previa esto no hace nada.
 */
export const CLAVE_MARCA_VISTA_PREVIA = 'vista_previa_base';

/**
 * Las rutas internas de pruebas (diagnóstico, guiones, restaurar respaldos) solo existen en el sitio de
 * pruebas compartido, en la computadora y en las vistas previas por rama (estas, además, con el
 * candado de su base de arriba). En producción, nunca.
 */
export function esHostDePruebasInternas(fijos: ReadonlySet<string>, host: string): boolean {
  return fijos.has(host) || esHostVistaPrevia(host);
}

let confirmada: string | null = null;

/** Solo para pruebas: olvida la base ya confirmada en este proceso. */
export function olvidarVistaPreviaConfirmada(): void {
  confirmada = null;
}

export async function baseDeVistaPreviaValida(
  env: Pick<Env, 'DB' | 'VISTA_PREVIA_BASE'>,
): Promise<string | null> {
  const nombre = env.VISTA_PREVIA_BASE ?? '';
  if (!nombre.startsWith(PREFIJO_VISTA_PREVIA))
    return 'el worker no dice cuál es su base de vista previa';
  if (!env.DB) return 'la vista previa no tiene base';
  if (confirmada === nombre) return null;
  const fila = await env.DB.prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(CLAVE_MARCA_VISTA_PREVIA)
    .first<{ valor: string }>()
    .catch(() => null);
  if (fila?.valor !== nombre) return 'la base conectada no es la base de esta vista previa';
  confirmada = nombre;
  return null;
}

export const candadoVistaPrevia: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (!esHostVistaPrevia(new URL(c.req.url).host)) return next();
  const problema = await baseDeVistaPreviaValida(c.env);
  if (problema) {
    console.error(`vista previa: ${problema}; no se atiende nada`);
    return c.json({ error: `Vista previa bloqueada: ${problema}.` }, 503);
  }
  return next();
};
