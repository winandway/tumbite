/**
 * C-ANUNCIOS (R-T2, 1 nov 2026, como «Sponsored Listings» de DoorDash; evidencia REA ev_a6fcb13f…,
 * página pública para comercios): el restaurante sale primero en el inicio con la etiqueta
 * «Patrocinado» y paga SOLO por los pedidos que llegan desde su anuncio, nunca por vistas ni
 * toques, con un presupuesto semanal que él fija. Arranca APAGADO: precio por pedido en cero hasta
 * que el equipo lo fije en el superadmin.
 *
 * El cobro es un movimiento 'ajuste' negativo en el saldo del dueño (referencia «anuncio:<campaña>»)
 * dentro del mismo lote de la entrega. No toca 'venta' ni los bonos: la conciliación queda igual.
 */
import { tarifasDeZona } from './internacional/tarifas';
import { ZONA_INICIAL } from './rutas/zonas';

export type AjustesAnuncios = { centavosPorPedido: number; maxEnLista: number };
export const ANUNCIOS_INICIAL: AjustesAnuncios = { centavosPorPedido: 0, maxEnLista: 2 };

export async function leerAnuncios(db: D1Database): Promise<AjustesAnuncios> {
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'anuncios'")
    .first<{ valor: string }>();
  if (!f) return ANUNCIOS_INICIAL;
  try {
    return { ...ANUNCIOS_INICIAL, ...(JSON.parse(f.valor) as Partial<AjustesAnuncios>) };
  } catch (e) {
    console.error('anuncios: ajustes ilegibles, quedan apagados', e);
    return ANUNCIOS_INICIAL;
  }
}

/** Lo gastado en los últimos siete días (la semana del presupuesto). */
const GASTO_SEMANA = `COALESCE((SELECT SUM(gasto) FROM anuncios_dia d
  WHERE d.campana_id = c.id AND d.dia >= date('now', '-6 days')), 0)`;

/**
 * De estos restaurantes, los que tienen una campaña activa con presupuesto disponible esta semana.
 * Devuelve restaurante → campaña. Vacío si los anuncios están apagados.
 */
export async function campanasVigentes(
  db: D1Database,
  restauranteIds: string[],
): Promise<Map<string, string>> {
  const a = await leerAnuncios(db);
  if (a.centavosPorPedido <= 0 || restauranteIds.length === 0) return new Map();
  const { results } = await db
    .prepare(
      `SELECT c.id, c.restaurante_id FROM campanas_anuncio c
        WHERE c.activa = 1 AND c.presupuesto_semanal > 0
          AND c.restaurante_id IN (SELECT value FROM json_each(?))
          AND ${GASTO_SEMANA} + ? <= c.presupuesto_semanal`,
    )
    .bind(JSON.stringify(restauranteIds), a.centavosPorPedido)
    .all<{ id: string; restaurante_id: string }>();
  return new Map(results.map((r) => [r.restaurante_id, r.id]));
}

/**
 * Pone primero hasta `maxEnLista` restaurantes patrocinados (abiertos), marcados con
 * `patrocinado: true` y su `anuncioId`, y anota las impresiones del día. El resto queda igual.
 */
export async function conPatrocinados<
  T extends { id: string; abiertoAhora?: boolean | null | undefined },
>(db: D1Database, lista: T[]): Promise<(T & { patrocinado?: boolean; anuncioId?: string })[]> {
  const vigentes = await campanasVigentes(
    db,
    lista.filter((r) => r.abiertoAhora !== false).map((r) => r.id),
  );
  if (vigentes.size === 0) return lista;
  const { maxEnLista } = await leerAnuncios(db);
  const arriba = lista.filter((r) => vigentes.has(r.id)).slice(0, Math.max(0, maxEnLista));
  if (arriba.length === 0) return lista;
  const elegidos = new Set(arriba.map((r) => r.id));
  await db.batch(
    arriba.map((r) =>
      db
        .prepare(
          `INSERT INTO anuncios_dia (campana_id, dia, impresiones) VALUES (?, date('now'), 1)
           ON CONFLICT(campana_id, dia) DO UPDATE SET impresiones = impresiones + 1`,
        )
        .bind(vigentes.get(r.id)),
    ),
  );
  return [
    ...arriba.map((r) => ({ ...r, patrocinado: true, anuncioId: vigentes.get(r.id)! })),
    ...lista.filter((r) => !elegidos.has(r.id)),
  ];
}

