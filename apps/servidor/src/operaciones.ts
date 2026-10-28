import type { Env } from './env';
import { candidatosCercanos, avisarTiempoReal } from './rutas/interno';
import { distanciaKm } from '@tumbite/compartido';
import { comisionConductor } from './finanzas/conductor';

/**
 * Fase 3 · Exclusividad y asignación (docs/FASE-3-EXCLUSIVIDAD-ASIGNACION.md; V1.2 §3 y §5).
 *
 * Reglas que cuida la BASE (no este archivo):
 *   - Un conductor ocupa UNA fila en conductor_ocupacion: comida (varios pedidos agrupados) u
 *     operación (una sola). Lo incompatible aborta la sentencia entera.
 *   - Aceptar es UNA sentencia con RETURNING: dos conductores a la vez → uno solo gana.
 *   - Cada cambio de viaje exige una transición permitida para ese actor y una clave NUEVA.
 *
 * Moto y Carro siguen apagados: ninguna ruta pública crea operaciones (solo las pruebas del
 * sitio de pruebas). Comida no usa nada de este archivo.
 */

export type ResultadoAceptar =
  | { resultado: 'tomada' | 'ya_es_tuya'; operacionId: string; version: number }
  | { resultado: 'otro_conductor' | 'no_disponible' | 'ocupado' };

/** Segundos que dura una oferta de operación antes de pasar al siguiente conductor. */
export const SEGUNDOS_OFERTA_OPERACION = 30;
/** El servicio del catálogo en la capa financiera (C-FIN-POLITICAS). */
const SERVICIO_FINANCIERO = new Map<string, 'ride' | 'car'>([
  ['moto', 'ride'],
  ['carro', 'car'],
]);
/** Sin ubicación por este tiempo, un viaje asignado (sin iniciar) vuelve a buscar conductor. */
export const MINUTOS_SIN_SENAL = 5;
/** Cuánto busca conductor un viaje antes de cerrarse como «sin conductor» (M2). */
export const MINUTOS_SIN_CONDUCTOR = 10;
/** Ubicación más vieja que esto no cuenta para ofrecer. */
const MINUTOS_UBICACION_VIGENTE = 2;
const KM_MAXIMO_OFERTA = 15;

/** El error de la base que significa «ese conductor ya está ocupado». */
export function esConductorOcupado(e: unknown): boolean {
  const m = String((e as { message?: string })?.message ?? e);
  return (
    m.includes('conductor_ocupado_en_otra_operacion') ||
    m.includes('conductor_ocupacion') ||
    m.includes('operaciones_una_activa') ||
    m.includes('operaciones.conductor_id') ||
    m.includes('no_se_cambia_vehiculo_en_operacion')
  );
}

/**
 * Aceptar una oferta de operación. UNA sentencia: o este conductor se la lleva (con su asignación,
 * su evento, su ocupación y las demás ofertas retiradas) o no pasa nada. La misma solicitud
 * repetida (misma clave) responde igual que la primera vez, sin repetir efectos.
 */
export async function aceptarOperacion(
  db: D1Database,
  a: { operacionId: string; conductorId: string; vehiculoId: string; clave: string },
): Promise<ResultadoAceptar> {
  let fila: { id: string; version: number } | null;
  try {
    fila = await db
      .prepare(
        `UPDATE operaciones
            SET conductor_id = ?2, vehiculo_id = ?3, ultima_clave = ?4, actualizado_en = datetime('now')
          WHERE id = ?1 AND estado_general = 'buscando' AND conductor_id IS NULL
            AND EXISTS (SELECT 1 FROM ofertas_operacion o
                         WHERE o.operacion_id = ?1 AND o.conductor_id = ?2 AND o.vehiculo_id = ?3
                           AND o.estado = 'ofrecida' AND o.expira_en > datetime('now'))
            AND EXISTS (SELECT 1 FROM conductores_elegibles e
                         WHERE e.conductor_id = ?2 AND e.vehiculo_id = ?3
                           AND e.servicio_id = operaciones.servicio_id AND e.zona_id = operaciones.zona_id)
         RETURNING id, version`,
      )
      .bind(a.operacionId, a.conductorId, a.vehiculoId, a.clave)
      .first<{ id: string; version: number }>();
  } catch (e) {
    if (esConductorOcupado(e)) return { resultado: 'ocupado' };
    throw e;
  }
  if (fila) return { resultado: 'tomada', operacionId: fila.id, version: Number(fila.version) };
  const r = await db
    .prepare(
      `SELECT CASE
                WHEN o.conductor_id = ?2 AND o.estado_general IN ('asignada', 'en_curso') THEN 'ya_es_tuya'
                WHEN o.conductor_id IS NOT NULL THEN 'otro_conductor'
                ELSE 'no_disponible' END AS resultado, o.version
         FROM operaciones o WHERE o.id = ?1`,
    )
    .bind(a.operacionId, a.conductorId)
    .first<{ resultado: 'ya_es_tuya' | 'otro_conductor' | 'no_disponible'; version: number }>();
  if (!r) return { resultado: 'no_disponible' };
  if (r.resultado === 'ya_es_tuya')
    return { resultado: 'ya_es_tuya', operacionId: a.operacionId, version: Number(r.version) };
  // Si no la tomó porque ya está ocupado con otra cosa, se le dice eso (no «otro la tomó»).
  if (r.resultado === 'no_disponible') {
    const ocupado = await db
      .prepare('SELECT 1 FROM conductor_ocupacion WHERE conductor_id = ?')
      .bind(a.conductorId)
      .first();
    if (ocupado) return { resultado: 'ocupado' };
  }
  return { resultado: r.resultado };
}

