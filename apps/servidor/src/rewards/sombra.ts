import {
  type Entorno,
  DIAS_RETENCION,
  HITOS_FASE2,
  ORDEN_NIVELES,
  UMBRALES,
  type Umbrales,
  type Hito,
  type ItemHito,
  type NivelRep,
  type OfertaRep,
  type Unidad,
  calcularReputacion,
  cumpleNivel,
  type EstadoHito,
  puedePasar,
  elegibilidad,
  minutosDeViaje,
  montoPremio,
  siguienteNivel,
  unidadesQueCuentan,
} from '@tumbite/compartido';
import type { Env } from '../env';

/**
 * Divoox Rewards · Fase 2 · MODO SOMBRA (30 oct 2026, aprobado por Richard solo en staging).
 * Lee lo que ya existe y escribe SOLO en las tablas nuevas (reputacion_diaria, rewards_*). No toca
 * el despacho, los puntos, el destacado, la billetera, el prepago ni lo que ve el repartidor, y no
 * paga nada. En producción no corre nunca, aunque alguien encienda la variable.
 */

export type EnvRewards = Env & { REWARDS_MODO?: string; ENTORNO_RELOJ?: Entorno | null };

/**
 * «sombra» en el sitio de pruebas (todos los repartidores) si nadie lo apagó. C-REWARDS-PILOTO
 * (30 oct 2026): «piloto» en producción solo con REWARDS_MODO=piloto, y solo para los participantes
 * del piloto. En cualquier otro caso, «apagado».
 */
export function modoRewards(env: EnvRewards): 'sombra' | 'piloto' | 'apagado' {
  if (env.REWARDS_MODO === 'apagado') return 'apagado';
  if (env.ENTORNO_RELOJ === 'pruebas') return 'sombra';
  if (env.ENTORNO_RELOJ === 'produccion' && env.REWARDS_MODO === 'piloto') return 'piloto';
  return 'apagado';
}

/**
 * C-REWARDS-AJUSTES (30 oct 2026, R3): lo que el equipo cambia desde el superadmin sin publicar.
 * El porcentaje del margen arranca en 0: sin él, ningún premio tiene monto.
 */
export type AjustesRewards = {
  umbrales: Umbrales;
  porcentajeMargen: number;
  topePremioCentavos: number;
  hitoUnidades: number;
  /** C-REWARDS-PRIORIDAD: a igual distancia, el de mejor nivel recibe primero (solo piloto). */
  prioridadDespacho: boolean;
};
export const AJUSTES_INICIALES: AjustesRewards = {
  umbrales: { ...UMBRALES },
  porcentajeMargen: 0,
  topePremioCentavos: 0,
  hitoUnidades: 100,
  prioridadDespacho: false,
};
export async function leerAjustes(db: D1Database): Promise<AjustesRewards> {
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'rewards_ajustes'")
    .first<{ valor: string }>();
  if (!f) return AJUSTES_INICIALES;
  try {
    return { ...AJUSTES_INICIALES, ...(JSON.parse(f.valor) as Partial<AjustesRewards>) };
  } catch (e) {
    console.error('rewards: ajustes ilegibles, se usan los iniciales', e);
    return AJUSTES_INICIALES;
  }
}

