import MiniSearch, { type Query, type SearchOptions } from 'minisearch';
import type { Guia, SeccionDocs } from './guias';
import { GRUPO_DE, SINONIMOS } from './sinonimos';

/**
 * El buscador de Docs (C-DOCS-BUSCADOR, 14 nov; motor nuevo C-DOCS-BUSCADOR-MOTOR, 15 nov 2026).
 *
 * Corre entero en el navegador con MiniSearch (código libre, licencia MIT): un índice invertido
 * con puntaje BM25+, búsqueda por el comienzo de la palabra y tolerancia a errores de escritura.
 * Nada va a un servicio externo ni a la base. Ficha: docs/investigaciones-rea/2026-11-15-docs-buscador-y-lupa.md
 */

/** Sin acentos ni mayúsculas, para que «pago movil» encuentre «pago móvil». */
export const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Palabras de relleno que no ayudan a encontrar una guía («cómo», «de», «the»…). */
const RELLENO = new Set([
  'a',
  'al',
  'como',
  'con',
  'de',
  'del',
  'el',
  'en',
  'la',
  'las',
  'lo',
  'los',
  'mi',
  'mis',
  'por',
  'que',
  'se',
  'su',
  'tu',
  'un',
  'una',
  'y',
  'the',
  'an',
  'and',
  'how',
  'do',
  'i',
  'is',
  'my',
  'to',
  'of',
  'in',
  'on',
  'for',
  'your',
]);

const separar = (texto: string) =>
  normalizar(texto)
    .split(/[^a-z0-9ñ]+/)
    .filter(Boolean);

/** Las palabras de lo que se escribió en el buscador, sin las de relleno. */
export function palabrasDeBusqueda(texto: string): string[] {
  const todas = separar(texto);
  const utiles = todas.filter((p) => !RELLENO.has(p));
  return utiles.length ? utiles : todas;
}

/** Cada «idea» de la búsqueda: lo que se escribió y, si está en el diccionario, sus equivalentes. */
type Idea = { escrito: string; equivalentes: readonly string[] };

const FRASE_MAS_LARGA = Math.max(...SINONIMOS.flat().map((p) => p.split(' ').length));

/** Cuántas letras hay que cambiar para pasar de una palabra a la otra (Levenshtein). */
function distancia(a: string, b: string): number {
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    for (let j = 1; j <= b.length; j++) {
      fila.push(
        Math.min(
          (previa.at(j) ?? 0) + 1,
          (fila.at(j - 1) ?? 0) + 1,
          (previa.at(j - 1) ?? 0) + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1),
        ),
      );
    }
    previa = fila;
  }
  return previa.at(-1) ?? 0;
}

/** El grupo de la palabra del diccionario más parecida (un error; dos en las de 8 letras o más). */
function parecidaDelDiccionario(p: string): readonly string[] | undefined {
  if (p.length < 5) return undefined;
  const tope = p.length >= 8 ? 2 : 1;
  let mejor: { d: number; grupo: readonly string[] } | undefined;
  for (const [palabra, grupo] of GRUPO_DE) {
    if (palabra.includes(' ') || Math.abs(palabra.length - p.length) > tope) continue;
    const d = distancia(p, palabra);
    if (d <= tope && (!mejor || d < mejor.d)) mejor = { d, grupo };
  }
  return mejor?.grupo;
}

/** Parte lo escrito en ideas, juntando las frases del diccionario («top up», «pago movil»). */
export function ideasDeBusqueda(texto: string): Idea[] {
  const todas = separar(texto);
  const ideas: Idea[] = [];
  for (let i = 0; i < todas.length;) {
    let tomada = false;
    for (let n = Math.min(FRASE_MAS_LARGA, todas.length - i); n >= 1; n--) {
      const frase = todas.slice(i, i + n).join(' ');
      const grupo = GRUPO_DE.get(frase);
      if (grupo && (n > 1 || !RELLENO.has(frase))) {
        ideas.push({ escrito: frase, equivalentes: grupo });
        i += n;
        tomada = true;
        break;
      }
    }
    if (!tomada) {
      const p = todas.at(i) ?? '';
      // Mal escrita («biletera»): sus equivalentes salen de la palabra más parecida del diccionario.
      ideas.push({ escrito: p, equivalentes: parecidaDelDiccionario(p) ?? [] });
      i++;
    }
  }
  const utiles = ideas.filter((x) => x.equivalentes.length || !RELLENO.has(x.escrito));
  const final = utiles.length ? utiles : ideas;
  // La última palabra a medio escribir («walle», «trac») también trae a sus equivalentes.
  const ultima = final.at(-1);
  if (ultima && !ultima.equivalentes.length && ultima.escrito.length >= 4) {
    const grupos = new Set(
      [...GRUPO_DE.entries()]
        .filter(([p]) => !p.includes(' ') && p.startsWith(ultima.escrito))
        .map(([, g]) => g),
    );
    if (grupos.size) ultima.equivalentes = [...grupos].flat();
  }
  return final;
}

