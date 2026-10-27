import { type EstadoPaquete, configEntrega } from '@tumbite/compartido';
import { ErrorDatos } from '../validar';

/**
 * Divoox Flex · Fase 2: piezas comunes de las rutas operativas (empresa y conductor).
 * Los movimientos de paquetes van en bloque: una sentencia por grupo, con la lista de ids como
 * JSON (`json_each`), así una ruta de 40 o 150 paquetes no hace una consulta por paquete y no
 * pasa el límite de 100 parámetros de D1.
 */

export const MAX_PAQUETES_RUTA = 150;

/** Cambia de estado una lista de paquetes (solo los que estén en `desde`) y deja su evento. */
export function moverPaquetes(
  db: D1Database,
  p: {
    /** Lista de ids, o todos los paquetes ACTIVOS de una ruta (se leen dentro de la misma sentencia). */
    ids: string[] | { deRuta: string };
    empresaId: string;
    desde: readonly EstadoPaquete[];
    hacia: EstadoPaquete;
    actorId: string | null;
    actorTipo: 'usuario' | 'api' | 'sistema';
    rutaId: string;
    /** Prefijo único de la acción: el evento de cada paquete es `${prefijo}:${paqueteId}`. */
    prefijo: string;
    lat?: number | null;
    lng?: number | null;
    meta?: Record<string, unknown> | null;
    /**
     * Solo si la ruta quedó con esta `ultima_clave` (la puso el cambio de estado del mismo lote):
     * si otra petición ganó la carrera, este lote no mueve nada.
     */
    guardaClave?: string;
  },
): D1PreparedStatement[] {
  const deRuta = !Array.isArray(p.ids);
  const lista = Array.isArray(p.ids) ? JSON.stringify(p.ids) : p.ids.deRuta;
  const fuente = deRuta
    ? 'SELECT paquete_id FROM ruta_paquetes WHERE ruta_id = ? AND activo = 1'
    : 'SELECT value FROM json_each(?)';
  const desde = JSON.stringify(p.desde);
  const guarda = p.guardaClave
    ? ' AND EXISTS (SELECT 1 FROM rutas_flex WHERE id = ? AND ultima_clave = ?)'
    : '';
  const binds = p.guardaClave ? [p.rutaId, p.guardaClave] : [];
  return [
    // Los eventos primero (solo de los que de verdad van a cambiar), después el cambio.
    db
      .prepare(
        `INSERT OR IGNORE INTO paquete_eventos (paquete_id, empresa_id, tipo, actor_id, actor_tipo, lat, lng, operacion_ref, idempotencia, metadatos_json)
         SELECT id, empresa_id, ?, ?, ?, ?, ?, ?, ? || ':' || id, ? FROM paquetes
          WHERE id IN (${fuente}) AND empresa_id = ? AND estado IN (SELECT value FROM json_each(?))${guarda}`,
      )
      .bind(
        p.hacia,
        p.actorId,
        p.actorTipo,
        p.lat ?? null,
        p.lng ?? null,
        p.rutaId,
        p.prefijo,
        JSON.stringify(p.meta ?? null),
        lista,
        p.empresaId,
        desde,
        ...binds,
      ),
    db
      .prepare(
        `UPDATE paquetes SET estado = ?, actualizado_en = datetime('now')
          WHERE id IN (${fuente}) AND empresa_id = ? AND estado IN (SELECT value FROM json_each(?))${guarda}`,
      )
      .bind(p.hacia, lista, p.empresaId, desde, ...binds),
  ];
}

/** Evento de custodia que no cambia el estado (p. ej. el traspaso al centro). */
export function eventoSuelto(
  db: D1Database,
  p: {
    paqueteId: string;
    empresaId: string;
    tipo: string;
    actorId: string | null;
    actorTipo: 'usuario' | 'api' | 'sistema';
    rutaId: string;
    idempotencia: string;
    lat?: number | null;
    lng?: number | null;
    meta?: Record<string, unknown> | null;
  },
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT OR IGNORE INTO paquete_eventos (paquete_id, empresa_id, tipo, actor_id, actor_tipo, lat, lng, operacion_ref, idempotencia, metadatos_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      p.paqueteId,
      p.empresaId,
      p.tipo,
      p.actorId,
      p.actorTipo,
      p.lat ?? null,
      p.lng ?? null,
      p.rutaId,
      p.idempotencia,
      JSON.stringify(p.meta ?? null),
    );
}

