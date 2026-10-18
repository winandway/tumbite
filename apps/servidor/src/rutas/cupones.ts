import { Hono } from 'hono';
import { z } from 'zod';
import { porcentajeDe } from '@tumbite/compartido';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';

/**
 * Cupones y promociones reales (auditoría final, punto 15). Los crea el superadmin; el cliente los
 * aplica en el carrito; el servidor los valida de nuevo al crear el pedido (nunca se confía en la
 * app). El descuento lo absorbe Tumbite (baja su ganancia): quién paga cada campaña es decisión de
 * Richard por cupón (docs/DECISIONES-RICHARD-FASE-2.md).
 */
export const cupones = new Hono<{ Bindings: Env; Variables: Variables }>();

type FilaCupon = {
  codigo: string;
  tipo: 'monto' | 'porcentaje' | 'envio_gratis';
  valor: number;
  descripcion_es: string;
  descripcion_en: string;
  minimo_subtotal: number;
  usos_max: number | null;
  usos_por_cliente: number;
  solo_primer_pedido: number;
  restaurante_id: string | null;
  zona_id: string | null;
  destacado: number;
  vence_en: string | null;
  activo: number;
};

export const normalizarCupon = (c: string) => c.trim().toUpperCase().replace(/\s+/g, '');

/** Valida un cupón para este cliente, restaurante y carrito. Devuelve el descuento en centavos. */
export async function validarCupon(
  db: D1Database,
  p: {
    codigo: string;
    usuarioId: string;
    restauranteId: string;
    subtotal: number;
    envio: number;
    zonaId: string;
  },
): Promise<{ descuento: number; cupon: FilaCupon }> {
  const codigo = normalizarCupon(p.codigo);
  const c = await db
    .prepare('SELECT * FROM cupones WHERE codigo = ?')
    .bind(codigo)
    .first<FilaCupon>();
  if (!c || !c.activo)
    throw new ErrorDatos('Ese cupón no existe o ya no está activo.', 'cupon', 409);
  if (c.vence_en && c.vence_en < new Date().toISOString().replace('T', ' ').slice(0, 19))
    throw new ErrorDatos('Ese cupón ya venció.', 'cupon', 409);
  if (c.restaurante_id && c.restaurante_id !== p.restauranteId)
    throw new ErrorDatos('Ese cupón es de otro restaurante.', 'cupon', 409);
  if (c.zona_id && c.zona_id !== p.zonaId)
    throw new ErrorDatos('Ese cupón no vale en tu ciudad.', 'cupon', 409);
  if (p.subtotal < c.minimo_subtotal)
    throw new ErrorDatos('Tu pedido no llega al mínimo de ese cupón.', 'cupon', 409);
  const usos = await db
    .prepare(
      'SELECT (SELECT COUNT(*) FROM usos_cupon WHERE codigo = ?1) AS total, (SELECT COUNT(*) FROM usos_cupon WHERE codigo = ?1 AND usuario_id = ?2) AS mios',
    )
    .bind(codigo, p.usuarioId)
    .first<{ total: number; mios: number }>();
  if (c.usos_max != null && Number(usos?.total ?? 0) >= c.usos_max)
    throw new ErrorDatos('Ese cupón ya se agotó.', 'cupon', 409);
  if (Number(usos?.mios ?? 0) >= c.usos_por_cliente)
    throw new ErrorDatos('Ya usaste ese cupón.', 'cupon', 409);
  if (c.solo_primer_pedido) {
    const previos = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM pedidos WHERE cliente_id = ? AND estado IN ('pagado','aceptado','listo','en_camino','entregado')",
      )
      .bind(p.usuarioId)
      .first<{ n: number }>();
    if (Number(previos?.n ?? 0) > 0)
      throw new ErrorDatos('Ese cupón es solo para tu primer pedido.', 'cupon', 409);
  }
  const descuento =
    c.tipo === 'monto'
      ? c.valor
      : c.tipo === 'porcentaje'
        ? porcentajeDe(p.subtotal, c.valor)
        : p.envio;
  return { descuento: Math.max(0, descuento), cupon: c };
}

const aCupon = (c: FilaCupon) => ({
  codigo: c.codigo,
  tipo: c.tipo,
  valor: Number(c.valor),
  descripcionEs: c.descripcion_es,
  descripcionEn: c.descripcion_en,
  minimoSubtotal: Number(c.minimo_subtotal),
  usosMax: c.usos_max == null ? null : Number(c.usos_max),
  usosPorCliente: Number(c.usos_por_cliente),
  soloPrimerPedido: Number(c.solo_primer_pedido) === 1,
  restauranteId: c.restaurante_id,
  zonaId: c.zona_id,
  destacado: Number(c.destacado) === 1,
  venceEn: c.vence_en,
  activo: Number(c.activo) === 1,
});

