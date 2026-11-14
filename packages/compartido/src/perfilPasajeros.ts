import type { TarifaViaje } from './viajes';
import { CIUDAD_PRUEBAS_EL_VIGIA } from './comidaVenezuela';

/**
 * Divoox Moto por país (13 nov 2026, regla «cada país es su propio sistema»): una sola pieza dice,
 * para cada país, cómo se verifican los conductores de pasajeros, con qué se paga un viaje, en qué
 * moneda se cobra y qué papeles sube el conductor. Nada de condiciones sueltas por el código: el
 * servidor, el panel y las apps leen esto. Un país sin perfil propio usa el de Estados Unidos (el
 * más exigente), así nunca se baja el piso de seguridad por olvido.
 *
 * Etiquetas de la fuente: docs/investigaciones-rea/2026-11-13-moto-venezuela-tarifas.md.
 */

export const METODOS_PAGO_VIAJE = ['efectivo', 'tarjeta', 'pago_movil'] as const;
export type MetodoPagoViaje = (typeof METODOS_PAGO_VIAJE)[number];

/** Papeles del CONDUCTOR (no del vehículo) que se suben a mano y revisa el equipo. */
export const DOCUMENTOS_CONDUCTOR = [
  'licencia_moto',
  'antecedentes_penales',
  // C-CARRO-PAPELES-PAIS (13 nov 2026): la licencia para manejar carro (en Venezuela, la del INTT).
  'licencia_conducir',
] as const;
export type DocumentoConductor = (typeof DOCUMENTOS_CONDUCTOR)[number];

/** Servicios de pasajeros que piden papeles al conductor (Moto y Carro). */
export type ServicioPasajeros = 'moto' | 'carro';

/**
 * C-CARRO-PAPELES-PAIS: papeles del VEHÍCULO que se suben para llevar pasajeros en cada servicio. Son los
 * mismos en todos los países (el despacho exige registro, seguro y seguro de pasajeros aprobados; Carro
 * además la inspección, requisito `inspeccion_vehiculo`); lo que cambia por país es cómo se llama cada
 * papel (en Venezuela: título o carnet de circulación, póliza RCV, revisión del vehículo).
 */
export const DOCUMENTOS_VEHICULO_PASAJEROS: Readonly<Record<ServicioPasajeros, readonly string[]>> =
  {
    moto: ['registro', 'seguro', 'seguro_pasajeros', 'foto_frente', 'foto_placa'],
    carro: [
      'registro',
      'seguro',
      'seguro_pasajeros',
      'inspeccion',
      'foto_frente',
      'foto_placa',
      'foto_interior',
    ],
  };

export type PerfilPasajeros = {
  pais: string;
  /**
   * Cómo se cumplen los antecedentes y el historial de manejo: con el proveedor (Checkr, EE. UU.)
   * o con documentos que sube el conductor y aprueba una persona del equipo.
   */
  antecedentes: 'proveedor' | 'documentos';
  /** Edad mínima para llevar pasajeros (configurable por país; EE. UU. no baja de 21). */
  edadMinima: number;
  /** Con qué puede pagar el pasajero un viaje en ese país. */
  metodosPago: readonly MetodoPagoViaje[];
  /** Moneda en que se cotiza y se cobra un viaje (null = la de la ciudad). */
  monedaViajes: string | null;
  /** La placa es nacional (no hay «estado que la emitió»): se guarda con el código del país. */
  placaNacional: boolean;
  /** Papeles del conductor de MOTO que se piden en ese país. */
  documentosConductor: readonly DocumentoConductor[];
  /** C-CARRO-PAPELES-PAIS: papeles del conductor de CARRO que se piden en ese país. */
  documentosCarro: readonly DocumentoConductor[];
  /** Qué requisitos DE PASAJEROS cumple cada papel cuando el equipo lo aprueba. */
  requisitosDeDocumento: Readonly<Partial<Record<DocumentoConductor, readonly string[]>>>;
  /**
   * C-PAPELES-SOLO-PASAJEROS: requisitos de OTROS servicios (Envíos, Mercado, Farmacia) que un papel
   * también cumple. Vacío salvo que el país lo diga explícito: un certificado revisado para llevar
   * pasajeros no reemplaza por sí solo la verificación de los demás servicios.
   */
  requisitosOtrosServicios?: Readonly<Partial<Record<DocumentoConductor, readonly string[]>>>;
};

