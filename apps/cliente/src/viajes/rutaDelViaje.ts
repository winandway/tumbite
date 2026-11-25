/**
 * C-AVISOS-VIAJE (24 nov 2026) — todos los países. A dónde lleva un aviso de viaje al tocarlo (desde
 * la bandeja del teléfono o desde la campana): a la pantalla de ESE viaje. Los avisos de viaje traen
 * `tipo: 'viaje'` y `viajeId`; los nuevos traen además `servicio` (moto, carro o envios). Un aviso que
 * no es de viaje, o con un id que no tiene forma de id, no lleva a ningún lado (devuelve null).
 */
export const ID_VIAJE = /^[\w-]{8,64}$/;

export function rutaDelViaje(d: Record<string, unknown>) {
  if (d.tipo !== 'viaje' || typeof d.viajeId !== 'string' || !ID_VIAJE.test(d.viajeId)) return null;
  const servicio = d.servicio === 'carro' || d.servicio === 'envios' ? d.servicio : 'moto';
  // C-CHAT-VIAJE-LLEGA: un aviso de mensaje abre el viaje con el chat abierto.
  return {
    pathname: '/ride' as const,
    params: { servicio, viaje: d.viajeId, ...(d.mensaje === '1' ? { chat: '1' } : {}) },
  };
}
