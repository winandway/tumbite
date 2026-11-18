import type { Context, MiddlewareHandler } from 'hono';
import type { Rol, Usuario } from '@tumbite/compartido';
import type { Env } from './env';
import { sha256 } from './cripto';
import { ErrorDatos } from './validar';
import { type AccesoEnSesion, accesoGuardado, esDueno, leerAccesoInterno } from './accesoInterno';

export const COOKIE_SESION = 'tumbite_sesion';
export const DIAS_SESION = 30;
/**
 * C-SESION-SE-RENUEVA (18 nov 2026): la sesión de clientes, conductores y restaurantes no vence
 * mientras se usa (como Uber o DiDi): cada uso la deja en `DIAS_SESION` días desde ese momento,
 * pero se escribe como mucho una vez al día por sesión (solo si le quedan menos de
 * `DIAS_RENUEVA_SI_QUEDAN` días). Tope absoluto de vida: `DIAS_TOPE_SESION` desde que se abrió;
 * después hay que volver a entrar. Una sesión vencida hace menos de `DIAS_RESCATE_SESION` días se
 * acepta y se renueva: ningún camino cierra una sesión dejándola vencida (salir, cambio de clave,
 * suspensión, borrar la cuenta y la sesión única del conductor la BORRAN, y la cuenta inactiva no
 * entra), así que una fila vencida solo puede ser una sesión que nadie cerró. El equipo interno
 * (rol admin: superadmin, soporte, managers) NO se renueva: conserva sus 30 días fijos.
 */
export const DIAS_RENUEVA_SI_QUEDAN = 29;
export const DIAS_TOPE_SESION = 180;
export const DIAS_RESCATE_SESION = 7;

/**
 * C-PERMISOS-FINOS: una cuenta del equipo lleva sus permisos efectivos (calculados una vez por
 * sesión) y cuándo confirmó el segundo factor. El resto de las cuentas no lleva nada de esto.
 */
export type UsuarioSesion = Usuario & {
  interno?: AccesoEnSesion;
  segundoFactorEn?: string | null;
  /** La huella de la sesión (el token nunca se guarda): la usa el segundo factor. */
  sesionId?: string;
};
export type Variables = { usuario: UsuarioSesion | null };

/**
 * C-PERMISOS-FINOS: lo que una respuesta devuelve de la persona de la sesión, y nada más: los cinco
 * campos del esquema público (`esquemaUsuario`, lo que usan las apps y el panel). Nunca los permisos
 * calculados, el segundo factor ni la huella de la sesión de una cuenta del equipo (sus permisos van
 * por `GET /datos/admin/equipo/yo`).
 */
export function usuarioPublico(u: UsuarioSesion): Usuario {
  return { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol, idioma: u.idioma };
}
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
    const sesionId = await sha256(token);
    const fila = await c.env.DB.prepare(
      `SELECT u.id, u.nombre, u.correo, u.rol, u.idioma, s.permisos_json, s.segundo_factor_en,
              (s.expira_en < datetime('now', ?2)
                AND s.expira_en < datetime(s.creada_en, ?3)) AS renovar
         FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.id = ?1 AND u.activo = 1
         AND (s.expira_en > datetime('now')
              OR (u.rol != 'admin' AND s.expira_en > datetime('now', ?4)
                  AND datetime(s.creada_en, ?3) > datetime('now')))`,
    )
      .bind(
        sesionId,
        `+${DIAS_RENUEVA_SI_QUEDAN} days`,
        `+${DIAS_TOPE_SESION} days`,
        `-${DIAS_RESCATE_SESION} days`,
      )
      .first<
        Usuario & {
          permisos_json: string | null;
          segundo_factor_en: string | null;
          renovar: number | null;
        }
      >();
    if (fila) {
      const { permisos_json, segundo_factor_en, renovar, ...usuario } = fila;
      // C-SESION-SE-RENUEVA: una escritura al día como mucho (la condición se repite en el UPDATE
      // para que dos peticiones a la vez no escriban dos veces). El equipo interno no se renueva.
      if (renovar && usuario.rol !== 'admin') {
        const r = await c.env.DB.prepare(
          `UPDATE sesiones SET expira_en = MIN(datetime('now', ?2), datetime(creada_en, ?3))
            WHERE id = ?1 AND expira_en < datetime('now', ?4) AND expira_en < datetime(creada_en, ?3)`,
        )
          .bind(
            sesionId,
            `+${DIAS_SESION} days`,
            `+${DIAS_TOPE_SESION} days`,
            `+${DIAS_RENUEVA_SI_QUEDAN} days`,
          )
          .run();
        // En la web la cookie también se alarga (en las apps el token va en la cabecera).
        if (r.meta.changes && !c.req.header('authorization'))
          c.header(
            'Set-Cookie',
            `${COOKIE_SESION}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DIAS_SESION * 86400}`,
          );
      }
      if (usuario.rol !== 'admin') c.set('usuario', usuario);
      else {
        // C-PERMISOS-FINOS: el cálculo vive en la sesión; solo se rehace si falta o cambió algo.
        let interno = accesoGuardado(permisos_json);
        // Si cambió la lista de dueños del sitio (ADMIN_CORREOS), se recalcula (sin leer la base).
        if (interno && interno.dueno !== esDueno(c.env, usuario.correo)) interno = null;
        if (!interno) {
          interno = await leerAccesoInterno(c.env.DB, c.env, usuario);
          if (interno.estado === 'activo')
            await c.env.DB.batch([
              c.env.DB.prepare('UPDATE sesiones SET permisos_json = ? WHERE id = ?').bind(
                JSON.stringify(interno),
                sesionId,
              ),
              // La última entrada al panel, una vez por sesión (no por petición).
              c.env.DB.prepare(
                `INSERT INTO equipo_cuentas (usuario_id, ultima_entrada_en) VALUES (?, datetime('now'))
                 ON CONFLICT(usuario_id) DO UPDATE SET ultima_entrada_en = excluded.ultima_entrada_en`,
              ).bind(usuario.id),
            ]);
        }
        // Suspendida, retirada o vencida: la sesión no sirve (y se cierra).
        if (interno.estado !== 'activo')
          await c.env.DB.prepare('DELETE FROM sesiones WHERE id = ?').bind(sesionId).run();
        else
          c.set('usuario', { ...usuario, interno, segundoFactorEn: segundo_factor_en, sesionId });
      }
    }
  }
  await next();
};

export function exigir(c: Ctx, ...roles: Rol[]): UsuarioSesion {
  const u = c.get('usuario');
  if (!u) throw new ErrorDatos('Tu sesión terminó. Vuelve a entrar.', undefined, 401);
  if (roles.length && !roles.includes(u.rol))
    throw new ErrorDatos('Tu cuenta no tiene permiso para esto.', undefined, 403);
  return u;
}

export { leerToken };