/** Lo que ve el repartidor en Driver: el último día calculado, si Rewards está activo para él. */
export async function reputacionVisible(
  env: EnvRewards,
  db: D1Database,
  usuarioId: string,
): Promise<{
  puntaje: number;
  nivel: string;
  provisional: boolean;
  siguiente: { nivel: string; faltan: number } | null;
} | null> {
  const modo = modoRewards(env);
  // En la computadora y en las pruebas automáticas (entorno «local») se comporta como producción.
  const piloto =
    modo === 'piloto' || (env.ENTORNO_RELOJ === 'local' && env.REWARDS_MODO === 'piloto');
  if (modo !== 'sombra' && !piloto) return null;
  if (piloto) {
    const dentro = await db
      .prepare('SELECT 1 AS si FROM piloto_participantes WHERE usuario_id = ?')
      .bind(usuarioId)
      .first();
    if (!dentro) return null;
  }
  const f = await db
    .prepare(
      'SELECT puntaje, provisional, nivel_con_gracia AS nivel FROM reputacion_diaria WHERE repartidor_id = ? ORDER BY fecha DESC LIMIT 1',
    )
    .bind(usuarioId)
    .first<{ puntaje: number; provisional: number; nivel: NivelRep }>();
  if (!f) return null;
  const i = ORDEN_NIVELES.indexOf(f.nivel);
  const prox = ORDEN_NIVELES.at(i + 1);
  const { umbrales } = await leerAjustes(db);
  const umbral = prox && prox !== 'inicial' ? new Map(Object.entries(umbrales)).get(prox) : null;
  return {
    puntaje: Number(f.puntaje),
    nivel: f.nivel,
    provisional: Number(f.provisional) === 1,
    siguiente:
      prox && umbral != null
        ? { nivel: prox, faltan: Math.max(0, Math.round((umbral - Number(f.puntaje)) * 10) / 10) }
        : null,
  };
}

const MARGEN_MIN = 10;
const HISTORIA = 250;
const ms = (t: string | null) => (t ? Date.parse(`${t.replace(' ', 'T')}Z`) : NaN);

/** Comida y tiendas: pedidos entregados, abandonos, estrellas válidas y quejas verificadas. */
async function unidadesPedidos(db: D1Database, rid: string): Promise<Unidad[]> {
  const { results: entregados } = await db
    .prepare(
      `SELECT p.id, p.aceptado_en, p.entregado_en, p.tiempo_prep_min, p.distancia_km,
              COALESCE(r.tipo_comercio, 'restaurante') AS tipo,
              (SELECT c.estrellas_repartidor FROM calificaciones c WHERE c.pedido_id = p.id
                 AND COALESCE(c.culpa_restaurante, 0) = 0) AS estrellas,
              (SELECT COUNT(*) FROM tickets t WHERE t.pedido_id = p.id AND t.tipo = 'queja'
                 AND json_extract(t.datos_json, '$.verificada') = 1
                 AND COALESCE(json_extract(t.datos_json, '$.gravedad'), 'menor') = 'menor') AS menores,
              (SELECT COUNT(*) FROM tickets t WHERE t.pedido_id = p.id AND t.tipo = 'queja'
                 AND json_extract(t.datos_json, '$.verificada') = 1
                 AND json_extract(t.datos_json, '$.gravedad') = 'mayor') AS mayores
         FROM pedidos p LEFT JOIN restaurantes r ON r.id = p.restaurante_id
        WHERE p.repartidor_id = ? AND p.estado = 'entregado'
          -- C-REWARDS-APELACIONES: una entrega con apelación aceptada no cuenta en el puntaje.
          AND NOT EXISTS (SELECT 1 FROM apelaciones_repartidor a WHERE a.repartidor_id = p.repartidor_id
                            AND a.unidad_tipo = 'pedido' AND a.unidad_id = p.id AND a.estado = 'aceptada')
        ORDER BY p.entregado_en DESC LIMIT ${HISTORIA}`,
    )
    .bind(rid)
    .all<{
      id: string;
      aceptado_en: string | null;
      entregado_en: string | null;
      tiempo_prep_min: number | null;
      distancia_km: number | null;
      tipo: string;
      estrellas: number | null;
      menores: number;
      mayores: number;
    }>();
  const us: Unidad[] = entregados.map((p) => {
    const a = ms(p.aceptado_en);
    const e = ms(p.entregado_en);
    const medible = Number.isFinite(a) && Number.isFinite(e);
    const limite =
      (Number(p.tiempo_prep_min ?? 20) + minutosDeViaje(Number(p.distancia_km ?? 3)) + MARGEN_MIN) *
      60_000;
    return {
      servicio: p.tipo === 'restaurante' ? 'comida' : 'tiendas',
      fecha: String(p.entregado_en ?? ''),
      finalizacion: { ok: 1, total: 1 },
      // Sin hora de aceptación o de entrega: no se puede medir (C-METRICAS-VENTANA).
      puntualidad: medible ? { ok: e - a <= limite ? 1 : 0, total: 1 } : null,
      incidentes: { menores: Number(p.menores), mayores: Number(p.mayores), base: 1 },
      estrellas: p.estrellas == null ? null : Number(p.estrellas),
    };
  });
  // Abandonos: cuentan como no finalizados, salvo los excusados por soporte (motivo «excusado: …»).
  const { results: abandonos } = await db
    .prepare(
      `SELECT motivo, creado_en FROM abandonos_repartidor WHERE repartidor_id = ?
        ORDER BY creado_en DESC LIMIT ${HISTORIA}`,
    )
    .bind(rid)
    .all<{ motivo: string; creado_en: string }>();
  for (const x of abandonos)
    us.push({
      servicio: 'comida',
      fecha: x.creado_en,
      finalizacion: x.motivo.startsWith('excusado') ? null : { ok: 0, total: 1 },
      puntualidad: null,
      incidentes: null,
      estrellas: null,
    });
  return us;
}

