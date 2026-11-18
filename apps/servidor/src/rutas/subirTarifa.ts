import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { repartirOperaciones } from '../operaciones';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';

/**
 * C-SUBIR-TARIFA (18 nov 2026, todos los países; Venezuela primero). Pedido de los mototaxistas del
 * piloto: «¿qué pasa si nadie toma la oferta porque el precio es muy bajo?». Como «Aumentar tarifa»
 * de inDrive y DiDi [DOC/INF, ficha docs/investigaciones-rea/2026-11-18-subir-tarifa.md]: si en
 * unos segundos nadie acepta, el pasajero sube la tarifa con un toque. El viaje NO se cancela: el
 * precio nuevo queda en la cotización del viaje (la comisión, el cobro en mano y el recibo salen de
 * ahí) y se vuelve a ofrecer en el acto, también a quien lo dejó vencer o lo rechazó (con precio
 * nuevo es una oferta nueva). El regalo de Divoox no crece: la subida la paga el pasajero en mano.
 *
 * Apagado por defecto: se enciende por ciudad y servicio en `ajustes_viaje_zona` (superadmin,
 * PUT /admin/viajes/ajustes con `subida`). Con tarjeta solo hasta lo ya autorizado (EE. UU.: sin una
 * autorización nueva no se sube; por eso allá queda apagado).
 */
export const subirTarifa = new Hono<{ Bindings: Env; Variables: Variables }>();

export type AjusteSubida = {
  /** Los botones, en la unidad menor de la moneda (Venezuela: 25, 50 y 100 centavos de dólar). */
  pasos: number[];
  /** Segundos buscando (o desde la última subida) antes de poder subir. */
  esperaS: number;
  /** Cuántas veces se puede subir un mismo viaje. */
  maxVeces: number;
  /** El precio no pasa de este múltiplo de la cotización original (10 000 = 1×). */
  topePb: number;
};
export const SUBIDA_POR_DEFECTO = { esperaS: 40, maxVeces: 3, topePb: 15_000 };

/** El ajuste de subida de la ciudad, o null si está apagado (sin pasos). */
export async function ajusteSubida(
  db: D1Database,
  servicio: string,
  zona: string,
): Promise<AjusteSubida | null> {
  const f = await db
    .prepare(
      `SELECT subida_pasos_json, subida_espera_s, subida_max_veces, subida_tope_pb
         FROM ajustes_viaje_zona WHERE servicio_id = ? AND zona_id = ?`,
    )
    .bind(servicio, zona)
    .first<{
      subida_pasos_json: string | null;
      subida_espera_s: number | null;
      subida_max_veces: number | null;
      subida_tope_pb: number | null;
    }>();
  const pasos = leerPasos(f?.subida_pasos_json ?? null);
  if (!pasos.length) return null;
  return {
    pasos,
    esperaS: f?.subida_espera_s ?? SUBIDA_POR_DEFECTO.esperaS,
    maxVeces: f?.subida_max_veces ?? SUBIDA_POR_DEFECTO.maxVeces,
    topePb: f?.subida_tope_pb ?? SUBIDA_POR_DEFECTO.topePb,
  };
}

function leerPasos(json: string | null): number[] {
  try {
    const d = JSON.parse(json ?? '[]') as unknown;
    return Array.isArray(d)
      ? d.filter((x): x is number => Number.isSafeInteger(x) && x > 0).slice(0, 3)
      : [];
  } catch {
    return [];
  }
}

/** El esquema del ajuste que pone el superadmin (null lo apaga). */
export const esquemaAjusteSubida = z
  .object({
    pasos: z.array(z.number().int().min(1).max(100_000)).min(1).max(3),
    esperaS: z.number().int().min(15).max(600).default(SUBIDA_POR_DEFECTO.esperaS),
    maxVeces: z.number().int().min(1).max(5).default(SUBIDA_POR_DEFECTO.maxVeces),
    topePb: z.number().int().min(10_500).max(30_000).default(SUBIDA_POR_DEFECTO.topePb),
  })
  .nullable();

/**
 * La regla de una subida, sin consultas (centavos enteros). Con tarjeta, nunca por encima de lo ya
 * autorizado: subir obligaría a una autorización nueva, y eso no se hace sin el pasajero en Stripe.
 */
