import { avisarEmpresa, despues } from './avisosFlex';
import {
  ajustarCobroAlSalir,
  cerrarCobroRuta,
  sentenciasCobroEntrega,
} from '../finanzas/cobrosRuta';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  MOTIVOS_INCIDENCIA,
  PROXIMAS_ACCIONES,
  configEntrega,
  leerCodigoEscaneado,
  pruebasFaltantes,
} from '@tumbite/compartido';
import { sha256 } from '../cripto';
import type { Env } from '../env';
import { MAX_FOTO_BYTES, tipoReal } from '../rutas/fotos';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { type ActorFlex, CABECERA_CLAVE, conIdempotencia, nuevoIdFlex } from './autorizacion';
import { ACTUALIZAR_ENVIOS_DE_RUTA } from './envios';
import {
  type FilaRuta,
  detalleRuta,
  eventoSuelto,
  moverPaquetes,
  ofertaVencida,
  recalcularParadas,
  resumenRuta,
  rutaPorId,
} from './rutasComun';
import { traducirError, volverABorrador } from './rutasEmpresa';

/**
 * Divoox Flex · Fase 2 · lo que hace el CONDUCTOR desde Divoox Driver: ver sus rutas y ofertas,
 * aceptar o rechazar, llegar al centro, escanear la carga, salir, llegar a cada parada, entregar
 * con las pruebas exigidas, registrar incidencias, devolver al centro y cerrar la ruta.
 *
 * Solo con la sesión del propio conductor (rol repartidor): una clave de API de una empresa NUNCA
 * puede actuar como conductor. Cada acción lleva Idempotency-Key (la cola sin conexión la repite
 * sin duplicar nada).
 */
export const flexConductor = new Hono<{ Bindings: Env; Variables: Variables }>();

const punto = {
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  capturadoEn: z.number().int().positive().optional(),
};
const esquemaPunto = z.object(punto);
const esquemaEscaneo = z.object({ codigo: z.string().trim().min(6).max(80), ...punto });
const esquemaFaltante = z.object({
  paqueteId: z.string().uuid(),
  observaciones: z.string().trim().max(300).default(''),
});
const esquemaEntrega = z.object({
  paqueteIds: z.array(z.string().uuid()).min(1).max(50).optional(),
  fotoId: z.string().uuid().nullable().optional(),
  firmaId: z.string().uuid().nullable().optional(),
  pin: z
    .string()
    .regex(/^\d{4}$/, 'El PIN tiene 4 números.')
    .nullable()
    .optional(),
  sinContacto: z.boolean().default(false),
  recibio: z.string().trim().max(120).default(''),
  ...punto,
});
const esquemaIncidencia = z.object({
  paqueteIds: z.array(z.string().uuid()).min(1).max(50).optional(),
  motivo: z.enum(MOTIVOS_INCIDENCIA),
  observaciones: z.string().trim().max(500).default(''),
  pruebaId: z.string().uuid().nullable().optional(),
  proximaAccion: z.enum(PROXIMAS_ACCIONES),
  ...punto,
});
const MAX_INTENTOS_PIN = 5;

type Conductor = { id: string; nombre: string; idioma: 'es' | 'en' };

/** Solo la persona conductora, con su sesión; nunca una clave de empresa. */
function conductor(c: Parameters<typeof base>[0]): Conductor {
  if (c.req.header(CABECERA_CLAVE))
    throw new ErrorDatos('Una clave de API no puede actuar como conductor.', undefined, 403);
  const u = exigir(c, 'repartidor');
  return { id: u.id, nombre: u.nombre, idioma: u.idioma === 'es' ? 'es' : 'en' };
}

/** La idempotencia del conductor se guarda en su propio espacio (no en el de una empresa). */
const actorConductor = (u: Conductor): ActorFlex => ({
  empresaId: `conductor:${u.id}`,
  permisos: [],
  actorId: u.id,
  actorTipo: 'usuario',
  rol: null,
  idioma: u.idioma,
});

/** La ruta, solo si es de este conductor (lo ajeno no existe: 404). */
async function miRuta(db: D1Database, u: Conductor, rutaId: string, estados?: readonly string[]) {
  const r = await db
    .prepare('SELECT * FROM rutas_flex WHERE id = ? AND conductor_id = ?')
    .bind(rutaId, u.id)
    .first<FilaRuta>();
  if (!r) throw new ErrorDatos('Esa ruta no existe.', undefined, 404);
  if (estados && !estados.includes(r.estado))
    throw new ErrorDatos('La ruta no está en el paso que permite esto.', undefined, 409);
  return r;
}

const ahora = "datetime('now')";

async function responderRuta(db: D1Database, rutaId: string) {
  return detalleRuta(db, await rutaPorId(db, rutaId), { paraConductor: true });
}

async function guardarUbicacion(
  db: D1Database,
  rutaId: string,
  d: { lat?: number | null; lng?: number | null },
) {
  if (d.lat == null || d.lng == null) return null;
  return db
    .prepare(
      `UPDATE rutas_flex SET conductor_lat = ?, conductor_lng = ?, conductor_ubicacion_en = ${ahora} WHERE id = ?`,
    )
    .bind(d.lat, d.lng, rutaId);
}

// ───────────────────────────── Mis rutas ─────────────────────────────

flexConductor.get('/conductor/rutas', async (c) => {
  const u = conductor(c);
  const { results } = await base(c)
    .prepare(
      `SELECT r.*, e.nombre AS empresa,
              (SELECT COUNT(*) FROM ruta_paradas rp WHERE rp.ruta_id = r.id) AS paradas,
              (SELECT COUNT(*) FROM ruta_paquetes rq WHERE rq.ruta_id = r.id AND rq.excluido_en IS NULL) AS paquetes
         FROM rutas_flex r JOIN empresas e ON e.id = r.empresa_id
        WHERE r.conductor_id = ?
          AND (r.estado IN ('ofrecida', 'asignada', 'aceptada', 'en_carga', 'en_curso')
               OR (r.estado IN ('completada', 'con_incidencias') AND r.cerrada_en > datetime('now', '-7 days')))
        ORDER BY CASE r.estado WHEN 'en_curso' THEN 0 WHEN 'en_carga' THEN 1 WHEN 'aceptada' THEN 2
                 WHEN 'asignada' THEN 3 WHEN 'ofrecida' THEN 4 ELSE 5 END, r.creado_en DESC LIMIT 30`,
    )
    .bind(u.id)
    .all<FilaRuta & { empresa: string; paradas: number; paquetes: number }>();
  return c.json({
    rutas: results
      .filter((r) => !ofertaVencida(r))
      .map((r) => ({
        id: r.id,
        nombre: r.nombre,
        empresa: r.empresa,
        estado: r.estado,
        modalidad: r.modalidad,
        ofertaVenceEn: r.oferta_vence_en,
        bloqueDesde: r.bloque_desde,
        bloqueHasta: r.bloque_hasta,
        paradas: r.paradas,
        paquetes: r.paquetes,
        cerradaEn: r.cerrada_en,
      })),
  });
});

