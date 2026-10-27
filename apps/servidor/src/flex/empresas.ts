import { Hono } from 'hono';
import { z } from 'zod';
import { PERMISOS_CLAVE_API, type PermisoFlex, type RolEmpresa } from '@tumbite/compartido';
import { enviarCorreo } from '../correo';
import { nuevoToken, sha256 } from '../cripto';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import {
  type ActorFlex,
  actorDeEmpresa,
  conIdempotencia,
  exigirPermiso,
  nuevoIdFlex,
  sentenciaAuditoria,
  tieneCorreoConfirmado,
} from './autorizacion';

/**
 * Divoox Flex · empresas, miembros, invitaciones, centros, conductores y claves de API.
 * Todo se comprueba en el servidor: una persona entra a una empresa SOLO por una fila en
 * empresa_miembros (nunca por su correo), y esa fila nace al crear la empresa o al ACEPTAR una
 * invitación con correo confirmado. Las claves de API no pueden tocar miembros ni dinero.
 */
export const flexEmpresas = new Hono<{ Bindings: Env; Variables: Variables }>();

const PAISES = ['US', 'CO', 'VE', 'MX'] as const;
const MONEDAS = ['USD', 'COP', 'VES', 'MXN'] as const;
const texto = (max: number) => z.string().trim().min(1).max(max);
const esquemaEmpresa = z.object({
  nombre: texto(120),
  razonSocial: z.string().trim().max(160).default(''),
  pais: z.enum(PAISES),
  moneda: z.enum(MONEDAS),
});
const esquemaEmpresaCambio = esquemaEmpresa.partial().extend({
  estado: z.enum(['activa', 'pausada']).optional(),
});
const ROLES_INVITABLES = ['operaciones', 'operador', 'finanzas', 'api'] as const;
const esquemaInvitacion = z.object({
  correo: z.email().max(254),
  rol: z.enum(ROLES_INVITABLES),
});
const esquemaMiembroCambio = z.object({
  rol: z.enum(ROLES_INVITABLES).optional(),
  estado: z.enum(['activo', 'retirado']).optional(),
});
const esquemaCentro = z.object({
  nombre: texto(120),
  direccion: texto(300),
  pais: z.enum(PAISES),
  ciudad: texto(80),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  zonaHoraria: z.string().trim().min(3).max(64).default('America/New_York'),
});
const esquemaCentroCambio = esquemaCentro.partial().extend({
  estado: z.enum(['activo', 'inactivo']).optional(),
});
const esquemaConductor = z.object({
  correo: z.email().max(254),
  vinculo: z.enum(['propio', 'red', 'hibrido']),
});
const esquemaConductorCambio = z.object({
  vinculo: z.enum(['propio', 'red', 'hibrido']).optional(),
  estado: z.enum(['activo', 'retirado']).optional(),
});
// Los permisos que no caben en una clave se descartan (nunca miembros, claves ni dinero).
const esquemaClave = z.object({
  nombre: texto(80),
  permisos: z.array(z.string().max(40)).min(1).max(20),
});

const DIAS_INVITACION = 7;

const sitio = (env: Env) => (env.SITIO_URL ?? 'https://divoox.com').replace(/\/$/, '');

/** Solo una persona con sesión (nunca una clave de API) puede tocar miembros, claves y conductores. */
function soloPersona(actor: ActorFlex) {
  if (actor.actorTipo !== 'usuario')
    throw new ErrorDatos('Una clave de API no puede hacer esto.', undefined, 403);
}

const filaEmpresa = (f: Record<string, unknown>) => ({
  id: f.id,
  nombre: f.nombre,
  razonSocial: f.razon_social,
  pais: f.pais,
  moneda: f.moneda,
  estado: f.estado,
  creadoEn: f.creado_en,
});

// ───────────────────────────── Empresas ─────────────────────────────

