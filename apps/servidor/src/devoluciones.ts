import type { Env } from './env';
import { anotarEvento } from './manager';
import { crearStripe } from './stripe';
import { ErrorDatos } from './validar';

/**
 * Devolución DESPUÉS de entregar (queja atendida): reembolso parcial o total en Stripe con clave de
 * idempotencia, fila en `devoluciones` y, si se le carga al restaurante o al repartidor, un
 * movimiento compensatorio con autor (nunca se borra historial). La usan el superadmin y la queja
 * guiada automática (cuando Richard la encienda).
 */
export async function devolverParcial(
  env: Env,
  db: D1Database,
  p: {
    pedidoId: string;
    monto: number;
    motivo: string;
    cargarA: 'tumbite' | 'restaurante' | 'repartidor';
    actorId: string | null;
  },
) {
  const f = await db
    .prepare(
      `SELECT p.id, p.estado, p.total, p.stripe_pago, p.repartidor_id, r.dueno_id, c.capturado_en,
              (SELECT COALESCE(SUM(monto), 0) FROM devoluciones dv WHERE dv.pedido_id = p.id) AS devuelto,
              (SELECT COUNT(*) FROM devoluciones dv WHERE dv.pedido_id = p.id) AS n
         FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id LEFT JOIN cobros c ON c.pedido_id = p.id
        WHERE p.id = ?`,
    )
    .bind(p.pedidoId)
    .first<Record<string, unknown>>();
  if (!f) throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  if (String(f.estado) !== 'entregado' || !f.stripe_pago || !f.capturado_en)
    throw new ErrorDatos(
      'Solo se devuelve dinero de un pedido entregado y cobrado.',
      undefined,
      409,
    );
  if (Number(f.devuelto) + p.monto > Number(f.total))
    throw new ErrorDatos('La devolución supera lo que pagó el cliente.', 'montoCentavos', 409);
  if (p.cargarA === 'repartidor' && !f.repartidor_id)
    throw new ErrorDatos('Este pedido no tuvo repartidor.', 'cargarA', 409);
  const stripe = crearStripe(env.STRIPE_SECRET_KEY);
  if (!stripe) throw new ErrorDatos('Stripe no está configurado.', undefined, 409);
  const devId = crypto.randomUUID();
  const reembolso = await stripe.post<{ id: string }>(
    '/refunds',
    {
      payment_intent: String(f.stripe_pago),
      amount: p.monto,
      metadata: { pedido_id: p.pedidoId, devolucion: devId },
    },
    `devolucion-${p.pedidoId}-${Number(f.n) + 1}`,
  );
  const cargado =
    p.cargarA === 'restaurante'
      ? String(f.dueno_id)
      : p.cargarA === 'repartidor'
        ? String(f.repartidor_id)
        : null;
  await db.batch([
    db
      .prepare(
        'INSERT INTO devoluciones (id, pedido_id, monto, motivo, cargar_a, actor_id, stripe_reembolso) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(devId, p.pedidoId, p.monto, p.motivo, p.cargarA, p.actorId, reembolso.id),
    ...(cargado
      ? [
          db
            .prepare(
              "INSERT INTO movimientos (id, usuario_id, pedido_id, monto, concepto, referencia) VALUES (?, ?, NULL, ?, 'ajuste', ?)",
            )
            .bind(
              crypto.randomUUID(),
              cargado,
              -p.monto,
              `devolucion:${p.pedidoId}:${devId}:por:${p.actorId ?? 'sistema'}`,
            ),
        ]
      : []),
  ]);
  await anotarEvento(
    db,
    p.pedidoId,
    'devolucion_parcial',
    `${p.monto} · ${p.cargarA} · ${p.motivo}`,
  );
  return { devolucionId: devId, reembolso: reembolso.id };
}

export type ConfigQuejas = { reembolsoAuto: boolean; topeCentavos: number };
export const CONFIG_QUEJAS_INICIAL: ConfigQuejas = { reembolsoAuto: false, topeCentavos: 1500 };

/** Reembolso automático por artículo faltante: apagado hasta que Richard lo encienda (es dinero). */
export async function leerConfigQuejas(db: D1Database): Promise<ConfigQuejas> {
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'quejas'")
    .first<{ valor: string }>();
  if (!f) return CONFIG_QUEJAS_INICIAL;
  try {
    const v = JSON.parse(f.valor) as Partial<ConfigQuejas>;
    return { ...CONFIG_QUEJAS_INICIAL, ...v };
  } catch {
    return CONFIG_QUEJAS_INICIAL;
  }
}

export async function guardarConfigQuejas(db: D1Database, v: ConfigQuejas) {
  await db
    .prepare(
      "INSERT INTO config (clave, valor) VALUES ('quejas', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
    )
    .bind(JSON.stringify(v))
    .run();
}
