import { distanciaKm } from './catalogo';
import { minutosDeViaje } from './despacho';

/**
 * C-SEGUIMIENTO-HONESTO (BRE-2, 2 nov 2026). Como piden los estudios de Richard
 * («Estudio-plataforma-de-comida-DoorDash-Uber-Eats-Rappi», reglas del seguimiento): mostrar un
 * rango entendible y la última actualización, no una precisión falsa; si el mapa se congela,
 * indicarlo; un tiempo viejo no se presenta como seguimiento en vivo. Una sola pieza para la app
 * del cliente, el enlace compartido y el servidor. Ficha:
 * docs/investigaciones-rea/2026-11-02-seguimiento-honesto.md.
 */

/** Pasado este tiempo sin ubicación nueva, el mapa deja de presentarse como «en vivo». */
export const SENAL_PERDIDA_S = 60;
/** Ancho del rango de llegada (Uber Eats y DoorDash muestran «12:40–12:50»). */
export const ANCHO_RANGO_MIN = 10;
/** El rango nunca se recorta a menos de esto, aunque el «a más tardar» quede muy cerca. */
export const RANGO_MINIMO_MIN = 5;

type Punto = { lat: number; lng: number };

/** Segundos desde una hora de la base («AAAA-MM-DD HH:MM:SS» en UTC) o ISO. Nunca negativos. */
export function segundosDesde(fecha: string | null | undefined, ahora = Date.now()): number | null {
  if (!fecha) return null;
  const iso = fecha.includes('T') ? fecha : `${fecha.replace(' ', 'T')}Z`;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.round((ahora - ms) / 1000));
}

/** ¿Se perdió la señal del repartidor? Sin dato no se acusa a nadie: el mapa simplemente no sale. */
export function senalPerdida(segundos: number | null | undefined): boolean {
  return segundos != null && segundos > SENAL_PERDIDA_S;
}

/** «Actualizado hace 8 s» / «Updated 8 s ago»; desde un minuto, en minutos. */
export function textoActualizado(segundos: number, idioma: 'es' | 'en'): string {
  if (segundos < 1) return idioma === 'en' ? 'Updated just now' : 'Actualizado hace un momento';
  const cuanto = segundos < 60 ? `${segundos} s` : `${Math.floor(segundos / 60)} min`;
  return idioma === 'en' ? `Updated ${cuanto} ago` : `Actualizado hace ${cuanto}`;
}

export type RangoLlegada = { desde: string; hasta: string; atrasado?: true };

/**
 * La llegada como rango: desde «ahora + minutos estimados» (al minuto), diez minutos de ancho, sin
 * pasar del «a más tardar» prometido (pero nunca menos de cinco minutos de ancho).
 *
 * BRE-R (4): si ni siquiera el rango mínimo cabe antes del «a más tardar», el pedido va atrasado:
 * se da el rango honesto de diez minutos marcado `atrasado` y la pantalla dice «Viene con retraso»
 * en vez de un rango que se pasa de la hora prometida (como el «Running late» de DoorDash).
 */
export function rangoLlegada(
  ahora: number,
  minutosEstimados: number | null | undefined,
  llegaAMasTardar: string | null | undefined,
): RangoLlegada | null {
  if (minutosEstimados == null || !Number.isFinite(minutosEstimados)) return null;
  const desde = Math.floor((ahora + minutosEstimados * 60_000) / 60_000) * 60_000;
  let hasta = desde + ANCHO_RANGO_MIN * 60_000;
  const tope = llegaAMasTardar ? Date.parse(llegaAMasTardar) : NaN;
  if (!Number.isNaN(tope) && tope < desde + RANGO_MINIMO_MIN * 60_000)
    return {
      desde: new Date(desde).toISOString(),
      hasta: new Date(hasta).toISOString(),
      atrasado: true,
    };
  if (!Number.isNaN(tope) && tope < hasta) hasta = tope;
  return { desde: new Date(desde).toISOString(), hasta: new Date(hasta).toISOString() };
}

/** Lo que se muestra en lugar del «a más tardar» cuando el rango ya se pasó de esa hora. */
export function textoAtrasado(idioma: 'es' | 'en'): string {
  return idioma === 'en' ? 'Running late' : 'Viene con retraso';
}

/** «11:40 AM–11:50 AM» en la hora y el idioma de quien lo mira. */
export function textoRango(r: RangoLlegada, idioma: 'es' | 'en', zona?: string): string {
  const f = (iso: string) =>
    new Date(iso).toLocaleTimeString(idioma === 'en' ? 'en-US' : 'es-US', {
      hour: 'numeric',
      minute: '2-digit',
      ...(zona ? { timeZone: zona } : {}),
    });
  return `${f(r.desde)}–${f(r.hasta)}`;
}

/**
 * Minutos que faltan y hora «a más tardar» de un pedido. Lo que falta de cocina + el viaje a
 * 25 km/h de ciudad (mínimo 5 min); el «a más tardar» se fija al aceptar (su tiempo + el viaje del
 * restaurante a la casa + 10 de margen). La misma cuenta para la app y el enlace compartido.
 */
export function estimacionLlegada(p: {
  estado: string;
  tiempoPrepMin: number | null;
  aceptadoMs: number | null;
  restaurante: Punto | null;
  casa: Punto | null;
  repartidor: Punto | null;
}): { minutosEstimados: number | null; llegaAMasTardar: string | null } {
  const terminado = p.estado === 'entregado' || p.estado === 'cancelado';
  const prep = Number(p.tiempoPrepMin ?? 20);
  const origen = p.repartidor ?? p.restaurante;
  const km = origen && p.casa ? distanciaKm(origen, p.casa) : null;
  const viaje = km == null ? null : Math.max(5, Math.round((km / 25) * 60));
  const cocina = p.estado === 'pagado' || p.estado === 'aceptado' ? prep : 0;
  const minutosEstimados = terminado || viaje == null ? null : cocina + viaje;
  const viajeRestCasa =
    p.restaurante && p.casa ? minutosDeViaje(distanciaKm(p.restaurante, p.casa)) : 15;
  const llegaAMasTardar =
    p.aceptadoMs != null && !terminado
      ? new Date(p.aceptadoMs + (prep + viajeRestCasa + 10) * 60_000).toISOString()
      : null;
  return { minutosEstimados, llegaAMasTardar };
}