flexConductor.get('/conductor/rutas/:rutaId', async (c) => {
  const u = conductor(c);
  const db = base(c);
  const r = await miRuta(db, u, c.req.param('rutaId'));
  if (ofertaVencida(r)) throw new ErrorDatos('Esa oferta ya venció.', undefined, 410);
  return c.json(await detalleRuta(db, r, { paraConductor: true }));
});

/** Aceptar: una oferta (ocupa al conductor si está libre) o una asignación (confirma). */
flexConductor.post('/conductor/rutas/:rutaId/aceptar', async (c) => {
  const u = conductor(c);
  const db = base(c);
  const rutaId = c.req.param('rutaId');
  await miRuta(db, u, rutaId);
  return conIdempotencia(c, actorConductor(u), { rutaId, accion: 'aceptar' }, async () => {
    const r = await miRuta(db, u, rutaId);
    if (r.estado === 'aceptada') return { estado: 200, datos: await responderRuta(db, rutaId) };
    if (!['ofrecida', 'asignada'].includes(r.estado))
      throw new ErrorDatos('Esa ruta ya no se puede aceptar.', undefined, 409);
    if (ofertaVencida(r)) throw new ErrorDatos('Esa oferta ya venció.', undefined, 410);
    const clave = `aceptar:${r.id}:${crypto.randomUUID()}`;
    const res = await db
      .batch([
        // La oferta vence dentro de la misma sentencia: si venció justo ahora, no se acepta.
        db
          .prepare(
            `UPDATE rutas_flex SET estado = 'aceptada', aceptada_en = ${ahora}, ultima_clave = ?, actualizado_en = ${ahora}
              WHERE id = ? AND conductor_id = ? AND estado = ?
                AND (estado <> 'ofrecida' OR oferta_vence_en IS NULL OR oferta_vence_en > ${ahora})`,
          )
          .bind(clave, r.id, u.id, r.estado),
        // De una oferta: los paquetes pasan a «asignado» y nace la asignación (de una asignación, ya lo están).
        ...moverPaquetes(db, {
          ids: { deRuta: r.id },
          empresaId: r.empresa_id,
          desde: ['creado', 'registrado_centro', 'preparado'],
          hacia: 'asignado',
          actorId: u.id,
          actorTipo: 'usuario',
          rutaId: r.id,
          prefijo: clave,
          guardaClave: clave,
        }),
        db
          .prepare(
            `INSERT INTO ruta_asignaciones (ruta_id, conductor_id, clave)
             SELECT ?1, ?2, ?3 WHERE ?4 = 'ofrecida' AND EXISTS (SELECT 1 FROM rutas_flex WHERE id = ?1 AND ultima_clave = ?3)`,
          )
          .bind(r.id, u.id, clave, r.estado),
        db.prepare(ACTUALIZAR_ENVIOS_DE_RUTA).bind(r.id),
      ])
      .catch(traducirError);
    if (!res[0]?.meta.changes) {
      const otra = await rutaPorId(db, r.id);
      if (otra.estado === 'aceptada' && otra.conductor_id === u.id)
        return { estado: 200, datos: await responderRuta(db, rutaId) };
      throw new ErrorDatos('Esa oferta ya venció o cambió.', undefined, 409);
    }
    await despues(c, () =>
      avisarEmpresa(c.env, db, { tipo: 'ruta_aceptada', rutaId: r.id, ocasion: clave }),
    );
    return { estado: 200, datos: await responderRuta(db, rutaId) };
  });
});

flexConductor.post('/conductor/rutas/:rutaId/rechazar', async (c) => {
  const u = conductor(c);
  const db = base(c);
  const r = await miRuta(db, u, c.req.param('rutaId'), ['ofrecida', 'asignada', 'aceptada']);
  const clave = await volverABorrador(
    db,
    r,
    { actorId: u.id, actorTipo: 'usuario' },
    'liberada_conductor',
    'rechazada por el conductor',
  );
  await despues(c, () =>
    avisarEmpresa(c.env, db, { tipo: 'ruta_rechazada', rutaId: r.id, ocasion: clave }),
  );
  return c.json({ ok: true });
});

// ───────────────────────────── Centro: llegada, escaneo, salida ─────────────────────────────

flexConductor.post('/conductor/rutas/:rutaId/llegada-centro', async (c) => {
  const u = conductor(c);
  const d = await leerCuerpo(c, esquemaPunto);
  const db = base(c);
  const r = await miRuta(db, u, c.req.param('rutaId'), ['aceptada', 'en_carga']);
  if (r.estado === 'aceptada') {
    const sentencias = [
      db
        .prepare(
          `UPDATE rutas_flex SET estado = 'en_carga', carga_en = ${ahora}, actualizado_en = ${ahora} WHERE id = ? AND estado = 'aceptada'`,
        )
        .bind(r.id),
    ];
    const ub = await guardarUbicacion(db, r.id, d);
    if (ub) sentencias.push(ub);
    await db.batch(sentencias).catch(traducirError);
  }
  return c.json(await responderRuta(db, r.id));
});

/**
 * Escanear un paquete al cargarlo. Valida que sea de ESTA ruta (y por tanto de su empresa), que
 * esté asignado y que no se haya cargado antes. Repetir el escaneo no crea otro evento.
 */
