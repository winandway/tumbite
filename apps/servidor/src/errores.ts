/**
 * C-ERRORES-VISIBLES (20 oct 2026): los errores no controlados quedan en la base (ruta, método,
 * mensaje y los primeros renglones de la pila; nunca el cuerpo de la petición ni datos personales).
 * Pasó en staging: una foto de recogida respondió 500 y no había ningún registro para saber por qué.
 * Se guardan como mucho 1000 (los más viejos se borran) y el canario los muestra.
 */
const MAX_GUARDADOS = 1000;

/** La ruta sin identificadores (los UUID se reemplazan por :id). */
export const rutaSinIds = (ruta: string) =>
  ruta
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .slice(0, 200);

export async function guardarError(
  db: D1Database,
  metodo: string,
  ruta: string,
  err: unknown,
  /** C-CIUDAD-ERRORES: de quién era la sesión (solo el id), para atribuir el error a esa cuenta. */
  usuarioId?: string | null,
) {
  const e = err instanceof Error ? err : new Error(String(err));
  const valores = [
    metodo.slice(0, 10),
    ruta.slice(0, 300),
    e.message.slice(0, 500),
    (e.stack ?? '').split('\n').slice(0, 6).join('\n').slice(0, 1500),
  ];
  const insertar = usuarioId
    ? db
        .prepare(
          'INSERT INTO errores_servidor (metodo, ruta, mensaje, pila, usuario_id) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(...valores, usuarioId.slice(0, 64))
    : db
        .prepare('INSERT INTO errores_servidor (metodo, ruta, mensaje, pila) VALUES (?, ?, ?, ?)')
        .bind(...valores);
  const recortar = db
    .prepare('DELETE FROM errores_servidor WHERE id <= (SELECT MAX(id) FROM errores_servidor) - ?')
    .bind(MAX_GUARDADOS);
  try {
    await db.batch([insertar, recortar]);
  } catch (x) {
    if (!usuarioId) throw x;
    // Si la columna todavía no existe (base sin la migración), el error se guarda igual sin dueño.
    console.error('errores: sin usuario_id', x);
    await guardarError(db, metodo, ruta, err);
  }
}

/** Pieza «errores» de la salud: «pendiente» si hubo errores no controlados en la última hora. */
export async function saludErrores(db: D1Database): Promise<'ok' | 'pendiente'> {
  const f = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM errores_servidor WHERE creado_en > datetime('now', '-1 hour')",
    )
    .first<{ n: number }>();
  return Number(f?.n ?? 0) > 0 ? 'pendiente' : 'ok';
}
