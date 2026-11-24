import { cuantosHay } from './canarioLecturas';
import { liberarRegalo } from './regalosDivoox';
import type { Env } from './env';
import { candidatosCercanos, avisarTiempoReal } from './rutas/interno';
import {
  CONFIANZA,
  PLAZAS_XL,
  type TamanoPaquete,
  acercaAlDestino,
  distanciaKm,
  cuentasQueReciben,
  esPagoACelular,
  formatearMonto,
  vehiculoLlevaPaquete,
} from '@tumbite/compartido';
import { destinosActivos } from './modoDestino';
import { comisionConductor, devolverReservaViaje } from './finanzas/conductor';
import { SQL_TARIFA_SERVICIO } from './finanzas/quienPaga';
import { soltarCobroViaje } from './viajesCobro';
import { parejasBloqueadas } from './rutas/moderacion';
import { notificar } from './notificaciones';

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
/**
 * C-REOFERTA-VENCIDA (18 nov 2026, todos los países): quien dejó VENCER la oferta de un viaje (no la
 * vio: app en segundo plano, sin señal) vuelve a recibirla pasado este respiro, después de los que
 * todavía no la vieron. Quien la RECHAZÓ no la recibe otra vez. Antes, una oferta perdida dejaba al
 * pasajero «buscando» hasta el cierre sin conductor si no había otro conductor en la ciudad.
 */
export const SEGUNDOS_RESPIRO_REOFERTA = 30;
/**
 * C-REOFERTA-TOPE (revisor, 18 nov 2026): como mucho tres ofertas del mismo viaje al mismo
 * conductor (la primera y dos vueltas). Sin tope, un conductor que ignora la oferta la recibía cada
 * minuto durante los 10 minutos de búsqueda, con sonido. El aviso al celular va solo en la primera
 * y en la primera vuelta (`AVISOS_POR_CONDUCTOR`).
 */
export const OFERTAS_POR_CONDUCTOR = 3;
export const AVISOS_POR_CONDUCTOR = 2;
/**
 * SQL: «este conductor puede recibir (otra vez) la oferta de esta operación». Una «ofrecida» ya
 * vencida cuenta como vencida: sin reloj, nadie la marcó todavía.
 */
