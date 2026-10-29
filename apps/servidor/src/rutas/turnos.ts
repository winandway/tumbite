import { Hono } from 'hono';
import { z } from 'zod';
import { aSqlUtc, validarTurno } from '@tumbite/compartido';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';

/**
 * C-TURNOS-REPARTIDOR (29 oct 2026): el repartidor reserva, ve y cancela sus turnos. La prioridad
 * en las ofertas y el «turno perdido» viven en el despacho (operacion.ts) y en `actualizarTurnos`.
 */
export const turnos = new Hono<{ Bindings: Env; Variables: Variables }>();

const MOTIVO = new Map<string, string>(
  Object.entries({
    franja: 'Elige horas en punto o y media.',
    corto: 'Un turno dura al menos una hora.',
    largo: 'Un turno dura como mucho 12 horas.',
    pasado: 'Ese turno ya empezó hace rato. Elige otro.',
    lejos: 'Se reserva hasta 7 días adelante.',
  }),
);

/** Pasa los turnos de estado. La llama el Manager en cada vuelta. */
export async function actualizarTurnos(db: D1Database) {
  await db.batch([
    // Empezó y está conectado: activo.
    db.prepare(
      `UPDATE turnos_repartidor SET estado = 'activo'
        WHERE estado = 'programado' AND inicio <= datetime('now') AND fin > datetime('now')
          AND EXISTS (SELECT 1 FROM repartidores d WHERE d.usuario_id = turnos_repartidor.repartidor_id AND d.conectado = 1)`,
    ),
    // Pasaron 30 minutos y nunca se conectó: perdido.
    db.prepare(
      `UPDATE turnos_repartidor SET estado = 'perdido'
        WHERE estado = 'programado' AND inicio <= datetime('now', '-30 minutes')`,
    ),
    // Terminó.
    db.prepare(
      `UPDATE turnos_repartidor SET estado = 'cumplido'
        WHERE estado = 'activo' AND fin <= datetime('now')`,
    ),
  ]);
}

turnos.get('/repartidor/turnos', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  await actualizarTurnos(db);
  const { results } = await db
    .prepare(
      `SELECT id, inicio, fin, estado FROM turnos_repartidor
        WHERE repartidor_id = ? AND fin > datetime('now', '-1 day') ORDER BY inicio LIMIT 60`,
    )
    .bind(u.id)
    .all();
  return c.json({ turnos: results });
});

turnos.post('/repartidor/turnos', async (c) => {
  const u = exigir(c, 'repartidor');
  const d = await leerCuerpo(c, z.object({ inicio: z.iso.datetime(), fin: z.iso.datetime() }));
  const inicio = new Date(d.inicio);
  const fin = new Date(d.fin);
  const v = validarTurno(inicio, fin);
  if (v !== 'ok') throw new ErrorDatos(MOTIVO.get(v) ?? 'Revisa el turno.', 'inicio', 409);
  const db = base(c);
  const ficha = await db
    .prepare('SELECT zona_id FROM repartidores WHERE usuario_id = ?')
    .bind(u.id)
    .first<{ zona_id: string | null }>();
  if (!ficha?.zona_id)
    throw new ErrorDatos('Primero completa tu registro de repartidor.', undefined, 409);
  const choca = await db
    .prepare(
      `SELECT 1 FROM turnos_repartidor WHERE repartidor_id = ? AND estado IN ('programado','activo')
        AND inicio < ? AND fin > ?`,
    )
    .bind(u.id, aSqlUtc(fin), aSqlUtc(inicio))
    .first();
  if (choca) throw new ErrorDatos('Ya tienes un turno en esas horas.', 'inicio', 409);
  const id = nuevoId();
  await db
    .prepare(
      'INSERT INTO turnos_repartidor (id, repartidor_id, zona_id, inicio, fin) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(id, u.id, ficha.zona_id, aSqlUtc(inicio), aSqlUtc(fin))
    .run();
  return c.json({ id }, 201);
});

turnos.delete('/repartidor/turnos/:id', async (c) => {
  const u = exigir(c, 'repartidor');
  const r = await base(c)
    .prepare(
      `UPDATE turnos_repartidor SET estado = 'cancelado'
        WHERE id = ? AND repartidor_id = ? AND estado = 'programado'`,
    )
    .bind(c.req.param('id'), u.id)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ese turno ya empezó o no existe.', undefined, 409);
  return c.json({ ok: true });
});
