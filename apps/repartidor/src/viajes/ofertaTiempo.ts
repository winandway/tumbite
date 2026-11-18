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

/**
 * C-OFERTA-VENCIDA-SE-CIERRA (robot, 18 nov 2026; todos los países): una oferta es la MISMA solo si
 * es el mismo viaje y el mismo vencimiento. La reoferta del mismo viaje (C-REOFERTA-VENCIDA) trae
 * otro `expiraEn`: es otra tarjeta, con su cuenta atrás desde el principio y su sonido.
 */
export function claveOferta(o: { operacionId: string; expiraEn: string }): string {
  return `${o.operacionId}@${o.expiraEn}`;
}

/**
 * La primera oferta que todavía se puede mostrar: fuera las que este teléfono ya vio llegar a 0 s
 * (la tarjeta se cierra sola en 0 s; no se queda pegada hasta la próxima vuelta del sondeo).
 */
export function ofertaParaMostrar<T extends { operacionId: string; expiraEn: string }>(
  ofertas: readonly T[],
  vencidasAqui: ReadonlySet<string>,
): T | null {
  return ofertas.find((o) => !vencidasAqui.has(claveOferta(o))) ?? null;
}
