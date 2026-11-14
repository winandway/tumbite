/**
 * C-VIAJE-PROGRAMADO (14 nov 2026, todos los países): reservar un viaje o un envío para más tarde,
 * copiado de Uber Reserve [DOC: help.uber.com «Reserve»] y del pedido programado de Comida. El precio
 * se fija al reservar (la cotización de ese momento), se cancela gratis hasta 60 minutos antes y la
 * búsqueda de conductor arranca unos minutos antes de la hora (por ciudad; 15 si nadie lo cambió).
 */
export const VIAJE_PROGRAMADO = {
  /** Lo más pronto que se puede reservar, en minutos desde ahora. */
  minAnticipoMin: 30,
  /** Lo más lejos, en días. */
  maxDias: 7,
  /** Hasta cuántos minutos antes de la hora se cancela sin cargo. */
  cancelacionGratisMin: 60,
  /** Cuántos minutos antes de la hora empieza a buscar conductor (por defecto). */
  despachoAntesMin: 15,
  /** Rango que el equipo puede poner por ciudad. */
  despachoAntesMinimo: 5,
  despachoAntesMaximo: 60,
  /** Cuántas reservas pendientes puede tener una persona a la vez. */
  maxPendientes: 5,
} as const;

export type HoraProgramada = 'ok' | 'pronto' | 'lejos';

/** ¿Se puede reservar a esa hora? Desde 30 minutos hasta 7 días desde ahora. */
export function validarHoraViajeProgramado(hora: Date, ahora: Date = new Date()): HoraProgramada {
  const min = (hora.getTime() - ahora.getTime()) / 60_000;
  if (!Number.isFinite(min) || min < VIAJE_PROGRAMADO.minAnticipoMin) return 'pronto';
  if (min > VIAJE_PROGRAMADO.maxDias * 24 * 60) return 'lejos';
  return 'ok';
}

/** ¿Cancelarla ahora es gratis? Gratis hasta 60 minutos antes de la hora. */
export function cancelacionProgramadaGratis(hora: Date, ahora: Date = new Date()): boolean {
  return hora.getTime() - ahora.getTime() >= VIAJE_PROGRAMADO.cancelacionGratisMin * 60_000;
}

/**
 * Las horas que la app ofrece para elegir: cada 15 minutos, desde la primera que cumple los 30
 * minutos de anticipo hasta los 7 días. Agrupadas por día en la pantalla.
 */
export function horasParaProgramar(ahora: Date = new Date(), pasoMin = 15): Date[] {
  const paso = pasoMin * 60_000;
  const desde = ahora.getTime() + VIAJE_PROGRAMADO.minAnticipoMin * 60_000;
  const primera = Math.ceil(desde / paso) * paso;
  const hasta = ahora.getTime() + VIAJE_PROGRAMADO.maxDias * 24 * 3_600_000;
  const horas: Date[] = [];
  for (let t = primera; t <= hasta; t += paso) horas.push(new Date(t));
  return horas;
}
