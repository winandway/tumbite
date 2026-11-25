import type { CategoriaCarro, ConfigDinamica, RequisitosCategoria, TarifaViaje } from './viajes';
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

export const METODOS_PAGO_VIAJE = ['efectivo', 'tarjeta', 'pago_movil', 'yape', 'plin'] as const;
export type MetodoPagoViaje = (typeof METODOS_PAGO_VIAJE)[number];

/**
 * C-PAGO-A-CELULAR (19 nov 2026): los métodos en que el pasajero le manda el dinero al celular del
 * conductor y el conductor confirma a mano que le llegó: el pago móvil de Venezuela, y Yape y Plin de
 * Perú. Comparten un solo recorrido (cuenta de cobro del mismo tipo, datos a la vista del pasajero,
 * «sí me llegó» / «no me llegó» con una corrección). El tipo de la cuenta de cobro ES el método.
 */
export const METODOS_A_CELULAR = ['pago_movil', 'yape', 'plin'] as const;
export type MetodoACelular = (typeof METODOS_A_CELULAR)[number];
export function esPagoACelular(metodo: string | null | undefined): metodo is MetodoACelular {
  return (METODOS_A_CELULAR as readonly string[]).includes(metodo ?? '');
}

/**
 * Los tipos de cuenta de cobro que reciben un método a celular. Yape y Plin se envían entre sí con
 * el número de celular, gratis, desde 2023 (ficha de Ica, sección 3.1 [OBS]): un conductor con
 * cualquiera de las dos recibe los viajes de las dos. El pago móvil de Venezuela solo con su cuenta.
 */
export function cuentasQueReciben(metodo: string | null | undefined): readonly string[] {
  if (metodo === 'yape') return ['yape', 'plin'];
  if (metodo === 'plin') return ['plin', 'yape'];
  return esPagoACelular(metodo) ? [metodo] : [];
}

/** Papeles del CONDUCTOR (no del vehículo) que se suben a mano y revisa el equipo. */
export const DOCUMENTOS_CONDUCTOR = [
  'licencia_moto',
  'antecedentes_penales',
  // C-CARRO-PAPELES-PAIS (13 nov 2026): la licencia para manejar carro (en Venezuela, la del INTT).
  'licencia_conducir',
  // C-PAPELES-POR-PAIS (24 nov 2026): el certificado médico que pide Venezuela. Solo se acepta donde
  // la lista del país está encendida y lo pide (`papelesListaPais.ts`); nunca frena el reparto.
  'certificado_medico',
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
  /**
   * C-CARRO-CATEGORIAS, C-VIAJE-PARADAS y C-CARRO-DINAMICA (14 nov 2026): lo que cambia de Carro por
   * país. Ficha: docs/investigaciones-rea/2026-11-14-carro-paradas-categorias-dinamica.md.
   */
  carro: PerfilCarro;
};

export type PerfilCarro = {
  /** Requisitos del carro para Comfort y Premium (el económico usa los de siempre del servicio). */
  categorias: Readonly<Record<Exclude<CategoriaCarro, 'estandar'>, RequisitosCategoria>>;
  /** Paradas intermedias como máximo en un viaje. */
  paradasMaximas: number;
  /** Tarifa dinámica: tope del país y escalones por demanda. */
  dinamica: ConfigDinamica;
};

/** Escalones de la tarifa dinámica (razón de viajes buscando por cada conductor libre, × 100). */
const ESCALONES_DINAMICA = [
  { razonPc: 150, multPb: 12_000 },
  { razonPc: 200, multPb: 15_000 },
  { razonPc: 300, multPb: 20_000 },
] as const;

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
  carro: {
    categorias: {
      // Uber Comfort y Black publican listas de modelos; el año es nuestro corte [INF] (Black: 6 o 7 años [DOC]).
      comfort: { antiguedadMaxima: 8, plazasMinimas: 4, revisionManual: false },
      premium: { antiguedadMaxima: 6, plazasMinimas: 4, revisionManual: true },
    },
    // Uber deja hasta 5 [REA] y DiDi 2 [DOC]; empezamos con 3 [INF].
    paradasMaximas: 3,
    // Uber no publica multiplicadores; tope de 2,0 [INF], con escalones 1,2 · 1,5 · 2,0.
    dinamica: { topePb: 20_000, demandaMinima: 3, escalones: ESCALONES_DINAMICA },
  },
};

