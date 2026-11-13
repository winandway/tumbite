import type { TarifaViaje } from './viajes';

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
export const DOCUMENTOS_CONDUCTOR = ['licencia_moto', 'antecedentes_penales'] as const;
export type DocumentoConductor = (typeof DOCUMENTOS_CONDUCTOR)[number];

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
  /** Papeles del conductor que se piden en ese país. */
  documentosConductor: readonly DocumentoConductor[];
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
  documentosConductor: [],
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
  requisitosDeDocumento: {
    licencia_moto: ['licencia_moto', 'historial_manejo'],
    antecedentes_penales: ['antecedentes_pasajeros'],
  },
  requisitosOtrosServicios: {},
};

const PERFILES = new Map<string, PerfilPasajeros>([
  ['US', EEUU],
  ['VE', VENEZUELA],
]);

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
 * «Te alcanza para unas N carreras»: saldo prepago dividido por la comisión típica (aproximado).
 * Sin comisión que cobrar (0), no hay tope: null.
 */
export function carrerasQueAlcanzan(saldo: number, comisionTipica: number): number | null {
  if (!Number.isFinite(comisionTipica) || comisionTipica <= 0) return null;
  return Math.max(0, Math.floor(Math.max(0, saldo) / comisionTipica));
}

/** Por debajo de estas carreras se avisa que el saldo se está acabando (como inDrive). */
export const CARRERAS_SALDO_BAJO = 3;
