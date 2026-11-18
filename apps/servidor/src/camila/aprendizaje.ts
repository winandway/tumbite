import { nuevoId } from '../cripto';
import { ErrorDatos } from '../validar';
import { normalizar } from './conocimiento';

/**
 * C-CAMILA-APRENDE (17 nov 2026) — todos los países. Camila aprende SOLO con aprobación.
 *
 * 1. Cada pregunta que no supo responder queda en camila_sin_respuesta.
 * 2. Una vez por semana (o cuando el equipo toca «Armar la lista»), las preguntas parecidas se juntan
 *    en propuestas (camila_conocimiento, estado «propuesta»), con cuántas veces se preguntó.
 * 3. El equipo escribe o corrige la respuesta (español e inglés) y la aprueba con un toque. Recién
 *    entonces Camila la usa. Una propuesta o una rechazada NUNCA se usa (buscarAprobadas filtra por
 *    «aprobada» y la prueba lo comprueba). Camila no escribe respuestas por su cuenta.
 */
export const semanaDe = (d = new Date()) => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dia = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - dia);
  const inicio = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  const n = Math.ceil(((x.getTime() - inicio.getTime()) / 86_400_000 + 1) / 7);
  return `${x.getUTCFullYear()}-S${String(n).padStart(2, '0')}`;
};

const clave = (t: string) =>
  normalizar(t)
    .split(' ')
    .filter((p) => p.length > 3)
    .sort()
    .slice(0, 8)
    .join(' ');

/** Junta las preguntas sin respuesta todavía sin lista en propuestas. Devuelve cuántas creó. */
export async function armarListaSemanal(db: D1Database, ahora = new Date()) {
  const { results } = await db
    .prepare(
      `SELECT id, pregunta, idioma FROM camila_sin_respuesta
        WHERE propuesta_id IS NULL AND creado_en > datetime('now', '-30 days') ORDER BY creado_en LIMIT 300`,
    )
    .all<{ id: string; pregunta: string; idioma: string }>();
  if (!results.length) return 0;
  const grupos = new Map<string, { ids: string[]; pregunta: string; idioma: string }>();
  for (const r of results) {
    const k = clave(r.pregunta) || r.id;
    const g = grupos.get(k);
    if (g) g.ids.push(r.id);
    else grupos.set(k, { ids: [r.id], pregunta: r.pregunta, idioma: r.idioma });
  }
  const semana = semanaDe(ahora);
  const sentencias: D1PreparedStatement[] = [];
  for (const g of grupos.values()) {
    const id = nuevoId();
    sentencias.push(
      db
        .prepare(
          `INSERT INTO camila_conocimiento (id, pregunta_es, pregunta_en, veces, semana, estado) VALUES (?, ?, ?, ?, ?, 'propuesta')`,
        )
        .bind(
          id,
          g.idioma === 'en' ? '' : g.pregunta,
          g.idioma === 'en' ? g.pregunta : '',
          g.ids.length,
          semana,
        ),
      db
        .prepare(
          'UPDATE camila_sin_respuesta SET propuesta_id = ? WHERE id IN (SELECT value FROM json_each(?))',
        )
        .bind(id, JSON.stringify(g.ids)),
    );
  }
  await db.batch(sentencias);
  return grupos.size;
}

/** El equipo aprueba (con la respuesta en los dos idiomas) o rechaza una propuesta. */
export async function decidirPropuesta(
  db: D1Database,
  id: string,
  d:
    | {
        decision: 'aprobar';
        preguntaEs: string;
        preguntaEn: string;
        respuestaEs: string;
        respuestaEn: string;
        autorId: string;
      }
    | { decision: 'rechazar'; autorId: string },
) {
  if (d.decision === 'aprobar') {
    if (!d.respuestaEs.trim() || !d.respuestaEn.trim())
      throw new ErrorDatos(
        'La respuesta va en español y en inglés antes de aprobarla.',
        'respuestaEs',
        422,
      );
    const r = await db
      .prepare(
        `UPDATE camila_conocimiento SET estado = 'aprobada', pregunta_es = ?, pregunta_en = ?, respuesta_es = ?, respuesta_en = ?,
           decidido_por = ?, decidido_en = datetime('now') WHERE id = ?`,
      )
      .bind(
        d.preguntaEs.trim(),
        d.preguntaEn.trim(),
        d.respuestaEs.trim(),
        d.respuestaEn.trim(),
        d.autorId,
        id,
      )
      .run();
    if (!r.meta.changes) throw new ErrorDatos('No encontramos esa respuesta.', undefined, 404);
    return;
  }
  const r = await db
    .prepare(
      "UPDATE camila_conocimiento SET estado = 'rechazada', decidido_por = ?, decidido_en = datetime('now') WHERE id = ?",
    )
    .bind(d.autorId, id)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('No encontramos esa respuesta.', undefined, 404);
}

/** La tarea del reloj: los lunes, en la vuelta de cada hora, arma la lista de la semana (una vez). */
export const TAREA_CAMILA_SEMANAL = {
  nombre: 'camila_lista_semanal',
  critica: false,
  cada: 'hora' as const,
  escriturasEsperadas: 600,
  correr: async (_env: unknown, db: D1Database) => {
    const ahora = new Date();
    if (ahora.getUTCDay() !== 1 || ahora.getUTCHours() !== 13) return 0;
    const ya = await db
      .prepare('SELECT 1 FROM camila_conocimiento WHERE semana = ? LIMIT 1')
      .bind(semanaDe(ahora))
      .first();
    return ya ? 0 : armarListaSemanal(db, ahora);
  },
};

/**
 * La limpieza diaria de Camila (una vez al día, a las 07:00 UTC, en la vuelta de cada hora): borra
 * los contadores de códigos de días anteriores y los códigos vencidos hace más de un día.
 */
export async function limpiarCamila(db: D1Database, ahora = new Date()) {
  const [dias, codigos] = await db.batch([
    db
      .prepare('DELETE FROM camila_codigos_dia WHERE dia < ?')
      .bind(ahora.toISOString().slice(0, 10)),
    db.prepare("DELETE FROM camila_codigos WHERE vence_en < datetime('now', '-1 day')"),
  ]);
  return (dias?.meta.changes ?? 0) + (codigos?.meta.changes ?? 0);
}

export const TAREA_CAMILA_LIMPIEZA = {
  nombre: 'camila_limpieza',
  critica: false,
  cada: 'hora' as const,
  escriturasEsperadas: 5000,
  correr: async (_env: unknown, db: D1Database) =>
    new Date().getUTCHours() === 7 ? limpiarCamila(db) : 0,
};
