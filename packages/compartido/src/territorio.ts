/**
 * Territorio (C-TERRITORIO, 17 oct 2026): país → estado → ciudad → áreas de cobertura → franquicias.
 * La ciudad es la «zona» de siempre (US-FL-MIAMI). Dentro de una ciudad, las áreas se dibujan como
 * polígonos. Aquí vive la geometría pura (sin base de datos), la misma en el servidor y el panel.
 *
 * Un polígono es una lista de vértices [lng, lat] (el orden de GeoJSON), sin repetir el primero.
 */
export type Vertice = [lng: number, lat: number];
export type Poligono = Vertice[];

export const ESTADOS_AREA = ['borrador', 'proximamente', 'activa', 'pausada', 'cerrada'] as const;
export type EstadoArea = (typeof ESTADOS_AREA)[number];
/** Estados «publicados»: no pueden pisarse entre sí dentro de una ciudad. */
export const ESTADOS_PUBLICADOS: readonly EstadoArea[] = ['proximamente', 'activa', 'pausada'];

export const MAX_VERTICES = 300;

export type Caja = { minLat: number; maxLat: number; minLng: number; maxLng: number };

export function caja(p: Poligono): Caja {
  const lats = p.map((v) => v[1]);
  const lngs = p.map((v) => v[0]);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

function cajasSeTocan(a: Caja, b: Caja) {
  return (
    a.minLat <= b.maxLat && b.minLat <= a.maxLat && a.minLng <= b.maxLng && b.minLng <= a.maxLng
  );
}

/** Orientación del giro p→q→r: >0 izquierda, <0 derecha, 0 en línea. */
function giro(p: Vertice, q: Vertice, r: Vertice) {
  return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
}

/**
 * ¿Se cruzan de verdad los segmentos ab y cd? Tocarse en un punto o compartir un tramo en línea NO
 * cuenta: así dos áreas vecinas pueden compartir su borde sin «pisarse».
 */
export function segmentosSeCruzan(a: Vertice, b: Vertice, c: Vertice, d: Vertice) {
  const d1 = giro(c, d, a);
  const d2 = giro(c, d, b);
  const d3 = giro(a, b, c);
  const d4 = giro(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function lados(p: Poligono): [Vertice, Vertice][] {
  return p.map((v, i) => [v, p[(i + 1) % p.length] as Vertice]);
}

/** Área con signo (en grados², solo para saber si el polígono tiene superficie). */
function areaConSigno(p: Poligono) {
  let s = 0;
  for (const [a, b] of lados(p)) s += a[0] * b[1] - b[0] * a[1];
  return s / 2;
}

/** ¿El punto está estrictamente dentro? (Rayo hacia la derecha; el borde exacto no cuenta.) */
export function puntoEnPoligono(lat: number, lng: number, p: Poligono): boolean {
  let dentro = false;
  for (const [a, b] of lados(p)) {
    // Sobre el borde: no está «dentro» (lo resuelve la regla de prioridad entre áreas vecinas).
    if (
      giro(a, b, [lng, lat]) === 0 &&
      lng >= Math.min(a[0], b[0]) &&
      lng <= Math.max(a[0], b[0]) &&
      lat >= Math.min(a[1], b[1]) &&
      lat <= Math.max(a[1], b[1])
    )
      return false;
    if (a[1] > lat !== b[1] > lat) {
      const x = ((b[0] - a[0]) * (lat - a[1])) / (b[1] - a[1]) + a[0];
      if (lng < x) dentro = !dentro;
    }
  }
  return dentro;
}

/** ¿Contiene el punto, contando también el borde? (Para el pedido en la línea entre dos áreas.) */
export function puntoEnPoligonoOBorde(lat: number, lng: number, p: Poligono): boolean {
  if (puntoEnPoligono(lat, lng, p)) return true;
  return lados(p).some(
    ([a, b]) =>
      giro(a, b, [lng, lat]) === 0 &&
      lng >= Math.min(a[0], b[0]) &&
      lng <= Math.max(a[0], b[0]) &&
      lat >= Math.min(a[1], b[1]) &&
      lat <= Math.max(a[1], b[1]),
  );
}

/** El error en palabras, o null si el polígono sirve. */
export function validarPoligono(p: unknown): string | null {
  if (!Array.isArray(p) || p.length < 3) return 'El área necesita al menos 3 puntos.';
  if (p.length > MAX_VERTICES) return `El área admite hasta ${MAX_VERTICES} puntos.`;
  for (const v of p) {
    if (!Array.isArray(v) || v.length !== 2) return 'Cada punto lleva longitud y latitud.';
    const [lng, lat] = v as [unknown, unknown];
    if (
      typeof lng !== 'number' ||
      typeof lat !== 'number' ||
      !Number.isFinite(lng) ||
      !Number.isFinite(lat)
    )
      return 'Cada punto lleva longitud y latitud.';
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return 'Hay un punto fuera del mapa.';
  }
  const pol = p as Poligono;
  if (Math.abs(areaConSigno(pol)) < 1e-10) return 'El área no tiene superficie.';
  const ls = lados(pol);
  for (const [i, [a, b]] of ls.entries())
    for (const [j, [c, d]] of ls.entries()) {
      // Solo lados que no se tocan por un vértice (ni vecinos, ni el primero con el último).
      if (j < i + 2 || (i === 0 && j === ls.length - 1)) continue;
      if (segmentosSeCruzan(a, b, c, d)) return 'El borde del área se cruza consigo mismo.';
    }
  return null;
}

/**
 * ¿Se pisan dos áreas? Sí, si sus bordes se cruzan o si una tiene un punto estrictamente dentro de
 * la otra (también si una contiene a la otra entera). Compartir un borde no cuenta.
 */
export function poligonosSeSolapan(a: Poligono, b: Poligono): boolean {
  if (!cajasSeTocan(caja(a), caja(b))) return false;
  for (const [p, q] of lados(a))
    for (const [r, s] of lados(b)) if (segmentosSeCruzan(p, q, r, s)) return true;
  if (a.some(([lng, lat]) => puntoEnPoligono(lat, lng, b))) return true;
  if (b.some(([lng, lat]) => puntoEnPoligono(lat, lng, a))) return true;
  // Mismo polígono o uno dentro del otro tocando solo bordes: se mira el centro de cada uno.
  const centro = (p: Poligono): [number, number] => {
    const c = caja(p);
    return [(c.minLat + c.maxLat) / 2, (c.minLng + c.maxLng) / 2];
  };
  const [la, ga] = centro(a);
  const [lb, gb] = centro(b);
  return (
    (puntoEnPoligono(la, ga, a) && puntoEnPoligono(la, ga, b)) ||
    (puntoEnPoligono(lb, gb, b) && puntoEnPoligono(lb, gb, a))
  );
}

export type AreaParaResolver = {
  id: string;
  estado: EstadoArea;
  prioridad: number;
  creadoEn: string;
  poligono: Poligono;
};

/**
 * Regla de conflicto: si un punto cae en más de un área activa (solo puede pasar en su borde
 * compartido), gana la de MAYOR prioridad; empate, la MÁS ANTIGUA; empate, el id menor.
 */
export function resolverArea<T extends AreaParaResolver>(
  lat: number,
  lng: number,
  areas: T[],
  estados: readonly EstadoArea[] = ['activa'],
): T | null {
  const candidatas = areas.filter(
    (a) => estados.includes(a.estado) && puntoEnPoligonoOBorde(lat, lng, a.poligono),
  );
  candidatas.sort(
    (x, y) =>
      y.prioridad - x.prioridad || x.creadoEn.localeCompare(y.creadoEn) || x.id.localeCompare(y.id),
  );
  return candidatas[0] ?? null;
}
