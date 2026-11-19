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
export const SERVICIOS_VIAJE = ['moto', 'carro', 'envios'] as const;
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
    /**
     * C-CARRO-CATEGORIAS (14 nov 2026): Comfort y Premium, como Uber Comfort y Uber Black. Su precio es
     * el del carro normal por este factor (12 500 = × 1,25). Sin el factor, la ciudad no ofrece esa
     * categoría.
     */
    comfortPb: z.number().int().min(10_000).max(40_000).optional(),
    premiumPb: z.number().int().min(10_000).max(40_000).optional(),
    /**
     * C-VIAJE-PARADAS (14 nov 2026): espera gratis en cada parada intermedia; después se cobra por
     * minuto empezado con `porMinutoEspera`, como la espera en la recogida.
     */
    esperaParadaGratisS: segundos(1800).default(120),
    /** C-ENVIOS: valor declarado máximo de un paquete (unidad menor). */
    valorMaximo: monto.optional(),
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
export const DISTANCIA_MAXIMA_KM: Record<ServicioViaje, number> = {
  moto: 40,
  carro: 80,
  envios: 60,
};

/**
 * C-ENVIOS (30 oct 2026), como Uber Courier: lo que el cliente dice del paquete al pedir. El valor
 * declarado tiene tope por ciudad (`valorMaximo` de la tarifa; sin él, 100 en la moneda local) y quien
 * envía confirma que no manda nada prohibido.
 */
/**
 * C-ENVIO-TAMANO (14 nov 2026, todos los países): el tamaño del paquete, con categorías simples como
 * el mercado (Uber Connect y DoorDash Package Pickup piden que quepa en el vehículo y ponen un tope de
 * peso [DOC]). Cada tamaño dice qué vehículos lo llevan: el envío solo se ofrece a quien puede.
 */
export const TAMANOS_PAQUETE = ['sobre', 'pequeno', 'mediano', 'grande'] as const;
export type TamanoPaquete = (typeof TAMANOS_PAQUETE)[number];
/** Peso máximo de cada tamaño, en kilos. */
export const PAQUETE_MAX_KG: Record<TamanoPaquete, number> = {
  sobre: 1,
  pequeno: 5,
  mediano: 15,
  grande: 30,
};
/** ¿Este vehículo lleva un paquete de ese tamaño? Mediano: carro o moto con cajón. Grande: carro. */
export function vehiculoLlevaPaquete(
  tamano: TamanoPaquete,
  vehiculo: { tipo: string; conCajon?: boolean },
): boolean {
  if (tamano === 'grande') return vehiculo.tipo === 'carro';
  if (tamano === 'mediano')
    return vehiculo.tipo === 'carro' || (vehiculo.tipo === 'moto' && Boolean(vehiculo.conCajon));
  return vehiculo.tipo !== 'a_pie';
}

export const esquemaPaqueteEnvio = z.object({
  descripcion: z.string().trim().min(3).max(120),
  tamano: z.enum(TAMANOS_PAQUETE).default('pequeno'),
  valorDeclarado: z.number().int().min(0).max(100_000_000),
  destinatario: z.object({
    nombre: z.string().trim().min(2).max(60),
    telefono: z.string().trim().min(7).max(20),
  }),
  sinProhibidos: z.literal(true),
});
export type PaqueteEnvio = z.infer<typeof esquemaPaqueteEnvio>;
/** Sin tope en la tarifa de la ciudad: 100 en la unidad mayor de la moneda. */
export const VALOR_MAXIMO_ENVIO_POR_DEFECTO = 10_000;
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
  /** C-PUNTO-EXACTO: punto de referencia del punto de encuentro o del destino (opcional). */
  referencia: z.string().trim().max(160).optional(),
});
/**
 * C-CARRO-CATEGORIAS: las categorías de un viaje. «estandar» es el económico; «comfort» y «premium»
 * piden un carro mejor (requisitos del perfil del país); «xl» es el carro grande (C-CARRO-XL). Solo
 * Carro tiene categorías distintas de la estándar.
 */
export const CATEGORIAS_VIAJE = ['estandar', 'comfort', 'premium', 'xl'] as const;
export type CategoriaViaje = (typeof CATEGORIAS_VIAJE)[number];
/** Las categorías que puede tener un CARRO (el XL no es categoría del carro: son sus plazas). */
export const CATEGORIAS_CARRO = ['estandar', 'comfort', 'premium'] as const;
export type CategoriaCarro = (typeof CATEGORIAS_CARRO)[number];

/** C-VIAJE-PARADAS: lo más que acepta el servidor; cada país pone su máximo en el perfil. */
export const PARADAS_MAXIMAS_ABSOLUTO = 5;

export const esquemaPuntoViaje = punto;
export type PuntoViaje = z.infer<typeof punto>;

