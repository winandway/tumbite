import { correosEquipo } from './avisosEquipo';
import { conciliar } from './conciliacion';
import { enviarCorreo } from './correo';
import type { Env } from './env';
import { ErrorStripe, crearStripe } from './stripe';
import { ErrorDatos } from './validar';

/**
 * C-AUTORIZACION-VENCIDA (16 nov 2026) — todos los países donde se cobra con tarjeta (hoy EE. UU.).
 * Ficha: docs/investigaciones-rea/2026-11-16-autorizacion-vencida.md.
 *
 * Divoox AUTORIZA la tarjeta al pedir y CAPTURA al entregar (C-COBRO-AL-ENTREGAR). Stripe suelta una
 * autorización sin capturar a los 7 días en las compras hechas por el cliente (CIT) y a los 4 días
 * y 18 horas en las de Visa iniciadas por el comercio (MIT, como la reautorización por cambio de
 * dirección) [DOC]; vencida, el pago queda `canceled` y la captura de la entrega falla: la entrega
 * queda «en revisión» y la salud en rojo. Pasó con el pedido de pruebas 407F (pagado el 8 nov,
 * entregado el 16 nov).
 *
 * Dos piezas:
 * 1. La resolución, desde la ficha del pedido del superadmin: (a) volver a cobrar con la tarjeta
 *    que el cliente dejó guardada para cobros futuros (`setup_future_usage = off_session`, como la
 *    propina después de entregar), o (b) cerrarla sin cobro con una nota. Las dos pasan por el
 *    control dual por encima del límite y dejan quién, cuándo, qué y por qué en la bitácora.
 * 2. El aviso ANTES de que venza, en un pedido todavía abierto: a las 96 horas de autorizado (antes
 *    del plazo más corto, 4 días y 18 horas), una sola vez por pedido.
 */

/** A las cuántas horas de autorizado se avisa (el plazo más corto de Stripe es 4 días y 18 horas). */
export const HORAS_AVISO_AUTORIZACION = 96;
/** Estados de un pedido todavía abierto, con la tarjeta autorizada y sin capturar. */
const ABIERTOS = ['pagado', 'aceptado', 'listo', 'en_camino'] as const;
const ABIERTOS_SQL = ABIERTOS.map((e) => `'${e}'`).join(', ');

type MetodoStripe = {
  id?: string;
  customer?: string | null;
  card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number } | null;
};
type IntentoStripe = {
  id?: string;
  status?: string;
  amount?: number;
  amount_capturable?: number;
  amount_received?: number;
  customer?: string | null;
  setup_future_usage?: string | null;
  cancellation_reason?: string | null;
  canceled_at?: number | null;
  created?: number;
  payment_method?: string | MetodoStripe | null;
  latest_charge?:
    | string
    | { payment_method_details?: { card?: { capture_before?: number | null } | null } | null }
    | null;
  metadata?: Record<string, string>;
};

type FilaLiquidacion = {
  pedido_id: string;
  estado: string;
  pi: string | null;
  monto: number;
  error: string | null;
  moneda: string | null;
  metodo_pago: string | null;
  entregado_en: string | null;
  stripe_cliente: string | null;
};

async function leerLiquidacion(db: D1Database, pedidoId: string) {
  return db
    .prepare(
      `SELECT l.pedido_id, l.estado, l.pi, l.monto, l.error, p.moneda, p.metodo_pago, p.entregado_en,
              u.stripe_cliente
         FROM liquidaciones l JOIN pedidos p ON p.id = l.pedido_id
         LEFT JOIN usuarios u ON u.id = p.cliente_id
        WHERE l.pedido_id = ?`,
    )
    .bind(pedidoId)
    .first<FilaLiquidacion>();
}

const segundosAFecha = (s: number | null | undefined) =>
  typeof s === 'number' && s > 0 ? new Date(s * 1000).toISOString() : null;

/**
 * Por qué no se puede volver a cobrar: un código (el panel lo dice en el idioma de quien mira) y el
 * mensaje del servidor (MENSAJES_EN lo traduce cuando la petición es en inglés).
 */
