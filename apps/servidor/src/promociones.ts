/**
 * C-PROMO-RESTAURANTE (BRE-5, 2 nov 2026), como «Promotions» de DoorDash Merchant (REA de su página
 * pública para comercios, ficha docs/investigaciones-rea/2026-11-02-promociones-y-destino.md): el
 * restaurante arma su promoción y la paga él. Se aplica sola en los pedidos con tarjeta y baja
 * `pedidos.pago_restaurante` (su liquidación); la ganancia de Divoox y el pago del repartidor no
 * cambian. Nace APAGADO: el superadmin la enciende (config «promociones_restaurante»).
 * Todos los países (hoy solo hay tarjeta en dólares, así que en la práctica vale en EE. UU.).
 */
import type { PromocionRestaurante } from '@tumbite/compartido';

export type AjustesPromociones = { encendidas: boolean };
export const PROMOCIONES_INICIAL: AjustesPromociones = { encendidas: false };

export async function leerPromociones(db: D1Database): Promise<AjustesPromociones> {
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'promociones_restaurante'")
    .first<{ valor: string }>();
  if (!f) return PROMOCIONES_INICIAL;
  try {
    const v = JSON.parse(f.valor) as Partial<AjustesPromociones>;
    return { encendidas: v.encendidas === true };
  } catch (e) {
    console.error('promociones: ajustes ilegibles, quedan apagadas', e);
    return PROMOCIONES_INICIAL;
  }
}

export type FilaPromocion = {
  id: string;
  restaurante_id: string;
  tipo: PromocionRestaurante['tipo'];
  valor: number;
  minimo_subtotal: number;
  tope_centavos: number;
  usos_max: number | null;
  inicia_en: string;
  vence_en: string;
  activa: number;
  creado_en: string;
};

export const aPromocion = (f: FilaPromocion): PromocionRestaurante => ({
  id: f.id,
  tipo: f.tipo,
  valor: Number(f.valor),
  minimoSubtotal: Number(f.minimo_subtotal),
  topeCentavos: Number(f.tope_centavos),
});

/** Usos que cuentan: pedidos con la promoción que no se cancelaron. */
const USOS = `(SELECT COUNT(*) FROM pedidos_promocion pp JOIN pedidos pe ON pe.id = pp.pedido_id
  WHERE pp.promocion_id = pr.id AND pe.estado != 'cancelado')`;

/** Las promociones vigentes ahora de estos restaurantes (vacío si están apagadas). */
export async function promocionesVigentes(
  db: D1Database,
  restauranteIds: string[],
): Promise<Map<string, PromocionRestaurante[]>> {
  const mapa = new Map<string, PromocionRestaurante[]>();
  if (restauranteIds.length === 0 || !(await leerPromociones(db)).encendidas) return mapa;
  const { results } = await db
    .prepare(
      `SELECT pr.* FROM promociones_restaurante pr
        WHERE pr.activa = 1 AND pr.restaurante_id IN (SELECT value FROM json_each(?))
          AND pr.inicia_en <= datetime('now') AND pr.vence_en > datetime('now')
          AND (pr.usos_max IS NULL OR ${USOS} < pr.usos_max)
        ORDER BY pr.creado_en DESC`,
    )
    .bind(JSON.stringify(restauranteIds))
    .all<FilaPromocion>();
  for (const f of results) {
    const lista = mapa.get(f.restaurante_id) ?? [];
    lista.push(aPromocion(f));
    mapa.set(f.restaurante_id, lista);
  }
  return mapa;
}

/** La promoción con la que se cobró un pedido (su copia), para recalcularlo igual. */
export async function promocionDelPedido(
  db: D1Database,
  pedidoId: string,
): Promise<PromocionRestaurante | null> {
  const f = await db
    .prepare('SELECT promocion_json FROM pedidos_promocion WHERE pedido_id = ?')
    .bind(pedidoId)
    .first<{ promocion_json: string }>();
  if (!f) return null;
  return JSON.parse(f.promocion_json) as PromocionRestaurante;
}

/** Anota la promoción aplicada (si descontó algo). */
export async function anotarPromocion(
  db: D1Database,
  pedidoId: string,
  restauranteId: string,
  promo: PromocionRestaurante | null,
  descuento: number,
): Promise<void> {
  if (!promo || descuento <= 0) return;
  await db
    .prepare(
      'INSERT OR IGNORE INTO pedidos_promocion (pedido_id, promocion_id, restaurante_id, promocion_json, descuento) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(pedidoId, promo.id, restauranteId, JSON.stringify(promo), descuento)
    .run();
}

/** Lo que el restaurante ve: sus promociones con usos y lo que le costaron (pedidos entregados). */
export async function resumenPromociones(db: D1Database, restauranteId: string) {
  const { results } = await db
    .prepare(
      `SELECT pr.*, ${USOS} AS usos,
         COALESCE((SELECT SUM(pp.descuento) FROM pedidos_promocion pp JOIN pedidos pe ON pe.id = pp.pedido_id
           WHERE pp.promocion_id = pr.id AND pe.estado = 'entregado'), 0) AS costo
         FROM promociones_restaurante pr WHERE pr.restaurante_id = ?
         ORDER BY pr.activa DESC, pr.creado_en DESC LIMIT 50`,
    )
    .bind(restauranteId)
    .all<FilaPromocion & { usos: number; costo: number }>();
  return results.map((f) => ({
    ...aPromocion(f),
    usosMax: f.usos_max == null ? null : Number(f.usos_max),
    iniciaEn: f.inicia_en,
    venceEn: f.vence_en,
    activa: Number(f.activa) === 1,
    vigente:
      Number(f.activa) === 1 &&
      f.inicia_en <= ahoraSql() &&
      f.vence_en > ahoraSql() &&
      (f.usos_max == null || Number(f.usos) < Number(f.usos_max)),
    usos: Number(f.usos),
    costoCentavos: Number(f.costo),
  }));
}

export const ahoraSql = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
