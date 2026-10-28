import { z } from 'zod';
import { distanciaKm } from './catalogo';

/**
 * Divoox Moto · Fase M1 (C-VIAJE-PRECIO-FIJO): tarifa de un servicio de pasajeros en una ciudad y
 * su cotización con PRECIO FIJO antes de pedir, como Uber Moto, DiDi Moto y los demás
 * (docs/PLAN-MOTO-PASAJEROS.md §2). Ninguna cifra vive en el código: todas salen de la tarifa que
 * guarda el superadmin. Puro: lo usan el servidor, las apps y las pruebas.
 *
 * Montos SIEMPRE en la unidad menor de la moneda de la ciudad, enteros. Porcentajes en puntos base.
 */

/** Servicios de pasajeros que se cotizan con tarifa (Carro viene después con lo mismo). */
export const SERVICIOS_VIAJE = ['moto', 'carro'] as const;
export type ServicioViaje = (typeof SERVICIOS_VIAJE)[number];

const monto = z.number().int().min(0).max(100_000_000);
const segundos = (max: number) => z.number().int().min(0).max(max);

export const esquemaTarifaViaje = z
  .object({
    base: monto,
    /** Por kilómetro recorrido. */
    porKm: monto,
    /** Por minuto de viaje. */
    porMinuto: monto,
    /** Lo menos que cuesta un viaje. */
    minimo: monto,
    /** Espera gratis desde que el conductor llega; después se cobra por minuto. */
    esperaGratisS: segundos(1800).default(300),
    porMinutoEspera: monto.default(0),
    /** Ventana en la que el pasajero cancela gratis desde que pidió. */
    cancelacionGratisS: segundos(1800).default(120),
    cargoCancelacion: monto.default(0),
    cargoNoSePresento: monto.default(0),
    /** Tope del precio dinámico (10 000 = sin recargo; 20 000 = hasta el doble). */
    topeDinamicoPb: z.number().int().min(10_000).max(30_000).default(10_000),
    /** El total se redondea a este paso (100 = de cien en cien pesos). */
    redondeo: z.number().int().min(1).max(100_000).default(1),
  })
  .refine((t) => t.minimo <= 100_000_000, { path: ['minimo'] });
export type TarifaViaje = z.infer<typeof esquemaTarifaViaje>;

/**
 * Sin mapa de rutas todavía (la llave de Google Maps está pendiente), la distancia por calle se
 * estima con la línea recta por un factor y el tiempo con una velocidad urbana media. [INF]: son
 * supuestos nuestros, no datos de los grandes; se reemplazan por la ruta real cuando haya mapa.
 */
export const FACTOR_CALLE = 1.3;
export const VELOCIDAD_URBANA_KMH: Record<ServicioViaje, number> = { moto: 24, carro: 20 };
/** Un viaje de Moto más largo que esto no se cotiza (los grandes limitan la moto a la ciudad). */
export const DISTANCIA_MAXIMA_KM: Record<ServicioViaje, number> = { moto: 40, carro: 80 };
/** Cuánto dura la cotización: después hay que volver a cotizar (precio fijo, no eterno). */
export const VIGENCIA_COTIZACION_S = 300;

type Punto = { lat: number; lng: number };

export function estimarRuta(
  servicio: ServicioViaje,
  origen: Punto,
  destino: Punto,
): { distanciaM: number; duracionS: number } {
  const km = distanciaKm(origen, destino) * FACTOR_CALLE;
  // eslint-disable-next-line security/detect-object-injection -- servicio validado por el tipo
  const kmh = VELOCIDAD_URBANA_KMH[servicio];
  return {
    distanciaM: Math.round(km * 1000),
    duracionS: Math.max(60, Math.round((km / kmh) * 3600)),
  };
}

export type DesgloseViaje = {
  base: number;
  distancia: number;
  tiempo: number;
  /** Lo que se suma para llegar al mínimo (0 si no hace falta). */
  ajusteMinimo: number;
  /** Recargo dinámico (0 sin recargo). */
  dinamico: number;
  total: number;
};

/** Redondeo de la mitad hacia arriba al paso de la tarifa. */
function alPaso(valor: number, paso: number): number {
  return Math.round(valor / paso) * paso;
}

/**
 * El precio fijo de un viaje: base + km + minutos, nunca menos que el mínimo, con el recargo
 * dinámico acotado por el tope de la tarifa, redondeado al paso de la ciudad.
 */
export function cotizarViaje(
  t: TarifaViaje,
  ruta: { distanciaM: number; duracionS: number },
  multiplicadorPb = 10_000,
): DesgloseViaje {
  if (!Number.isInteger(ruta.distanciaM) || ruta.distanciaM < 0)
    throw new Error('cotizarViaje: distancia inválida');
  if (!Number.isInteger(ruta.duracionS) || ruta.duracionS < 0)
    throw new Error('cotizarViaje: duración inválida');
  const mult = Math.min(Math.max(Math.round(multiplicadorPb), 10_000), t.topeDinamicoPb);
  const distancia = Math.round((t.porKm * ruta.distanciaM) / 1000);
  const tiempo = Math.round((t.porMinuto * ruta.duracionS) / 60);
  const subtotal = t.base + distancia + tiempo;
  const ajusteMinimo = Math.max(0, t.minimo - subtotal);
  const conMinimo = subtotal + ajusteMinimo;
  const dinamico = Math.round((conMinimo * (mult - 10_000)) / 10_000);
  const total = Math.max(alPaso(conMinimo + dinamico, t.redondeo), t.minimo);
  return { base: t.base, distancia, tiempo, ajusteMinimo, dinamico, total };
}

/** Lo que cuesta la espera: gratis hasta el límite y después por minuto empezado. */
export function cargoEspera(t: TarifaViaje, segundosEsperando: number): number {
  const extra = Math.max(0, Math.floor(segundosEsperando) - t.esperaGratisS);
  return extra === 0 ? 0 : Math.ceil(extra / 60) * t.porMinutoEspera;
}

const punto = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  direccion: z.string().trim().min(3).max(200),
});
export const esquemaCotizarViaje = z.object({
  servicio: z.enum(SERVICIOS_VIAJE),
  origen: punto,
  destino: punto,
});
export type PedidoCotizacion = z.infer<typeof esquemaCotizarViaje>;

/** Lo que devuelve POST /datos/viajes/cotizar. */
export type CotizacionViaje = {
  id: string;
  servicio: ServicioViaje;
  zona: { id: string; nombre: string };
  moneda: string;
  distanciaM: number;
  duracionS: number;
  desglose: DesgloseViaje;
  total: number;
  venceEn: string;
  /** La tarifa es de prueba (sitio de pruebas): no es un precio comercial aprobado. */
  dePrueba: boolean;
};
