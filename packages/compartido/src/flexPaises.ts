import { rutValido } from './perfilChile';
/**
 * Divoox Flex · CADA PAÍS ES SU PROPIO SISTEMA (regla de Richard, 28 oct 2026). Al crear la empresa
 * se elige el país y este perfil decide cómo funciona Flex allí: monedas, cómo pagan, qué se le pide
 * al destinatario y si la ubicación exacta es obligatoria. Una sola pieza: nada de condiciones por
 * país repartidas por el código. Evidencia: docs/investigaciones-rea/2026-10-28-flex-venezuela.md.
 */

export type PaisFlex = 'VE' | 'US';

export type PerfilFlex = {
  pais: PaisFlex;
  nombre: { es: string; en: string };
  monedas: readonly string[];
  /** Formas en que la empresa cobra o recibe el pago de sus clientes (informativas en Flex). */
  pagos: readonly string[];
  /** Si el envío puede llevar cobro contra entrega (el conductor cobra al entregar). */
  cobroContraEntrega: boolean;
  /**
   * `confirmada`: el envío NO entra a una ruta sin ubicación confirmada por el destinatario (app o
   * enlace) o puesta por la empresa con el pin. `recomendada`: la dirección escrita basta.
   */
  ubicacion: 'confirmada' | 'recomendada';
  /** Se invita (o exige) al destinatario a usar la app de Divoox para dar y seguir su ubicación. */
  appDestinatario: 'esperada' | 'opcional';
  /** Documento del destinatario (cédula o RIF en Venezuela). El patrón se aplica sin guiones. */
  documento: { pide: boolean; ejemplo: string; patron: RegExp | null };
  telefono: { prefijo: string; ejemplo: string };
  /** Puntos de referencia («frente a la panadería») obligatorios al confirmar. */
  referenciasObligatorias: boolean;
  /** Centro del mapa al marcar el pin si no hay ubicación del teléfono. */
  centroMapa: { lat: number; lng: number };
};

export const PERFILES_FLEX: Record<PaisFlex, PerfilFlex> = {
  VE: {
    pais: 'VE',
    nombre: { es: 'Venezuela', en: 'Venezuela' },
    monedas: ['USD', 'VES'],
    pagos: ['pago_movil', 'transferencia', 'efectivo_usd', 'efectivo_ves', 'zelle', 'binance'],
    cobroContraEntrega: true,
    ubicacion: 'confirmada',
    appDestinatario: 'esperada',
    documento: { pide: true, ejemplo: 'V-12345678', patron: /^[VEJGP]\d{6,10}$/i },
    telefono: { prefijo: '+58', ejemplo: '0414-0000000' },
    referenciasObligatorias: true,
    centroMapa: { lat: 10.4806, lng: -66.9036 },
  },
  US: {
    pais: 'US',
    nombre: { es: 'Estados Unidos', en: 'United States' },
    monedas: ['USD'],
    pagos: ['tarjeta'],
    cobroContraEntrega: false,
    ubicacion: 'recomendada',
    appDestinatario: 'opcional',
    documento: { pide: false, ejemplo: '', patron: null },
    telefono: { prefijo: '+1', ejemplo: '(305) 000-0000' },
    referenciasObligatorias: false,
    centroMapa: { lat: 25.7617, lng: -80.1918 },
  },
};

export function perfilFlex(pais: string | null | undefined): PerfilFlex {
  return pais === 'VE' ? PERFILES_FLEX.VE : PERFILES_FLEX.US;
}

/**
 * El teléfono en formato internacional (solo dígitos, con el código del país), para encontrar al
 * destinatario en Divoox aunque la empresa lo escriba «0414-…», «+58 414…» o «(305) …».
 */
export function telefonoInternacional(texto: string, pais: string): string {
  const d = texto.replace(/\D/g, '');
  if (!d) return '';
  if (pais === 'VE') {
    if (d.startsWith('58') && d.length === 12) return d;
    if (d.startsWith('0') && d.length === 11) return `58${d.slice(1)}`;
    if (d.length === 10 && d.startsWith('4')) return `58${d}`;
    return d;
  }
  if (d.length === 10) return `1${d}`;
  return d;
}

/** Estados de la ubicación de un envío (C-FLEX-UBICACION). */
export const ESTADOS_UBICACION = ['sin_coordenadas', 'pendiente', 'confirmada'] as const;
export type EstadoUbicacion = (typeof ESTADOS_UBICACION)[number];
export const FUENTES_UBICACION = [
  'empresa',
  'importacion',
  'app_cliente',
  'enlace_destinatario',
] as const;
export type FuenteUbicacion = (typeof FUENTES_UBICACION)[number];

