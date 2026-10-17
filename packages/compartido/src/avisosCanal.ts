/**
 * El canal «pedidos» de Android: los avisos del servidor llegan por él (channelId 'pedidos').
 * La app del restaurante declara `extra.sonidoAvisos` y su alarma suena aunque la app esté
 * cerrada; las demás usan el sonido normal del teléfono (C-AVISOS-CANAL).
 */
export const CANAL_AVISOS = 'pedidos';

export function canalPedidos(
  extra: Record<string, unknown> | null | undefined,
  importanciaMax: number,
) {
  const sonido = typeof extra?.sonidoAvisos === 'string' ? extra.sonidoAvisos : 'default';
  return { name: 'Pedidos', importance: importanciaMax, sound: sonido };
}
