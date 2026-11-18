import { type Idioma, contar } from '@tumbite/compartido';

/**
 * C-GANANCIAS-COHERENTES (18 nov 2026, tercera auditoría de tiendas): la tarjeta «Total de hoy» de
 * Ganancias. El total suma todo lo ganado (entregas, propinas, bonos y regalos de Divoox); las
 * entregas son los pedidos de comida entregados, como en la tarjeta de Hoy del inicio y en el
 * desglose de abajo. Un regalo de Divoox no es una entrega: decía «1 entregas» con «Total · 0
 * entregas» debajo.
 *
 * C-GANANCIAS-CARRERAS (revisor, 18 nov 2026): lo que pagó con tarjeta el pasajero de un viaje de
 * Moto, Carro o Envíos llega como «entrega» SIN pedido (viajesCobro.ts). Antes del arreglo anterior
 * contaba por `pedidoId ?? id`; con «solo con pedido» un conductor de viajes veía «Total $X · 0
 * entregas». Ahora cada uno cuenta como lo que es: entregas (pedidos) y carreras (viajes), como Uber
 * Driver («trips») y DoorDash («deliveries»).
 *
 * La billetera es siempre en USD: la tabla de movimientos no lleva moneda y todo lo que escribe en
 * ella es en dólares (Stripe de EE. UU. y los regalos de Divoox, también en Venezuela).
 */
export type MovimientoGanancia = {
  id: string;
  monto: number;
  concepto: string;
  pedidoId?: string | null;
  /**
   * El viaje (Moto, Carro, Envíos) al que pertenece el movimiento: su cobro con tarjeta o el regalo
   * de Divoox que lo pagó. Un viaje es UNA carrera aunque tenga varios movimientos.
   */
  operacionId?: string | null;
};

export function resumenPeriodo(movs: MovimientoGanancia[]): {
  total: number;
  entregas: number;
  carreras: number;
  regalos: number;
} {
  const ganado = movs.filter((m) => m.concepto !== 'retiro' && m.monto > 0);
  const deTrabajo = ganado.filter((m) => m.concepto === 'entrega');
  const entregados = new Set(deTrabajo.filter((m) => m.pedidoId).map((m) => m.pedidoId));
  // Robot (18 nov 2026): un viaje pagado entero con regalo no tiene «entrega»; su regalo dice el
  // viaje. Cada viaje cuenta una vez; una «entrega» sin pedido ni viaje (servidor viejo), por su id.
  const carreras = new Set([
    ...ganado
      .filter((m) => (m.concepto === 'entrega' || m.concepto === 'regalo') && m.operacionId)
      .map((m) => `v:${m.operacionId}`),
    ...deTrabajo.filter((m) => !m.pedidoId && !m.operacionId).map((m) => `m:${m.id}`),
  ]);
  return {
    total: ganado.reduce((x, m) => x + m.monto, 0),
    entregas: entregados.size,
    carreras: carreras.size,
    regalos: ganado.filter((m) => m.concepto === 'regalo').reduce((x, m) => x + m.monto, 0),
  };
}

/** «3 entregas», «1 carrera» o, si el periodo mezcla, «2 entregas · 1 carrera». */
export function textoTrabajos(entregas: number, carreras: number, idioma: Idioma): string {
  if (!carreras) return contar(entregas, 'entrega', idioma);
  if (!entregas) return contar(carreras, 'carrera', idioma);
  return `${contar(entregas, 'entrega', idioma)} · ${contar(carreras, 'carrera', idioma)}`;
}
