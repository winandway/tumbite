import {
  type Tramo,
  esquemaTarifaViaje,
  servicioDeOperacion,
  servicioDePedido,
  tiemposPedido,
  tiemposViaje,
} from '@tumbite/compartido';
import { DIAS_FOTOS } from './conciliacion';
import { MINUTOS_SIN_CONDUCTOR } from './operaciones';
import { ErrorDatos } from './validar';

/**
 * C-FICHA-OPERACION (15 nov 2026, pedido de Richard: «fotos y cierre en la misma ficha» y «tiempos
 * calculados»). Todos los países. Lo que el superadmin ve de UN pedido y de UN viaje: una línea de
 * tiempo única, los tiempos de cada tramo contra lo previsto, dónde se compró y dónde se entregó
 * (con sus fotos, que se piden aparte a la ruta de evidencias), el cierre y el cobro.
 *
 * Reglas que no se rompen:
 * - Mirar no escribe: todo es lectura, por la llave primaria o por un índice de la operación.
 * - La foto de la puerta de la casa del cliente NUNCA sale de aquí (C-FOTO-PUERTA): esta pieza ni
 *   siquiera lee `direcciones_fotos`.
 * - Los viajes de personas no llevan fotos del pasajero; un envío de paquete sí muestra la suya.
 * - Una cuenta de cliente borrada se devuelve sin nombre (`null` = «Cuenta eliminada»).
 */

type Fila = Record<string, unknown>;
const texto = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const numero = (v: unknown): number | null =>
  v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const punto = (lat: unknown, lng: unknown) => {
  const a = numero(lat);
  const b = numero(lng);
  return a == null || b == null ? null : { lat: a, lng: b };
};
const todas = (db: D1Database, sql: string, ...v: unknown[]) =>
  db
    .prepare(sql)
    .bind(...v)
    .all<Fila>()
    .then((r) => r.results);

/** Un paso de la línea de tiempo. `capa = 'manager'` va tenue y se puede ocultar. */
export type PasoLinea = {
  tipo: 'estado' | 'hito' | 'evidencia' | 'manager' | 'emergencia' | 'ticket';
  evento: string;
  fecha: string;
  quien: string | null;
  /** Qué papel tenía quien lo hizo (cliente, restaurante, repartidor, conductor, soporte, sistema). */
  rol: string | null;
  detalle: string | null;
  capa: 'principal' | 'manager';
  /** Segundos desde el paso principal anterior (null en el primero y en los del Manager). */
  desdeAnteriorS: number | null;
  /** C-RASTRO: dónde estaba el conductor o repartidor en ese paso, si su posición era reciente. */
  lugar: { lat: number; lng: number } | null;
  /** Metros en línea recta desde el paso anterior que tiene lugar (null si no se puede saber). */
  desdeAnteriorM: number | null;
};
/** Un paso antes de ordenar: el lugar es opcional y los «desde el anterior» los calcula `ordenarLinea`. */
export type PasoSuelto = Omit<PasoLinea, 'desdeAnteriorS' | 'desdeAnteriorM' | 'lugar'> & {
  lugar?: { lat: number; lng: number } | null;
};

/** Metros en línea recta entre dos puntos. */
export function metrosEntre(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** El lugar guardado con un paso (de dos columnas o del JSON del evento del viaje), o null. */
export function lugarDe(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const a = typeof lat === 'number' ? lat : Number.NaN;
  const b = typeof lng === 'number' ? lng : Number.NaN;
  return Number.isFinite(a) && Number.isFinite(b) && (a !== 0 || b !== 0)
    ? { lat: a, lng: b }
    : null;
}

const msDe = (f: string) =>
  Date.parse(`${f.replace(' ', 'T')}${/[zZ]|[+-]\d\d:?\d\d$/.test(f) ? '' : 'Z'}`);

/** Ordena los pasos por hora y calcula el tiempo desde el paso principal anterior. */
export function ordenarLinea(pasos: PasoSuelto[]): PasoLinea[] {
  const orden = pasos
    .filter((p) => p.fecha)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p.fecha.localeCompare(b.p.fecha) || a.i - b.i)
    .map((x) => x.p);
  let anterior: number | null = null;
  let lugarAnterior: { lat: number; lng: number } | null = null;
  return orden.map((p) => {
    const lugar = p.lugar ?? null;
    if (p.capa === 'manager') return { ...p, lugar, desdeAnteriorS: null, desdeAnteriorM: null };
    const ms = msDe(p.fecha);
    const desde =
      anterior == null || Number.isNaN(ms) ? null : Math.max(0, Math.round((ms - anterior) / 1000));
    if (!Number.isNaN(ms)) anterior = ms;
    const metros = lugar && lugarAnterior ? metrosEntre(lugarAnterior, lugar) : null;
    if (lugar) lugarAnterior = lugar;
    return { ...p, lugar, desdeAnteriorS: desde, desdeAnteriorM: metros };
  });
}