/** ¿Puede este envío entrar a una ruta en su país? Devuelve el motivo si no. */
export function puedeEntrarARuta(
  pais: string,
  envio: { ubicacionEstado: string; lat: number | null; lng: number | null },
): { ok: true } | { ok: false; motivo: 'sin_ubicacion_confirmada' } {
  if (perfilFlex(pais).ubicacion !== 'confirmada') return { ok: true };
  return envio.ubicacionEstado === 'confirmada' && envio.lat != null && envio.lng != null
    ? { ok: true }
    : { ok: false, motivo: 'sin_ubicacion_confirmada' };
}

const ALFABETO_PLUS = '23456789CFGHJMPQRVWX';
/**
 * Código plus (Open Location Code, estándar abierto de Google, licencia Apache 2.0): el punto exacto
 * en 10 caracteres («7FG49QCJ+2V»), legible en voz alta y que Google Maps entiende sin internet. En
 * Venezuela, donde no hay direcciones formales, va en la etiqueta (investigación del 28 oct 2026).
 */
export function codigoPlus(lat: number, lng: number): string {
  const precision = 8000; // 5 pares de dígitos: 1/8000 de grado ≈ 14 m
  let la = Math.min(Math.max(lat, -90), 90) + 90;
  if (la >= 180) la = 180 - 1 / precision;
  const lo = (((lng + 180) % 360) + 360) % 360;
  let latEnt = Math.floor(la * precision);
  let lngEnt = Math.floor(lo * precision);
  let codigo = '';
  for (let i = 0; i < 5; i++) {
    codigo = `${ALFABETO_PLUS.charAt(latEnt % 20)}${ALFABETO_PLUS.charAt(lngEnt % 20)}${codigo}`;
    latEnt = Math.floor(latEnt / 20);
    lngEnt = Math.floor(lngEnt / 20);
  }

  return `${codigo.slice(0, 8)}+${codigo.slice(8)}`;
}

/** ¿El documento tiene la forma del país? (cédula V-12345678 o RIF J-12345678-9 en Venezuela). */
export function documentoValido(pais: string, texto: string): boolean {
  const p = perfilFlex(pais).documento.patron;
  return !p || p.test(texto.replace(/[\s.-]/g, ''));
}

/**
 * C-FLEX-RETIRO: el último día para retirar en el punto, contando días hábiles (lunes a viernes)
 * desde que el paquete queda disponible. MRW da 5 días hábiles en agencia; después vuelve al origen.
 */
export function venceRetiro(desde: Date, diasHabiles = 5): string {
  const d = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate()));
  let quedan = diasHabiles;
  while (quedan > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dia = d.getUTCDay();
    if (dia !== 0 && dia !== 6) quedan--;
  }
  return d.toISOString().slice(0, 10);
}

/** La cédula o el RIF para comparar (sin puntos, guiones ni espacios, en mayúscula). */
export const documentoNormal = (t: string) => t.replace(/[\s.-]/g, '').toUpperCase();

/**
 * C-EMPRESA-LEGAL (31 oct 2026, LG1): el número fiscal de la empresa según su país, como lo piden
 * Uber Direct y DoorDash Drive al registrar un negocio. EE. UU.: EIN (12-3456789). Venezuela: RIF
 * (J-12345678-9). Colombia: NIT (900123456-7). México: RFC (ABC123456XYZ).
 */
const FISCAL: Record<string, { nombre: string; ejemplo: string; patron: RegExp }> = {
  US: { nombre: 'EIN', ejemplo: '12-3456789', patron: /^\d{9}$/ },
  VE: { nombre: 'RIF', ejemplo: 'J-12345678-9', patron: /^[JGVEPC]\d{9}$/ },
  CO: { nombre: 'NIT', ejemplo: '900123456-7', patron: /^\d{9,10}$/ },
  MX: { nombre: 'RFC', ejemplo: 'ABC123456XYZ', patron: /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/ },
  // C-PERFIL-CHILE: el RUT se valida además con su dígito verificador (rutValido).
  CL: { nombre: 'RUT', ejemplo: '12.345.678-5', patron: /^\d{7,8}[\dK]$/ },
};

export function numeroFiscalDe(pais: string): { nombre: string; ejemplo: string } {
  const f = new Map(Object.entries(FISCAL)).get(pais.toUpperCase());
  return f ? { nombre: f.nombre, ejemplo: f.ejemplo } : { nombre: 'Tax ID', ejemplo: '' };
}

/** ¿El número fiscal tiene la forma del país? (se compara sin guiones, puntos ni espacios). */
export function numeroFiscalValido(pais: string, texto: string): boolean {
  const f = new Map(Object.entries(FISCAL)).get(pais.toUpperCase());
  const limpio = texto.replace(/[\s.-]/g, '').toUpperCase();
  if (pais.toUpperCase() === 'CL') return Boolean(f?.patron.test(limpio)) && rutValido(limpio);
  return f ? f.patron.test(limpio) : limpio.length >= 5;
}
