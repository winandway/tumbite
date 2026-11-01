/**
 * C-GANAR-POR-TIEMPO (R-T1, 1 nov 2026, como «Earn by Time» de DoorDash; evidencia REA
 * ev_a50085e6…, página pública de pago de Dasher): al conectarse, el repartidor elige cobrar por
 * oferta (lo de siempre) o por tiempo: un mínimo garantizado por hora activa, desde que acepta
 * hasta que entrega, más un monto por milla. Propinas y pago por hora pico van aparte. Arranca
 * APAGADO: tarifa en cero hasta que el equipo la fije en el superadmin.
 */
export type AjustesPorTiempo = { centavosHora: number; centavosMilla: number };
export const POR_TIEMPO_INICIAL: AjustesPorTiempo = { centavosHora: 0, centavosMilla: 0 };

export async function leerPorTiempo(db: D1Database): Promise<AjustesPorTiempo> {
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'ganar_por_tiempo'")
    .first<{ valor: string }>();
  if (!f) return POR_TIEMPO_INICIAL;
  try {
    return { ...POR_TIEMPO_INICIAL, ...(JSON.parse(f.valor) as Partial<AjustesPorTiempo>) };
  } catch (e) {
    console.error('ganar por tiempo: ajustes ilegibles, queda apagado', e);
    return POR_TIEMPO_INICIAL;
  }
}

/** El garantizado de una entrega: minutos activos a la tarifa por hora, más millas a la tarifa por milla. */
export function garantizadoPorTiempo(
  minutos: number,
  km: number,
  t: { centavosHora: number; centavosMilla: number },
): number {
  const millas = Math.max(0, km) * 0.621371;
  return Math.round((t.centavosHora * Math.max(0, minutos)) / 60 + t.centavosMilla * millas);
}

/** Al aceptar: si el repartidor está en modo «por tiempo» y está encendido, se anota el pedido. */
export async function anotarPorTiempo(db: D1Database, pedidoId: string, repartidorId: string) {
  const t = await leerPorTiempo(db);
  if (t.centavosHora <= 0) return;
  const r = await db
    .prepare('SELECT modo_pago FROM repartidores WHERE usuario_id = ?')
    .bind(repartidorId)
    .first<{ modo_pago: string | null }>();
  if (r?.modo_pago !== 'tiempo') return;
  await db
    .prepare(
      'INSERT OR IGNORE INTO pagos_por_tiempo (pedido_id, repartidor_id, centavos_hora, centavos_milla) VALUES (?, ?, ?, ?)',
    )
    .bind(pedidoId, repartidorId, t.centavosHora, t.centavosMilla)
    .run();
}

/**
 * Al entregar: lo que le falte para llegar al garantizado se suma al bono del pedido (el mismo
 * camino que el pago pico y la oferta abierta, que ya cuentan la liquidación y la conciliación).
 * Devuelve lo sumado (0 si no aplica).
 */
export async function completarPorTiempo(
  db: D1Database,
  pedidoId: string,
  repartidorId: string,
  pagoBase: number,
  bono: number,
  km: number,
): Promise<number> {
  const f = await db
    .prepare(
      `SELECT centavos_hora, centavos_milla,
              (julianday('now') - julianday(aceptado_en)) * 1440 AS minutos
         FROM pagos_por_tiempo WHERE pedido_id = ? AND repartidor_id = ? AND complemento IS NULL`,
    )
    .bind(pedidoId, repartidorId)
    .first<{ centavos_hora: number; centavos_milla: number; minutos: number }>();
  if (!f) return 0;
  const garantizado = garantizadoPorTiempo(Number(f.minutos), km, {
    centavosHora: Number(f.centavos_hora),
    centavosMilla: Number(f.centavos_milla),
  });
  const extra = Math.max(0, garantizado - pagoBase - bono);
  await db.batch([
    db
      .prepare('UPDATE pagos_por_tiempo SET garantizado = ?, complemento = ? WHERE pedido_id = ?')
      .bind(garantizado, extra, pedidoId),
    ...(extra > 0
      ? [
          db
            .prepare(
              `INSERT INTO bonos_pedido (pedido_id, centavos, motivo) VALUES (?1, ?2, 'por_tiempo')
               ON CONFLICT(pedido_id) DO UPDATE SET centavos = centavos + ?2`,
            )
            .bind(pedidoId, extra),
        ]
      : []),
  ]);
  return extra;
}