/** El conductor se baja antes de iniciar: el viaje vuelve a buscar. UNA sentencia. */
export async function liberarViaje(
  db: D1Database,
  a: { operacionId: string; conductorId: string; motivo: string; clave: string },
): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE viajes
          SET estado = 'buscando', liberaciones = liberaciones + 1,
              ultimo_actor = 'conductor', ultimo_actor_id = ?2, ultima_clave = ?4, motivo_transicion = ?3
        WHERE operacion_id = ?1 AND estado IN ('asignado', 'conductor_llego')
          AND (SELECT conductor_id FROM operaciones WHERE id = ?1) = ?2`,
    )
    .bind(a.operacionId, a.conductorId, a.motivo.slice(0, 200), a.clave)
    .run();
  return Boolean(r.meta.changes);
}

export type ActorViaje = 'cliente' | 'conductor' | 'soporte' | 'sistema';

/**
 * Cualquier otra transición (llegó, inició, terminó, canceló, no se presentó, sin conductor).
 * La base rechaza lo no permitido y lo hecho sin clave nueva. Devuelve si cambió.
 */
export async function cambiarEstadoViaje(
  db: D1Database,
  a: {
    operacionId: string;
    desde: string;
    hacia: string;
    actor: ActorViaje;
    actorId: string | null;
    clave: string;
    motivo?: string;
  },
): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE viajes
          SET estado = ?2, ultimo_actor = ?3, ultimo_actor_id = ?4, ultima_clave = ?5, motivo_transicion = ?6
        WHERE operacion_id = ?1 AND estado = ?7`,
    )
    .bind(
      a.operacionId,
      a.hacia,
      a.actor,
      a.actorId,
      a.clave,
      (a.motivo ?? '').slice(0, 200),
      a.desde,
    )
    .run();
  return Boolean(r.meta.changes);
}

type Candidato = { conductorId: string; vehiculoId: string; km: number; puntos: number };

/**
 * Conductores a quienes ofrecer una operación, del más cercano al más lejano. Primero pregunta al
 * tiempo real (Fase 2: posiciones en memoria, las más frescas); si no está configurado o falla,
 * usa la última ubicación guardada en la base (el mecanismo de siempre). En los dos casos, solo
 * quien está ELEGIBLE (servicio, zona, vehículo aprobado, documentos vigentes, habilitación,
 * preferencias, sin bloqueo) y LIBRE (sin ocupación ni oferta abierta).
 */
export async function candidatosParaOperacion(
  env: Env | undefined,
  db: D1Database,
  op: { id: string; servicioId: string; zonaId: string; lat: number; lng: number },
  hacer: typeof fetch = fetch,
): Promise<{ candidatos: Candidato[]; fuente: 'tiempo_real' | 'base' }> {
  const { results } = await db
    .prepare(
      `SELECT e.conductor_id, e.vehiculo_id, e.lat, e.lng, e.puntos FROM conductores_elegibles e
        WHERE e.servicio_id = ? AND e.zona_id = ? AND e.lat IS NOT NULL
          AND e.ubicacion_en > datetime('now', ?)
          AND NOT EXISTS (SELECT 1 FROM conductor_ocupacion c WHERE c.conductor_id = e.conductor_id)
          AND NOT EXISTS (SELECT 1 FROM ofertas_operacion o WHERE o.conductor_id = e.conductor_id AND o.estado = 'ofrecida')
          AND NOT EXISTS (SELECT 1 FROM ofertas f WHERE f.repartidor_id = e.conductor_id AND f.estado = 'ofrecida')
          AND NOT EXISTS (SELECT 1 FROM ofertas_operacion v WHERE v.operacion_id = ? AND v.conductor_id = e.conductor_id)`,
    )
    .bind(op.servicioId, op.zonaId, `-${MINUTOS_UBICACION_VIGENTE} minutes`, op.id)
    .all<{ conductor_id: string; vehiculo_id: string; lat: number; lng: number; puntos: number }>();
  const porId = new Map(results.map((r) => [r.conductor_id, r]));
  if (!porId.size) return { candidatos: [], fuente: 'base' };

  const cercanos = env ? await candidatosCercanos(env, op.zonaId, op.lat, op.lng, 50, hacer) : null;
  if (cercanos) {
    const lista = cercanos
      .filter((c) => porId.has(c.c) && c.km <= KM_MAXIMO_OFERTA)
      .map((c) => {
        const f = porId.get(c.c)!;
        return { conductorId: c.c, vehiculoId: f.vehiculo_id, km: c.km, puntos: f.puntos };
      });
    // El tiempo real solo ve a quien tiene la app abierta; si no ve a nadie elegible, respaldo.
    if (lista.length) return { candidatos: lista, fuente: 'tiempo_real' };
  }
  const lista = results
    .map((r) => ({
      conductorId: r.conductor_id,
      vehiculoId: r.vehiculo_id,
      km: distanciaKm({ lat: r.lat, lng: r.lng }, { lat: op.lat, lng: op.lng }),
      puntos: r.puntos,
    }))
    .filter((c) => c.km <= KM_MAXIMO_OFERTA)
    .sort((a, b) => a.km - b.km || b.puntos - a.puntos);
  return { candidatos: lista, fuente: 'base' };
}