export function puedeRecibirOferta(op: string, conductor: string): string {
  return `NOT EXISTS (SELECT 1 FROM ofertas_operacion v WHERE v.operacion_id = ${op} AND v.conductor_id = ${conductor}
     AND NOT (v.estado IN ('vencida', 'ofrecida') AND v.expira_en <= datetime('now', '-${SEGUNDOS_RESPIRO_REOFERTA} seconds')
              AND v.intentos < ${OFERTAS_POR_CONDUCTOR}))`;
}
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
export const MINUTOS_UBICACION_VIGENTE = 2;
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
    /**
     * C-VIAJE-PARADAS: el cambio no pasa si queda una parada por hacer (o detenido en una). Va en la
     * MISMA sentencia: una parada agregada en ese instante no se queda sin hacer en un viaje terminado.
     */
    sinParadasPendientes?: boolean;
  },
): Promise<boolean> {
  const sinParadas = a.sinParadasPendientes
    ? ` AND NOT EXISTS (SELECT 1 FROM paradas_viaje p WHERE p.operacion_id = ?1 AND p.estado IN ('pendiente', 'en_parada'))`
    : '';
  const r = await db
    .prepare(
      `UPDATE viajes
          SET estado = ?2, ultimo_actor = ?3, ultimo_actor_id = ?4, ultima_clave = ?5, motivo_transicion = ?6
        WHERE operacion_id = ?1 AND estado = ?7${sinParadas}`,
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

type Candidato = {
  conductorId: string;
  vehiculoId: string;
  km: number;
  puntos: number;
  /** Última ubicación guardada (para el modo destino). */
  lat: number;
  lng: number;
  /** C-REOFERTA-VENCIDA: ya tuvo (y dejó vencer) esta oferta; va después de los que no la vieron. */
  visto?: boolean;
};

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
      `SELECT e.conductor_id, e.vehiculo_id, e.lat, e.lng, e.puntos,
              EXISTS (SELECT 1 FROM ofertas_operacion w WHERE w.operacion_id = ? AND w.conductor_id = e.conductor_id) AS visto
         FROM conductores_elegibles e
        WHERE e.servicio_id = ? AND e.zona_id = ? AND e.lat IS NOT NULL
          AND e.ubicacion_en > datetime('now', ?)
          AND NOT EXISTS (SELECT 1 FROM conductor_ocupacion c WHERE c.conductor_id = e.conductor_id)
          AND NOT EXISTS (SELECT 1 FROM ofertas_operacion o WHERE o.conductor_id = e.conductor_id AND o.estado = 'ofrecida')
          AND NOT EXISTS (SELECT 1 FROM ofertas f WHERE f.repartidor_id = e.conductor_id AND f.estado = 'ofrecida')
          -- C-REOFERTA-VENCIDA: fuera quien la rechazó o la tiene; vuelve quien la dejó vencer.
          AND ${puedeRecibirOferta('?', 'e.conductor_id')}
          -- C-CARRO-XL: un viaje XL solo va a un carro de 6 plazas o más.
          AND (COALESCE((SELECT x.categoria FROM viajes x WHERE x.operacion_id = ?), 'estandar') <> 'xl'
               OR (SELECT h.plazas FROM vehiculos h WHERE h.id = e.vehiculo_id) >= ?)
          -- C-CARRO-CATEGORIAS: un viaje Comfort o Premium solo va a un carro de esa categoría o de una
          -- mejor; un carro mejor recibe los viajes de abajo solo si su conductor no lo apagó.
          AND (e.servicio_id <> 'carro' OR EXISTS (
                SELECT 1 FROM vehiculos h, (SELECT CASE COALESCE((SELECT x.categoria FROM viajes x WHERE x.operacion_id = ?), 'estandar')
                                                     WHEN 'premium' THEN 2 WHEN 'comfort' THEN 1 ELSE 0 END AS pedido) p
                 WHERE h.id = e.vehiculo_id
                   AND ((CASE h.categoria WHEN 'premium' THEN 2 WHEN 'comfort' THEN 1 ELSE 0 END) = p.pedido
                     OR ((CASE h.categoria WHEN 'premium' THEN 2 WHEN 'comfort' THEN 1 ELSE 0 END) > p.pedido
                         AND h.acepta_menores = 1))))`,
    )
    .bind(
      op.id,
      op.servicioId,
      op.zonaId,
      `-${MINUTOS_UBICACION_VIGENTE} minutes`,
      op.id,
      op.id,
      PLAZAS_XL,
      op.id,
    )
    .all<{
      conductor_id: string;
      vehiculo_id: string;
      lat: number;
      lng: number;
      puntos: number;
      visto: number;
    }>();
  const porId = new Map(results.map((r) => [r.conductor_id, r]));
  if (!porId.size) return { candidatos: [], fuente: 'base' };

  const cercanos = env ? await candidatosCercanos(env, op.zonaId, op.lat, op.lng, 50, hacer) : null;
  if (cercanos) {
    const lista = cercanos
      .filter((c) => porId.has(c.c) && c.km <= KM_MAXIMO_OFERTA)
      .map((c) => {
        const f = porId.get(c.c)!;
        return {
          conductorId: c.c,
          vehiculoId: f.vehiculo_id,
          km: c.km,
          puntos: f.puntos,
          lat: Number(f.lat),
          lng: Number(f.lng),
          visto: f.visto === 1,
        };
      })
      // C-REOFERTA-VENCIDA: primero quien no la vio (el orden por cercanía se mantiene dentro).
      .sort((a, b) => Number(a.visto) - Number(b.visto));
    // El tiempo real solo ve a quien tiene la app abierta; si no ve a nadie elegible, respaldo.
    if (lista.length) return { candidatos: lista, fuente: 'tiempo_real' };
  }
  const lista = results
    .map((r) => ({
      conductorId: r.conductor_id,
      vehiculoId: r.vehiculo_id,
      km: distanciaKm({ lat: r.lat, lng: r.lng }, { lat: op.lat, lng: op.lng }),
      puntos: r.puntos,
      lat: Number(r.lat),
      lng: Number(r.lng),
      visto: r.visto === 1,
    }))
    .filter((c) => c.km <= KM_MAXIMO_OFERTA)
    .sort((a, b) => Number(a.visto) - Number(b.visto) || a.km - b.km || b.puntos - a.puntos);
  return { candidatos: lista, fuente: 'base' };
}

/** De estos conductores, los que NO tienen saldo prepago para `comision` (una sola consulta). */
export async function sinSaldoPara(
  db: D1Database,
  ids: string[],
  pais: string,
  moneda: string,
  comision: number,
): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { results } = await db
    .prepare(
      `SELECT cuenta_id, COALESCE(SUM(monto), 0) AS saldo FROM libro
        WHERE bolsillo = 'prepago' AND pais = ? AND moneda = ? AND cuenta_id IN (${ids.map(() => '?').join(',')})
        GROUP BY cuenta_id`,
    )
    .bind(pais, moneda, ...ids)
    .all<{ cuenta_id: string; saldo: number }>();
  const saldo = new Map(results.map((r) => [r.cuenta_id, Number(r.saldo)]));
  return new Set(ids.filter((id) => (saldo.get(id) ?? 0) < comision));
}