/** Estado de cada parada según sus paquetes (los excluidos en el centro no cuentan). */
export function recalcularParadas(db: D1Database, rutaId: string): D1PreparedStatement[] {
  return [
    db
      .prepare(
        `UPDATE ruta_paradas SET estado = (
          SELECT CASE
            WHEN COUNT(*) = 0 THEN 'omitida'
            WHEN SUM(p.estado = 'entregado') = COUNT(*) THEN 'entregada'
            WHEN SUM(p.estado IN ('entregado','entrega_fallida','en_devolucion','devuelto','registrado_centro','cancelado','preparado')) = COUNT(*) THEN 'fallida'
            WHEN ruta_paradas.llegada_en IS NOT NULL THEN 'llegada'
            ELSE 'pendiente' END
          FROM ruta_paquetes rp JOIN paquetes p ON p.id = rp.paquete_id
          WHERE rp.parada_id = ruta_paradas.id AND rp.excluido_en IS NULL)
         WHERE ruta_id = ?`,
      )
      .bind(rutaId),
    db
      .prepare(
        `UPDATE ruta_paradas SET resuelta_en = COALESCE(resuelta_en, datetime('now'))
          WHERE ruta_id = ? AND estado IN ('entregada', 'fallida', 'omitida')`,
      )
      .bind(rutaId),
  ];
}

export type FilaRuta = {
  id: string;
  empresa_id: string;
  centro_id: string | null;
  lote_id: string | null;
  nombre: string;
  conductor_id: string | null;
  vehiculo_id: string | null;
  estado: string;
  modalidad: string | null;
  oferta_vence_en: string | null;
  bloque_desde: string | null;
  bloque_hasta: string | null;
  asignada_en: string | null;
  aceptada_en: string | null;
  carga_en: string | null;
  iniciada_en: string | null;
  cerrada_en: string | null;
  conductor_lat: number | null;
  conductor_lng: number | null;
  conductor_ubicacion_en: string | null;
  resumen_json: string | null;
  creado_en: string;
  actualizado_en: string;
};

export async function rutaPorId(db: D1Database, rutaId: string, empresaId?: string) {
  const f = await db
    .prepare(`SELECT * FROM rutas_flex WHERE id = ?${empresaId ? ' AND empresa_id = ?' : ''}`)
    .bind(...(empresaId ? [rutaId, empresaId] : [rutaId]))
    .first<FilaRuta>();
  if (!f) throw new ErrorDatos('Esa ruta no existe.', undefined, 404);
  return f;
}

/** ¿La oferta ya venció? (Se comprueba al leerla y al aceptarla; no hace falta el reloj.) */
export const ofertaVencida = (r: Pick<FilaRuta, 'estado' | 'oferta_vence_en'>) =>
  r.estado === 'ofrecida' &&
  r.oferta_vence_en !== null &&
  r.oferta_vence_en < new Date().toISOString().slice(0, 19).replace('T', ' ');

