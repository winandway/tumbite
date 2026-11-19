/**
 * C-MISMA-RUTA (15 nov 2026) — todos los países. La lógica pura de «Mis viajes» y «Pedir la misma
 * ruta», sin React Native (se prueba en node):
 *
 * - qué viaje se puede repetir y con qué datos se cotiza otra vez (mismo origen, paradas, destino,
 *   servicio y categoría);
 * - con qué se pide: SIEMPRE la cotización nueva del servidor (su id y su precio), nunca el precio
 *   viejo del historial; la misma forma de pago si la ciudad la sigue aceptando;
 * - la proyección de las coordenadas reales al recuadro del mapita;
 * - la agrupación por mes.
 */
import type { CategoriaViaje, CotizacionViaje, RegaloDelViaje } from '@tumbite/compartido';

export type PuntoMapa = { lat: number; lng: number };
export type ParadaHistorial = PuntoMapa & { direccion: string };

/** Una fila de GET /datos/viajes/historial (pasajero). */
export type ViajeHistorial = {
  id: string;
  servicio: string;
  categoria: string | null;
  estado: string;
  origen: string;
  destino: string;
  total: number | null;
  moneda: string | null;
  metodoPago: string;
  creadoEn: string;
  puntos: { origen: PuntoMapa; destino: PuntoMapa; paradas: ParadaHistorial[] } | null;
  /** C-CONDUCTOR-CONFIANZA: el nombre de pila del conductor de un viaje terminado (o null). */
  conductor?: string | null;
  /** Si ese conductor ya es de confianza del pasajero. */
  deConfianza?: boolean;
  /** C-VIAJES-FIJOS: de qué viaje fijo nació y el menor que llevó. */
  rutinaId?: string | null;
  menor?: string | null;
  /** C-PRECIO-CON-REGALO: el regalo del viaje (el precio se muestra tachado con lo que se pagó). */
  regalo?: RegaloDelViaje | null;
};

export type MetodoPagoViaje = 'efectivo' | 'tarjeta' | 'pago_movil' | 'yape' | 'plin';
const METODOS: readonly MetodoPagoViaje[] = ['efectivo', 'tarjeta', 'pago_movil', 'yape', 'plin'];
const CATEGORIAS: readonly CategoriaViaje[] = ['estandar', 'comfort', 'premium', 'xl'];

/** Solo los viajes de pasajero (Moto y Carro) con sus puntos exactos se pueden repetir. */
export function sePuedeRepetir(v: ViajeHistorial): boolean {
  return (v.servicio === 'moto' || v.servicio === 'carro') && v.puntos != null;
}

/** La categoría del viaje: solo Carro tiene categorías; lo desconocido vuelve al carro de siempre. */
export function categoriaDe(v: Pick<ViajeHistorial, 'servicio' | 'categoria'>): CategoriaViaje {
  if (v.servicio !== 'carro') return 'estandar';
  return CATEGORIAS.find((c) => c === v.categoria) ?? 'estandar';
}

/** El cuerpo de POST /datos/viajes/cotizar para la misma ruta (el precio lo calcula el servidor). */
export function cuerpoCotizarMismaRuta(v: ViajeHistorial) {
  if (!sePuedeRepetir(v) || !v.puntos) return null;
  const { origen, destino, paradas } = v.puntos;
  return {
    servicio: v.servicio as 'moto' | 'carro',
    categoria: categoriaDe(v),
    origen: { lat: origen.lat, lng: origen.lng, direccion: v.origen },
    paradas: paradas.map((p) => ({ lat: p.lat, lng: p.lng, direccion: p.direccion })),
    destino: { lat: destino.lat, lng: destino.lng, direccion: v.destino },
  };
}

/**
 * Con qué se paga la misma ruta: la forma de pago de la vez pasada si la ciudad la sigue aceptando;
 * si no, la primera que acepte (y se avisa: `cambio`).
 */
export function metodoParaRepetir(
  anterior: string,
  aceptados: readonly string[] | undefined,
): { metodo: MetodoPagoViaje; cambio: boolean } {
  const lista = (aceptados?.length ? aceptados : ['efectivo', 'tarjeta']).flatMap((m) =>
    METODOS.filter((x) => x === m),
  );
  const igual = lista.find((m) => m === anterior);
  if (igual) return { metodo: igual, cambio: false };
  return { metodo: lista[0] ?? 'efectivo', cambio: true };
}

/**
 * El pedido de la misma ruta: el id de la cotización NUEVA y la forma de pago. No lleva precio: el
 * servidor cobra lo que guardó en esa cotización. Si la cotización no es del mismo servicio y
 * categoría, no se pide nada (null).
 */
export function pedidoMismaRuta(v: ViajeHistorial, cot: CotizacionViaje) {
  if (!sePuedeRepetir(v)) return null;
  if (cot.servicio !== v.servicio) return null;
  if ((cot.categoria ?? 'estandar') !== categoriaDe(v)) return null;
  const pago = metodoParaRepetir(v.metodoPago, cot.metodosPago);
  return { cuerpo: { cotizacionId: cot.id, metodoPago: pago.metodo }, cambioPago: pago.cambio };
}

/** Lo que muestra la confirmación: el precio y el tiempo son SIEMPRE los de la cotización nueva. */
export function resumenConfirmacion(v: ViajeHistorial, cot: CotizacionViaje) {
  return {
    origen: v.origen,
    destino: v.destino,
    paradas: v.puntos?.paradas.map((p) => p.direccion) ?? [],
    categoria: categoriaDe(v),
    servicio: v.servicio,
    precio: cot.total,
    moneda: cot.moneda,
    minutos: Math.max(1, Math.round(cot.duracionS / 60)),
    precioAntes: v.total != null && v.total !== cot.total ? v.total : null,
  };
}