/** Crear una empresa: quien la crea es su dueño. Solo con sesión; Idempotency-Key obligatoria. */
flexEmpresas.post('/empresas', async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(c, esquemaEmpresa);
  const db = base(c);
  if (!(await tieneCorreoConfirmado(db, u.id)))
    throw new ErrorDatos(
      'Confirma tu correo antes de crear una empresa (te mandamos un enlace al registrarte).',
      undefined,
      403,
    );
  const id = nuevoIdFlex();
  // La idempotencia se guarda bajo la empresa nueva: la clave viaja con el actor «dueño».
  const actor: ActorFlex = {
    empresaId: id,
    permisos: [],
    actorId: u.id,
    actorTipo: 'usuario',
    rol: 'dueno',
    idioma: u.idioma === 'es' ? 'es' : 'en',
  };
  // Para que la misma clave devuelva la misma empresa, la reserva se hace por persona (empresa_id = u.id).
  return conIdempotencia(c, { ...actor, empresaId: `persona:${u.id}` }, d, async () => {
    await db.batch([
      db
        .prepare(
          'INSERT INTO empresas (id, nombre, razon_social, pais, moneda, dueno_id) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(id, d.nombre, d.razonSocial, d.pais, d.moneda, u.id),
      db
        .prepare(
          "INSERT INTO empresa_miembros (empresa_id, usuario_id, rol) VALUES (?, ?, 'dueno')",
        )
        .bind(id, u.id),
      sentenciaAuditoria(db, actor, 'empresa.crear', id, { nombre: d.nombre, pais: d.pais }),
    ]);
    const f = await db
      .prepare('SELECT * FROM empresas WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();
    return { estado: 201, datos: { empresa: filaEmpresa(f ?? {}), rol: 'dueno' } };
  });
});

/** Las empresas de la persona con sesión (donde es miembro activo). */
flexEmpresas.get('/empresas', async (c) => {
  const u = exigir(c);
  const { results } = await base(c)
    .prepare(
      `SELECT e.*, m.rol FROM empresa_miembros m JOIN empresas e ON e.id = m.empresa_id
       WHERE m.usuario_id = ? AND m.estado = 'activo' AND e.estado <> 'cerrada' ORDER BY e.nombre`,
    )
    .bind(u.id)
    .all<Record<string, unknown>>();
  return c.json({ empresas: results.map((f) => ({ ...filaEmpresa(f), rol: f.rol })) });
});

flexEmpresas.get('/empresas/:id', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'empresa.ver');
  const db = base(c);
  const f = await db
    .prepare('SELECT * FROM empresas WHERE id = ?')
    .bind(actor.empresaId)
    .first<Record<string, unknown>>();
  if (!f) throw new ErrorDatos('Esa empresa no existe.', undefined, 404);
  const n = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM empresa_centros WHERE empresa_id = ?1 AND estado = 'activo') AS centros,
        (SELECT COUNT(*) FROM empresa_miembros WHERE empresa_id = ?1 AND estado = 'activo') AS miembros,
        (SELECT COUNT(*) FROM empresa_conductores WHERE empresa_id = ?1 AND estado = 'activo') AS conductores,
        (SELECT COUNT(*) FROM envios WHERE empresa_id = ?1) AS envios,
        (SELECT COUNT(*) FROM paquetes WHERE empresa_id = ?1) AS paquetes,
        (SELECT COUNT(*) FROM paquetes WHERE empresa_id = ?1 AND estado = 'entregado') AS entregados,
        (SELECT COUNT(*) FROM paquetes WHERE empresa_id = ?1 AND estado NOT IN ('entregado','devuelto','cancelado')) AS pendientes`,
    )
    .bind(actor.empresaId)
    .first<Record<string, number>>();
  return c.json({
    empresa: filaEmpresa(f),
    rol: actor.rol,
    permisos: actor.permisos,
    actor: actor.actorTipo,
    resumen: n,
  });
});

flexEmpresas.patch('/empresas/:id', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'empresa.editar');
  soloPersona(actor);
  const d = await leerCuerpo(c, esquemaEmpresaCambio);
  const db = base(c);
  const antes = await db
    .prepare('SELECT * FROM empresas WHERE id = ?')
    .bind(actor.empresaId)
    .first<Record<string, unknown>>();
  await db.batch([
    db
      .prepare(
        `UPDATE empresas SET nombre = COALESCE(?, nombre), razon_social = COALESCE(?, razon_social),
         pais = COALESCE(?, pais), moneda = COALESCE(?, moneda), estado = COALESCE(?, estado),
         actualizado_en = datetime('now') WHERE id = ?`,
      )
      .bind(
        d.nombre ?? null,
        d.razonSocial ?? null,
        d.pais ?? null,
        d.moneda ?? null,
        d.estado ?? null,
        actor.empresaId,
      ),
    sentenciaAuditoria(db, actor, 'empresa.editar', actor.empresaId, {
      antes: filaEmpresa(antes ?? {}),
      cambio: d,
    }),
  ]);
  const f = await db
    .prepare('SELECT * FROM empresas WHERE id = ?')
    .bind(actor.empresaId)
    .first<Record<string, unknown>>();
  return c.json({ empresa: filaEmpresa(f ?? {}) });
});

flexEmpresas.get('/empresas/:id/auditoria', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'miembros.gestionar');
  const { results } = await base(c)
    .prepare(
      `SELECT a.id, a.actor_tipo, a.accion, a.objeto, a.detalle_json, a.creado_en, u.nombre AS actor_nombre
       FROM empresa_auditoria a LEFT JOIN usuarios u ON u.id = a.actor_id AND a.actor_tipo = 'usuario'
       WHERE a.empresa_id = ? ORDER BY a.id DESC LIMIT 200`,
    )
    .bind(actor.empresaId)
    .all<Record<string, unknown>>();
  return c.json({
    eventos: results.map((f) => ({
      id: f.id,
      actorTipo: f.actor_tipo,
      actor: f.actor_nombre ?? (f.actor_tipo === 'api' ? 'API' : 'Sistema'),
      accion: f.accion,
      objeto: f.objeto,
      detalle: JSON.parse(String(f.detalle_json)),
      creadoEn: f.creado_en,
    })),
  });
});

// ───────────────────────────── Miembros e invitaciones ─────────────────────────────

flexEmpresas.get('/empresas/:id/miembros', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'miembros.gestionar');
  soloPersona(actor);
  const db = base(c);
  const miembros = await db
    .prepare(
      `SELECT m.usuario_id, m.rol, m.estado, m.desde, u.nombre, u.correo FROM empresa_miembros m
       JOIN usuarios u ON u.id = m.usuario_id WHERE m.empresa_id = ? ORDER BY m.desde`,
    )
    .bind(actor.empresaId)
    .all<Record<string, unknown>>();
  const invitaciones = await db
    .prepare(
      `SELECT id, correo, rol, estado, expira_en, creado_en FROM empresa_invitaciones
       WHERE empresa_id = ? ORDER BY creado_en DESC LIMIT 100`,
    )
    .bind(actor.empresaId)
    .all<Record<string, unknown>>();
  return c.json({
    miembros: miembros.results.map((m) => ({
      usuarioId: m.usuario_id,
      nombre: m.nombre,
      correo: m.correo,
      rol: m.rol,
      estado: m.estado,
      desde: m.desde,
    })),
    invitaciones: invitaciones.results.map((i) => ({
      id: i.id,
      correo: i.correo,
      rol: i.rol,
      estado:
        i.estado === 'pendiente' &&
        String(i.expira_en) < new Date().toISOString().slice(0, 19).replace('T', ' ')
          ? 'vencida'
          : i.estado,
      expiraEn: i.expira_en,
      creadoEn: i.creado_en,
    })),
  });
});

/** Cambiar el rol de un miembro o retirarlo. El dueño no se toca por aquí. */
flexEmpresas.patch('/empresas/:id/miembros/:usuarioId', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'miembros.gestionar');
  soloPersona(actor);
  const d = await leerCuerpo(c, esquemaMiembroCambio);
  const db = base(c);
  const objetivo = c.req.param('usuarioId');
  const m = await db
    .prepare('SELECT rol FROM empresa_miembros WHERE empresa_id = ? AND usuario_id = ?')
    .bind(actor.empresaId, objetivo)
    .first<{ rol: RolEmpresa }>();
  if (!m) throw new ErrorDatos('Esa persona no está en el equipo.', undefined, 404);
  if (m.rol === 'dueno')
    throw new ErrorDatos('El dueño de la empresa no se cambia por aquí.', undefined, 409);
  await db.batch([
    db
      .prepare(
        "UPDATE empresa_miembros SET rol = COALESCE(?, rol), estado = COALESCE(?, estado), actualizado_en = datetime('now') WHERE empresa_id = ? AND usuario_id = ?",
      )
      .bind(d.rol ?? null, d.estado ?? null, actor.empresaId, objetivo),
    sentenciaAuditoria(db, actor, 'miembro.cambiar', objetivo, d),
  ]);
  return c.json({ ok: true });
});

/** Invitar: token aleatorio que viaja por correo; en la base solo queda su hash. Vence en 7 días. */
flexEmpresas.post('/empresas/:id/invitaciones', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'miembros.gestionar');
  soloPersona(actor);
  const d = await leerCuerpo(c, esquemaInvitacion);
  const db = base(c);
  const yaMiembro = await db
    .prepare(
      `SELECT 1 FROM empresa_miembros m JOIN usuarios u ON u.id = m.usuario_id
       WHERE m.empresa_id = ? AND u.correo = ? AND m.estado = 'activo'`,
    )
    .bind(actor.empresaId, d.correo)
    .first();
  if (yaMiembro) throw new ErrorDatos('Esa persona ya está en el equipo.', 'correo', 409);
  const token = nuevoToken();
  const id = nuevoIdFlex();
  const empresa = await db
    .prepare('SELECT nombre FROM empresas WHERE id = ?')
    .bind(actor.empresaId)
    .first<{ nombre: string }>();
  await db.batch([
    // Una invitación pendiente por correo y empresa: la anterior se revoca sola.
    db
      .prepare(
        "UPDATE empresa_invitaciones SET estado = 'revocada', revocada_en = datetime('now') WHERE empresa_id = ? AND correo = ? AND estado = 'pendiente'",
      )
      .bind(actor.empresaId, d.correo),
    db
      .prepare(
        `INSERT INTO empresa_invitaciones (id, empresa_id, correo, rol, token_hash, expira_en, emisor_id)
         VALUES (?, ?, ?, ?, ?, datetime('now', '+${DIAS_INVITACION} days'), ?)`,
      )
      .bind(id, actor.empresaId, d.correo, d.rol, await sha256(token), actor.actorId),
    sentenciaAuditoria(db, actor, 'invitacion.crear', id, { correo: d.correo, rol: d.rol }),
  ]);
  const enlace = `${sitio(c.env)}/panel/business/invite/${token}`;
  const en = actor.idioma === 'en';
  const nombreEmpresa = empresa?.nombre ?? 'Divoox';
  const correo = await enviarCorreo(c.env, {
    de: 'hola',
    para: d.correo,
    idioma: actor.idioma,
    asunto: en
      ? `${nombreEmpresa} invited you to Divoox Flex`
      : `${nombreEmpresa} te invitó a Divoox Flex`,
    texto: en
      ? `Hi,\n\n${nombreEmpresa} invited you to join its team on Divoox Flex as ${d.rol}. Sign in with this same email (and confirm it) and then open the link to accept. It expires in ${DIAS_INVITACION} days and works once:\n\n${enlace}\n\nIf you weren't expecting this, you can ignore it.`
      : `Hola.\n\n${nombreEmpresa} te invitó a su equipo en Divoox Flex con el rol ${d.rol}. Entra con este mismo correo (y confírmalo) y luego abre el enlace para aceptar. Vence en ${DIAS_INVITACION} días y sirve una sola vez:\n\n${enlace}\n\nSi no esperabas esto, ignora este correo.`,
  });
  return c.json(
    { invitacion: { id, correo: d.correo, rol: d.rol }, correoEnviado: correo.ok },
    201,
  );
});

