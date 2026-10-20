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

export async function guardarError(db: D1Database, metodo: string, ruta: string, err: unknown) {
  const e = err instanceof Error ? err : new Error(String(err));
  await db.batch([
    db
      .prepare('INSERT INTO errores_servidor (metodo, ruta, mensaje, pila) VALUES (?, ?, ?, ?)')
      .bind(
        metodo.slice(0, 10),
        ruta.slice(0, 300),
        e.message.slice(0, 500),
        (e.stack ?? '').split('\n').slice(0, 6).join('\n').slice(0, 1500),
      ),
    db
      .prepare(
        'DELETE FROM errores_servidor WHERE id <= (SELECT MAX(id) FROM errores_servidor) - ?',
      )
      .bind(MAX_GUARDADOS),
  ]);
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