/** Conteo de la ruta: lo que el panel y el conductor ven como progreso y lo que va al cierre. */
export async function conteoRuta(db: D1Database, rutaId: string) {
  const f = await db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(rp.excluido_en IS NOT NULL) AS excluidos,
        SUM(rp.excluido_en IS NULL AND rp.cargado_en IS NOT NULL) AS cargados,
        SUM(rp.excluido_en IS NULL AND p.estado = 'entregado') AS entregados,
        SUM(rp.excluido_en IS NULL AND p.estado = 'entrega_fallida') AS fallidos,
        SUM(rp.excluido_en IS NULL AND p.estado = 'en_devolucion') AS en_devolucion,
        SUM(rp.excluido_en IS NULL AND p.estado = 'en_devolucion' AND rp.devuelto_centro_en IS NOT NULL) AS entregados_al_centro,
        SUM(rp.excluido_en IS NULL AND p.estado IN ('devuelto', 'registrado_centro')) AS devueltos,
        SUM(rp.excluido_en IS NULL AND p.estado IN ('asignado', 'cargado', 'en_transito')) AS pendientes,
        (SELECT COUNT(*) FROM flex_incidencias i WHERE i.ruta_id = ?1) AS incidencias,
        (SELECT COUNT(*) FROM ruta_paradas rpa WHERE rpa.ruta_id = ?1) AS paradas,
        (SELECT COUNT(*) FROM ruta_paradas rpa WHERE rpa.ruta_id = ?1 AND rpa.estado IN ('entregada', 'fallida', 'omitida')) AS paradas_resueltas
       FROM ruta_paquetes rp JOIN paquetes p ON p.id = rp.paquete_id WHERE rp.ruta_id = ?1`,
    )
    .bind(rutaId)
    .first<Record<string, number | null>>();
  // eslint-disable-next-line security/detect-object-injection -- claves fijas del conteo de arriba
  const n = (k: string) => Number(f?.[k] ?? 0);
  return {
    total: n('total') - n('excluidos'),
    excluidos: n('excluidos'),
    cargados: n('cargados'),
    entregados: n('entregados'),
    fallidos: n('fallidos'),
    enDevolucion: n('en_devolucion'),
    entregadosAlCentro: n('entregados_al_centro'),
    devueltos: n('devueltos'),
    pendientes: n('pendientes'),
    incidencias: n('incidencias'),
    paradas: n('paradas'),
    paradasResueltas: n('paradas_resueltas'),
  };
}

/**
 * Detalle de una ruta. `paraConductor`: el nombre y el teléfono del destinatario solo salen cuando
 * la ruta está en curso (antes no hacen falta para trabajar); la empresa los ve siempre.
 */
export async function detalleRuta(
  db: D1Database,
  r: FilaRuta,
  opciones: { paraConductor: boolean },
) {
  const empresa = await db
    .prepare('SELECT nombre, config_entrega_json FROM empresas WHERE id = ?')
    .bind(r.empresa_id)
    .first<{ nombre: string; config_entrega_json: string | null }>();
  const centro = r.centro_id
    ? await db
        .prepare('SELECT nombre, direccion, lat, lng FROM empresa_centros WHERE id = ?')
        .bind(r.centro_id)
        .first<{ nombre: string; direccion: string; lat: number | null; lng: number | null }>()
    : null;
  const conductor = r.conductor_id
    ? await db
        .prepare('SELECT nombre FROM usuarios WHERE id = ?')
        .bind(r.conductor_id)
        .first<{ nombre: string }>()
    : null;
  const paradas = await db
    .prepare(
      `SELECT rp.id, rp.orden, rp.estado, rp.envio_id, rp.llegada_en, rp.resuelta_en,
              e.referencia_externa, e.destinatario_nombre, e.destinatario_telefono, e.direccion, e.lat, e.lng,
              e.instrucciones, e.ventana_desde, e.ventana_hasta, e.config_entrega_json,
              (SELECT COUNT(*) FROM flex_pines fp WHERE fp.envio_id = e.id) AS tiene_pin
         FROM ruta_paradas rp JOIN envios e ON e.id = rp.envio_id WHERE rp.ruta_id = ? ORDER BY rp.orden`,
    )
    .bind(r.id)
    .all<Record<string, unknown>>();
  const paquetes = await db
    .prepare(
      `SELECT p.id, p.codigo_seguimiento, p.codigo_etiqueta, p.estado, p.descripcion, rq.parada_id,
              rq.activo, rq.cargado_en, rq.excluido_en, rq.excluido_motivo, rq.devuelto_centro_en, rq.recibido_en
         FROM ruta_paquetes rq JOIN paquetes p ON p.id = rq.paquete_id WHERE rq.ruta_id = ? ORDER BY p.creado_en, p.id`,
    )
    .bind(r.id)
    .all<Record<string, unknown>>();
  const verPersonales = !opciones.paraConductor || r.estado === 'en_curso';
  const porParada = new Map<string, Record<string, unknown>[]>();
  for (const p of paquetes.results) {
    const k = String(p.parada_id);
    porParada.set(k, [...(porParada.get(k) ?? []), p]);
  }
  return {
    ruta: {
      id: r.id,
      nombre: r.nombre,
      estado: r.estado,
      modalidad: r.modalidad,
      ofertaVenceEn: r.oferta_vence_en,
      ofertaVencida: ofertaVencida(r),
      bloqueDesde: r.bloque_desde,
      bloqueHasta: r.bloque_hasta,
      asignadaEn: r.asignada_en,
      aceptadaEn: r.aceptada_en,
      cargaEn: r.carga_en,
      iniciadaEn: r.iniciada_en,
      cerradaEn: r.cerrada_en,
      creadoEn: r.creado_en,
      loteId: r.lote_id,
      centroId: r.centro_id,
      empresa: empresa?.nombre ?? '',
      centro,
      conductor: r.conductor_id ? { id: r.conductor_id, nombre: conductor?.nombre ?? '' } : null,
      // La posición del conductor solo mientras trabaja la ruta, y solo para la empresa.
      ubicacion:
        !opciones.paraConductor &&
        ['aceptada', 'en_carga', 'en_curso'].includes(r.estado) &&
        r.conductor_lat != null
          ? { lat: r.conductor_lat, lng: r.conductor_lng, en: r.conductor_ubicacion_en }
          : null,
      resumen: r.resumen_json ? (JSON.parse(r.resumen_json) as unknown) : null,
      progreso: await conteoRuta(db, r.id),
      paradas: paradas.results.map((p) => ({
        id: p.id,
        orden: p.orden,
        estado: p.estado,
        envioId: p.envio_id,
        llegadaEn: p.llegada_en,
        resueltaEn: p.resuelta_en,
        referenciaExterna: p.referencia_externa,
        destinatarioNombre: verPersonales ? p.destinatario_nombre : null,
        destinatarioTelefono: verPersonales ? p.destinatario_telefono : null,
        direccion: p.direccion,
        lat: p.lat,
        lng: p.lng,
        sinCoordenadas: p.lat == null || p.lng == null,
        instrucciones: p.instrucciones,
        ventanaDesde: p.ventana_desde,
        ventanaHasta: p.ventana_hasta,
        pruebas: configEntrega(
          empresa?.config_entrega_json,
          p.config_entrega_json as string | null,
        ),
        tienePin: Number(p.tiene_pin) > 0,
        paquetes: (porParada.get(String(p.id)) ?? []).map((q) => ({
          id: q.id,
          codigoSeguimiento: q.codigo_seguimiento,
          codigoEtiqueta: q.codigo_etiqueta,
          estado: q.estado,
          descripcion: q.descripcion,
          cargado: Boolean(q.cargado_en),
          excluido: Boolean(q.excluido_en),
          excluidoMotivo: q.excluido_motivo,
          entregadoAlCentro: Boolean(q.devuelto_centro_en),
          recibido: Boolean(q.recibido_en),
        })),
      })),
    },
  };
}

/** Resumen del cierre (se guarda en la ruta y se vuelve a calcular al leer si hubo recepciones). */
export async function resumenRuta(db: D1Database, r: FilaRuta, cerradaEn: string | null) {
  const c = await conteoRuta(db, r.id);
  const conductor = r.conductor_id
    ? await db
        .prepare('SELECT nombre FROM usuarios WHERE id = ?')
        .bind(r.conductor_id)
        .first<{ nombre: string }>()
    : null;
  return {
    total: c.total,
    entregados: c.entregados,
    fallidos: c.incidencias,
    devueltos: c.devueltos,
    pendientesJustificados: c.entregadosAlCentro,
    excluidosEnCentro: c.excluidos,
    inicio: r.iniciada_en,
    fin: cerradaEn,
    incidencias: c.incidencias,
    paradas: c.paradas,
    conductor: conductor?.nombre ?? null,
  };
}