/** Express (Moto, Carro, Envíos): viajes terminados o cancelados por el conductor. */
async function unidadesExpress(db: D1Database, rid: string): Promise<Unidad[]> {
  const { results } = await db
    .prepare(
      `SELECT v.estado, v.ultimo_actor, COALESCE(v.terminado_en, o.actualizado_en) AS fecha,
              (SELECT k.estrellas FROM calificaciones_viaje k WHERE k.operacion_id = o.id AND k.de = 'pasajero') AS estrellas
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
        WHERE o.conductor_id = ? AND v.estado IN ('terminado', 'cancelado')
        ORDER BY fecha DESC LIMIT ${HISTORIA}`,
    )
    .bind(rid)
    .all<{ estado: string; ultimo_actor: string; fecha: string; estrellas: number | null }>();
  return results.map((v) => ({
    servicio: 'express',
    fecha: v.fecha,
    // Solo cuenta en contra la cancelación del propio conductor; la del cliente o del sistema, no.
    finalizacion:
      v.estado === 'terminado'
        ? { ok: 1, total: 1 }
        : v.ultimo_actor === 'conductor'
          ? { ok: 0, total: 1 }
          : null,
    puntualidad: null,
    incidentes: null,
    estrellas: v.estrellas == null ? null : Number(v.estrellas),
  }));
}

/** Motivos de falla en Flex que no son del conductor si hay prueba (foto, GPS) registrada. */
const FALLAS_EXCUSABLES = "('ausente', 'direccion_incorrecta', 'acceso_imposible', 'rechazada')";

/** Flex: cada ruta cerrada es una unidad con peso min(10, n/3). */
async function unidadesFlex(db: D1Database, rid: string): Promise<Unidad[]> {
  const { results } = await db
    .prepare(
      `SELECT r.id, COALESCE(r.cerrada_en, r.actualizado_en) AS fecha,
              (SELECT COUNT(*) FROM ruta_paquetes rp WHERE rp.ruta_id = r.id AND rp.activo = 1) AS n,
              (SELECT COUNT(*) FROM ruta_paquetes rp JOIN paquetes q ON q.id = rp.paquete_id
                WHERE rp.ruta_id = r.id AND rp.activo = 1 AND q.estado = 'entregado') AS entregados,
              (SELECT COUNT(DISTINCT i.paquete_id) FROM flex_incidencias i JOIN paquetes q ON q.id = i.paquete_id
                WHERE i.ruta_id = r.id AND i.motivo IN ${FALLAS_EXCUSABLES} AND i.prueba_id IS NOT NULL
                  AND q.estado <> 'entregado') AS excusados,
              (SELECT COUNT(*) FROM flex_incidencias i WHERE i.ruta_id = r.id AND i.motivo = 'danado') AS danados,
              (SELECT COUNT(*) FROM ruta_paradas pa WHERE pa.ruta_id = r.id AND pa.estado = 'entregada'
                 AND pa.ventana_hasta IS NOT NULL AND pa.resuelta_en IS NOT NULL) AS con_ventana,
              (SELECT COUNT(*) FROM ruta_paradas pa WHERE pa.ruta_id = r.id AND pa.estado = 'entregada'
                 AND pa.ventana_hasta IS NOT NULL AND pa.resuelta_en IS NOT NULL
                 AND pa.resuelta_en <= pa.ventana_hasta) AS a_tiempo
         FROM rutas_flex r
        WHERE r.conductor_id = ? AND r.estado IN ('completada', 'con_incidencias')
        ORDER BY fecha DESC LIMIT ${HISTORIA}`,
    )
    .bind(rid)
    .all<{
      id: string;
      fecha: string;
      n: number;
      entregados: number;
      excusados: number;
      danados: number;
      con_ventana: number;
      a_tiempo: number;
    }>();
  return results.map((r) => {
    const evaluables = Number(r.n) - Number(r.excusados);
    return {
      servicio: 'flex',
      fecha: r.fecha,
      paquetes: Number(r.n),
      // Denominador cero (todo excusado o ruta vacía): la ruta no cuenta en finalización.
      finalizacion: evaluables > 0 ? { ok: Number(r.entregados), total: evaluables } : null,
      puntualidad:
        Number(r.con_ventana) > 0 ? { ok: Number(r.a_tiempo), total: Number(r.con_ventana) } : null,
      incidentes:
        Number(r.n) > 0 ? { menores: Number(r.danados), mayores: 0, base: Number(r.n) } : null,
      estrellas: null,
    };
  });
}

