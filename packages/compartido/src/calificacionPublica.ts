import type { Idioma } from './idiomas';

/**
 * C-CALIFICACION-PUBLICA (30 oct 2026): la calificación del restaurante que ve el cliente, como la
 * muestran DoorDash y Uber Eats: el promedio de 1 a 5 y cuántas opiniones, solo de pedidos
 * verificados y solo desde 10 opiniones (con menos, el restaurante sale como «Nuevo»).
 */
export const MIN_OPINIONES_PUBLICAS = 10;

export type CalificacionPublica = { promedio: number; total: number };

/** Lo que sale de la base (promedio y cuenta) convertido en lo que se muestra, o null si son pocas. */
export function calificacionPublica(
  promedio: number | null | undefined,
  total: number | null | undefined,
): CalificacionPublica | null {
  const n = Number(total ?? 0);
  if (promedio == null || !Number.isFinite(Number(promedio)) || n < MIN_OPINIONES_PUBLICAS)
    return null;
  return { promedio: Math.round(Number(promedio) * 10) / 10, total: n };
}

/** «4.7 (120)», «4.7 (1,000+)» o «Nuevo». Con punto decimal en los dos idiomas, como en las apps de EE. UU. */
export function textoCalificacion(c: CalificacionPublica | null | undefined, idioma: Idioma) {
  if (!c) return idioma === 'en' ? 'New' : 'Nuevo';
  const votos =
    c.total >= 1000
      ? `${(Math.floor(c.total / 1000) * 1000).toLocaleString('en-US')}+`
      : String(c.total);
  return `${c.promedio.toFixed(1)} (${votos})`;
}
