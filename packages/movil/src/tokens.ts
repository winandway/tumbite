/**
 * C-APPS-DISENO (15 nov 2026): la capa de diseño ÚNICA de las tres apps del celular (cliente, Driver
 * y Restaurants). Colores, letras, espacios, radios y sombras salen SOLO de aquí. Medidas tomadas del
 * estándar de los grandes (Base de Uber, Material 3, guías de Apple); ficha en
 * docs/investigaciones-rea/2026-11-15-diseno-apps-moviles.md. Dirección visual: «A · Clara» (fondo
 * blanco, letra negra, rojo solo en lo que se toca), la más cercana a Uber Eats y DoorDash.
 *
 * Archivo sin React ni React Native para poder probarlo en node.
 */
import { MARCA } from '@tumbite/compartido';

const M = MARCA.colores;

export const COLOR = {
  marca: M.primario,
  /** Rojo oscuro: texto rojo chico sobre blanco (contraste 4,5:1) y botón rojo apretado. */
  marcaOscuro: M.acento,
  marcaSuave: '#FDECEE',
  negro: M.secundario,
  texto: M.texto,
  /** Texto secundario: el gris de apoyo de la marca. */
  textoSuave: M.gris,
  textoTenue: '#8A8F98',
  blanco: '#FFFFFF',
  fondo: '#FFFFFF',
  /** Lienzo gris muy claro para separar bloques, chips y buscador. */
  superficie: '#F6F6F6',
  superficieFuerte: '#EEEFF1',
  borde: '#E6E7EA',
  bordeFuerte: '#D6D8DC',
  /** Regla de Richard: tarjetas sobre fondo oscuro con borde fino gris oscuro. */
  bordeOscuro: '#2A2A2A',
  exito: M.exito,
  exitoSuave: '#E6F4EC',
  aviso: '#8A5300',
  avisoSuave: '#FFF4E0',
  error: '#B3261E',
  errorSuave: '#FDECEA',
  logistica: M.logistica,
  logisticaAccion: M.logisticaAccion,
  logisticaTexto: M.logisticaTexto,
  logisticaSuave: M.logisticaSuave,
  /** Verde «en línea» del Driver y del local abierto. */
  enLinea: '#3DDC84',
} as const;

/** Base 4: todo espacio es múltiplo de 4. Margen de pantalla: 16. */
export const ESPACIO = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  enorme: 48,
} as const;

export const RADIO = { s: 8, m: 12, l: 16, hoja: 20, pildora: 999 } as const;

/** Alto mínimo de todo lo que se toca (Apple pide 44, Android 48). */
export const TACTIL = 48;

export const ALTO = {
  boton: 52,
  botonGrande: 56,
  botonOferta: 64,
  campo: 52,
  buscador: 48,
  pildora: 36,
  barraInferior: 64,
  encabezado: 56,
  icono: 24,
} as const;

/** Familias cargadas con expo-font (nombres de @expo-google-fonts). */
export const FUENTE = {
  titulo: 'Poppins_700Bold',
  tituloMedio: 'Poppins_600SemiBold',
  tituloSuave: 'Poppins_500Medium',
  texto: 'Montserrat_400Regular',
  textoMedio: 'Montserrat_500Medium',
  textoFuerte: 'Montserrat_600SemiBold',
  textoNegrita: 'Montserrat_700Bold',
} as const;

export type FamiliaFuente = (typeof FUENTE)[keyof typeof FUENTE];

/**
 * Escoge la familia por peso y tamaño: titulares (18 o más, en negrita) en Poppins; el resto en
 * Montserrat. En Android una fuente propia no se «engorda» con fontWeight: cada peso es su archivo.
 */
export function familiaPara(
  peso: string | number | undefined,
  tamano: number | undefined,
): FamiliaFuente {
  const p = Number(peso === 'bold' ? 700 : peso === 'normal' || peso === undefined ? 400 : peso);
  const t = tamano ?? 15;
  if (t >= 18 && p >= 600) return p >= 700 ? FUENTE.titulo : FUENTE.tituloMedio;
  if (p >= 700) return FUENTE.textoNegrita;
  if (p >= 600) return FUENTE.textoFuerte;
  if (p >= 500) return FUENTE.textoMedio;
  return FUENTE.texto;
}

/** Escala de letra: [tamaño, interlineado]. */
export const LETRA = {
  titular: { fontFamily: FUENTE.titulo, fontSize: 28, lineHeight: 34, color: COLOR.texto },
  titulo: { fontFamily: FUENTE.titulo, fontSize: 22, lineHeight: 28, color: COLOR.texto },
  subtitulo: { fontFamily: FUENTE.tituloMedio, fontSize: 18, lineHeight: 24, color: COLOR.texto },
  cuerpo: { fontFamily: FUENTE.texto, fontSize: 16, lineHeight: 24, color: COLOR.texto },
  cuerpoFuerte: {
    fontFamily: FUENTE.textoFuerte,
    fontSize: 16,
    lineHeight: 22,
    color: COLOR.texto,
  },
  secundario: { fontFamily: FUENTE.texto, fontSize: 14, lineHeight: 20, color: COLOR.textoSuave },
  pequeno: { fontFamily: FUENTE.textoMedio, fontSize: 12, lineHeight: 16, color: COLOR.textoSuave },
  boton: { fontFamily: FUENTE.tituloMedio, fontSize: 16, lineHeight: 20 },
  cifra: { fontFamily: FUENTE.titulo, fontSize: 28, lineHeight: 34, color: COLOR.texto },
  cifraGrande: { fontFamily: FUENTE.titulo, fontSize: 36, lineHeight: 44, color: COLOR.texto },
} as const;

export const SOMBRA = {
  tarjeta: {
    shadowColor: '#101010',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  flotante: {
    shadowColor: '#101010',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
} as const;

/** Colores de cada app: el cliente es rojo; el Driver, azul de logística; Restaurants, negro. */
export type AppDelDiseno = 'cliente' | 'repartidor' | 'restaurante';

export function acentoDeApp(app: AppDelDiseno): { fondo: string; texto: string } {
  if (app === 'repartidor') return { fondo: COLOR.logistica, texto: COLOR.blanco };
  if (app === 'restaurante') return { fondo: COLOR.negro, texto: COLOR.blanco };
  return { fondo: COLOR.marca, texto: COLOR.blanco };
}

/** Píldoras de estado: cada tono con su fondo suave y su texto con contraste suficiente. */
export const TONO = {
  neutro: { fondo: COLOR.superficie, texto: COLOR.texto },
  exito: { fondo: COLOR.exitoSuave, texto: COLOR.exito },
  aviso: { fondo: COLOR.avisoSuave, texto: COLOR.aviso },
  error: { fondo: COLOR.errorSuave, texto: COLOR.error },
  marca: { fondo: COLOR.marcaSuave, texto: COLOR.marcaOscuro },
  logistica: { fondo: COLOR.logisticaSuave, texto: COLOR.logistica },
  oscuro: { fondo: COLOR.negro, texto: COLOR.blanco },
} as const;

export type Tono = keyof typeof TONO;

/** Contraste WCAG entre dos colores #RRGGBB (para las pruebas y para elegir texto sobre un fondo). */
export function contraste(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = hex.replace('#', '');
    const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
    const [r, g, bl] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [
      number,
      number,
      number,
    ];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