/**
 * Tarea del reloj (cada minuto): vence ofertas viejas, ofrece cada operación que busca a su mejor
 * candidato, y devuelve a «buscando» los viajes asignados cuyo conductor perdió la señal.
 * En producción no hay operaciones: no hace nada.
 */
export async function repartirOperaciones(
  env: Env | undefined,
  db: D1Database,
  hacer: typeof fetch = fetch,
) {
  await db
    .prepare(
      "UPDATE ofertas_operacion SET estado = 'vencida', respondida_en = datetime('now') WHERE estado = 'ofrecida' AND expira_en <= datetime('now')",
    )
    .run();
  // Recuperación: un conductor sin señal no deja un viaje secuestrado.
  const { results: sinSenal } = await db
    .prepare(
      `SELECT v.operacion_id, o.conductor_id FROM viajes v JOIN operaciones o ON o.id = v.operacion_id
         JOIN repartidores d ON d.usuario_id = o.conductor_id
        WHERE v.estado = 'asignado' AND (d.ubicacion_en IS NULL OR d.ubicacion_en < datetime('now', ?))
          AND v.asignado_en < datetime('now', ?)`,
    )
    .bind(`-${MINUTOS_SIN_SENAL} minutes`, `-${MINUTOS_SIN_SENAL} minutes`)
    .all<{ operacion_id: string; conductor_id: string }>();
  let liberados = 0;
  for (const s of sinSenal) {
    const ok = await cambiarEstadoViaje(db, {
      operacionId: s.operacion_id,
      desde: 'asignado',
      hacia: 'buscando',
      actor: 'sistema',
      actorId: null,
      clave: `sin-senal:${s.operacion_id}:${s.conductor_id}:${Date.now()}`,
      motivo: 'sin_senal',
    });
    if (ok) liberados++;
  }
  // M2: un viaje que lleva demasiado buscando (desde que empezó a buscar, también tras una
  // liberación) se cierra como «sin conductor» y el pasajero lo ve en vez de esperar para siempre.
  const { results: vencidos } = await db
    .prepare(
      `SELECT o.id FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
        WHERE o.estado_general = 'buscando' AND v.estado = 'buscando'
          AND COALESCE((SELECT MAX(e.creado_en) FROM eventos_operacion e
                         WHERE e.operacion_id = o.id AND e.estado_nuevo = 'buscando'), o.creado_en)
              < datetime('now', ?)
        LIMIT 50`,
    )
    .bind(`-${MINUTOS_SIN_CONDUCTOR} minutes`)
    .all<{ id: string }>();
  for (const v of vencidos)
    await cambiarEstadoViaje(db, {
      operacionId: v.id,
      desde: 'buscando',
      hacia: 'sin_conductor',
      actor: 'sistema',
      actorId: null,
      clave: `sin-conductor:${v.id}`,
      motivo: 'sin_conductor',
    });
  const { results: buscando } = await db
    .prepare(
      `SELECT o.id, o.servicio_id, o.zona_id, v.origen_lat, v.origen_lng, q.total, q.moneda, z.pais
         FROM operaciones o
         JOIN viajes v ON v.operacion_id = o.id
         LEFT JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id
         LEFT JOIN zonas z ON z.id = o.zona_id
        WHERE o.estado_general = 'buscando'
          AND NOT EXISTS (SELECT 1 FROM ofertas_operacion f WHERE f.operacion_id = o.id AND f.estado = 'ofrecida')
        ORDER BY o.creado_en LIMIT 20`,
    )
    .all<{
      id: string;
      servicio_id: string;
      zona_id: string;
      origen_lat: number;
      origen_lng: number;
      total: number | null;
      moneda: string | null;
      pais: string | null;
    }>();
  let ofrecidas = 0;
  const yaOfrecidos = new Set<string>();
  for (const op of buscando) {
    const { candidatos, fuente } = await candidatosParaOperacion(
      env,
      db,
      {
        id: op.id,
        servicioId: op.servicio_id,
        zonaId: op.zona_id,
        lat: op.origen_lat,
        lng: op.origen_lng,
      },
      hacer,
    );
    const elegido = candidatos.find((c) => !yaOfrecidos.has(c.conductorId));
    if (!elegido) continue;
    // La condición repite la regla de «libre» en la MISMA sentencia: si entre la consulta y aquí
    // el conductor tomó otra cosa, la oferta no se crea.
    // M3 (C-OFERTA-COMPLETA): el conductor ve cuánto gana antes de aceptar, como en Uber: el
    // precio fijo del viaje menos la comisión de la política de Divoox que rija (si rige).
    const ganancia =
      op.total != null && op.moneda && op.pais
        ? op.total -
          ((
            await comisionConductor(db, {
              servicio: SERVICIO_FINANCIERO.get(op.servicio_id) ?? 'ride',
              pais: op.pais,
              ciudad: op.zona_id,
              moneda: op.moneda,
              valor: op.total,
            }).catch((e: unknown) => {
              console.error('operaciones: comisión de la oferta', e);
              return null;
            })
          )?.monto ?? 0)
        : 0;
    const r = await db
      .prepare(
        `INSERT INTO ofertas_operacion (operacion_id, conductor_id, vehiculo_id, estado, expira_en, ganancia_centavos)
         SELECT ?1, ?2, ?3, 'ofrecida', datetime('now', ?4), ?5
          WHERE NOT EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = ?2)
            AND NOT EXISTS (SELECT 1 FROM ofertas_operacion WHERE conductor_id = ?2 AND estado = 'ofrecida')
            AND EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND estado_general = 'buscando')
         ON CONFLICT(operacion_id, conductor_id) DO NOTHING`,
      )
      .bind(
        op.id,
        elegido.conductorId,
        elegido.vehiculoId,
        `+${SEGUNDOS_OFERTA_OPERACION} seconds`,
        Math.max(0, ganancia),
      )
      .run();
    if (!r.meta.changes) continue;
    yaOfrecidos.add(elegido.conductorId);
    ofrecidas++;
    if (env)
      await avisarTiempoReal(
        env,
        op.zona_id,
        [
          {
            id: `oferta-op:${op.id}:${elegido.conductorId}`,
            para: { usuarios: [elegido.conductorId] },
            datos: { tipo: 'oferta_operacion', operacionId: op.id, km: elegido.km, fuente },
          },
        ],
        hacer,
      );
  }
  return { ofrecidas, liberados };
}

