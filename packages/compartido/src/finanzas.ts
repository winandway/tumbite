import { z } from 'zod';

/**
 * Divoox · Fase 4 de Flex: capa COMÚN de políticas financieras (C-FIN-POLITICAS).
 *
 * Una política dice cómo cobra Divoox en un mercado: a quién (empresa o conductor), en qué servicio
 * (flex, express, food, ride…), país, ciudad, empresa, moneda, con qué modalidad (saldo prepago,
 * Stripe Connect o sin cobro) y con qué regla. Ninguna cifra vive en el código: todas salen de una
 * política guardada por el superadmin. Puro: lo usan el servidor, el panel y las pruebas.
 *
 * Montos SIEMPRE en la unidad menor de la moneda (centavos), enteros. Porcentajes en puntos base
 * (100 pb = 1 %). Redondeo: al centavo más cercano (la mitad hacia arriba).
 */

export const SERVICIOS_FINANCIEROS = ['flex', 'express', 'food', 'ride', 'car', 'grocery'] as const;
export type ServicioFinanciero = (typeof SERVICIOS_FINANCIEROS)[number];
export const TIPOS_CUENTA = ['empresa', 'conductor'] as const;
export const MODALIDADES = ['prepago', 'connect', 'sin_cobro'] as const;

export const esquemaRegla = z.discriminatedUnion('tipo', [
  /** Monto fijo por cada unidad facturable (un paquete entregado). */
  z.object({ tipo: z.literal('por_paquete'), monto: z.number().int().min(0) }),
  /** Monto fijo por ruta cerrada (sin importar cuántos paquetes). */
  z.object({ tipo: z.literal('por_ruta'), monto: z.number().int().min(0) }),
  /** Porcentaje del valor de la operación, con mínimo y máximo opcionales por operación. */
  z.object({
    tipo: z.literal('porcentaje'),
    pb: z.number().int().min(0).max(10_000),
    minimo: z.number().int().min(0).optional(),
    maximo: z.number().int().min(0).optional(),
  }),
  /** Por paquete, según el volumen del mes: gana el tramo con el «desde» más alto alcanzado. */
  z.object({
    tipo: z.literal('volumen'),
    tramos: z
      .array(z.object({ desde: z.number().int().min(0), monto: z.number().int().min(0) }))
      .min(1)
      .max(20),
  }),
  /** Exención: no se cobra nada (promoción total o acuerdo comercial). */
  z.object({ tipo: z.literal('exenta') }),
]);
export type ReglaComision = z.infer<typeof esquemaRegla>;

export type PoliticaFinanciera = {
  id: string;
  servicio: ServicioFinanciero;
  tipoCuenta: (typeof TIPOS_CUENTA)[number];
  /** País ISO de dos letras o «*» (todos). */
  pais: string;
  ciudad: string | null;
  empresaId: string | null;
  modalidad: (typeof MODALIDADES)[number];
  moneda: string;
  regla: ReglaComision;
  /** Promoción: descuento sobre la comisión calculada, en puntos base (0 a 10000). */
  descuentoPb: number;
  /** Fechas en UTC «AAAA-MM-DD HH:MM:SS». Hasta = null: sin fin. */
  vigenteDesde: string;
  vigenteHasta: string | null;
  prioridad: number;
  activa: boolean;
  /** Para conductores en modalidad prepago: sin revisión legal y comercial aprobada no rige. */
  revisionLegalAprobada: boolean;
};

export type ContextoCobro = {
  servicio: ServicioFinanciero;
  tipoCuenta: (typeof TIPOS_CUENTA)[number];
  pais: string;
  ciudad?: string | null;
  empresaId?: string | null;
  moneda: string;
  /** Momento de la operación (UTC «AAAA-MM-DD HH:MM:SS»). */
  en: string;
};

const vigente = (p: PoliticaFinanciera, en: string) =>
  p.vigenteDesde <= en && (p.vigenteHasta === null || en < p.vigenteHasta);

/** Cuanto más específica, más manda: empresa > ciudad > país > todos. */
const especificidad = (p: PoliticaFinanciera) =>
  (p.empresaId ? 8 : 0) + (p.ciudad ? 4 : 0) + (p.pais !== '*' ? 2 : 0);

