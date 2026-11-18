/**
 * C-OFERTA-TIEMPO-REAL (18 nov 2026): cuándo vence una oferta EN ESTE TELÉFONO. Con los segundos que
 * dio el servidor, desde que llegó y con un segundo de margen (la respuesta tardó en llegar); así un
 * reloj del teléfono corrido no la da por vencida antes de tiempo. Sin ese dato, su hora.
 */
export function venceOferta(
  o: { segundosRestantes?: number; expiraEn: string },
  llegoEn: number,
): number {
  if (o.segundosRestantes != null) return llegoEn + Math.max(0, o.segundosRestantes - 1) * 1000;
  return new Date(`${o.expiraEn.replace(' ', 'T')}Z`).getTime();
}
