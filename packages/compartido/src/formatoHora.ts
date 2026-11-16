import { fechaBase } from './semaforo';

/**
 * C-HORARIO-EMPLEADO (15 nov 2026, pedido de Richard: «Horarios en Configuración»). Todos los
 * países. UNA sola pieza para escribir fechas y horas en el superadmin, con la preferencia de cada
 * empleado: zona horaria (automática, la de la ciudad del dato que se mira, o una fija) y reloj de
 * 12 horas con a. m./p. m. o de 24 horas. Por defecto, 12 horas en Estados Unidos.
 *
 * El texto se arma a mano con las partes de `Intl` (no con `toLocaleString`), así sale igual en
 * cualquier navegador y en las pruebas: «Nov 15, 2:05 PM» / «15 nov, 2:05 p. m.» / «15 nov, 14:05».
 */

export type FormatoReloj = '12' | '24';
/** Lo que guarda el empleado: «auto» (según el país) o un reloj fijo. */
export type AjusteFormatoReloj = 'auto' | FormatoReloj;
export type EstiloFecha =
  'fecha_hora' | 'hora' | 'hora_segundos' | 'fecha' | 'fecha_larga' | 'fecha_hora_larga';

/** Países donde la gente lee la hora en 12 horas con a. m./p. m. (los demás, 24 horas). */
export const PAISES_RELOJ_12 = [
  'US',
  'CA',
  'MX',
  'CO',
  'VE',
  'PR',
  'DO',
  'PA',
  'SV',
  'HN',
] as const;

/** El reloj por defecto de un país (sin país: el de Estados Unidos, donde arranca Divoox). */
export function formatoPorDefecto(pais?: string | null): FormatoReloj {
  if (!pais) return '12';
  return (PAISES_RELOJ_12 as readonly string[]).includes(pais.toUpperCase()) ? '12' : '24';
}

export function formatoEfectivo(
  ajuste: string | null | undefined,
  pais?: string | null,
): FormatoReloj {
  return ajuste === '12' || ajuste === '24' ? ajuste : formatoPorDefecto(pais);
}

/** ¿Es una zona horaria que el navegador conoce («America/New_York»)? */
export function zonaValida(zona: string | null | undefined): zona is string {
  if (!zona || !/^[A-Za-z0-9_/+-]{1,60}$/.test(zona) || zona.includes('//')) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

/** La zona horaria de esta computadora (si no se puede leer, Nueva York). */
export function zonaDelNavegador(): string {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zonaValida(z) ? z : 'America/New_York';
  } catch {
    return 'America/New_York';
  }
}

/**
 * La zona en la que se muestra un dato: la fija del empleado si eligió una; si está en automático,
 * la de la ciudad del dato; si el dato no tiene ciudad, la de la computadora.
 */
export function zonaEfectiva(
  ajuste: string | null | undefined,
  zonaDelDato: string | null | undefined,
  navegador = zonaDelNavegador(),
): string {
  if (ajuste && ajuste !== 'auto' && zonaValida(ajuste)) return ajuste;
  if (zonaValida(zonaDelDato)) return zonaDelDato;
  return navegador;
}

/** La zona «del empleado»: la fija que eligió o, en automático, la de su computadora. */
export function zonaDelEmpleado(
  ajuste: string | null | undefined,
  navegador = zonaDelNavegador(),
): string {
  return ajuste && ajuste !== 'auto' && zonaValida(ajuste) ? ajuste : navegador;
}

function aMs(fecha: string | number | Date | null | undefined): number | null {
  if (fecha == null || fecha === '') return null;
  if (typeof fecha === 'number') return Number.isFinite(fecha) ? fecha : null;
  if (fecha instanceof Date) return Number.isNaN(fecha.getTime()) ? null : fecha.getTime();
  const v = fechaBase(fecha);
  return Number.isNaN(v) ? null : v;
}

type Partes = {
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
};

function partesEn(msUtc: number, zona: string): Partes {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  });
  const p = new Map<string, string>(f.formatToParts(new Date(msUtc)).map((x) => [x.type, x.value]));
  const n = (k: string) => Number(p.get(k) ?? 0);
  return {
    anio: n('year'),
    mes: n('month'),
    dia: n('day'),
    hora: n('hour') % 24,
    minuto: n('minute'),
    segundo: n('second'),
  };
}