flexConductor.post('/conductor/rutas/:rutaId/escanear', async (c) => {
  const u = conductor(c);
  const d = await leerCuerpo(c, esquemaEscaneo);
  const db = base(c);
  const rutaId = c.req.param('rutaId');
  await miRuta(db, u, rutaId, ['en_carga']);
  const leido = leerCodigoEscaneado(d.codigo);
  if (!leido) throw new ErrorDatos('Ese código no es de una etiqueta de Divoox.', 'codigo', 404);
  return conIdempotencia(
    c,
    actorConductor(u),
    { rutaId, codigo: leido.codigo, accion: 'escanear' },
    async () => {
      const r = await miRuta(db, u, rutaId, ['en_carga']);
      const f = await db
        .prepare(
          `SELECT p.id, p.estado, p.codigo_seguimiento, rq.cargado_en, rq.activo, rq.excluido_en FROM ruta_paquetes rq
           JOIN paquetes p ON p.id = rq.paquete_id
          WHERE rq.ruta_id = ? AND (p.codigo_etiqueta = ? OR p.codigo_seguimiento = ?)`,
        )
        .bind(r.id, leido.codigo, leido.codigo)
        .first<{
          id: string;
          estado: string;
          codigo_seguimiento: string;
          cargado_en: string | null;
          activo: number;
          excluido_en: string | null;
        }>();
      // De otra ruta, de otra empresa o inexistente: la misma respuesta (no se revela nada ajeno).
      if (!f || !f.activo || f.excluido_en)
        throw new ErrorDatos('Ese paquete no es de tu ruta.', 'codigo', 404);
      if (f.cargado_en || f.estado === 'cargado')
        return {
          estado: 200,
          datos: { paqueteId: f.id, codigoSeguimiento: f.codigo_seguimiento, yaCargado: true },
        };
      if (f.estado !== 'asignado')
        throw new ErrorDatos('Ese paquete no está listo para cargarse.', 'codigo', 409);
      const sentencias = [
        ...moverPaquetes(db, {
          ids: [f.id],
          empresaId: r.empresa_id,
          desde: ['asignado'],
          hacia: 'cargado',
          actorId: u.id,
          actorTipo: 'usuario',
          rutaId: r.id,
          // Un solo evento de carga por paquete y ruta, se escanee las veces que se escanee.
          prefijo: `escaneo:${r.id}`,
          lat: d.lat,
          lng: d.lng,
          meta: d.capturadoEn ? { capturadoEn: d.capturadoEn } : null,
        }),
        db
          .prepare(
            `UPDATE ruta_paquetes SET cargado_en = ${ahora} WHERE ruta_id = ? AND paquete_id = ? AND cargado_en IS NULL`,
          )
          .bind(r.id, f.id),
      ];
      await db.batch(sentencias).catch(traducirError);
      return {
        estado: 200,
        datos: { paqueteId: f.id, codigoSeguimiento: f.codigo_seguimiento, yaCargado: false },
      };
    },
  );
});

/** Un paquete de la ruta que no está en el centro: sale de la ruta y queda la incidencia. */
flexConductor.post('/conductor/rutas/:rutaId/faltante', async (c) => {
  const u = conductor(c);
  const d = await leerCuerpo(c, esquemaFaltante);
  const db = base(c);
  const rutaId = c.req.param('rutaId');
  return conIdempotencia(c, actorConductor(u), { rutaId, ...d, accion: 'faltante' }, async () => {
    const r = await miRuta(db, u, rutaId, ['en_carga']);
    const f = await db
      .prepare(
        `SELECT p.estado, rq.parada_id FROM ruta_paquetes rq JOIN paquetes p ON p.id = rq.paquete_id
          WHERE rq.ruta_id = ? AND rq.paquete_id = ? AND rq.activo = 1`,
      )
      .bind(r.id, d.paqueteId)
      .first<{ estado: string; parada_id: string }>();
    if (!f) throw new ErrorDatos('Ese paquete no es de tu ruta.', 'paqueteId', 404);
    if (f.estado !== 'asignado') throw new ErrorDatos('Ese paquete ya se cargó.', 'paqueteId', 409);
    await db.batch([
      ...moverPaquetes(db, {
        ids: [d.paqueteId],
        empresaId: r.empresa_id,
        desde: ['asignado'],
        hacia: 'preparado',
        actorId: u.id,
        actorTipo: 'usuario',
        rutaId: r.id,
        prefijo: `faltante:${r.id}`,
        meta: { motivo: 'no_encontrado_centro', observaciones: d.observaciones },
      }),
      db
        .prepare(
          `UPDATE ruta_paquetes SET activo = 0, excluido_en = ${ahora}, excluido_motivo = 'no_encontrado_centro'
            WHERE ruta_id = ? AND paquete_id = ?`,
        )
        .bind(r.id, d.paqueteId),
      db
        .prepare(
          `INSERT OR IGNORE INTO flex_incidencias (id, empresa_id, ruta_id, parada_id, paquete_id, conductor_id, motivo, observaciones, proxima_accion, idempotencia)
           VALUES (?, ?, ?, ?, ?, ?, 'no_encontrado_centro', ?, 'reprogramar', ?)`,
        )
        .bind(
          nuevoIdFlex(),
          r.empresa_id,
          r.id,
          f.parada_id,
          d.paqueteId,
          u.id,
          d.observaciones,
          `faltante:${r.id}:${d.paqueteId}`,
        ),
      ...recalcularParadas(db, r.id),
      db.prepare(ACTUALIZAR_ENVIOS_DE_RUTA).bind(r.id),
    ]);
    return { estado: 200, datos: await responderRuta(db, r.id) };
  });
});

/**
 * Salir a la calle: todos los paquetes de la ruta cargados (o sacados como faltantes) y todas
 * las paradas con coordenadas. Los paquetes pasan a «en tránsito».
 */
