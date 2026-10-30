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
    /**
     * Cargo fijo por viaje, aparte del precio del recorrido (Uber lo llama tarifa de operación; aquí
     * también cubre el seguro del pasajero). No cuenta para el mínimo ni lleva recargo dinámico.
     */
    cargoFijo: monto.default(0),
    /**
     * Carro grande (XL, 6 plazas o más), como «Extra room» de Uber: su precio es el del carro normal por
     * este factor (15 000 = × 1,5). Sin él, la ciudad no ofrece XL.
     */
    xlPb: z.number().int().min(10_000).max(30_000).optional(),
    /** Sin mapa de rutas: distancia por calle = línea recta × este factor (13 000 = × 1,3). [INF] */
    factorCallePb: z.number().int().min(10_000).max(20_000).default(13_000),
    /** Sin mapa de rutas: velocidad media para estimar el tiempo, por ciudad. [INF] */
    velocidadKmh: z.number().int().min(5).max(80).default(24),
  })
  .refine((t) => t.minimo <= 100_000_000, { path: ['minimo'] });
export type TarifaViaje = z.infer<typeof esquemaTarifaViaje>;

/*
 * Sin mapa de rutas todavía (la llave de Google Maps está pendiente), la distancia por calle se
 * estima con la línea recta por un factor y el tiempo con una velocidad urbana media, los dos
 * guardados en la tarifa de cada ciudad. [INF]: son supuestos nuestros (Namma Yatri usa rutas
 * reales; Picap publica 33 km/h para la moto en trancón), y se reemplazan por la ruta real cuando
 * haya mapa (docs/investigaciones-rea/2026-10-28-moto-rea.md).
 */
/** Un viaje de Moto más largo que esto no se cotiza (los grandes limitan la moto a la ciudad). */
export const DISTANCIA_MAXIMA_KM: Record<ServicioViaje, number> = { moto: 40, carro: 80 };
/** Cuánto dura la cotización: después hay que volver a cotizar (precio fijo, no eterno). */
export const VIGENCIA_COTIZACION_S = 300;

type Punto = { lat: number; lng: number };

export function estimarRuta(
  t: Pick<TarifaViaje, 'factorCallePb' | 'velocidadKmh'>,
  origen: Punto,
  destino: Punto,
): { distanciaM: number; duracionS: number } {
  const km = (distanciaKm(origen, destino) * t.factorCallePb) / 10_000;
  return {
    distanciaM: Math.round(km * 1000),
    duracionS: Math.max(60, Math.round((km / t.velocidadKmh) * 3600)),
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
  cargoFijo: number;
  /** Lo que mueve el redondeo de la ciudad (puede ser negativo); así el desglose suma el total. */
  redondeo: number;
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
  const sinRedondeo = conMinimo + dinamico + t.cargoFijo;
  const total = Math.max(alPaso(sinRedondeo, t.redondeo), t.minimo + t.cargoFijo);
  return {
    base: t.base,
    distancia,
    tiempo,
    ajusteMinimo,
    dinamico,
    cargoFijo: t.cargoFijo,
    redondeo: total - sinRedondeo,
    total,
  };
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
  /** C-CARRO-XL: «xl» = carro grande (solo en Carro). */
  categoria: z.enum(['estandar', 'xl']).default('estandar'),
  origen: punto,
  destino: punto,
});

/** C-CARRO-XL: plazas mínimas del vehículo para un viaje XL. */
export const PLAZAS_XL = 6;

/** La tarifa del XL: los montos del recorrido por el factor de la ciudad (la espera y los cargos, iguales). */
export function tarifaXl<
  T extends { base: number; porKm: number; porMinuto: number; minimo: number; xlPb?: number },
>(t: T): T | null {
  if (!t.xlPb) return null;
  const f = (n: number) => Math.round((n * (t.xlPb ?? 10_000)) / 10_000);
  return {
    ...t,
    base: f(t.base),
    porKm: f(t.porKm),
    porMinuto: f(t.porMinuto),
    minimo: f(t.minimo),
  };
}
export type PedidoCotizacion = z.infer<typeof esquemaCotizarViaje>;

/** Lo que devuelve POST /datos/viajes/cotizar. */
export type CotizacionViaje = {
  id: string;
  servicio: ServicioViaje;
  categoria?: 'estandar' | 'xl';
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

/**
 * Lo que paga el pasajero si cancela ahora (estándar del mercado, verificado con REA en Namma
 * Yatri): gratis mientras se busca conductor; con conductor asignado, gratis durante la ventana de
 * la tarifa contada DESDE LA ASIGNACIÓN; después, el cargo de cancelación. Un viaje en curso no se
 * cancela desde la app (null).
 */
export function cargoCancelacionViaje(
  t: Pick<TarifaViaje, 'cancelacionGratisS' | 'cargoCancelacion'>,
  estado: string,
  segundosDesdeAsignacion: number | null,
): number | null {
  if (estado === 'pago_pendiente' || estado === 'buscando') return 0;
  if (estado !== 'asignado' && estado !== 'conductor_llego') return null;
  return (segundosDesdeAsignacion ?? 0) <= t.cancelacionGratisS ? 0 : t.cargoCancelacion;
}

/**
 * El número de emergencias de cada país (M6). El botón de emergencia de las dos apps llama aquí
 * y además avisa al equipo de Divoox con la ubicación. Uber Moto Colombia lleva al 123 [OBS].
 */
const NUMEROS_EMERGENCIA = new Map<string, string>([
  ['US', '911'],
  ['CO', '123'],
  ['VE', '911'],
  ['MX', '911'],
]);
export function numeroEmergencia(pais: string | null | undefined): string {
  return NUMEROS_EMERGENCIA.get((pais ?? '').toUpperCase()) ?? '911';
}