export const MOTIVOS_SIN_COBRO = {
  no_es_tarjeta: 'Este pedido no se pagó con tarjeta.',
  sin_consentimiento:
    'El cliente no dejó su tarjeta guardada para cobros futuros cuando pagó: no se le puede volver a cobrar sin él.',
  tarjeta_no_guardada: 'El cliente ya no tiene guardada la tarjeta con la que pagó.',
  otra_cuenta: 'La tarjeta del pago no es de la cuenta del cliente de este pedido.',
  tarjeta_vencida: 'La tarjeta guardada del cliente ya venció.',
} as const;
export type MotivoSinCobro = keyof typeof MOTIVOS_SIN_COBRO;

/** La tarjeta del pago y si sirve para cobrar sin el cliente presente (y por qué no). */
function evaluarTarjeta(pi: IntentoStripe, f: FilaLiquidacion, ahora: Date) {
  const pm = typeof pi.payment_method === 'object' ? pi.payment_method : null;
  const pmId = typeof pi.payment_method === 'string' ? pi.payment_method : (pm?.id ?? null);
  const tarjeta = pm?.card
    ? {
        marca: String(pm.card.brand ?? ''),
        ultimos4: String(pm.card.last4 ?? ''),
        vence:
          pm.card.exp_month && pm.card.exp_year ? `${pm.card.exp_month}/${pm.card.exp_year}` : '',
      }
    : null;
  let motivo: MotivoSinCobro | null = null;
  if (String(f.metodo_pago ?? 'tarjeta') !== 'tarjeta') motivo = 'no_es_tarjeta';
  // Sin este permiso del cliente (lo dio al pagar), cobrarle sin que esté presente no vale.
  else if (pi.setup_future_usage !== 'off_session') motivo = 'sin_consentimiento';
  else if (!pmId || !pm?.customer || !pi.customer || pm.customer !== pi.customer)
    motivo = 'tarjeta_no_guardada';
  else if (f.stripe_cliente && pi.customer !== f.stripe_cliente) motivo = 'otra_cuenta';
  else if (pm.card?.exp_year && pm.card.exp_month) {
    const finMes = Date.UTC(pm.card.exp_year, pm.card.exp_month, 1);
    if (finMes <= ahora.getTime()) motivo = 'tarjeta_vencida';
  }
  return { pmId, tarjeta, motivo };
}

type ErrorStripeCodigo = 'sin_stripe' | 'stripe_no_responde';

async function leerIntento(env: Env, pi: string) {
  const stripe = crearStripe(env.STRIPE_SECRET_KEY);
  if (!stripe) return { stripe: null, intento: null, error: 'sin_stripe' as const };
  try {
    const intento = await stripe.get<IntentoStripe>(`/payment_intents/${pi}`, {
      expand: ['payment_method', 'latest_charge'],
    });
    return { stripe, intento, error: null };
  } catch (e) {
    console.error('autorización vencida: no se pudo consultar el pago', pi, e);
    return { stripe, intento: null, error: 'stripe_no_responde' as const };
  }
}

/** El error de Stripe como ErrorDatos (409), para las dos decisiones. */
function sinStripe(error: ErrorStripeCodigo | null) {
  return new ErrorDatos(
    error === 'sin_stripe'
      ? 'Stripe no está configurado.'
      : 'No pudimos consultar el pago en Stripe.',
    undefined,
    409,
  );
}

/** La última resolución anotada en la bitácora del pedido (quién, cuándo, qué y la nota). */
async function resolucionDe(db: D1Database, pedidoId: string) {
  const r = await db
    .prepare(
      "SELECT detalle, creado_en FROM bitacora_pedidos WHERE pedido_id = ? AND evento = 'autorizacion_resuelta'",
    )
    .bind(pedidoId)
    .first<{ detalle: string; creado_en: string }>();
  if (!r) return null;
  try {
    return { ...(JSON.parse(r.detalle) as Record<string, unknown>), en: r.creado_en };
  } catch {
    console.error('autorización vencida: resolución ilegible en la bitácora', pedidoId);
    return { en: r.creado_en };
  }
}

/**
 * Lo que ve soporte en la ficha: el estado REAL del cobro en Stripe y qué se puede hacer. Solo lee
 * (una lectura en la base, una consulta a Stripe).
 */
