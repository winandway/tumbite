import type { PagaComida } from './motivosCancelacion';

/**
 * C-DECISIONES-MERCADO (13 nov 2026, todos los países): tres decisiones que estaban anotadas sin
 * cerrar, cerradas con el estándar del mercado (regla de Richard «decidir como el mercado»). Son
 * VALORES Y REGLAS: nada de aquí enciende retiros, reembolsos automáticos ni mueve dinero por sí
 * solo. Ficha con fuentes: docs/investigaciones-rea/2026-11-13-decisiones-mercado.md.
 */

/**
 * Retiro mínimo a pedido, en la unidad menor. El mercado paga cada semana sin costo y cobra entre
 * 1,25 y 1,99 dólares por cada retiro inmediato (DoorDash Fast Pay, Uber Instant Pay). Divoox no
 * cobra por retirar; con un mínimo de 10 dólares, los 25 centavos que cobra Stripe por retiro
 * quedan en 2,5 % como mucho. Solo hay retiros en dólares (Stripe Connect, EE. UU.).
 */
const RETIRO_MINIMO = new Map<string, number>([['USD', 1_000]]);

export function retiroMinimo(moneda: string): number | null {
  return RETIRO_MINIMO.get(moneda) ?? null;
}

/**
 * Lo más que se devuelve SOLO, sin que lo mire una persona, por una queja de un plato que faltó,
 * vino mal o dañado (un reembolso automático por pedido). DoorDash y Uber Eats devuelven al
 * instante las quejas pequeñas y mandan a revisión las grandes. Cifras de
 * docs/DECISIONES-PREPARADAS-2026-10-19.md: 15 dólares en EE. UU., 30.000 pesos en Colombia y
 * 5 dólares en Venezuela. El interruptor del reembolso automático sigue apagado (es dinero).
 */
const TOPE_REEMBOLSO_SIN_REVISION = new Map<string, number>([
  ['US', 1_500],
  ['CO', 30_000],
  ['VE', 500],
]);

export function topeReembolsoSinRevision(pais: string): number | null {
  return TOPE_REEMBOLSO_SIN_REVISION.get(pais) ?? null;
}

/**
 * Pedido ya listo que se cancela: quién asume la comida preparada. Regla publicada de DoorDash para
 * comercios: el comercio cobra solo si había confirmado, la comida estaba hecha y la causa no fue
 * suya. Del lado del cliente, el mercado devuelve solo el envío y la propina cuando él cancela
 * después de que el restaurante confirmó. Igual en todos los países.
 */
export type ReglaComida = {
  clienteRecibe: 'todo' | 'envio_y_propina';
  restauranteCobraComida: boolean;
};

export const REGLA_COMIDA_LISTO: Record<Exclude<PagaComida, 'por_definir'>, ReglaComida> = {
  cliente: { clienteRecibe: 'envio_y_propina', restauranteCobraComida: true },
  restaurante: { clienteRecibe: 'todo', restauranteCobraComida: false },
  divoox: { clienteRecibe: 'todo', restauranteCobraComida: true },
};

export function repartoCancelacionListo(
  paga: Exclude<PagaComida, 'por_definir'>,
  p: { total: number; comida: number; envio: number; propina: number },
) {
  const regla =
    new Map(Object.entries(REGLA_COMIDA_LISTO)).get(paga) ?? REGLA_COMIDA_LISTO.restaurante;
  const devolver = regla.clienteRecibe === 'todo' ? p.total : p.envio + p.propina;
  return {
    reembolsoCliente: Math.max(0, Math.min(p.total, devolver)),
    comidaAlRestaurante: regla.restauranteCobraComida ? Math.max(0, p.comida) : 0,
    asumeComida: paga,
  };
}
