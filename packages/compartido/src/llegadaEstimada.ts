import { textoHora } from './formatoHora';
import { type Punto, metrosEntre } from './llegada';

/**
 * C-RASTREO-VIVO y C-HORA-LLEGADA (16 nov 2026, orden de Richard: «nosotros vivimos del tiempo y de
 * los mapas; esa es la esencia de la empresa»). Todos los países.
 *
 * La parte PURA de la hora estimada de llegada y del rastreo en vivo: en qué tramo va el repartidor o
 * el conductor, cuándo toca volver a preguntarle a Google, cuánto falta AHORA a partir del último
 * cálculo guardado (sin volver a calcular por cada persona que mira) y si está detenido. La usan el
 * servidor (que calcula y guarda UNA fila por pedido o viaje), la ficha del superadmin y las apps.
 *
 * Reglas de dinero (la nube no se come el dinero):
 * - Se recalcula como mucho cada `INTERVALO_LLEGADA_S` por pedido, y antes solo si cambió de tramo.
 *   Si no se movió `MOVIDO_PARA_RECALCULAR_M`, se espera hasta `REFRESCO_QUIETO_S`.
 * - Entre cálculos, lo que falta se descuenta con el reloj (`llegadaVigente`): mirar no calcula.
 */

/** Segundos mínimos entre dos cálculos de la llegada de un mismo pedido o viaje. */
export const INTERVALO_LLEGADA_S = 90;
/** Metros que tiene que moverse para que valga la pena volver a preguntar. */
export const MOVIDO_PARA_RECALCULAR_M = 150;
/** Sin moverse (atasco, espera): se vuelve a calcular cada 5 minutos, no cada 90 s. */
export const REFRESCO_QUIETO_S = 300;
/** Detenido: más de 3 minutos casi en el mismo lugar, lejos del local, la recogida y el destino. */
export const DETENIDO_S = 180;
/** «Casi en el mismo lugar»: dentro de este radio del último lugar donde se lo vio moverse. */
export const QUIETO_RADIO_M = 120;
/** A esta distancia del local, la recogida o el destino, estar quieto es normal (espera, entrega). */
export const CERCA_DE_PUNTO_M = 250;
/** Sin señal: la última ubicación tiene más de 3 minutos. */
export const SIN_SENAL_S = 180;

export type FasePedido = 'al_restaurante' | 'esperando' | 'llevando';
export type FaseViaje = 'a_recogida' | 'esperando_pasajero' | 'en_viaje';
export type FaseRastreo = FasePedido | FaseViaje;

const FASES_EN_MOVIMIENTO = new Set<FaseRastreo>([
  'al_restaurante',
  'llevando',
  'a_recogida',
  'en_viaje',
]);
const FASES_DE_ESPERA = new Set<FaseRastreo>(['esperando', 'esperando_pasajero']);

/** ¿El tramo es de espera (el local, el pasajero)? Ahí la llegada no avanza con el reloj. */
export function faseDeEspera(fase: FaseRastreo): boolean {
  return FASES_DE_ESPERA.has(fase);
}

/** El tramo de un pedido con repartidor (null si no está en marcha o no tiene repartidor). */
export function faseDePedido(p: {
  estado: string;
  conRepartidor: boolean;
  llegoAlRestaurante: boolean;
}): FasePedido | null {
  if (!p.conRepartidor) return null;
  if (p.estado === 'en_camino') return 'llevando';
  if (p.estado !== 'aceptado' && p.estado !== 'listo' && p.estado !== 'pagado') return null;
  return p.llegoAlRestaurante ? 'esperando' : 'al_restaurante';
}

/** El tramo de un viaje o envío con conductor (null si no está en marcha). */
export function faseDeViaje(estado: string): FaseViaje | null {
  if (estado === 'asignado') return 'a_recogida';
  if (estado === 'conductor_llego') return 'esperando_pasajero';
  if (estado === 'en_curso') return 'en_viaje';
  return null;
}

/** La última llegada calculada (una fila por pedido o viaje). */
export type CalculoLlegada = {
  fase: FaseRastreo;
  /** Segundos de la posición del cálculo hasta el destino final (la casa o el destino del viaje). */
  duracionS: number;
  /** Segundos hasta el próximo punto (el local o la recogida), si el tramo lo tiene. */
  tramoS: number | null;
  distanciaM: number;
  /** `trafico`: Google con tráfico; `estimada`: la fórmula de siempre (sin llave, tope, falla). */
  fuente: 'trafico' | 'estimada';
  desde: Punto;
  calculadaEn: number;
};

