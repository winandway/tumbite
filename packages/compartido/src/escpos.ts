import { type AnchoComanda, COLUMNAS_COMANDA, type Comanda } from './comanda';

/**
 * C-IMPRESORA-NAVEGADOR (8 nov 2026): la comanda en ESC/POS, el idioma de las impresoras térmicas
 * de cocina (Epson TM, Star en modo ESC/POS y las genéricas de 58 y 80 mm). Sale de la MISMA
 * estructura que la comanda HTML (`estructuraComanda`), así los dos papeles traen los mismos datos.
 * El panel la manda por WebUSB o Web Serial sin abrir el cuadro de impresión.
 */

const ESC = 0x1b;
const GS = 0x1d;

/** Página de códigos 850 (latín): tiene todas las letras del español y del inglés. */
const CP850 = new Map<string, number>([
  ['Ç', 0x80],
  ['ü', 0x81],
  ['é', 0x82],
  ['â', 0x83],
  ['ä', 0x84],
  ['à', 0x85],
  ['ç', 0x87],
  ['ê', 0x88],
  ['ë', 0x89],
  ['è', 0x8a],
  ['ï', 0x8b],
  ['î', 0x8c],
  ['ì', 0x8d],
  ['Ä', 0x8e],
  ['É', 0x90],
  ['ô', 0x93],
  ['ö', 0x94],
  ['ò', 0x95],
  ['û', 0x96],
  ['ù', 0x97],
  ['Ö', 0x99],
  ['Ü', 0x9a],
  ['×', 0x9e],
  ['á', 0xa0],
  ['í', 0xa1],
  ['ó', 0xa2],
  ['ú', 0xa3],
  ['ñ', 0xa4],
  ['Ñ', 0xa5],
  ['ª', 0xa6],
  ['º', 0xa7],
  ['¿', 0xa8],
  ['¡', 0xad],
  ['Á', 0xb5],
  ['Â', 0xb6],
  ['À', 0xb7],
  ['ã', 0xc6],
  ['Ã', 0xc7],
  ['Ê', 0xd2],
  ['Ë', 0xd3],
  ['È', 0xd4],
  ['Í', 0xd6],
  ['Î', 0xd7],
  ['Ï', 0xd8],
  ['Ó', 0xe0],
  ['Ô', 0xe2],
  ['Ò', 0xe3],
  ['õ', 0xe4],
  ['Õ', 0xe5],
  ['Ú', 0xe9],
  ['Û', 0xea],
  ['Ù', 0xeb],
  ['·', 0xfa],
]);

/** Texto a bytes de la página 850; lo que no existe se cambia por su letra sin tilde o «?». */
export function textoCp850(texto: string): Uint8Array {
  const salida: number[] = [];
  for (const ch of texto.replace(/[‘’]/g, "'").replace(/[“”]/g, '"')) {
    const cod = ch.charCodeAt(0);
    if (ch.length === 1 && cod >= 0x20 && cod < 0x7f) salida.push(cod);
    else if (ch === '\n') salida.push(0x0a);
    else if (CP850.has(ch)) salida.push(CP850.get(ch)!);
    else {
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      const b = base.charCodeAt(0);
      salida.push(base.length === 1 && b >= 0x20 && b < 0x7f ? b : 0x3f);
    }
  }
  return Uint8Array.from(salida);
}

/** Parte un texto en renglones de `cols` caracteres, por palabras (las larguísimas se cortan). */
function partir(texto: string, cols: number, sangria = ''): string[] {
  const util = Math.max(4, cols - sangria.length);
  const renglones: string[] = [];
  let actual = '';
  for (let palabra of texto.split(/\s+/).filter(Boolean)) {
    while (palabra.length > util) {
      if (actual) renglones.push(actual);
      actual = '';
      renglones.push(palabra.slice(0, util));
      palabra = palabra.slice(util);
    }
    if (!actual) actual = palabra;
    else if (actual.length + 1 + palabra.length <= util) actual += ` ${palabra}`;
    else {
      renglones.push(actual);
      actual = palabra;
    }
  }
  if (actual) renglones.push(actual);
  return renglones.map((r) => sangria + r);
}

/** Un renglón del ticket: el texto y cómo se imprime. */
export type RenglonTicket = {
  texto: string;
  centro?: boolean;
  negrita?: boolean;
  /** Letra al doble de ancho y de alto: cabe la mitad de caracteres. */
  doble?: boolean;
  /** Letra al doble de alto (mismo ancho). */
  alto?: boolean;
  /** Blanco sobre negro (las alergias). */
  invertido?: boolean;
};

