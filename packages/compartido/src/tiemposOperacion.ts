import { minutosDeViaje } from './despacho';
import { fechaBase } from './semaforo';
import { aMasTardarMs, minutosRestauranteACasa } from './seguimientoHonesto';

/**
 * C-TIEMPOS-OPERACION (15 nov 2026, pedido de Richard: «nadie va a sumar la bitácora con
 * calculadora»). Todos los países. Los tiempos de cada tramo de un pedido o de un viaje, cada uno
 * junto a lo que el sistema había previsto, con la diferencia: verde si cumplió o fue más rápido,
 * rojo si se pasó, gris si falta un dato (y se dice cuál). Una sola pieza pura que usan el servidor
 * (ficha del pedido y del viaje) y sus pruebas.
 *
 * Lo previsto sale de las MISMAS fórmulas que ya usa el sistema, nunca de una inventada aquí:
 * - Preparación: el tiempo que dio el restaurante (`pedidos.tiempo_prep_min`).
 * - Ida del repartidor: `minutosDeViaje` (despacho) con la distancia del repartidor al restaurante
 *   cuando se le ofreció el pedido (`ofertas.km`).
 * - Espera en el restaurante: la regla del despacho y del estudio de Richard («wait = max(0, ready −
 *   arrival)», Estudio-plataforma-de-comida, página 11): lo que faltaba para la hora prometida de la
 *   comida cuando llegó el repartidor.
 * - Entrega: el viaje del restaurante a la casa del seguimiento (`minutosRestauranteACasa`).
 * - Total: el «a más tardar» que se le prometió al cliente (`aMasTardarMs`).
 * - Viajes: el tope de búsqueda de conductor, la llegada con el factor de calle y la velocidad de la
 *   tarifa copiada en la cotización, la espera gratis de esa tarifa y la duración cotizada.
 */

export type ResultadoTramo = 'cumplio' | 'se_paso' | 'en_curso' | 'sin_dato';

/** Lo que puede faltar para medir un tramo (la pantalla lo dice en palabras). */
export type DatoFaltante =
  | 'aceptado'
  | 'tiempo_prometido'
  | 'listo'
  | 'repartidor_acepto'
  | 'distancia_repartidor'
  | 'llego_restaurante'
  | 'recogido'
  | 'entregado'
  | 'cancelado'
  | 'inicio_busqueda'
  | 'asignado'
  | 'distancia_conductor'
  | 'tarifa'
  | 'conductor_llego'
  | 'iniciado'
  | 'terminado'
  | 'duracion_cotizada';

export type ClaveTramoPedido = 'preparacion' | 'ida' | 'espera' | 'entrega' | 'total';
export type ClaveTramoViaje = 'asignacion' | 'llegada' | 'espera_pasajero' | 'recorrido' | 'total';

export type Tramo<C extends string = string> = {
  clave: C;
  /** Segundos que tomó (o que lleva, si sigue en curso). */
  realS: number | null;
  /** Segundos que el sistema había previsto. */
  previstoS: number | null;
  /** Minutos de diferencia (real − previsto, redondeado): negativo = más rápido. */
  diferenciaMin: number | null;
  resultado: ResultadoTramo;
  /** Lo que falta para medirlo o compararlo (vacío si está completo). */
  falta: DatoFaltante[];
  /** Lo previsto usó un valor de fábrica porque faltaba un dato (se dice en pantalla). */
  previstoPorDefecto?: boolean;
};

type Punto = { lat: number; lng: number };
type Fecha = string | null | undefined;

const ms = (f: Fecha): number | null => {
  if (!f) return null;
  const v = fechaBase(f);
  return Number.isNaN(v) ? null : v;
};

/**
 * Arma un tramo. Con inicio y fin: tiempo real comparado con lo previsto (por minutos redondeados:
 * menos de medio minuto de más sigue siendo «cumplió»). Con inicio y sin fin, si la operación sigue
 * viva: «en curso» con lo que lleva (y rojo si ya pasó lo previsto). Sin inicio: gris.
 */