flexEmpresas.delete('/empresas/:id/invitaciones/:invId', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'miembros.gestionar');
  soloPersona(actor);
  const db = base(c);
  const r = await db
    .prepare(
      "UPDATE empresa_invitaciones SET estado = 'revocada', revocada_en = datetime('now') WHERE id = ? AND empresa_id = ? AND estado = 'pendiente'",
    )
    .bind(c.req.param('invId'), actor.empresaId)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Esa invitación no está pendiente.', undefined, 404);
  await sentenciaAuditoria(db, actor, 'invitacion.revocar', c.req.param('invId')).run();
  return c.json({ ok: true });
});

type FilaInvitacion = {
  id: string;
  empresa_id: string;
  correo: string;
  rol: RolEmpresa;
  estado: string;
  expira_en: string;
  nombre: string;
};

async function invitacionPorToken(db: D1Database, token: string): Promise<FilaInvitacion> {
  const f = await db
    .prepare(
      `SELECT i.id, i.empresa_id, i.correo, i.rol, i.estado, i.expira_en, e.nombre
       FROM empresa_invitaciones i JOIN empresas e ON e.id = i.empresa_id WHERE i.token_hash = ?`,
    )
    .bind(await sha256(token))
    .first<FilaInvitacion>();
  if (!f) throw new ErrorDatos('Esta invitación no existe o ya no sirve.', undefined, 404);
  return f;
}

