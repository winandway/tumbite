/**
 * Horarios del restaurante: turnos por día en la hora de su zona. «¿Está abierto ahora?» y
 * «¿a qué hora abre?» se calculan aquí, igual en el servidor, el panel y las apps.
 */
export type Turno = { dia: number; abre: string; cierra: string };

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
export const esHora = (h: string) => HORA.test(h);
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

/** Día (0 = domingo) y minutos del día en la zona horaria dada. */
export function momentoEn(zonaHoraria: string, ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zonaHoraria,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(ahora);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  const dias = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    dia: Math.max(0, dias.indexOf(v('weekday'))),
    minutos: Number(v('hour')) * 60 + Number(v('minute')),
  };
}

/** ¿Hay un turno abierto en este momento? Sin turnos cargados, no se puede decir que esté cerrado. */
export function abiertoPorHorario(
  turnos: Turno[],
  zonaHoraria: string,
  ahora = new Date(),
): boolean {
  if (!turnos.length) return true;
  const { dia, minutos: m } = momentoEn(zonaHoraria, ahora);
  const ayer = (dia + 6) % 7;
  return turnos.some((t) => {
    const a = minutos(t.abre);
    const c = minutos(t.cierra);
    if (c > a) return t.dia === dia && m >= a && m < c;
    // Cierra después de medianoche: hoy desde «abre», o la madrugada de hoy si el turno es de ayer.
    return (t.dia === dia && m >= a) || (t.dia === ayer && m < c);
  });
}

/** El próximo turno que abre: en cuántos días (0 = hoy) y a qué hora. Null si no hay turnos. */
export function proximaApertura(
  turnos: Turno[],
  zonaHoraria: string,
  ahora = new Date(),
): { enDias: number; abre: string } | null {
  if (!turnos.length) return null;
  const { dia, minutos: m } = momentoEn(zonaHoraria, ahora);
  for (let d = 0; d < 8; d++) {
    const candidatos = turnos
      .filter((t) => t.dia === (dia + d) % 7 && (d > 0 || minutos(t.abre) > m))
      .sort((x, y) => minutos(x.abre) - minutos(y.abre));
    if (candidatos[0]) return { enDias: d, abre: candidatos[0].abre };
  }
  return null;
}

/** «Abre hoy a las 6:00 p. m.» / «Opens tomorrow at 11:00 AM». */
export function textoApertura(
  proxima: { enDias: number; abre: string } | null,
  idioma: 'es' | 'en',
): string {
  if (!proxima) return idioma === 'en' ? 'Closed' : 'Cerrado';
  const [h, mi] = proxima.abre.split(':').map(Number) as [number, number];
  const hora = new Date(Date.UTC(2026, 0, 4 + proxima.enDias, h, mi)).toLocaleTimeString(
    idioma === 'en' ? 'en-US' : 'es-US',
    { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' },
  );
  const dias =
    idioma === 'en'
      ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      : ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  if (proxima.enDias === 0)
    return idioma === 'en' ? `Opens today at ${hora}` : `Abre hoy a las ${hora}`;
  if (proxima.enDias === 1)
    return idioma === 'en' ? `Opens tomorrow at ${hora}` : `Abre mañana a las ${hora}`;
  const nombreDia = dias.at((new Date().getDay() + proxima.enDias) % 7) ?? '';
  return idioma === 'en' ? `Opens ${nombreDia} at ${hora}` : `Abre el ${nombreDia} a las ${hora}`;
}

/** La fecha (AAAA-MM-DD) de «ahora» en la zona horaria del restaurante, para los festivos y cierres. */
export function fechaLocal(zonaHoraria: string, ahora = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: zonaHoraria,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(ahora);
  } catch {
    return ahora.toISOString().slice(0, 10);
  }
}

/** C-MENU-HORARIO: franja diaria de una categoría del menú (desayuno de 07:00 a 11:00). */
export type VentanaCategoria = { categoria: string; abre: string; cierra: string };

/** ¿La categoría se sirve ahora? Sin franja, siempre. Acepta franjas que cruzan la medianoche. */
export function categoriaEnHorario(
  ventana: { abre: string; cierra: string } | undefined,
  zonaHoraria: string,
  ahora = new Date(),
): boolean {
  if (!ventana) return true;
  return abiertoPorHorario(
    [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: ventana.abre, cierra: ventana.cierra })),
    zonaHoraria,
    ahora,
  );
}
