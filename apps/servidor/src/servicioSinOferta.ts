import type { Env } from './env';
import { sqlAptos } from './aprobadosNoElegibles';
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

/**
 * C-SERVICIO-SIN-OFERTA, lado del cliente (23 nov 2026, Tucaní) — todos los países. Los servicios
 * que el cliente solo puede pedir si en la zona hay quien los tome: Envíos estaba abierto y con tarifa
 * en Tucaní, nadie lo tomaba y la app de clientes lo ofrecía igual (el pedido quedaba «buscando»).
 */
export const SERVICIOS_CON_CONDUCTOR = new Set(['envios']);

/**
 * ¿Hay en la zona al menos un conductor que el reparto tomaría para ese servicio con solo abrir
 * Driver? Es la MISMA vista `conductores_elegibles` sin «conectado» (`sqlAptos`), nunca una regla
 * aparte. Solo lee: los conductores de esa zona por su índice, una consulta.
 */
export async function hayQuienLoTome(db: D1Database, zonaId: string, servicioId: string) {
  const aptos = sqlAptos(undefined, 'dz');
  return Boolean(
    await db
      .prepare(
        `WITH dz AS (SELECT usuario_id AS id FROM repartidores WHERE zona_id = ?)
         SELECT 1 FROM (${aptos}) a WHERE a.servicio_id = ? LIMIT 1`,
      )
      .bind(zonaId, servicioId)
      .first(),
  );
}

/**
 * C-SERVICIO-SIN-OFERTA, Comida y tiendas al cliente (24 nov 2026, ensayo general en Tucaní) — todos
 * los países. Comida en una zona sin restaurantes llevaba a «No restaurants in your area yet. Coming
 * soon!». Cada servicio de comercios se ofrece solo donde hay al menos uno aprobado de su tipo (el
 * mismo `tipo_comercio` que usa el catálogo).
 */
export const COMERCIOS_DE_SERVICIO: ReadonlyMap<string, readonly string[]> = new Map([
  ['comida', ['restaurante']],
  ['mercado', ['mercado', 'conveniencia']],
  ['farmacia', ['farmacia']],
  ['licores', ['licores']],
]);

/** ¿Hay en la zona algún comercio aprobado de ese servicio? Una lectura por el índice de la zona. */
export async function hayComerciosEnZona(db: D1Database, zonaId: string, servicioId: string) {
  const tipos = COMERCIOS_DE_SERVICIO.get(servicioId);
  if (!tipos) return true;
  return Boolean(
    await db
      .prepare(
        `SELECT 1 FROM restaurantes WHERE zona_id = ? AND estado = 'aprobado'
            AND tipo_comercio IN (${tipos.map(() => '?').join(', ')}) LIMIT 1`,
      )
      .bind(zonaId, ...tipos)
      .first(),
  );
}
