import { avisoCobroAutorizacionVencida } from './avisos';
import { correosEquipo } from './avisosEquipo';
import { conciliar } from './conciliacion';
import { enviarCorreo } from './correo';
import type { Env } from './env';
import { guardarError } from './errores';
import { ErrorStripe, type Stripe, crearStripe } from './stripe';
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

/**
 * EL INTERRUPTOR de «Volver a cobrar» (revisión de calidad B1, 16 nov 2026): vive en UN solo lugar,
 * la variable `RECOBRO_TARJETA_ACTIVO` del sitio, y está APAGADO por defecto (también en pruebas)
 * hasta que Richard confirme que los términos y la pantalla de pago cubren cobrar la tarjeta
 * guardada cuando una retención vence (PENDIENTES.md). Apagado, el servidor rechaza el cobro con
 * 409 y el panel no muestra el botón. «Cerrar sin cobro» no depende de él.
 */
export const recobroEncendido = (env: Pick<Env, 'RECOBRO_TARJETA_ACTIVO'>) =>
  env.RECOBRO_TARJETA_ACTIVO === '1';
export const MENSAJE_RECOBRO_APAGADO =
  'Volver a cobrar está apagado hasta confirmar el texto legal. Usa «Cerrar sin cobro» o habla con el cliente.';
export function exigirRecobroEncendido(env: Pick<Env, 'RECOBRO_TARJETA_ACTIVO'>) {
  if (!recobroEncendido(env)) throw new ErrorDatos(MENSAJE_RECOBRO_APAGADO, undefined, 409);
}

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
/** Lo que trae el aviso de Stripe (webhook) de un cobro de reemplazo. */
export type AvisoIntento = {
  id?: unknown;
  status?: unknown;
  amount_received?: unknown;
  metadata?: unknown;
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
    // B1: el panel no muestra «Volver a cobrar» mientras el interruptor esté apagado.
    cobroEncendido: recobroEncendido(env),
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
  const { stripe, intento, error } = await leerIntento(env, f.pi);
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
  // Menor 3: un cobro de reemplazo que el banco todavía procesa («processing») no se puede repetir
  // ni cerrar sin cobro: se muestra «en curso» hasta que Stripe avise cómo terminó.
  const enCurso =
    f.estado === 'revision' && vencida && stripe ? await cobroEnCurso(db, stripe, pedidoId) : null;
  const sePuedeResolver = f.estado === 'revision' && vencida && !enCurso;
  // Un código por situación: el panel lo explica en el idioma de quien mira.
  const aviso =
    f.estado !== 'revision'
      ? null
      : intento.status === 'requires_capture'
        ? 'vigente'
        : intento.status === 'succeeded'
          ? 'ya_cobrada'
          : enCurso
            ? 'cobro_en_curso'
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
    sePuedeCobrar: sePuedeResolver && !t.motivo && base.cobroEncendido,
    motivoSinCobro: sePuedeResolver ? t.motivo : null,
  };
}

// ───────────────────────── Piezas del cobro de reemplazo (revisión de calidad) ─────────────────────────

/**
 * El cobro de reemplazo de un pago vencido que Stripe ya tiene (hecho o en curso). Es la protección
 * principal contra el doble cobro: se consulta ANTES de cobrar y antes de cerrar sin cobro.
 */
async function cobroDeReemplazo(stripe: Stripe, cliente: string, piViejo: string) {
  const lista = await stripe.get<{ data?: IntentoStripe[] }>('/payment_intents', {
    customer: cliente,
    limit: 100,
  });
  return (
    (lista.data ?? []).find(
      (x) =>
        x.metadata?.recobro_de === piViejo &&
        ['succeeded', 'processing'].includes(String(x.status)),
    ) ?? null
  );
}

/**
 * Menor 3: el último cobro de reemplazo anotado «en curso» (processing) de este pedido, si Stripe
 * todavía lo tiene en curso. Una lectura por la clave (pedido, evento) y una consulta a Stripe,
 * solo cuando hay uno anotado.
 */
