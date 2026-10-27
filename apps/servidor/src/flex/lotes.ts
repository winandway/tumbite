import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import {
  actorDeEmpresa,
  conIdempotencia,
  exigirPermiso,
  nuevoIdFlex,
  sentenciaAuditoria,
} from './autorizacion';

/**
 * Divoox Flex · lotes y rutas (SOLO ESTRUCTURA en la Fase 1). Un lote agrupa paquetes de un
 * centro; una ruta es una lista ordenada de paradas (envíos). Nada de aquí asigna conductores,
 * ocupa al conductor ni despacha: eso es la Fase 2 y respetará «una ruta = una operación activa».
 */
export const flexLotes = new Hono<{ Bindings: Env; Variables: Variables }>();

const esquemaLote = z.object({
  nombre: z.string().trim().min(1).max(80),
  centroId: z.string().uuid().nullable().optional(),
});
const esquemaPaquetesLote = z.object({ paqueteIds: z.array(z.string().uuid()).min(1).max(100) });
const esquemaLoteCambio = z.object({
  nombre: z.string().trim().min(1).max(80).optional(),
  estado: z.enum(['abierto', 'cerrado']).optional(),
});
const esquemaRuta = z.object({
  nombre: z.string().trim().max(80).default(''),
  centroId: z.string().uuid().nullable().optional(),
  loteId: z.string().uuid().nullable().optional(),
  envioIds: z.array(z.string().uuid()).min(1).max(60),
  bloqueDesde: z.string().max(25).nullable().optional(),
  bloqueHasta: z.string().max(25).nullable().optional(),
});
const esquemaRutaCambio = z.object({
  nombre: z.string().trim().max(80).optional(),
  envioIds: z.array(z.string().uuid()).min(1).max(60).optional(),
  estado: z.enum(['cancelada']).optional(),
});

const filaLote = (f: Record<string, unknown>) => ({
  id: f.id,
  nombre: f.nombre,
  centroId: f.centro_id,
  estado: f.estado,
  paquetes: f.paquetes,
  creadoEn: f.creado_en,
});
const filaRuta = (f: Record<string, unknown>) => ({
  id: f.id,
  nombre: f.nombre,
  centroId: f.centro_id,
  loteId: f.lote_id,
  conductorId: f.conductor_id,
  estado: f.estado,
  bloqueDesde: f.bloque_desde,
  bloqueHasta: f.bloque_hasta,
  paradas: f.paradas,
  creadoEn: f.creado_en,
});

async function comprobarCentro(
  db: D1Database,
  empresaId: string,
  centroId: string | null | undefined,
) {
  if (!centroId) return;
  const f = await db
    .prepare('SELECT 1 FROM empresa_centros WHERE id = ? AND empresa_id = ?')
    .bind(centroId, empresaId)
    .first();
  if (!f) throw new ErrorDatos('Ese centro no existe en tu empresa.', 'centroId', 404);
}

// ───────────────────────────── Lotes ─────────────────────────────

flexLotes.get('/empresas/:id/lotes', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.ver');
  const { results } = await base(c)
    .prepare(
      `SELECT l.*, (SELECT COUNT(*) FROM lote_paquetes lp WHERE lp.lote_id = l.id) AS paquetes
       FROM lotes l WHERE l.empresa_id = ? ORDER BY l.creado_en DESC LIMIT 100`,
    )
    .bind(actor.empresaId)
    .all<Record<string, unknown>>();
  return c.json({ lotes: results.map(filaLote) });
});

flexLotes.post('/empresas/:id/lotes', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'lotes.gestionar');
  const d = await leerCuerpo(c, esquemaLote);
  const db = base(c);
  await comprobarCentro(db, actor.empresaId, d.centroId);
  return conIdempotencia(c, actor, d, async () => {
    const id = nuevoIdFlex();
    await db.batch([
      db
        .prepare('INSERT INTO lotes (id, empresa_id, centro_id, nombre) VALUES (?, ?, ?, ?)')
        .bind(id, actor.empresaId, d.centroId ?? null, d.nombre),
      sentenciaAuditoria(db, actor, 'lote.crear', id, { nombre: d.nombre }),
    ]);
    return {
      estado: 201,
      datos: {
        lote: {
          id,
          nombre: d.nombre,
          centroId: d.centroId ?? null,
          estado: 'abierto',
          paquetes: 0,
        },
      },
    };
  });
});

async function loteDe(db: D1Database, empresaId: string, id: string) {
  const f = await db
    .prepare('SELECT * FROM lotes WHERE id = ? AND empresa_id = ?')
    .bind(id, empresaId)
    .first<Record<string, unknown>>();
  if (!f) throw new ErrorDatos('Ese lote no existe.', undefined, 404);
  return f;
}