/** Los requisitos que son de llevar pasajeros (los únicos que un papel cumple por defecto). */
export const REQUISITOS_PASAJEROS: ReadonlySet<string> = new Set([
  'licencia_moto',
  'licencia',
  'historial_manejo',
  'antecedentes_pasajeros',
]);

/** Qué requisitos cumple un papel aprobado: los de pasajeros y, solo si el país lo dice, otros. */
export function requisitosQueCumple(perfil: PerfilPasajeros, documento: string): string[] {
  const de = (m: PerfilPasajeros['requisitosDeDocumento'] | undefined) => [
    ...(new Map(Object.entries(m ?? {})).get(documento) ?? []),
  ];
  const pasajeros = de(perfil.requisitosDeDocumento).filter((r) => REQUISITOS_PASAJEROS.has(r));
  return [...new Set([...pasajeros, ...de(perfil.requisitosOtrosServicios)])];
}

const EEUU: PerfilPasajeros = {
  pais: 'US',
  antecedentes: 'proveedor',
  edadMinima: 21,
  metodosPago: ['efectivo', 'tarjeta'],
  monedaViajes: null,
  placaNacional: false,
  // EE. UU.: antecedentes e historial de manejo con el proveedor (Checkr); la licencia, la
  // inspección y el seguro de pasajeros siguen como estaban sembrados. No se baja ese piso.
  documentosConductor: [],
  documentosCarro: [],
  requisitosDeDocumento: {},
};

/**
 * Venezuela: los precios de moto se muestran en dólares (Ridery, Yummy, Yango [OBS]) y se pagan en
 * efectivo o por pago móvil. Los antecedentes no tienen proveedor automático: el conductor sube su
 * certificado de antecedentes penales y su licencia, y el equipo los revisa. La edad mínima queda
 * en 21 hasta que el abogado diga otra cosa (no se baja el piso sin una fuente).
 */
const VENEZUELA: PerfilPasajeros = {
  pais: 'VE',
  antecedentes: 'documentos',
  edadMinima: 21,
  metodosPago: ['efectivo', 'pago_movil'],
  monedaViajes: 'USD',
  placaNacional: true,
  documentosConductor: ['licencia_moto', 'antecedentes_penales'],
  // C-CARRO-PAPELES-PAIS: el taxista sube su licencia de conducir y el certificado de antecedentes;
  // los papeles del carro (título o carnet de circulación, RCV, revisión) van con el vehículo.
  // Ficha: docs/investigaciones-rea/2026-11-13-carro-venezuela.md.
  documentosCarro: ['licencia_conducir', 'antecedentes_penales'],
  requisitosDeDocumento: {
    licencia_moto: ['licencia_moto', 'historial_manejo'],
    licencia_conducir: ['licencia', 'historial_manejo'],
    antecedentes_penales: ['antecedentes_pasajeros'],
  },
  requisitosOtrosServicios: {},
};

const PERFILES = new Map<string, PerfilPasajeros>([
  ['US', EEUU],
  ['VE', VENEZUELA],
]);

/** Los papeles del conductor que pide su país para un servicio de pasajeros. */
export function documentosDelConductor(
  perfil: PerfilPasajeros,
  servicio: ServicioPasajeros,
): readonly DocumentoConductor[] {
  return servicio === 'carro' ? perfil.documentosCarro : perfil.documentosConductor;
}

export function perfilPasajeros(pais: string | null | undefined): PerfilPasajeros {
  const p = PERFILES.get((pais ?? '').toUpperCase());
  return p ?? { ...EEUU, pais: (pais ?? 'US').toUpperCase() };
}