async function cobroEnCurso(db: D1Database, stripe: Stripe, pedidoId: string) {
  const fila = await db
    .prepare(
      "SELECT evento FROM bitacora_pedidos WHERE pedido_id = ? AND evento LIKE 'recobro_en_curso:%' ORDER BY id DESC LIMIT 1",
    )
    .bind(pedidoId)
    .first<{ evento: string }>();
  if (!fila) return null;
  const pi = fila.evento.slice('recobro_en_curso:'.length);
  try {
    const x = await stripe.get<IntentoStripe>(`/payment_intents/${pi}`);
    return x.status === 'processing' ? pi : null;
  } catch (e) {
    console.error('autorización vencida: no se pudo consultar el cobro en curso', pi, e);
    // Sin saber cómo va, se trata como en curso: es lo que evita un segundo cobro.
    return pi;
  }
}

/**
 * Menor 2: la clave de idempotencia lleva un contador de intentos que Stripe ya contestó sin
 * cobrar (rechazo, banco que pide confirmar, «processing» que después falla). Así un reintento
 * de verdad no recibe por 24 horas la misma respuesta guardada. El contador vive en la bitácora
 * (`recobro_intento:<n>`, una fila por intento gastado, única por pedido). Dos clics a la vez leen
 * el mismo contador y usan la MISMA clave (un solo cobro); una respuesta perdida (Stripe no
 * contestó) NO gasta la clave, y el reintento recibe lo que Stripe guardó. Antes de cobrar sigue la
 * búsqueda de `recobro_de` (cobroDeReemplazo).
 */
async function intentosGastados(db: D1Database, pedidoId: string) {
  const f = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM bitacora_pedidos WHERE pedido_id = ? AND evento LIKE 'recobro_intento:%'",
    )
    .bind(pedidoId)
    .first<{ n: number }>();
  return Number(f?.n ?? 0);
}
export const claveRecobro = (pedidoId: string, gastados: number) =>
  gastados ? `recobro-${pedidoId}-${gastados}` : `recobro-${pedidoId}`;
const gastarClave = (db: D1Database, pedidoId: string, gastados: number, motivo: string) =>
  db
    .prepare('INSERT OR IGNORE INTO bitacora_pedidos (pedido_id, evento, detalle) VALUES (?, ?, ?)')
    .bind(pedidoId, `recobro_intento:${gastados + 1}`, motivo.slice(0, 300));