/** De estos conductores, los que tienen una cuenta de pago móvil activa en ese país. */
export async function conductoresConPagoMovil(
  db: D1Database,
  ids: string[],
  pais: string,
  /** C-PAGO-A-CELULAR: el método del viaje (pago móvil, Yape o Plin; Yape y Plin se reciben entre sí). */
  metodo: string = 'pago_movil',
): Promise<Set<string>> {
  const tipos = cuentasQueReciben(metodo);
  if (!ids.length || !tipos.length) return new Set();
  const { results } = await db
    .prepare(
      `SELECT DISTINCT usuario_id FROM cuentas_cobro WHERE tipo IN (${tipos.map(() => '?').join(',')})
          AND pais = ? AND activa = 1
          AND activa_desde <= datetime('now') AND usuario_id IN (${ids.map(() => '?').join(',')})`,
    )
    .bind(...tipos, pais, ...ids)
    .all<{ usuario_id: string }>();
  return new Set(results.map((r) => r.usuario_id));
}

/**
 * Tarea del reloj (cada minuto): vence ofertas viejas, ofrece cada operación que busca a su mejor
 * candidato, y devuelve a «buscando» los viajes asignados cuyo conductor perdió la señal.
 * En producción no hay operaciones: no hace nada.
 */
/** C-VIAJE-PROGRAMADO: el aviso al pasajero cuando su viaje reservado se queda sin conductor. */
async function avisarProgramadoSinConductor(
  env: Env,
  db: D1Database,
  operacionId: string,
  clienteId: string,
) {
  await notificar(env, db, clienteId, (i) => ({
    ...(i === 'en'
      ? {
          titulo: 'No driver for your scheduled ride',
          cuerpo: 'We couldn’t find a driver in time. It was canceled at no charge.',
        }
      : {
          titulo: 'No hubo conductor para tu viaje programado',
          cuerpo: 'No encontramos conductor a tiempo. Se canceló sin cargo.',
        }),
    datos: { tipo: 'viaje', viajeId: operacionId },
  })).catch((e: unknown) => console.error('viajes programados: aviso sin conductor', e));
}

/** C-ENVIO-TAMANO: el vehículo activo de cada candidato (tipo y si la moto lleva cajón). */
async function vehiculosActivos(db: D1Database, conductores: string[]) {
  const mapa = new Map<string, { tipo: string; conCajon: boolean }>();
  if (!conductores.length) return mapa;
  const { results } = await db
    .prepare(
      `SELECT r.usuario_id, v.tipo, v.con_cajon FROM repartidores r JOIN vehiculos v ON v.id = r.vehiculo_activo_id
        WHERE r.usuario_id IN (${conductores.map(() => '?').join(',')})`,
    )
    .bind(...conductores)
    .all<{ usuario_id: string; tipo: string; con_cajon: number }>();
  for (const f of results) mapa.set(f.usuario_id, { tipo: f.tipo, conCajon: f.con_cajon === 1 });
  return mapa;
}

/** C-VIAJES-FIJOS: de estos vehículos, los que aceptan llevar menores. */
async function vehiculosConMenores(db: D1Database, vehiculos: string[]): Promise<Set<string>> {
  if (!vehiculos.length) return new Set();
  const { results } = await db
    .prepare(
      `SELECT id FROM vehiculos WHERE lleva_menores = 1 AND id IN (${vehiculos.map(() => '?').join(',')})`,
    )
    .bind(...vehiculos)
    .all<{ id: string }>();
  return new Set(results.map((r) => r.id));
}

/** Minutos de ubicación que le valen al conductor de confianza (puede tener la app en segundo plano). */
const MINUTOS_UBICACION_CONFIANZA = 10;

type OpConfianza = {
  id: string;
  servicio_id: string;
  zona_id: string;
  cliente_id: string;
  origen_lat: number;
  origen_lng: number;
  total: number | null;
  /** C-QUIEN-PAGA-VIAJES: la tarifa de servicio del pasajero (ya sumada en `total`). */
  tarifa_servicio: number;
  moneda: string | null;
  pais: string | null;
  metodo_pago: string | null;
  tamano: TamanoPaquete | null;
  conductor_preferido_id: string | null;
  programado_para: string | null;
  menor_nombre: string | null;
};

