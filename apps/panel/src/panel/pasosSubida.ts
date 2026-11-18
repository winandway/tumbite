/**
 * C-SUBIR-TARIFA: «0.25, 0.50, 1.00» → [25, 50, 100] (unidad menor, enteros). null si no sirve.
 */
export function pasosDeTexto(texto: string): number[] | null {
  const pasos = texto
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => Math.round(Number(x.replace(/[^0-9.]/g, '')) * 100));
  if (!pasos.length || pasos.length > 3 || pasos.some((x) => !Number.isSafeInteger(x) || x <= 0))
    return null;
  return pasos;
}
