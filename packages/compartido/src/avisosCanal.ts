/**
 * El canal «pedidos» de Android: los avisos del servidor llegan por él (channelId 'pedidos').
 * Cada app declara `extra.sonidoAvisos` y su sonido suena aunque la app esté cerrada: la alarma
 * del restaurante, la del conductor (oferta.wav) y la campanita del cliente (aviso.wav)
 * (C-AVISOS-CANAL, C-AVISO-PAQUETE). Android fija el sonido al crear el canal: en un teléfono que
 * ya tenía la app, el sonido nuevo sale al reinstalarla.
 */
export const CANAL_AVISOS = 'pedidos';

/**
 * C-OFERTA-SUENA-EN-BUCLE (18 nov 2026; todos los países): las ofertas al conductor van por un canal
 * PROPIO de Android, con importancia máxima y el tono largo (29 s). Android no deja cambiar el sonido
 * de un canal ya creado, por eso es un id nuevo. Solo lo crea la app que trae ese tono
 * (`extra.sonidoOfertas`, Driver) y se lo dice al servidor con la capacidad `ofertas-bucle`.
 */
export const CANAL_OFERTAS = 'ofertas';
export const SONIDO_OFERTAS = 'oferta_larga.wav';
export const CAPACIDAD_OFERTAS_BUCLE = 'ofertas-bucle';

export function canalOfertas(
  extra: Record<string, unknown> | null | undefined,
  importanciaMax: number,
) {
  if (typeof extra?.sonidoOfertas !== 'string') return null;
  return {
    name: 'Ofertas',
    importance: importanciaMax,
    sound: extra.sonidoOfertas,
    vibrationPattern: [0, 500, 250, 500, 250, 500],
    enableVibrate: true,
  };
}

export function canalPedidos(
  extra: Record<string, unknown> | null | undefined,
  importanciaMax: number,
) {
  const sonido = typeof extra?.sonidoAvisos === 'string' ? extra.sonidoAvisos : 'default';
  return { name: 'Pedidos', importance: importanciaMax, sound: sonido };
}
