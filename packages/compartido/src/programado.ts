import { type Turno, abiertoPorHorario, fechaLocal } from './horarios';

/**
 * C-PEDIDO-PROGRAMADO (29 oct 2026), como DoorDash y Uber Eats: el cliente elige día y franja de
 * 30 minutos, desde una hora adelante hasta 6 días después, solo cuando el comercio está abierto.
 * El restaurante empieza a ocuparse de él 45 minutos antes del inicio de la franja.
 */
export const PROGRAMADO = {
  /** Mínimo de anticipación respecto de ahora. */
  anticipacionMin: 60,
  /** Hasta cuántos días adelante (las autorizaciones de tarjeta duran 7). */
  dias: 6,
  /** Largo de cada franja. */
  franjaMin: 30,
  /** Cuánto antes del inicio de la franja se libera para el restaurante y los repartidores. */
  liberarAntesMin: 45,
} as const;

/** «AAAA-MM-DD HH:MM:SS» en UTC, como guarda la base. */
export const aSqlUtc = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
export const deSqlUtc = (s: string) => new Date(`${s.replace(' ', 'T')}Z`);

/** Las franjas que se pueden elegir (inicio de cada una), en orden. */
/** `cierres`: días cerrados del comercio (festivos), «AAAA-MM-DD» en su hora local. */
export function franjasProgramables(
  turnos: Turno[],
  zonaHoraria: string,
  ahora = new Date(),
  cierres: readonly string[] = [],
) {
  const paso = PROGRAMADO.franjaMin * 60_000;
  const desde = ahora.getTime() + PROGRAMADO.anticipacionMin * 60_000;
  const primera = Math.ceil(desde / paso) * paso;
  const hasta = ahora.getTime() + PROGRAMADO.dias * 86_400_000;
  const franjas: Date[] = [];
  for (let t = primera; t <= hasta; t += paso) {
    const d = new Date(t);
    // Abierto al empezar la franja y al terminarla (no se programa justo al cierre).
    if (
      !cierres.includes(fechaLocal(zonaHoraria, d)) &&
      abiertoPorHorario(turnos, zonaHoraria, d) &&
      abiertoPorHorario(turnos, zonaHoraria, new Date(t + paso - 60_000))
    )
      franjas.push(d);
  }
  return franjas;
}

/** ¿Vale esta franja? Devuelve el motivo si no. */
export function validarProgramado(
  inicio: Date,
  turnos: Turno[],
  zonaHoraria: string,
  ahora = new Date(),
  cierres: readonly string[] = [],
): 'ok' | 'pronto' | 'lejos' | 'cerrado' | 'franja' {
  const t = inicio.getTime();
  if (Number.isNaN(t) || t % (PROGRAMADO.franjaMin * 60_000) !== 0) return 'franja';
  if (t < ahora.getTime() + PROGRAMADO.anticipacionMin * 60_000) return 'pronto';
  if (t > ahora.getTime() + PROGRAMADO.dias * 86_400_000) return 'lejos';
  const fin = new Date(t + PROGRAMADO.franjaMin * 60_000 - 60_000);
  if (cierres.includes(fechaLocal(zonaHoraria, inicio))) return 'cerrado';
  if (
    !abiertoPorHorario(turnos, zonaHoraria, inicio) ||
    !abiertoPorHorario(turnos, zonaHoraria, fin)
  )
    return 'cerrado';
  return 'ok';
}

/** «hoy 12:00–12:30» / «vie 29 oct, 12:00–12:30» en la hora del comercio. */
export function textoFranja(
  inicio: Date,
  zonaHoraria: string,
  idioma: 'es' | 'en',
  ahora = new Date(),
) {
  const fin = new Date(inicio.getTime() + PROGRAMADO.franjaMin * 60_000);
  const loc = idioma === 'en' ? 'en-US' : 'es-US';
  const hora = (d: Date) =>
    d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit', timeZone: zonaHoraria });
  const dia = (d: Date) =>
    d.toLocaleDateString(loc, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: zonaHoraria,
    });
  const hoy = dia(inicio) === dia(ahora);
  const manana = dia(inicio) === dia(new Date(ahora.getTime() + 86_400_000));
  const cuando = hoy
    ? idioma === 'en'
      ? 'Today'
      : 'Hoy'
    : manana
      ? idioma === 'en'
        ? 'Tomorrow'
        : 'Mañana'
      : dia(inicio);
  return `${cuando}, ${hora(inicio)}–${hora(fin)}`;
}
