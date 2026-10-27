/* eslint-disable security/detect-object-injection -- índices de tablas fijas (patrones, alfabeto, mapas de columnas), nunca entrada del usuario como clave de objeto */
/**
 * Divoox Flex (Fase 1): lo que comparten el servidor, el panel y las apps sobre empresas,
 * paquetes y etiquetas. Sin dinero: la monetización llega en una fase posterior.
 */

/** Roles de una persona dentro de una empresa. */
export const ROLES_EMPRESA = ['dueno', 'operaciones', 'operador', 'finanzas', 'api'] as const;
export type RolEmpresa = (typeof ROLES_EMPRESA)[number];

/** Permisos finos. Cada rol tiene un conjunto; una clave de API lleva los suyos (acotados). */
export const PERMISOS_FLEX = [
  'empresa.ver',
  'empresa.editar',
  'miembros.gestionar',
  'claves.gestionar',
  'centros.gestionar',
  'conductores.gestionar',
  'envios.crear',
  'envios.ver',
  'paquetes.eventos',
  'importar',
  'lotes.gestionar',
  'finanzas.ver',
] as const;
export type PermisoFlex = (typeof PERMISOS_FLEX)[number];

const TODOS: readonly PermisoFlex[] = PERMISOS_FLEX;
export const PERMISOS_POR_ROL: Record<RolEmpresa, readonly PermisoFlex[]> = {
  dueno: TODOS,
  operaciones: [
    'empresa.ver',
    'miembros.gestionar',
    'claves.gestionar',
    'centros.gestionar',
    'conductores.gestionar',
    'envios.crear',
    'envios.ver',
    'paquetes.eventos',
    'importar',
    'lotes.gestionar',
  ],
  operador: ['empresa.ver', 'envios.crear', 'envios.ver', 'paquetes.eventos', 'importar'],
  finanzas: ['empresa.ver', 'envios.ver', 'finanzas.ver'],
  // Cuenta técnica de la integración: lo mismo que puede hacer una clave de API.
  api: ['empresa.ver', 'envios.crear', 'envios.ver', 'paquetes.eventos', 'importar'],
};

/**
 * Lo que una clave de API puede pedir como máximo: nunca miembros, claves ni dinero
 * (una clave filtrada no debe poder tomar la empresa).
 */
export const PERMISOS_CLAVE_API: readonly PermisoFlex[] = [
  'empresa.ver',
  'centros.gestionar',
  'envios.crear',
  'envios.ver',
  'paquetes.eventos',
  'importar',
  'lotes.gestionar',
];

export const tienePermiso = (permisos: readonly PermisoFlex[], p: PermisoFlex) =>
  permisos.includes(p);

/** Estados del paquete (custodia). El orden es el del camino normal. */
export const ESTADOS_PAQUETE = [
  'creado',
  'registrado_centro',
  'preparado',
  'asignado',
  'cargado',
  'en_transito',
  'entregado',
  'entrega_fallida',
  'en_devolucion',
  'devuelto',
  'cancelado',
] as const;
export type EstadoPaquete = (typeof ESTADOS_PAQUETE)[number];

/** Mismas transiciones que `transiciones_paquete` en schema.sql (la base también las exige). */
export const TRANSICIONES_PAQUETE: Record<EstadoPaquete, readonly EstadoPaquete[]> = {
  creado: ['registrado_centro', 'preparado', 'cancelado'],
  registrado_centro: ['preparado', 'cancelado'],
  preparado: ['asignado', 'cancelado'],
  asignado: ['cargado', 'preparado', 'cancelado'],
  cargado: ['en_transito', 'preparado'],
  en_transito: ['entregado', 'entrega_fallida'],
  entrega_fallida: ['en_transito', 'en_devolucion'],
  en_devolucion: ['devuelto', 'en_transito'],
  entregado: [],
  devuelto: [],
  cancelado: [],
};

export const ESTADOS_FINALES_PAQUETE: readonly EstadoPaquete[] = [
  'entregado',
  'devuelto',
  'cancelado',
];

export const puedeTransitar = (desde: EstadoPaquete, hacia: EstadoPaquete) =>
  TRANSICIONES_PAQUETE[desde].includes(hacia);

export const esEstadoPaquete = (x: string): x is EstadoPaquete =>
  (ESTADOS_PAQUETE as readonly string[]).includes(x);

/**
 * Códigos opacos. Alfabeto sin letras que se confundan (0/O, 1/I/L) para leerlos en voz alta
 * y para que un escáner de barras los lea sin ambigüedad.
 */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function codigoOpaco(longitud: number, aleatorio: (n: number) => Uint8Array): string {
  const bytes = aleatorio(longitud);
  let s = '';
  for (let i = 0; i < longitud; i++) s += ALFABETO[(bytes[i] ?? 0) % ALFABETO.length];
  return s;
}

/** Código de seguimiento público: DVX + 10 letras. */
export const nuevoCodigoSeguimiento = (aleatorio: (n: number) => Uint8Array) =>
  `DVX${codigoOpaco(10, aleatorio)}`;

/** Código de etiqueta (QR y barras): 12 letras, sin prefijo, sin datos privados. */
export const nuevoCodigoEtiqueta = (aleatorio: (n: number) => Uint8Array) =>
  codigoOpaco(12, aleatorio);

