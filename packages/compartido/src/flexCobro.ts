import { z } from 'zod';

/**
 * Divoox Flex · Fase 6: COBRO CONTRA ENTREGA (C-FLEX-COBRO). País: Venezuela (perfil
 * `cobroContraEntrega`). Es la norma allá: MRW, Zoom, Tealca y Yummy cobran en destino y le
 * devuelven el dinero al comercio (docs/investigaciones-rea/2026-10-28-flex-venezuela.md).
 *
 * Divoox NO mueve ese dinero: es software. Registra lo que el conductor cobró (método, moneda,
 * monto y referencia), lo que le queda en la mano (efectivo en custodia) y cuándo la empresa lo
 * recibió al cerrar la caja. Montos en la unidad menor de cada moneda, enteros.
 */

export const METODOS_COBRO = [
  'efectivo_usd',
  'efectivo_ves',
  'pago_movil',
  'transferencia',
  'zelle',
  'punto_venta',
] as const;
export type MetodoCobro = (typeof METODOS_COBRO)[number];
export const MONEDAS_COBRO = ['USD', 'VES'] as const;
export type MonedaCobro = (typeof MONEDAS_COBRO)[number];

/** Los métodos que dejan efectivo en la mano del conductor (lo que entrega al cerrar la caja). */
export const METODOS_EFECTIVO: readonly MetodoCobro[] = ['efectivo_usd', 'efectivo_ves'];
/** Los que exigen la referencia del pago (para conciliar con el banco). */
export const METODOS_CON_REFERENCIA: readonly MetodoCobro[] = [
  'pago_movil',
  'transferencia',
  'zelle',
];
/** La moneda de cada método (punto de venta acepta las dos). */
const MONEDA_DEL_METODO: Partial<Record<MetodoCobro, MonedaCobro>> = {
  efectivo_usd: 'USD',
  efectivo_ves: 'VES',
  pago_movil: 'VES',
  transferencia: 'VES',
  zelle: 'USD',
};

export const esquemaCobroEntrega = z.object({
  metodo: z.enum(METODOS_COBRO),
  monto: z.number().int().positive().max(1_000_000_000),
  moneda: z.enum(MONEDAS_COBRO),
  referencia: z.string().trim().max(40).default(''),
});
export type CobroEntrega = z.infer<typeof esquemaCobroEntrega>;

export type ErrorCobro = 'moneda_del_metodo' | 'falta_referencia' | 'monto_incompleto';

/**
 * ¿El cobro registrado cuadra con lo que había que cobrar? En la misma moneda, el monto tiene que
 * ser al menos el pedido (el vuelto es aparte). En la otra moneda se acepta y queda marcado para
 * conciliar con la tasa del día (`otraMoneda`).
 */
export function validarCobro(
  esperado: { monto: number; moneda: string },
  c: CobroEntrega,
): { ok: true; otraMoneda: boolean } | { ok: false; error: ErrorCobro } {
  const propia = MONEDA_DEL_METODO[c.metodo];
  if (propia && propia !== c.moneda) return { ok: false, error: 'moneda_del_metodo' };
  if (METODOS_CON_REFERENCIA.includes(c.metodo) && c.referencia.length < 4)
    return { ok: false, error: 'falta_referencia' };
  if (c.moneda === esperado.moneda && c.monto < esperado.monto)
    return { ok: false, error: 'monto_incompleto' };
  return { ok: true, otraMoneda: c.moneda !== esperado.moneda };
}

/** Lo que el conductor tiene que entregar en efectivo al cerrar la caja, por moneda. */
export function efectivoEnMano(
  cobros: { metodo: string; monto: number; moneda: string; liquidado: boolean }[],
): Record<string, number> {
  const total: Record<string, number> = {};
  for (const c of cobros)
    if (!c.liquidado && (METODOS_EFECTIVO as readonly string[]).includes(c.metodo))
      total[c.moneda] = (total[c.moneda] ?? 0) + c.monto;
  return total;
}
