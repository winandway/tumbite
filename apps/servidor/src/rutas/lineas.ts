import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { limiteIntentos, limiteIntentosPersistente } from '../seguridad';
import { pasaTurnstile } from '../turnstile';
import { resolverCodigo } from '../programaReferidos';
import {
  TIPOS_LINEA,
  anularInvitacionLider,
  aprobarSolicitud,
  crearLinea,
  esLiderSinCuenta,
  invitacionesDeLider,
  editarContacto2,
  invitarLider,
  lineaPorId,
  lineasDeCiudad,
  listarLineas,
  listarSolicitudes,
  miLinea,
  miembrosDeLinea,
  moverConductor,
  pedidosDeLinea,
  pedirEntrada,
  rechazarSolicitud,
  registrarSolicitud,
  resolverPedido,
  sacarDeLinea,
  usarCodigoDeConductor,
} from '../lineas';
import { sitioPublico } from './programaReferidos';

/**
 * C-LINEAS-TAXI: las rutas de las líneas de taxi y mototaxi (superadmin, formulario público «Registra tu
 * línea» y «Mi línea» del conductor). La lógica vive en `lineas.ts`.
 */
export const lineas = new Hono<{ Bindings: Env; Variables: Variables }>();

/** Donde el líder invitado crea su cuenta de conductor (la misma app, en la web o instalada). */
const enlaceDriver = (c: Parameters<typeof sitioPublico>[0]) => `${sitioPublico(c)}/driver`;

const tipo = z.enum(TIPOS_LINEA, { error: 'Elige taxi, mototaxi o los dos.' });
const celular = z.string().trim().min(7, { error: 'Escribe el celular completo.' }).max(24);

// ───────────── Superadmin ─────────────

lineas.get('/admin/lineas', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const zona = c.req.query('zona') ?? '';
  const { results: zonas } = await db
    .prepare(
      'SELECT id, nombre, pais FROM zonas WHERE activa = 1 ORDER BY pais DESC, nombre LIMIT 200',
    )
    .all<{ id: string; nombre: string; pais: string }>();
  const { results: sinLinea } = zona
    ? await db
        .prepare(
          `SELECT u.id, u.nombre, u.telefono FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id
            WHERE u.rol = 'repartidor' AND u.activo = 1 AND COALESCE(r.zona_id, u.zona_id) = ?
              AND NOT EXISTS (SELECT 1 FROM miembros_equipo m WHERE m.usuario_id = u.id)
              AND NOT EXISTS (SELECT 1 FROM equipos e JOIN lineas l ON l.equipo_id = e.id WHERE e.lider_id = u.id)
            ORDER BY u.nombre LIMIT 100`,
        )
        .bind(zona)
        .all<{ id: string; nombre: string; telefono: string | null }>()
    : { results: [] };
  const pend = await db
    .prepare("SELECT COUNT(*) AS n FROM solicitudes_linea WHERE estado = 'pendiente'")
    .first<{ n: number }>();
  return c.json({
    lineas: await listarLineas(db, { zonaId: zona, q: c.req.query('q') ?? '' }),
    zonas,
    sinLinea,
    solicitudesPendientes: Number(pend?.n ?? 0),
    sitio: sitioPublico(c),
  });
});

lineas.post('/admin/lineas', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      nombre: z.string().trim().min(3).max(80),
      zonaId: z.string().min(1).max(64),
      tipo,
      lider: z.string().trim().min(5).max(120),
      contacto2Nombre: z.string().trim().min(2).max(80),
      contacto2Telefono: celular,
      conductores: z.number().int().min(0).max(5000).optional(),
      // C-LIDER-INVITADO: si el líder todavía no tiene cuenta, la línea queda esperándolo.
      invitar: z.boolean().optional(),
    }),
  );
  const db = base(c);
  const { invitar, ...datos } = d;
  try {
    const r = await crearLinea(db, { ...datos, autorId: u.id });
    return c.json({ linea: await lineaPorId(db, r.id), adoptados: r.adoptados }, 201);
  } catch (e) {
    if (!esLiderSinCuenta(e)) throw e;
    if (!invitar)
      throw new ErrorDatos(
        'Nadie en Divoox Driver tiene ese correo o celular. Puedes invitar al líder: la línea se crea sola cuando se registre.',
        'lider',
        404,
      );
    const inv = await invitarLider(db, { ...datos, autorId: u.id });
    return c.json({ linea: null, invitacion: { id: inv.id, enlace: enlaceDriver(c) } }, 201);
  }
});

/** Las líneas que esperan a que su líder se registre, y anular una. */
lineas.get('/admin/lineas-invitaciones', async (c) => {
  exigir(c, 'admin');
  return c.json({ invitaciones: await invitacionesDeLider(base(c)), enlace: enlaceDriver(c) });
});