export const esquemaCotizarViaje = z.object({
  servicio: z.enum(SERVICIOS_VIAJE),
  categoria: z.enum(CATEGORIAS_VIAJE).default('estandar'),
  origen: punto,
  /** C-VIAJE-PARADAS: paradas intermedias, en orden, entre la recogida y el destino. */
  paradas: z.array(punto).max(PARADAS_MAXIMAS_ABSOLUTO).default([]),
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

/**
 * C-CARRO-CATEGORIAS: la tarifa de una categoría de Carro en la ciudad (null = la ciudad no la ofrece).
 * Los montos del recorrido van por el factor de la categoría; la espera y los cargos, iguales.
 */
export function tarifaDeCategoria<
  T extends {
    base: number;
    porKm: number;
    porMinuto: number;
    minimo: number;
    xlPb?: number;
    comfortPb?: number;
    premiumPb?: number;
  },
>(t: T, categoria: CategoriaViaje): T | null {
  if (categoria === 'estandar') return t;
  if (categoria === 'xl') return tarifaXl(t);
  const factor = categoria === 'comfort' ? t.comfortPb : t.premiumPb;
  if (!factor) return null;
  const f = (n: number) => Math.round((n * factor) / 10_000);
  return {
    ...t,
    base: f(t.base),
    porKm: f(t.porKm),
    porMinuto: f(t.porMinuto),
    minimo: f(t.minimo),
  };
}

/** Las categorías que una ciudad ofrece con esa tarifa de Carro, en el orden en que se muestran. */
export function categoriasOfrecidas(t: {
  xlPb?: number;
  comfortPb?: number;
  premiumPb?: number;
}): CategoriaViaje[] {
  return CATEGORIAS_VIAJE.filter(
    (c) =>
      c === 'estandar' ||
      (c === 'comfort' && Boolean(t.comfortPb)) ||
      (c === 'premium' && Boolean(t.premiumPb)) ||
      (c === 'xl' && Boolean(t.xlPb)),
  );
}

const RANGO_CARRO: Record<CategoriaCarro, number> = { estandar: 0, comfort: 1, premium: 2 };
export const rangoCategoria = (c: string | null | undefined): number =>
  c === 'premium' ? RANGO_CARRO.premium : c === 'comfort' ? RANGO_CARRO.comfort : 0;

/**
 * C-CARRO-CATEGORIAS: ¿este carro recibe un viaje de esa categoría? Como en Uber: un carro Premium o
 * Comfort también puede recibir los viajes de las categorías de abajo, si su conductor no lo apagó
 * («aceptaMenores»); nunca recibe los de una categoría de arriba. El XL va por plazas.
 */
export function carroRecibeCategoria(
  carro: { categoria: string | null; plazas: number | null; aceptaMenores: boolean },
  categoriaViaje: string | null,
): boolean {
  if (categoriaViaje === 'xl') return (carro.plazas ?? 0) >= PLAZAS_XL;
  const mio = rangoCategoria(carro.categoria);
  const pedido = rangoCategoria(categoriaViaje);
  return mio === pedido || (mio > pedido && carro.aceptaMenores);
}

/** Requisitos del carro para una categoría (viven en el perfil del país). */
export type RequisitosCategoria = {
  /** Años de antigüedad como máximo (año de hoy − año del carro). */
  antiguedadMaxima: number;
  plazasMinimas: number;
  /** Además de cumplir, una persona del equipo la aprueba (Premium: modelo, interior, estado). */
  revisionManual: boolean;
};

/** ¿El carro cumple los requisitos medibles de la categoría? (La revisión manual va aparte.) */
export function carroCumpleCategoria(
  r: RequisitosCategoria,
  carro: { anio: number | null; plazas: number | null },
  anioDeHoy: number,
): boolean {
  if (carro.anio == null || anioDeHoy - carro.anio > r.antiguedadMaxima) return false;
  return (carro.plazas ?? 0) >= r.plazasMinimas;
}

/**
 * C-CARRO-DINAMICA (14 nov 2026): tarifa dinámica por zona, como el «surge» de Uber y la tarifa
 * dinámica de DiDi. El multiplicador sale de cuántos viajes buscan conductor frente a cuántos
 * conductores libres hay, por escalones, y NUNCA pasa del tope (el de la tarifa de la ciudad y el del
 * país, el menor). Por debajo de `demandaMinima` solicitudes no hay recargo: en una ciudad que
 * empieza, un solo pedido no dispara el precio.
 */
export type ConfigDinamica = {
  /** Tope del país (10 000 = sin recargo). El de la tarifa de la ciudad nunca lo supera. */
  topePb: number;
  demandaMinima: number;
  /** Escalones: desde esta razón demanda/oferta (× 100), este multiplicador. En orden creciente. */
  escalones: readonly { razonPc: number; multPb: number }[];
};

export function multiplicadorPorDemanda(
  cfg: ConfigDinamica,
  demanda: number,
  oferta: number,
  topeTarifaPb: number,
): number {
  const tope = Math.max(10_000, Math.min(cfg.topePb, topeTarifaPb));
  if (tope <= 10_000 || demanda < cfg.demandaMinima) return 10_000;
  const razonPc = Math.round((demanda * 100) / Math.max(1, oferta));
  let mult = 10_000;
  for (const e of cfg.escalones) if (razonPc >= e.razonPc) mult = Math.max(mult, e.multPb);
  return Math.min(mult, tope);
}

/** «× 1,5» («× 1.5» en inglés) para mostrar el multiplicador: una cifra decimal, sin ceros de más. */
export function textoMultiplicador(pb: number, idioma: 'es' | 'en' = 'es'): string {
  const d = String(Math.round(pb / 1000) / 10);
  return `× ${idioma === 'en' ? d : d.replace('.', ',')}`;
}

/**
 * C-VIAJE-PARADAS: lo más que se cobra de espera en UNA parada, después de la gratis (10 minutos). Una
 * parada es corta (Uber pide menos de 3 minutos [DOC]); sin este tope, un «Seguir» olvidado le cobraría
 * al pasajero horas de espera. [INF]
 */
export const ESPERA_PARADA_COBRABLE_MAX_S = 600;

/**
 * C-VIAJE-PARADAS: la espera cobrada en las paradas. Cada parada tiene su espera gratis; después,
 * por minuto empezado, hasta el tope cobrable por parada.
 */
export function cargoEsperaParadas(
  t: Pick<TarifaViaje, 'esperaParadaGratisS' | 'porMinutoEspera'>,
  segundosPorParada: readonly number[],
): number {
  return segundosPorParada.reduce((suma, s) => {
    const extra = Math.min(
      ESPERA_PARADA_COBRABLE_MAX_S,
      Math.max(0, Math.floor(s) - t.esperaParadaGratisS),
    );
    return suma + (extra === 0 ? 0 : Math.ceil(extra / 60) * t.porMinutoEspera);
  }, 0);
}

/** Estados de una parada intermedia. */
export const ESTADOS_PARADA = ['pendiente', 'en_parada', 'visitada', 'quitada'] as const;
export type EstadoParada = (typeof ESTADOS_PARADA)[number];
export type ParadaViaje = {
  orden: number;
  lat: number;
  lng: number;
  direccion: string;
  estado: EstadoParada;
};

/** C-VIAJE-PARADAS: lo que manda la app para cambiar las paradas pendientes de un viaje. */
export const esquemaCambiarParadas = z.object({
  /** Las paradas que QUEDAN por hacer, en orden (las ya visitadas no se tocan). */
  paradas: z.array(punto).max(PARADAS_MAXIMAS_ABSOLUTO),
  /** false = solo dime cuánto costaría; true = aplícalo. */
  confirmar: z.boolean().default(false),
  /** El total que la persona vio al confirmar: si cambió, se le vuelve a mostrar. */
  totalVisto: z.number().int().min(0).optional(),
});

/** Lo que devuelve POST /datos/viajes/cotizar. */
export type CotizacionViaje = {
  id: string;
  servicio: ServicioViaje;
  categoria?: CategoriaViaje;
  /** C-VIAJE-PARADAS: las paradas intermedias de la cotización, en orden. */
  paradas?: PuntoViaje[];
  /** C-CARRO-DINAMICA: el multiplicador aplicado (10 000 = precio normal). */
  multiplicadorPb?: number;
  /** C-VIAJE-PARADAS: cuántas paradas admite un viaje en esa ciudad (perfil del país). */
  paradasMaximas?: number;
  /** C-CARRO-CATEGORIAS: el precio de cada categoría que la ciudad ofrece para este trayecto. */
  opciones?: { categoria: CategoriaViaje; total: number }[];
  zona: { id: string; nombre: string };
  moneda: string;
  distanciaM: number;
  duracionS: number;
  /** C-RUTA-POR-CALLES: 'calles' (distancia real por calles) o 'estimada' (fórmula). */
  fuenteDistancia?: 'calles' | 'estimada';
  desglose: DesgloseViaje;
  total: number;
  venceEn: string;
  /** La tarifa es de prueba (sitio de pruebas): no es un precio comercial aprobado. */
  dePrueba: boolean;
  /** C-PAGO-MOVIL-VIAJE: con qué se puede pagar en esa ciudad (perfil del país). */
  metodosPago?: ('efectivo' | 'tarjeta' | 'pago_movil')[];
  /** C-BS-REFERENCIA: el equivalente en la moneda local (solo informativo; null sin tasa vigente). */
  referencia?: import('./tasaReferencia').Referencia | null;
  /** C-BS-EN-MANO: la tasa fijada con la cotización (null si no aplica o no hay tasa vigente). */
  tasaLocal?: import('./tasaReferencia').TasaFijada | null;
  /** C-BS-EN-MANO: lo que se pagaría en mano (precio menos regalo), en dólares y en bolívares. */
  enMano?: import('./tasaReferencia').MontoEnMano | null;
  /**
   * C-RUTA-POR-CALLES: el pasajero ya veía otro precio para este mismo trayecto (unos 50 m, últimos
   * minutos) y cambió. La app lo dice en una línea discreta antes de pedir.
   */
  precioCambio?: boolean;
  totalAnterior?: number;
  /** C-CUPON-DIVOOX: el regalo que paga Divoox en este viaje si se paga en mano (o null). */
  regalo?: import('./regaloDivoox').RegaloDivoox | null;
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