/** Los disparadores que sostienen la exclusividad (esquemaFase3.ts). Si falta uno, la salud lo dice. */
export const DISPARADORES_EXCLUSIVIDAD = [
  'pedidos_ocupa_conductor',
  'pedidos_libera_por_estado',
  'pedidos_libera_al_soltar',
  'pedidos_reactiva_ocupa',
  'pedidos_reasigna_ocupa',
  'pedidos_ocupa_al_crear',
  'pedidos_libera_al_borrar',
  'operaciones_ocupa_conductor',
  'operaciones_al_asignar',
  'operaciones_libera_conductor',
  'operaciones_libera_al_terminar',
  'operaciones_estado_coherente',
  'operaciones_conductor_coherente',
  'viajes_transicion_valida',
  'viajes_actor_solo_con_transicion',
  'viajes_al_cambiar_estado',
  'repartidores_vehiculo_fijo_en_operacion',
] as const;

/** Pieza «exclusividad» de la salud: todos los disparadores puestos y cero inconsistencias. */
export async function saludExclusividad(db: D1Database): Promise<'ok' | 'error'> {
  const d = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name IN (${DISPARADORES_EXCLUSIVIDAD.map(() => '?').join(',')})`,
    )
    .bind(...DISPARADORES_EXCLUSIVIDAD)
    .first<{ n: number }>();
  if (Number(d?.n) !== DISPARADORES_EXCLUSIVIDAD.length) return 'error';
  const f = await db
    .prepare('SELECT COUNT(*) AS n FROM inconsistencias_operaciones')
    .first<{ n: number }>();
  return Number(f?.n ?? 0) === 0 ? 'ok' : 'error';
}