export async function estadoAutorizacion(
  env: Env,
  db: D1Database,
  pedidoId: string,
  ahora = new Date(),
) {
  const f = await leerLiquidacion(db, pedidoId);
  if (!f) throw new ErrorDatos('Ese pedido no tiene un cobro de entrega.', undefined, 404);
  const base = {
    pedidoId,
    liquidacion: { estado: f.estado, monto: f.monto, moneda: f.moneda || 'USD', error: f.error },
    resolucion: f.estado === 'revision' ? null : await resolucionDe(db, pedidoId),
  };
  if (!f.pi)
    return {
      ...base,
      stripe: null,
      aviso: 'sin_pago',
      sePuedeResolver: false,
      sePuedeCobrar: false,
      motivoSinCobro: null,
    };
  const { intento, error } = await leerIntento(env, f.pi);
  if (!intento)
    return {
      ...base,
      stripe: null,
      aviso: error,
      sePuedeResolver: false,
      sePuedeCobrar: false,
      motivoSinCobro: null,
    };
  const cargo = typeof intento.latest_charge === 'object' ? intento.latest_charge : null;
  const vencida = intento.status === 'canceled';
  const t = evaluarTarjeta(intento, f, ahora);
  const sePuedeResolver = f.estado === 'revision' && vencida;
  // Un código por situación: el panel lo explica en el idioma de quien mira.
  const aviso =
    f.estado !== 'revision'
      ? null
      : intento.status === 'requires_capture'
        ? 'vigente'
        : intento.status === 'succeeded'
          ? 'ya_cobrada'
          : vencida
            ? null
            : 'otro_estado';
  return {
    ...base,
    stripe: {
      pago: String(intento.id ?? f.pi),
      estado: String(intento.status ?? ''),
      montoAutorizado: Number(intento.amount ?? 0),
      montoPorCapturar: Number(intento.amount_capturable ?? 0),
      montoCobrado: Number(intento.amount_received ?? 0),
      vencida,
      motivoCancelacion: intento.cancellation_reason ?? null,
      canceladaEn: segundosAFecha(intento.canceled_at),
      autorizadaEn: segundosAFecha(intento.created),
      capturarAntesDe: segundosAFecha(cargo?.payment_method_details?.card?.capture_before),
      consentimiento: intento.setup_future_usage === 'off_session',
      tarjeta: t.tarjeta,
    },
    aviso,
    sePuedeResolver,
    sePuedeCobrar: sePuedeResolver && !t.motivo,
    motivoSinCobro: sePuedeResolver ? t.motivo : null,
  };
}

export type Decision = {
  pedidoId: string;
  nota: string;
  actorId: string;
  /** La segunda firma (control dual), si la hubo. */
  aprobadorId: string | null;
};

async function nombreDe(db: D1Database, id: string | null) {
  if (!id) return null;
  return (
    (
      await db
        .prepare('SELECT nombre FROM usuarios WHERE id = ?')
        .bind(id)
        .first<{ nombre: string }>()
    )?.nombre ?? null
  );
}

/** La resolución en la bitácora (una por pedido) y la conciliación del día de la entrega al día. */
async function anotarResolucion(
  db: D1Database,
  d: Decision,
  f: FilaLiquidacion,
  decision: 'cobrado_de_nuevo' | 'sin_cobro',
  extra: Record<string, unknown> = {},
) {
  const detalle = JSON.stringify({
    decision,
    por: await nombreDe(db, d.actorId),
    porId: d.actorId,
    aprobo: await nombreDe(db, d.aprobadorId),
    aproboId: d.aprobadorId,
    nota: d.nota.slice(0, 500),
    monto: f.monto,
    moneda: f.moneda || 'USD',
    ...extra,
  });
  return db
    .prepare(
      "INSERT OR IGNORE INTO bitacora_pedidos (pedido_id, evento, detalle) VALUES (?, 'autorizacion_resuelta', ?)",
    )
    .bind(d.pedidoId, detalle);
}

/**
 * Si el día de la entrega ya se concilió, se vuelve a calcular (el canario «dinero» mira los últimos
 * 30 días): con el cobro nuevo o el cierre sin cobro, ese día vuelve a cuadrar. Una escritura.
 */
async function reconciliarDia(db: D1Database, f: FilaLiquidacion) {
  const dia = f.entregado_en ? String(f.entregado_en).slice(0, 10) : null;
  if (!dia) return;
  const hecha = await db
    .prepare('SELECT 1 AS si FROM conciliaciones WHERE dia = ?')
    .bind(dia)
    .first<{ si: number }>();
  if (hecha)
    await conciliar(db, dia).catch((e: unknown) =>
      console.error('autorización vencida: no se pudo recalcular la conciliación', dia, e),
    );
}