/** Menor 5: lo que ya se devolvió de este pedido (las dos tablas de devoluciones). */
async function devueltoDe(db: D1Database, pedidoId: string) {
  const f = await db
    .prepare(
      `SELECT (SELECT COALESCE(SUM(monto), 0) FROM devoluciones WHERE pedido_id = ?)
            + (SELECT COALESCE(SUM(monto), 0) FROM devoluciones_ajuste WHERE pedido_id = ?) AS n`,
    )
    .bind(pedidoId, pedidoId)
    .first<{ n: number }>();
  return Number(f?.n ?? 0);
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
  if (decision === 'sin_cobro')
    return db
      .prepare(
        "INSERT OR IGNORE INTO bitacora_pedidos (pedido_id, evento, detalle) VALUES (?, 'autorizacion_resuelta', ?)",
      )
      .bind(d.pedidoId, detalle);
  // Menor 4: si el cobro salió bien después de que otra persona la cerrara sin cobro (las dos a la
  // vez), el dinero manda: la resolución pasa a «cobrado de nuevo» y guarda lo que reemplazó, para
  // que el historial nunca contradiga a Stripe. Un cobro ya anotado no se pisa.
  return db
    .prepare(
      `INSERT INTO bitacora_pedidos (pedido_id, evento, detalle) VALUES (?, 'autorizacion_resuelta', ?)
       ON CONFLICT (pedido_id, evento) DO UPDATE SET
         detalle = json_set(excluded.detalle, '$.reemplaza', json_extract(bitacora_pedidos.detalle, '$.decision'),
                            '$.notaReemplazada', json_extract(bitacora_pedidos.detalle, '$.nota')),
         creado_en = datetime('now')
       WHERE json_extract(bitacora_pedidos.detalle, '$.decision') IS NOT 'cobrado_de_nuevo'`,
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
 * (a) Volver a cobrar con la tarjeta guardada, por el monto de la entrega. Solo con el interruptor
 * encendido (B1). Seguro ante el doble clic y ante una respuesta perdida: antes de cobrar busca en
 * Stripe un cobro de reemplazo de este mismo pago, y el cobro lleva una clave de idempotencia por
 * pedido y por intento gastado (menor 2).
 */
export async function volverACobrar(env: Env, db: D1Database, d: Decision) {
  // B1: también aquí (no solo en la ruta), por si una aprobación quedó pendiente antes de apagarlo.
  exigirRecobroEncendido(env);
  const f = await leerLiquidacion(db, d.pedidoId);
  if (!f) throw new ErrorDatos('Ese pedido no tiene un cobro de entrega.', undefined, 404);
  const hecho = yaResuelta(f, 'capturada');
  if (hecho) return hecho;
  if (!f.pi) throw new ErrorDatos('Esta entrega no tiene un pago de Stripe.', undefined, 409);
  // Menor 5: con devoluciones anotadas no se cobra desde aquí (hoy no se alcanza: una devolución
  // exige el cobro capturado; si algún día pasa, nunca se cobra de más).
  if ((await devueltoDe(db, d.pedidoId)) > 0)
    throw new ErrorDatos(
      'Este pedido ya tiene devoluciones anotadas: no se vuelve a cobrar desde aquí. Ciérralo sin cobro o habla con Finanzas.',
      undefined,
      409,
    );
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
    nuevo = await cobroDeReemplazo(stripe, intento.customer, f.pi);
  } catch (e) {
    console.error('autorización vencida: no se pudo revisar si ya había un cobro', d.pedidoId, e);
    throw new ErrorDatos('No pudimos consultar el pago en Stripe.', undefined, 409);
  }
  const gastados = nuevo ? 0 : await intentosGastados(db, d.pedidoId);
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
        // Por pedido y por intento gastado: dos clics o dos personas a la vez dan UN solo cobro.
        claveRecobro(d.pedidoId, gastados),
      );
    } catch (e) {
      const msg = e instanceof ErrorStripe ? e.message : String((e as Error)?.message ?? e);
      console.error('autorización vencida: la tarjeta no aceptó el cobro', d.pedidoId, msg);
      if (e instanceof ErrorStripe && e.codigo === 'idempotency_key_in_use')
        throw new ErrorDatos(
          'Este cobro ya se está haciendo. Espera unos segundos y vuelve a abrir la ficha.',
          undefined,
          409,
        );
      // Stripe contestó (4xx): esa respuesta queda guardada con la clave, así que se gasta y el
      // próximo intento usa otra. Sin respuesta (red, 5xx) no se sabe si cobró: la clave se
      // conserva y el reintento recibe lo que Stripe haya guardado (nunca dos cobros).
      const contesto = e instanceof ErrorStripe && e.estado >= 400 && e.estado < 500;
      await db.batch([
        db
          .prepare(
            "UPDATE liquidaciones SET error = ?, actualizado_en = datetime('now') WHERE pedido_id = ? AND estado = 'revision'",
          )
          .bind(`Volver a cobrar: ${msg}`.slice(0, 300), d.pedidoId),
        ...(contesto ? [gastarClave(db, d.pedidoId, gastados, `Stripe: ${msg}`)] : []),
      ]);
      throw new ErrorDatos(
        e instanceof ErrorStripe && e.estado === 402
          ? 'La tarjeta del cliente rechazó el cobro. Ciérralo sin cobro o habla con el cliente.'
          : contesto
            ? 'No pudimos cobrar con la tarjeta guardada. Si no funciona, ciérralo sin cobro o habla con el cliente.'
            : 'Stripe no confirmó el cobro. Vuelve a intentarlo en unos minutos (nunca se cobra dos veces). Si no funciona, ciérralo sin cobro o habla con el cliente.',
        undefined,
        409,
      );
    }
  }
  if (nuevo.id && nuevo.status === 'succeeded') return anotarCobro(env, db, d, f, nuevo, t.tarjeta);
  if (nuevo.id && nuevo.status === 'processing') {
    // Menor 3: el banco lo procesa (no pide nada al cliente). Se anota «en curso» con quién lo
    // decidió; el aviso de Stripe (payment_intent.succeeded) lo reconoce por su metadata y cierra
    // la entrega (`recobroDesdeAviso`). La clave se gasta: si termina fallando, el próximo
    // intento no recibe este «processing» guardado.
    await db.batch([
      db
        .prepare(
          'INSERT OR IGNORE INTO bitacora_pedidos (pedido_id, evento, detalle) VALUES (?, ?, ?)',
        )
        .bind(d.pedidoId, `recobro_en_curso:${nuevo.id}`, await detalleDecision(db, d)),
      db
        .prepare(
          "UPDATE liquidaciones SET error = ?, actualizado_en = datetime('now') WHERE pedido_id = ? AND estado = 'revision'",
        )
        .bind(`Volver a cobrar: el banco está procesando el cobro ${nuevo.id}.`, d.pedidoId),
      gastarClave(db, d.pedidoId, gastados, `processing ${nuevo.id}`),
    ]);
    return { estado: 'en_curso', pago: nuevo.id };
  }
  // El banco pide que el cliente confirme (o el cobro no terminó): no se anota nada como cobrado.
  console.error('autorización vencida: cobro sin terminar', d.pedidoId, nuevo.id, nuevo.status);
  if (nuevo.id && nuevo.status === 'requires_action')
    await stripe
      .post(`/payment_intents/${nuevo.id}/cancel`, {}, `anula-${nuevo.id}`)
      .catch((e: unknown) => console.error('autorización vencida: anular el cobro a medias', e));
  await gastarClave(db, d.pedidoId, gastados, `${String(nuevo.status)} ${String(nuevo.id)}`).run();
  throw new ErrorDatos(
    nuevo.status === 'requires_action'
      ? 'El banco del cliente pide que él confirme el cobro: no se puede cobrar sin él. Ciérralo sin cobro o habla con el cliente.'
      : 'No pudimos cobrar con la tarjeta guardada. Si no funciona, ciérralo sin cobro o habla con el cliente.',
    undefined,
    409,
  );
}

