import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import {
  PERFILES_INTERNOS,
  PERMISOS_INTERNOS,
  type PerfilInterno,
  alcanceDeRuta,
  alcanceEsTotal,
  esDelicado,
  permisoDeRuta,
  puedeVer,
} from '@tumbite/compartido';
import type { Env } from '../env';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import {
  type AccesoEnSesion,
  accesoDe,
  esDueno,
  renovarSesionesDe,
  enmascararRespuesta,
  exigirObjetoEnAlcance,
  tienePermiso,
} from '../accesoInterno';
import { exigirSegundoFactor } from '../segundoFactor';
import { guardarError } from '../errores';
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

/**
 * C-PERMISOS-FINOS (MON-5, 15 nov 2026): va delante de TODAS las rutas /datos/admin/*. Cada ruta
 * declara su permiso en `PERMISOS_RUTAS_ADMIN` (compartido, un solo lugar), también las lecturas; la
 * persona lo tiene o recibe 403. Los permisos vienen de la sesión (cero lecturas de más). Además:
 * - fichas de pedidos, tickets y viajes fuera del alcance (ciudad, país, servicio) → 404;
 * - con el segundo factor encendido, los permisos delicados piden el código;
 * - teléfonos y correos salen enmascarados en las respuestas (se ven con «Ver dato» y su permiso);
 * - cada cambio queda en `acciones_equipo` (C-ROLES-INTERNOS).
 */
export const permisosInternos: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (
  c,
  next,
) => {
  const u = c.get('usuario');
  if (!u || u.rol !== 'admin' || !c.env.DB) return next();
  const db = c.env.DB;
  const acceso = u.interno;
  const metodo = c.req.method;
  const ruta = permisoDeRuta(metodo, c.req.path);
  // Una ruta sin permiso declarado no se abre a nadie (la prueba del mapa la pone en rojo antes).
  if (!ruta)
    throw new ErrorDatos(
      'Esta ruta del equipo no tiene permiso declarado. Avísale al equipo técnico.',
      undefined,
      403,
    );
  if (!puedeVer(acceso, ruta.permiso)) {
    // Un intento de cambio sin permiso también queda anotado (con su 403): es lo que más importa auditar.
    if (metodo !== 'GET' && metodo !== 'HEAD')
      await anotarAccion(db, u.id, acceso, metodo, c.req.path, 403);
    throw new ErrorDatos(
      'Tu acceso del equipo no incluye esto. Pídeselo a quien gestiona el equipo.',
      'permiso',
      403,
    );
  }
  if (acceso && esDelicado(ruta.permiso)) await exigirSegundoFactor(c, acceso);
  await comprobarAlcanceDeFicha(c, db, metodo, ruta.patron);
  await next();
  if (metodo === 'GET' || metodo === 'HEAD') {
    await enmascararSiToca(c, ruta.patron);
    return;
  }
  // C-CIUDAD-JUEGO: el latido de la ciudad de pruebas llega cada pocos segundos mientras la
  // pantalla está abierta; anotarlo sería una fila por latido (encender y apagar sí se anotan).
  if (c.req.path === '/datos/admin/ciudad-pruebas/latido') return;
  // C-FILTROS-GUARDADOS: guardar los filtros propios no es una acción sobre el negocio; anotarlo
  // duplicaría cada escritura (la preferencia ya dice quién y cuándo).
  if (c.req.path.startsWith('/datos/admin/preferencias/')) return;
  await anotarAccion(db, u.id, acceso, metodo, c.req.path, c.res.status);
};