/** Ofertas de los tres servicios; la de una ruta pesa 1 como cualquier otra. */
async function ofertasDe(db: D1Database, rid: string): Promise<OfertaRep[]> {
  const [comida, viajes, rutas, rechazos] = await Promise.all([
    db
      .prepare(
        `SELECT estado, creada_en FROM ofertas WHERE repartidor_id = ? AND estado IN ('aceptada','rechazada','vencida')
          ORDER BY creada_en DESC LIMIT 100`,
      )
      .bind(rid)
      .all<{ estado: string; creada_en: string }>(),
    db
      .prepare(
        `SELECT estado, creada_en FROM ofertas_operacion WHERE conductor_id = ? AND estado IN ('aceptada','rechazada','vencida')
          ORDER BY creada_en DESC LIMIT 100`,
      )
      .bind(rid)
      .all<{ estado: string; creada_en: string }>(),
    db
      .prepare(
        `SELECT COALESCE(aceptada_en, asignada_en, creado_en) AS fecha FROM rutas_flex
          WHERE conductor_id = ? AND modalidad = 'oferta' AND aceptada_en IS NOT NULL
          ORDER BY fecha DESC LIMIT 100`,
      )
      .bind(rid)
      .all<{ fecha: string }>(),
    db
      .prepare(
        `SELECT creado_en FROM empresa_auditoria WHERE actor_id = ? AND accion = 'ruta.retirar'
            AND detalle_json LIKE '%liberada_conductor%'
          ORDER BY creado_en DESC LIMIT 100`,
      )
      .bind(rid)
      .all<{ creado_en: string }>(),
  ]);
  return [
    ...comida.results.map((o) => ({ fecha: o.creada_en, aceptada: o.estado === 'aceptada' })),
    ...viajes.results.map((o) => ({ fecha: o.creada_en, aceptada: o.estado === 'aceptada' })),
    ...rutas.results.map((o) => ({ fecha: o.fecha, aceptada: true })),
    ...rechazos.results.map((o) => ({ fecha: o.creado_en, aceptada: false })),
  ];
}