/** Quién decidió el cobro (y la nota), como se guarda mientras el banco lo procesa. */
async function detalleDecision(db: D1Database, d: Decision) {
  return JSON.stringify({
    por: await nombreDe(db, d.actorId),
    porId: d.actorId,
    aprobo: await nombreDe(db, d.aprobadorId),
    aproboId: d.aprobadorId,
    nota: d.nota.slice(0, 500),
  });
}

/**
 * El cobro de reemplazo salió bien: la entrega queda cobrada (aunque otra persona la hubiera
 * cerrado sin cobro a la vez: el dinero manda), el pedido apunta al pago nuevo, la conciliación se
 * pone al día y el cliente recibe el correo en su idioma (una sola vez: solo quien cambia la fila).
 */
async function anotarCobro(
  env: Env,
  db: D1Database,
  d: Decision,
  f: FilaLiquidacion,
  nuevo: IntentoStripe,
  tarjeta: { marca: string; ultimos4: string } | null,
) {
  const id = String(nuevo.id);
  const cobrado = Number(nuevo.amount_received ?? f.monto);
  const r = await db.batch([
    db
      .prepare(
        `UPDATE liquidaciones SET estado = 'capturada', pi = ?, capturado_en = datetime('now'), error = NULL,
           actualizado_en = datetime('now') WHERE pedido_id = ? AND estado <> 'capturada'`,
      )
      .bind(id, d.pedidoId),
    db
      .prepare(
        "UPDATE cobros SET capturado_en = COALESCE(capturado_en, datetime('now')), capturado = COALESCE(capturado, ?) WHERE pedido_id = ?",
      )
      .bind(cobrado, d.pedidoId),
    // Las devoluciones de después van contra el cobro nuevo.
    db
      .prepare('UPDATE pedidos SET stripe_pago = ?, stripe_sesion = ? WHERE id = ?')
      .bind(id, id, d.pedidoId),
    // LAN-2z: la conciliación de diagnóstico exige en Stripe que el pago reemplazado esté anulado.
    db
      .prepare(
        'INSERT OR IGNORE INTO bitacora_pedidos (pedido_id, evento, detalle) VALUES (?, ?, ?)',
      )
      .bind(d.pedidoId, `cobro_reautorizado:${f.pi}`, `${f.pi}>${id}`),
    await anotarResolucion(db, d, f, 'cobrado_de_nuevo', { pagoNuevo: id, cobrado }),
  ]);
  const cambio = Boolean(r[0]?.meta.changes);
  if (cambio) await reconciliarDia(db, f);
  const correoCliente = cambio
    ? await correoAlCliente(env, db, d.pedidoId, cobrado, f, tarjeta)
    : false;
  return { estado: 'capturada', pago: id, cobrado, correoCliente };
}