flexConductor.post('/conductor/rutas/:rutaId/iniciar', async (c) => {
  const u = conductor(c);
  const d = await leerCuerpo(c, esquemaPunto);
  const db = base(c);
  const rutaId = c.req.param('rutaId');
  return conIdempotencia(c, actorConductor(u), { rutaId, accion: 'iniciar' }, async () => {
    const r = await miRuta(db, u, rutaId, ['en_carga', 'en_curso']);
    if (r.estado === 'en_curso') return { estado: 200, datos: await responderRuta(db, r.id) };
    const f = await db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM ruta_paquetes rq JOIN paquetes p ON p.id = rq.paquete_id
            WHERE rq.ruta_id = ?1 AND rq.activo = 1 AND p.estado <> 'cargado') AS sin_cargar,
          (SELECT COUNT(*) FROM ruta_paquetes rq WHERE rq.ruta_id = ?1 AND rq.activo = 1) AS cargados,
          (SELECT COUNT(*) FROM ruta_paradas rp JOIN envios e ON e.id = rp.envio_id
            WHERE rp.ruta_id = ?1 AND (e.lat IS NULL OR e.lng IS NULL)
              AND EXISTS (SELECT 1 FROM ruta_paquetes rq WHERE rq.parada_id = rp.id AND rq.activo = 1)) AS sin_coordenadas`,
      )
      .bind(r.id)
      .first<{ sin_cargar: number; cargados: number; sin_coordenadas: number }>();
    if (f?.sin_cargar)
      throw new ErrorDatos(
        `Faltan ${f.sin_cargar} paquetes por escanear (o márcalos como faltantes).`,
        undefined,
        409,
      );
    if (!f?.cargados)
      throw new ErrorDatos('No hay paquetes cargados en esta ruta.', undefined, 409);
    if (f.sin_coordenadas)
      throw new ErrorDatos(
        'Hay paradas sin coordenadas verificadas: la empresa tiene que corregirlas antes de salir.',
        undefined,
        409,
      );
    const clave = `iniciar:${r.id}:${crypto.randomUUID()}`;
    const sentencias = [
      db
        .prepare(
          `UPDATE rutas_flex SET estado = 'en_curso', iniciada_en = ${ahora}, ultima_clave = ?, actualizado_en = ${ahora} WHERE id = ? AND estado = 'en_carga'`,
        )
        .bind(clave, r.id),
      ...moverPaquetes(db, {
        ids: { deRuta: r.id },
        empresaId: r.empresa_id,
        desde: ['cargado'],
        hacia: 'en_transito',
        actorId: u.id,
        actorTipo: 'usuario',
        rutaId: r.id,
        prefijo: clave,
        lat: d.lat,
        lng: d.lng,
        guardaClave: clave,
      }),
      db.prepare(ACTUALIZAR_ENVIOS_DE_RUTA).bind(r.id),
    ];
    const ub = await guardarUbicacion(db, r.id, d);
    if (ub) sentencias.push(ub);
    const res = await db.batch(sentencias).catch(traducirError);
    if (!res[0]?.meta.changes)
      throw new ErrorDatos('La ruta cambió mientras tanto. Vuelve a cargarla.', undefined, 409);
    // Fase 4: lo apartado por paquetes que no se cargaron vuelve al disponible.
    await ajustarCobroAlSalir(db, r.id).catch((e: unknown) =>
      console.error('finanzas: ajuste de la reserva al salir', e),
    );
    await despues(c, () =>
      avisarEmpresa(c.env, db, { tipo: 'ruta_iniciada', rutaId: r.id, ocasion: clave }),
    );
    return { estado: 200, datos: await responderRuta(db, r.id) };
  });
});

flexConductor.post('/conductor/rutas/:rutaId/ubicacion', async (c) => {
  const u = conductor(c);
  const d = await leerCuerpo(c, esquemaPunto);
  const db = base(c);
  const r = await miRuta(db, u, c.req.param('rutaId'), ['aceptada', 'en_carga', 'en_curso']);
  const ub = await guardarUbicacion(db, r.id, d);
  if (!ub) throw new ErrorDatos('Falta la ubicación.', 'lat');
  await ub.run();
  return c.json({ ok: true });
});

// ───────────────────────────── Paradas ─────────────────────────────

async function paradaDe(db: D1Database, rutaId: string, paradaId: string) {
  const f = await db
    .prepare(
      `SELECT rp.id, rp.envio_id, rp.estado, e.config_entrega_json AS envio_cfg, em.config_entrega_json AS empresa_cfg
         FROM ruta_paradas rp JOIN envios e ON e.id = rp.envio_id JOIN empresas em ON em.id = e.empresa_id
        WHERE rp.id = ? AND rp.ruta_id = ?`,
    )
    .bind(paradaId, rutaId)
    .first<{
      id: string;
      envio_id: string;
      estado: string;
      envio_cfg: string | null;
      empresa_cfg: string | null;
    }>();
  if (!f) throw new ErrorDatos('Esa parada no es de tu ruta.', undefined, 404);
  return f;
}

/** Paquetes de la parada que siguen en la ruta (o los pedidos, si son de esta parada). */
async function paquetesDeParada(
  db: D1Database,
  rutaId: string,
  paradaId: string,
  pedidos?: string[],
) {
  const { results } = await db
    .prepare(
      `SELECT p.id, p.estado FROM ruta_paquetes rq JOIN paquetes p ON p.id = rq.paquete_id
        WHERE rq.ruta_id = ? AND rq.parada_id = ? AND rq.activo = 1`,
    )
    .bind(rutaId, paradaId)
    .all<{ id: string; estado: string }>();
  if (!pedidos) return results;
  const deParada = new Map(results.map((x) => [x.id, x]));
  const elegidos = pedidos.map((id) => deParada.get(id));
  if (elegidos.some((x) => !x))
    throw new ErrorDatos('Algún paquete no es de esta parada.', 'paqueteIds', 404);
  return elegidos as { id: string; estado: string }[];
}

flexConductor.post('/conductor/rutas/:rutaId/paradas/:paradaId/llegada', async (c) => {
  const u = conductor(c);
  const d = await leerCuerpo(c, esquemaPunto);
  const db = base(c);
  const r = await miRuta(db, u, c.req.param('rutaId'), ['en_curso']);
  const p = await paradaDe(db, r.id, c.req.param('paradaId'));
  const sentencias = [
    db
      .prepare(
        `UPDATE ruta_paradas SET llegada_en = COALESCE(llegada_en, ${ahora}),
           estado = CASE WHEN estado = 'pendiente' THEN 'llegada' ELSE estado END WHERE id = ?`,
      )
      .bind(p.id),
  ];
  const ub = await guardarUbicacion(db, r.id, d);
  if (ub) sentencias.push(ub);
  await db.batch(sentencias);
  return c.json(await responderRuta(db, r.id));
});

/**
 * Foto o firma de una parada (la imagen tal cual). Va al almacén privado; aquí queda la referencia
 * con la hora, el lugar, el conductor, la ruta y la empresa. Devuelve el id para la entrega.
 */
flexConductor.post('/conductor/rutas/:rutaId/paradas/:paradaId/prueba', async (c) => {
  const u = conductor(c);
  const db = base(c);
  const rutaId = c.req.param('rutaId');
  const r = await miRuta(db, u, rutaId, ['en_curso']);
  const p = await paradaDe(db, r.id, c.req.param('paradaId'));
  const tipo = c.req.query('tipo') ?? 'foto';
  if (!['foto', 'firma', 'incidencia'].includes(tipo))
    throw new ErrorDatos('Tipo de prueba desconocido.', 'tipo');
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (!bytes.byteLength)
    throw new ErrorDatos('Falta la foto. Tómala y vuelve a intentar.', 'foto', 400);
  if (bytes.byteLength > MAX_FOTO_BYTES)
    throw new ErrorDatos('La foto pesa demasiado. El máximo es 3 MB.', 'foto', 413);
  const mime = tipoReal(bytes);
  if (!mime) throw new ErrorDatos('Sube una foto en JPG, PNG o WebP.', 'foto', 415);
  if (!c.env.BUCKET)
    throw new ErrorDatos('El almacén de fotos no está disponible en este momento.', undefined, 503);
  const lat = Number(c.req.query('lat'));
  const lng = Number(c.req.query('lng'));
  const huella = await sha256(
    Array.from(bytes.slice(0, 4096), (b) => String.fromCharCode(b)).join('') + bytes.byteLength,
  );
  return conIdempotencia(
    c,
    actorConductor(u),
    { rutaId, paradaId: p.id, tipo, huella },
    async () => {
      const id = nuevoIdFlex();
      const clave = `flex/${r.empresa_id}/${r.id}/${p.id}/${tipo}-${id}`;
      await c.env.BUCKET!.put(clave, bytes, {
        httpMetadata: { contentType: mime, cacheControl: 'private, no-store' },
      });
      await db
        .prepare(
          'INSERT INTO flex_pruebas (id, empresa_id, ruta_id, parada_id, conductor_id, tipo, clave, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          id,
          r.empresa_id,
          r.id,
          p.id,
          u.id,
          tipo,
          clave,
          Number.isFinite(lat) ? lat : null,
          Number.isFinite(lng) ? lng : null,
        )
        .run();
      return { estado: 201, datos: { pruebaId: id, tipo } };
    },
  );
});

async function pruebaValida(
  db: D1Database,
  id: string | null | undefined,
  tipo: 'foto' | 'firma' | 'incidencia',
  r: FilaRuta,
  paradaId: string,
  u: Conductor,
) {
  if (!id) return false;
  // Para una incidencia sirve tanto la foto de incidencia como una foto normal de la parada.
  const tipos = tipo === 'incidencia' ? ['incidencia', 'foto'] : [tipo];
  const f = await db
    .prepare(
      'SELECT 1 FROM flex_pruebas WHERE id = ? AND tipo IN (SELECT value FROM json_each(?)) AND ruta_id = ? AND parada_id = ? AND conductor_id = ?',
    )
    .bind(id, JSON.stringify(tipos), r.id, paradaId, u.id)
    .first();
  if (!f)
    throw new ErrorDatos(
      `Esa ${tipo === 'firma' ? 'firma' : 'foto'} no es de esta parada.`,
      tipo === 'firma' ? 'firmaId' : 'fotoId',
      404,
    );
  return true;
}

/** PIN del destinatario: se compara su hash en el servidor; cinco errores lo bloquean. */
async function verificarPin(
  db: D1Database,
  envioId: string,
  pin: string | null | undefined,
): Promise<boolean> {
  if (!pin) return false;
  const f = await db
    .prepare('SELECT pin_hash, sal, intentos, usado_en FROM flex_pines WHERE envio_id = ?')
    .bind(envioId)
    .first<{ pin_hash: string; sal: string; intentos: number; usado_en: string | null }>();
  if (!f)
    throw new ErrorDatos('Este envío no tiene PIN: pídele a la empresa que lo genere.', 'pin', 409);
  if (f.intentos >= MAX_INTENTOS_PIN)
    throw new ErrorDatos(
      'El PIN se bloqueó por demasiados intentos. Registra una incidencia.',
      'pin',
      409,
    );
  if ((await sha256(`${f.sal}:${pin}`)) === f.pin_hash) return true;
  await db
    .prepare('UPDATE flex_pines SET intentos = intentos + 1 WHERE envio_id = ?')
    .bind(envioId)
    .run();
  throw new ErrorDatos('El PIN no coincide. Pídeselo otra vez a quien recibe.', 'pin', 422);
}

/**
 * Entregar los paquetes de una parada. Exige las pruebas que pide la empresa (o el envío): foto,
 * PIN, firma o «sin contacto» si se permite. Sin ellas no hay entrega. Repetir no duplica nada.
 */
flexConductor.post('/conductor/rutas/:rutaId/paradas/:paradaId/entregar', async (c) => {
  const u = conductor(c);
  const d = await leerCuerpo(c, esquemaEntrega);
  const db = base(c);
  const rutaId = c.req.param('rutaId');
  const paradaId = c.req.param('paradaId');
  await miRuta(db, u, rutaId, ['en_curso']);
  return conIdempotencia(
    c,
    actorConductor(u),
    { rutaId, paradaId, ...d, pin: d.pin ? '****' : null, accion: 'entregar' },
    async () => {
      const r = await miRuta(db, u, rutaId, ['en_curso']);
      const p = await paradaDe(db, r.id, paradaId);
      const lista = await paquetesDeParada(db, r.id, p.id, d.paqueteIds);
      const aEntregar = lista.filter((x) => x.estado === 'en_transito');
      if (!aEntregar.length) {
        if (lista.length && lista.every((x) => x.estado === 'entregado'))
          return { estado: 200, datos: { ...(await responderRuta(db, r.id)), yaEntregado: true } };
        throw new ErrorDatos(
          'No hay paquetes en camino para entregar en esta parada.',
          undefined,
          409,
        );
      }
      const config = configEntrega(p.empresa_cfg, p.envio_cfg);
      const sinContacto = d.sinContacto && config.sinContacto;
      if (d.sinContacto && !config.sinContacto)
        throw new ErrorDatos('Esta empresa no permite entregar sin contacto.', 'sinContacto', 409);
      const foto = await pruebaValida(db, d.fotoId, 'foto', r, p.id, u);
      const firma = await pruebaValida(db, d.firmaId, 'firma', r, p.id, u);
      const faltan = pruebasFaltantes(config, {
        foto,
        firma,
        sinContacto,
        pin: config.pin && !sinContacto ? Boolean(d.pin) : false,
      });
      if (faltan.length)
        throw new ErrorDatos(
          `Para entregar falta: ${faltan.map((x) => (x === 'foto' ? 'la foto' : x === 'pin' ? 'el PIN' : 'la firma')).join(', ')}.`,
          faltan[0],
          422,
        );
      const pinOk = config.pin && !sinContacto ? await verificarPin(db, p.envio_id, d.pin) : false;
      const meta = {
        fotoId: d.fotoId ?? null,
        firmaId: d.firmaId ?? null,
        pin: pinOk,
        sinContacto,
        recibio: d.recibio || null,
        capturadoEn: d.capturadoEn ?? null,
      };
      const sentencias = [
        ...moverPaquetes(db, {
          ids: aEntregar.map((x) => x.id),
          empresaId: r.empresa_id,
          desde: ['en_transito'],
          hacia: 'entregado',
          actorId: u.id,
          actorTipo: 'usuario',
          rutaId: r.id,
          prefijo: `entrega:${r.id}`,
          lat: d.lat,
          lng: d.lng,
          meta,
        }),
        db
          .prepare(
            `UPDATE flex_incidencias SET estado = 'resuelta', resuelta_en = ${ahora}
            WHERE ruta_id = ? AND paquete_id IN (SELECT value FROM json_each(?)) AND estado <> 'resuelta'`,
          )
          .bind(r.id, JSON.stringify(aEntregar.map((x) => x.id))),
        db
          .prepare(
            `UPDATE ruta_paradas SET llegada_en = COALESCE(llegada_en, ${ahora}) WHERE id = ?`,
          )
          .bind(p.id),
        ...recalcularParadas(db, r.id),
        db.prepare(ACTUALIZAR_ENVIOS_DE_RUTA).bind(r.id),
        // Fase 4 (C-FIN-COMISION): la comisión de cada paquete entregado, en ESTA transacción.
        ...sentenciasCobroEntrega(
          db,
          r.id,
          aEntregar.map((x) => x.id),
        ),
      ];
      if (pinOk)
        sentencias.push(
          db
            .prepare(`UPDATE flex_pines SET usado_en = ${ahora} WHERE envio_id = ?`)
            .bind(p.envio_id),
        );
      const ub = await guardarUbicacion(db, r.id, d);
      if (ub) sentencias.push(ub);
      await db.batch(sentencias).catch(traducirError);
      await despues(c, () => avisarSiTermino(c.env, db, r.id));
      return {
        estado: 200,
        datos: { ...(await responderRuta(db, r.id)), entregados: aEntregar.map((x) => x.id) },
      };
    },
  );
});

/** Entrega fallida: motivo, observaciones, evidencia opcional y próxima acción. Nunca «entregado». */
flexConductor.post('/conductor/rutas/:rutaId/paradas/:paradaId/incidencia', async (c) => {
  const u = conductor(c);
  const d = await leerCuerpo(c, esquemaIncidencia);
  if (d.motivo === 'otro' && d.observaciones.length < 5)
    throw new ErrorDatos(
      'Con «otro motivo», cuenta qué pasó en las observaciones.',
      'observaciones',
    );
  const db = base(c);
  const rutaId = c.req.param('rutaId');
  const paradaId = c.req.param('paradaId');
  await miRuta(db, u, rutaId, ['en_curso']);
  const clavePeticion = c.req.header('idempotency-key') ?? '';
  return conIdempotencia(
    c,
    actorConductor(u),
    { rutaId, paradaId, ...d, accion: 'incidencia' },
    async () => {
      const r = await miRuta(db, u, rutaId, ['en_curso']);
      const p = await paradaDe(db, r.id, paradaId);
      const config = configEntrega(p.empresa_cfg, p.envio_cfg);
      if (d.pruebaId) await pruebaValida(db, d.pruebaId, 'incidencia', r, p.id, u);
      const lista = (await paquetesDeParada(db, r.id, p.id, d.paqueteIds)).filter(
        (x) => x.estado === 'en_transito',
      );
      if (!lista.length)
        throw new ErrorDatos('No hay paquetes en camino en esta parada.', undefined, 409);
      const sentencias = [
        ...moverPaquetes(db, {
          ids: lista.map((x) => x.id),
          empresaId: r.empresa_id,
          desde: ['en_transito'],
          hacia: 'entrega_fallida',
          actorId: u.id,
          actorTipo: 'usuario',
          rutaId: r.id,
          prefijo: `incidencia:${r.id}:${clavePeticion}`,
          lat: d.lat,
          lng: d.lng,
          meta: {
            motivo: d.motivo,
            proximaAccion: d.proximaAccion,
            capturadoEn: d.capturadoEn ?? null,
          },
        }),
        ...lista.map((x) =>
          db
            .prepare(
              `INSERT OR IGNORE INTO flex_incidencias (id, empresa_id, ruta_id, parada_id, paquete_id, conductor_id, motivo, observaciones, prueba_id, proxima_accion, idempotencia)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              nuevoIdFlex(),
              r.empresa_id,
              r.id,
              p.id,
              x.id,
              u.id,
              d.motivo,
              d.observaciones,
              d.pruebaId ?? null,
              // Si la empresa no permite reintentos en ruta, «reintentar» queda como «reprogramar».
              d.proximaAccion === 'reintentar' && !config.reintentoEnRuta
                ? 'reprogramar'
                : d.proximaAccion,
              `incidencia:${r.id}:${clavePeticion}:${x.id}`,
            ),
        ),
        db
          .prepare(
            `UPDATE ruta_paradas SET llegada_en = COALESCE(llegada_en, ${ahora}) WHERE id = ?`,
          )
          .bind(p.id),
        ...recalcularParadas(db, r.id),
        db.prepare(ACTUALIZAR_ENVIOS_DE_RUTA).bind(r.id),
      ];
      const ub = await guardarUbicacion(db, r.id, d);
      if (ub) sentencias.push(ub);
      await db.batch(sentencias).catch(traducirError);
      await despues(c, async () => {
        await avisarEmpresa(c.env, db, {
          tipo: 'incidencia',
          rutaId: r.id,
          ocasion: clavePeticion,
        });
        await avisarSiTermino(c.env, db, r.id);
      });
      return { estado: 200, datos: await responderRuta(db, r.id) };
    },
  );
});

