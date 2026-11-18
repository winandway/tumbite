/**
 * C-GANANCIAS-COHERENTES (18 nov 2026, tercera auditoría de tiendas): la tarjeta «Total de hoy» de
 * Ganancias. El total suma todo lo ganado (entregas, propinas, bonos y regalos de Divoox); las
 * entregas son SOLO pedidos entregados, como en la tarjeta de Hoy del inicio y en el desglose de
 * abajo. Un regalo de Divoox no es una entrega: decía «1 entregas» con «Total · 0 entregas» debajo.
 */
export type MovimientoGanancia = {
  id: string;
  monto: number;
  concepto: string;
  pedidoId?: string | null;
};

export function resumenPeriodo(movs: MovimientoGanancia[]): {
  total: number;
  entregas: number;
  regalos: number;
} {
  const ganado = movs.filter((m) => m.concepto !== 'retiro' && m.monto > 0);
  const entregados = new Set(
    ganado.filter((m) => m.concepto === 'entrega' && m.pedidoId).map((m) => m.pedidoId),
  );
  return {
    total: ganado.reduce((x, m) => x + m.monto, 0),
    entregas: entregados.size,
    regalos: ganado.filter((m) => m.concepto === 'regalo').reduce((x, m) => x + m.monto, 0),
  };
}
