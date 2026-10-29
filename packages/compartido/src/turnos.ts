/**
 * C-TURNOS-REPARTIDOR (29 oct 2026), como el «Schedule» de DoorDash: el repartidor reserva un turno
 * en franjas de 30 minutos, de 1 a 12 horas, hasta 7 días adelante. Mientras está en su turno y
 * conectado, tiene prioridad en las ofertas de su zona. Si no se conecta en los primeros 30
 * minutos, el turno se pierde.
 */
export const TURNO = {
  pasoMin: 30,
  minimoMin: 60,
  maximoMin: 12 * 60,
  dias: 7,
  graciaMin: 30,
} as const;

export function validarTurno(
  inicio: Date,
  fin: Date,
  ahora = new Date(),
): 'ok' | 'franja' | 'corto' | 'largo' | 'pasado' | 'lejos' {
  const paso = TURNO.pasoMin * 60_000;
  const a = inicio.getTime();
  const b = fin.getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || a % paso !== 0 || b % paso !== 0) return 'franja';
  const minutos = (b - a) / 60_000;
  if (minutos < TURNO.minimoMin) return 'corto';
  if (minutos > TURNO.maximoMin) return 'largo';
  // Se puede tomar el turno que está empezando (hasta su primera media hora).
  if (a < ahora.getTime() - paso) return 'pasado';
  if (a > ahora.getTime() + TURNO.dias * 86_400_000) return 'lejos';
  return 'ok';
}

/**
 * La medianoche de la hora local `n` días después de `ahora` (C-TURNOS-HORARIO, 29 oct 2026).
 * Sumar 24 horas fallaba en el cambio de hora: el 1 de noviembre dura 25 horas en Miami y desde
 * ahí cada día salía una hora antes (el domingo 1 aparecía dos veces en «Mis turnos»).
 */
export function inicioDelDia(ahora: number, n: number): number {
  const d = new Date(ahora);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.getTime();
}
