import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { PERFILES_INTERNOS, type PerfilInterno, permiteAccionInterna } from '@tumbite/compartido';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { TIPOS_AVISO_EQUIPO } from '../avisosEquipo';

/**
 * C-ROLES-INTERNOS (29 oct 2026): perfiles del equipo interno (total, soporte, finanzas, solo
 * lectura) y registro de quién cambió qué. Una cuenta admin sin perfil guardado es «total»: así
 * ninguna cuenta existente pierde acceso.
 */
export const equipo = new Hono<{ Bindings: Env; Variables: Variables }>();

export async function perfilDe(db: D1Database, usuarioId: string): Promise<PerfilInterno> {
  const f = await db
    .prepare('SELECT perfil FROM perfiles_internos WHERE usuario_id = ?')
    .bind(usuarioId)
    .first<{ perfil: PerfilInterno }>();
  return f?.perfil ?? 'total';
}

const NOMBRE = new Map<PerfilInterno, string>(
  Object.entries({
    total: 'Total',
    soporte: 'Soporte',
    finanzas: 'Finanzas',
    lectura: 'Solo lectura',
  }) as [PerfilInterno, string][],
);

/** Va delante de todas las rutas /datos/admin/*: frena lo que el perfil no permite y anota los cambios. */
export const permisosInternos: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (
  c,
  next,
) => {
  const u = c.get('usuario');
  if (!u || u.rol !== 'admin' || !c.env.DB) return next();
  const db = c.env.DB;
  const perfil = await perfilDe(db, u.id);
  const metodo = c.req.method;
  if (!permiteAccionInterna(perfil, metodo, c.req.path))
    throw new ErrorDatos(
      `Tu perfil del equipo (${NOMBRE.get(perfil) ?? perfil}) no permite este cambio. Pídeselo a una cuenta con perfil Total.`,
      undefined,
      403,
    );
  await next();
  if (metodo === 'GET' || metodo === 'HEAD') return;
  await db
    .prepare(
      'INSERT INTO acciones_equipo (usuario_id, perfil, metodo, ruta, estado) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(u.id, perfil, metodo, c.req.path.slice(0, 300), c.res.status)
    .run()
    .catch((e: unknown) => console.error('equipo: no se pudo anotar la acción', e));
};

equipo.get('/admin/equipo', async (c) => {
  const u = exigir(c, 'admin');
  const db = base(c);
  const { results } = await db
    .prepare(
      `SELECT u.id, u.nombre, u.correo, COALESCE(p.perfil, 'total') AS perfil, p.actualizado_en
         FROM usuarios u LEFT JOIN perfiles_internos p ON p.usuario_id = u.id
        WHERE u.rol = 'admin' AND u.activo = 1 ORDER BY u.nombre LIMIT 200`,
    )
    .all<{ id: string; nombre: string; correo: string; perfil: PerfilInterno }>();
  return c.json({ miPerfil: await perfilDe(db, u.id), equipo: results });
});

equipo.get('/admin/equipo/acciones', async (c) => {
  exigir(c, 'admin');
  const { results } = await base(c)
    .prepare(
      `SELECT a.id, a.usuario_id AS usuarioId, u.nombre, a.perfil, a.metodo, a.ruta, a.estado, a.creado_en AS creadoEn
         FROM acciones_equipo a LEFT JOIN usuarios u ON u.id = a.usuario_id ORDER BY a.id DESC LIMIT 200`,
    )
    .all();
  return c.json({ acciones: results });
});

equipo.put('/admin/equipo/:id', async (c) => {
  const u = exigir(c, 'admin');
  const db = base(c);
  if ((await perfilDe(db, u.id)) !== 'total')
    throw new ErrorDatos('Solo una cuenta con perfil Total cambia los perfiles.', undefined, 403);
  const id = c.req.param('id');
  if (id === u.id)
    throw new ErrorDatos(
      'No puedes cambiar tu propio perfil. Pídeselo a otra cuenta Total.',
      undefined,
      409,
    );
  const { perfil } = await leerCuerpo(c, z.object({ perfil: z.enum(PERFILES_INTERNOS) }));
  const destino = await db
    .prepare("SELECT id FROM usuarios WHERE id = ? AND rol = 'admin'")
    .bind(id)
    .first();
  if (!destino) throw new ErrorDatos('Esa cuenta no es del equipo.', undefined, 404);
  await db
    .prepare(
      `INSERT INTO perfiles_internos (usuario_id, perfil, actualizado_por) VALUES (?, ?, ?)
       ON CONFLICT(usuario_id) DO UPDATE SET perfil = excluded.perfil, actualizado_por = excluded.actualizado_por, actualizado_en = datetime('now')`,
    )
    .bind(id, perfil, u.id)
    .run();
  return c.json({ ok: true, id, perfil });
});

/** C-AVISOS-EQUIPO: los avisos por correo de quien mira, por tipo (sin fila = lo de ADMIN_CORREOS). */
equipo.get('/admin/mis-avisos', async (c) => {
  const u = exigir(c, 'admin');
  const { results } = await base(c)
    .prepare('SELECT tipo, activo FROM avisos_equipo WHERE usuario_id = ?')
    .bind(u.id)
    .all<{ tipo: string; activo: number }>();
  const enLista = (c.env.ADMIN_CORREOS ?? '')
    .toLowerCase()
    .split(',')
    .map((x) => x.trim())
    .includes(u.correo.toLowerCase());
  const guardado = new Map(results.map((r) => [r.tipo, Number(r.activo) === 1]));
  return c.json({
    avisos: TIPOS_AVISO_EQUIPO.map((tipo) => ({
      tipo,
      activo: guardado.get(tipo) ?? enLista,
      // El canario nunca se apaga para quien está en la lista fija del sitio.
      fijo: tipo === 'sistema' && enLista,
    })),
  });
});

equipo.put('/admin/mis-avisos', async (c) => {
  const u = exigir(c, 'admin');
  const { tipo, activo } = await leerCuerpo(
    c,
    z.object({ tipo: z.enum(TIPOS_AVISO_EQUIPO), activo: z.boolean() }),
  );
  await base(c)
    .prepare(
      `INSERT INTO avisos_equipo (usuario_id, tipo, activo) VALUES (?, ?, ?)
       ON CONFLICT(usuario_id, tipo) DO UPDATE SET activo = excluded.activo, actualizado_en = datetime('now')`,
    )
    .bind(u.id, tipo, activo ? 1 : 0)
    .run();
  return c.json({ ok: true, tipo, activo });
});