/** Reintentar en la misma ruta: solo si la empresa lo permite o lo autorizó para esa incidencia. */
flexConductor.post('/conductor/rutas/:rutaId/paquetes/:paqueteId/reintentar', async (c) => {
  const u = conductor(c);
  const db = base(c);
  const rutaId = c.req.param('rutaId');
  const paqueteId = c.req.param('paqueteId');
  return conIdempotencia(
    c,
    actorConductor(u),
    { rutaId, paqueteId, accion: 'reintentar' },
    async () => {
      const r = await miRuta(db, u, rutaId, ['en_curso']);
      const f = await db
        .prepare(
          `SELECT p.estado, rq.parada_id, i.id AS inc, i.proxima_accion, i.reintento_autorizado,
                (SELECT em.config_entrega_json FROM empresas em WHERE em.id = p.empresa_id) AS empresa_cfg,
                (SELECT e.config_entrega_json FROM envios e WHERE e.id = p.envio_id) AS envio_cfg
           FROM ruta_paquetes rq JOIN paquetes p ON p.id = rq.paquete_id
           LEFT JOIN flex_incidencias i ON i.paquete_id = p.id AND i.ruta_id = rq.ruta_id AND i.estado = 'abierta'
          WHERE rq.ruta_id = ? AND rq.paquete_id = ? AND rq.activo = 1`,
        )
        .bind(r.id, paqueteId)
        .first<{
          estado: string;
          parada_id: string;
          inc: string | null;
          proxima_accion: string | null;
          reintento_autorizado: number;
          empresa_cfg: string | null;
          envio_cfg: string | null;
        }>();
      if (!f) throw new ErrorDatos('Ese paquete no es de tu ruta.', 'paqueteId', 404);
      if (f.estado !== 'entrega_fallida')
        throw new ErrorDatos('Ese paquete no tiene una entrega fallida.', 'paqueteId', 409);
      const permitido =
        f.reintento_autorizado === 1 ||
        (configEntrega(f.empresa_cfg, f.envio_cfg).reintentoEnRuta &&
          f.proxima_accion === 'reintentar');
      if (!permitido)
        throw new ErrorDatos(
          'Ese reintento no está autorizado: devuélvelo al centro.',
          'paqueteId',
          409,
        );
      await db.batch([
        ...moverPaquetes(db, {
          ids: [paqueteId],
          empresaId: r.empresa_id,
          desde: ['entrega_fallida'],
          hacia: 'en_transito',
          actorId: u.id,
          actorTipo: 'usuario',
          rutaId: r.id,
          prefijo: `reintento:${r.id}:${f.inc ?? 'x'}`,
        }),
        db.prepare(`UPDATE flex_incidencias SET estado = 'reintentada' WHERE id = ?`).bind(f.inc),
        ...recalcularParadas(db, r.id),
        db.prepare(ACTUALIZAR_ENVIOS_DE_RUTA).bind(r.id),
      ]);
      return { estado: 200, datos: await responderRuta(db, r.id) };
    },
  );
});