/**
 * La política que rige para una operación, o null (sin política = Divoox no cobra nada; nunca se
 * inventa una tarifa). Empate: la de mayor prioridad y, después, la que empezó a regir más tarde.
 */
export function elegirPolitica(
  politicas: readonly PoliticaFinanciera[],
  c: ContextoCobro,
): PoliticaFinanciera | null {
  const ciudad = c.ciudad?.trim().toLowerCase() || null;
  const candidatas = politicas.filter(
    (p) =>
      p.activa &&
      p.servicio === c.servicio &&
      p.tipoCuenta === c.tipoCuenta &&
      (p.pais === '*' || p.pais === c.pais) &&
      (!p.ciudad || p.ciudad.toLowerCase() === ciudad) &&
      (!p.empresaId || p.empresaId === c.empresaId) &&
      p.moneda.toUpperCase() === c.moneda.toUpperCase() &&
      vigente(p, c.en) &&
      // Prepago de conductores: solo con revisión legal y comercial del mercado aprobada.
      !(p.tipoCuenta === 'conductor' && p.modalidad === 'prepago' && !p.revisionLegalAprobada),
  );
  candidatas.sort(
    (a, b) =>
      especificidad(b) - especificidad(a) ||
      b.prioridad - a.prioridad ||
      (a.vigenteDesde < b.vigenteDesde ? 1 : a.vigenteDesde > b.vigenteDesde ? -1 : 0),
  );
  return candidatas[0] ?? null;
}

const redondear = (n: number) => Math.floor(n + 0.5);
/** Precio con descuento, redondeado al centavo (se redondea el precio final, no el descuento). */
const aplicarDescuento = (monto: number, descuentoPb: number) =>
  descuentoPb > 0 ? Math.max(0, redondear((monto * (10_000 - descuentoPb)) / 10_000)) : monto;

/**
 * Monto POR UNIDAD de una regla por paquete o por volumen (lo que se congela en la ruta).
 * `volumenPrevio` = unidades ya facturadas en el periodo (el mes) antes de esta operación.
 */
export function tarifaUnitaria(
  regla: ReglaComision,
  opciones: { volumenPrevio?: number; descuentoPb?: number } = {},
): number {
  let base = 0;
  if (regla.tipo === 'por_paquete') base = regla.monto;
  else if (regla.tipo === 'volumen') {
    const alcanzado = (opciones.volumenPrevio ?? 0) + 1;
    const tramo = [...regla.tramos]
      .sort((a, b) => b.desde - a.desde)
      .find((t) => t.desde <= alcanzado);
    base = tramo?.monto ?? 0;
  }
  return aplicarDescuento(base, opciones.descuentoPb ?? 0);
}

/**
 * Comisión de una operación completa. `unidades` = paquetes facturables (entregados); `valor` = el
 * valor de la operación, solo para la regla porcentual (sin valor, la porcentual cobra 0).
 */
export function calcularComision(
  regla: ReglaComision,
  p: { unidades: number; valor?: number; volumenPrevio?: number; descuentoPb?: number },
): number {
  const unidades = Math.max(0, Math.floor(p.unidades));
  const desc = p.descuentoPb ?? 0;
  switch (regla.tipo) {
    case 'exenta':
      return 0;
    case 'por_paquete':
    case 'volumen':
      return (
        tarifaUnitaria(regla, { volumenPrevio: p.volumenPrevio, descuentoPb: desc }) * unidades
      );
    case 'por_ruta':
      return unidades > 0 ? aplicarDescuento(regla.monto, desc) : 0;
    case 'porcentaje': {
      if (!p.valor || p.valor <= 0) return 0;
      let m = redondear((p.valor * regla.pb) / 10_000);
      if (regla.minimo !== undefined) m = Math.max(m, regla.minimo);
      if (regla.maximo !== undefined) m = Math.min(m, regla.maximo);
      return aplicarDescuento(m, desc);
    }
  }
}

