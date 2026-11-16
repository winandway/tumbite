/**
 * C-CONCILIACION-VIAJES (16 nov 2026, todos los países): la conciliación diaria de los viajes pagados
 * con tarjeta (Moto, Carro, Envíos de persona a persona). La de los pedidos (`conciliar`) deja fuera lo
 * que no es de un pedido, así que hasta hoy nadie comprobaba que lo cobrado en Stripe por un viaje
 * llegara entero al conductor. Obligatoria antes de encender viajes con tarjeta en producción.
 *
 * Reglas por cada cobro de viaje tocado ese día (`cobros_viaje.actualizado_en`):
 * 1) lo capturado nunca pasa de lo autorizado;
 * 2) lo capturado = lo abonado al conductor (movimiento «entrega» `viaje-tarjeta-…` o `cargo-viaje-…`);
 * 3) la propina cobrada = la propina abonada (movimiento «propina» `propina-viaje-…`);
 * 4) un viaje ya cerrado (terminado, cancelado, no se presentó, sin conductor) no deja la autorización
 *    abierta: es plata retenida en la tarjeta del pasajero que nadie cobró ni soltó;
 * 5) un viaje con tarjeta que terminó ese día tiene su cobro capturado (si no, se prestó el viaje gratis).
 *
 * Lecturas: solo las filas de ese día, por los índices `cobros_viaje_dia` y `viajes_tarjeta_terminados`
 * (los dos nacen en schema.sql); los movimientos van por `movimientos_usuario` (conductor y fecha del cobro
 * en adelante), nunca recorriendo la tabla.
 */
export type ConciliacionViajes = {
  viajes: number;
  capturado: number;
  propinas: number;
  cuadra: boolean;
  detalle: Record<string, number | string>;
};

const n = (v: unknown) => Number(v ?? 0);

/** El día (YYYY-MM-DD) y el siguiente, para filtrar por rango y poder usar los índices. */
function rango(dia: string) {
  const sig = new Date(`${dia}T00:00:00Z`);
  sig.setUTCDate(sig.getUTCDate() + 1);
  return { desde: `${dia} 00:00:00`, hasta: `${sig.toISOString().slice(0, 10)} 00:00:00` };
}

export async function conciliarViajes(db: D1Database, dia: string): Promise<ConciliacionViajes> {
  const { desde, hasta } = rango(dia);
  const { results } = await db
    .prepare(
      `SELECT c.operacion_id, c.estado, c.autorizado, c.capturado, c.propina, v.estado AS viaje,
         (SELECT COALESCE(SUM(m.monto), 0) FROM movimientos m
            WHERE m.usuario_id = o.conductor_id AND m.creado_en >= c.creado_en
              AND m.referencia IN ('viaje-tarjeta-' || c.operacion_id, 'cargo-viaje-' || c.operacion_id)
              AND m.concepto = 'entrega') AS al_conductor,
         (SELECT COALESCE(SUM(m.monto), 0) FROM movimientos m
            WHERE m.usuario_id = o.conductor_id AND m.creado_en >= c.creado_en
              AND m.referencia = 'propina-viaje-' || c.operacion_id AND m.concepto = 'propina') AS propina_abonada
         FROM cobros_viaje c JOIN viajes v ON v.operacion_id = c.operacion_id
         JOIN operaciones o ON o.id = c.operacion_id
        WHERE c.actualizado_en >= ?1 AND c.actualizado_en < ?2`,
    )
    .bind(desde, hasta)
    .all<Record<string, unknown>>();
  // Los que terminaron ese día con tarjeta y no tienen su cobro capturado (la regla 5).
  const { results: sinCobrar } = await db
    .prepare(
      `SELECT v.operacion_id, c.estado AS cobro
         FROM viajes v LEFT JOIN cobros_viaje c ON c.operacion_id = v.operacion_id
        WHERE v.metodo_pago = 'tarjeta' AND v.estado = 'terminado'
          AND v.terminado_en >= ?1 AND v.terminado_en < ?2
          AND COALESCE(v.total_final_centavos, 0) > 0
          AND COALESCE(c.estado, 'sin_cobro') != 'capturado'`,
    )
    .bind(desde, hasta)
    .all<{ operacion_id: string; cobro: string | null }>();

  const cerrados = new Set(['terminado', 'cancelado', 'no_show', 'sin_conductor']);
  const difs: string[] = [];
  let capturado = 0;
  let alConductor = 0;
  let propinas = 0;
  let propinasAbonadas = 0;
  for (const f of results) {
    const id = String(f.operacion_id);
    const cap = n(f.capturado);
    const abonado = n(f.al_conductor);
    capturado += cap;
    alConductor += abonado;
    propinas += n(f.propina);
    propinasAbonadas += n(f.propina_abonada);
    if (cap > n(f.autorizado)) difs.push(`${id}: capturado ${cap} > autorizado ${n(f.autorizado)}`);
    if (f.estado === 'capturado' && cap !== abonado)
      difs.push(`${id}: cobrado ${cap} ≠ abonado al conductor ${abonado}`);
    if (n(f.propina) !== n(f.propina_abonada))
      difs.push(`${id}: propina ${n(f.propina)} ≠ abonada ${n(f.propina_abonada)}`);
    if (f.estado === 'autorizado' && cerrados.has(String(f.viaje)))
      difs.push(`${id}: viaje ${String(f.viaje)} con la autorización todavía abierta`);
  }
  for (const s of sinCobrar)
    difs.push(`${s.operacion_id}: terminó con tarjeta y su cobro está «${s.cobro ?? 'sin_cobro'}»`);

  return {
    viajes: results.length,
    capturado,
    propinas,
    cuadra: difs.length === 0,
    detalle: {
      viajesRevisados: results.length,
      viajesCapturado: capturado,
      viajesAbonadoConductores: alConductor,
      viajesPropinas: propinas,
      viajesPropinasAbonadas: propinasAbonadas,
      cuadraViajes: difs.length === 0 ? 'sí' : 'NO',
      ...(difs.length ? { viajesDiferencias: difs.slice(0, 20).join(' | ') } : {}),
    },
  };
}