/** Experiencia: unidades de por vida por servicio. Nunca baja. Incluye los puntos históricos sin tocarlos. */
async function experienciaDe(db: D1Database, rid: string) {
  const f = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM pedidos p LEFT JOIN restaurantes r ON r.id = p.restaurante_id
          WHERE p.repartidor_id = ?1 AND p.estado = 'entregado' AND COALESCE(r.tipo_comercio,'restaurante') = 'restaurante') AS comida,
        (SELECT COUNT(*) FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
          WHERE p.repartidor_id = ?1 AND p.estado = 'entregado' AND r.tipo_comercio <> 'restaurante') AS tiendas,
        (SELECT COUNT(*) FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
          WHERE o.conductor_id = ?1 AND v.estado = 'terminado') AS express,
        (SELECT COUNT(*) FROM rutas_flex r JOIN ruta_paquetes rp ON rp.ruta_id = r.id JOIN paquetes q ON q.id = rp.paquete_id
          WHERE r.conductor_id = ?1 AND rp.activo = 1 AND q.estado = 'entregado') AS flex_paquetes,
        (SELECT puntos FROM repartidores WHERE usuario_id = ?1) AS puntos_historicos`,
    )
    .bind(rid)
    .first<Record<string, number | null>>();
  return {
    comida: Number(f?.comida ?? 0),
    tiendas: Number(f?.tiendas ?? 0),
    express: Number(f?.express ?? 0),
    flexPaquetes: Number(f?.flex_paquetes ?? 0),
    puntosHistoricos: Number(f?.puntos_historicos ?? 0),
  };
}

/** Calcula la reputación del día y la guarda (una fila por repartidor y día). */
export async function calcularYGuardar(db: D1Database, rid: string, hoy: string) {
  const [pedidos, express, flex, ofertas, experiencia] = await Promise.all([
    unidadesPedidos(db, rid),
    unidadesExpress(db, rid),
    unidadesFlex(db, rid),
    ofertasDe(db, rid),
    experienciaDe(db, rid),
  ]);
  const r = calcularReputacion([...pedidos, ...express, ...flex], ofertas);
  const previo = await db
    .prepare(
      'SELECT nivel_con_gracia, debajo_desde FROM reputacion_diaria WHERE repartidor_id = ? AND fecha < ? ORDER BY fecha DESC LIMIT 1',
    )
    .bind(rid, hoy)
    .first<{ nivel_con_gracia: NivelRep; debajo_desde: string | null }>();
  const nivel = siguienteNivel(
    previo ? { nivel: previo.nivel_con_gracia, debajoDesde: previo.debajo_desde } : null,
    r.puntaje,
    hoy,
    (await leerAjustes(db)).umbrales,
  );
  const eleg = elegibilidad(r);
  await db
    .prepare(
      `INSERT OR REPLACE INTO reputacion_diaria (repartidor_id, fecha, version, puntaje, provisional, peso_ventana,
         componentes_json, por_servicio_json, experiencia_json, nivel_calculado, nivel_con_gracia, debajo_desde, elegibilidad)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      rid,
      hoy,
      r.version,
      r.puntaje,
      r.provisional ? 1 : 0,
      r.pesoVentana,
      JSON.stringify(r.componentes),
      JSON.stringify(r.porServicio),
      JSON.stringify(experiencia),
      r.nivelCalculado,
      nivel.nivel,
      nivel.debajoDesde,
      eleg.estado,
    )
    .run();
  return { reputacion: r, nivel, elegibilidad: eleg, experiencia };
}

/** Unidades que podrían contar para un hito, con las reglas antifraude de cada servicio. */
/**
 * Margen de contribución real de las últimas `n` entregas pagadas (lo que le quedó a Divoox en cada
 * pedido: `pedidos.ganancia`). Viajes y Flex todavía no aportan margen al premio (Fase 3).
 */
export async function margenDe(db: D1Database, rid: string, n: number): Promise<number> {
  const f = await db
    .prepare(
      `SELECT COALESCE(SUM(ganancia), 0) AS margen FROM (
         SELECT p.ganancia FROM pedidos p
          WHERE p.repartidor_id = ? AND p.estado = 'entregado'
            AND (p.pagado_en IS NOT NULL OR p.metodo_pago <> 'tarjeta')
          ORDER BY p.entregado_en DESC LIMIT ?)`,
    )
    .bind(rid, n)
    .first<{ margen: number }>();
  return Number(f?.margen ?? 0);
}

