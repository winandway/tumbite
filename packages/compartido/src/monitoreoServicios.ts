/**
 * C-MONITOREO-SERVICIOS (15 nov 2026, pedido de Richard). Todos los países. De qué servicio es cada
 * cosa que se vigila en el superadmin, calculado AL LEER (sin escribir nada ni migrar datos):
 * - Comida: un pedido cuyo comercio es un restaurante (`restaurantes.tipo_comercio = 'restaurante'`).
 * - Tiendas: un pedido de cualquier otro tipo de comercio (mercado, farmacia, licores…).
 * - Viajes en auto y en moto, y envíos de paquete: `operaciones.servicio_id`.
 * Las pestañas de «Pedidos en curso» y el filtro de la bandeja de tickets usan esta misma pieza.
 */
export const SERVICIOS_MONITOREO = [
  'todos',
  'comida',
  'tiendas',
  'auto',
  'moto',
  'envios',
] as const;
export type ServicioMonitoreo = (typeof SERVICIOS_MONITOREO)[number];
/** Un servicio concreto (sin «todos»). */
export type ServicioConcreto = Exclude<ServicioMonitoreo, 'todos'>;
/** Los servicios que viven en `pedidos` y los que viven en `operaciones`. */
export const SERVICIOS_DE_PEDIDO = ['comida', 'tiendas'] as const;
export const SERVICIOS_DE_VIAJE = ['auto', 'moto', 'envios'] as const;

export function esServicioMonitoreo(v: unknown): v is ServicioMonitoreo {
  return typeof v === 'string' && (SERVICIOS_MONITOREO as readonly string[]).includes(v);
}

export function servicioDePedido(tipoComercio: string | null | undefined): 'comida' | 'tiendas' {
  return !tipoComercio || tipoComercio === 'restaurante' ? 'comida' : 'tiendas';
}

/** `operaciones.servicio_id` → servicio del monitoreo (`carro` se muestra como «auto»). */
export function servicioDeOperacion(
  servicioId: string | null | undefined,
): 'auto' | 'moto' | 'envios' | null {
  if (servicioId === 'carro') return 'auto';
  if (servicioId === 'moto') return 'moto';
  if (servicioId === 'envios') return 'envios';
  return null;
}

/** El `servicio_id` de `operaciones` para un servicio del monitoreo (al revés de lo anterior). */
export function servicioIdDeOperacion(s: ServicioConcreto): string | null {
  if (s === 'auto') return 'carro';
  if (s === 'moto') return 'moto';
  if (s === 'envios') return 'envios';
  return null;
}

export const TEXTOS_SERVICIO_MONITOREO = {
  es: {
    todos: 'Todos',
    comida: 'Comida',
    tiendas: 'Tiendas',
    auto: 'Viajes en auto',
    moto: 'Viajes en moto',
    envios: 'Envíos',
    general: 'General',
  },
  en: {
    todos: 'All',
    comida: 'Food',
    tiendas: 'Stores',
    auto: 'Car rides',
    moto: 'Moto rides',
    envios: 'Deliveries',
    general: 'General',
  },
} as const;

export function nombreServicioMonitoreo(
  s: ServicioMonitoreo | 'general',
  idioma: 'es' | 'en',
): string {
  const t = idioma === 'en' ? TEXTOS_SERVICIO_MONITOREO.en : TEXTOS_SERVICIO_MONITOREO.es;
  return new Map<string, string>(Object.entries(t)).get(s) ?? s;
}
