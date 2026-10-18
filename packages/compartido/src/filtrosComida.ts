/**
 * Filtros rápidos de la pantalla de Comida (como los de DoorDash y Uber Eats, 18 oct 2026):
 * búsqueda por nombre o tipo de comida, categoría, «solo abiertos» y el orden «más cerca» o
 * «más rápido». Lógica pura: la misma en la app y en la web.
 */
export type FiltrosComida = {
  busqueda?: string;
  categoria?: string | null;
  soloAbiertos?: boolean;
  orden?: 'cerca' | 'rapido' | null;
};
type Filtrable = {
  nombre: string;
  categoria: string;
  abierto: boolean;
  abiertoAhora?: boolean;
  distanciaKm?: number;
  tiempoPrepMin: number;
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
      (!f.soloAbiertos || abierto(r)),
  );
  if (f.orden === 'cerca')
    return sal.sort((a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity));
  if (f.orden === 'rapido') return sal.sort((a, b) => a.tiempoPrepMin - b.tiempoPrepMin);
  return sal;
}