export async function itemsParaHito(db: D1Database, rid: string): Promise<ItemHito[]> {
  const [pedidos, viajes, rutas] = await Promise.all([
    db
      .prepare(
        `SELECT p.cliente_id, COALESCE(r.tipo_comercio,'restaurante') AS tipo, p.pagado_en IS NOT NULL OR p.metodo_pago <> 'tarjeta' AS pagado,
                EXISTS (SELECT 1 FROM tickets t WHERE t.pedido_id = p.id AND t.tipo = 'queja'
                          AND json_extract(t.datos_json, '$.reembolso_aprobado') = 1) AS reclamo
           FROM pedidos p LEFT JOIN restaurantes r ON r.id = p.restaurante_id
          WHERE p.repartidor_id = ? AND p.estado = 'entregado'`,
      )
      .bind(rid)
      .all<{ cliente_id: string; tipo: string; pagado: number; reclamo: number }>(),
    db
      .prepare(
        `SELECT o.cliente_id, COALESCE(v.distancia_m_real, 0) AS m FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
          WHERE o.conductor_id = ? AND v.estado = 'terminado'`,
      )
      .bind(rid)
      .all<{ cliente_id: string; m: number }>(),
    db
      .prepare(
        `SELECT r.id, r.empresa_id, r.estado,
                (SELECT COUNT(*) FROM ruta_paquetes rp JOIN paquetes q ON q.id = rp.paquete_id
                  WHERE rp.ruta_id = r.id AND rp.activo = 1 AND q.estado = 'entregado') AS entregados,
                EXISTS (SELECT 1 FROM empresas e WHERE e.id = r.empresa_id AND e.estado = 'activa') AS verificada,
                EXISTS (SELECT 1 FROM empresa_miembros m WHERE m.empresa_id = r.empresa_id AND m.usuario_id = ?1
                          AND m.rol IN ('dueno','operaciones','finanzas')) AS propia
           FROM rutas_flex r WHERE r.conductor_id = ?1 AND r.estado IN ('completada','con_incidencias')`,
      )
      .bind(rid)
      .all<{
        id: string;
        empresa_id: string;
        entregados: number;
        verificada: number;
        propia: number;
      }>(),
  ]);
  return [
    ...pedidos.results.map((p): ItemHito => ({
      servicio: p.tipo === 'restaurante' ? 'comida' : 'tiendas',
      cliente: p.cliente_id,
      pagado: Boolean(p.pagado),
      reclamoAprobado: Boolean(p.reclamo),
      propio: p.cliente_id === rid,
    })),
    ...viajes.results.map((v): ItemHito => ({
      servicio: 'express',
      cliente: v.cliente_id,
      pagado: true,
      distanciaKm: Number(v.m) / 1000,
      propio: v.cliente_id === rid,
    })),
    ...rutas.results.map((r): ItemHito => ({
      servicio: 'flex',
      empresa: r.empresa_id,
      ruta: r.id,
      paquetesEntregados: Number(r.entregados),
      empresaVerificada: Boolean(r.verificada),
      conductorEsDeLaEmpresa: Boolean(r.propia),
      rutaCerrada: true,
    })),
  ];
}

/**
 * Registra el estado de un hito sin pagar nada (condición D). Idempotente y seguro con concurrencia:
 * 1) la fila del hito se crea una sola vez (clave primaria);
 * 2) la reserva de presupuesto es UNA sentencia que solo inserta si cabe en el tope del mes (y la
 *    clave impide reservar dos veces el mismo hito);
 * 3) el estado se decide por si existe la reserva, en una sentencia condicional.
 * Sin presupuesto reservado el hito queda «sin_presupuesto»: no es una obligación.
 */
