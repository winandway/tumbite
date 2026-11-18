import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { limiteIntentos } from '../seguridad';
import {
  TOPES_REFERIDOS,
  crearEquipo,
  listarEquipos,
  listarProgramas,
  guardarPrograma,
  miembrosDeEquipo,
  misInvitaciones,
  resolverCodigo,
  vincularConductor,
} from '../programaReferidos';

/**
 * C-REFERIDOS-EQUIPOS: las rutas del superadmin (programas y equipos), la página pública de una
 * invitación, «Mi equipo» del conductor y su código de invitación. La lógica vive en
 * `programaReferidos.ts`.
 */
export const programaReferidos = new Hono<{ Bindings: Env; Variables: Variables }>();

/** La dirección pública del sitio (para el enlace de invitación). */
export const sitioPublico = (c: Ctx) => {
  const u = new URL(c.req.url);
  return u.hostname === 'localhost' || u.hostname.endsWith('.localhost')
    ? u.origin
    : `https://${u.hostname}`;
};

const reglasConductor = z.object({
  premio: z.number().int().min(1).max(TOPES_REFERIDOS.premioMaximo),
  carreras: z.number().int().min(1).max(500),
  dias: z.number().int().min(1).max(365),
  topeMes: z.number().int().min(1).max(TOPES_REFERIDOS.topeMesMaximo),
});
const reglasCliente = z.object({
  regaloInvitado: z.number().int().min(0).max(TOPES_REFERIDOS.premioMaximo),
  premioInvitador: z.number().int().min(0).max(TOPES_REFERIDOS.premioMaximo),
  operaciones: z.number().int().min(1).max(100),
  gastoMinimo: z.number().int().min(1).max(1_000_000),
  topeMes: z.number().int().min(1).max(TOPES_REFERIDOS.topeMesMaximo),
});

programaReferidos.get('/admin/referidos-programas', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const { results: zonas } = await db
    .prepare(
      'SELECT id, nombre, pais, moneda FROM zonas WHERE activa = 1 ORDER BY pais DESC, nombre LIMIT 200',
    )
    .all<{ id: string; nombre: string; pais: string; moneda: string }>();
  const { results: alertas } = await db
    .prepare(
      `SELECT a.id, a.tipo, a.detalle, a.creado_en, cli.nombre AS cliente, con.nombre AS conductor FROM alertas_regalo a
         LEFT JOIN usuarios cli ON cli.id = a.cliente_id LEFT JOIN usuarios con ON con.id = a.conductor_id
        WHERE a.tipo LIKE 'referido_%' AND a.creado_en > datetime('now', '-30 days') ORDER BY a.creado_en DESC LIMIT 100`,
    )
    .all<Record<string, unknown>>();
  return c.json({
    programas: await listarProgramas(db),
    topes: TOPES_REFERIDOS,
    zonas,
    alertas: alertas.map((a) => ({
      id: String(a.id),
      tipo: String(a.tipo),
      detalle: String(a.detalle),
      cliente: a.cliente == null ? null : String(a.cliente),
      conductor: a.conductor == null ? null : String(a.conductor),
      creadoEn: String(a.creado_en),
    })),
  });
});

programaReferidos.put('/admin/referidos-programas/:tipo/:ambito', async (c) => {
  const u = exigir(c, 'admin');
  const tipo = c.req.param('tipo');
  if (tipo !== 'conductor' && tipo !== 'cliente')
    throw new ErrorDatos('No encontramos esa persona o ese servicio.', undefined, 404);
  const d = await leerCuerpo(
    c,
    z.object({
      activo: z.boolean(),
      presupuesto: z.number().int().min(100).max(TOPES_REFERIDOS.presupuestoMaximo),
      reglas: tipo === 'conductor' ? reglasConductor : reglasCliente,
    }),
  );
  return c.json({
    programa: await guardarPrograma(base(c), {
      tipo,
      ambito: c.req.param('ambito'),
      activo: d.activo,
      presupuesto: d.presupuesto,
      reglas: d.reglas,
      autorId: u.id,
    }),
  });
});

programaReferidos.get('/admin/equipos', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const { results: zonas } = await db
    .prepare(
      'SELECT id, nombre, pais FROM zonas WHERE activa = 1 ORDER BY pais DESC, nombre LIMIT 200',
    )
    .all<{ id: string; nombre: string; pais: string }>();
  return c.json({
    equipos: await listarEquipos(db, { zonaId: c.req.query('zona') ?? null }),
    zonas,
    sitio: sitioPublico(c),
  });
});

programaReferidos.post('/admin/equipos', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      nombre: z.string().trim().min(3).max(80),
      zonaId: z.string().min(1).max(64),
      lider: z.string().trim().min(5).max(120),
    }),
  );
  const db = base(c);
  const r = await crearEquipo(db, { ...d, autorId: u.id });
  return c.json({ equipo: (await listarEquipos(db, { equipoId: r.id }))[0] }, 201);
});

programaReferidos.get('/admin/equipos/:id', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const equipo = (await listarEquipos(db, { equipoId: c.req.param('id') }))[0];
  if (!equipo) throw new ErrorDatos('Eso ya no está disponible.', undefined, 404);
  return c.json({
    equipo: { ...equipo, enlace: `${sitioPublico(c)}/join/${equipo.codigo}` },
    miembros: await miembrosDeEquipo(db, equipo.id),
  });
});

/** La página pública de una invitación: quién invita (solo el nombre) y a qué equipo. */
programaReferidos.get('/publico/invitacion/:codigo', limiteIntentos(30, 60_000), async (c) => {
  const r = await resolverCodigo(base(c), c.req.param('codigo'));
  if (!r) return c.json({ invitacion: null }, 404);
  return c.json({
    invitacion: { codigo: r.codigo, nombre: r.nombre, equipo: r.equipo, ciudad: r.ciudad },
  });
});

/** «Mi equipo» del conductor: su código y enlace, sus invitados y, si es líder, su equipo. */
programaReferidos.get('/repartidor/invitaciones', async (c) => {
  const u = exigir(c, 'repartidor');
  return c.json(await misInvitaciones(base(c), u, sitioPublico(c)));
});

/** Un conductor nuevo escribe el código con el que lo invitaron (si no lo puso al registrarse). */
programaReferidos.post('/repartidor/invitacion', limiteIntentos(10, 60_000), async (c) => {
  const u = exigir(c, 'repartidor');
  const d = await leerCuerpo(c, z.object({ codigo: z.string().trim().min(4).max(20) }));
  const r = await vincularConductor(base(c), u.id, d.codigo);
  return c.json({ ok: true, nombre: r.nombre, equipo: r.equipo }, 201);
});
