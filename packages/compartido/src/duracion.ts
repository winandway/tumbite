/**
 * C-DURACION-EN-PALABRAS (16 nov 2026, Richard leyó «Lleva 763 h 25 min» y «Sin señal hace 45805
 * min» en la ficha del #B4290C). Todos los países. UNA sola pieza para escribir cuánto tiempo, en
 * palabras completas y en la unidad que corresponde, para el panel y las apps:
 * - menos de un minuto: segundos («7 segundos»);
 * - menos de una hora: minutos («20 minutos»);
 * - desde la primera hora hasta 24 horas: horas y minutos («1 hora y 20 minutos»);
 * - desde 24 horas: días y horas («1 día y 3 horas», «29 días»);
 * - desde los 30 días: meses y días («1 mes y 1 día»);
 * - desde los 365 días: años y meses.
 * Siempre las dos unidades más grandes (la segunda solo si no es cero). Nunca «763 h».
 */

type Unidad = 'segundo' | 'minuto' | 'hora' | 'dia' | 'mes' | 'ano';

const NOMBRES = {
  es: {
    segundo: ['segundo', 'segundos'],
    minuto: ['minuto', 'minutos'],
    hora: ['hora', 'horas'],
    dia: ['día', 'días'],
    mes: ['mes', 'meses'],
    ano: ['año', 'años'],
  },
  en: {
    segundo: ['second', 'seconds'],
    minuto: ['minute', 'minutes'],
    hora: ['hour', 'hours'],
    dia: ['day', 'days'],
    mes: ['month', 'months'],
    ano: ['year', 'years'],
  },
} satisfies Record<'es' | 'en', Record<Unidad, [string, string]>>;

const MIN = 60;
const HORA = 3600;
const DIA = 86_400;
const MES = 30 * DIA;
const ANO = 365 * DIA;

function parte(n: number, u: Unidad, idioma: 'es' | 'en'): string {
  const nombres = new Map<Unidad, [string, string]>(
    Object.entries(idioma === 'en' ? NOMBRES.en : NOMBRES.es) as [Unidad, [string, string]][],
  );
  const [uno, varios] = nombres.get(u) ?? ['', ''];
  return `${n} ${n === 1 ? uno : varios}`;
}

function juntar(a: string, b: string | null, idioma: 'es' | 'en'): string {
  return b ? `${a} ${idioma === 'en' ? 'and' : 'y'} ${b}` : a;
}

/** «1 hora y 20 minutos», «31 días», «1 mes y 1 día» / «1 hour and 20 minutes». */
export function duracionEnPalabras(segundos: number, idioma: 'es' | 'en'): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < MIN) return parte(s, 'segundo', idioma);
  if (s < HORA) return parte(Math.floor(s / MIN), 'minuto', idioma);
  const dos = (grande: number, u1: Unidad, chica: number, u2: Unidad) => {
    const a = Math.floor(s / grande);
    const b = Math.floor((s - a * grande) / chica);
    return juntar(parte(a, u1, idioma), b ? parte(b, u2, idioma) : null, idioma);
  };
  if (s < DIA) return dos(HORA, 'hora', MIN, 'minuto');
  if (s < MES) return dos(DIA, 'dia', HORA, 'hora');
  if (s < ANO) return dos(MES, 'mes', DIA, 'dia');
  return dos(ANO, 'ano', MES, 'mes');
}

/**
 * C-DURACION-EN-PALABRAS: cuántos minutos después de lo previsto un tramo abierto pasa a
 * «Atascado» (y el pedido sube en «Pedidos en curso»). Se cambia aquí, en un solo lugar.
 */
export const MARGEN_ATASCADO_MIN = 5;