const MESES = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
} as const;

/** «2:05 PM», «2:05 p. m.» o «14:05». */
export function textoHora(
  h: number,
  m: number,
  formato: FormatoReloj,
  idioma: 'es' | 'en',
): string {
  const mm = String(m).padStart(2, '0');
  if (formato === '24') return `${String(h).padStart(2, '0')}:${mm}`;
  const h12 = h % 12 || 12;
  const tarde = h >= 12;
  const periodo = idioma === 'en' ? (tarde ? 'PM' : 'AM') : tarde ? 'p. m.' : 'a. m.';
  return `${h12}:${mm} ${periodo}`;
}

export type OpcionesFecha = {
  idioma: 'es' | 'en';
  formato: FormatoReloj;
  zona: string;
  estilo?: EstiloFecha;
  /** Para decidir si se escribe el año (por defecto, ahora). */
  ahora?: number;
};

/**
 * Una fecha de la base («2026-11-15 19:05:00», UTC sin zona), ISO, número o Date, escrita en la zona
 * y el reloj pedidos. El año solo aparece si no es el de este momento (o con el estilo largo).
 */
export function formatearFechaHora(
  fecha: string | number | Date | null | undefined,
  o: OpcionesFecha,
): string {
  const v = aMs(fecha);
  if (v == null) return typeof fecha === 'string' ? fecha : '';
  const zona = zonaValida(o.zona) ? o.zona : 'UTC';
  const p = partesEn(v, zona);
  const estilo = o.estilo ?? 'fecha_hora';
  const hora = textoHora(p.hora, p.minuto, o.formato, o.idioma);
  if (estilo === 'hora') return hora;
  if (estilo === 'hora_segundos') {
    const ss = `:${String(p.segundo).padStart(2, '0')}`;
    // «2:05:09 PM» / «14:05:09»: los segundos van antes de a. m./p. m.
    return o.formato === '24' ? `${hora}${ss}` : hora.replace(/^(\d{1,2}:\d{2})/, `$1${ss}`);
  }
  const mes = (o.idioma === 'en' ? MESES.en : MESES.es)[p.mes - 1] ?? '';
  const conAnio =
    estilo === 'fecha_hora_larga' ||
    estilo === 'fecha_larga' ||
    partesEn(o.ahora ?? Date.now(), zona).anio !== p.anio;
  const fechaTexto =
    o.idioma === 'en'
      ? `${mes} ${p.dia}${conAnio ? `, ${p.anio}` : ''}`
      : `${p.dia} ${mes}${conAnio ? ` ${p.anio}` : ''}`;
  if (estilo === 'fecha' || estilo === 'fecha_larga') return fechaTexto;
  return `${fechaTexto}, ${hora}`;
}

/** La abreviatura de la zona en ese momento («EST», «EDT», «GMT-4»). */
export function abreviaturaZona(
  zona: string,
  fecha: string | number | Date | null | undefined = Date.now(),
  idioma: 'es' | 'en' = 'en',
): string {
  const v = aMs(fecha) ?? Date.now();
  if (!zonaValida(zona)) return zona;
  try {
    const p = new Intl.DateTimeFormat(idioma === 'en' ? 'en-US' : 'es-US', {
      timeZone: zona,
      timeZoneName: 'short',
    })
      .formatToParts(new Date(v))
      .find((x) => x.type === 'timeZoneName');
    return p?.value ?? zona;
  } catch {
    return zona;
  }
}

/** Minutos de diferencia entre dos zonas en un momento (para decir si «coinciden»). */
export function desfaseMin(zona: string, ms: number): number {
  const p = partesEn(ms, zona);
  const comoUtc = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto);
  return Math.round((comoUtc - Math.floor(ms / 60000) * 60000) / 60000);
}

/** ¿Dos zonas marcan la misma hora en ese momento? (Miami y Nueva York sí; Miami y Caracas no). */
export function mismaHora(a: string, b: string, ms = Date.now()): boolean {
  if (a === b) return true;
  if (!zonaValida(a) || !zonaValida(b)) return false;
  return desfaseMin(a, ms) === desfaseMin(b, ms);
}

/** El nombre legible de una zona («America/New_York» → «New York»). */
export function nombreZona(zona: string): string {
  return (zona.split('/').pop() ?? zona).replace(/_/g, ' ');
}