/**
 * C-CONDUCTOR-CONFIANZA (16 nov 2026, todos los países): el turno del conductor de confianza.
 * - «ofrecida»: se le acaba de ofrecer, solo a él, por un minuto.
 * - «esperar»: no está libre ahora, pero es un viaje programado o fijo y todavía falta para la hora:
 *   se le guarda hasta 5 minutos antes (nadie más lo ve).
 * - «libre»: ya se le ofreció (lo rechazó o se le venció), o no está y es para ya: pasa a los demás.
 * Copiado de Uber (favorito primero en los programados; si no acepta, pasa a otros sin castigo) [DOC].
 */
export async function turnoDeConfianza(
  env: Env | undefined,
  db: D1Database,
  op: OpConfianza,
  bloqueadas: Map<string, Set<string>>,
  yaOfrecidos: Set<string>,
  hacer: typeof fetch = fetch,
): Promise<'ofrecida' | 'esperar' | 'libre'> {
  const pref = op.conductor_preferido_id;
  if (!pref) return 'libre';
  const ya = await db
    .prepare('SELECT 1 FROM ofertas_operacion WHERE operacion_id = ? AND conductor_id = ?')
    .bind(op.id, pref)
    .first();
  if (ya) return 'libre';
  const hora = op.programado_para ? new Date(`${op.programado_para.replace(' ', 'T')}Z`) : null;
  const guardar =
    hora != null && hora.getTime() - Date.now() > CONFIANZA.guardarHastaMinAntes * 60_000;
  const noEsta = guardar ? 'esperar' : 'libre';
  if (yaOfrecidos.has(pref) || bloqueadas.get(op.cliente_id)?.has(pref)) return noEsta;
  // Elegible para este servicio y ciudad, con señal reciente y libre (sin ocupación ni oferta abierta).
  const e = await db
    .prepare(
      `SELECT e.conductor_id, e.vehiculo_id, e.lat, e.lng, h.lleva_menores FROM conductores_elegibles e
         JOIN vehiculos h ON h.id = e.vehiculo_id
        WHERE e.conductor_id = ?1 AND e.servicio_id = ?2 AND e.zona_id = ?3 AND e.lat IS NOT NULL
          AND e.ubicacion_en > datetime('now', ?4)
          AND NOT EXISTS (SELECT 1 FROM conductor_ocupacion c WHERE c.conductor_id = ?1)
          AND NOT EXISTS (SELECT 1 FROM ofertas_operacion o WHERE o.conductor_id = ?1 AND o.estado = 'ofrecida')
          AND NOT EXISTS (SELECT 1 FROM ofertas f WHERE f.repartidor_id = ?1 AND f.estado = 'ofrecida')
        LIMIT 1`,
    )
    .bind(pref, op.servicio_id, op.zona_id, `-${MINUTOS_UBICACION_CONFIANZA} minutes`)
    .first<{
      conductor_id: string;
      vehiculo_id: string;
      lat: number;
      lng: number;
      lleva_menores: number;
    }>();
  if (!e) return noEsta;
  if (op.menor_nombre && e.lleva_menores !== 1) return 'libre';
  const km = distanciaKm({ lat: e.lat, lng: e.lng }, { lat: op.origen_lat, lng: op.origen_lng });
  if (km > CONFIANZA.kmMaximo) return noEsta;
  if (op.tamano === 'mediano' || op.tamano === 'grande') {
    const v = (await vehiculosActivos(db, [pref])).get(pref);
    if (!v || !vehiculoLlevaPaquete(op.tamano, v)) return 'libre';
  }
  const comision =
    op.total != null && op.moneda && op.pais
      ? ((
          await comisionConductor(db, {
            servicio: SERVICIO_FINANCIERO.get(op.servicio_id) ?? 'ride',
            pais: op.pais,
            ciudad: op.zona_id,
            moneda: op.moneda,
            // C-QUIEN-PAGA-VIAJES: la comisión, sobre el precio del viaje (sin la tarifa de servicio).
            valor: op.total - Number(op.tarifa_servicio ?? 0),
          }).catch(() => null)
        )?.monto ?? 0)
      : 0;
  if (comision > 0 && op.pais && op.moneda) {
    const sin = await sinSaldoPara(db, [pref], op.pais, op.moneda, comision);
    if (sin.has(pref)) return noEsta;
  }
  if (esPagoACelular(op.metodo_pago) && op.pais) {
    const con = await conductoresConPagoMovil(db, [pref], op.pais, op.metodo_pago);
    if (!con.has(pref)) return 'libre';
  }
  const r = await db
    .prepare(
      `INSERT INTO ofertas_operacion (operacion_id, conductor_id, vehiculo_id, estado, expira_en, ganancia_centavos, km)
       SELECT ?1, ?2, ?3, 'ofrecida', datetime('now', ?4), ?5, ?6
        WHERE NOT EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = ?2)
          AND NOT EXISTS (SELECT 1 FROM ofertas_operacion WHERE conductor_id = ?2 AND estado = 'ofrecida')
          AND NOT EXISTS (SELECT 1 FROM ofertas_operacion WHERE operacion_id = ?1 AND estado = 'ofrecida')
          AND EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND estado_general = 'buscando')
       ON CONFLICT(operacion_id, conductor_id) DO NOTHING`,
    )
    .bind(
      op.id,
      pref,
      e.vehiculo_id,
      `+${CONFIANZA.segundosOfertaExclusiva} seconds`,
      Math.max(0, (op.total ?? 0) - comision),
      Number.isFinite(km) ? km : null,
    )
    .run();
  if (!r.meta.changes) return noEsta;
  yaOfrecidos.add(pref);
  if (env) {
    await avisarTiempoReal(
      env,
      op.zona_id,
      [
        {
          id: `oferta-op:${op.id}:${pref}`,
          para: { usuarios: [pref] },
          datos: { tipo: 'oferta_operacion', operacionId: op.id, km, fuente: 'confianza' },
        },
      ],
      hacer,
    );
    // Un aviso al teléfono también: puede tener la app en segundo plano. C-CLIENTE-FIJO-ROTULO: el
    // título dice quién es («Cliente fijo: Marta»), para que le dé prioridad de un vistazo.
    const cliente = await db
      .prepare('SELECT nombre FROM usuarios WHERE id = ?')
      .bind(op.cliente_id)
      .first<{ nombre: string | null }>()
      .catch(() => null);
    const nombre = primerNombre(cliente?.nombre);
    await notificar(env, db, pref, (i) => ({
      ...avisoClienteFijo(i, nombre),
      sonido: 'oferta.wav',
      oferta: true,
      datos: { tipo: 'oferta_operacion', operacionId: op.id, clienteFijo: '1' },
    })).catch((x: unknown) => console.error('confianza: aviso al conductor', x));
  }
  return 'ofrecida';
}