/** ¿Toca volver a calcular? Nunca por mirar: solo con una ubicación nueva del repartidor. */
export function hayQueRecalcular(
  previo: CalculoLlegada | null,
  ahora: { fase: FaseRastreo; posicion: Punto; ms: number },
  intervaloS = INTERVALO_LLEGADA_S,
): boolean {
  if (!previo) return true;
  if (previo.fase !== ahora.fase) return true;
  const pasaron = ahora.ms - previo.calculadaEn;
  if (pasaron < intervaloS * 1000) return false;
  if (metrosEntre(previo.desde, ahora.posicion) >= MOVIDO_PARA_RECALCULAR_M) return true;
  return pasaron >= REFRESCO_QUIETO_S * 1000;
}

export type LlegadaVigente = {
  fase: FaseRastreo;
  /** Hora (ms) en que llega al destino final. */
  llegaEnMs: number;
  faltanS: number;
  /** Segundos hasta el próximo punto (local o recogida), descontado el tiempo pasado. */
  tramoFaltanS: number | null;
  distanciaM: number;
  fuente: 'trafico' | 'estimada';
  /** Hace cuánto se calculó (para decirlo con honestidad). */
  calculadaHaceS: number;
};

/**
 * Lo que falta AHORA según el último cálculo: en un tramo en movimiento se descuenta el tiempo que
 * pasó (nunca baja de un minuto mientras no haya llegado); esperando, no avanza, y se suma lo que
 * todavía falta de espera (`esperaRestanteS`: la comida que no está lista).
 */
export function llegadaVigente(
  c: CalculoLlegada,
  ahoraMs = Date.now(),
  esperaRestanteS = 0,
): LlegadaVigente {
  const pasoS = Math.max(0, Math.round((ahoraMs - c.calculadaEn) / 1000));
  const espera = FASES_DE_ESPERA.has(c.fase);
  const faltanS = espera
    ? c.duracionS + Math.max(0, Math.round(esperaRestanteS))
    : Math.max(60, c.duracionS - pasoS);
  const tramoFaltanS = c.tramoS == null ? null : espera ? c.tramoS : Math.max(0, c.tramoS - pasoS);
  return {
    fase: c.fase,
    llegaEnMs: ahoraMs + faltanS * 1000,
    faltanS,
    tramoFaltanS,
    distanciaM: c.distanciaM,
    fuente: c.fuente,
    calculadaHaceS: pasoS,
  };
}

/** Minutos para leer («a 5 minutos»): al minuto más cercano y nunca menos de 1. */
export function minutosDeLlegada(segundos: number): number {
  return Math.max(1, Math.round(segundos / 60));
}

export type Detenido = { motivo: 'quieto' | 'sin_senal'; desdeS: number };

/**
 * ¿Está detenido? Sin señal hace más de 3 minutos, o más de 3 minutos casi en el mismo lugar en un
 * tramo en movimiento y lejos de los puntos donde detenerse es normal (el local, la recogida, el
 * destino). `ancla` es el último lugar donde se lo vio moverse (se guarda con cada cálculo).
 */
export function detenido(d: {
  fase: FaseRastreo | null;
  posicion: Punto | null;
  posicionEn: number | null;
  ancla: (Punto & { en: number }) | null;
  puntos: (Punto | null)[];
  ahoraMs?: number;
}): Detenido | null {
  const ahora = d.ahoraMs ?? Date.now();
  if (!d.fase || d.posicionEn == null || !d.posicion) return null;
  const posicion = d.posicion;
  const sinSenal = Math.round((ahora - d.posicionEn) / 1000);
  if (sinSenal > SIN_SENAL_S) return { motivo: 'sin_senal', desdeS: sinSenal };
  if (!FASES_EN_MOVIMIENTO.has(d.fase) || !d.ancla) return null;
  if (metrosEntre(d.ancla, posicion) >= QUIETO_RADIO_M) return null;
  const quietoS = Math.round((ahora - d.ancla.en) / 1000);
  if (quietoS <= DETENIDO_S) return null;
  const cerca = d.puntos.some((p) => p != null && metrosEntre(p, posicion) <= CERCA_DE_PUNTO_M);
  return cerca ? null : { motivo: 'quieto', desdeS: quietoS };
}

/**
 * Decodifica la línea de la ruta que manda Google («encoded polyline», algoritmo publicado por
 * Google). Solo se dibuja sobre un mapa de Google (sus términos).
 */