/** Lo que va dentro del QR: un identificador opaco que el servidor resuelve con permisos. */
export const contenidoQrEtiqueta = (codigoEtiqueta: string) => `dvx:${codigoEtiqueta}`;
export function codigoDesdeQr(texto: string): string | null {
  const m = /^dvx:([A-Z2-9]{12})$/.exec(texto.trim());
  return m?.[1] ?? null;
}

// ─────────────────────────── Code 128 (subconjunto B) ───────────────────────────
// Patrones oficiales de Code 128 (107 símbolos): anchos de barras y espacios, 6 elementos cada uno
// (el STOP lleva 7). Se usa el subconjunto B (ASCII 32–127), suficiente para nuestros códigos.
const PATRONES_128 = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
  '2331112',
];
const INICIO_B = 104;
const STOP = 106;

/**
 * Codifica texto ASCII en Code 128 B y devuelve la lista de módulos (true = barra, false = espacio)
 * con sus anchos ya desplegados: lo que un SVG dibuja como rectángulos. Incluye la suma de control.
 */
export function code128B(texto: string): boolean[] {
  if (!/^[\x20-\x7e]+$/.test(texto)) throw new Error('Code 128 B solo admite texto ASCII visible.');
  const valores: number[] = [INICIO_B];
  for (const ch of texto) valores.push(ch.charCodeAt(0) - 32);
  let suma = INICIO_B;
  for (let i = 1; i < valores.length; i++) suma += (valores[i] ?? 0) * i;
  valores.push(suma % 103, STOP);
  const modulos: boolean[] = [];
  for (const v of valores) {
    const patron = PATRONES_128[v] ?? '';
    for (let i = 0; i < patron.length; i++) {
      const ancho = Number(patron[i]);
      for (let k = 0; k < ancho; k++) modulos.push(i % 2 === 0);
    }
  }
  return modulos;
}

/** Rectángulos del código de barras para un SVG: x y ancho en módulos (las barras solamente). */
export function barrasCode128(texto: string): { x: number; ancho: number }[] {
  const modulos = code128B(texto);
  const barras: { x: number; ancho: number }[] = [];
  let i = 0;
  while (i < modulos.length) {
    if (modulos[i]) {
      let fin = i;
      while (fin < modulos.length && modulos[fin]) fin++;
      barras.push({ x: i, ancho: fin - i });
      i = fin;
    } else i++;
  }
  return barras;
}

/** Columnas aceptadas en la importación por CSV (en español e inglés, sin distinguir mayúsculas). */
export const COLUMNAS_CSV: Record<string, readonly string[]> = {
  referencia: ['referencia', 'referencia_externa', 'reference', 'order', 'orden'],
  destinatario: ['destinatario', 'nombre', 'recipient', 'name', 'customer'],
  telefono: ['telefono', 'teléfono', 'phone', 'tel'],
  direccion: ['direccion', 'dirección', 'address'],
  lat: ['lat', 'latitud', 'latitude'],
  lng: ['lng', 'lon', 'longitud', 'longitude'],
  instrucciones: ['instrucciones', 'notas', 'notes', 'instructions'],
  paquetes: ['paquetes', 'bultos', 'packages', 'pieces'],
  peso_g: ['peso_g', 'peso', 'weight_g', 'weight'],
  descripcion: ['descripcion', 'descripción', 'description', 'contenido'],
  ventana_desde: ['ventana_desde', 'desde', 'from', 'window_from'],
  ventana_hasta: ['ventana_hasta', 'hasta', 'to', 'window_to'],
};

/** Lector de CSV pequeño: comas o punto y coma, comillas dobles, saltos de línea de todo tipo. */
export function leerCsv(texto: string): string[][] {
  const limpio = texto.replace(/^\uFEFF/, '');
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let enComillas = false;
  const separador = detectarSeparador(limpio);
  for (let i = 0; i < limpio.length; i++) {
    const ch = limpio[i] as string;
    if (enComillas) {
      if (ch === '"') {
        if (limpio[i + 1] === '"') {
          celda += '"';
          i++;
        } else enComillas = false;
      } else celda += ch;
    } else if (ch === '"') enComillas = true;
    else if (ch === separador) {
      fila.push(celda);
      celda = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(celda);
      celda = '';
      if (fila.some((c) => c.trim() !== '')) filas.push(fila);
      fila = [];
    } else celda += ch;
  }
  fila.push(celda);
  if (fila.some((c) => c.trim() !== '')) filas.push(fila);
  return filas.map((f) => f.map((c) => c.trim()));
}

function detectarSeparador(texto: string): ',' | ';' | '\t' {
  const primera = texto.split(/\r?\n/)[0] ?? '';
  const comas = (primera.match(/,/g) ?? []).length;
  const puntos = (primera.match(/;/g) ?? []).length;
  const tabs = (primera.match(/\t/g) ?? []).length;
  if (tabs > comas && tabs > puntos) return '\t';
  return puntos > comas ? ';' : ',';
}

/** Mapa de índice de columna → campo conocido, a partir de la fila de encabezados. */
export function mapearEncabezados(encabezados: string[]): Record<string, number> {
  const mapa: Record<string, number> = {};
  encabezados.forEach((h, i) => {
    const n = h.trim().toLowerCase();
    for (const [campo, alias] of Object.entries(COLUMNAS_CSV))
      if (alias.includes(n) && mapa[campo] === undefined) mapa[campo] = i;
  });
  return mapa;
}