/** El cliente prueba un cupón en el carrito. */
cupones.post('/cupones/validar', async (c) => {
  const u = exigir(c, 'cliente');
  const d = await leerCuerpo(
    c,
    z.object({
      codigo: z.string().trim().min(2).max(30),
      restauranteId: z.string().min(1),
      subtotal: z.number().int().min(0),
      envio: z.number().int().min(0).default(0),
    }),
  );
  const db = base(c);
  const rest = await db
    .prepare('SELECT zona_id FROM restaurantes WHERE id = ?')
    .bind(d.restauranteId)
    .first<{ zona_id: string }>();
  const r = await validarCupon(db, {
    ...d,
    usuarioId: u.id,
    zonaId: rest?.zona_id ?? 'US-FL-MIAMI',
  });
  return c.json({ codigo: r.cupon.codigo, descuento: r.descuento, tipo: r.cupon.tipo });
});

/** Promociones destacadas (para «Ofertas del día» del inicio): públicas, sin datos privados. */
cupones.get('/cupones/destacados', async (c) => {
  const { results } = await base(c)
    .prepare(
      "SELECT * FROM cupones WHERE activo = 1 AND destacado = 1 AND (vence_en IS NULL OR vence_en > datetime('now')) ORDER BY creado_en DESC LIMIT 6",
    )
    .all<FilaCupon>();
  return c.json({
    cupones: results.map((x) => ({
      codigo: x.codigo,
      tipo: x.tipo,
      valor: Number(x.valor),
      descripcionEs: x.descripcion_es,
      descripcionEn: x.descripcion_en,
      minimoSubtotal: Number(x.minimo_subtotal),
      venceEn: x.vence_en,
    })),
  });
});

// ───────── Superadmin ─────────
cupones.get('/admin/cupones', async (c) => {
  exigir(c, 'admin');
  const { results } = await base(c)
    .prepare(
      'SELECT c.*, (SELECT COUNT(*) FROM usos_cupon u WHERE u.codigo = c.codigo) AS usos, (SELECT COALESCE(SUM(descuento),0) FROM usos_cupon u WHERE u.codigo = c.codigo) AS descontado FROM cupones c ORDER BY c.activo DESC, c.creado_en DESC LIMIT 200',
    )
    .all<FilaCupon & { usos: number; descontado: number }>();
  return c.json({
    cupones: results.map((x) => ({
      ...aCupon(x),
      usos: Number(x.usos),
      descontado: Number(x.descontado),
    })),
  });
});

cupones.post('/admin/cupones', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      codigo: z.string().trim().min(2).max(30),
      tipo: z.enum(['monto', 'porcentaje', 'envio_gratis']),
      valor: z.number().int().min(0).max(1_000_000).default(0),
      descripcionEs: z.string().trim().max(120).default(''),
      descripcionEn: z.string().trim().max(120).default(''),
      minimoSubtotal: z.number().int().min(0).default(0),
      usosMax: z.number().int().min(1).nullable().default(null),
      usosPorCliente: z.number().int().min(1).default(1),
      soloPrimerPedido: z.boolean().default(false),
      restauranteId: z.string().nullable().default(null),
      zonaId: z.string().nullable().default(null),
      destacado: z.boolean().default(false),
      venceEn: z
        .string()
        .refine(
          (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) || /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v),
          {
            error: 'La fecha de vencimiento no es válida.',
          },
        )
        .nullable()
        .default(null),
    }),
  );
  if (d.tipo === 'porcentaje' && d.valor > 10000)
    throw new ErrorDatos('El porcentaje no puede pasar de 100.', 'valor', 400);
  const codigo = normalizarCupon(d.codigo);
  const db = base(c);
  const existe = await db.prepare('SELECT 1 FROM cupones WHERE codigo = ?').bind(codigo).first();
  if (existe) throw new ErrorDatos('Ya existe un cupón con ese código.', 'codigo', 409);
  await db
    .prepare(
      'INSERT INTO cupones (codigo, tipo, valor, descripcion_es, descripcion_en, minimo_subtotal, usos_max, usos_por_cliente, solo_primer_pedido, restaurante_id, zona_id, destacado, vence_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      codigo,
      d.tipo,
      d.valor,
      d.descripcionEs,
      d.descripcionEn,
      d.minimoSubtotal,
      d.usosMax,
      d.usosPorCliente,
      d.soloPrimerPedido ? 1 : 0,
      d.restauranteId,
      d.zonaId,
      d.destacado ? 1 : 0,
      d.venceEn,
    )
    .run();
  const x = (await db
    .prepare('SELECT * FROM cupones WHERE codigo = ?')
    .bind(codigo)
    .first<FilaCupon>())!;
  return c.json({ cupon: aCupon(x) }, 201);
});

cupones.patch('/admin/cupones/:codigo', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({ activo: z.boolean().optional(), destacado: z.boolean().optional() }),
  );
  const codigo = normalizarCupon(c.req.param('codigo'));
  const db = base(c);
  const r = await db
    .prepare(
      'UPDATE cupones SET activo = COALESCE(?, activo), destacado = COALESCE(?, destacado) WHERE codigo = ?',
    )
    .bind(
      d.activo == null ? null : d.activo ? 1 : 0,
      d.destacado == null ? null : d.destacado ? 1 : 0,
      codigo,
    )
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Ese cupón no existe o ya no está activo.', 'cupon', 404);
  return c.json({ ok: true });
});
