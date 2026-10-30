/**
 * Servicios del inicio del cliente («como los grandes», 18 oct 2026). El servidor manda el catálogo
 * con el estado de cada servicio en la ciudad (GET /datos/servicios); la app lo pinta en ESTE
 * orden, dictado por Richard: lo que ya se vende primero, después lo que viene. Un servicio que el
 * servidor agregue y la app no conozca va al final, por su «orden» de la base.
 */
export const ORDEN_SERVICIOS = [
  'comida',
  'moto',
  'carro',
  'envios',
  'mercado',
  'farmacia',
  'licores',
  'mas',
] as const;
export type IdServicio = (typeof ORDEN_SERVICIOS)[number];

export type EstadoServicio = 'disponible' | 'proximamente' | 'suspendido' | 'no_disponible_zona';
export type AccionServicio =
  'abrir' | 'muy_pronto' | 'en_pausa' | 'no_disponible_zona' | 'actualizar_app';

/** Lo que devuelve GET /datos/servicios por cada servicio. */
export type ServicioCatalogo = {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  orden: number;
  estado: EstadoServicio;
  accion: AccionServicio;
};
export type RespuestaServicios = {
  zona: { id: string; nombre: string } | null;
  servicios: ServicioCatalogo[];
};

export function ordenarServicios<T extends { id: string; orden: number }>(lista: T[]): T[] {
  const puesto = new Map<string, number>(ORDEN_SERVICIOS.map((id, i) => [id, i]));
  return [...lista].sort(
    (a, b) =>
      (puesto.get(a.id) ?? ORDEN_SERVICIOS.length) - (puesto.get(b.id) ?? ORDEN_SERVICIOS.length) ||
      a.orden - b.orden ||
      a.id.localeCompare(b.id),
  );
}

/**
 * C-EXPLORAR (30 oct 2026), como la pestaña «Services» de Uber y «Browse» de DoorDash: «Más» muestra
 * todos los servicios en grupos (viajes, pedidos, envíos), en el orden de siempre. Lo que el código no
 * conoce va al final, en «otros».
 */
export const GRUPOS_EXPLORAR = [
  { id: 'viajes', servicios: ['moto', 'carro'] },
  { id: 'pedidos', servicios: ['comida', 'mercado', 'farmacia', 'licores'] },
  { id: 'envios', servicios: ['envios'] },
] as const;

export function agruparServicios<T extends { id: string; orden: number }>(
  lista: T[],
): { id: string; servicios: T[] }[] {
  const usados = new Set<string>(['mas']);
  const grupos = GRUPOS_EXPLORAR.map((g) => {
    const ids = g.servicios as readonly string[];
    const servicios = ordenarServicios(lista.filter((s) => ids.includes(s.id)));
    servicios.forEach((s) => usados.add(s.id));
    return { id: g.id as string, servicios };
  });
  const otros = ordenarServicios(lista.filter((s) => !usados.has(s.id)));
  return [...grupos, { id: 'otros', servicios: otros }].filter((g) => g.servicios.length);
}
