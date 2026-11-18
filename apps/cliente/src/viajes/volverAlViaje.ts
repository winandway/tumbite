/**
 * C-VOLVER-AL-VIAJE (17 nov 2026, borrador aprobado): si la app se cierra con un viaje en curso, al
 * abrirla vuelve al viaje y no al inicio. Lógica pura (se prueba sin React Native).
 */
const EN_CURSO = new Set(['buscando', 'asignado', 'conductor_llego', 'en_curso']);

export type ViajeAbierto = { id: string; estado: string; servicio?: string } | null;

export function rutaAlAbrir(
  viajes: ViajeAbierto[],
): { pathname: '/ride'; params: { servicio: string } } | null {
  const v = viajes.find((x) => x && EN_CURSO.has(x.estado));
  if (!v) return null;
  const servicio = v.servicio === 'carro' || v.servicio === 'envios' ? v.servicio : 'moto';
  return { pathname: '/ride', params: { servicio } };
}
