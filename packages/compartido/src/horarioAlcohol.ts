import { abiertoPorHorario, proximaApertura, type Turno } from './horarios';

/**
 * C-ALCOHOL-HORARIO (1 nov 2026): el alcohol solo se pide en las horas legales del estado, como en
 * DoorDash y Uber Eats (el pedido con alcohol no sale fuera de esas horas aunque la tienda esté
 * abierta). Una sola tabla por estado; lo que no está cargado usa un horario prudente.
 * Fuentes: Florida § 562.14 (no se vende de 0:00 a 7:00 salvo ordenanza local); Michigan MCL
 * 436.2113 y 436.2114 (de 7:00 a 2:00; la mañana del domingo exige un permiso aparte, así que el
 * domingo arranca al mediodía). Ficha: docs/investigaciones-rea/2026-10-29-tiendas-reemplazos.md.
 */
const todos = (abre: string, cierra: string): Turno[] =>
  [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre, cierra }));

const HORARIO_ALCOHOL = new Map<string, Turno[]>([
  ['US-FL', todos('07:00', '00:00')],
  ['US-MI', todos('07:00', '02:00').map((t) => (t.dia === 0 ? { ...t, abre: '12:00' } : t))],
]);
const PRUDENTE = todos('08:00', '22:00');

/** «US-FL-MIAMI» → «US-FL»: el país y el estado, que es donde está la ley. */
export const estadoDeZona = (zonaId: string) => zonaId.split('-').slice(0, 2).join('-');

export function alcoholPermitido(
  zonaId: string,
  zonaHoraria: string,
  momento = new Date(),
): { ok: boolean; abre?: string } {
  const turnos = HORARIO_ALCOHOL.get(estadoDeZona(zonaId)) ?? PRUDENTE;
  if (abiertoPorHorario(turnos, zonaHoraria, momento)) return { ok: true };
  return { ok: false, abre: proximaApertura(turnos, zonaHoraria, momento)?.abre };
}