/**
 * Tarifa de Moto de mercado para una ciudad de Venezuela, en centavos de dólar. Calibrada con las
 * comparaciones públicas de Caracas (1,2 km: Ridery 0,98 y Yummy 1,29; 9 km: Ridery 3,11 y Yummy
 * 3,20 [OBS]). Sin redondeo (las apps muestran centavos) y sin precio dinámico todavía.
 */
export const TARIFA_MOTO_VENEZUELA: TarifaViaje = {
  base: 50,
  porKm: 22,
  porMinuto: 3,
  minimo: 100,
  esperaGratisS: 180,
  porMinutoEspera: 5,
  cancelacionGratisS: 120,
  cargoCancelacion: 50,
  cargoNoSePresento: 50,
  topeDinamicoPb: 10_000,
  redondeo: 1,
  cargoFijo: 0,
  factorCallePb: 13_000,
  velocidadKmh: 24,
};

/**
 * C-CARRO-TARIFA-VE (13 nov 2026): tarifa de Carro de mercado para una ciudad de Venezuela, en centavos
 * de dólar. Calibrada con Caracas (1,2 km en carro: Ridery 4,20 y Yummy 4,25 [OBS]; taxis desde 3 o 4
 * dólares [OBS]) y algo por debajo para una ciudad mediana como El Vigía. Carro XL = × 1,5 (C-CARRO-XL).
 * Ficha: docs/investigaciones-rea/2026-11-13-carro-venezuela.md. Sin redondeo ni precio dinámico.
 */
export const TARIFA_CARRO_VENEZUELA: TarifaViaje = {
  base: 150,
  porKm: 45,
  porMinuto: 6,
  minimo: 350,
  esperaGratisS: 180,
  porMinutoEspera: 10,
  cancelacionGratisS: 120,
  cargoCancelacion: 100,
  cargoNoSePresento: 100,
  topeDinamicoPb: 10_000,
  redondeo: 1,
  cargoFijo: 0,
  xlPb: 15_000,
  factorCallePb: 13_000,
  velocidadKmh: 24,
};

/** La tarifa de mercado sembrada para un servicio de viajes en un país (null = hay que escribirla). */
export function tarifaDeMercado(pais: string, servicio: string): TarifaViaje | null {
  if (pais.toUpperCase() !== 'VE') return null;
  if (servicio === 'moto') return TARIFA_MOTO_VENEZUELA;
  if (servicio === 'carro') return TARIFA_CARRO_VENEZUELA;
  return null;
}

/** Caracas como ciudad de PRUEBAS de Moto (la ciudad real la decide Richard). */
export const CIUDAD_PRUEBAS_VENEZUELA = {
  id: 'VE-CCS-PRUEBAS',
  nombre: 'Caracas (pruebas)',
  pais: 'VE',
  moneda: 'USD',
  zonaHoraria: 'America/Caracas',
  lat: 10.4806,
  lng: -66.9036,
  radioKm: 25,
} as const;

/**
 * El Vigía (estado Mérida) como ciudad de PRUEBAS de Carro, Moto y Envíos en Venezuela (orden de
 * Richard del 13 nov 2026). Es la MISMA zona que Comida (VE-MER-ELVIGIA): una sola ciudad de pruebas
 * en El Vigía (C-EL-VIGIA-UNA-ZONA, 14 nov 2026). La VE-VIG-CENTRO de antes ya no se siembra.
 */
export const CIUDAD_EL_VIGIA = CIUDAD_PRUEBAS_EL_VIGIA;

/**
 * «Te alcanza para unas N carreras»: saldo prepago dividido por la comisión típica (aproximado).
 * Sin comisión que cobrar (0), no hay tope: null.
 */
export function carrerasQueAlcanzan(saldo: number, comisionTipica: number): number | null {
  if (!Number.isFinite(comisionTipica) || comisionTipica <= 0) return null;
  return Math.max(0, Math.floor(Math.max(0, saldo) / comisionTipica));
}

/** Por debajo de estas carreras se avisa que el saldo se está acabando (como inDrive). */
export const CARRERAS_SALDO_BAJO = 3;