/** Lo que ya está resuelto se devuelve tal cual (el doble clic no hace nada dos veces). */
function yaResuelta(f: FilaLiquidacion, quiere: 'capturada' | 'no_aplica') {
  if (f.estado === quiere) return { estado: f.estado, yaEstaba: true };
  if (f.estado === 'capturada' || f.estado === 'no_aplica')
    throw new ErrorDatos('Esta entrega ya se resolvió de otra forma.', undefined, 409);
  if (f.estado !== 'revision')
    throw new ErrorDatos('Esta entrega no está en revisión.', undefined, 409);
  return null;
}

/**
 * (a) Volver a cobrar con la tarjeta guardada, por el monto de la entrega. Seguro ante el doble
 * clic y ante una respuesta perdida: antes de cobrar busca en Stripe un cobro de reemplazo de este
 * mismo pago, y el cobro lleva una clave de idempotencia fija por pedido.
 */
export async function volverACobrar(env: Env, db: D1Database, d: Decision) {
  const f = await leerLiquidacion(db, d.pedidoId);
  if (!f) throw new ErrorDatos('Ese pedido no tiene un cobro de entrega.', undefined, 404);
  const hecho = yaResuelta(f, 'capturada');
  if (hecho) return hecho;
  if (!f.pi) throw new ErrorDatos('Esta entrega no tiene un pago de Stripe.', undefined, 409);
  const { stripe, intento, error } = await leerIntento(env, f.pi);
  if (!stripe || !intento) throw sinStripe(error);
  if (intento.status !== 'canceled')
    throw new ErrorDatos(
      'La autorización de este pago no venció: no hace falta volver a cobrar.',
      undefined,
      409,
    );
  const t = evaluarTarjeta(intento, f, new Date());
  if (t.motivo || !t.pmId || !intento.customer)
    throw new ErrorDatos(
      new Map<string, string>(Object.entries(MOTIVOS_SIN_COBRO)).get(
        t.motivo ?? 'tarjeta_no_guardada',
      ) ?? 'El cliente ya no tiene guardada la tarjeta con la que pagó.',
      undefined,
      409,
    );

  // ¿Ya hay un cobro de reemplazo de este pago? (una respuesta perdida, otra pestaña): se usa ese.
  let nuevo: IntentoStripe | null;
  try {
    const lista = await stripe.get<{ data?: IntentoStripe[] }>('/payment_intents', {
      customer: intento.customer,
      limit: 100,
    });
    nuevo =
      (lista.data ?? []).find(
        (x) =>
          x.metadata?.recobro_de === f.pi && ['succeeded', 'processing'].includes(String(x.status)),
      ) ?? null;
  } catch (e) {
    console.error('autorización vencida: no se pudo revisar si ya había un cobro', d.pedidoId, e);
    throw new ErrorDatos('No pudimos consultar el pago en Stripe.', undefined, 409);
  }
  if (!nuevo) {
    try {
      nuevo = await stripe.post<IntentoStripe>(
        '/payment_intents',
        {
          amount: f.monto,
          currency: (f.moneda || 'USD').toLowerCase(),
          customer: intento.customer,
          payment_method: t.pmId,
          off_session: true,
          confirm: true,
          description: 'Divoox · cobro de un pedido entregado (la autorización venció)',
          metadata: { pedido_id: d.pedidoId, recobro_de: f.pi },
        },
        // Fija por pedido: dos clics o dos personas a la vez dan UN solo cobro.
        `recobro-${d.pedidoId}`,
      );
    } catch (e) {
      const msg = e instanceof ErrorStripe ? e.message : String((e as Error)?.message ?? e);
      console.error('autorización vencida: la tarjeta no aceptó el cobro', d.pedidoId, msg);
      if (!(e instanceof ErrorStripe && e.codigo === 'idempotency_key_in_use'))
        await db
          .prepare(
            "UPDATE liquidaciones SET error = ?, actualizado_en = datetime('now') WHERE pedido_id = ? AND estado = 'revision'",
          )
          .bind(`Volver a cobrar: ${msg}`.slice(0, 300), d.pedidoId)
          .run();
      throw new ErrorDatos(
        e instanceof ErrorStripe && e.codigo === 'idempotency_key_in_use'
          ? 'Este cobro ya se está haciendo. Espera unos segundos y vuelve a abrir la ficha.'
          : e instanceof ErrorStripe && e.estado === 402
            ? 'La tarjeta del cliente rechazó el cobro. Ciérralo sin cobro o habla con el cliente.'
            : 'No pudimos cobrar con la tarjeta guardada. Intenta de nuevo en unos minutos.',
        undefined,
        409,
      );
    }
  }
  if (nuevo.status !== 'succeeded' || !nuevo.id) {
    // El banco pide que el cliente confirme (o el cobro no terminó): no se anota nada como cobrado.
    console.error('autorización vencida: cobro sin terminar', d.pedidoId, nuevo.id, nuevo.status);
    if (nuevo.id && nuevo.status === 'requires_action')
      await stripe
        .post(`/payment_intents/${nuevo.id}/cancel`, {}, `anula-${nuevo.id}`)
        .catch((e: unknown) => console.error('autorización vencida: anular el cobro a medias', e));
    throw new ErrorDatos(
      'El banco del cliente pide que él confirme el cobro: no se puede cobrar sin él. Ciérralo sin cobro o habla con el cliente.',
      undefined,
      409,
    );
  }
  const cobrado = Number(nuevo.amount_received ?? f.monto);
  await db.batch([
    db
      .prepare(
        `UPDATE liquidaciones SET estado = 'capturada', pi = ?, capturado_en = datetime('now'), error = NULL,
           actualizado_en = datetime('now') WHERE pedido_id = ? AND estado <> 'capturada'`,
      )
      .bind(nuevo.id, d.pedidoId),
    db
      .prepare(
        "UPDATE cobros SET capturado_en = COALESCE(capturado_en, datetime('now')), capturado = COALESCE(capturado, ?) WHERE pedido_id = ?",
      )
      .bind(cobrado, d.pedidoId),
    // Las devoluciones de después van contra el cobro nuevo, y el aviso de Stripe de ese cobro
    // (payment_intent.succeeded) lo reconoce como del pedido, igual que en el cambio de dirección.
    db
      .prepare('UPDATE pedidos SET stripe_pago = ?, stripe_sesion = ? WHERE id = ?')
      .bind(nuevo.id, nuevo.id, d.pedidoId),
    // LAN-2z: la conciliación de diagnóstico exige en Stripe que el pago reemplazado esté anulado.
    db
      .prepare(
        'INSERT OR IGNORE INTO bitacora_pedidos (pedido_id, evento, detalle) VALUES (?, ?, ?)',
      )
      .bind(d.pedidoId, `cobro_reautorizado:${f.pi}`, `${f.pi}>${nuevo.id}`),
    await anotarResolucion(db, d, f, 'cobrado_de_nuevo', { pagoNuevo: nuevo.id, cobrado }),
  ]);
  await reconciliarDia(db, f);
  return { estado: 'capturada', pago: nuevo.id, cobrado };
}

