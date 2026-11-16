/**
 * C-MODERACION · filtro de palabras ofensivas (16 nov 2026, todos los países). Regla 1.2 de Apple:
 * una app con chat y reseñas debe filtrar el material ofensivo. Como Uber, DoorDash y Rappi: lo
 * hace el servidor (no se puede saltar desde la app), en español y en inglés, con código y sin IA.
 *
 * - Chat (pedido y viaje): la palabra se tapa con «•••» y el mensaje queda marcado para revisión.
 * - Reseña: no se publica hasta que el equipo la revise (las estrellas sí cuentan).
 * - Respuesta del restaurante: no se guarda; se le pide reescribirla.
 *
 * Solo insultos fuertes y discriminatorios: las palabras con doble sentido común («perra», «zorra»,
 * «gonorrea», «cono», «culo», «huevón», «mamón», «idiota», «stupid», «dick») NO están, para no tapar frases normales. Una
 * palabra cuenta solo entera (no dentro de otra), salvo las raíces seguras de `RAICES`.
 */

/** Números y símbolos que imitan letras (f4ck, $hit). */
const SUSTITUTOS = new Map([
  ['0', 'o'],
  ['1', 'i'],
  ['3', 'e'],
  ['4', 'a'],
  ['5', 's'],
  ['7', 't'],
  ['@', 'a'],
  ['$', 's'],
]);

/** Palabras completas, ya normalizadas (minúsculas, sin acentos, sin letras repetidas). */
const PALABRAS = new Set(
  [
    // Inglés
    'fuck',
    'fucks',
    'fucker',
    'fuckers',
    'fucking',
    'fucked',
    'fuk',
    'fck',
    'fcking',
    'stfu',
    'shit',
    'shits',
    'shitty',
    'bullshit',
    'bitch',
    'bitches',
    'biatch',
    'asshole',
    'assholes',
    'bastard',
    'bastards',
    'cunt',
    'cunts',
    'dickhead',
    'cocksucker',
    'pussy',
    'whore',
    'whores',
    'slut',
    'sluts',
    'nigger',
    'niggers',
    'nigga',
    'niggas',
    'faggot',
    'faggots',
    'fag',
    'fags',
    'retard',
    'retarded',
    'twat',
    'wanker',
    'prick',
    'douchebag',
    'jackass',
    'dumbass',
    'kys',
    'tranny',
    'spic',
    'chink',
    'kike',
    'wetback',
    // Español
    'puta',
    'putas',
    'puto',
    'putos',
    'putita',
    'mierda',
    'mierdas',
    'pendejo',
    'pendeja',
    'pendejos',
    'pendejas',
    'pendejada',
    'cabron',
    'cabrona',
    'cabrones',
    'coño',
    'maricon',
    'maricones',
    'marica',
    'maricas',
    'gilipollas',
    'culero',
    'culera',
    'verga',
    'chingada',
    'chingado',
    'chingar',
    'chinga',
    'chingate',
    'hijueputa',
    'hijueputas',
    'hijoputa',
    'malparido',
    'malparida',
    'malparidos',
    'mamaguevo',
    'mamahuevo',
    'mamaguebo',
    'mamaguevos',
    'conchetumare',
    'conchatumadre',
    'ctm',
    'sudaca',
    'mongolico',
    'mongolica',
    'subnormal',
    'jodete',
  ].map(normalizarPalabra),
);

/** Raíces que solo aparecen en insultos: cuentan también como comienzo de palabra (fuckface…). */
const RAICES = ['fuck', 'motherfuck', 'cocksuck', 'nigger', 'faggot', 'hijueput', 'hijoeput'].map(
  normalizarPalabra,
);

/** Frases de varias palabras que, juntas, son un insulto o una amenaza. */
const FRASES = [
  'kill yourself',
  'go die',
  'hijo de puta',
  'hija de puta',
  'hijos de puta',
  'me cago en',
  'vete a la mierda',
  'mátate',
  'matate',
  'te voy a matar',
  "i'll kill you",
  'i will kill you',
].map((f) => f.split(/\s+/).map(normalizarPalabra));

/**
 * Una palabra a su forma comparable: minúsculas, sin acentos (la ñ se queda: «coño» no es «cono»),
 * números y símbolos que imitan letras (f4ck, $hit) y sin letras repetidas (fuuuck → fuck).
 */
export function normalizarPalabra(palabra: string): string {
  const base = palabra
    .toLowerCase()
    .replace(/ñ/g, '\uE000')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\uE000/g, 'ñ');
  let s = '';
  for (const ch of base) s += SUSTITUTOS.get(ch) ?? ch;
  s = s.replace(/[^a-zñ']/g, '');
  return s.replace(/(.)\1+/g, '$1');
}

// Las palabras de la lista también pasan por la misma forma (sin letras repetidas).
const TROZO = /[\p{L}\p{N}@$']+/gu;

type Trozo = { inicio: number; fin: number; forma: string };

function trozos(texto: string): Trozo[] {
  const r: Trozo[] = [];
  for (const m of texto.matchAll(TROZO)) {
    const forma = normalizarPalabra(m[0]);
    if (forma) r.push({ inicio: m.index ?? 0, fin: (m.index ?? 0) + m[0].length, forma });
  }
  return r;
}

function esOfensiva(forma: string): boolean {
  return PALABRAS.has(forma) || RAICES.some((raiz) => forma.startsWith(raiz));
}

/** Qué trozos del texto son ofensivos (posiciones en el texto original). */
function marcados(texto: string): Trozo[] {
  const lista = trozos(texto);
  const malos = new Set<number>();
  lista.forEach((t, i) => {
    if (esOfensiva(t.forma)) malos.add(i);
  });
  for (const frase of FRASES) {
    for (let i = 0; i + frase.length <= lista.length; i++) {
      if (frase.every((p, j) => lista[i + j]?.forma === p))
        for (let j = 0; j < frase.length; j++) malos.add(i + j);
    }
  }
  return lista.filter((_, i) => malos.has(i));
}

/** ¿El texto tiene alguna palabra ofensiva? */
export function tieneOfensivas(texto: string): boolean {
  return marcados(texto).length > 0;
}

/** El texto con cada palabra ofensiva tapada («•••»), y si tapó algo. */
export function taparOfensivas(texto: string): { texto: string; tapado: boolean } {
  const malos = marcados(texto);
  if (!malos.length) return { texto, tapado: false };
  let r = '';
  let desde = 0;
  for (const t of malos) {
    r += `${texto.slice(desde, t.inicio)}•••`;
    desde = t.fin;
  }
  return { texto: r + texto.slice(desde), tapado: true };
}
