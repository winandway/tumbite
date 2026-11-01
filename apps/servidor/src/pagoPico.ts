import { geohash } from '@tumbite/compartido';

/**
 * C-PAGO-PICO (D7, 1 nov 2026, como el «Peak Pay» de DoorDash y los «Boost» de Uber): en una zona
 * con mucha demanda (la misma celda que el mapa marca en rojo) cada oferta lleva un pago extra que
 * pone Divoox y se cobra al entregar, como el bono de la oferta abierta (tabla bonos_pedido).
 * Arranca APAGADO: monto y presupuesto diario en cero hasta que el equipo los fije en el superadmin.
 */
export const PRECISION_CELDA = 6;
export const PEDIDOS_DEMANDA_ALTA = 5;

export type AjustesPagoPico = { centavos: number; presupuestoDiaCentavos: number };
export const PAGO_PICO_INICIAL: AjustesPagoPico = { centavos: 0, presupuestoDiaCentavos: 0 };

export async function leerPagoPico(db: D1Database): Promise<AjustesPagoPico> {
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'pago_pico'")
    .first<{ valor: string }>();
  if (!f) return PAGO_PICO_INICIAL;
  try {
    return { ...PAGO_PICO_INICIAL, ...(JSON.parse(f.valor) as Partial<AjustesPagoPico>) };
  } catch (e) {
    console.error('pago pico: ajustes ilegibles, queda apagado', e);
    return PAGO_PICO_INICIAL;
  }
}

/** Lo que ya se comprometió hoy en pagos pico (UTC), contra el presupuesto del día. */
async function gastadoHoy(db: D1Database) {
  const f = await db
    .prepare(
      "SELECT COALESCE(SUM(centavos), 0) AS n FROM bonos_pedido WHERE motivo = 'hora_pico' AND creado_en >= date('now')",
    )
    .first<{ n: number }>();
  return Number(f?.n ?? 0);
}

/** ¿Queda presupuesto hoy para un pago pico más? Devuelve el monto, o 0 si está apagado o agotado. */
export async function montoPicoDisponible(db: D1Database): Promise<number> {
  const a = await leerPagoPico(db);
  if (a.centavos <= 0 || a.presupuestoDiaCentavos <= 0) return 0;
  return (await gastadoHoy(db)) + a.centavos <= a.presupuestoDiaCentavos ? a.centavos : 0;
}

/** El pago pico que le toca a un local (por su celda) ahora mismo, o 0. */
export async function pagoPicoPara(
  db: D1Database,
  zonaId: string,
  lat: number | null,
  lng: number | null,
): Promise<number> {
  if (lat == null || lng == null) return 0;
  const monto = await montoPicoDisponible(db);
  if (!monto) return 0;
  const celda = geohash(lat, lng, PRECISION_CELDA);
  const { results } = await db
    .prepare(
      `SELECT r.lat, r.lng FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
        WHERE r.zona_id = ? AND r.lat IS NOT NULL AND r.lng IS NOT NULL
          AND p.estado IN ('pagado','aceptado','listo','en_camino','entregado')
          AND p.creado_en >= datetime('now', '-60 minutes')
        LIMIT 5000`,
    )
    .bind(zonaId)
    .all<{ lat: number; lng: number }>();
  const enCelda = results.filter(
    (f) => geohash(Number(f.lat), Number(f.lng), PRECISION_CELDA) === celda,
  ).length;
  return enCelda >= PEDIDOS_DEMANDA_ALTA ? monto : 0;
}