export function anotarAccion(
  db: D1Database,
  usuarioId: string,
  acceso: AccesoEnSesion | undefined,
  metodo: string,
  ruta: string,
  estado: number,
) {
  return db
    .prepare(
      'INSERT INTO acciones_equipo (usuario_id, perfil, metodo, ruta, estado) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(usuarioId, origenCorto(acceso), metodo, ruta.slice(0, 300), estado)
    .run()
    .catch(async (e: unknown) => {
      // C-PERMISOS-FINOS: un registro de acciones que falla no puede quedar solo en la consola:
      // va a los errores del servidor, que el canario muestra («errores: pendiente»).
      console.error('equipo: no se pudo anotar la acción', e);
      await guardarError(db, metodo, `equipo:acciones:${ruta}`, e, usuarioId).catch((x: unknown) =>
        console.error('equipo: tampoco se pudo guardar el error', x),
      );
    });
}

/** Lo que se anota como «perfil» en el registro: el viejo o las plantillas de la persona. */
function origenCorto(acceso: AccesoEnSesion | undefined): string {
  if (!acceso) return 'total';
  if (acceso.dueno) return 'total';
  if (acceso.origen.startsWith('legado:')) return acceso.origen.slice('legado:'.length);
  const plantillas = new Set(Object.values(acceso.fuentes).flat());
  return [...plantillas].join('+').slice(0, 60) || 'ninguna';
}

/** Rutas cuyas respuestas no se enmascaran: las del propio equipo (son cuentas internas). */
const SIN_ENMASCARAR = [
  '/admin/equipo',
  '/admin/mis-avisos',
  '/admin/preferencias',
  '/admin/ruta',
  // C-AYUDA-INTERNA: texto de las guías, sin datos de nadie (los ejemplos ya vienen tapados).
  '/admin/ayuda',
];

async function enmascararSiToca(c: Ctx, patron: string) {
  if (SIN_ENMASCARAR.some((p) => patron === p || patron.startsWith(`${p}/`))) return;
  // Los correos de los gerentes de franquicia son datos personales como cualquier otro: se ven
  // completos solo con `clientes.datos_personales` o con el permiso que gestiona las franquicias
  // (`config.editar`: agregar y quitar miembros va por su correo). El resto los ve enmascarados.
  if (
    patron.startsWith('/admin/franquicias') &&
    (tienePermiso(c, 'clientes.datos_personales') || tienePermiso(c, 'config.editar'))
  )
    return;
  if (!(c.res.headers.get('content-type') ?? '').includes('application/json')) return;
  // Quien atiende emergencias de viaje necesita llamar: ve el contacto de quien pidió ayuda.
  const conservar = new Set<string>(
    patron === '/admin/viajes' && tienePermiso(c, 'viajes.emergencias') ? ['emergencias'] : [],
  );
  let cuerpo: unknown;
  try {
    cuerpo = await c.res.clone().json();
  } catch {
    return;
  }
  const limpio = enmascararRespuesta(cuerpo, conservar);
  const headers = new Headers(c.res.headers);
  headers.delete('content-length');
  c.res = new Response(JSON.stringify(limpio), { status: c.res.status, headers });
}

/**
 * Una ficha (o un cambio sobre UN objeto) fuera del alcance de la persona: como si no existiera. El
 * objeto y el trozo de la ruta con su id salen de `ALCANCE_RUTAS_ADMIN` (un solo lugar): una ruta
 * nueva sobre un pedido, un viaje, un ticket, una persona o un comercio queda cubierta al declararla.
 */
async function comprobarAlcanceDeFicha(c: Ctx, db: D1Database, metodo: string, patron: string) {
  const acceso = accesoDe(c);
  if (!acceso || alcanceEsTotal(acceso.alcance)) return;
  const a = alcanceDeRuta(metodo, patron);
  if (a?.modo !== 'ficha') return;
  const partesPatron = patron.split('/').filter(Boolean);
  const partesRuta = c.req.path
    .replace(/^\/datos(?=\/)/, '')
    .split('/')
    .filter(Boolean);
  const id = decodeURIComponent(partesRuta.at(partesPatron.indexOf(`:${a.param}`)) ?? '');
  // Si no existe, la propia ruta dirá «no existe»; si existe y no le toca, lo mismo.
  await exigirObjetoEnAlcance(db, acceso, a.objeto, id);
}

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
  // El perfil viejo vale para las cuentas sin plantillas nuevas. Dar «Total» exige tenerlo todo
  // (nadie da más permisos de los que tiene); el permiso de la ruta ya es `equipo.gestionar`.
  const id = c.req.param('id');
  if (id === u.id)
    throw new ErrorDatos(
      'No puedes cambiar tu propio perfil. Pídeselo a otra cuenta Total.',
      undefined,
      409,
    );
  const { perfil } = await leerCuerpo(c, z.object({ perfil: z.enum(PERFILES_INTERNOS) }));
  if (perfil === 'total' && (u.interno?.permisos.length ?? 0) < PERMISOS_INTERNOS.length)
    throw new ErrorDatos(
      'No puedes dar más permisos de los que tienes. Pídeselo a una cuenta con acceso Total.',
      undefined,
      403,
    );
  const destino = await db
    .prepare("SELECT id, correo FROM usuarios WHERE id = ? AND rol = 'admin'")
    .bind(id)
    .first<{ id: string; correo: string }>();
  if (!destino) throw new ErrorDatos('Esa cuenta no es del equipo.', undefined, 404);
  if (esDueno(c.env, destino.correo))
    throw new ErrorDatos('La cuenta del dueño siempre tiene acceso Total.', undefined, 409);
  await db.batch([
    db
      .prepare(
        `INSERT INTO perfiles_internos (usuario_id, perfil, actualizado_por) VALUES (?, ?, ?)
         ON CONFLICT(usuario_id) DO UPDATE SET perfil = excluded.perfil, actualizado_por = excluded.actualizado_por, actualizado_en = datetime('now')`,
      )
      .bind(id, perfil, u.id),
    // C-PERMISOS-FINOS: el cambio vale desde su próxima petición, sin esperar a que vuelva a entrar.
    renovarSesionesDe(db, id),
  ]);
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
