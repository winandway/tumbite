import type { Env } from './env';
import { notificar } from './notificaciones';

/**
 * C-SERVICIO-SIN-OFERTA (23 nov 2026, Richard) — todos los países. En cada ciudad se arranca por motos,
 * después restaurantes (cuando ya hay transporte) y al final los clientes. Comida aparece sola en
 * Driver cuando la zona tiene al menos un restaurante aprobado; antes no se ofrece ni deja conectarse
 * (un conductor quedó «conectado a Comida» esperando pedidos en un pueblo sin restaurantes).
 */
export const MENSAJE_SIN_RESTAURANTES =
  'Todavía no hay restaurantes en tu zona. Te avisamos cuando abra el primero.';

/** ¿Hay algún restaurante aprobado en la zona del conductor? (una lectura por índice). */
export async function hayRestaurantesDelConductor(db: D1Database, conductorId: string) {
  return Boolean(
    await db
      .prepare(
        `SELECT 1 FROM restaurantes r JOIN repartidores d ON d.usuario_id = ?
          WHERE r.zona_id = d.zona_id AND r.estado = 'aprobado' LIMIT 1`,
      )
      .bind(conductorId)
      .first(),
  );
}

/**
 * El PRIMER restaurante aprobado de una zona: a los conductores de esa zona les llega un aviso (una
 * sola vez en la vida de la zona: solo si este es el único aprobado). Tope de 500 avisos.
 */
export async function avisarComidaAbierta(env: Env, db: D1Database, zonaId: string) {
  try {
    const n = await db
      .prepare("SELECT COUNT(*) AS n FROM restaurantes WHERE zona_id = ? AND estado = 'aprobado'")
      .bind(zonaId)
      .first<{ n: number }>();
    if (Number(n?.n) !== 1) return 0;
    const { results } = await db
      .prepare(
        `SELECT d.usuario_id AS id FROM repartidores d JOIN usuarios u ON u.id = d.usuario_id
          WHERE d.zona_id = ? AND u.activo = 1 AND u.rol = 'repartidor' LIMIT 500`,
      )
      .bind(zonaId)
      .all<{ id: string }>();
    for (const r of results)
      await notificar(env, db, r.id, (i) => ({
        titulo: i === 'en' ? 'Food is open in your area' : 'Ya hay Comida en tu zona',
        cuerpo:
          i === 'en'
            ? 'The first restaurant in your area is open. You can now turn on Food in Divoox Driver.'
            : 'Abrió el primer restaurante de tu zona. Ya puedes encender Comida en Divoox Driver.',
        datos: { tipo: 'comida_abierta' },
      })).catch((e: unknown) => console.error('comida abierta: aviso', String(e)));
    return results.length;
  } catch (e) {
    console.error('comida abierta', String(e));
    return 0;
  }
}