/** B1: el correo al cliente explicando el cobro. Si no sale, queda en el registro de errores. */
async function correoAlCliente(
  env: Env,
  db: D1Database,
  pedidoId: string,
  cobrado: number,
  f: FilaLiquidacion,
  tarjeta: { marca: string; ultimos4: string } | null,
) {
  try {
    const c = await db
      .prepare(
        `SELECT u.correo, u.nombre, u.idioma, r.nombre AS restaurante FROM pedidos p
           JOIN usuarios u ON u.id = p.cliente_id LEFT JOIN restaurantes r ON r.id = p.restaurante_id
          WHERE p.id = ?`,
      )
      .bind(pedidoId)
      .first<{
        correo: string | null;
        nombre: string;
        idioma: string | null;
        restaurante: string | null;
      }>();
    if (!c?.correo) throw new Error('el cliente no tiene correo');
    const r = await avisoCobroAutorizacionVencida(env, {
      correo: c.correo,
      nombre: c.nombre,
      idioma: c.idioma === 'en' ? 'en' : 'es',
      pedidoId,
      restaurante: c.restaurante ?? 'Divoox',
      entregadoEn: f.entregado_en,
      monto: cobrado,
      moneda: f.moneda || 'USD',
      tarjeta,
    });
    if (!r.ok) throw new Error(r.motivo);
    return true;
  } catch (e) {
    console.error('autorización vencida: no salió el correo del cobro al cliente', pedidoId, e);
    await guardarError(
      db,
      'COBRO',
      `autorizacion_vencida:correo_cliente:${pedidoId}`,
      new Error(`No salió el correo del cobro al cliente: ${String((e as Error)?.message ?? e)}`),
    ).catch((x: unknown) => console.error('autorización vencida: registro de errores', x));
    return false;
  }
}

/**
 * Menor 3: el aviso de Stripe (payment_intent.succeeded) de un cobro de reemplazo, reconocido por
 * su metadata (`recobro_de` y `pedido_id`) aunque el pedido siga apuntando al pago viejo. Solo
 * cierra la entrega si la liquidación sigue con ese pago viejo y el monto cuadra; si ya estaba
 * cobrada con este mismo pago, no hace nada. Devuelve si lo reconoció como suyo.
 */