/**
 * Venezuela: los precios de moto se muestran en dólares (Ridery, Yummy, Yango [OBS]) y se pagan en
 * efectivo o por pago móvil. Antecedentes: no se exigen (decisión de Richard del 19 nov 2026; la
 * política del país los declara exentos). El conductor sube su licencia y el equipo la revisa. La edad mínima queda
 * en 21 hasta que el abogado diga otra cosa (no se baja el piso sin una fuente).
 */
const VENEZUELA: PerfilPasajeros = {
  pais: 'VE',
  antecedentes: 'documentos',
  edadMinima: 21,
  metodosPago: ['efectivo', 'pago_movil'],
  monedaViajes: 'USD',
  placaNacional: true,
  // C-PLAZO-PAPELES (Richard, 19 nov 2026): en Venezuela NO se piden antecedentes penales ni se
  // muestran como requisito. Quien ya subió su certificado lo conserva (el mapa de abajo sigue).
  documentosConductor: ['licencia_moto'],
  // C-CARRO-PAPELES-PAIS: el taxista sube su licencia de conducir;
  // los papeles del carro (título o carnet de circulación, RCV, revisión) van con el vehículo.
  // Ficha: docs/investigaciones-rea/2026-11-13-carro-venezuela.md.
  documentosCarro: ['licencia_conducir'],
  requisitosDeDocumento: {
    licencia_moto: ['licencia_moto', 'historial_manejo'],
    licencia_conducir: ['licencia', 'historial_manejo'],
    antecedentes_penales: ['antecedentes_pasajeros'],
  },
  // C-ENVIOS-POR-PAIS (16 nov 2026, piloto de El Vigía y Tucaní): en Venezuela no hay verificación
  // automática de antecedentes; el certificado que revisa el equipo también vale para Envíos de A a B
  // (y los demás servicios que piden «antecedentes»). Así lo dice el país, explícito.
  requisitosOtrosServicios: { antecedentes_penales: ['antecedentes'] },
  carro: {
    categorias: {
      // El parque de carros de Venezuela es más viejo: Comfort hasta 12 años y Premium hasta 8 [INF].
      comfort: { antiguedadMaxima: 12, plazasMinimas: 4, revisionManual: false },
      premium: { antiguedadMaxima: 8, plazasMinimas: 4, revisionManual: true },
    },
    // DiDi deja 2 en la región [DOC].
    paradasMaximas: 2,
    // Tope prudente para empezar: 1,5 [INF]. No se encontró norma local; lo legal lo confirma el abogado.
    dinamica: { topePb: 15_000, demandaMinima: 3, escalones: ESCALONES_DINAMICA },
  },
};

/**
 * C-PERFIL-PERU (19 nov 2026): Perú cobra en soles y se paga en mano: efectivo, Yape o Plin (los
 * medios reales de la calle [DOC]; inDrive cobra igual). Sin tarjeta hasta tener procesador local.
 * No hay proveedor automático de antecedentes: el conductor sube su licencia y su certificado de
 * antecedentes (o el Certificado Único Laboral, que también acepta Uber [DOC]) y el equipo los revisa.
 * Edad mínima 21, como el resto, hasta que un abogado peruano diga otra cosa.
 * Ficha: docs/investigaciones-rea/2026-11-19-ica-peru.md.
 */
const PERU: PerfilPasajeros = {
  pais: 'PE',
  antecedentes: 'documentos',
  edadMinima: 21,
  metodosPago: ['efectivo', 'yape', 'plin'],
  monedaViajes: 'PEN',
  placaNacional: true,
  // Mototaxi y moto: licencia de la clase B; carro: licencia de la clase A (A-I o A-IIa) [OBS].
  documentosConductor: ['licencia_moto', 'antecedentes_penales'],
  documentosCarro: ['licencia_conducir', 'antecedentes_penales'],
  requisitosDeDocumento: {
    licencia_moto: ['licencia_moto', 'historial_manejo'],
    licencia_conducir: ['licencia', 'historial_manejo'],
    antecedentes_penales: ['antecedentes_pasajeros'],
  },
  // Igual que en Venezuela: el certificado que revisa el equipo vale también para Envíos.
  requisitosOtrosServicios: { antecedentes_penales: ['antecedentes'] },
  carro: {
    categorias: {
      // Uber Perú admite carros de hasta 15 años [DOC]; Comfort y Premium, más nuevos [INF].
      comfort: { antiguedadMaxima: 10, plazasMinimas: 4, revisionManual: false },
      premium: { antiguedadMaxima: 6, plazasMinimas: 4, revisionManual: true },
    },
    paradasMaximas: 2,
    // Tope prudente para empezar: 1,5 [INF]; el proyecto de ley de plataformas no fija uno.
    dinamica: { topePb: 15_000, demandaMinima: 3, escalones: ESCALONES_DINAMICA },
  },
};