/** La fecha más reciente de una lista de pasos (texto de la base, se compara como texto). */
function ultimaFecha(pasos: { fecha: string }[]): string | null {
  let ultima: string | null = null;
  for (const p of pasos) if (p.fecha && (!ultima || p.fecha > ultima)) ultima = p.fecha;
  return ultima;
}

/** Cuándo se borra una foto por retención (creada + 30 días), en el formato de la base. */
function borraEn(creada: string | null): string | null {
  if (!creada) return null;
  const ms = msDe(creada);
  if (Number.isNaN(ms)) return null;
  return new Date(ms + DIAS_FOTOS * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');
}

export type EvidenciaFicha = {
  tipo: 'recogida' | 'entrega';
  conFoto: boolean;
  creadaEn: string | null;
  confirmadaEn: string | null;
  confirmadaPor: { nombre: string | null; rol: string | null } | null;
  modo: string | null;
  nota: string;
  distanciaM: number | null;
  /** Dónde se tomó (el GPS de la evidencia, guardado aparte de la foto). */
  lugar: { lat: number; lng: number } | null;
  borradaEn: string | null;
  /** Hasta cuándo se guarda (si no se borró ni la retiene un reclamo abierto). */
  seGuardaHasta: string | null;
  retenidaPorReclamo: boolean;
  /** La foto se pide a la ruta de evidencias (con sesión y sin caché). */
  foto: string | null;
};

const VIVOS_PEDIDO = ['pago_pendiente', 'pagado', 'aceptado', 'listo', 'en_camino'];

/** La resolución de una autorización vencida, como la anota `autorizacionVencida.ts`. */
function resolucionLegible(detalle: string | null) {
  try {
    const d = JSON.parse(detalle ?? '{}') as Record<string, unknown>;
    const por = typeof d.por === 'string' ? d.por : null;
    const aprobo = typeof d.aprobo === 'string' ? d.aprobo : null;
    return {
      cobrada: d.decision === 'cobrado_de_nuevo',
      quien: por && aprobo ? `${por} + ${aprobo}` : por,
      nota: typeof d.nota === 'string' && d.nota ? d.nota : null,
    };
  } catch {
    console.error('ficha: resolución de autorización ilegible');
    return { cobrada: false, quien: null, nota: null };
  }
}

/** La ficha completa de un pedido para el superadmin. */
export async function fichaPedido(db: D1Database, id: string, ahora = Date.now()) {
  const p = await db
    .prepare(
      `SELECT p.*, uc.nombre AS cliente, uc.activo AS cliente_activo, r.nombre AS restaurante,
          r.direccion AS restaurante_direccion, r.lat AS rest_lat, r.lng AS rest_lng, r.tipo_comercio,
          ur.nombre AS repartidor, d.codigo AS repartidor_codigo, z.nombre AS ciudad,
          z.zona_horaria, z.pais
         FROM pedidos p LEFT JOIN usuarios uc ON uc.id = p.cliente_id
         JOIN restaurantes r ON r.id = p.restaurante_id
         LEFT JOIN usuarios ur ON ur.id = p.repartidor_id
         LEFT JOIN repartidores d ON d.usuario_id = p.repartidor_id
         LEFT JOIN zonas z ON z.id = p.zona_id WHERE p.id = ?`,
    )
    .bind(id)
    .first<Fila>();
  if (!p) throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  const repartidorId = texto(p.repartidor_id);
  const restauranteId = String(p.restaurante_id);
  const [estados, manager, hitos, evidencias, oferta, excepcion, reclamos, liquidacion] =
    await Promise.all([
      todas(
        db,
        `SELECT h.estado, h.creado_en, h.actor_id, h.lat, h.lng, COALESCE(u.nombre, r.nombre) AS quien, u.rol,
          r.id AS es_restaurante
         FROM historial_estados h LEFT JOIN usuarios u ON u.id = h.actor_id
         LEFT JOIN restaurantes r ON r.id = h.actor_id
        WHERE h.pedido_id = ? ORDER BY h.id`,
        id,
      ),
      todas(
        db,
        'SELECT evento, detalle, creado_en FROM bitacora_pedidos WHERE pedido_id = ? ORDER BY id',
        id,
      ),
      todas(db, 'SELECT hito, valor, creado_en FROM hitos_pedido WHERE pedido_id = ?', id),
      todas(
        db,
        `SELECT tipo, clave != '' AS con_foto, lat, lng, distancia_m, modo, nota, creada_en,
          confirmada_en, borrada_en FROM evidencias WHERE pedido_id = ?`,
        id,
      ),
      repartidorId
        ? db
            .prepare(
              'SELECT km, respondida_en FROM ofertas WHERE pedido_id = ? AND repartidor_id = ?',
            )
            .bind(id, repartidorId)
            .first<Fila>()
        : Promise.resolve(null),
      db
        .prepare(
          'SELECT motivo, creado_en, autorizado_en, autorizado_por FROM excepciones_ubicacion WHERE pedido_id = ?',
        )
        .bind(id)
        .first<Fila>(),
      // Por el índice parcial tickets_pedido (C-FICHA-OPERACION).
      todas(
        db,
        'SELECT id, asunto, estado, tipo, creado_en FROM tickets WHERE pedido_id = ? ORDER BY creado_en DESC LIMIT 20',
        id,
      ),
      // C-AUTORIZACION-VENCIDA: el estado del cobro de la entrega (por su clave).
      db
        .prepare('SELECT estado, error FROM liquidaciones WHERE pedido_id = ?')
        .bind(id)
        .first<Fila>(),
    ]);

  /** El papel de quien hizo un cambio de estado. */
  const rolDe = (e: Fila): string | null => {
    const actor = texto(e.actor_id);
    if (!actor) return 'sistema';
    if (e.es_restaurante != null || actor === restauranteId) return 'restaurante';
    if (actor === String(p.cliente_id)) return 'cliente';
    if (actor === repartidorId || texto(e.rol) === 'repartidor') return 'repartidor';
    if (texto(e.rol) === 'admin') return 'soporte';
    return texto(e.rol);
  };
  const ultimoEstado = (estado: string) => [...estados].reverse().find((e) => e.estado === estado);
  const quienConfirma = (estado: string) => {
    const e = ultimoEstado(estado);
    return e ? { nombre: texto(e.quien), rol: rolDe(e) } : null;
  };
  const clienteNombre =
    p.cliente == null || Number(p.cliente_activo ?? 1) === 0 ? null : String(p.cliente);
  const hayReclamoAbierto = reclamos.some((t) => t.estado !== 'cerrado');

  const evidencia = (tipo: 'recogida' | 'entrega'): EvidenciaFicha | null => {
    const e = evidencias.find((x) => x.tipo === tipo);
    if (!e) return null;
    const conFoto = Number(e.con_foto) === 1;
    const borrada = texto(e.borrada_en);
    return {
      tipo,
      conFoto,
      creadaEn: conFoto || borrada ? texto(e.creada_en) : null,
      confirmadaEn: texto(e.confirmada_en),
      confirmadaPor: quienConfirma(tipo === 'recogida' ? 'en_camino' : 'entregado'),
      modo: texto(e.modo),
      nota: String(e.nota ?? ''),
      distanciaM: numero(e.distancia_m),
      lugar: punto(e.lat, e.lng),
      borradaEn: borrada,
      seGuardaHasta: conFoto && !hayReclamoAbierto ? borraEn(texto(e.creada_en)) : null,
      retenidaPorReclamo: conFoto && hayReclamoAbierto,
      foto: conFoto ? `/datos/pedidos/${encodeURIComponent(id)}/evidencia/${tipo}` : null,
    };
  };
  const recogida = evidencia('recogida');
  const entrega = evidencia('entrega');
  const hito = (h: string) => hitos.find((x) => x.hito === h);

  const pasos: PasoSuelto[] = [
    {
      tipo: 'estado',
      evento: 'creado',
      fecha: String(p.creado_en),
      quien: clienteNombre,
      rol: 'cliente',
      detalle: null,
      capa: 'principal',
    },
    ...estados.map((e) => ({
      tipo: 'estado' as const,
      evento: String(e.estado),
      fecha: String(e.creado_en),
      quien: rolDe(e) === 'cliente' ? clienteNombre : texto(e.quien),
      rol: rolDe(e),
      detalle: null,
      capa: 'principal' as const,
      lugar: lugarDe(e.lat, e.lng),
    })),
    ...(oferta?.respondida_en
      ? [
          {
            tipo: 'hito' as const,
            evento: 'repartidor_acepto',
            fecha: String(oferta.respondida_en),
            quien: texto(p.repartidor),
            rol: 'repartidor',
            detalle: null,
            capa: 'principal' as const,
          },
        ]
      : []),
    ...hitos.map((h) => ({
      tipo: 'hito' as const,
      evento: String(h.hito),
      fecha: String(h.creado_en),
      quien: texto(p.repartidor),
      rol: 'repartidor',
      detalle: h.valor == null ? null : String(h.valor),
      capa: 'principal' as const,
    })),
    ...[recogida, entrega].flatMap((e) => {
      if (!e) return [];
      const r: PasoSuelto[] = [];
      if (e.conFoto || e.borradaEn) {
        const f = evidencias.find((x) => x.tipo === e.tipo)?.creada_en;
        if (f)
          r.push({
            tipo: 'evidencia',
            evento: `foto_${e.tipo}`,
            fecha: String(f),
            quien: texto(p.repartidor),
            rol: 'repartidor',
            detalle: e.distanciaM == null ? null : String(e.distanciaM),
            capa: 'principal',
          });
      } else if (e.tipo === 'entrega' && e.confirmadaEn) {
        r.push({
          tipo: 'evidencia',
          evento: e.modo === 'local' ? 'entrega_en_local' : 'entrega_sin_foto',
          fecha: e.confirmadaEn,
          quien: texto(p.repartidor),
          rol: 'repartidor',
          detalle: e.modo,
          capa: 'principal',
        });
      }
      if (e.tipo === 'recogida' && e.confirmadaEn)
        r.push({
          tipo: 'evidencia',
          evento: 'recogida_confirmada',
          fecha: e.confirmadaEn,
          quien: e.confirmadaPor?.nombre ?? null,
          rol: e.confirmadaPor?.rol ?? null,
          detalle: null,
          capa: 'principal',
        });
      return r;
    }),
    // El Manager anota la foto de la recogida también: ya sale como evidencia, no se repite.
    ...manager
      .filter((m) => m.evento !== 'foto_recogida')
      .map((m) => {
        // C-AUTORIZACION-VENCIDA: la resolución de soporte sale en la línea principal con quién la
        // decidió (y quién dio la segunda firma) y su nota.
        if (m.evento === 'autorizacion_resuelta') {
          const r = resolucionLegible(texto(m.detalle));
          return {
            tipo: 'manager' as const,
            evento: r.cobrada ? 'autorizacion_cobrada' : 'autorizacion_sin_cobro',
            fecha: String(m.creado_en),
            quien: r.quien,
            rol: 'soporte',
            detalle: r.nota,
            capa: 'principal' as const,
          };
        }
        return {
          tipo: 'manager' as const,
          // LAN-2z: «cobro_reautorizado:<pago>» lleva el pago en el nombre; en la línea es uno solo.
          // C-AUTORIZACION-VENCIDA: el cobro de reemplazo en curso y cada intento que no se completó
          // llevan el pago o el número en el nombre; en la línea es uno solo.
          evento:
            /^(cobro_reautorizado|recobro_en_curso|recobro_intento):/.exec(String(m.evento))?.[1] ??
            String(m.evento),
          fecha: String(m.creado_en),
          quien: null,
          rol: 'sistema',
          detalle: texto(m.detalle),
          capa: 'manager' as const,
        };
      }),
    ...reclamos.map((t) => ({
      tipo: 'ticket' as const,
      evento: 'reclamo_abierto',
      fecha: String(t.creado_en),
      quien: null,
      rol: null,
      detalle: texto(t.asunto),
      capa: 'principal' as const,
    })),
  ];

  const restaurantePunto = punto(p.rest_lat, p.rest_lng);
  const casa = punto(p.lat, p.lng);
  const tiempos = tiemposPedido(
    {
      estado: String(p.estado),
      creadoEn: String(p.creado_en),
      pagadoEn: texto(p.pagado_en),
      aceptadoEn: texto(p.aceptado_en),
      listoEn: texto(p.listo_en),
      recogidoEn: texto(p.recogido_en),
      entregadoEn: texto(p.entregado_en),
      tiempoPrepMin: numero(p.tiempo_prep_min),
      repartidorAceptoEn: texto(oferta?.respondida_en),
      kmRepartidorRestaurante: numero(oferta?.km),
      llegoRestauranteEn: texto(hito('llego_restaurante')?.creado_en),
      restaurante: restaurantePunto,
      casa,
      // C-TIEMPOS-OPERACION (16 nov 2026): lo último que pasó, para no medir un pedido abandonado.
      ultimaActividadEn: ultimaFecha(pasos),
    },
    ahora,
  );
  const cancelado = String(p.estado) === 'cancelado';
  let lineas: { nombreEs: string; cantidad: number }[] = [];
  try {
    lineas = JSON.parse(String(p.lineas_json)) as typeof lineas;
  } catch {
    console.error('superadmin: lineas_json ilegible', id);
  }
  const cancelador = ultimoEstado('cancelado');
  return {
    id: String(p.id),
    estado: String(p.estado),
    vivo: VIVOS_PEDIDO.includes(String(p.estado)),
    servicio: servicioDePedido(texto(p.tipo_comercio)),
    tipoComercio: texto(p.tipo_comercio) ?? 'restaurante',
    total: Number(p.total),
    propina: Number(p.propina),
    moneda: String(p.moneda ?? 'USD'),
    metodoPago: String(p.metodo_pago ?? 'tarjeta'),
    direccion: String(p.direccion),
    notas: String(p.notas ?? ''),
    ciudad: texto(p.ciudad),
    zonaId: texto(p.zona_id),
    zonaHoraria: texto(p.zona_horaria),
    pais: texto(p.pais),
    creadoEn: String(p.creado_en),
    pagoStripe: texto(p.stripe_pago),
    lineas: lineas.map((l) => ({ nombre: l.nombreEs, cantidad: Number(l.cantidad) })),
    // El cliente con la cuenta borrada sale sin nombre: la pantalla dice «Cuenta eliminada».
    cliente: { id: String(p.cliente_id), nombre: clienteNombre },
    restaurante: {
      id: restauranteId,
      nombre: String(p.restaurante),
      direccion: String(p.restaurante_direccion ?? ''),
      lugar: restaurantePunto,
    },
    repartidor: repartidorId
      ? { id: repartidorId, nombre: texto(p.repartidor), codigo: texto(p.repartidor_codigo) }
      : null,
    entregaLugar: casa,
    distanciaKm: numero(p.distancia_km),
    recogida,
    entrega,
    tiempos,
    linea: ordenarLinea(pasos),
    cierre:
      String(p.estado) === 'entregado'
        ? {
            tipo: 'entregado' as const,
            en: texto(p.entregado_en),
            por: quienConfirma('entregado'),
          }
        : cancelado
          ? {
              tipo: 'cancelado' as const,
              en: texto(p.cancelado_en) ?? texto(cancelador?.creado_en),
              por: cancelador ? { nombre: texto(cancelador.quien), rol: rolDe(cancelador) } : null,
              motivo:
                manager
                  .map((m) => String(m.evento))
                  .find((ev) => ev.startsWith('cancelado') || ev === 'rechazado_por_restaurante') ??
                null,
            }
          : null,
    cobro: {
      metodo: String(p.metodo_pago ?? 'tarjeta'),
      estado: String(p.cobro_estado ?? 'no_aplica'),
      montoRecibido: numero(p.monto_recibido),
      confirmadoEn: texto(p.cobro_confirmado_en),
      confirmadoPor: texto(p.cobro_confirmado_por),
      conciliacion: String(p.conciliacion_estado ?? 'no_aplica'),
    },
    liquidacion: liquidacion
      ? { estado: String(liquidacion.estado), error: texto(liquidacion.error) }
      : null,
    tickets: reclamos.map((t) => ({
      id: String(t.id),
      asunto: String(t.asunto),
      estado: String(t.estado),
      tipo: String(t.tipo),
      creadoEn: String(t.creado_en),
    })),
    excepcionUbicacion: excepcion
      ? {
          motivo: String(excepcion.motivo),
          pedidaEn: String(excepcion.creado_en),
          autorizadaEn: texto(excepcion.autorizado_en),
          autorizadaPor: texto(excepcion.autorizado_por),
        }
      : null,
  };
}

const VIVOS_VIAJE = ['pago_pendiente', 'buscando', 'asignado', 'conductor_llego', 'en_curso'];

/** La ficha completa de un viaje (auto, moto) o de un envío de paquete para el superadmin. */
export async function fichaViaje(db: D1Database, id: string, ahora = Date.now()) {
  const o = await db
    .prepare(
      `SELECT o.id, o.servicio_id, o.tipo_operacion, o.cliente_id, o.conductor_id, o.zona_id,
          o.estado_general, o.creado_en, v.estado, v.ultimo_actor, v.origen_lat, v.origen_lng,
          v.origen_direccion, v.destino_lat, v.destino_lng, v.destino_direccion, v.pasajeros,
          v.pin_requerido, v.intentos_pin, v.metodo_pago, v.distancia_m_real, v.duracion_s_real,
          v.total_final_centavos, v.asignado_en, v.llego_en, v.iniciado_en, v.terminado_en,
          v.categoria, v.programado_para, q.total, q.moneda, q.distancia_m, q.duracion_s,
          q.tarifa_json, q.desglose_json, pu.nombre AS pasajero, pu.activo AS pasajero_activo,
          cu.nombre AS conductor, d.codigo AS conductor_codigo, ve.tipo AS vehiculo_tipo,
          ve.marca, ve.modelo, ve.color, ve.placa, z.nombre AS ciudad, z.zona_horaria, z.pais
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
         LEFT JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id
         LEFT JOIN usuarios pu ON pu.id = o.cliente_id
         LEFT JOIN usuarios cu ON cu.id = o.conductor_id
         LEFT JOIN repartidores d ON d.usuario_id = o.conductor_id
         LEFT JOIN vehiculos ve ON ve.id = o.vehiculo_id
         LEFT JOIN zonas z ON z.id = o.zona_id
        WHERE o.id = ?`,
    )
    .bind(id)
    .first<Fila>();
  if (!o) throw new ErrorDatos('Ese viaje no existe.', undefined, 404);
  const conductorId = texto(o.conductor_id);
  const esEnvio = String(o.tipo_operacion) === 'envio_paquete';
  const [eventos, emergencias, oferta, envio, reclamos] = await Promise.all([
    todas(
      db,
      `SELECT e.tipo, e.estado_anterior, e.estado_nuevo, e.actor_rol, e.creado_en, u.nombre AS quien,
              json_extract(e.datos_json, '$.motivo') AS motivo,
              json_extract(e.datos_json, '$.lat') AS lat, json_extract(e.datos_json, '$.lng') AS lng
         FROM eventos_operacion e LEFT JOIN usuarios u ON u.id = e.actor_id
        WHERE e.operacion_id = ? ORDER BY e.id`,
      id,
    ),
    // Las emergencias son pocas (tabla pequeña): se leen todas las de este viaje, atendidas o no.
    todas(
      db,
      `SELECT e.id, e.rol, e.creado_en, e.atendida_en, e.nota, u.nombre AS quien, a.nombre AS atendida_por
         FROM emergencias_viaje e LEFT JOIN usuarios u ON u.id = e.actor_id
         LEFT JOIN usuarios a ON a.id = e.atendida_por
        WHERE e.operacion_id = ? ORDER BY e.creado_en`,
      id,
    ),
    conductorId
      ? db
          .prepare(
            'SELECT km, respondida_en FROM ofertas_operacion WHERE operacion_id = ? AND conductor_id = ?',
          )
          .bind(id, conductorId)
          .first<Fila>()
      : Promise.resolve(null),
    esEnvio
      ? db
          .prepare(
            `SELECT descripcion, destinatario_nombre, tamano, foto_recogida IS NOT NULL AS con_foto,
                foto_entrega IS NOT NULL AS con_foto_entrega, recogido_en, entregado_en
               FROM envios_persona WHERE operacion_id = ?`,
          )
          .bind(id)
          .first<Fila>()
      : Promise.resolve(null),
    // Por el índice parcial tickets_operacion (C-MONITOREO-SERVICIOS).
    todas(
      db,
      'SELECT id, asunto, estado, tipo, creado_en FROM tickets WHERE operacion_id = ? ORDER BY creado_en DESC LIMIT 20',
      id,
    ),
  ]);
  let tarifa: { factorCallePb: number; velocidadKmh: number; esperaGratisS: number } | null = null;
  try {
    const t = esquemaTarifaViaje.safeParse(JSON.parse(String(o.tarifa_json ?? 'null')));
    if (t.success) tarifa = t.data;
    else if (o.tarifa_json != null)
      console.error('ficha del viaje: tarifa_json no válida', id, t.error);
  } catch (e) {
    // Sin la tarifa la ficha sigue (sin la espera gratis ni la velocidad), pero queda en el registro.
    console.error('ficha del viaje: tarifa_json ilegible', id, e);
    tarifa = null;
  }
  const pasajeroNombre =
    o.pasajero == null || Number(o.pasajero_activo ?? 1) === 0 ? null : String(o.pasajero);
  const buscando = [...eventos].reverse().find((e) => e.estado_nuevo === 'buscando');
  const buscandoDesde = texto(buscando?.creado_en) ?? String(o.creado_en);
  const tiempos: Tramo[] = tiemposViaje(
    {
      estado: String(o.estado),
      buscandoDesde,
      asignadoEn: texto(o.asignado_en),
      llegoEn: texto(o.llego_en),
      iniciadoEn: texto(o.iniciado_en),
      terminadoEn: texto(o.terminado_en),
      topeBusquedaS: MINUTOS_SIN_CONDUCTOR * 60,
      kmRecogida: numero(oferta?.km),
      tarifa,
      duracionCotizadaS: numero(o.duracion_s),
      ultimaActividadEn: ultimaFecha([
        { fecha: String(o.creado_en) },
        ...eventos.map((e) => ({ fecha: String(e.creado_en) })),
      ]),
    },
    ahora,
  );
  const quienEvento = (e: Fila) =>
    e.actor_rol === 'cliente' ? pasajeroNombre : e.actor_rol === 'sistema' ? null : texto(e.quien);
  const pasos: PasoSuelto[] = [
    {
      tipo: 'estado',
      evento: 'creado',
      fecha: String(o.creado_en),
      quien: pasajeroNombre,
      rol: 'cliente',
      detalle: null,
      capa: 'principal',
    },
    ...eventos
      .filter((e) => e.estado_nuevo && e.estado_nuevo !== e.estado_anterior)
      .map((e) => ({
        tipo: 'estado' as const,
        evento: String(e.estado_nuevo),
        fecha: String(e.creado_en),
        quien: quienEvento(e),
        rol: texto(e.actor_rol),
        // C-RASTRO: el motivo de la transición (por qué se canceló o se liberó) y dónde estaba el conductor.
        detalle: texto(e.motivo),
        capa: 'principal' as const,
        lugar: lugarDe(e.lat, e.lng),
      })),
    ...eventos
      .filter((e) => !e.estado_nuevo || e.estado_nuevo === e.estado_anterior)
      .map((e) => ({
        tipo: 'manager' as const,
        evento: String(e.tipo),
        fecha: String(e.creado_en),
        quien: quienEvento(e),
        rol: texto(e.actor_rol),
        detalle: null,
        capa: 'manager' as const,
      })),
    ...emergencias.map((e) => ({
      tipo: 'emergencia' as const,
      evento: 'emergencia',
      fecha: String(e.creado_en),
      quien: e.rol === 'pasajero' ? pasajeroNombre : texto(e.quien),
      rol: e.rol === 'pasajero' ? 'cliente' : 'conductor',
      detalle: null,
      capa: 'principal' as const,
    })),
    ...(envio?.recogido_en
      ? [
          {
            tipo: 'evidencia' as const,
            evento: 'paquete_recogido',
            fecha: String(envio.recogido_en),
            quien: texto(o.conductor),
            rol: 'conductor',
            detalle: null,
            capa: 'principal' as const,
          },
        ]
      : []),
    ...reclamos.map((t) => ({
      tipo: 'ticket' as const,
      evento: 'reclamo_abierto',
      fecha: String(t.creado_en),
      quien: null,
      rol: null,
      detalle: texto(t.asunto),
      capa: 'principal' as const,
    })),
  ];
  const vehiculo =
    o.placa != null || o.vehiculo_tipo != null
      ? {
          tipo: texto(o.vehiculo_tipo),
          descripcion: [texto(o.color), texto(o.marca), texto(o.modelo)].filter(Boolean).join(' '),
          placa: texto(o.placa),
        }
      : null;
  const pinRequerido = Number(o.pin_requerido ?? 1) === 1;
  const empezo = Boolean(o.iniciado_en);
  return {
    id: String(o.id),
    servicio: servicioDeOperacion(texto(o.servicio_id)),
    servicioId: String(o.servicio_id),
    esEnvio,
    estado: String(o.estado),
    estadoGeneral: String(o.estado_general),
    vivo: VIVOS_VIAJE.includes(String(o.estado)),
    categoria: texto(o.categoria),
    creadoEn: String(o.creado_en),
    programadoPara: texto(o.programado_para),
    ciudad: texto(o.ciudad),
    zonaId: texto(o.zona_id),
    zonaHoraria: texto(o.zona_horaria),
    pais: texto(o.pais),
    origen: {
      direccion: String(o.origen_direccion ?? ''),
      lugar: punto(o.origen_lat, o.origen_lng),
    },
    destino: {
      direccion: String(o.destino_direccion ?? ''),
      lugar: punto(o.destino_lat, o.destino_lng),
    },
    pasajeros: numero(o.pasajeros),
    pasajero: { id: String(o.cliente_id), nombre: pasajeroNombre },
    conductor: conductorId
      ? { id: conductorId, nombre: texto(o.conductor), codigo: texto(o.conductor_codigo) }
      : null,
    vehiculo,
    // El PIN nunca se muestra: solo si la ciudad lo pide, si se usó y cuántos intentos fallaron.
    pin: {
      requerido: pinRequerido,
      usado: pinRequerido && empezo,
      intentosFallidos: Number(o.intentos_pin ?? 0),
    },
    importe: {
      cotizado: numero(o.total),
      final: numero(o.total_final_centavos),
      moneda: texto(o.moneda) ?? 'USD',
      metodo: String(o.metodo_pago ?? 'efectivo'),
      // C-PRECIO-ZONA: el viaje fue con el precio fijo de la zona (y lo que habría salido por km).
      ...precioZonaDe(o.desglose_json),
    },
    distancia: { cotizadaM: numero(o.distancia_m), realM: numero(o.distancia_m_real) },
    duracion: { cotizadaS: numero(o.duracion_s), realS: numero(o.duracion_s_real) },
    envio: envio
      ? {
          descripcion: String(envio.descripcion ?? ''),
          destinatario: texto(envio.destinatario_nombre),
          tamano: texto(envio.tamano),
          recogidoEn: texto(envio.recogido_en),
          entregadoEn: texto(envio.entregado_en),
          fotoRecogida:
            Number(envio.con_foto) === 1
              ? `/datos/admin/viajes/${encodeURIComponent(id)}/foto/recogida`
              : null,
          fotoEntrega:
            Number(envio.con_foto_entrega) === 1
              ? `/datos/admin/viajes/${encodeURIComponent(id)}/foto/entrega`
              : null,
        }
      : null,
    emergencias: emergencias.map((e) => ({
      id: String(e.id),
      rol: String(e.rol),
      creadoEn: String(e.creado_en),
      atendidaEn: texto(e.atendida_en),
      atendidaPor: texto(e.atendida_por),
      nota: String(e.nota ?? ''),
    })),
    tiempos,
    linea: ordenarLinea(pasos),
    tickets: reclamos.map((t) => ({
      id: String(t.id),
      asunto: String(t.asunto),
      estado: String(t.estado),
      tipo: String(t.tipo),
      creadoEn: String(t.creado_en),
    })),
  };
}

/** C-PRECIO-ZONA: el precio de la zona y el calculado de un viaje, o nada si fue calculado. */
export function precioZonaDe(json: unknown): { precioZona?: number; calculado?: number } {
  try {
    const d = JSON.parse(typeof json === 'string' ? json : '{}') as {
      precioZona?: unknown;
      calculado?: unknown;
    } | null;
    return d && typeof d.precioZona === 'number'
      ? {
          precioZona: d.precioZona,
          ...(typeof d.calculado === 'number' ? { calculado: d.calculado } : {}),
        }
      : {};
  } catch {
    return {};
  }
}