export async function recobroDesdeAviso(env: Env, db: D1Database, obj: AvisoIntento) {
  const meta = (obj.metadata ?? {}) as Record<string, string>;
  const pedidoId = meta.pedido_id;
  const piViejo = meta.recobro_de;
  if (!pedidoId || !piViejo) return false;
  const id = String(obj.id ?? '');
  const f = await leerLiquidacion(db, pedidoId);
  if (!f) {
    console.error('aviso de cobro de reemplazo sin entrega conocida', pedidoId, id);
    return true;
  }
  if (f.estado === 'capturada' && f.pi === id) return true;
  if (f.pi !== piViejo || f.estado === 'capturada' || String(obj.status) !== 'succeeded') {
    console.error('aviso de cobro de reemplazo que no cuadra', pedidoId, id, f.estado, f.pi);
    return true;
  }
  if (Number(obj.amount_received) !== Number(f.monto)) {
    console.error(
      'aviso de cobro de reemplazo con otro monto',
      pedidoId,
      obj.amount_received,
      f.monto,
    );
    return true;
  }
  // Quién lo decidió quedó anotado al ponerlo «en curso».
  const fila = await db
    .prepare('SELECT detalle FROM bitacora_pedidos WHERE pedido_id = ? AND evento = ?')
    .bind(pedidoId, `recobro_en_curso:${id}`)
    .first<{ detalle: string }>();
  let quien: Record<string, unknown> = {};
  try {
    quien = fila ? (JSON.parse(fila.detalle) as Record<string, unknown>) : {};
  } catch {
    console.error('aviso de cobro de reemplazo: decisión ilegible', pedidoId);
  }
  const texto = (v: unknown) => (typeof v === 'string' ? v : '');
  // La tarjeta para el correo, del pago viejo (la misma tarjeta guardada).
  const { intento } = await leerIntento(env, piViejo);
  const tarjeta = intento ? evaluarTarjeta(intento, f, new Date()).tarjeta : null;
  await anotarCobro(
    env,
    db,
    {
      pedidoId,
      nota: texto(quien.nota),
      actorId: texto(quien.porId),
      aprobadorId: texto(quien.aproboId) || null,
    },
    f,
    { id, status: 'succeeded', amount_received: Number(obj.amount_received) },
    tarjeta,
  );
  return true;
}

/**
 * (b) Cerrarla sin cobro: Divoox asume el monto. El saldo ya anotado al restaurante y al repartidor
 * se conserva y se puede retirar (la decisión del 16 oct: en revisión se conserva el saldo). Solo
 * si Stripe confirma que el pago ya no se puede capturar ni está cobrado, y que no hay un cobro de
 * reemplazo hecho o en curso: nunca se esconde dinero.
 */
