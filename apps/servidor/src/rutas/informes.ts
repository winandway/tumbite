import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos } from '../validar';

/**
 * C-INFORMES (29 oct 2026): informe del superadmin por rango de fechas, por ciudad y moneda
 * (nunca se suman monedas distintas), con descarga en CSV. Montos en la unidad menor de la moneda.
 */
export const informes = new Hono<{ Bindings: Env; Variables: Variables }>();

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

type FilaInforme = {
  zona: string;
  ciudad: string;
  moneda: string;
  pedidos: number;
  entregados: number;
  cancelados: number;
  ventas: number;
  cobrado: number;
  propinas: number;
  plataforma: number;
};

async function informe(db: D1Database, desde: string, hasta: string) {
  const { results } = await db
    .prepare(
      `SELECT p.zona_id AS zona, COALESCE(z.nombre, p.zona_id) AS ciudad, p.moneda AS moneda,
          COUNT(*) AS pedidos,
          SUM(CASE WHEN p.estado = 'entregado' THEN 1 ELSE 0 END) AS entregados,
          SUM(CASE WHEN p.estado = 'cancelado' THEN 1 ELSE 0 END) AS cancelados,
          SUM(CASE WHEN p.estado = 'entregado' THEN p.subtotal ELSE 0 END) AS ventas,
          SUM(CASE WHEN p.estado = 'entregado' THEN p.total ELSE 0 END) AS cobrado,
          SUM(CASE WHEN p.estado = 'entregado' THEN p.propina ELSE 0 END) AS propinas,
          SUM(CASE WHEN p.estado = 'entregado' THEN p.ganancia ELSE 0 END) AS plataforma
         FROM pedidos p LEFT JOIN zonas z ON z.id = p.zona_id
        WHERE p.estado <> 'pago_pendiente' AND date(p.creado_en) BETWEEN ? AND ?
        GROUP BY p.zona_id, p.moneda ORDER BY ciudad, moneda`,
    )
    .bind(desde, hasta)
    .all<FilaInforme>();
  return results.map((r) => ({
    ...r,
    pedidos: Number(r.pedidos),
    entregados: Number(r.entregados),
    cancelados: Number(r.cancelados),
    ventas: Number(r.ventas),
    cobrado: Number(r.cobrado),
    propinas: Number(r.propinas),
    plataforma: Number(r.plataforma),
  }));
}

/**
 * C-EMBUDO (29 oct 2026), como el embudo de conversión de los grandes: de los pedidos que se
 * empezaron a pagar en el rango, cuántos se pagaron, cuántos aceptó el restaurante y cuántos llegaron.
 */
export async function embudo(db: D1Database, desde: string, hasta: string) {
  const f = await db
    .prepare(
      `SELECT COUNT(*) AS iniciados,
          SUM(CASE WHEN pagado_en IS NOT NULL THEN 1 ELSE 0 END) AS pagados,
          SUM(CASE WHEN aceptado_en IS NOT NULL THEN 1 ELSE 0 END) AS aceptados,
          SUM(CASE WHEN estado = 'entregado' THEN 1 ELSE 0 END) AS entregados
         FROM pedidos WHERE date(creado_en) BETWEEN ? AND ?`,
    )
    .bind(desde, hasta)
    .first<{
      iniciados: number | null;
      pagados: number | null;
      aceptados: number | null;
      entregados: number | null;
    }>();
  const pasos = {
    iniciados: Number(f?.iniciados ?? 0),
    pagados: Number(f?.pagados ?? 0),
    aceptados: Number(f?.aceptados ?? 0),
    entregados: Number(f?.entregados ?? 0),
  };
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
  return {
    ...pasos,
    pagoPct: pct(pasos.pagados, pasos.iniciados),
    aceptacionPct: pct(pasos.aceptados, pasos.pagados),
    entregaPct: pct(pasos.entregados, pasos.aceptados),
  };
}

/** Celda CSV segura: comillas dobladas y sin fórmulas (=, +, -, @) que abra una hoja de cálculo. */
export function celdaCsv(v: string | number) {
  const t = String(v);
  const segura = /^[=+\-@]/.test(t) && typeof v === 'string' ? `'${t}` : t;
  return /[",\n]/.test(segura) ? `"${segura.replace(/"/g, '""')}"` : segura;
}

informes.get('/admin/informes', async (c) => {
  exigir(c, 'admin');
  const d = fecha.safeParse(c.req.query('desde'));
  const h = fecha.safeParse(c.req.query('hasta'));
  if (!d.success || !h.success)
    throw new ErrorDatos('Elige la fecha inicial y la final.', 'desde', 400);
  if (d.data > h.data)
    throw new ErrorDatos('La fecha final va después de la inicial.', 'hasta', 400);
  const filas = await informe(base(c), d.data, h.data);
  if (c.req.query('formato') === 'csv') {
    const cab = [
      'zona',
      'ciudad',
      'moneda',
      'pedidos',
      'entregados',
      'cancelados',
      'ventas',
      'cobrado',
      'propinas',
      'plataforma',
    ];
    const cuerpo = [
      cab.join(','),
      ...filas.map((f) =>
        [
          f.zona,
          f.ciudad,
          f.moneda,
          f.pedidos,
          f.entregados,
          f.cancelados,
          f.ventas,
          f.cobrado,
          f.propinas,
          f.plataforma,
        ]
          .map(celdaCsv)
          .join(','),
      ),
    ].join('\n');
    return c.body(cuerpo, 200, {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="divoox-informe-${d.data}-${h.data}.csv"`,
    });
  }
  return c.json({
    desde: d.data,
    hasta: h.data,
    filas,
    embudo: await embudo(base(c), d.data, h.data),
  });
});