function tramo<C extends string>(
  clave: C,
  inicio: number | null,
  fin: number | null,
  previstoS: number | null,
  faltaInicio: DatoFaltante,
  faltaFin: DatoFaltante,
  faltaPrevisto: DatoFaltante | null,
  vivo: boolean,
  ahora: number,
  previstoPorDefecto = false,
): Tramo<C> {
  const falta: DatoFaltante[] = [];
  if (inicio == null) falta.push(faltaInicio);
  if (fin == null && (!vivo || inicio == null)) falta.push(faltaFin);
  if (previstoS == null && faltaPrevisto) falta.push(faltaPrevisto);
  const extra = previstoPorDefecto ? { previstoPorDefecto: true } : {};
  if (inicio == null)
    return {
      clave,
      realS: null,
      previstoS,
      diferenciaMin: null,
      resultado: 'sin_dato',
      falta,
      ...extra,
    };
  const hasta = fin ?? (vivo ? ahora : null);
  if (hasta == null)
    return {
      clave,
      realS: null,
      previstoS,
      diferenciaMin: null,
      resultado: 'sin_dato',
      falta,
      ...extra,
    };
  const realS = Math.max(0, Math.round((hasta - inicio) / 1000));
  const diferenciaMin = previstoS == null ? null : Math.round((realS - previstoS) / 60);
  let resultado: ResultadoTramo;
  if (fin == null) resultado = diferenciaMin != null && diferenciaMin > 0 ? 'se_paso' : 'en_curso';
  else if (diferenciaMin == null) resultado = 'sin_dato';
  else resultado = diferenciaMin <= 0 ? 'cumplio' : 'se_paso';
  return { clave, realS, previstoS, diferenciaMin, resultado, falta, ...extra };
}

export type DatosTiemposPedido = {
  estado: string;
  creadoEn: Fecha;
  pagadoEn?: Fecha;
  aceptadoEn?: Fecha;
  listoEn?: Fecha;
  recogidoEn?: Fecha;
  entregadoEn?: Fecha;
  /** Minutos que dio el restaurante (`pedidos.tiempo_prep_min`). */
  tiempoPrepMin?: number | null;
  /** Cuándo aceptó la oferta el repartidor que lo lleva (`ofertas.respondida_en`). */
  repartidorAceptoEn?: Fecha;
  /** Km del repartidor al restaurante cuando se le ofreció (`ofertas.km`). */
  kmRepartidorRestaurante?: number | null;
  /** Hito «llegó al restaurante» (`hitos_pedido`). */
  llegoRestauranteEn?: Fecha;
  restaurante?: Punto | null;
  casa?: Punto | null;
};

const VIVOS_PEDIDO = new Set(['pagado', 'aceptado', 'listo', 'en_camino']);

/** Los cinco tiempos de un pedido de comida o de tienda, en orden. */
export function tiemposPedido(
  d: DatosTiemposPedido,
  ahora = Date.now(),
): Tramo<ClaveTramoPedido>[] {
  const vivo = VIVOS_PEDIDO.has(d.estado);
  const cancelado = d.estado === 'cancelado';
  const aceptado = ms(d.aceptadoEn);
  const listo = ms(d.listoEn);
  const acepto = ms(d.repartidorAceptoEn);
  const llego = ms(d.llegoRestauranteEn);
  const recogido = ms(d.recogidoEn);
  const entregado = ms(d.entregadoEn);
  const inicioTotal = ms(d.pagadoEn) ?? ms(d.creadoEn);
  const prep = d.tiempoPrepMin == null ? null : Number(d.tiempoPrepMin);
  const restaurante = d.restaurante ?? null;
  const casa = d.casa ?? null;
  const sinUbicaciones = !restaurante || !casa;
  const fin = (f: DatoFaltante): DatoFaltante => (cancelado ? 'cancelado' : f);

  const preparacion = tramo(
    'preparacion',
    aceptado,
    listo,
    prep == null ? null : prep * 60,
    'aceptado',
    fin('listo'),
    'tiempo_prometido',
    vivo,
    ahora,
  );
  const ida = tramo(
    'ida',
    acepto,
    llego,
    d.kmRepartidorRestaurante == null ? null : minutosDeViaje(d.kmRepartidorRestaurante) * 60,
    'repartidor_acepto',
    fin('llego_restaurante'),
    'distancia_repartidor',
    vivo,
    ahora,
  );
  // La comida debía estar lista en aceptado + preparación; el repartidor espera lo que faltaba.
  const listoPrometido = aceptado != null && prep != null ? aceptado + prep * 60_000 : null;
  const previstoEspera =
    listoPrometido != null && llego != null
      ? Math.max(0, Math.round((listoPrometido - llego) / 1000))
      : null;
  const espera = tramo(
    'espera',
    llego,
    recogido,
    previstoEspera,
    'llego_restaurante',
    fin('recogido'),
    aceptado == null ? 'aceptado' : prep == null ? 'tiempo_prometido' : null,
    vivo,
    ahora,
  );
  const entrega = tramo(
    'entrega',
    recogido,
    entregado,
    minutosRestauranteACasa(restaurante, casa) * 60,
    'recogido',
    fin('entregado'),
    null,
    vivo,
    ahora,
    sinUbicaciones,
  );
  const aMasTardar =
    aceptado != null ? aMasTardarMs(aceptado, prep ?? 20, restaurante, casa) : null;
  const total = tramo(
    'total',
    inicioTotal,
    entregado,
    aMasTardar != null && inicioTotal != null
      ? Math.max(0, Math.round((aMasTardar - inicioTotal) / 1000))
      : null,
    'aceptado',
    fin('entregado'),
    'aceptado',
    vivo,
    ahora,
    aMasTardar != null && (sinUbicaciones || prep == null),
  );
  return [preparacion, ida, espera, entrega, total];
}

