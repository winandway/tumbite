/**
 * Filtros rápidos de la pantalla de Comida (como los de DoorDash y Uber Eats, 18 oct 2026):
 * búsqueda por nombre o tipo de comida, categoría, «solo abiertos» y el orden «más cerca» o
 * «más rápido». Lógica pura: la misma en la app y en la web.
 */
export type FiltrosComida = {
  busqueda?: string;
  categoria?: string | null;
  soloAbiertos?: boolean;
  orden?: 'cerca' | 'rapido' | 'calificados' | null;
  /** C-ORDENAR-COMIDA: «Menos de 30 min», con el tiempo más largo que promete la tarjeta. */
  menos30?: boolean;
  /** C-ORDENAR-COMIDA: «4,5 o más» (solo restaurantes con calificación pública). */
  calificacionMin?: number | null;
};

/** La tarjeta promete «prep + 10 a prep + 20 min»: el filtro usa el extremo largo, para no mentir. */
export const MINUTOS_ENTREGA_EXTRA = 20;
type Filtrable = {
  nombre: string;
  categoria: string;
  abierto: boolean;
  abiertoAhora?: boolean;
  distanciaKm?: number;
  tiempoPrepMin: number;
  calificacion?: { promedio: number; total: number } | null;
};

/** Minúsculas y sin acentos: «Rápido» encuentra «rapido» y al revés. */
export const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function filtrarRestaurantes<T extends Filtrable>(lista: T[], f: FiltrosComida): T[] {
  const q = normalizar(f.busqueda?.trim() ?? '');
  const abierto = (r: Filtrable) => r.abiertoAhora ?? r.abierto;
  const sal = lista.filter(
    (r) =>
      (!q || normalizar(`${r.nombre} ${r.categoria}`).includes(q)) &&
      (!f.categoria || r.categoria === f.categoria) &&
      (!f.soloAbiertos || abierto(r)) &&
      (!f.menos30 || r.tiempoPrepMin + MINUTOS_ENTREGA_EXTRA <= 30) &&
      (!f.calificacionMin || (r.calificacion?.promedio ?? 0) >= f.calificacionMin),
  );
  if (f.orden === 'cerca')
    return sal.sort((a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity));
  if (f.orden === 'rapido') return sal.sort((a, b) => a.tiempoPrepMin - b.tiempoPrepMin);
  // Mejor calificados primero; los nuevos (sin calificación pública) al final, como Uber Eats.
  if (f.orden === 'calificados')
    return sal.sort(
      (a, b) =>
        (b.calificacion?.promedio ?? -1) - (a.calificacion?.promedio ?? -1) ||
        (b.calificacion?.total ?? 0) - (a.calificacion?.total ?? 0),
    );
  return sal;
}