export async function registrarHito(
  db: D1Database,
  rid: string,
  hito: Hito,
  o: { unidades: number; nivel: NivelRep; zona: string; mes: string },
) {
  if (o.unidades < hito.unidades) return null;
  await db
    .prepare(
      `INSERT OR IGNORE INTO rewards_hitos (repartidor_id, programa, hito_unidades, estado, monto_centavos, unidades_contadas)
       VALUES (?, ?, ?, 'progreso', ?, ?)`,
    )
    .bind(rid, hito.programa, hito.unidades, hito.montoCentavos, o.unidades)
    .run();
  await db
    .prepare(
      `INSERT OR IGNORE INTO rewards_reservas (repartidor_id, programa, hito_unidades, zona_id, mes, monto_centavos)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6
        WHERE (SELECT COALESCE(SUM(monto_centavos), 0) FROM rewards_reservas WHERE zona_id = ?4 AND mes = ?5 AND programa = ?2) + ?6
              <= COALESCE((SELECT tope_centavos FROM rewards_presupuesto WHERE zona_id = ?4 AND mes = ?5 AND programa = ?2), 0)`,
    )
    .bind(rid, hito.programa, hito.unidades, o.zona, o.mes, hito.montoCentavos)
    .run();
  const reservado = await db
    .prepare(
      'SELECT 1 FROM rewards_reservas WHERE repartidor_id = ? AND programa = ? AND hito_unidades = ?',
    )
    .bind(rid, hito.programa, hito.unidades)
    .first();
  const destino: EstadoHito = reservado
    ? cumpleNivel(o.nivel, hito.nivelMinimo)
      ? 'ganado'
      : 'condicionado'
    : 'sin_presupuesto';
  // Solo avanza (puedePasar) y cada cambio es UNA sentencia condicionada al estado de partida: si
  // diez llamadas llegan a la vez, solo una cambia la fila y solo esa deja el evento. Nunca a «pagado».
  for (const de of ['progreso', 'sin_presupuesto', 'condicionado'] as const) {
    if (de === destino || !puedePasar(de, destino)) continue;
    const r = await db
      .prepare(
        `UPDATE rewards_hitos SET estado = ?, unidades_contadas = MAX(unidades_contadas, ?), actualizado_en = datetime('now')
          WHERE repartidor_id = ? AND programa = ? AND hito_unidades = ? AND estado = ?`,
      )
      .bind(destino, o.unidades, rid, hito.programa, hito.unidades, de)
      .run();
    if (r.meta.changes) {
      await db
        .prepare(
          'INSERT INTO rewards_eventos (repartidor_id, programa, hito_unidades, de, a, motivo) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(rid, hito.programa, hito.unidades, de, destino, 'sombra')
        .run();
      break;
    }
  }
  const despues = await db
    .prepare(
      'SELECT estado FROM rewards_hitos WHERE repartidor_id = ? AND programa = ? AND hito_unidades = ?',
    )
    .bind(rid, hito.programa, hito.unidades)
    .first<{ estado: string }>();
  return despues?.estado ?? null;
}

/** Una vuelta del modo sombra: hasta `tope` repartidores que todavía no tienen la foto de hoy. */
export async function correrSombra(env: EnvRewards, db: D1Database, ahora = new Date(), tope = 10) {
  const modo = modoRewards(env);
  if (modo === 'apagado') return { modo: 'apagado' as const, calculados: 0 };
  const hoy = ahora.toISOString().slice(0, 10);
  const mes = hoy.slice(0, 7);
  const ajustes = await leerAjustes(db);
  const { results } = await db
    .prepare(
      `SELECT u.id, COALESCE(u.zona_id, 'US-FL-MIAMI') AS zona FROM usuarios u
        WHERE u.rol = 'repartidor' AND u.activo = 1
          AND (? = 'sombra' OR u.id IN (SELECT usuario_id FROM piloto_participantes))
          AND NOT EXISTS (SELECT 1 FROM reputacion_diaria d WHERE d.repartidor_id = u.id AND d.fecha = ?)
          -- Sin ninguna entrega, viaje o ruta no hay nada que evaluar: no se guarda una foto vacía.
          AND (EXISTS (SELECT 1 FROM pedidos p WHERE p.repartidor_id = u.id AND p.estado = 'entregado')
               OR EXISTS (SELECT 1 FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
                           WHERE o.conductor_id = u.id AND v.estado IN ('terminado', 'cancelado'))
               OR EXISTS (SELECT 1 FROM rutas_flex r WHERE r.conductor_id = u.id
                           AND r.estado IN ('completada', 'con_incidencias')))
        LIMIT ?`,
    )
    .bind(modo, hoy, tope)
    .all<{ id: string; zona: string }>();
  for (const u of results) {
    const r = await calcularYGuardar(db, u.id, hoy);
    const { cuentan, bloqueo } = unidadesQueCuentan(await itemsParaHito(db, u.id));
    if (bloqueo) continue;
    // C-REWARDS-PREMIO-VARIABLE: el hito y su monto salen de los ajustes y del margen real.
    for (const base of HITOS_FASE2) {
      const h = { ...base, unidades: ajustes.hitoUnidades };
      if (cuentan < h.unidades) continue;
      const monto = montoPremio(
        await margenDe(db, u.id, h.unidades),
        ajustes.porcentajeMargen,
        ajustes.topePremioCentavos,
      );
      // Sin monto no hay premio ni obligación: no se registra nada.
      if (monto <= 0) continue;
      await registrarHito(
        db,
        u.id,
        { ...h, montoCentavos: monto },
        {
          unidades: cuentan,
          nivel: r.nivel.nivel,
          zona: u.zona,
          mes,
        },
      );
    }
  }
  await pagarPremios(db);
  return { modo, calculados: results.length };
}

/**
 * C-REWARDS-PAGO (30 oct 2026, R6): un premio «ganado», pasada la ventana de reclamos y con su
 * presupuesto reservado, se paga a la billetera del repartidor. Cada pago es UNA sentencia
 * condicionada (ganado → pagado) y el movimiento lleva una clave fija por hito: aunque corra diez
 * veces a la vez, se paga una sola vez. Nunca más que lo reservado. Queda en rewards_eventos.
 */
export async function pagarPremios(db: D1Database, tope = 50) {
  const { results } = await db
    .prepare(
      `SELECT h.repartidor_id AS rid, h.programa, h.hito_unidades AS unidades,
              MIN(h.monto_centavos, r.monto_centavos) AS monto
         FROM rewards_hitos h
         JOIN rewards_reservas r ON r.repartidor_id = h.repartidor_id AND r.programa = h.programa
                                AND r.hito_unidades = h.hito_unidades
        WHERE h.estado = 'ganado' AND h.actualizado_en <= datetime('now', ?)
        LIMIT ?`,
    )
    .bind(`-${DIAS_RETENCION} days`, tope)
    .all<{ rid: string; programa: string; unidades: number; monto: number }>();
  let pagados = 0;
  for (const p of results) {
    if (p.monto <= 0) continue;
    const r = await db
      .prepare(
        `UPDATE rewards_hitos SET estado = 'pagado', actualizado_en = datetime('now')
          WHERE repartidor_id = ? AND programa = ? AND hito_unidades = ? AND estado = 'ganado'`,
      )
      .bind(p.rid, p.programa, p.unidades)
      .run();
    if (!r.meta.changes) continue;
    await db.batch([
      db
        .prepare(
          "INSERT OR IGNORE INTO movimientos (id, usuario_id, pedido_id, monto, concepto, referencia) VALUES (?, ?, NULL, ?, 'ajuste', ?)",
        )
        .bind(
          `premio-${p.rid}-${p.programa}-${p.unidades}`,
          p.rid,
          p.monto,
          `premio:${p.programa}:${p.unidades}`,
        ),
      db
        .prepare(
          "INSERT INTO rewards_eventos (repartidor_id, programa, hito_unidades, de, a, motivo) VALUES (?, ?, ?, 'ganado', 'pagado', 'pago a la billetera')",
        )
        .bind(p.rid, p.programa, p.unidades),
    ]);
    pagados++;
  }
  return { pagados };
}

/** Tablas de Rewards que guardan filas por repartidor (las limpiezas de prueba las borran antes que al usuario). */
const TABLAS_REWARDS = [
  'reputacion_diaria',
  'rewards_reservas',
  'rewards_hitos',
  'rewards_eventos',
  'apelaciones_repartidor',
] as const;

/** Sentencias para borrar todo lo de Rewards de unos usuarios; van antes del DELETE de usuarios. */
export const borrarRewardsDe = (db: D1Database, ids: string[]): D1PreparedStatement[] =>
  ids.length
    ? TABLAS_REWARDS.map((t) =>
        db
          .prepare(`DELETE FROM ${t} WHERE repartidor_id IN (${ids.map(() => '?').join(', ')})`)
          .bind(...ids),
      )
    : [];