const vencida = (f: FilaInvitacion) =>
  f.expira_en < new Date().toISOString().slice(0, 19).replace('T', ' ');

/** Ver qué dice la invitación antes de aceptar (con sesión: el token solo lo tiene el invitado). */
flexEmpresas.get('/invitaciones/:token', async (c) => {
  const u = exigir(c);
  const db = base(c);
  const f = await invitacionPorToken(db, c.req.param('token'));
  return c.json({
    invitacion: {
      empresa: f.nombre,
      rol: f.rol,
      estado: f.estado === 'pendiente' && vencida(f) ? 'vencida' : f.estado,
      correoCoincide: f.correo.toLowerCase() === u.correo.toLowerCase(),
      correoConfirmado: await tieneCorreoConfirmado(db, u.id),
    },
  });
});

/**
 * Aceptar: sesión + MISMO correo + correo confirmado + pendiente + sin vencer. Uso único: la
 * invitación queda «aceptada» en el mismo lote que crea la membresía.
 */
flexEmpresas.post('/invitaciones/:token/aceptar', async (c) => {
  const u = exigir(c);
  const db = base(c);
  const f = await invitacionPorToken(db, c.req.param('token'));
  if (f.estado !== 'pendiente')
    throw new ErrorDatos('Esta invitación ya se usó o fue revocada.', undefined, 410);
  if (vencida(f)) throw new ErrorDatos('Esta invitación venció. Pide otra.', undefined, 410);
  if (f.correo.toLowerCase() !== u.correo.toLowerCase())
    throw new ErrorDatos(
      'Esta invitación es para otro correo. Entra con la cuenta invitada.',
      undefined,
      403,
    );
  if (!(await tieneCorreoConfirmado(db, u.id)))
    throw new ErrorDatos('Confirma tu correo antes de aceptar la invitación.', undefined, 403);
  const actor = { empresaId: f.empresa_id, actorId: u.id, actorTipo: 'usuario' as const };
  const r = await db.batch([
    // Uso único: solo pasa si sigue pendiente en este instante.
    db
      .prepare(
        "UPDATE empresa_invitaciones SET estado = 'aceptada', aceptada_por = ?, aceptada_en = datetime('now') WHERE id = ? AND estado = 'pendiente'",
      )
      .bind(u.id, f.id),
    db
      .prepare(
        `INSERT INTO empresa_miembros (empresa_id, usuario_id, rol) VALUES (?, ?, ?)
         ON CONFLICT(empresa_id, usuario_id) DO UPDATE SET rol = excluded.rol, estado = 'activo', actualizado_en = datetime('now')`,
      )
      .bind(f.empresa_id, u.id, f.rol),
    sentenciaAuditoria(db, actor, 'invitacion.aceptar', f.id, { rol: f.rol }),
  ]);
  if (!r[0]?.meta.changes) throw new ErrorDatos('Esta invitación ya se usó.', undefined, 410);
  return c.json({ ok: true, empresaId: f.empresa_id, rol: f.rol });
});