const PERFILES = new Map<string, PerfilPasajeros>([
  ['US', EEUU],
  ['VE', VENEZUELA],
  ['PE', PERU],
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
  esperaParadaGratisS: 120,
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
  // Comfort × 1,3 [INF]; Premium × 1,8 (Yummy «Ejecutivo» ronda 1,8 veces el básico [REA]).
  comfortPb: 13_000,
  premiumPb: 18_000,
  esperaParadaGratisS: 120,
  factorCallePb: 13_000,
  velocidadKmh: 24,
};

/**
 * C-PERFIL-PERU: tarifa de Moto de mercado para Ica, en céntimos de sol. En Ica el servicio de Moto es
 * el MOTOTAXI (el vehículo que domina la ciudad [OBS]); calibrada con la calle: carrera corta de
 * mototaxi entre 1,50 y 3 soles [OBS, poco fiable]. Redondea a 10 céntimos, como se paga en la calle.
 * Es la PROPUESTA de la ficha (sección 5.2): el precio final lo aprueba Richard antes de encender.
 */
export const TARIFA_MOTO_PERU: TarifaViaje = {
  base: 150,
  porKm: 90,
  porMinuto: 8,
  minimo: 300,
  esperaGratisS: 180,
  porMinutoEspera: 10,
  cancelacionGratisS: 120,
  cargoCancelacion: 100,
  cargoNoSePresento: 100,
  topeDinamicoPb: 10_000,
  redondeo: 10,
  cargoFijo: 0,
  esperaParadaGratisS: 120,
  factorCallePb: 13_000,
  velocidadKmh: 22,
};

/**
 * C-PERFIL-PERU: tarifa de Carro de mercado para Ica, en céntimos de sol. Calibrada con la calle: taxi
 * del centro a Huacachina (5 km) entre 10 y 15 soles y carrera corta entre 3 y 8 [OBS, poco fiable];
 * 5 km y 12 minutos dan unos 11,30. Propuesta de la ficha: el precio final lo aprueba Richard.
 */
export const TARIFA_CARRO_PERU: TarifaViaje = {
  base: 300,
  porKm: 130,
  porMinuto: 15,
  minimo: 500,
  esperaGratisS: 180,
  porMinutoEspera: 20,
  cancelacionGratisS: 120,
  cargoCancelacion: 200,
  cargoNoSePresento: 200,
  topeDinamicoPb: 10_000,
  redondeo: 10,
  cargoFijo: 0,
  xlPb: 15_000,
  comfortPb: 13_000,
  premiumPb: 18_000,
  esperaParadaGratisS: 120,
  factorCallePb: 13_000,
  velocidadKmh: 24,
};

const TARIFAS_DE_MERCADO = new Map<string, Readonly<Record<'moto' | 'carro', TarifaViaje>>>([
  ['VE', { moto: TARIFA_MOTO_VENEZUELA, carro: TARIFA_CARRO_VENEZUELA }],
  ['PE', { moto: TARIFA_MOTO_PERU, carro: TARIFA_CARRO_PERU }],
]);

/** La tarifa de mercado sembrada para un servicio de viajes en un país (null = hay que escribirla). */
export function tarifaDeMercado(pais: string, servicio: string): TarifaViaje | null {
  const delPais = TARIFAS_DE_MERCADO.get(pais.toUpperCase());
  if (!delPais) return null;
  if (servicio === 'moto') return delPais.moto;
  if (servicio === 'carro') return delPais.carro;
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