flexLotes.get('/empresas/:id/lotes/:loteId', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.ver');
  const db = base(c);
  const f = await loteDe(db, actor.empresaId, c.req.param('loteId'));
  const { results } = await db
    .prepare(
      `SELECT p.id, p.codigo_seguimiento, p.codigo_etiqueta, p.estado, e.id AS envio_id, e.referencia_externa, e.destinatario_nombre, e.direccion
       FROM lote_paquetes lp JOIN paquetes p ON p.id = lp.paquete_id JOIN envios e ON e.id = p.envio_id
       WHERE lp.lote_id = ? ORDER BY lp.agregado_en, p.id`,
    )
    .bind(f.id)
    .all<Record<string, unknown>>();
  return c.json({
    lote: filaLote({ ...f, paquetes: results.length }),
    paquetes: results.map((p) => ({
      id: p.id,
      codigoSeguimiento: p.codigo_seguimiento,
      codigoEtiqueta: p.codigo_etiqueta,
      estado: p.estado,
      envioId: p.envio_id,
      referenciaExterna: p.referencia_externa,
      destinatarioNombre: p.destinatario_nombre,
      direccion: p.direccion,
    })),
  });
});

/** Agregar paquetes de la empresa al lote (los que todavía no salieron). Los ajenos no existen. */
flexLotes.post('/empresas/:id/lotes/:loteId/paquetes', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'lotes.gestionar');
  const d = await leerCuerpo(c, esquemaPaquetesLote);
  const db = base(c);
  const lote = await loteDe(db, actor.empresaId, c.req.param('loteId'));
  if (lote.estado !== 'abierto') throw new ErrorDatos('Ese lote ya está cerrado.', undefined, 409);
  const ids = [...new Set(d.paqueteIds)];
  const { results } = await db
    .prepare(
      `SELECT id FROM paquetes WHERE empresa_id = ? AND estado IN ('creado', 'registrado_centro', 'preparado')
       AND id IN (${ids.map(() => '?').join(',')})`,
    )
    .bind(actor.empresaId, ...ids)
    .all<{ id: string }>();
  const validos = new Set(results.map((r) => r.id));
  const rechazados = ids.filter((x) => !validos.has(x));
  if (validos.size)
    await db.batch([
      ...[...validos].map((pid) =>
        db
          .prepare('INSERT OR IGNORE INTO lote_paquetes (paquete_id, lote_id) VALUES (?, ?)')
          .bind(pid, lote.id),
      ),
      sentenciaAuditoria(db, actor, 'lote.agregar', String(lote.id), { paquetes: validos.size }),
    ]);
  return c.json({ agregados: validos.size, rechazados });
});

flexLotes.delete('/empresas/:id/lotes/:loteId/paquetes/:paqueteId', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'lotes.gestionar');
  const db = base(c);
  const lote = await loteDe(db, actor.empresaId, c.req.param('loteId'));
  const r = await db
    .prepare(
      'DELETE FROM lote_paquetes WHERE lote_id = ? AND paquete_id = ? AND paquete_id IN (SELECT id FROM paquetes WHERE empresa_id = ?)',
    )
    .bind(lote.id, c.req.param('paqueteId'), actor.empresaId)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ese paquete no está en el lote.', undefined, 404);
  return c.json({ ok: true });
});

flexLotes.patch('/empresas/:id/lotes/:loteId', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'lotes.gestionar');
  const d = await leerCuerpo(c, esquemaLoteCambio);
  const db = base(c);
  const lote = await loteDe(db, actor.empresaId, c.req.param('loteId'));
  await db.batch([
    db
      .prepare(
        "UPDATE lotes SET nombre = COALESCE(?, nombre), estado = COALESCE(?, estado), actualizado_en = datetime('now') WHERE id = ?",
      )
      .bind(d.nombre ?? null, d.estado ?? null, lote.id),
    sentenciaAuditoria(db, actor, 'lote.cambiar', String(lote.id), d),
  ]);
  return c.json({ ok: true });
});

// ───────────────────────────── Rutas (borrador) ─────────────────────────────

async function enviosDeLaEmpresa(db: D1Database, empresaId: string, ids: string[]) {
  const unicos = [...new Set(ids)];
  if (unicos.length !== ids.length)
    throw new ErrorDatos('Hay envíos repetidos en la ruta.', 'envioIds', 409);
  const { results } = await db
    .prepare(
      `SELECT id FROM envios WHERE empresa_id = ? AND id IN (${unicos.map(() => '?').join(',')})`,
    )
    .bind(empresaId, ...unicos)
    .all<{ id: string }>();
  if (results.length !== unicos.length)
    throw new ErrorDatos('Alguno de esos envíos no existe en tu empresa.', 'envioIds', 404);
}

