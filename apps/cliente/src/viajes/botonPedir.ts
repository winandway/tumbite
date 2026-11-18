/**
 * C-SERVICIO-SIN-TARIFA (18 nov 2026, todos los países): qué hace el botón de pedir de Moto, Carro y
 * Envíos. Si el servidor dijo que el servicio no está o no tiene precio en esa ciudad (error de la
 * casilla «servicio»), el botón queda apagado con el mensaje a la vista hasta que cambie la ruta.
 */
export type EstadoBotonPedir = 'elegir_destino' | 'cotizar' | 'pedir' | 'apagado';

export function estadoBotonPedir(e: {
  sinDestino: boolean;
  conCotizacion: boolean;
  sinServicio: boolean;
}): EstadoBotonPedir {
  if (e.sinDestino) return 'elegir_destino';
  if (e.sinServicio) return 'apagado';
  return e.conCotizacion ? 'pedir' : 'cotizar';
}