/** Lo que se deja escrito en «Pedir viaje» al tocar «Cambiar algo» (las mismas casillas del borrador). */
export function rellenoPedirViaje(v: ViajeHistorial) {
  if (!sePuedeRepetir(v) || !v.puntos) return null;
  const { origen, destino, paradas } = v.puntos;
  return {
    recogida: v.origen,
    recogidaLat: String(origen.lat),
    recogidaLng: String(origen.lng),
    destino: v.destino,
    destinoLat: String(destino.lat),
    destinoLng: String(destino.lng),
    paradas: JSON.stringify(
      paradas.map((p) => ({ direccion: p.direccion, lat: p.lat, lng: p.lng })),
    ),
    categoria: categoriaDe(v),
    metodo: METODOS.find((m) => m === v.metodoPago) ?? 'efectivo',
    cuando: '',
  };
}

/**
 * Proyecta los puntos reales (recogida, paradas, destino) al recuadro del mapita: proyección plana
 * con la longitud corregida por la latitud, misma escala en los dos ejes (la forma de la ruta no se
 * deforma), centrada y con margen. Un solo punto (o todos iguales) queda en el centro.
 */
export function proyectarRuta(
  puntos: readonly PuntoMapa[],
  ancho: number,
  alto: number,
  margen = 16,
): { x: number; y: number }[] {
  if (!puntos.length) return [];
  const latMedia = puntos.reduce((s, p) => s + p.lat, 0) / puntos.length;
  const k = Math.cos((latMedia * Math.PI) / 180);
  const planos = puntos.map((p) => ({ x: p.lng * k, y: -p.lat }));
  const xs = planos.map((p) => p.x);
  const ys = planos.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const anchoReal = Math.max(...xs) - minX;
  const altoReal = Math.max(...ys) - minY;
  const libreX = Math.max(1, ancho - 2 * margen);
  const libreY = Math.max(1, alto - 2 * margen);
  if (anchoReal === 0 && altoReal === 0) return planos.map(() => ({ x: ancho / 2, y: alto / 2 }));
  const escala = Math.min(
    anchoReal > 0 ? libreX / anchoReal : Infinity,
    altoReal > 0 ? libreY / altoReal : Infinity,
  );
  const dx = (ancho - anchoReal * escala) / 2;
  const dy = (alto - altoReal * escala) / 2;
  return planos.map((p) => ({ x: dx + (p.x - minX) * escala, y: dy + (p.y - minY) * escala }));
}

/** Los puntos del viaje en orden: recogida, paradas y destino. */
export function puntosEnOrden(v: ViajeHistorial): PuntoMapa[] {
  if (!v.puntos) return [];
  return [v.puntos.origen, ...v.puntos.paradas, v.puntos.destino];
}

const MESES = {
  es: [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};

/** Fecha del servidor («AAAA-MM-DD HH:MM:SS», UTC) a Date. */
export const fechaServidor = (f: string) => new Date(`${f.replace(' ', 'T')}Z`);

/** Agrupa por mes (hora del teléfono), en el orden de la lista; el año se dice si no es el actual. */
export function agruparPorMes<V extends { creadoEn: string }>(
  viajes: readonly V[],
  idioma: 'es' | 'en',
  hoy: Date = new Date(),
): { clave: string; titulo: string; viajes: V[] }[] {
  const grupos: { clave: string; titulo: string; viajes: V[] }[] = [];
  for (const v of viajes) {
    const f = fechaServidor(v.creadoEn);
    const clave = `${f.getFullYear()}-${f.getMonth()}`;
    const ultimo = grupos.at(-1);
    if (ultimo?.clave === clave) {
      ultimo.viajes.push(v);
      continue;
    }
    const mes = (idioma === 'en' ? MESES.en : MESES.es).at(f.getMonth()) ?? '';
    grupos.push({
      clave,
      titulo: f.getFullYear() === hoy.getFullYear() ? mes : `${mes} ${f.getFullYear()}`,
      viajes: [v],
    });
  }
  return grupos;
}

/**
 * C-PEDIR-OTRA-VEZ (18 nov 2026): «Pedir otra vez» desde la pantalla de un viaje terminado o
 * cancelado deja escrito el formulario con ESE viaje: recogida, destino, paradas, categoría y forma
 * de pago (antes el formulario abría con el destino o la recogida vacíos). Sin coordenadas, nada.
 */
export function rellenoDeEsteViaje(v: {
  servicio: string;
  categoria?: string | null;
  metodoPago: string;
  origen: { direccion: string; lat: number; lng: number };
  destino: { direccion: string; lat: number; lng: number };
  paradas?: { lat: number; lng: number; direccion: string }[];
}) {
  const valido = (p: { lat: number; lng: number }) =>
    Number.isFinite(p.lat) && Number.isFinite(p.lng);
  if (!valido(v.origen) || !valido(v.destino)) return null;
  return {
    recogida: v.origen.direccion,
    recogidaLat: String(v.origen.lat),
    recogidaLng: String(v.origen.lng),
    destino: v.destino.direccion,
    destinoLat: String(v.destino.lat),
    destinoLng: String(v.destino.lng),
    paradas: JSON.stringify(
      (v.paradas ?? []).map((p) => ({ direccion: p.direccion, lat: p.lat, lng: p.lng })),
    ),
    categoria: categoriaDe({ servicio: v.servicio, categoria: v.categoria ?? null }),
    metodo: METODOS.find((m) => m === v.metodoPago) ?? 'efectivo',
    cuando: '',
  };
}
