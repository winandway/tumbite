import type { Env } from './env';
import { enviarCorreo } from './correo';
import { crearStripe } from './stripe';

/**
 * Entrega 1b · C-COBRO-AL-ENTREGAR (16 oct 2026). Ficha: docs/investigaciones-rea/2026-10-16-cobro-al-entregar.md.
 *
 * Orden nuevo de la entrega:
 *   1. UN lote en D1: INSERT liquidaciones (clave única por pedido) + pedido → entregado + abonos.
 *   2. Después, `liquidar`: captura en Stripe. Si falla, la liquidación queda para el reloj.
 *
 * Reglas (de la documentación de Stripe):
 *   - Una misma clave de idempotencia devuelve la respuesta guardada, INCLUIDOS los 500: por eso
 *     cada intento lleva su propia clave y, antes de reintentar, se pregunta a Stripe (GET).
 *   - Un pago autorizado se captura UNA sola vez: capturar de nuevo no cobra dos veces.
 *   - Una autorización vence (canceled) a los 7 días: pasa a «revision» y se avisa.
 */
export type EstadoLiquidacion =
  'pendiente' | 'capturando' | 'capturada' | 'reintentar' | 'revision' | 'no_aplica';

/** Espera antes de cada reintento, en minutos. Tras el último, «revision». */
export const ESPERAS_MIN = [1, 5, 15, 60, 240] as const;
export const MAX_INTENTOS = ESPERAS_MIN.length + 1;
/** Una liquidación «capturando» de hace más de esto quedó a medias (el servidor murió): se reclama. */
const CAPTURANDO_VENCE = '-5 minutes';

/** Estado con que nace la liquidación de un pedido, según su cobro en la base. */
export async function estadoInicial(
  db: D1Database,
  pedidoId: string,
  pi: string,
): Promise<EstadoLiquidacion> {
  const cobro = await db
    .prepare('SELECT capturado_en FROM cobros WHERE pedido_id = ?')
    .bind(pedidoId)
    .first<{ capturado_en: string | null }>();
  if (!cobro || !pi) return 'no_aplica'; // pedidos viejos (Checkout) o sin PaymentIntent
  return cobro.capturado_en ? 'capturada' : 'pendiente';
}

/** La sentencia que va DENTRO del lote de la entrega. Si ya existe, el lote entero se deshace. */
export function sentenciaLiquidacion(
  db: D1Database,
  pedidoId: string,
  pi: string,
  monto: number,
  estado: EstadoLiquidacion,
) {
  return db
    .prepare(
      `INSERT INTO liquidaciones (pedido_id, estado, pi, monto, capturado_en)
       VALUES (?, ?, ?, ?, CASE WHEN ? = 'capturada' THEN datetime('now') END)`,
    )
    .bind(pedidoId, estado, pi || null, monto, estado);
}

/** ¿El error del lote es porque la liquidación ya existía (entrega repetida)? */
export const esEntregaRepetida = (e: unknown) =>
  /UNIQUE constraint failed: liquidaciones\.pedido_id/i.test(String((e as Error)?.message ?? e));

type Fila = { pedido_id: string; pi: string | null; monto: number; intentos: number };

async function marcarCapturada(db: D1Database, pedidoId: string, monto: number) {
  await db.batch([
    db
      .prepare(
        "UPDATE liquidaciones SET estado = 'capturada', capturado_en = datetime('now'), error = NULL, actualizado_en = datetime('now') WHERE pedido_id = ? AND estado <> 'capturada'",
      )
      .bind(pedidoId),
    db
      .prepare(
        "UPDATE cobros SET capturado_en = COALESCE(capturado_en, datetime('now')), capturado = COALESCE(capturado, ?) WHERE pedido_id = ?",
      )
      .bind(monto, pedidoId),
  ]);
}

