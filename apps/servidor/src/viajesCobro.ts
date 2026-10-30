import type { Env } from './env';
import { nuevoId } from './cripto';
import { crearStripe } from './stripe';
import { ErrorDatos } from './validar';

/**
 * C-VIAJE-TARJETA (29 oct 2026), copiado del circuito de Comida y de Uber: el viaje con tarjeta se
 * AUTORIZA al pedir por el precio fijo de la cotización, se CAPTURA al terminar (nunca más de lo
 * autorizado) y, si se cancela, se anula la autorización o se cobra solo el cargo. La comisión de
 * Divoox sigue saliendo del prepago del conductor (regla de monetización); lo que paga el pasajero
 * con tarjeta se le acredita entero al conductor en su billetera, como una entrega de Comida.
 */
type Usuario = { id: string; correo: string; nombre: string };

async function clienteStripe(env: Env, db: D1Database, u: Usuario) {
  const stripe = crearStripe(env.STRIPE_SECRET_KEY);
  if (!stripe)
    throw new ErrorDatos('Los pagos con tarjeta todavía no están activados.', undefined, 422);
  const f = await db
    .prepare('SELECT stripe_cliente FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ stripe_cliente: string | null }>();
  if (f?.stripe_cliente) return { stripe, cliente: f.stripe_cliente };
  const c = await stripe.post<{ id: string }>(
    '/customers',
    { email: u.correo, name: u.nombre, metadata: { usuario_id: u.id } },
    `cliente-${u.id}`,
  );
  await db.prepare('UPDATE usuarios SET stripe_cliente = ? WHERE id = ?').bind(c.id, u.id).run();
  return { stripe, cliente: c.id };
}

/** Abre el cobro: autorización por el precio fijo. La app paga con la hoja de pago de siempre. */
export async function abrirCobroViaje(
  env: Env,
  db: D1Database,
  u: Usuario,
  operacionId: string,
  monto: number,
  moneda: string,
) {
  const { stripe, cliente } = await clienteStripe(env, db, u);
  const intento = await stripe.post<{ id: string; client_secret: string }>(
    '/payment_intents',
    {
      amount: monto,
      currency: moneda.toLowerCase(),
      customer: cliente,
      automatic_payment_methods: { enabled: true },
      capture_method: 'manual',
      // Igual que Comida (C-PAGO-FORMULARIO): sin esto la hoja de pago no se pinta.
      setup_future_usage: 'off_session',
      description: 'Divoox · viaje',
      metadata: { viaje_id: operacionId },
    },
    `viaje-${operacionId}`,
  );
  await db
    .prepare('INSERT OR IGNORE INTO cobros_viaje (operacion_id, stripe_pago) VALUES (?, ?)')
    .bind(operacionId, intento.id)
    .run();
  const funciones = {
    payment_method_save: 'enabled',
    payment_method_redisplay: 'enabled',
    payment_method_remove: 'enabled',
  };
  const sesion = await stripe.post<{ client_secret: string }>('/customer_sessions', {
    customer: cliente,
    components: {
      payment_element: { enabled: true, features: funciones },
      mobile_payment_element: { enabled: true, features: funciones },
    },
  });
  return {
    clientSecret: intento.client_secret,
    sesionCliente: sesion.client_secret,
    clienteStripe: cliente,
    clavePublica: env.STRIPE_PUBLISHABLE_KEY ?? '',
  };
}

/**
 * Aviso firmado de Stripe: la tarjeta quedó autorizada por el monto exacto. Devuelve true si el viaje
 * pasó de «pago pendiente» a buscar conductor. Nunca por lo que diga la app.
 */
export async function autorizacionViaje(
  db: D1Database,
  obj: Record<string, unknown>,
): Promise<string | null> {
  const op = (obj.metadata as Record<string, string> | undefined)?.viaje_id;
  if (!op) return null;
  const f = await db
    .prepare(
      `SELECT c.stripe_pago, c.estado, q.total FROM cobros_viaje c JOIN viajes v ON v.operacion_id = c.operacion_id
         JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id WHERE c.operacion_id = ?`,
    )
    .bind(op)
    .first<{ stripe_pago: string; estado: string; total: number }>();
  if (!f || f.stripe_pago !== obj.id || Number(obj.amount_capturable) !== Number(f.total)) {
    console.error('viaje: aviso de autorización que no cuadra', op, obj.amount_capturable);
    return null;
  }
  if (f.estado !== 'pendiente') return null;
  await db
    .prepare(
      "UPDATE cobros_viaje SET estado = 'autorizado', autorizado = ?, actualizado_en = datetime('now') WHERE operacion_id = ? AND estado = 'pendiente'",
    )
    .bind(Number(f.total), op)
    .run();
  return op;
}

/** Al terminar: captura lo que corresponde (nunca más de lo autorizado) y paga al conductor. */
export async function capturarCobroViaje(
  env: Env,
  db: D1Database,
  operacionId: string,
  conductorId: string,
  total: number,
) {
  const f = await db
    .prepare('SELECT stripe_pago, estado, autorizado FROM cobros_viaje WHERE operacion_id = ?')
    .bind(operacionId)
    .first<{ stripe_pago: string; estado: string; autorizado: number }>();
  if (!f || f.estado !== 'autorizado') return 0;
  const monto = Math.min(total, Number(f.autorizado));
  const stripe = crearStripe(env.STRIPE_SECRET_KEY);
  if (!stripe) throw new ErrorDatos('No pudimos cobrar el viaje en este momento.', undefined, 503);
  await stripe.post(
    `/payment_intents/${f.stripe_pago}/capture`,
    { amount_to_capture: monto },
    `capturar-viaje-${operacionId}`,
  );
  await db.batch([
    db
      .prepare(
        "UPDATE cobros_viaje SET estado = 'capturado', capturado = ?, actualizado_en = datetime('now') WHERE operacion_id = ? AND estado = 'autorizado'",
      )
      .bind(monto, operacionId),
    // Lo que pagó el pasajero va entero al conductor (la comisión ya salió de su prepago).
    db
      .prepare(
        `INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia)
         SELECT ?, ?, ?, 'entrega', ? WHERE NOT EXISTS (SELECT 1 FROM movimientos WHERE referencia = ?)`,
      )
      .bind(
        nuevoId(),
        conductorId,
        monto,
        `viaje-tarjeta-${operacionId}`,
        `viaje-tarjeta-${operacionId}`,
      ),
  ]);
  return monto;
}

/** Al cancelar o quedarse sin conductor: cobra solo el cargo, o anula la autorización. */
export async function soltarCobroViaje(
  env: Env,
  db: D1Database,
  operacionId: string,
  cargo: number,
) {
  const f = await db
    .prepare('SELECT stripe_pago, estado, autorizado FROM cobros_viaje WHERE operacion_id = ?')
    .bind(operacionId)
    .first<{ stripe_pago: string; estado: string; autorizado: number }>();
  if (!f || (f.estado !== 'autorizado' && f.estado !== 'pendiente')) return 0;
  const stripe = crearStripe(env.STRIPE_SECRET_KEY);
  if (!stripe) return 0;
  if (cargo > 0 && f.estado === 'autorizado') {
    const monto = Math.min(cargo, Number(f.autorizado));
    await stripe.post(
      `/payment_intents/${f.stripe_pago}/capture`,
      { amount_to_capture: monto },
      `cargo-viaje-${operacionId}`,
    );
    await db
      .prepare(
        "UPDATE cobros_viaje SET estado = 'capturado', capturado = ?, actualizado_en = datetime('now') WHERE operacion_id = ?",
      )
      .bind(monto, operacionId)
      .run();
    return monto;
  }
  await stripe.post(`/payment_intents/${f.stripe_pago}/cancel`, {}, `anular-viaje-${operacionId}`);
  await db
    .prepare(
      "UPDATE cobros_viaje SET estado = 'anulado', actualizado_en = datetime('now') WHERE operacion_id = ?",
    )
    .bind(operacionId)
    .run();
  return 0;
}

/**
 * C-VIAJE-PROPINA (29 oct 2026), copiado de la propina posterior de Comida: después de un viaje pagado
 * con tarjeta, el pasajero deja propina con la tarjeta guardada, una vez y hasta 7 días después. Va
 * entera al conductor; el movimiento existe solo si Stripe confirmó el cobro.
 */
export async function propinaViaje(
  env: Env,
  db: D1Database,
  clienteId: string,
  operacionId: string,
  centavos: number,
) {
  const f = await db
    .prepare(
      `SELECT o.conductor_id, o.estado_general, v.terminado_en, c.stripe_pago, c.estado, c.propina,
              u.stripe_cliente, q.moneda
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
         JOIN cobros_viaje c ON c.operacion_id = o.id
         JOIN usuarios u ON u.id = o.cliente_id
         LEFT JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id
        WHERE o.id = ? AND o.cliente_id = ?`,
    )
    .bind(operacionId, clienteId)
    .first<{
      conductor_id: string | null;
      estado_general: string;
      terminado_en: string | null;
      stripe_pago: string;
      estado: string;
      propina: number;
      stripe_cliente: string | null;
      moneda: string | null;
    }>();
  if (!f)
    throw new ErrorDatos(
      'La propina con tarjeta es para viajes pagados con tarjeta.',
      undefined,
      409,
    );
  if (f.estado_general !== 'terminada' || f.estado !== 'capturado' || !f.conductor_id)
    throw new ErrorDatos('La propina se agrega cuando el viaje ya terminó.', undefined, 409);
  if (f.propina > 0) throw new ErrorDatos('Ya dejaste una propina en este viaje.', undefined, 409);
  if (Date.now() - Date.parse(`${String(f.terminado_en).replace(' ', 'T')}Z`) > 7 * 86_400_000)
    throw new ErrorDatos(
      'La propina se puede agregar hasta 7 días después del viaje.',
      undefined,
      409,
    );
  const stripe = crearStripe(env.STRIPE_SECRET_KEY);
  if (!stripe)
    throw new ErrorDatos('Los pagos con tarjeta todavía no están activados.', undefined, 422);
  const original = await stripe.get<{ payment_method?: string | null }>(
    `/payment_intents/${f.stripe_pago}`,
  );
  if (!original.payment_method || !f.stripe_cliente)
    throw new ErrorDatos(
      'No encontramos una tarjeta guardada para cobrar la propina.',
      undefined,
      409,
    );
  const cobro = await stripe
    .post<{ id: string; status?: string }>(
      '/payment_intents',
      {
        amount: centavos,
        currency: (f.moneda ?? 'USD').toLowerCase(),
        customer: f.stripe_cliente,
        payment_method: original.payment_method,
        off_session: true,
        confirm: true,
        description: 'Divoox · propina del viaje',
        metadata: { viaje_id: operacionId, propina_viaje: '1' },
      },
      `propina-viaje-${operacionId}`,
    )
    .catch(() => null);
  if (cobro?.status !== 'succeeded')
    throw new ErrorDatos(
      'No pudimos cobrar la propina con tu tarjeta guardada. Intenta más tarde.',
      undefined,
      409,
    );
  await db.batch([
    db
      .prepare(
        "UPDATE cobros_viaje SET propina = ?, actualizado_en = datetime('now') WHERE operacion_id = ? AND propina = 0",
      )
      .bind(centavos, operacionId),
    db
      .prepare(
        `INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia)
         SELECT ?, ?, ?, 'propina', ? WHERE NOT EXISTS (SELECT 1 FROM movimientos WHERE referencia = ?)`,
      )
      .bind(
        nuevoId(),
        f.conductor_id,
        centavos,
        `propina-viaje-${operacionId}`,
        `propina-viaje-${operacionId}`,
      ),
  ]);
  return centavos;
}