// ───────────────────────────── Centros ─────────────────────────────

const filaCentro = (f: Record<string, unknown>) => ({
  id: f.id,
  nombre: f.nombre,
  direccion: f.direccion,
  pais: f.pais,
  ciudad: f.ciudad,
  lat: f.lat,
  lng: f.lng,
  zonaHoraria: f.zona_horaria,
  estado: f.estado,
  creadoEn: f.creado_en,
});

flexEmpresas.get('/empresas/:id/centros', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'empresa.ver');
  const { results } = await base(c)
    .prepare('SELECT * FROM empresa_centros WHERE empresa_id = ? ORDER BY estado, nombre')
    .bind(actor.empresaId)
    .all<Record<string, unknown>>();
  return c.json({ centros: results.map(filaCentro) });
});

flexEmpresas.post('/empresas/:id/centros', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'centros.gestionar');
  const d = await leerCuerpo(c, esquemaCentro);
  const db = base(c);
  return conIdempotencia(c, actor, d, async () => {
    const id = nuevoIdFlex();
    await db.batch([
      db
        .prepare(
          'INSERT INTO empresa_centros (id, empresa_id, nombre, direccion, pais, ciudad, lat, lng, zona_horaria) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          id,
          actor.empresaId,
          d.nombre,
          d.direccion,
          d.pais,
          d.ciudad,
          d.lat ?? null,
          d.lng ?? null,
          d.zonaHoraria,
        ),
      sentenciaAuditoria(db, actor, 'centro.crear', id, { nombre: d.nombre }),
    ]);
    const f = await db
      .prepare('SELECT * FROM empresa_centros WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();
    return { estado: 201, datos: { centro: filaCentro(f ?? {}) } };
  });
});