/** Los renglones del ticket, ya partidos al ancho del papel. */
export function lineasTextoComanda(c: Comanda, ancho: AnchoComanda): RenglonTicket[] {
  const cols = ancho === 58 ? COLUMNAS_COMANDA[58] : COLUMNAS_COMANDA[80];
  const mitad = Math.floor(cols / 2);
  const raya = '-'.repeat(cols);
  const r: RenglonTicket[] = [];
  const agregar = (texto: string, estilo: Omit<RenglonTicket, 'texto'> = {}, c2 = cols, s = '') =>
    partir(texto, c2, s).forEach((t) => r.push({ texto: t, ...estilo }));
  if (c.restaurante) agregar(c.restaurante, { centro: true, negrita: true, alto: true });
  agregar(c.titulo, { centro: true, negrita: true, doble: true }, mitad);
  agregar(c.modo, { centro: true, negrita: true });
  if (c.programado) agregar(c.programado, { centro: true, negrita: true });
  r.push({ texto: raya });
  if (c.cliente) agregar(c.cliente, { negrita: true, doble: true }, mitad);
  agregar(`${c.horaPedido.etiqueta}: ${c.horaPedido.hora}`);
  if (c.horaListo) agregar(`${c.horaListo.etiqueta}: ${c.horaListo.hora}`, { negrita: true });
  r.push({ texto: raya });
  for (const l of c.lineas) {
    agregar(`${l.cantidad}x ${l.nombre}`, { negrita: true, alto: true });
    for (const d of l.detalles) agregar(d.texto, d.fuerte ? { negrita: true } : {}, cols, '    ');
    r.push({ texto: '' });
  }
  r.push({ texto: raya });
  if (c.alergias)
    agregar(`*** ${c.idioma === 'en' ? 'ALLERGY' : 'ALERGIA'}: ${c.alergias} ***`, {
      negrita: true,
      invertido: true,
    });
  agregar(c.articulos, { negrita: true });
  agregar(c.pie, { centro: true });
  return r;
}

/** La comanda completa en bytes ESC/POS: inicio, página 850, renglones, avance y corte. */
export function escposComanda(c: Comanda, ancho: AnchoComanda): Uint8Array {
  const bytes: number[] = [ESC, 0x40, ESC, 0x74, 0x02];
  for (const l of lineasTextoComanda(c, ancho)) {
    bytes.push(ESC, 0x61, l.centro ? 1 : 0);
    bytes.push(ESC, 0x45, l.negrita ? 1 : 0);
    bytes.push(GS, 0x21, l.doble ? 0x11 : l.alto ? 0x01 : 0x00);
    bytes.push(GS, 0x42, l.invertido ? 1 : 0);
    bytes.push(...textoCp850(l.texto), 0x0a);
  }
  // Vuelve a la letra normal, avanza el papel hasta la cuchilla y corta (corte parcial).
  bytes.push(ESC, 0x61, 0, ESC, 0x45, 0, GS, 0x21, 0, GS, 0x42, 0);
  bytes.push(ESC, 0x64, 4, GS, 0x56, 0x42, 0x00);
  return Uint8Array.from(bytes);
}

/** Un ticket corto para «Imprimir prueba»: confirma que la impresora y el ancho están bien. */
export function escposPrueba(ancho: AnchoComanda, idioma: 'es' | 'en'): Uint8Array {
  const cols = ancho === 58 ? COLUMNAS_COMANDA[58] : COLUMNAS_COMANDA[80];
  const en = idioma === 'en';
  const lineas = [
    'Divoox',
    en ? 'Printer connected' : 'Impresora conectada',
    `${ancho} mm · ${cols} ${en ? 'characters' : 'caracteres'}`,
    '-'.repeat(cols),
    en ? 'Kitchen tickets will print here.' : 'Aquí saldrán las comandas de cocina.',
  ];
  const bytes: number[] = [ESC, 0x40, ESC, 0x74, 0x02, ESC, 0x61, 1];
  for (const l of lineas) bytes.push(...textoCp850(l), 0x0a);
  bytes.push(ESC, 0x61, 0, ESC, 0x64, 4, GS, 0x56, 0x42, 0x00);
  return Uint8Array.from(bytes);
}