async function programar(
  env: Env,
  db: D1Database,
  f: Fila,
  error: string,
  definitivo = false,
): Promise<EstadoLiquidacion> {
  const aRevision = definitivo || f.intentos >= MAX_INTENTOS;
  const espera = ESPERAS_MIN[Math.min(f.intentos, ESPERAS_MIN.length) - 1] ?? 1;
  await db
    .prepare(
      `UPDATE liquidaciones SET estado = ?, error = ?, actualizado_en = datetime('now'),
         proximo_en = CASE WHEN ? = 'reintentar' THEN datetime('now', ?) END
       WHERE pedido_id = ? AND estado = 'capturando'`,
    )
    .bind(
      aRevision ? 'revision' : 'reintentar',
      error.slice(0, 300),
      aRevision ? 'revision' : 'reintentar',
      `+${espera} minutes`,
      f.pedido_id,
    )
    .run();
  if (aRevision) {
    // Decisión de Richard (16 oct 2026): en revisión se CONSERVA el saldo anotado, se BLOQUEA su
    // retiro (SOLO_LO_COBRADO), se avisa al equipo UNA vez, no se descuenta nada y no se intenta
    // cobrar otra tarjeta. La resolución final es de un administrador.
    const marca = await db
      .prepare(
        "UPDATE liquidaciones SET alertado_en = datetime('now') WHERE pedido_id = ? AND alertado_en IS NULL",
      )
      .bind(f.pedido_id)
      .run();
    if (marca.meta.changes) await alertar(env, f, error);
  }
  return aRevision ? 'revision' : 'reintentar';
}

async function alertar(env: Env, f: Fila, error: string) {
  for (const para of (env.ADMIN_CORREOS ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean))
    await enviarCorreo(env, {
      de: 'avisos',
      para,
      asunto: `Cobro sin capturar: pedido ${f.pedido_id}`,
      texto: `El pedido ${f.pedido_id} está entregado pero su cobro (${f.pi ?? 'sin PaymentIntent'}, ${f.monto} centavos) no se pudo capturar tras ${f.intentos} intento(s). Último error: ${error}. Revísalo en Stripe: los abonos de ese pedido no se pueden retirar hasta que se capture.`,
    }).catch((e: unknown) => console.error('liquidación: correo al equipo', f.pedido_id, e));
}

/**
 * Intenta capturar el cobro de UNA entrega. Seguro de llamar varias veces y a la vez: primero
 * reclama la liquidación con un UPDATE condicional; si otro la tiene, no hace nada.
 */
export async function liquidar(env: Env, db: D1Database, pedidoId: string) {
  const reclamo = await db
    .prepare(
      `UPDATE liquidaciones SET estado = 'capturando', intentos = intentos + 1, actualizado_en = datetime('now')
       WHERE pedido_id = ? AND (
         estado = 'pendiente'
         OR (estado = 'reintentar' AND (proximo_en IS NULL OR proximo_en <= datetime('now')))
         OR (estado = 'capturando' AND actualizado_en < datetime('now', ?)))`,
    )
    .bind(pedidoId, CAPTURANDO_VENCE)
    .run();
  if (!reclamo.meta.changes) return null;
  const f = (await db
    .prepare('SELECT pedido_id, pi, monto, intentos FROM liquidaciones WHERE pedido_id = ?')
    .bind(pedidoId)
    .first<Fila>())!;
  const stripe = crearStripe(env.STRIPE_SECRET_KEY);
  if (!stripe || !f.pi) return programar(env, db, f, 'Stripe no está configurado');

  const consultar = async () => {
    try {
      return await stripe.get<{ status?: string; amount_received?: number }>(
        `/payment_intents/${f.pi}`,
      );
    } catch (e) {
      console.error('liquidación: no se pudo consultar el PaymentIntent', pedidoId, e);
      return null;
    }
  };
  // En un reintento, primero se pregunta: Stripe pudo haber cobrado aunque la respuesta se perdiera.
  if (f.intentos > 1) {
    const pi = await consultar();
    if (pi?.status === 'succeeded') return cerrar(db, f, Number(pi.amount_received ?? f.monto));
    if (pi?.status === 'canceled')
      return programar(env, db, f, 'La autorización venció o se anuló (canceled)', true);
    if (pi && pi.status !== 'requires_capture')
      return programar(env, db, f, `Estado inesperado del pago: ${pi.status ?? '?'}`);
    if (!pi) return programar(env, db, f, 'No se pudo consultar el pago en Stripe');
  }
  try {
    // Cada intento con su clave: una clave con un 500 guardado devolvería ese 500 durante 24 h.
    const clave = f.intentos === 1 ? `captura-${pedidoId}` : `captura-${pedidoId}-${f.intentos}`;
    await stripe.post(`/payment_intents/${f.pi}/capture`, { amount_to_capture: f.monto }, clave);
    return cerrar(db, f, f.monto);
  } catch (e) {
    const pi = await consultar();
    if (pi?.status === 'succeeded') return cerrar(db, f, Number(pi.amount_received ?? f.monto));
    if (pi?.status === 'canceled')
      return programar(env, db, f, 'La autorización venció o se anuló (canceled)', true);
    return programar(env, db, f, String((e as Error)?.message ?? e));
  }
}