flexEmpresas.patch('/empresas/:id/centros/:centroId', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'centros.gestionar');
  const d = await leerCuerpo(c, esquemaCentroCambio);
  const db = base(c);
  const id = c.req.param('centroId');
  const r = await db
    .prepare(
      `UPDATE empresa_centros SET nombre = COALESCE(?, nombre), direccion = COALESCE(?, direccion),
       pais = COALESCE(?, pais), ciudad = COALESCE(?, ciudad), lat = COALESCE(?, lat), lng = COALESCE(?, lng),
       zona_horaria = COALESCE(?, zona_horaria), estado = COALESCE(?, estado), actualizado_en = datetime('now')
       WHERE id = ? AND empresa_id = ?`,
    )
    .bind(
      d.nombre ?? null,
      d.direccion ?? null,
      d.pais ?? null,
      d.ciudad ?? null,
      d.lat ?? null,
      d.lng ?? null,
      d.zonaHoraria ?? null,
      d.estado ?? null,
      id,
      actor.empresaId,
    )
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ese centro no existe.', undefined, 404);
  await sentenciaAuditoria(db, actor, 'centro.editar', id, d).run();
  const f = await db
    .prepare('SELECT * FROM empresa_centros WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>();
  return c.json({ centro: filaCentro(f ?? {}) });
});

// ───────────────────────────── Conductores vinculados ─────────────────────────────

flexEmpresas.get('/empresas/:id/conductores', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'conductores.gestionar');
  soloPersona(actor);
  const { results } = await base(c)
    .prepare(
      `SELECT ec.usuario_id, ec.vinculo, ec.estado, ec.desde, u.nombre FROM empresa_conductores ec
       JOIN usuarios u ON u.id = ec.usuario_id WHERE ec.empresa_id = ? ORDER BY ec.desde`,
    )
    .bind(actor.empresaId)
    .all<Record<string, unknown>>();
  // Sin el correo del conductor: la empresa ve el nombre, no los datos de contacto de la cuenta.
  return c.json({
    conductores: results.map((f) => ({
      usuarioId: f.usuario_id,
      nombre: f.nombre,
      vinculo: f.vinculo,
      estado: f.estado,
      desde: f.desde,
    })),
  });
});

/** Vincular un conductor que YA tiene cuenta de repartidor en Divoox (no se crean cuentas). */
flexEmpresas.post('/empresas/:id/conductores', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'conductores.gestionar');
  soloPersona(actor);
  const d = await leerCuerpo(c, esquemaConductor);
  const db = base(c);
  const u = await db
    .prepare(
      "SELECT id, nombre FROM usuarios WHERE correo = ? AND rol = 'repartidor' AND activo = 1",
    )
    .bind(d.correo)
    .first<{ id: string; nombre: string }>();
  if (!u)
    throw new ErrorDatos(
      'No hay una cuenta de repartidor con ese correo. La persona debe crearla primero en Divoox Driver.',
      'correo',
      404,
    );
  await db.batch([
    db
      .prepare(
        `INSERT INTO empresa_conductores (empresa_id, usuario_id, vinculo) VALUES (?, ?, ?)
         ON CONFLICT(empresa_id, usuario_id) DO UPDATE SET vinculo = excluded.vinculo, estado = 'activo', actualizado_en = datetime('now')`,
      )
      .bind(actor.empresaId, u.id, d.vinculo),
    sentenciaAuditoria(db, actor, 'conductor.vincular', u.id, { vinculo: d.vinculo }),
  ]);
  return c.json(
    { conductor: { usuarioId: u.id, nombre: u.nombre, vinculo: d.vinculo, estado: 'activo' } },
    201,
  );
});