/**
 * Lo que se APARTA antes de salir: por paquete o volumen, la tarifa congelada × paquetes; por ruta,
 * el monto de la ruta; porcentual sin valor conocido, 0 (se cobra al final si hay valor).
 */
export function comisionEstimada(
  regla: ReglaComision,
  p: { paquetes: number; volumenPrevio?: number; descuentoPb?: number; valor?: number },
): number {
  return calcularComision(regla, {
    unidades: p.paquetes,
    valor: p.valor,
    volumenPrevio: p.volumenPrevio,
    descuentoPb: p.descuentoPb,
  });
}

/**
 * Servicio logístico completo (la empresa contrata conductores Divoox): el precio NUNCA se mezcla.
 * La comisión tecnológica de Divoox no cubre el transporte físico. Todas las cifras entran como
 * parámetros (las fija una política comercial); aquí solo se suman y se separan.
 */
export type ParametrosLogisticos = {
  paquetes: number;
  /** Comisión tecnológica de Divoox por paquete. */
  tecnologiaPorPaquete: number;
  /** Precio del transporte físico por paquete (lo que paga la empresa por mover el paquete). */
  transportePorPaquete: number;
  /** Parte del transporte que va al conductor, en puntos base. */
  conductorPb: number;
  /** Comisión estimada del procesador de pagos: puntos base + fijo por cobro. */
  procesadorPb: number;
  procesadorFijo: number;
  /** Impuesto aplicable sobre (tecnología + transporte), en puntos base; 0 si no aplica. */
  impuestoPb: number;
};

export type DesgloseLogistico = {
  tecnologiaDivoox: number;
  transporte: number;
  remuneracionConductor: number;
  margenTransporteDivoox: number;
  procesadorPagos: number;
  impuestos: number;
  totalEmpresa: number;
};

export function desgloseServicioLogistico(p: ParametrosLogisticos): DesgloseLogistico {
  const n = Math.max(0, Math.floor(p.paquetes));
  const tecnologiaDivoox = p.tecnologiaPorPaquete * n;
  const transporte = p.transportePorPaquete * n;
  const remuneracionConductor = redondear((transporte * p.conductorPb) / 10_000);
  const impuestos = redondear(((tecnologiaDivoox + transporte) * p.impuestoPb) / 10_000);
  const subtotal = tecnologiaDivoox + transporte + impuestos;
  const procesadorPagos =
    subtotal > 0 ? redondear((subtotal * p.procesadorPb) / 10_000) + p.procesadorFijo : 0;
  return {
    tecnologiaDivoox,
    transporte,
    remuneracionConductor,
    margenTransporteDivoox: transporte - remuneracionConductor,
    procesadorPagos,
    impuestos,
    // El procesador lo absorbe Divoox de su parte (no se le suma a la empresa): queda separado.
    totalEmpresa: subtotal,
  };
}

/**
 * C-CANCELACION-POLITICA (29 oct 2026): qué parte de la comisión apartada se queda Divoox cuando una
 * operación se cancela, según la etapa. Sin política (o «liberar») vuelve TODO al prepago del
 * conductor, que es lo de siempre. Nunca se queda más de lo apartado.
 */
const tramoCancelacion = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('liberar') }),
  z.object({ tipo: z.literal('porcentaje'), pb: z.number().int().min(0).max(10_000) }),
  z.object({ tipo: z.literal('fijo'), monto: z.number().int().min(0) }),
]);
export const esquemaCancelacion = z.object({
  antesDeRecoger: tramoCancelacion,
  despuesDeRecoger: tramoCancelacion,
});
export type ReglaCancelacion = z.infer<typeof esquemaCancelacion>;

export function comisionPorCancelacion(
  regla: ReglaCancelacion | null,
  p: { apartado: number; recogido: boolean },
): number {
  const apartado = Math.max(0, Math.floor(p.apartado));
  if (!regla || apartado === 0) return 0;
  const t = p.recogido ? regla.despuesDeRecoger : regla.antesDeRecoger;
  if (t.tipo === 'liberar') return 0;
  const m = t.tipo === 'fijo' ? t.monto : Math.floor((apartado * t.pb) / 10_000 + 0.5);
  return Math.min(apartado, Math.max(0, m));
}