export type DatosTiemposViaje = {
  estado: string;
  /** Desde cuándo se buscó conductor (el último paso a «buscando»; si no, cuando se pidió). */
  buscandoDesde: Fecha;
  asignadoEn?: Fecha;
  llegoEn?: Fecha;
  iniciadoEn?: Fecha;
  terminadoEn?: Fecha;
  /** Tope de búsqueda de conductor en segundos (a ese tiempo el viaje queda «sin conductor»). */
  topeBusquedaS: number;
  /** Km del conductor a la recogida cuando se le ofreció (`ofertas_operacion.km`). */
  kmRecogida?: number | null;
  /** La tarifa copiada en la cotización (factor de calle, velocidad y espera gratis). */
  tarifa?: { factorCallePb: number; velocidadKmh: number; esperaGratisS: number } | null;
  /** Duración cotizada del recorrido (`cotizaciones_viaje.duracion_s`). */
  duracionCotizadaS?: number | null;
};

const VIVOS_VIAJE = new Set([
  'pago_pendiente',
  'buscando',
  'asignado',
  'conductor_llego',
  'en_curso',
]);

/** Segundos de un tramo con la misma cuenta de la hora estimada de los viajes (`estimarRuta`). */
export function segundosPorKm(
  km: number,
  t: { factorCallePb: number; velocidadKmh: number },
): number {
  const kmCalle = (Math.max(0, km) * t.factorCallePb) / 10_000;
  return Math.max(60, Math.round((kmCalle / t.velocidadKmh) * 3600));
}

/** Los cinco tiempos de un viaje de auto, de moto o de un envío de paquete, en orden. */
export function tiemposViaje(d: DatosTiemposViaje, ahora = Date.now()): Tramo<ClaveTramoViaje>[] {
  const vivo = VIVOS_VIAJE.has(d.estado);
  const cerradoSinTerminar = !vivo && d.estado !== 'terminado';
  const fin = (f: DatoFaltante): DatoFaltante => (cerradoSinTerminar ? 'cancelado' : f);
  const inicio = ms(d.buscandoDesde);
  const asignado = ms(d.asignadoEn);
  const llego = ms(d.llegoEn);
  const iniciado = ms(d.iniciadoEn);
  const terminado = ms(d.terminadoEn);
  const llegadaPrevista =
    d.kmRecogida != null && d.tarifa ? segundosPorKm(d.kmRecogida, d.tarifa) : null;
  const recorridoPrevisto = d.duracionCotizadaS == null ? null : Number(d.duracionCotizadaS);
  return [
    tramo(
      'asignacion',
      inicio,
      asignado,
      d.topeBusquedaS,
      'inicio_busqueda',
      fin('asignado'),
      null,
      vivo,
      ahora,
    ),
    tramo(
      'llegada',
      asignado,
      llego,
      llegadaPrevista,
      'asignado',
      fin('conductor_llego'),
      d.tarifa ? 'distancia_conductor' : 'tarifa',
      vivo,
      ahora,
    ),
    tramo(
      'espera_pasajero',
      llego,
      iniciado,
      d.tarifa ? d.tarifa.esperaGratisS : null,
      'conductor_llego',
      fin('iniciado'),
      'tarifa',
      vivo,
      ahora,
    ),
    tramo(
      'recorrido',
      iniciado,
      terminado,
      recorridoPrevisto,
      'iniciado',
      fin('terminado'),
      'duracion_cotizada',
      vivo,
      ahora,
    ),
    tramo(
      'total',
      inicio,
      terminado,
      llegadaPrevista != null && recorridoPrevisto != null
        ? llegadaPrevista + recorridoPrevisto
        : null,
      'inicio_busqueda',
      fin('terminado'),
      llegadaPrevista == null ? (d.tarifa ? 'distancia_conductor' : 'tarifa') : 'duracion_cotizada',
      vivo,
      ahora,
    ),
  ];
}

/** «12 min», «1 h 05 min» o «45 s»: lo que se lee en la tarjeta de tiempos. */
export function textoDuracion(segundos: number | null): string {
  if (segundos == null) return '—';
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${h} h ${String(resto).padStart(2, '0')} min` : `${h} h`;
}

/** «+4 min», «−2 min» o «a tiempo» (diferencia cero). */
export function textoDiferencia(minutos: number | null, idioma: 'es' | 'en'): string {
  if (minutos == null) return '';
  if (minutos === 0) return idioma === 'en' ? 'right on time' : 'justo a tiempo';
  return minutos > 0 ? `+${minutos} min` : `−${Math.abs(minutos)} min`;
}
