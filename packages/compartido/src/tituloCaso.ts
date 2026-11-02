/**
 * C-CASO-EN-SU-IDIOMA: los títulos fijos de los casos se muestran en el idioma de la app aunque el
 * caso se haya creado en el otro (lo que escribió la persona no se toca).
 */
const TITULOS: [string, string][] = [
  ['Pedido de ayuda', 'Help request'],
  ['Reporte de un problema', 'Problem report'],
];
export function tituloCaso(asunto: string, idioma: 'es' | 'en'): string {
  for (const [es, en] of TITULOS) {
    const desde = idioma === 'en' ? es : en;
    if (asunto.startsWith(desde)) return (idioma === 'en' ? en : es) + asunto.slice(desde.length);
  }
  return asunto;
}
