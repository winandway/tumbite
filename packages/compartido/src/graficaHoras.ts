// Gráfica «Pedidos por hora» de la app del restaurante (31 oct 2026): con un solo pedido salía un
// bloque de lado a lado; se muestran al menos 12 horas y la hora al estilo de cada idioma.

/** Ventana de al menos 12 horas que contiene [primera, ultima], dentro de 0–23. */
export function ventanaHoras(primera: number, ultima: number): [number, number] {
  const falta = Math.max(0, 11 - (ultima - primera));
  let desde = primera - Math.ceil(falta / 2);
  let hasta = ultima + Math.floor(falta / 2);
  if (desde < 0) [desde, hasta] = [0, hasta - desde];
  if (hasta > 23) [desde, hasta] = [Math.max(0, desde - (hasta - 23)), 23];
  return [desde, hasta];
}

/** «8a», «12p», «5p» en inglés; «8», «12», «17» en español (como el reloj de cada país). */
export function horaCorta(h: number, idioma: string): string {
  if (idioma !== 'en') return String(h);
  return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`;
}