// ───────────────────────────── Devoluciones y cierre ─────────────────────────────

/**
 * Empezar la devolución: todo lo que no se entregó (fallido o sin intentar) pasa a «en
 * devolución» y sale la lista. Se puede llamar otra vez sin duplicar.
 */
flexConductor.post('/conductor/rutas/:rutaId/devolucion', async (c) => {
  const u = conductor(c);
  const db = base(c);
  const rutaId = c.req.param('rutaId');
  return conIdempotencia(c, actorConductor(u), { rutaId, accion: 'devolucion' }, async () => {
    const r = await miRuta(db, u, rutaId, ['en_curso']);
    const { results } = await db
      .prepare(
        `SELECT p.id FROM ruta_paquetes rq JOIN paquetes p ON p.id = rq.paquete_id
          WHERE rq.ruta_id = ? AND rq.activo = 1 AND p.estado IN ('entrega_fallida', 'en_transito')`,
      )
      .bind(r.id)
      .all<{ id: string }>();
    if (results.length)
      await db.batch([
        ...moverPaquetes(db, {
          ids: results.map((x) => x.id),
          empresaId: r.empresa_id,
          desde: ['entrega_fallida', 'en_transito'],
          hacia: 'en_devolucion',
          actorId: u.id,
          actorTipo: 'usuario',
          rutaId: r.id,
          prefijo: `devolucion:${r.id}`,
        }),
        ...recalcularParadas(db, r.id),
        db.prepare(ACTUALIZAR_ENVIOS_DE_RUTA).bind(r.id),
      ]);
    if (results.length)
      await despues(c, () =>
        avisarEmpresa(c.env, db, {
          tipo: 'devolucion_pedida',
          rutaId: r.id,
          ocasion: 'devolucion',
        }),
      );
    const lista = await db
      .prepare(
        `SELECT p.id, p.codigo_seguimiento, p.codigo_etiqueta, rq.devuelto_centro_en FROM ruta_paquetes rq JOIN paquetes p ON p.id = rq.paquete_id
          WHERE rq.ruta_id = ? AND rq.activo = 1 AND p.estado = 'en_devolucion' ORDER BY p.id`,
      )
      .bind(r.id)
      .all<{
        id: string;
        codigo_seguimiento: string;
        codigo_etiqueta: string;
        devuelto_centro_en: string | null;
      }>();
    return {
      estado: 200,
      datos: {
        devoluciones: lista.results.map((x) => ({
          paqueteId: x.id,
          codigoSeguimiento: x.codigo_seguimiento,
          codigoEtiqueta: x.codigo_etiqueta,
          entregadoAlCentro: Boolean(x.devuelto_centro_en),
        })),
      },
    };
  });
});