/**
 * (b) Cerrarla sin cobro: Divoox asume el monto. El saldo ya anotado al restaurante y al repartidor
 * se conserva y se puede retirar (la decisión del 16 oct: en revisión se conserva el saldo). Solo
 * si Stripe confirma que el pago ya no se puede capturar ni está cobrado: nunca se esconde dinero.
 */
export async function cerrarSinCobro(env: Env, db: D1Database, d: Decision) {
  if (d.nota.trim().length < 5)
    throw new ErrorDatos('Escribe en la nota por qué se cierra sin cobro.', 'nota', 400);
  const f = await leerLiquidacion(db, d.pedidoId);
  if (!f) throw new ErrorDatos('Ese pedido no tiene un cobro de entrega.', undefined, 404);
  const hecho = yaResuelta(f, 'no_aplica');
  if (hecho) return hecho;
  if (f.pi) {
    const { intento, error } = await leerIntento(env, f.pi);
    if (!intento) throw sinStripe(error);
    if (intento.status !== 'canceled')
      throw new ErrorDatos(
        'Stripe no muestra este pago como vencido: no se puede cerrar sin cobro.',
        undefined,
        409,
      );
  }
  const r = await db.batch([
    db
      .prepare(
        `UPDATE liquidaciones SET estado = 'no_aplica', error = ?, actualizado_en = datetime('now')
          WHERE pedido_id = ? AND estado = 'revision'`,
      )
      .bind(`Cerrada sin cobro: ${d.nota.trim()}`.slice(0, 300), d.pedidoId),
    await anotarResolucion(db, d, f, 'sin_cobro'),
  ]);
  if (!r[0]?.meta.changes) {
    const otra = await leerLiquidacion(db, d.pedidoId);
    if (otra?.estado === 'no_aplica') return { estado: 'no_aplica', yaEstaba: true };
    throw new ErrorDatos('Esta entrega ya se resolvió de otra forma.', undefined, 409);
  }
  await reconciliarDia(db, f);
  return { estado: 'no_aplica' };
}