flexEmpresas.patch('/empresas/:id/conductores/:usuarioId', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'conductores.gestionar');
  soloPersona(actor);
  const d = await leerCuerpo(c, esquemaConductorCambio);
  const db = base(c);
  const r = await db
    .prepare(
      "UPDATE empresa_conductores SET vinculo = COALESCE(?, vinculo), estado = COALESCE(?, estado), actualizado_en = datetime('now') WHERE empresa_id = ? AND usuario_id = ?",
    )
    .bind(d.vinculo ?? null, d.estado ?? null, actor.empresaId, c.req.param('usuarioId'))
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ese conductor no está vinculado.', undefined, 404);
  await sentenciaAuditoria(db, actor, 'conductor.cambiar', c.req.param('usuarioId'), d).run();
  return c.json({ ok: true });
});

// ───────────────────────────── Claves de API ─────────────────────────────

flexEmpresas.get('/empresas/:id/claves', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'claves.gestionar');
  soloPersona(actor);
  const { results } = await base(c)
    .prepare(
      'SELECT id, nombre, prefijo, permisos, estado, creado_en, revocada_en, ultimo_uso_en, usos FROM empresa_claves WHERE empresa_id = ? ORDER BY creado_en DESC',
    )
    .bind(actor.empresaId)
    .all<Record<string, unknown>>();
  return c.json({
    claves: results.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      prefijo: f.prefijo,
      permisos: JSON.parse(String(f.permisos)),
      estado: f.estado,
      creadoEn: f.creado_en,
      revocadaEn: f.revocada_en,
      ultimoUsoEn: f.ultimo_uso_en,
      usos: f.usos,
    })),
  });
});

/** Crear una clave: se muestra UNA sola vez; la base guarda solo el hash y el prefijo. */
flexEmpresas.post('/empresas/:id/claves', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'claves.gestionar');
  soloPersona(actor);
  const d = await leerCuerpo(c, esquemaClave);
  const db = base(c);
  const secreto = `dvxk_${nuevoToken()}`;
  const prefijo = secreto.slice(0, 12);
  const id = nuevoIdFlex();
  const permisos = [...new Set(d.permisos)].filter((p): p is PermisoFlex =>
    PERMISOS_CLAVE_API.includes(p as PermisoFlex),
  );
  if (!permisos.length)
    throw new ErrorDatos('Elige al menos un permiso válido para la clave.', 'permisos');
  await db.batch([
    db
      .prepare(
        'INSERT INTO empresa_claves (id, empresa_id, nombre, prefijo, clave_hash, permisos, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        id,
        actor.empresaId,
        d.nombre,
        prefijo,
        await sha256(secreto),
        JSON.stringify(permisos),
        actor.actorId,
      ),
    sentenciaAuditoria(db, actor, 'clave.crear', id, { nombre: d.nombre, permisos, prefijo }),
  ]);
  return c.json({ clave: { id, nombre: d.nombre, prefijo, permisos, secreto } }, 201);
});

flexEmpresas.delete('/empresas/:id/claves/:claveId', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'claves.gestionar');
  soloPersona(actor);
  const db = base(c);
  const r = await db
    .prepare(
      "UPDATE empresa_claves SET estado = 'revocada', revocada_en = datetime('now') WHERE id = ? AND empresa_id = ? AND estado = 'activa'",
    )
    .bind(c.req.param('claveId'), actor.empresaId)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Esa clave no existe o ya estaba revocada.', undefined, 404);
  await sentenciaAuditoria(db, actor, 'clave.revocar', c.req.param('claveId')).run();
  return c.json({ ok: true });
});