export async function cerrarSinCobro(env: Env, db: D1Database, d: Decision) {
  if (d.nota.trim().length < 5)
    throw new ErrorDatos('Escribe en la nota por qué se cierra sin cobro.', 'nota', 400);
  const f = await leerLiquidacion(db, d.pedidoId);
  if (!f) throw new ErrorDatos('Ese pedido no tiene un cobro de entrega.', undefined, 404);
  const hecho = yaResuelta(f, 'no_aplica');
  if (hecho) return hecho;
  // Menor 3 (de la revisión): sin pago de Stripe no hay nada que comprobar, así que no se cierra.
  if (!f.pi) throw new ErrorDatos('Esta entrega no tiene un pago de Stripe.', undefined, 409);
  const { stripe, intento, error } = await leerIntento(env, f.pi);
  if (!stripe || !intento) throw sinStripe(error);
  if (intento.status !== 'canceled')
    throw new ErrorDatos(
      'Stripe no muestra este pago como vencido: no se puede cerrar sin cobro.',
      undefined,
      409,
    );
  // Menor 4: si ya hay un cobro de reemplazo (hecho o que el banco procesa), no se cierra sin cobro.
  if (intento.customer) {
    let reemplazo: IntentoStripe | null;
    try {
      reemplazo = await cobroDeReemplazo(stripe, intento.customer, f.pi);
    } catch (e) {
      console.error(
        'autorización vencida: no se pudo revisar el cobro de reemplazo',
        d.pedidoId,
        e,
      );
      throw new ErrorDatos('No pudimos consultar el pago en Stripe.', undefined, 409);
    }
    if (reemplazo)
      throw new ErrorDatos(
        'Ya hay un cobro de reemplazo de este pago, hecho o en curso: no se puede cerrar sin cobro. Vuelve a abrir la ficha.',
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

/**
 * Menor 6: cuánto asumió Divoox al cerrar entregas sin cobro, por mes y moneda (los últimos 12
 * meses). Lee por el índice de estado de `liquidaciones` (solo las `no_aplica`); no escribe nada.
 * Si después un cobro de reemplazo salió bien, esa entrega pasa a `capturada` y deja de contar.
 */
export async function absorbidoSinCobro(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT strftime('%Y-%m', l.actualizado_en) AS mes, COALESCE(p.moneda, 'USD') AS moneda,
              COUNT(*) AS pedidos, COALESCE(SUM(l.monto), 0) AS monto
         FROM liquidaciones l INDEXED BY liquidaciones_por_cobrar JOIN pedidos p ON p.id = l.pedido_id
        WHERE l.estado = 'no_aplica' AND l.error LIKE 'Cerrada sin cobro:%'
          AND l.actualizado_en >= date('now', 'start of month', '-11 months')
        GROUP BY mes, moneda ORDER BY mes DESC, moneda`,
    )
    .all<{ mes: string; moneda: string; pedidos: number; monto: number }>();
  return results.map((r) => ({
    mes: r.mes,
    moneda: r.moneda,
    pedidos: Number(r.pedidos),
    monto: Number(r.monto),
  }));
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
  if (!results.length) return 0;
  // Menor 7: el pedido se da por avisado SOLO si salió al menos un correo. Si no hay a quién
  // mandarlo o no sale ninguno, no se escribe la fila (se reintenta en la próxima vuelta) y queda
  // UNA línea por vuelta en el registro de errores que mira el canario (pieza «errores»).
  const fallos: string[] = [];
  let destinos: string[] = [];
  try {
    destinos = await correosEquipo(env, 'dinero');
  } catch (e) {
    fallos.push(`sin la lista del equipo de dinero: ${String((e as Error)?.message ?? e)}`);
  }
  if (!destinos.length && !fallos.length) fallos.push('nadie recibe los avisos de dinero');
  let avisados = 0;
  for (const p of destinos.length ? results : []) {
    let salieron = 0;
    for (const para of destinos) {
      const r = await enviarCorreo(env, {
        de: 'avisos',
        para,
        asunto: `Autorización por vencer: pedido ${p.id.slice(0, 8)}`,
        texto: `El pedido ${p.id} sigue abierto y su tarjeta se autorizó el ${p.autorizado_en} UTC (${p.total} centavos, ${p.moneda || 'USD'}). Stripe suelta la autorización a los 7 días (Visa, 4 días y 18 horas si la inició Divoox). Entrégalo o cancélalo antes; si vence, resuélvelo desde la ficha del pedido con «Resolver autorización vencida».`,
      }).catch((e: unknown) => ({ ok: false as const, motivo: String(e) }));
      if (r.ok) salieron++;
      else fallos.push(`${p.id.slice(0, 8)} → ${para}: ${r.motivo}`);
    }
    if (!salieron) continue;
    const r = await db
      .prepare(
        "INSERT OR IGNORE INTO bitacora_pedidos (pedido_id, evento, detalle) VALUES (?, 'autorizacion_por_vencer', ?)",
      )
      .bind(p.id, `Autorizada el ${p.autorizado_en} UTC`)
      .run();
    if (r.meta.changes) avisados++;
  }
  if (fallos.length) {
    console.error('autorización por vencer: avisos sin enviar', fallos);
    await guardarError(
      db,
      'RELOJ',
      'autorizaciones_por_vencer',
      new Error(`Avisos de autorización por vencer sin enviar: ${fallos.slice(0, 5).join(' · ')}`),
    ).catch((e: unknown) => console.error('autorización por vencer: registro de errores', e));
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
