import type { Context, MiddlewareHandler } from 'hono';
import type { Rol, Usuario } from '@tumbite/compartido';
import type { Env } from './env';
import { sha256 } from './cripto';
import { ErrorDatos } from './validar';

export const COOKIE_SESION = 'tumbite_sesion';
export const DIAS_SESION = 30;

export type Variables = { usuario: Usuario | null };
export type Ctx = Context<{ Bindings: Env; Variables: Variables }>;

function leerToken(c: Context): string | null {
  const auth = c.req.header('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim() || null;
  const cookie = c.req.header('cookie') ?? '';
  const m = cookie.match(new RegExp(`(?:^|; )${COOKIE_SESION}=([^;]+)`));
  return m?.[1] ?? null;
}

export function base(c: Ctx): D1Database {
  if (!c.env.DB)
    throw new ErrorDatos('La base de datos no está disponible en este momento.', undefined, 422);
  return c.env.DB;
}

/** Carga la persona de la sesión (si hay). No bloquea: eso lo hace exigir(). */
export const cargarSesion: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (
  c,
  next,
) => {
  c.set('usuario', null);
  const token = leerToken(c);
  if (token && c.env.DB) {
    const fila = await c.env.DB.prepare(
      `SELECT u.id, u.nombre, u.correo, u.rol, u.idioma FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.id = ? AND s.expira_en > datetime('now') AND u.activo = 1`,
    )
      .bind(await sha256(token))
      .first<Usuario>();
    if (fila) c.set('usuario', fila);
  }
  await next();
};

export function exigir(c: Ctx, ...roles: Rol[]): Usuario {
  const u = c.get('usuario');
  if (!u) throw new ErrorDatos('Tu sesión terminó. Vuelve a entrar.', undefined, 401);
  if (roles.length && !roles.includes(u.rol))
    throw new ErrorDatos('Tu cuenta no tiene permiso para esto.', undefined, 403);
  return u;
}

export { leerToken };
