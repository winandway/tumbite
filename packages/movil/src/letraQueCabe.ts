/**
 * C-DESLIZAR-TEXTO-ENTERO: la letra más grande (hasta `base`) con la que `texto` cabe en una línea de
 * `ancho` puntos. En la web `adjustsFontSizeToFit` no existe, así que se calcula: una letra de
 * Poppins mide en promedio 0,56 de su tamaño. Sin medida todavía (ancho 0) devuelve la base.
 */
const ANCHO_MEDIO_LETRA = 0.56;

export function letraQueCabe(texto: string, ancho: number, base: number, minimo = 12): number {
  const letras = texto.length;
  if (!(ancho > 0) || letras === 0) return base;
  const cabe = Math.floor((ancho / (letras * ANCHO_MEDIO_LETRA)) * 2) / 2;
  return Math.max(minimo, Math.min(base, cabe));
}
