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

// ───────────── C-ZONA-MUNICIPIO: el municipio que el equipo elige para cada zona ─────────────

/**
 * C-ZONA-MUNICIPIO (24 nov 2026): el pueblo cabecera de los municipios donde ya trabajamos, para que
 * el equipo lo reconozca en la lista («El Vigía» es Alberto Adriani; «Tucaní», Caracciolo Parra
 * Olmedo). Se suma una línea por cada pueblo nuevo; el resto de la lista sale del territorio oficial.
 */
const CABECERAS = new Map<string, string>([
  ['VE1401', 'El Vigía'],
  ['VE1407', 'Tucaní'],
  ['VE1412', 'Mérida'],
]);

export type SugerenciaMunicipio = {
  pcode: string;
  nombre: string;
  entidad: string;
  cabecera?: string;
  /** Lo que se ve y se escribe en la casilla: «Alberto Adriani (El Vigía), Mérida». */
  etiqueta: string;
};

/** Minúsculas, sin acentos y sin espacios de más: para comparar lo escrito. */
export function normalizarMunicipio(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** La clave del filtro (cabe en los filtros guardados: sin espacios ni acentos). */
export function claveMunicipio(nombre: string): string {
  return normalizarMunicipio(nombre)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Los municipios oficiales del país, para la lista sugerida. Los de la región de la zona (su estado o
 * provincia, «MER» → Mérida) y los que tienen cabecera conocida van primero. Sin territorio: vacía.
 */
export function sugerenciasMunicipio(
  pais: string | null | undefined,
  region?: string | null,
): SugerenciaMunicipio[] {
  const t = territorio(pais);
  if (!t) return [];
  const entidades = new Map(t.entidades.map((e) => [e.c, e.n]));
  const reg = normalizarMunicipio(region ?? '');
  const lista = t.municipios.map((m) => {
    const entidad = entidades.get(m.p ?? '') ?? '';
    const cabecera = CABECERAS.get(m.c);
    return {
      pcode: m.c,
      nombre: m.n,
      entidad,
      ...(cabecera ? { cabecera } : {}),
      etiqueta: `${m.n}${cabecera ? ` (${cabecera})` : ''}${entidad ? `, ${entidad}` : ''}`,
    };
  });
  const peso = (s: SugerenciaMunicipio) =>
    (reg && normalizarMunicipio(s.entidad).startsWith(reg) ? 0 : 2) + (s.cabecera ? 0 : 1);
  return lista.sort((a, b) => peso(a) - peso(b) || a.etiqueta.localeCompare(b.etiqueta, 'es'));
}

/**
 * Lee lo que el equipo escribió en la casilla. Si es un municipio oficial (por su etiqueta, su nombre
 * con o sin estado, o el pueblo cabecera) devuelve su nombre oficial y su P-code; si no, lo escrito
 * tal cual (sin espacios de más) y sin código: un municipio a mano también vale.
 */
export function resolverMunicipio(
  pais: string | null | undefined,
  texto: string,
): { nombre: string; pcode: string | null } {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  if (!limpio) return { nombre: '', pcode: null };
  const buscado = normalizarMunicipio(limpio);
  const lista = sugerenciasMunicipio(pais);
  const iguales = (s: SugerenciaMunicipio) =>
    [
      s.etiqueta,
      `${s.nombre}, ${s.entidad}`,
      `${s.nombre} (${s.entidad})`,
      ...(s.cabecera ? [`${s.cabecera}, ${s.entidad}`] : []),
    ].some((x) => normalizarMunicipio(x) === buscado);
  const porNombre = (campo: 'nombre' | 'cabecera') =>
    lista.filter(
      (s) => normalizarMunicipio((campo === 'nombre' ? s.nombre : s.cabecera) ?? '') === buscado,
    );
  const exacto = lista.find(iguales);
  const unico = [porNombre('nombre'), porNombre('cabecera')].find((l) => l.length === 1)?.[0];
  const hallado = exacto ?? unico;
  return hallado
    ? { nombre: hallado.nombre, pcode: hallado.pcode }
    : { nombre: limpio, pcode: null };
}