flexLotes.post('/empresas/:id/rutas', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'lotes.gestionar');
  const d = await leerCuerpo(c, esquemaRuta);
  const db = base(c);
  await comprobarCentro(db, actor.empresaId, d.centroId);
  if (d.loteId) await loteDe(db, actor.empresaId, d.loteId);
  await enviosDeLaEmpresa(db, actor.empresaId, d.envioIds);
  return conIdempotencia(c, actor, d, async () => {
    const id = nuevoIdFlex();
    await db.batch([
      db
        .prepare(
          'INSERT INTO rutas_flex (id, empresa_id, centro_id, lote_id, nombre, bloque_desde, bloque_hasta) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          id,
          actor.empresaId,
          d.centroId ?? null,
          d.loteId ?? null,
          d.nombre,
          d.bloqueDesde ?? null,
          d.bloqueHasta ?? null,
        ),
      ...d.envioIds.map((envioId, i) =>
        db
          .prepare('INSERT INTO ruta_paradas (id, ruta_id, orden, envio_id) VALUES (?, ?, ?, ?)')
          .bind(nuevoIdFlex(), id, i + 1, envioId),
      ),
      sentenciaAuditoria(db, actor, 'ruta.crear', id, { paradas: d.envioIds.length }),
    ]);
    return { estado: 201, datos: await rutaCompleta(db, actor.empresaId, id) };
  });
});

async function rutaCompleta(db: D1Database, empresaId: string, id: string) {
  const f = await db
    .prepare('SELECT * FROM rutas_flex WHERE id = ? AND empresa_id = ?')
    .bind(id, empresaId)
    .first<Record<string, unknown>>();
  if (!f) throw new ErrorDatos('Esa ruta no existe.', undefined, 404);
  const { results } = await db
    .prepare(
      `SELECT rp.id, rp.orden, rp.estado, rp.envio_id, e.referencia_externa, e.destinatario_nombre, e.direccion, e.lat, e.lng,
         (SELECT COUNT(*) FROM paquetes p WHERE p.envio_id = e.id) AS paquetes
       FROM ruta_paradas rp JOIN envios e ON e.id = rp.envio_id WHERE rp.ruta_id = ? ORDER BY rp.orden`,
    )
    .bind(id)
    .all<Record<string, unknown>>();
  return {
    ruta: filaRuta({
      ...f,
      paradas: results.map((p) => ({
        id: p.id,
        orden: p.orden,
        estado: p.estado,
        envioId: p.envio_id,
        referenciaExterna: p.referencia_externa,
        destinatarioNombre: p.destinatario_nombre,
        direccion: p.direccion,
        lat: p.lat,
        lng: p.lng,
        paquetes: p.paquetes,
      })),
    }),
  };
}

flexLotes.get('/empresas/:id/rutas', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.ver');
  const { results } = await base(c)
    .prepare(
      `SELECT r.*, (SELECT COUNT(*) FROM ruta_paradas rp WHERE rp.ruta_id = r.id) AS paradas
       FROM rutas_flex r WHERE r.empresa_id = ? ORDER BY r.creado_en DESC LIMIT 100`,
    )
    .bind(actor.empresaId)
    .all<Record<string, unknown>>();
  return c.json({ rutas: results.map(filaRuta) });
});

flexLotes.get('/empresas/:id/rutas/:rutaId', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.ver');
  return c.json(await rutaCompleta(base(c), actor.empresaId, c.req.param('rutaId')));
});

/** Renombrar, reordenar las paradas o cancelar. Solo mientras la ruta es un borrador. */
flexLotes.patch('/empresas/:id/rutas/:rutaId', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'lotes.gestionar');
  const d = await leerCuerpo(c, esquemaRutaCambio);
  const db = base(c);
  const id = c.req.param('rutaId');
  const f = await db
    .prepare('SELECT estado FROM rutas_flex WHERE id = ? AND empresa_id = ?')
    .bind(id, actor.empresaId)
    .first<{ estado: string }>();
  if (!f) throw new ErrorDatos('Esa ruta no existe.', undefined, 404);
  if (f.estado !== 'borrador')
    throw new ErrorDatos('Solo se edita una ruta en borrador.', undefined, 409);
  const sentencias: D1PreparedStatement[] = [];
  if (d.envioIds) {
    await enviosDeLaEmpresa(db, actor.empresaId, d.envioIds);
    sentencias.push(
      db.prepare('DELETE FROM ruta_paradas WHERE ruta_id = ?').bind(id),
      ...d.envioIds.map((envioId, i) =>
        db
          .prepare('INSERT INTO ruta_paradas (id, ruta_id, orden, envio_id) VALUES (?, ?, ?, ?)')
          .bind(nuevoIdFlex(), id, i + 1, envioId),
      ),
    );
  }
  sentencias.push(
    db
      .prepare(
        "UPDATE rutas_flex SET nombre = COALESCE(?, nombre), estado = COALESCE(?, estado), actualizado_en = datetime('now') WHERE id = ?",
      )
      .bind(d.nombre ?? null, d.estado ?? null, id),
    sentenciaAuditoria(db, actor, 'ruta.cambiar', id, {
      nombre: d.nombre,
      paradas: d.envioIds?.length,
      estado: d.estado,
    }),
  );
  await db.batch(sentencias);
  return c.json(await rutaCompleta(db, actor.empresaId, id));
});
