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