/** El primer nombre de una persona (lo que ve el conductor de su cliente fijo). */
export function primerNombre(nombre: string | null | undefined) {
  return (nombre ?? '').trim().split(/\s+/)[0] ?? '';
}

/**
 * C-CLIENTE-FIJO-ROTULO (24 nov 2026, primera carrera real; todos los países): el aviso de la oferta
 * exclusiva al conductor de confianza dice en el título que es su cliente fijo y quién.
 */
export function avisoClienteFijo(idioma: string, nombre: string) {
  return idioma === 'en'
    ? {
        titulo: nombre ? `Regular rider: ${nombre}` : 'Your regular rider requested you',
        cuerpo: 'You have 1 minute to accept before it goes to other drivers.',
      }
    : {
        titulo: nombre ? `Cliente fijo: ${nombre}` : 'Tu cliente fijo te pidió un viaje',
        cuerpo: 'Tienes 1 minuto para aceptarlo antes de que pase a otros conductores.',
      };
}

/** C-OFERTA-AVISO: el aviso al celular de una oferta de viaje o envío, en el idioma del conductor. */
export function avisoOfertaOperacion(
  idioma: string,
  servicio: string,
  ganancia: number,
  moneda: string,
  km: number,
) {
  const en = idioma === 'en';
  const pago = formatearMonto(Math.round(ganancia), moneda, en ? 'en' : 'es');
  const distancia = Number.isFinite(km) ? km.toFixed(1) : null;
  const envio = servicio === 'envios';
  return {
    titulo: en
      ? `${envio ? 'New delivery' : 'New ride'}: ${pago}`
      : `${envio ? 'Envío nuevo' : 'Viaje nuevo'}: ${pago}`,
    cuerpo: en
      ? `${distancia ? `${distancia} km from you. ` : ''}You have ${SEGUNDOS_OFERTA_OPERACION} seconds to accept it in the app.`
      : `${distancia ? `A ${distancia} km de ti. ` : ''}Tienes ${SEGUNDOS_OFERTA_OPERACION} segundos para aceptarlo en la app.`,
    sonido: 'oferta.wav',
    oferta: true,
    datos: { tipo: 'oferta_operacion' },
  };
}

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
    if (ok) {
      liberados++;
      // M7: lo que había apartado vuelve a su prepago (el viaje no lo hizo).
      await devolverReservaViaje(db, s.operacion_id, s.conductor_id, 'sin_senal');
    }
  }
  // M2: un viaje que lleva demasiado buscando (desde que empezó a buscar, también tras una
  // liberación) se cierra como «sin conductor» y el pasajero lo ve en vez de esperar para siempre.
  // C-VIAJE-PROGRAMADO: un viaje reservado empieza a buscar unos minutos antes de su hora; se
  // cierra «sin conductor» recién a la hora (no antes) y al pasajero se le avisa, sin cargo.
  const { results: vencidos } = await db
    .prepare(
      `SELECT o.id, o.cliente_id, v.programado_para FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
        WHERE o.estado_general = 'buscando' AND v.estado = 'buscando'
          AND COALESCE((SELECT MAX(e.creado_en) FROM eventos_operacion e
                         WHERE e.operacion_id = o.id AND e.estado_nuevo = 'buscando'), o.creado_en)
              < datetime('now', ?)
          AND (v.programado_para IS NULL OR v.programado_para <= datetime('now'))
        LIMIT 50`,
    )
    .bind(`-${MINUTOS_SIN_CONDUCTOR} minutes`)
    .all<{ id: string; cliente_id: string; programado_para: string | null }>();
  for (const v of vencidos)
    if (
      await cambiarEstadoViaje(db, {
        operacionId: v.id,
        desde: 'buscando',
        hacia: 'sin_conductor',
        actor: 'sistema',
        actorId: null,
        clave: `sin-conductor:${v.id}`,
        motivo: 'sin_conductor',
      })
    ) {
      // C-CUPON-DIVOOX: el regalo apartado vuelve al presupuesto del cupón.
      await liberarRegalo(db, v.id, 'sin_conductor');
      // C-VIAJE-TARJETA: sin conductor, la autorización de la tarjeta se anula entera.
      await (env ? soltarCobroViaje(env, db, v.id, 0) : Promise.resolve(0)).catch((e: unknown) =>
        console.error('viajes: anular cobro sin conductor', v.id, e),
      );
      if (env && v.programado_para) await avisarProgramadoSinConductor(env, db, v.id, v.cliente_id);
    }
  // C-VIAJE-TARJETA: un pago que nunca se autorizó (la persona cerró la hoja de pago) no deja el
  // viaje colgado: a los 20 minutos se cancela y se anula el intento.
  const { results: sinPagar } = await db
    .prepare(
      `SELECT o.id FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
        WHERE v.estado = 'pago_pendiente' AND o.creado_en < datetime('now', '-20 minutes') LIMIT 50`,
    )
    .all<{ id: string }>();
  for (const v of sinPagar)
    if (
      await cambiarEstadoViaje(db, {
        operacionId: v.id,
        desde: 'pago_pendiente',
        hacia: 'cancelado',
        actor: 'sistema',
        actorId: null,
        clave: `sin-pago:${v.id}`,
        motivo: 'sin_pago',
      })
    )
      await (env ? soltarCobroViaje(env, db, v.id, 0) : Promise.resolve(0)).catch((e: unknown) =>
        console.error('viajes: anular cobro sin pago', v.id, e),
      );
  const { results: buscando } = await db
    .prepare(
      `SELECT o.id, o.servicio_id, o.zona_id, o.cliente_id, v.origen_lat, v.origen_lng, v.destino_lat, v.destino_lng, q.total, q.moneda, z.pais,
              ${SQL_TARIFA_SERVICIO} AS tarifa_servicio, v.metodo_pago, (SELECT p.tamano FROM envios_persona p WHERE p.operacion_id = o.id) AS tamano,
              v.conductor_preferido_id, v.programado_para, v.menor_nombre
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
      cliente_id: string;
      origen_lat: number;
      origen_lng: number;
      destino_lat: number | null;
      destino_lng: number | null;
      total: number | null;
      tarifa_servicio: number;
      moneda: string | null;
      pais: string | null;
      metodo_pago: string | null;
      tamano: TamanoPaquete | null;
      conductor_preferido_id: string | null;
      programado_para: string | null;
      menor_nombre: string | null;
    }>();
  let ofrecidas = 0;
  const yaOfrecidos = new Set<string>();
  // C-MODERACION: un viaje nunca se le ofrece a un conductor que el pasajero bloqueó (ni a uno que
  // bloqueó al pasajero). Una consulta por vuelta.
  const bloqueadas = buscando.length
    ? await parejasBloqueadas(
        db,
        buscando.map((o) => o.cliente_id),
      )
    : new Map<string, Set<string>>();
  // C-MODO-DESTINO (BRE-R2): el modo destino vale para todos los servicios, no solo comida: quien
  // lo tiene encendido solo recibe viajes y envíos cuyo destino lo acerca al suyo.
  const destinos = buscando.length ? await destinosActivos(db) : new Map();
  for (const op of buscando) {
    // C-CONDUCTOR-CONFIANZA: primero, y solo a él, el conductor de confianza del cliente.
    const confianza = op.conductor_preferido_id
      ? await turnoDeConfianza(env, db, op, bloqueadas, yaOfrecidos, hacer)
      : 'libre';
    if (confianza === 'ofrecida') {
      ofrecidas++;
      continue;
    }
    if (confianza === 'esperar') continue;
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
    // M3 (C-OFERTA-COMPLETA): el conductor ve cuánto gana antes de aceptar, como en Uber: el
    // precio fijo del viaje menos la comisión de la política de Divoox que rija (si rige).
    const comision =
      op.total != null && op.moneda && op.pais
        ? ((
            await comisionConductor(db, {
              servicio: SERVICIO_FINANCIERO.get(op.servicio_id) ?? 'ride',
              pais: op.pais,
              ciudad: op.zona_id,
              moneda: op.moneda,
              // C-QUIEN-PAGA-VIAJES: la comisión, sobre el precio del viaje (sin la tarifa de
              // servicio). Lo que gana = lo que paga el pasajero menos la comisión entera.
              valor: op.total - Number(op.tarifa_servicio ?? 0),
            }).catch((e: unknown) => {
              console.error('operaciones: comisión de la oferta', e);
              return null;
            })
          )?.monto ?? 0)
        : 0;
    const ganancia = op.total != null ? op.total - comision : 0;
    // C-SALDO-OFERTAS (13 nov 2026): donde rige el prepago, no se le ofrece el viaje a quien no le
    // alcanza el saldo para la comisión (igual no podría aceptarlo); en su app ve por qué.
    const sinSaldo =
      comision > 0 && op.pais && op.moneda
        ? await sinSaldoPara(
            db,
            candidatos.map((c) => c.conductorId),
            op.pais,
            op.moneda,
            comision,
          )
        : new Set<string>();
    // C-PAGO-MOVIL-VIAJE: un viaje con pago móvil va a quien tiene su pago móvil cargado.
    const conPagoMovil =
      esPagoACelular(op.metodo_pago) && op.pais
        ? await conductoresConPagoMovil(
            db,
            candidatos.map((c) => c.conductorId),
            op.pais,
            op.metodo_pago,
          )
        : null;
    // C-ENVIO-TAMANO: un paquete mediano o grande solo va a quien lo puede llevar en su vehículo.
    const vehiculos =
      op.tamano === 'mediano' || op.tamano === 'grande'
        ? await vehiculosActivos(
            db,
            candidatos.map((c) => c.conductorId),
          )
        : null;
    // C-VIAJES-FIJOS: el viaje de un menor solo va a un vehículo que acepta menores.
    const conMenores = op.menor_nombre
      ? await vehiculosConMenores(
          db,
          candidatos.map((c) => c.vehiculoId),
        )
      : null;
    const elegido = candidatos.find((c) => {
      if (yaOfrecidos.has(c.conductorId)) return false;
      if (conMenores && !conMenores.has(c.vehiculoId)) return false;
      if (bloqueadas.get(op.cliente_id)?.has(c.conductorId)) return false;
      if (vehiculos && op.tamano) {
        const v = vehiculos.get(c.conductorId);
        if (!v || !vehiculoLlevaPaquete(op.tamano, v)) return false;
      }
      if (sinSaldo.has(c.conductorId)) return false;
      if (conPagoMovil && !conPagoMovil.has(c.conductorId)) return false;
      const destino = destinos.get(c.conductorId);
      if (!destino) return true;
      return (
        op.destino_lat != null &&
        op.destino_lng != null &&
        acercaAlDestino(c, { lat: Number(op.destino_lat), lng: Number(op.destino_lng) }, destino)
      );
    });
    if (!elegido) continue;
    // La condición repite la regla de «libre» en la MISMA sentencia: si entre la consulta y aquí
    // el conductor tomó otra cosa, la oferta no se crea.
    const r = await db
      .prepare(
        `INSERT INTO ofertas_operacion (operacion_id, conductor_id, vehiculo_id, estado, expira_en, ganancia_centavos, km)
         SELECT ?1, ?2, ?3, 'ofrecida', datetime('now', ?4), ?5, ?6
          WHERE NOT EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = ?2)
            AND NOT EXISTS (SELECT 1 FROM ofertas_operacion WHERE conductor_id = ?2 AND estado = 'ofrecida')
            AND EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND estado_general = 'buscando')
         -- C-REOFERTA-VENCIDA: la oferta que dejó vencer vuelve como NUEVA (cuenta atrás desde ahora).
         ON CONFLICT(operacion_id, conductor_id) DO UPDATE SET
           estado = 'ofrecida', vehiculo_id = excluded.vehiculo_id, expira_en = excluded.expira_en,
           ganancia_centavos = excluded.ganancia_centavos, km = excluded.km,
           creada_en = datetime('now'), respondida_en = NULL,
           intentos = ofertas_operacion.intentos + 1
         WHERE ofertas_operacion.estado = 'vencida'
           AND ofertas_operacion.expira_en <= datetime('now', '-${SEGUNDOS_RESPIRO_REOFERTA} seconds')
           AND ofertas_operacion.intentos < ${OFERTAS_POR_CONDUCTOR}
         RETURNING intentos`,
      )
      .bind(
        op.id,
        elegido.conductorId,
        elegido.vehiculoId,
        `+${SEGUNDOS_OFERTA_OPERACION} seconds`,
        Math.max(0, ganancia),
        // C-TIEMPOS-OPERACION: km a la recogida, en el mismo INSERT (la llegada prevista del conductor).
        Number.isFinite(elegido.km) ? elegido.km : null,
      )
      .all<{ intentos: number }>();
    const intentos = r.results[0]?.intentos;
    if (intentos == null) continue;
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
    // C-OFERTA-AVISO (18 nov 2026, todos los países): la oferta también llega al celular, como la
    // de comida (y como DoorDash y Uber): con la app en segundo plano el sondeo no corre y el tiempo
    // real puede no estar. Sin esto el conductor no se enteraba y la oferta vencía en silencio.
    // C-REOFERTA-TOPE: al celular, solo la primera oferta y la primera vuelta.
    if (env && Number(intentos) <= AVISOS_POR_CONDUCTOR)
      await notificar(env, db, elegido.conductorId, (i) =>
        avisoOfertaOperacion(
          i,
          op.servicio_id,
          Math.max(0, ganancia),
          op.moneda ?? 'USD',
          elegido.km,
        ),
      ).catch((x: unknown) => console.error('operaciones: aviso de la oferta', x));
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

/**
 * C-FLEX-EXCLUSIVO (16 nov 2026): los disparadores del bloque de Flex (esquemaFlex.ts). Aparte de
 * los de la Fase 3 porque su vuelta atrás (docs/fase-3/revertir.sql) no los toca; la salud de la
 * exclusividad exige los dos grupos.
 */
export const DISPARADORES_BLOQUE_FLEX = [
  'rutas_flex_conductor_libre',
  'rutas_flex_ocupa_conductor',
  'rutas_flex_libera_conductor',
  'rutas_flex_conductor_fijo',
  'rutas_flex_desconecta_conductor',
  'repartidores_no_conecta_en_bloque_flex',
] as const;

/** Pieza «exclusividad» de la salud: todos los disparadores puestos y cero inconsistencias. */
export async function saludExclusividad(
  db: D1Database,
  /** C-LECTURAS-SALUD: los disparadores ya leídos por el canario (una sola lectura de sqlite_master). */
  presentes?: Set<string>,
): Promise<'ok' | 'error'> {
  const todos = [...DISPARADORES_EXCLUSIVIDAD, ...DISPARADORES_BLOQUE_FLEX];
  const hay = presentes
    ? cuantosHay(presentes, todos)
    : await db
        .prepare(
          `SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name IN (${todos.map(() => '?').join(',')})`,
        )
        .bind(...todos)
        .first<{ n: number }>()
        .then((d) => Number(d?.n));
  if (hay !== todos.length) return 'error';
  // C-FLEX-EXCLUSIVO: además, nadie conectado mientras hace un bloque de Flex (las vistas ya
  // existen en producción y «CREATE VIEW IF NOT EXISTS» no las cambia: va en la misma consulta).
  const f = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM inconsistencias_operaciones)
            + (SELECT COUNT(*) FROM conductor_ocupacion c
                 JOIN repartidores d ON d.usuario_id = c.conductor_id
                WHERE c.ruta_id IS NOT NULL AND d.conectado = 1) AS n`,
    )
    .first<{ n: number }>();
  return Number(f?.n ?? 0) === 0 ? 'ok' : 'error';
}