export function validarSubida(e: {
  pasos: number[];
  maxVeces: number;
  topePb: number;
  original: number;
  actual: number;
  hechas: number;
  monto: number;
  metodoPago: string;
  autorizado: number | null;
}): { ok: true; nuevo: number } | { ok: false; motivo: 'monto' | 'veces' | 'tope' | 'tarjeta' } {
  if (!e.pasos.includes(e.monto)) return { ok: false, motivo: 'monto' };
  if (e.hechas >= e.maxVeces) return { ok: false, motivo: 'veces' };
  const nuevo = e.actual + e.monto;
  if (nuevo > Math.floor((e.original * e.topePb) / 10_000)) return { ok: false, motivo: 'tope' };
  if (e.metodoPago === 'tarjeta' && (e.autorizado == null || nuevo > e.autorizado))
    return { ok: false, motivo: 'tarjeta' };
  return { ok: true, nuevo };
}

const MOTIVOS: Record<'monto' | 'veces' | 'tope' | 'tarjeta', [string, 409 | 422]> = {
  monto: ['Elige uno de los montos que te mostramos.', 422],
  veces: ['Ya subiste la tarifa de este viaje las veces permitidas.', 409],
  tope: ['La tarifa ya está en el máximo para este viaje.', 409],
  tarjeta: ['Con tarjeta no se puede subir la tarifa de este viaje.', 409],
};

type FilaViaje = {
  id: string;
  servicio_id: string;
  zona_id: string;
  estado: string;
  metodo_pago: string;
  cot_id: string;
  total: number;
  moneda: string;
  desglose_json: string | null;
  autorizado: number | null;
  buscando_desde_s: number;
};

async function viajeParaSubir(db: D1Database, op: string, cliente: string) {
  return db
    .prepare(
      `SELECT o.id, o.servicio_id, o.zona_id, v.estado, v.metodo_pago, q.id AS cot_id, q.total, q.moneda,
              q.desglose_json,
              (SELECT k.autorizado FROM cobros_viaje k WHERE k.operacion_id = o.id) AS autorizado,
              CAST((julianday('now') - julianday(MAX(
                COALESCE((SELECT MAX(e.creado_en) FROM eventos_operacion e
                           WHERE e.operacion_id = o.id AND e.estado_nuevo = 'buscando'), o.creado_en),
                COALESCE((SELECT MAX(c.creado_en) FROM cambios_viaje c
                           WHERE c.operacion_id = o.id AND c.tipo = 'subida'), o.creado_en)
              ))) * 86400 AS INTEGER) AS buscando_desde_s
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
         JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id
        WHERE o.id = ? AND o.cliente_id = ?`,
    )
    .bind(op, cliente)
    .first<FilaViaje>();
}

async function subidasDe(db: D1Database, op: string) {
  return db
    .prepare(
      `SELECT COUNT(*) AS hechas, MIN(total_antes) AS original
         FROM cambios_viaje WHERE operacion_id = ? AND tipo = 'subida'`,
    )
    .bind(op)
    .first<{ hechas: number; original: number | null }>();
}

/**
 * Lo que el pasajero ve en «Buscando…» (null si no puede subir): los montos, en cuántos segundos
 * se habilitan y cuántas subidas le quedan. Solo lee.
 */
export async function estadoSubida(
  db: D1Database,
  op: string,
  cliente: string,
): Promise<{ pasos: number[]; enSegundos: number; quedan: number; moneda: string } | null> {
  const v = await viajeParaSubir(db, op, cliente);
  if (!v || v.estado !== 'buscando') return null;
  const a = await ajusteSubida(db, v.servicio_id, v.zona_id);
  if (!a) return null;
  const s = await subidasDe(db, op);
  const hechas = Number(s?.hechas ?? 0);
  const original = s?.original ?? Number(v.total);
  const pasos = a.pasos.filter(
    (monto) =>
      validarSubida({
        ...a,
        original,
        actual: Number(v.total),
        hechas,
        monto,
        metodoPago: v.metodo_pago,
        autorizado: v.autorizado,
      }).ok,
  );
  if (!pasos.length) return null;
  return {
    pasos,
    enSegundos: Math.max(0, a.esperaS - Number(v.buscando_desde_s ?? 0)),
    quedan: a.maxVeces - hechas,
    moneda: v.moneda,
  };
}