/** Un toque en el anuncio (solo estadística: nunca se cobra por toques). */
export async function anotarToque(db: D1Database, campanaId: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO anuncios_dia (campana_id, dia, toques)
       SELECT id, date('now'), 1 FROM campanas_anuncio WHERE id = ?
       ON CONFLICT(campana_id, dia) DO UPDATE SET toques = toques + 1`,
    )
    .bind(campanaId)
    .run();
}

/**
 * Al crear el pedido: si llegó desde un anuncio vigente de ESE restaurante, se anota con el precio
 * de hoy. Un id de campaña ajeno, apagado o sin presupuesto se ignora (el pedido sigue igual).
 */
export async function anotarPedidoDeAnuncio(
  db: D1Database,
  pedidoId: string,
  restauranteId: string,
  campanaId: string | undefined,
): Promise<void> {
  if (!campanaId) return;
  const vigentes = await campanasVigentes(db, [restauranteId]);
  if (vigentes.get(restauranteId) !== campanaId) return;
  const { centavosPorPedido } = await leerAnuncios(db);
  await db
    .prepare(
      'INSERT OR IGNORE INTO pedidos_anuncio (pedido_id, campana_id, centavos) VALUES (?, ?, ?)',
    )
    .bind(pedidoId, campanaId, centavosPorPedido)
    .run();
}

/**
 * Para el lote de la entrega: cobra el anuncio al dueño (ajuste negativo), suma el pedido y el
 * gasto al día de la campaña y lo marca cobrado. Si el pedido no vino de un anuncio, no hace nada.
 */
export function sentenciasCobroAnuncio(
  db: D1Database,
  pedidoId: string,
  duenoId: string,
  movimientoId: string,
): D1PreparedStatement[] {
  return [
    db
      .prepare(
        `INSERT OR IGNORE INTO movimientos (id, usuario_id, pedido_id, monto, concepto, referencia)
         SELECT ?, ?, pedido_id, -centavos, 'ajuste', 'anuncio:' || campana_id
           FROM pedidos_anuncio WHERE pedido_id = ? AND cobrado_en IS NULL AND centavos > 0`,
      )
      .bind(movimientoId, duenoId, pedidoId),
    db
      .prepare(
        `INSERT INTO anuncios_dia (campana_id, dia, pedidos, gasto)
         SELECT campana_id, date('now'), 1, centavos FROM pedidos_anuncio
          WHERE pedido_id = ? AND cobrado_en IS NULL
         ON CONFLICT(campana_id, dia) DO UPDATE SET pedidos = pedidos + 1, gasto = gasto + excluded.gasto`,
      )
      .bind(pedidoId),
    db
      .prepare(
        "UPDATE pedidos_anuncio SET cobrado_en = datetime('now') WHERE pedido_id = ? AND cobrado_en IS NULL",
      )
      .bind(pedidoId),
  ];
}

/** El panel del restaurante: su campaña, lo gastado esta semana y los últimos 30 días. */
export async function resumenAnuncios(db: D1Database, restauranteId: string) {
  const a = await leerAnuncios(db);
  const zona = await db
    .prepare('SELECT zona_id FROM restaurantes WHERE id = ?')
    .bind(restauranteId)
    .first<{ zona_id: string | null }>();
  const { moneda } = await tarifasDeZona(db, String(zona?.zona_id ?? ZONA_INICIAL));
  const c = await db
    .prepare(
      `SELECT c.id, c.activa, c.presupuesto_semanal, ${GASTO_SEMANA} AS gasto_semana
         FROM campanas_anuncio c WHERE c.restaurante_id = ?`,
    )
    .bind(restauranteId)
    .first<{ id: string; activa: number; presupuesto_semanal: number; gasto_semana: number }>();
  const { results } = c
    ? await db
        .prepare(
          `SELECT dia, impresiones, toques, pedidos, gasto FROM anuncios_dia
            WHERE campana_id = ? AND dia >= date('now', '-29 days') ORDER BY dia DESC`,
        )
        .bind(c.id)
        .all<{ dia: string; impresiones: number; toques: number; pedidos: number; gasto: number }>()
    : { results: [] };
  return {
    disponible: a.centavosPorPedido > 0,
    moneda,
    centavosPorPedido: a.centavosPorPedido,
    campana: c
      ? {
          id: c.id,
          activa: c.activa === 1,
          presupuestoSemanalCentavos: Number(c.presupuesto_semanal),
          gastoSemanaCentavos: Number(c.gasto_semana),
        }
      : null,
    dias: results,
  };
}