/** Guías que nombran palabras de búsqueda como ejemplo (C-DOCS-LUPA): pesan menos. */
const GUIAS_QUE_CITAN_EJEMPLOS = new Set(['search-docs-and-zoom']);

type Doc = {
  id: string;
  titulo: string;
  resumen: string;
  preguntas: string;
  pasos: string;
  texto: string;
};

export type Resultado = {
  seccion: SeccionDocs;
  guia: Guia;
  /** Las palabras de la guía que coincidieron (normalizadas), para resaltarlas. */
  terminos: string[];
};

const CAMPOS = ['titulo', 'resumen', 'preguntas', 'pasos', 'texto'] as const;
/** El título pesa más; después el resumen y las preguntas de la gente. */
const PESOS = { titulo: 5, resumen: 2, preguntas: 2, pasos: 1, texto: 1 };

type Indice = { motor: MiniSearch<Doc>; porId: Map<string, Omit<Resultado, 'terminos'>> };
const indices = new WeakMap<readonly SeccionDocs[], Indice>();

/** El índice de un idioma se arma una sola vez, la primera vez que alguien busca. */
function indice(secciones: readonly SeccionDocs[]): Indice {
  const hecho = indices.get(secciones);
  if (hecho) return hecho;
  const motor = new MiniSearch<Doc>({
    fields: [...CAMPOS],
    processTerm: (t) => {
      const n = normalizar(t);
      return RELLENO.has(n) ? null : n;
    },
    // Lo escrito ya llega partido en palabras normalizadas.
    searchOptions: { processTerm: (t) => normalizar(t) },
  });
  const porId = new Map<string, Omit<Resultado, 'terminos'>>();
  for (const s of secciones) {
    for (const g of s.guias) {
      const id = `${s.id}/${g.id}`;
      if (porId.has(id)) continue;
      porId.set(id, { seccion: s, guia: g });
      motor.add({
        id,
        titulo: g.titulo,
        resumen: g.resumen,
        preguntas: (g.preguntas ?? []).join(' '),
        pasos: g.pasos.join(' '),
        texto: [
          ...(g.explicacion ?? []),
          g.nota ?? '',
          ...(g.capturas ?? []).map((c) => c.pie),
        ].join(' '),
      });
    }
  }
  const listo = { motor, porId };
  indices.set(secciones, listo);
  return listo;
}

/** La palabra escrita busca por su comienzo y tolera un error (dos en las largas). */
const comoEscrita: SearchOptions = {
  prefix: true,
  fuzzy: (t) => (t.length >= 4 ? 0.2 : false),
  boost: PESOS,
};
/** Los equivalentes del diccionario van completos (sin comienzo: «tip» no debe traer «tipo»). */
const comoEquivalente: SearchOptions = {
  prefix: false,
  fuzzy: (t) => (t.length >= 6 ? 0.15 : false),
  // Lo escrito tal cual pesa más que su equivalente del otro idioma.
  boost: Object.fromEntries(Object.entries(PESOS).map(([k, v]) => [k, v * 0.6])),
};

function consultaDeIdea(idea: Idea): Query {
  const variantes: Query[] = [{ ...comoEscrita, queries: [idea.escrito], combineWith: 'AND' }];
  for (const e of idea.equivalentes) {
    if (e === idea.escrito) continue;
    variantes.push({ ...comoEquivalente, queries: [e], combineWith: 'AND' });
  }
  return { combineWith: 'OR', queries: variantes };
}

/**
 * Busca en todas las guías de un idioma y las ordena por relevancia. Cada idea tiene que aparecer
 * (por sí misma o por un equivalente); si así no sale nada, basta con que aparezca alguna.
 */
export function buscarGuias(secciones: readonly SeccionDocs[], texto: string): Resultado[] {
  const ideas = ideasDeBusqueda(texto);
  if (!ideas.length) return [];
  const { motor, porId } = indice(secciones);
  const consulta = (combineWith: 'AND' | 'OR'): Query => ({
    combineWith,
    queries: ideas.map(consultaDeIdea),
  });
  // La guía de cómo buscar cita palabras de ejemplo («wallet», «biletera»): no debe salir primero
  // cuando alguien busca la billetera.
  const opciones = {
    boostDocument: (id: unknown) =>
      GUIAS_QUE_CITAN_EJEMPLOS.has(String(id).split('/')[1] ?? '') ? 0.2 : 1,
  };
  let encontrados = motor.search(consulta('AND'), opciones);
  if (!encontrados.length && ideas.length > 1) encontrados = motor.search(consulta('OR'), opciones);
  return encontrados.flatMap((r) => {
    const base = porId.get(String(r.id));
    return base ? [{ ...base, terminos: r.terms }] : [];
  });
}

/** Un texto partido en trozos, con los que coincidieron marcados para resaltarlos. */
export function resaltar(texto: string, terminos: readonly string[]) {
  if (!terminos.length) return [{ texto, marca: false }];
  const buscados = new Set(terminos);
  return texto
    .split(/([^\p{L}\p{N}]+)/u)
    .filter(Boolean)
    .map((trozo) => ({ texto: trozo, marca: buscados.has(normalizar(trozo)) }));
}