subirTarifa.post('/viajes/:id/subir-tarifa', async (c) => {
  const u = exigir(c, 'cliente');
  const op = c.req.param('id');
  const d = await leerCuerpo(
    c,
    z.object({
      monto: z.number().int().positive(),
      clave: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    }),
  );
  const db = base(c);
  const id = `subida:${op}:${d.clave}`;
  const v = await viajeParaSubir(db, op, u.id);
  if (!v) throw new ErrorDatos('Ese viaje no existe.', undefined, 404);
  // Idempotente: la misma clave ya aplicada devuelve lo que quedó, sin subir otra vez.
  const ya = await db
    .prepare(
      'SELECT total_despues, total_despues - total_antes AS subida FROM cambios_viaje WHERE id = ?',
    )
    .bind(id)
    .first<{ total_despues: number; subida: number }>();
  if (ya) return c.json({ ok: true, total: Number(ya.total_despues), subida: Number(ya.subida) });
  if (v.estado !== 'buscando')
    throw new ErrorDatos('Este viaje ya no está buscando conductor.', undefined, 409);
  const a = await ajusteSubida(db, v.servicio_id, v.zona_id);
  if (!a) throw new ErrorDatos('En tu ciudad no se puede subir la tarifa.', undefined, 409);
  if (Number(v.buscando_desde_s ?? 0) < a.esperaS)
    throw new ErrorDatos(
      'Espera unos segundos: estamos ofreciendo tu viaje a los conductores.',
      undefined,
      409,
    );
  const s = await subidasDe(db, op);
  const actual = Number(v.total);
  const r = validarSubida({
    ...a,
    original: s?.original ?? actual,
    actual,
    hechas: Number(s?.hechas ?? 0),
    monto: d.monto,
    metodoPago: v.metodo_pago,
    autorizado: v.autorizado,
  });
  if (!r.ok) {
    const [texto, estado] = MOTIVOS[r.motivo];
    throw new ErrorDatos(texto, 'monto', estado);
  }
  const desglose = leerDesglose(v.desglose_json);
  desglose.subidaPasajero = (desglose.subidaPasajero ?? 0) + d.monto;
  desglose.total = r.nuevo;
  const hecho = 'EXISTS (SELECT 1 FROM cambios_viaje WHERE id = ?)';
  await db.batch([
    // La subida nace solo si nada se movió: mismo precio y el viaje sigue buscando.
    db
      .prepare(
        `INSERT INTO cambios_viaje (id, operacion_id, actor, actor_id, total_antes, total_despues, tipo)
         SELECT ?1, ?2, 'cliente', ?3, ?4, ?5, 'subida'
          WHERE EXISTS (SELECT 1 FROM cotizaciones_viaje q JOIN viajes w ON w.cotizacion_id = q.id
                         WHERE q.id = ?6 AND q.total = ?4 AND w.operacion_id = ?2 AND w.estado = 'buscando')`,
      )
      .bind(id, op, u.id, actual, r.nuevo, v.cot_id),
    db
      .prepare(
        `UPDATE cotizaciones_viaje SET total = ?, desglose_json = ? WHERE id = ? AND ${hecho}`,
      )
      .bind(r.nuevo, JSON.stringify(desglose), v.cot_id, id),
    // El registro del viaje: quién, cuánto y cuándo.
    db
      .prepare(
        `INSERT INTO eventos_operacion (operacion_id, tipo, actor_id, actor_rol, datos_json, idempotencia)
         SELECT ?, 'subida_tarifa', ?, 'cliente', ?, ? WHERE ${hecho}`,
      )
      .bind(
        op,
        u.id,
        JSON.stringify({ monto: d.monto, antes: actual, despues: r.nuevo, moneda: v.moneda }),
        id,
        id,
      ),
    // Con precio nuevo es una oferta nueva: la que estaba abierta (al precio viejo) se retira, y todos
    // los que ya la vieron vuelven a ser candidatos en el acto (vuelveAOfrecerse en operaciones.ts).
    db
      .prepare(
        `UPDATE ofertas_operacion SET estado = 'retirada', respondida_en = datetime('now')
          WHERE operacion_id = ? AND estado = 'ofrecida' AND ${hecho}`,
      )
      .bind(op, id),
  ]);
  const quedo = await db
    .prepare('SELECT total_despues FROM cambios_viaje WHERE id = ?')
    .bind(id)
    .first<{ total_despues: number }>();
  if (!quedo)
    throw new ErrorDatos(
      'Tu viaje cambió mientras subías la tarifa. Vuelve a intentarlo.',
      undefined,
      409,
    );
  await repartirOperaciones(c.env, db).catch((e: unknown) =>
    console.error('subir tarifa: despacho', op, e),
  );
  return c.json({ ok: true, total: Number(quedo.total_despues), subida: d.monto });
});

function leerDesglose(json: string | null): Record<string, number> {
  try {
    const d = JSON.parse(json ?? '{}') as unknown;
    if (!d || typeof d !== 'object') return {};
    return Object.fromEntries(
      Object.entries(d).filter(([, x]) => typeof x === 'number' && Number.isFinite(x)),
    ) as Record<string, number>;
  } catch {
    return {};
  }
}
