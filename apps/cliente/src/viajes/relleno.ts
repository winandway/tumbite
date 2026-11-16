/**
 * C-MISMA-RUTA (15 nov 2026): «Cambiar algo» deja escrito el formulario de Pedir viaje (en su
 * borrador) y marca aquí que lo escrito vino de un viaje anterior. Pedir viaje lo mira al abrirse
 * (dentro de unos segundos): así no dice «Recuperamos lo que estabas escribiendo» ni pisa la recogida
 * con la ubicación de ahora. Vive en memoria (no se guarda en ningún lado). No se borra al leerlo:
 * React puede montar la pantalla dos veces seguidas en desarrollo.
 */
const VIGENCIA_MS = 15_000;
const marcas = new Map<string, number>();

export function marcarRelleno(servicio: string, ahora = Date.now()): void {
  marcas.set(servicio, ahora);
}

export function tomarRelleno(servicio: string, ahora = Date.now()): boolean {
  const cuando = marcas.get(servicio);
  if (cuando == null) return false;
  if (ahora - cuando > VIGENCIA_MS) {
    marcas.delete(servicio);
    return false;
  }
  return true;
}
