import territorioVE from './datos/territorio-VE.json';

/**
 * C-TERRITORIO-OFICIAL (21 nov 2026): la división oficial de cada país, de su fuente oficial, como
 * datos estáticos versionados (nunca filas de la base). Venezuela: INE vía OCHA («cod-ab-ven»,
 * CC BY-IGO): 25 entidades, 336 municipios, 1135 parroquias con su P-code. Cada zona de Divoox apunta
 * a su municipio real por ese código.
 *
 * Solo para el servidor y el panel (pesa ~120 KB): las apps no lo importan. Los contornos van aparte,
 * como archivos del sitio (`/territorio/<ISO>/municipios.json`). Para sumar Colombia (DIVIPOLA del
 * DANE) o Perú: su archivo en `datos/` (scripts/pais/generar-datos-pais.mjs) y una línea aquí.
 */
export type Lugar = { c: string; n: string; p?: string; lat: number; lng: number };

export type Territorio = {
  pais: string;
  fuente: string;
  licencia: string;
  url: string;
  vigente: string | null;
  entidades: Lugar[];
  municipios: Lugar[];
  parroquias: Lugar[];
  /** C-PUEBLOS-OFICIALES: los centros poblados van aparte, en `/territorio/<ISO>/pueblos/<entidad>.json`. */
  pueblos?: { total: number; fuente: string; licencia: string; url: string };
};

const TERRITORIOS = new Map<string, Territorio>([['VE', territorioVE as Territorio]]);

export function territorio(pais: string | null | undefined): Territorio | null {
  const k = String(pais ?? '').toUpperCase();
  return TERRITORIOS.get(k) ?? null;
}

/** Los países que ya tienen su territorio oficial cargado. */
export const PAISES_CON_TERRITORIO: readonly string[] = [...TERRITORIOS.keys()];

export type Municipio = {
  pcode: string;
  nombre: string;
  entidad: { pcode: string; nombre: string };
};

/** El municipio por su P-code («VE1401» → Alberto Adriani, Mérida), o null si no existe. */
export function municipioPorCodigo(pcode: string | null | undefined): Municipio | null {
  const c = String(pcode ?? '').toUpperCase();
  const t = territorio(c.slice(0, 2));
  const m = t?.municipios.find((x) => x.c === c);
  if (!t || !m) return null;
  const e = t.entidades.find((x) => x.c === m.p);
  return { pcode: m.c, nombre: m.n, entidad: { pcode: e?.c ?? '', nombre: e?.n ?? '' } };
}

// ───────────── Punto dentro de un contorno (para ubicar una zona en su municipio) ─────────────

type Anillo = number[][];
type Geometria =
  { type: 'Polygon'; coordinates: Anillo[] } | { type: 'MultiPolygon'; coordinates: Anillo[][] };
export type Contornos = {
  features: { properties: { c: string; n: string; p?: string }; geometry: Geometria | null }[];
};

function dentroDeAnillo(lng: number, lat: number, anillo: Anillo): boolean {
  let dentro = false;
  let anterior = anillo.at(-1);
  for (const punto of anillo) {
    const [xi = 0, yi = 0] = punto;
    const [xj = 0, yj = 0] = anterior ?? punto;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
    anterior = punto;
  }
  return dentro;
}

function dentroDePoligono(lng: number, lat: number, poligono: Anillo[]): boolean {
  const [exterior, ...huecos] = poligono;
  if (!exterior || !dentroDeAnillo(lng, lat, exterior)) return false;
  return !huecos.some((h) => dentroDeAnillo(lng, lat, h));
}

/** El P-code del contorno que contiene el punto, o null si cae fuera de todos. */
export function lugarDePunto(contornos: Contornos, lat: number, lng: number): string | null {
  for (const f of contornos.features) {
    const g = f.geometry;
    if (!g) continue;
    const poligonos = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    if (poligonos.some((p) => dentroDePoligono(lng, lat, p))) return f.properties.c;
  }
  return null;
}