/** El conductor escanea en el centro cada paquete que devuelve: queda el traspaso de custodia. */
flexConductor.post('/conductor/rutas/:rutaId/devolucion/entregar', async (c) => {
  const u = conductor(c);
  const d = await leerCuerpo(c, esquemaEscaneo);
  const db = base(c);
  const rutaId = c.req.param('rutaId');
  const leido = leerCodigoEscaneado(d.codigo);
  if (!leido) throw new ErrorDatos('Ese código no es de una etiqueta de Divoox.', 'codigo', 404);
  return conIdempotencia(
    c,
    actorConductor(u),
    { rutaId, codigo: leido.codigo, accion: 'devolver' },
    async () => {
      const r = await miRuta(db, u, rutaId, ['en_curso', 'completada', 'con_incidencias']);
      const f = await db
        .prepare(
          `SELECT p.id, p.estado FROM ruta_paquetes rq JOIN paquetes p ON p.id = rq.paquete_id
          WHERE rq.ruta_id = ? AND rq.activo = 1 AND (p.codigo_etiqueta = ? OR p.codigo_seguimiento = ?)`,
        )
        .bind(r.id, leido.codigo, leido.codigo)
        .first<{ id: string; estado: string }>();
      if (!f) throw new ErrorDatos('Ese paquete no es de tu ruta.', 'codigo', 404);
      if (f.estado !== 'en_devolucion')
        throw new ErrorDatos('Ese paquete no está en devolución.', 'codigo', 409);
      await db.batch([
        eventoSuelto(db, {
          paqueteId: f.id,
          empresaId: r.empresa_id,
          tipo: 'traspaso_centro',
          actorId: u.id,
          actorTipo: 'usuario',
          rutaId: r.id,
          idempotencia: `traspaso:${r.id}:${f.id}`,
          lat: d.lat,
          lng: d.lng,
          meta: { capturadoEn: d.capturadoEn ?? null },
        }),
        db
          .prepare(
            `UPDATE ruta_paquetes SET devuelto_centro_en = COALESCE(devuelto_centro_en, ${ahora}) WHERE ruta_id = ? AND paquete_id = ?`,
          )
          .bind(r.id, f.id),
      ]);
      return { estado: 200, datos: { paqueteId: f.id, entregadoAlCentro: true } };
    },
  );
});