lineas.post('/admin/lineas-invitaciones/:id/anular', async (c) => {
  exigir(c, 'admin');
  await anularInvitacionLider(base(c), c.req.param('id'));
  return c.json({ ok: true });
});

lineas.get('/admin/lineas-solicitudes', async (c) => {
  exigir(c, 'admin');
  const estado = c.req.query('estado') ?? 'pendiente';
  return c.json({
    solicitudes: await listarSolicitudes(
      base(c),
      ['pendiente', 'aprobada', 'rechazada', 'todas'].includes(estado) ? estado : 'pendiente',
    ),
  });
});

lineas.post('/admin/lineas-solicitudes/:id/aprobar', async (c) => {
  const u = exigir(c, 'admin');
  const db = base(c);
  const d = await leerCuerpo(c, z.object({ invitar: z.boolean().optional() }));
  const r = await aprobarSolicitud(db, c.req.param('id'), u.id, d.invitar === true).catch(
    (e: unknown) => {
      if (!esLiderSinCuenta(e)) throw e;
      throw new ErrorDatos(
        'Nadie en Divoox Driver tiene ese celular. Puedes invitar al líder: la línea se crea sola cuando se registre.',
        'lider',
        404,
      );
    },
  );
  if ('invitacion' in r)
    return c.json(
      { linea: null, invitacion: { id: r.invitacion.id, enlace: enlaceDriver(c) } },
      201,
    );
  return c.json({ linea: await lineaPorId(db, r.id), adoptados: r.adoptados }, 201);
});

lineas.post('/admin/lineas-solicitudes/:id/rechazar', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(c, z.object({ motivo: z.string().trim().max(300).default('') }));
  await rechazarSolicitud(base(c), c.req.param('id'), u.id, d.motivo);
  return c.json({ ok: true });
});

/** Mover un conductor de línea (arrastrando en el superadmin); `lineaId: null` lo deja sin línea. */
lineas.post('/admin/lineas/mover', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      conductorId: z.string().min(1).max(80),
      lineaId: z.string().min(1).max(80).nullable(),
    }),
  );
  await moverConductor(base(c), d.conductorId, d.lineaId);
  return c.json({ ok: true });
});

lineas.get('/admin/lineas/:id', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const l = await lineaPorId(db, c.req.param('id'));
  if (!l) throw new ErrorDatos('Eso ya no está disponible.', undefined, 404);
  return c.json({
    linea: { ...l, enlace: `${sitioPublico(c)}/join/${l.codigo}` },
    miembros: await miembrosDeLinea(db, l.id),
    solicitudes: await pedidosDeLinea(db, l.id),
  });
});

lineas.patch('/admin/lineas/:id', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      activa: z.boolean().optional(),
      contacto2Nombre: z.string().trim().min(2).max(80).optional(),
      contacto2Telefono: celular.optional(),
    }),
  );
  const db = base(c);
  const id = c.req.param('id');
  if (!(await lineaPorId(db, id)))
    throw new ErrorDatos('Eso ya no está disponible.', undefined, 404);
  if (d.activa != null)
    await db
      .prepare('UPDATE equipos SET activo = ? WHERE id = ?')
      .bind(d.activa ? 1 : 0, id)
      .run();
  if (d.contacto2Nombre != null && d.contacto2Telefono != null)
    await editarContacto2(db, {
      donde: 'linea',
      id,
      nombre: d.contacto2Nombre,
      telefono: d.contacto2Telefono,
      actorId: u.id,
    });
  return c.json({ linea: await lineaPorId(db, id) });
});

// C-CONTACTO2-EDITABLE: «Editar contactos de emergencia» (tres puntos) de una línea o de un líder invitado.
const contacto2Cuerpo = z.object({
  contacto2Nombre: z.string().trim().min(2).max(80),
  contacto2Telefono: celular,
});
for (const [ruta, donde] of [
  ['/admin/lineas/:id/contacto2', 'linea'],
  ['/admin/lineas-invitaciones/:id/contacto2', 'invitacion'],
] as const)
  lineas.patch(ruta, async (c) => {
    const u = exigir(c, 'admin');
    const d = await leerCuerpo(c, contacto2Cuerpo);
    const r = await editarContacto2(base(c), {
      donde,
      id: c.req.param('id'),
      nombre: d.contacto2Nombre,
      telefono: d.contacto2Telefono,
      actorId: u.id,
    });
    return c.json({ ok: true, contacto2: r });
  });

// ───────────── Formulario público «Registra tu línea» ─────────────

