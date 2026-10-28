/**
 * El canal «pedidos» de Android: los avisos del servidor llegan por él (channelId 'pedidos').
 * Cada app declara `extra.sonidoAvisos` y su sonido suena aunque la app esté cerrada: la alarma
 * del restaurante, la del conductor (oferta.wav) y la campanita del cliente (aviso.wav)
 * (C-AVISOS-CANAL, C-AVISO-PAQUETE). Android fija el sonido al crear el canal: en un teléfono que
 * ya tenía la app, el sonido nuevo sale al reinstalarla.
 */
export const CANAL_AVISOS = 'pedidos';

export function canalPedidos(
  extra: Record<string, unknown> | null | undefined,
  importanciaMax: number,
) {
  const sonido = typeof extra?.sonidoAvisos === 'string' ? extra.sonidoAvisos : 'default';
  return { name: 'Pedidos', importance: importanciaMax, sound: sonido };
}