// ─────────────────────────────── El aviso antes de que venza ───────────────────────────────

/**
 * Tarea del reloj (cada hora): los pedidos abiertos con la tarjeta autorizada hace 96 horas o más
 * y sin capturar. Una fila en la bitácora por pedido (la clave única pedido + evento impide la
 * segunda) y un correo al equipo de dinero solo cuando la fila es nueva. Lee por el índice de
 * estado (pocos pedidos abiertos) y escribe como mucho una fila por pedido avisado.
 */
export async function avisarAutorizacionesPorVencer(env: Env, db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT p.id, p.total, p.moneda, c.autorizado_en FROM pedidos p INDEXED BY pedidos_estado
         JOIN cobros c ON c.pedido_id = p.id
        WHERE p.estado IN (${ABIERTOS_SQL}) AND p.metodo_pago = 'tarjeta'
          AND c.capturado_en IS NULL AND c.cancelado_en IS NULL
          AND c.autorizado_en <= datetime('now', ?)
          AND NOT EXISTS (SELECT 1 FROM bitacora_pedidos b WHERE b.pedido_id = p.id AND b.evento = 'autorizacion_por_vencer')
        LIMIT 25`,
    )
    .bind(`-${HORAS_AVISO_AUTORIZACION} hours`)
    .all<{ id: string; total: number; moneda: string | null; autorizado_en: string }>();
  let avisados = 0;
  for (const p of results) {
    const r = await db
      .prepare(
        "INSERT OR IGNORE INTO bitacora_pedidos (pedido_id, evento, detalle) VALUES (?, 'autorizacion_por_vencer', ?)",
      )
      .bind(p.id, `Autorizada el ${p.autorizado_en} UTC`)
      .run();
    if (!r.meta.changes) continue;
    avisados++;
    for (const para of await correosEquipo(env, 'dinero'))
      await enviarCorreo(env, {
        de: 'avisos',
        para,
        asunto: `Autorización por vencer: pedido ${p.id.slice(0, 8)}`,
        texto: `El pedido ${p.id} sigue abierto y su tarjeta se autorizó el ${p.autorizado_en} UTC (${p.total} centavos, ${p.moneda || 'USD'}). Stripe suelta la autorización a los 7 días (Visa, 4 días y 18 horas si la inició Divoox). Entrégalo o cancélalo antes; si vence, resuélvelo desde la ficha del pedido con «Resolver autorización vencida».`,
      }).catch((e: unknown) => console.error('autorización por vencer: correo', p.id, e));
  }
  return avisados;
}

/**
 * Pieza «autorizaciones» del canario: «pendiente» (a la vista, no rojo) si un pedido abierto lleva
 * su tarjeta autorizada 96 horas o más sin capturar. Lee por el índice de estado.
 */
export async function saludAutorizaciones(db: D1Database): Promise<'ok' | 'pendiente'> {
  const f = await db
    .prepare(
      `SELECT 1 AS si FROM pedidos p INDEXED BY pedidos_estado JOIN cobros c ON c.pedido_id = p.id
        WHERE p.estado IN (${ABIERTOS_SQL}) AND p.metodo_pago = 'tarjeta'
          AND c.capturado_en IS NULL AND c.cancelado_en IS NULL
          AND c.autorizado_en <= datetime('now', ?) LIMIT 1`,
    )
    .bind(`-${HORAS_AVISO_AUTORIZACION} hours`)
    .first<{ si: number }>();
  return f ? 'pendiente' : 'ok';
}