lineas.get('/publico/lineas/ciudades', limiteIntentos(60, 60_000), async (c) => {
  const { results } = await base(c)
    .prepare(
      'SELECT id, nombre, pais FROM zonas WHERE activa = 1 ORDER BY pais DESC, nombre LIMIT 200',
    )
    .all<{ id: string; nombre: string; pais: string }>();
  return c.json({ ciudades: results.filter((z) => !/pruebas/i.test(z.nombre)) });
});

lineas.post('/publico/lineas/solicitud', limiteIntentosPersistente(5, 3_600_000), async (c) => {
  const ok = await pasaTurnstile(
    c.env.TURNSTILE_SECRET_KEY,
    c.req.header('cf-turnstile-response'),
    c.req.header('cf-connecting-ip'),
  );
  if (!ok)
    throw new ErrorDatos(
      'No pudimos confirmar que eres una persona. Recarga la página e intenta de nuevo.',
      undefined,
      403,
    );
  const d = await leerCuerpo(
    c,
    z.object({
      nombre: z.string().trim().min(3, { error: 'Escribe el nombre de la línea.' }).max(80),
      zonaId: z.string().min(1, { error: 'Elige tu ciudad.' }).max(64),
      tipo,
      conductores: z
        .number()
        .int()
        .min(1, { error: 'Cuéntanos cuántos conductores tienes.' })
        .max(5000),
      liderNombre: z.string().trim().min(3, { error: 'Escribe el nombre del líder.' }).max(80),
      liderTelefono: celular,
      contacto2Nombre: z
        .string()
        .trim()
        .min(2, { error: 'Escribe el nombre del segundo contacto.' })
        .max(80),
      contacto2Telefono: celular,
    }),
  );
  const r = await registrarSolicitud(base(c), d);
  return c.json({ ok: true, repetida: r.repetida }, 201);
});

// ───────────── Conductor: «Mi línea» ─────────────

lineas.get('/repartidor/mi-linea', async (c) => {
  const u = exigir(c, 'repartidor');
  return c.json(await miLinea(base(c), u, sitioPublico(c)));
});

/** Las líneas de la ciudad del conductor para elegir (buscador; nunca texto libre). */
lineas.get('/repartidor/lineas', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const f = await db
    .prepare(
      'SELECT COALESCE(r.zona_id, u.zona_id) AS zona FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id WHERE u.id = ?',
    )
    .bind(u.id)
    .first<{ zona: string | null }>();
  if (!f?.zona) return c.json({ lineas: [], ciudad: null });
  return c.json({
    lineas: await lineasDeCiudad(db, f.zona, c.req.query('q') ?? ''),
    ciudad: f.zona,
  });
});

/** Pedir entrada eligiendo la línea de la lista, o con su código (también cuenta el código de otra ciudad). */
lineas.post('/repartidor/linea/pedir', limiteIntentos(10, 60_000), async (c) => {
  const u = exigir(c, 'repartidor');
  const d = await leerCuerpo(
    c,
    z.object({
      lineaId: z.string().min(1).max(80).optional(),
      codigo: z.string().trim().min(4).max(20).optional(),
    }),
  );
  const db = base(c);
  if (d.codigo) {
    const r = await usarCodigoDeConductor(c.env, db, u.id, d.codigo);
    return c.json({ ok: true, pendiente: Boolean(r.linea), linea: r.linea }, 201);
  }
  if (!d.lineaId) throw new ErrorDatos('Elige tu línea de la lista.', 'lineaId', 422);
  const r = await pedirEntrada(c.env, db, u.id, d.lineaId);
  return c.json({ ok: true, pendiente: true, linea: r.linea.nombre }, 201);
});

lineas.post('/repartidor/linea/solicitudes/:id', async (c) => {
  const u = exigir(c, 'repartidor');
  const d = await leerCuerpo(c, z.object({ aceptar: z.boolean() }));
  await resolverPedido(c.env, base(c), u.id, c.req.param('id'), d.aceptar);
  return c.json({ ok: true });
});

lineas.post('/repartidor/linea/miembros/:id/sacar', async (c) => {
  const u = exigir(c, 'repartidor');
  await sacarDeLinea(base(c), u.id, c.req.param('id'));
  return c.json({ ok: true });
});

/** El enlace /join/CODIGO de una línea dice a qué línea y ciudad lleva (sin datos de personas). */
lineas.get('/publico/linea/:codigo', limiteIntentos(30, 60_000), async (c) => {
  const r = await resolverCodigo(base(c), c.req.param('codigo'));
  if (!r?.equipoId) return c.json({ linea: null }, 404);
  const l = await lineaPorId(base(c), r.equipoId);
  if (!l) return c.json({ linea: null }, 404);
  return c.json({ linea: { nombre: l.nombre, tipo: l.tipo, ciudad: l.ciudad } });
});