/**
 * Cerrar la ruta: todos los paquetes en un estado final, recibidos de vuelta en el centro, o
 * entregados al centro con su traspaso registrado (la recepción la confirma el centro después).
 * Libera al conductor en la misma sentencia (disparador), una sola vez.
 */
flexConductor.post('/conductor/rutas/:rutaId/cerrar', async (c) => {
  const u = conductor(c);
  const db = base(c);
  const rutaId = c.req.param('rutaId');
  return conIdempotencia(c, actorConductor(u), { rutaId, accion: 'cerrar' }, async () => {
    const r = await miRuta(db, u, rutaId, ['en_curso', 'completada', 'con_incidencias']);
    if (r.estado !== 'en_curso')
      return {
        estado: 200,
        datos: { resumen: JSON.parse(r.resumen_json ?? 'null') as unknown, estado: r.estado },
      };
    const pend = await db
      .prepare(
        `SELECT p.codigo_seguimiento, p.estado FROM ruta_paquetes rq JOIN paquetes p ON p.id = rq.paquete_id
          WHERE rq.ruta_id = ? AND rq.activo = 1
            AND NOT (p.estado IN ('entregado', 'devuelto', 'registrado_centro', 'cancelado')
                     OR (p.estado = 'en_devolucion' AND rq.devuelto_centro_en IS NOT NULL))`,
      )
      .bind(r.id)
      .all<{ codigo_seguimiento: string; estado: string }>();
    if (pend.results.length)
      throw new ErrorDatos(
        `Hay ${pend.results.length} paquetes sin cerrar: entrégalos, registra la incidencia y devuélvelos al centro (${pend.results
          .slice(0, 5)
          .map((x) => x.codigo_seguimiento)
          .join(', ')}).`,
        undefined,
        409,
      );
    const c2 = await db
      .prepare(
        `SELECT COUNT(*) AS total, SUM(p.estado = 'entregado') AS entregados FROM ruta_paquetes rq JOIN paquetes p ON p.id = rq.paquete_id
          WHERE rq.ruta_id = ? AND rq.excluido_en IS NULL`,
      )
      .bind(r.id)
      .first<{ total: number; entregados: number }>();
    const final =
      c2 &&
      c2.total === c2.entregados &&
      !(await db.prepare('SELECT 1 FROM flex_incidencias WHERE ruta_id = ?').bind(r.id).first())
        ? 'completada'
        : 'con_incidencias';
    const cerradaEn = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const resumen = await resumenRuta(db, r, cerradaEn);
    const clave = `cerrar:${r.id}`;
    const res = await db.batch([
      db
        .prepare(
          `UPDATE rutas_flex SET estado = ?, cerrada_en = ?, resumen_json = ?, ultima_clave = ?, actualizado_en = ${ahora}
            WHERE id = ? AND estado = 'en_curso'`,
        )
        .bind(final, cerradaEn, JSON.stringify(resumen), clave, r.id),
      // Lo que ya terminó sale de la ruta; lo que espera la recepción del centro sigue reservado.
      db
        .prepare(
          `UPDATE ruta_paquetes SET activo = 0 WHERE ruta_id = ? AND activo = 1
             AND paquete_id IN (SELECT id FROM paquetes WHERE estado IN ('entregado', 'devuelto', 'registrado_centro', 'cancelado'))
             AND EXISTS (SELECT 1 FROM rutas_flex WHERE id = ? AND ultima_clave = ?)`,
        )
        .bind(r.id, r.id, clave),
      db
        .prepare(
          `UPDATE ruta_asignaciones SET fin = ${ahora}, resultado = 'completada' WHERE ruta_id = ? AND fin IS NULL
             AND EXISTS (SELECT 1 FROM rutas_flex WHERE id = ? AND ultima_clave = ?)`,
        )
        .bind(r.id, r.id, clave),
      ...recalcularParadas(db, r.id),
    ]);
    if (!res[0]?.meta.changes) {
      const ya = await rutaPorId(db, r.id);
      return {
        estado: 200,
        datos: { resumen: JSON.parse(ya.resumen_json ?? 'null') as unknown, estado: ya.estado },
      };
    }
    // Fase 4: se cobra lo de la ruta (si la regla es por ruta) y se libera lo que sobró.
    await cerrarCobroRuta(db, r.id).catch((e: unknown) =>
      console.error('finanzas: cierre del cobro de la ruta', e),
    );
    await despues(c, () =>
      avisarEmpresa(c.env, db, { tipo: 'ruta_cerrada', rutaId: r.id, ocasion: clave }),
    );
    return { estado: 200, datos: { resumen, estado: final } };
  });
});

/** «Entregas terminadas»: cuando ya no queda ninguna parada pendiente (una sola vez por ruta). */
async function avisarSiTermino(env: Env, db: D1Database, rutaId: string) {
  const f = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM ruta_paradas WHERE ruta_id = ? AND estado NOT IN ('entregada', 'fallida', 'omitida')",
    )
    .bind(rutaId)
    .first<{ n: number }>();
  if (Number(f?.n) === 0)
    await avisarEmpresa(env, db, { tipo: 'entregas_terminadas', rutaId, ocasion: 'paradas' });
}