async function cerrar(db: D1Database, f: Fila, monto: number): Promise<EstadoLiquidacion> {
  try {
    await marcarCapturada(db, f.pedido_id, monto);
    return 'capturada';
  } catch (e) {
    // Stripe cobró pero la base no lo anotó: queda «capturando» y el reloj lo cierra con un GET.
    console.error('liquidación: cobrada en Stripe, sin anotar en la base', f.pedido_id, e);
    return 'capturando';
  }
}

/** Tarea del reloj (crítica): reintenta lo pendiente, lo vencido y lo que quedó a medias. */
export async function liquidarPendientes(env: Env, db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT pedido_id FROM liquidaciones
        WHERE estado = 'pendiente'
           OR (estado = 'reintentar' AND (proximo_en IS NULL OR proximo_en <= datetime('now')))
           OR (estado = 'capturando' AND actualizado_en < datetime('now', ?))
        ORDER BY creado_en LIMIT 25`,
    )
    .bind(CAPTURANDO_VENCE)
    .all<{ pedido_id: string }>();
  const resultado = new Map<string, number>();
  for (const r of results) {
    const estado = (await liquidar(env, db, r.pedido_id)) ?? 'ocupada';
    resultado.set(estado, (resultado.get(estado) ?? 0) + 1);
  }
  return Object.fromEntries(resultado);
}

/** Aviso de Stripe payment_intent.succeeded: la captura está confirmada, aunque la respuesta se perdiera. */
export async function liquidarDesdeAviso(db: D1Database, pedidoId: string, monto: number) {
  await marcarCapturada(db, pedidoId, monto);
}

/** Pieza «cobros» de la salud: error si algo está en revisión o lleva más de 2 horas sin capturar. */
export async function saludCobros(db: D1Database): Promise<'ok' | 'error'> {
  const f = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM liquidaciones WHERE estado = 'revision') AS revision,
              (SELECT COUNT(*) FROM liquidaciones WHERE estado IN ('pendiente', 'capturando', 'reintentar')
                 AND creado_en < datetime('now', '-2 hours')) AS atrasadas`,
    )
    .first<{ revision: number; atrasadas: number }>();
  return Number(f?.revision) + Number(f?.atrasadas) === 0 ? 'ok' : 'error';
}

/** Retiro: solo cuenta lo de pedidos con el cobro capturado (o sin cobro de Stripe). */
export const SOLO_LO_COBRADO = `NOT EXISTS (SELECT 1 FROM liquidaciones l WHERE l.pedido_id = movimientos.pedido_id
  AND l.estado NOT IN ('capturada', 'no_aplica'))`;

/** Para el administrador: las liquidaciones que esperan su revisión y las que llevan atraso. */
export async function liquidacionesParaRevisar(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT l.pedido_id, l.estado, l.pi, l.monto, l.intentos, l.error, l.creado_en, l.alertado_en, p.entregado_en
         FROM liquidaciones l JOIN pedidos p ON p.id = l.pedido_id
        WHERE l.estado = 'revision'
           OR (l.estado IN ('pendiente', 'capturando', 'reintentar') AND l.creado_en < datetime('now', '-2 hours'))
        ORDER BY l.creado_en LIMIT 200`,
    )
    .all<Record<string, unknown>>();
  const fila = (r: Record<string, unknown>) => ({
    pedidoId: String(r.pedido_id),
    estado: String(r.estado),
    paymentIntent: r.pi ? String(r.pi) : null,
    monto: Number(r.monto),
    intentos: Number(r.intentos),
    error: r.error ? String(r.error) : null,
    entregadoEn: r.entregado_en ? String(r.entregado_en) : null,
    alertadoEn: r.alertado_en ? String(r.alertado_en) : null,
  });
  return {
    revision: results.filter((r) => r.estado === 'revision').map(fila),
    atrasadas: results.filter((r) => r.estado !== 'revision').map(fila),
  };
}