export function decodificarRuta(codigo: string | null | undefined): Punto[] {
  if (!codigo) return [];
  const puntos: Punto[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const siguiente = (): number | null => {
    let resultado = 0;
    let corrimiento = 0;
    let b: number;
    do {
      if (i >= codigo.length) return null;
      b = codigo.charCodeAt(i++) - 63;
      resultado |= (b & 0x1f) << corrimiento;
      corrimiento += 5;
    } while (b >= 0x20);
    return resultado & 1 ? ~(resultado >> 1) : resultado >> 1;
  };
  while (i < codigo.length) {
    const a = siguiente();
    const b = siguiente();
    if (a == null || b == null) break;
    lat += a;
    lng += b;
    puntos.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return puntos;
}

const FASES_TEXTO = {
  es: {
    al_restaurante: 'En camino al restaurante',
    esperando: 'Esperando en el restaurante',
    llevando: 'Llevando el pedido',
    a_recogida: 'En camino a recoger al pasajero',
    esperando_pasajero: 'Esperando al pasajero',
    en_viaje: 'En viaje al destino',
    a_recogida_envio: 'En camino a recoger el paquete',
    esperando_pasajero_envio: 'Esperando en la recogida',
    en_viaje_envio: 'Llevando el paquete',
  },
  en: {
    al_restaurante: 'Heading to the restaurant',
    esperando: 'Waiting at the restaurant',
    llevando: 'Delivering the order',
    a_recogida: 'Heading to pick up the rider',
    esperando_pasajero: 'Waiting for the rider',
    en_viaje: 'On the way to the destination',
    a_recogida_envio: 'Heading to pick up the package',
    esperando_pasajero_envio: 'Waiting at the pickup',
    en_viaje_envio: 'Delivering the package',
  },
} as const;

/** El tramo en palabras («En camino al restaurante», «Llevando el paquete»). */
export function textoFase(fase: FaseRastreo, idioma: 'es' | 'en', esEnvio = false): string {
  const t = new Map<string, string>(Object.entries(FASES_TEXTO[idioma === 'en' ? 'en' : 'es']));
  const deViaje = fase === 'a_recogida' || fase === 'esperando_pasajero' || fase === 'en_viaje';
  return t.get(esEnvio && deViaje ? `${fase}_envio` : fase) ?? fase;
}

/** «Última señal hace 3 min» / «Last signal 3 min ago» (en segundos si es menos de un minuto). */
/**
 * C-TIEMPO-HUMANO (16 nov 2026, Richard leyó «Sin señal hace 45805 min»): cuánto tiempo, en la
 * unidad que se entiende. Menos de un minuto en segundos, menos de una hora en minutos, menos de
 * dos días en horas («5 h» o «1 h 20 min»), y después en días («31 días» / «31 days»).
 */
export function tiempoHumano(segundos: number, idioma: 'es' | 'en'): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 48) {
    const resto = min % 60;
    return horas < 10 && resto ? `${horas} h ${resto} min` : `${Math.round(min / 60)} h`;
  }
  const dias = Math.floor(min / 1440);
  if (idioma === 'en') return `${dias} ${dias === 1 ? 'day' : 'days'}`;
  return `${dias} ${dias === 1 ? 'día' : 'días'}`;
}

export function textoUltimaSenal(segundos: number, idioma: 'es' | 'en'): string {
  const cuanto = tiempoHumano(segundos, idioma);
  return idioma === 'en' ? `Last signal ${cuanto} ago` : `Última señal hace ${cuanto}`;
}

/** «Detenido hace 4 min» / «Sin señal hace 5 min» para la ficha y la lista del monitoreo. */
export function textoDetenido(d: Detenido, idioma: 'es' | 'en'): string {
  const cuanto = tiempoHumano(Math.max(60, d.desdeS), idioma);
  if (d.motivo === 'sin_senal')
    return idioma === 'en' ? `No signal for ${cuanto}` : `Sin señal hace ${cuanto}`;
  return idioma === 'en' ? `Stopped for ${cuanto}` : `Detenido hace ${cuanto}`;
}

/** Lo que reciben las apps del cliente y la ficha (`llegadaEnVivo` del servidor). */
export type LlegadaEnVivo = {
  fase: FaseRastreo;
  /** Hora de llegada (ISO). */
  llegaEn: string;
  faltanS: number;
  tramoFaltanS: number | null;
  distanciaM: number;
  fuente: 'trafico' | 'estimada';
  calculadaHaceS: number;
};

/**
 * «3:28 p. m.» / «3:28 PM» en la hora del celular de quien mira (está en la ciudad del pedido). Las
 * apps usan reloj de 12 horas, como el resto de sus horas.
 */
export function textoHoraLlegada(iso: string, idioma: 'es' | 'en'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return textoHora(d.getHours(), d.getMinutes(), '12', idioma === 'en' ? 'en' : 'es');
}
