import { z } from 'zod';
import type { Env } from '../env';
import { CUENTA_TUMBITE, sentenciaLibro } from '../internacional/libro';
import { notificar } from '../notificaciones';
import { type Stripe, crearStripe } from '../stripe';
import { ErrorDatos } from '../validar';
import { ahoraSql, sentenciaAuditoriaFin } from './politicas';

/**
 * Divoox · Fase 4: billetera prepago de cada EMPRESA (C-FIN-BILLETERA). El saldo vive SOLO en el
 * libro contable (cuenta `empresa:<id>`):
 *   prepago        saldo disponible para pagar las comisiones de Divoox
 *   reservado      comisiones apartadas para rutas en curso y montos retenidos por una disputa
 *   deuda_cliente  lo que quedó debiendo (un reembolso o una disputa perdida que el saldo no cubría);
 *                  mientras exista, no salen rutas nuevas facturables y la próxima recarga lo paga
 * Todo movimiento lleva una referencia única: repetir un aviso o una petición no duplica nada.
 * El saldo contable NO es dinero recibido: una recarga solo suma cuando Stripe confirma el cobro.
 */

export const cuentaEmpresa = (empresaId: string) => `empresa:${empresaId}`;

export type SaldoEmpresa = {
  disponible: number;
  reservado: number;
  deuda: number;
  total: number;
  pais: string;
  moneda: string;
};

export async function empresaFinanciera(db: D1Database, empresaId: string) {
  const e = await db
    .prepare('SELECT id, nombre, pais, moneda, dueno_id FROM empresas WHERE id = ?')
    .bind(empresaId)
    .first<{ id: string; nombre: string; pais: string; moneda: string; dueno_id: string }>();
  if (!e) throw new ErrorDatos('Esa empresa no existe.', undefined, 404);
  return e;
}

export async function saldoEmpresa(
  db: D1Database,
  empresa: { id: string; pais: string; moneda: string },
): Promise<SaldoEmpresa> {
  const { results } = await db
    .prepare(
      `SELECT bolsillo, COALESCE(SUM(monto), 0) AS s FROM libro
        WHERE cuenta_id = ? AND pais = ? AND moneda = ? AND bolsillo IN ('prepago', 'reservado', 'deuda_cliente')
        GROUP BY bolsillo`,
    )
    .bind(cuentaEmpresa(empresa.id), empresa.pais, empresa.moneda)
    .all<{ bolsillo: string; s: number }>();
  const de = (b: string) => Number(results.find((x) => x.bolsillo === b)?.s ?? 0);
  const disponible = de('prepago');
  const reservado = de('reservado');
  return {
    disponible,
    reservado,
    deuda: de('deuda_cliente'),
    total: disponible + reservado,
    pais: empresa.pais,
    moneda: empresa.moneda,
  };
}

// ───────────────────────────── Límites de recarga por país ─────────────────────────────

export const esquemaConfigRecargas = z.object({
  activas: z.boolean(),
  minimo: z.number().int().min(1),
  maximo: z.number().int().min(1),
  sugeridos: z.array(z.number().int().min(1)).max(8),
  /** Recarga automática permitida en este país (la empresa además la tiene que encender). */
  automaticaPermitida: z.boolean(),
});
export type ConfigRecargas = z.infer<typeof esquemaConfigRecargas>;

/** De fábrica, APAGADAS: el superadmin las enciende por país con sus límites. */
export const RECARGAS_DE_FABRICA: ConfigRecargas = {
  activas: false,
  minimo: 500,
  maximo: 100_000,
  sugeridos: [1000, 2000, 5000, 10_000],
  automaticaPermitida: false,
};

export async function leerConfigRecargas(db: D1Database, pais: string): Promise<ConfigRecargas> {
  const f = await db
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(`fin_recargas:${pais}`)
    .first<{ valor: string }>();
  if (!f) return RECARGAS_DE_FABRICA;
  const r = esquemaConfigRecargas.partial().safeParse(JSON.parse(f.valor));
  return r.success ? { ...RECARGAS_DE_FABRICA, ...r.data } : RECARGAS_DE_FABRICA;
}

export async function guardarConfigRecargas(
  db: D1Database,
  pais: string,
  cfg: ConfigRecargas,
  actorId: string,
) {
  if (cfg.minimo > cfg.maximo)
    throw new ErrorDatos('El mínimo no puede ser mayor que el máximo.', 'minimo', 409);
  if (cfg.sugeridos.some((s) => s < cfg.minimo || s > cfg.maximo))
    throw new ErrorDatos(
      'Los importes sugeridos tienen que estar entre el mínimo y el máximo.',
      'sugeridos',
      409,
    );
  await db.batch([
    db
      .prepare(
        "INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
      )
      .bind(`fin_recargas:${pais}`, JSON.stringify(cfg)),
    sentenciaAuditoriaFin(db, { actorId, accion: 'recargas.limites', objeto: pais, detalle: cfg }),
  ]);
}

// ───────────────────────────── Comprobantes ─────────────────────────────

/**
 * Comprobante numerado (DVX-AAAA-000001) en el MISMO lote que el movimiento: si ya existe uno con
 * esa referencia, ni se numera ni se repite. No es una factura fiscal.
 */
export function sentenciasComprobante(
  db: D1Database,
  c: {
    empresaId: string;
    tipo: 'recarga' | 'reembolso' | 'comisiones_ruta' | 'ajuste';
    monto: number;
    pais: string;
    moneda: string;
    referencia: string;
    datos: Record<string, unknown>;
  },
): D1PreparedStatement[] {
  const anio = new Date().getUTCFullYear();
  const contador = `comprobantes:${anio}`;
  return [
    db
      .prepare(
        `INSERT INTO contadores (clave, n) SELECT ?1, 1 WHERE NOT EXISTS (SELECT 1 FROM comprobantes WHERE referencia = ?2)
         ON CONFLICT(clave) DO UPDATE SET n = n + 1`,
      )
      .bind(contador, c.referencia),
    db
      .prepare(
        `INSERT OR IGNORE INTO comprobantes (id, numero, empresa_id, tipo, monto, pais, moneda, referencia, datos_json)
         SELECT ?1, 'DVX-' || ?2 || '-' || printf('%06d', (SELECT n FROM contadores WHERE clave = ?3)), ?4, ?5, ?6, ?7, ?8, ?9, ?10
          WHERE NOT EXISTS (SELECT 1 FROM comprobantes WHERE referencia = ?9)`,
      )
      .bind(
        crypto.randomUUID(),
        String(anio),
        contador,
        c.empresaId,
        c.tipo,
        c.monto,
        c.pais,
        c.moneda,
        c.referencia,
        JSON.stringify(c.datos),
      ),
  ];
}

// ───────────────────────────── Recargas ─────────────────────────────

type FilaRecarga = {
  id: string;
  empresa_id: string;
  pais: string;
  moneda: string;
  monto: number;
  estado: string;
  automatica: number;
  stripe_pi: string | null;
  reembolsado: number;
  disputado: number;
  motivo: string;
  creado_en: string;
  acreditada_en: string | null;
};

export const recargaPublica = (r: FilaRecarga) => ({
  id: r.id,
  monto: r.monto,
  moneda: r.moneda,
  estado: r.estado,
  automatica: Boolean(r.automatica),
  reembolsado: r.reembolsado,
  disputado: r.disputado,
  motivo: r.motivo,
  creadoEn: r.creado_en,
  acreditadaEn: r.acreditada_en,
});

async function clienteStripe(
  stripe: Stripe,
  db: D1Database,
  empresa: { id: string; nombre: string },
) {
  const f = await db
    .prepare('SELECT stripe_cliente FROM empresa_finanzas WHERE empresa_id = ?')
    .bind(empresa.id)
    .first<{ stripe_cliente: string | null }>();
  if (f?.stripe_cliente) return f.stripe_cliente;
  const c = await stripe.post<{ id: string }>(
    '/customers',
    { name: empresa.nombre, metadata: { empresa_id: empresa.id, servicio: 'flex' } },
    `cliente-empresa-${empresa.id}`,
  );
  await db
    .prepare(
      `INSERT INTO empresa_finanzas (empresa_id, stripe_cliente) VALUES (?1, ?2)
       ON CONFLICT(empresa_id) DO UPDATE SET stripe_cliente = COALESCE(stripe_cliente, ?2), actualizado_en = datetime('now')`,
    )
    .bind(empresa.id, c.id)
    .run();
  return c.id;
}

/**
 * Abre una recarga: queda PENDIENTE hasta el aviso firmado de Stripe. La misma clave de
 * idempotencia devuelve la misma recarga (nunca dos cobros por un doble clic).
 */
export async function crearRecargaEmpresa(
  env: Env,
  db: D1Database,
  p: {
    empresaId: string;
    actorId: string | null;
    monto: number;
    idempotencia: string;
    guardarMetodo: boolean;
    automatica?: { metodo: string };
  },
): Promise<{ recarga: ReturnType<typeof recargaPublica>; clientSecret: string | null }> {
  const e = await empresaFinanciera(db, p.empresaId);
  const cfg = await leerConfigRecargas(db, e.pais);
  if (!cfg.activas)
    throw new ErrorDatos('Las recargas todavía no están activas en tu país.', undefined, 409);
  if (!Number.isSafeInteger(p.monto) || p.monto < cfg.minimo || p.monto > cfg.maximo)
    throw new ErrorDatos('El importe está fuera de los límites permitidos.', 'monto', 409);
  const stripe = crearStripe(env.STRIPE_SECRET_KEY);
  if (!stripe) throw new ErrorDatos('Los pagos no están configurados todavía.', undefined, 503);
  const idem = `${p.empresaId}:${p.idempotencia}`;
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT OR IGNORE INTO recargas_empresa (id, empresa_id, pais, moneda, monto, automatica, idempotencia, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, e.id, e.pais, e.moneda, p.monto, p.automatica ? 1 : 0, idem, p.actorId)
    .run();
  const r = (await db
    .prepare('SELECT * FROM recargas_empresa WHERE idempotencia = ?')
    .bind(idem)
    .first<FilaRecarga>())!;
  if (r.monto !== p.monto)
    throw new ErrorDatos('Esa clave ya se usó para otra recarga.', undefined, 409);
  // Repetición: el mismo intento de Stripe (Stripe también deduplica por la clave).
  const cliente = p.guardarMetodo || p.automatica ? await clienteStripe(stripe, db, e) : undefined;
  let intento: { id: string; client_secret: string; status: string };
  try {
    intento = await stripe.post<{ id: string; client_secret: string; status: string }>(
      '/payment_intents',
      {
        amount: r.monto,
        currency: r.moneda.toLowerCase(),
        description: 'Divoox Flex · recarga de la billetera',
        metadata: { tipo: 'recarga_empresa', recarga_empresa_id: r.id, empresa_id: e.id },
        ...(cliente ? { customer: cliente } : {}),
        ...(p.automatica
          ? { payment_method: p.automatica.metodo, off_session: true, confirm: true }
          : {
              automatic_payment_methods: { enabled: true },
              ...(p.guardarMetodo ? { setup_future_usage: 'off_session' } : {}),
            }),
      },
      `recarga-empresa-${r.id}`,
    );
  } catch (err) {
    await db
      .prepare(
        "UPDATE recargas_empresa SET estado = 'fallida', motivo = ?, actualizado_en = datetime('now') WHERE id = ? AND estado = 'pendiente'",
      )
      .bind(String((err as Error).message ?? 'stripe').slice(0, 200), r.id)
      .run();
    throw new ErrorDatos(
      'No pudimos iniciar el pago. Intenta de nuevo en un momento.',
      undefined,
      503,
    );
  }
  await db
    .prepare('UPDATE recargas_empresa SET stripe_pi = COALESCE(stripe_pi, ?) WHERE id = ?')
    .bind(intento.id, r.id)
    .run();
  return {
    recarga: recargaPublica({ ...r, stripe_pi: intento.id }),
    clientSecret: p.automatica ? null : intento.client_secret,
  };
}

/** Sentencias que pagan primero la deuda y el resto lo suman al disponible. */
async function sentenciasAbono(
  db: D1Database,
  e: { id: string; pais: string; moneda: string },
  monto: number,
  prefijo: string,
  concepto: string,
  autorId: string | null = null,
) {
  const s = await saldoEmpresa(db, e);
  const aDeuda = Math.min(Math.max(s.deuda, 0), monto);
  const lista: D1PreparedStatement[] = [];
  if (aDeuda > 0)
    lista.push(
      sentenciaLibro(db, {
        cuentaId: cuentaEmpresa(e.id),
        bolsillo: 'deuda_cliente',
        pais: e.pais,
        moneda: e.moneda,
        monto: -aDeuda,
        concepto: `${concepto}:pago_deuda`,
        referencia: `${prefijo}:deuda`,
        autorId,
      }),
    );
  if (monto - aDeuda > 0)
    lista.push(
      sentenciaLibro(db, {
        cuentaId: cuentaEmpresa(e.id),
        bolsillo: 'prepago',
        pais: e.pais,
        moneda: e.moneda,
        monto: monto - aDeuda,
        concepto,
        referencia: `${prefijo}:prepago`,
        autorId,
      }),
    );
  return lista;
}

/**
 * Aviso payment_intent.succeeded de una recarga de empresa: acredita UNA vez. Monto, moneda y
 * empresa tienen que cuadrar con lo que se abrió; si no, no se acredita nada y queda en el error.
 */
export async function acreditarRecargaEmpresa(
  env: Env,
  db: D1Database,
  obj: Record<string, unknown>,
) {
  const meta = (obj.metadata ?? {}) as Record<string, string>;
  const r = await db
    .prepare('SELECT * FROM recargas_empresa WHERE id = ?')
    .bind(meta.recarga_empresa_id ?? '')
    .first<FilaRecarga>();
  if (!r) {
    console.error('finanzas: aviso de recarga sin recarga conocida', meta.recarga_empresa_id);
    return false;
  }
  const moneda = obj.currency == null ? r.moneda.toLowerCase() : String(obj.currency);
  if (
    meta.empresa_id !== r.empresa_id ||
    Number(obj.amount_received) !== r.monto ||
    moneda !== r.moneda.toLowerCase() ||
    (r.stripe_pi && String(obj.id) !== r.stripe_pi)
  ) {
    console.error('finanzas: la recarga de Stripe no cuadra; no se acredita', r.id);
    return false;
  }
  const e = await empresaFinanciera(db, r.empresa_id);
  const prefijo = `recarga_empresa:${r.id}`;
  await db.batch([
    db
      .prepare(
        "UPDATE recargas_empresa SET estado = 'acreditada', acreditada_en = datetime('now'), stripe_pi = ?, motivo = '', actualizado_en = datetime('now') WHERE id = ? AND estado = 'pendiente'",
      )
      .bind(String(obj.id), r.id),
    ...(await sentenciasAbono(db, e, r.monto, prefijo, 'recarga_empresa')),
    ...sentenciasComprobante(db, {
      empresaId: e.id,
      tipo: 'recarga',
      monto: r.monto,
      pais: e.pais,
      moneda: e.moneda,
      referencia: prefijo,
      datos: { recargaId: r.id, pago: String(obj.id), automatica: Boolean(r.automatica) },
    }),
  ]);
  // Método guardado para la recarga automática (solo id y resumen; nunca el número).
  const metodo = obj.payment_method ? String(obj.payment_method) : null;
  if (metodo && (obj.setup_future_usage === 'off_session' || r.automatica)) {
    const stripe = crearStripe(env.STRIPE_SECRET_KEY);
    const pm = stripe
      ? await stripe
          .get<{ card?: { brand?: string; last4?: string } }>(`/payment_methods/${metodo}`)
          .catch(() => null)
      : null;
    const resumen = pm?.card ? `${pm.card.brand ?? ''} •••• ${pm.card.last4 ?? ''}`.trim() : '';
    await db
      .prepare(
        `INSERT INTO empresa_finanzas (empresa_id, stripe_metodo, metodo_resumen) VALUES (?1, ?2, ?3)
         ON CONFLICT(empresa_id) DO UPDATE SET stripe_metodo = ?2, metodo_resumen = ?3, actualizado_en = datetime('now')`,
      )
      .bind(e.id, metodo, resumen)
      .run();
  }
  return true;
}

/** payment_intent.payment_failed: la recarga sigue abierta (se puede reintentar) y dice por qué. */
export async function recargaRechazada(db: D1Database, obj: Record<string, unknown>) {
  const meta = (obj.metadata ?? {}) as Record<string, string>;
  const err = (obj.last_payment_error ?? {}) as { message?: string; code?: string };
  const automatica = await db
    .prepare('SELECT automatica FROM recargas_empresa WHERE id = ?')
    .bind(meta.recarga_empresa_id ?? '')
    .first<{ automatica: number }>();
  // Una recarga automática rechazada no se reintenta sola: queda fallida y se avisa.
  await db
    .prepare(
      `UPDATE recargas_empresa SET motivo = ?, estado = CASE WHEN automatica = 1 THEN 'fallida' ELSE estado END,
         actualizado_en = datetime('now') WHERE id = ? AND estado = 'pendiente'`,
    )
    .bind(
      String(err.message ?? err.code ?? 'pago rechazado').slice(0, 200),
      meta.recarga_empresa_id ?? '',
    )
    .run();
  return Boolean(automatica);
}

/** payment_intent.canceled: la recarga queda cancelada (nunca se acreditó nada). */
export async function recargaCancelada(db: D1Database, obj: Record<string, unknown>) {
  const meta = (obj.metadata ?? {}) as Record<string, string>;
  await db
    .prepare(
      "UPDATE recargas_empresa SET estado = 'cancelada', actualizado_en = datetime('now') WHERE id = ? AND estado = 'pendiente'",
    )
    .bind(meta.recarga_empresa_id ?? '')
    .run();
}

/**
 * Sentencias que DESCUENTAN un monto de la empresa sin dejar nunca el disponible en negativo: lo que
 * el disponible cubre sale de ahí; lo que falta queda como deuda (y suspende lo facturable).
 */
async function sentenciasCargo(
  db: D1Database,
  e: { id: string; pais: string; moneda: string },
  monto: number,
  prefijo: string,
  concepto: string,
  autorId: string | null = null,
) {
  const s = await saldoEmpresa(db, e);
  const delDisponible = Math.min(Math.max(s.disponible, 0), monto);
  const lista: D1PreparedStatement[] = [];
  if (delDisponible > 0)
    lista.push(
      sentenciaLibro(db, {
        cuentaId: cuentaEmpresa(e.id),
        bolsillo: 'prepago',
        pais: e.pais,
        moneda: e.moneda,
        monto: -delDisponible,
        concepto,
        referencia: `${prefijo}:prepago`,
        autorId,
      }),
    );
  if (monto - delDisponible > 0)
    lista.push(
      sentenciaLibro(db, {
        cuentaId: cuentaEmpresa(e.id),
        bolsillo: 'deuda_cliente',
        pais: e.pais,
        moneda: e.moneda,
        monto: monto - delDisponible,
        concepto: `${concepto}:deuda`,
        referencia: `${prefijo}:deuda`,
        autorId,
      }),
    );
  return { lista, delDisponible, aDeuda: monto - delDisponible };
}

/**
 * charge.refunded de una recarga de empresa (reembolso hecho desde Divoox o desde Stripe): se
 * descuenta SOLO la diferencia entre lo reembolsado por Stripe y lo ya descontado. Idempotente.
 */
export async function reembolsoDeRecarga(db: D1Database, obj: Record<string, unknown>) {
  const pi = obj.payment_intent ? String(obj.payment_intent) : '';
  const r = await db
    .prepare('SELECT * FROM recargas_empresa WHERE stripe_pi = ?')
    .bind(pi)
    .first<FilaRecarga>();
  if (!r) return false;
  const total = Math.min(Number(obj.amount_refunded ?? 0), r.monto);
  const delta = total - r.reembolsado;
  if (delta <= 0) return true;
  const e = await empresaFinanciera(db, r.empresa_id);
  const prefijo = `reembolso:${r.id}:${total}`;
  const { lista } = await sentenciasCargo(db, e, delta, prefijo, 'reembolso_recarga');
  await db.batch([
    db
      .prepare(
        "UPDATE recargas_empresa SET reembolsado = ?, actualizado_en = datetime('now') WHERE id = ? AND reembolsado < ?",
      )
      .bind(total, r.id, total),
    ...lista,
    ...sentenciasComprobante(db, {
      empresaId: e.id,
      tipo: 'reembolso',
      monto: delta,
      pais: e.pais,
      moneda: e.moneda,
      referencia: prefijo,
      datos: { recargaId: r.id, reembolsadoTotal: total },
    }),
    sentenciaAuditoriaFin(db, {
      actorId: null,
      actorTipo: 'sistema',
      accion: 'recarga.reembolso',
      objeto: r.id,
      empresaId: e.id,
      detalle: { delta, total },
    }),
  ]);
  return true;
}

/**
 * Reembolso pedido por el superadmin: solo de lo que la empresa tiene DISPONIBLE (lo ya gastado en
 * comisiones no se devuelve). Se aparta antes de llamar a Stripe; si Stripe falla, se devuelve.
 */
export async function reembolsarRecarga(
  env: Env,
  db: D1Database,
  p: { recargaId: string; monto: number; motivo: string; actorId: string },
) {
  const r = await db
    .prepare('SELECT * FROM recargas_empresa WHERE id = ?')
    .bind(p.recargaId)
    .first<FilaRecarga>();
  if (!r || r.estado !== 'acreditada' || !r.stripe_pi)
    throw new ErrorDatos('Esa recarga no se puede reembolsar.', undefined, 409);
  if (p.monto <= 0 || r.reembolsado + p.monto > r.monto)
    throw new ErrorDatos('El reembolso supera lo que se recargó.', 'monto', 409);
  const e = await empresaFinanciera(db, r.empresa_id);
  const s = await saldoEmpresa(db, e);
  if (s.disponible < p.monto)
    throw new ErrorDatos('La empresa no tiene ese saldo disponible para devolver.', 'monto', 409);
  const stripe = crearStripe(env.STRIPE_SECRET_KEY);
  if (!stripe) throw new ErrorDatos('Los pagos no están configurados todavía.', undefined, 503);
  const total = r.reembolsado + p.monto;
  await stripe.post(
    '/refunds',
    {
      payment_intent: r.stripe_pi,
      amount: p.monto,
      metadata: { recarga_empresa_id: r.id, empresa_id: e.id },
    },
    `reembolso-recarga-${r.id}-${total}`,
  );
  await db
    .prepare(
      'INSERT INTO finanzas_auditoria (actor_id, accion, objeto, empresa_id, detalle_json) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(
      p.actorId,
      'recarga.reembolso_pedido',
      r.id,
      e.id,
      JSON.stringify({ monto: p.monto, motivo: p.motivo }),
    )
    .run();
  // El descuento lo hace el MISMO camino que el aviso (diferencia contra lo ya descontado).
  await reembolsoDeRecarga(db, { payment_intent: r.stripe_pi, amount_refunded: total });
  return { reembolsado: total };
}

/**
 * Disputa (contracargo) de una recarga de empresa: al abrirse se RETIENE lo disputado (del
 * disponible al reservado, lo que alcance); si se gana, se libera; si se pierde, la retención se va
 * y lo que no alcanzó queda como deuda. Cada paso, una vez.
 */
export async function disputaDeRecarga(
  db: D1Database,
  tipo: string,
  obj: Record<string, unknown>,
): Promise<boolean> {
  const pi = obj.payment_intent ? String(obj.payment_intent) : '';
  const r = await db
    .prepare('SELECT * FROM recargas_empresa WHERE stripe_pi = ?')
    .bind(pi)
    .first<FilaRecarga>();
  if (!r) return false;
  const e = await empresaFinanciera(db, r.empresa_id);
  const id = String(obj.id ?? '');
  const monto = Math.min(Number(obj.amount ?? 0), r.monto);
  const cuenta = cuentaEmpresa(e.id);
  const ret = await db
    .prepare('SELECT COALESCE(SUM(monto), 0) AS m FROM libro WHERE referencia = ?')
    .bind(`disputa:${id}:retencion:reservado`)
    .first<{ m: number }>();
  const retenido = Number(ret?.m ?? 0);
  const lote: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO disputas (id, stripe_pago, monto, motivo, estado, recarga_empresa_id) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET estado = excluded.estado, monto = excluded.monto, actualizado_en = datetime('now')`,
      )
      .bind(id, pi, monto, String(obj.reason ?? ''), String(obj.status ?? ''), r.id),
  ];
  if (tipo === 'charge.dispute.created' && retenido === 0) {
    const s = await saldoEmpresa(db, e);
    const retener = Math.min(Math.max(s.disponible, 0), monto);
    if (retener > 0)
      lote.push(
        sentenciaLibro(db, {
          cuentaId: cuenta,
          bolsillo: 'prepago',
          pais: e.pais,
          moneda: e.moneda,
          monto: -retener,
          concepto: 'disputa_retencion',
          referencia: `disputa:${id}:retencion:prepago`,
        }),
        sentenciaLibro(db, {
          cuentaId: cuenta,
          bolsillo: 'reservado',
          pais: e.pais,
          moneda: e.moneda,
          monto: retener,
          concepto: 'disputa_retencion',
          referencia: `disputa:${id}:retencion:reservado`,
        }),
      );
    lote.push(
      db
        .prepare(
          "UPDATE recargas_empresa SET disputado = ?, actualizado_en = datetime('now') WHERE id = ?",
        )
        .bind(monto, r.id),
    );
  }
  if (tipo === 'charge.dispute.closed') {
    const ganada = obj.status === 'won';
    if (ganada && retenido > 0)
      lote.push(
        sentenciaLibro(db, {
          cuentaId: cuenta,
          bolsillo: 'reservado',
          pais: e.pais,
          moneda: e.moneda,
          monto: -retenido,
          concepto: 'disputa_ganada',
          referencia: `disputa:${id}:cierre:reservado`,
        }),
        sentenciaLibro(db, {
          cuentaId: cuenta,
          bolsillo: 'prepago',
          pais: e.pais,
          moneda: e.moneda,
          monto: retenido,
          concepto: 'disputa_ganada',
          referencia: `disputa:${id}:cierre:prepago`,
        }),
      );
    if (!ganada) {
      if (retenido > 0)
        lote.push(
          sentenciaLibro(db, {
            cuentaId: cuenta,
            bolsillo: 'reservado',
            pais: e.pais,
            moneda: e.moneda,
            monto: -retenido,
            concepto: 'disputa_perdida',
            referencia: `disputa:${id}:cierre:reservado`,
          }),
        );
      if (monto - retenido > 0)
        lote.push(
          sentenciaLibro(db, {
            cuentaId: cuenta,
            bolsillo: 'deuda_cliente',
            pais: e.pais,
            moneda: e.moneda,
            monto: monto - retenido,
            concepto: 'disputa_perdida',
            referencia: `disputa:${id}:cierre:deuda`,
          }),
        );
    }
  }
  await db.batch(lote);
  return true;
}

/**
 * Ajuste manual del superadmin (permisos reforzados: rol admin + su contraseña + motivo). Suma o
 * resta del disponible; una resta nunca lo deja negativo. Queda con autor en el libro y en la
 * auditoría inmutable, y con su comprobante.
 */
export async function ajusteManual(
  db: D1Database,
  p: { empresaId: string; monto: number; motivo: string; actorId: string },
) {
  if (!Number.isSafeInteger(p.monto) || p.monto === 0)
    throw new ErrorDatos('El monto no es válido.', 'monto', 400);
  const e = await empresaFinanciera(db, p.empresaId);
  const prefijo = `ajuste:${e.id}:${crypto.randomUUID()}`;
  const lote: D1PreparedStatement[] = [];
  if (p.monto > 0)
    lote.push(...(await sentenciasAbono(db, e, p.monto, prefijo, 'ajuste_manual', p.actorId)));
  else {
    const s = await saldoEmpresa(db, e);
    if (s.disponible < -p.monto)
      throw new ErrorDatos('El ajuste dejaría el saldo disponible en negativo.', 'monto', 409);
    lote.push(
      sentenciaLibro(db, {
        cuentaId: cuentaEmpresa(e.id),
        bolsillo: 'prepago',
        pais: e.pais,
        moneda: e.moneda,
        monto: p.monto,
        concepto: 'ajuste_manual',
        referencia: `${prefijo}:prepago`,
        autorId: p.actorId,
      }),
    );
  }
  lote.push(
    sentenciaAuditoriaFin(db, {
      actorId: p.actorId,
      accion: 'billetera.ajuste_manual',
      objeto: e.id,
      empresaId: e.id,
      detalle: { monto: p.monto, motivo: p.motivo },
    }),
    ...sentenciasComprobante(db, {
      empresaId: e.id,
      tipo: 'ajuste',
      monto: p.monto,
      pais: e.pais,
      moneda: e.moneda,
      referencia: prefijo,
      datos: { motivo: p.motivo },
    }),
  );
  await db.batch(lote);
  return saldoEmpresa(db, e);
}

/** Libro de la empresa para la pantalla (con el sentido de cada movimiento en palabras). */
export async function movimientosEmpresa(
  db: D1Database,
  empresa: { id: string; pais: string; moneda: string },
  filtro: { desde?: string; hasta?: string; limite?: number; antesDe?: string },
) {
  const { results } = await db
    .prepare(
      `SELECT rowid AS n, bolsillo, monto, concepto, referencia, creado_en FROM libro
        WHERE cuenta_id = ?1 AND pais = ?2 AND moneda = ?3
          AND (?4 IS NULL OR creado_en >= ?4) AND (?5 IS NULL OR creado_en <= ?5)
          AND (?6 IS NULL OR rowid < ?6)
        ORDER BY rowid DESC LIMIT ?7`,
    )
    .bind(
      cuentaEmpresa(empresa.id),
      empresa.pais,
      empresa.moneda,
      filtro.desde ?? null,
      filtro.hasta ? `${filtro.hasta} 23:59:59` : null,
      filtro.antesDe ? Number(filtro.antesDe) : null,
      Math.min(200, filtro.limite ?? 50),
    )
    .all<{
      n: number;
      bolsillo: string;
      monto: number;
      concepto: string;
      referencia: string | null;
      creado_en: string;
    }>();
  return results.map((m) => ({
    id: String(m.n),
    bolsillo: m.bolsillo,
    monto: m.monto,
    tipo: tipoMovimiento(m.concepto, m.bolsillo),
    creadoEn: m.creado_en,
  }));
}

/** Nombre corto y estable de cada movimiento (las pantallas lo traducen). */
export function tipoMovimiento(concepto: string, bolsillo: string): string {
  if (concepto.startsWith('recarga_empresa')) return 'recarga';
  if (concepto.startsWith('reserva_flex'))
    return bolsillo === 'prepago' ? 'reserva' : 'reserva_apartada';
  if (concepto.startsWith('comision_flex')) return 'comision';
  if (concepto.startsWith('liberacion_flex') || concepto.startsWith('ajuste_flex'))
    return 'liberacion';
  if (concepto.startsWith('reembolso')) return 'reembolso';
  if (concepto.startsWith('disputa')) return 'disputa';
  if (concepto.startsWith('ajuste_manual')) return 'ajuste';
  return 'otro';
}

/** Avisos de dinero a quienes ven las finanzas de la empresa (dueño y finanzas). Una vez por clave. */
export async function avisarFinanzas(
  env: Env,
  db: D1Database,
  empresaId: string,
  clave: string,
  texto: (idioma: string) => { titulo: string; cuerpo: string },
) {
  const { results } = await db
    .prepare(
      `SELECT u.id, u.idioma FROM empresa_miembros m JOIN usuarios u ON u.id = m.usuario_id
        WHERE m.empresa_id = ? AND m.estado = 'activo' AND m.rol IN ('dueno', 'finanzas')`,
    )
    .bind(empresaId)
    .all<{ id: string; idioma: string }>();
  for (const u of results) {
    const r = await db
      .prepare('INSERT OR IGNORE INTO flex_avisos (clave, usuario_id, tipo) VALUES (?, ?, ?)')
      .bind(`fin:${clave}:${u.id}`, u.id, 'finanzas')
      .run();
    if (!r.meta.changes) continue;
    await notificar(env, db, u.id, {
      ...texto(u.idioma),
      datos: { tipo: 'flex_finanzas', empresaId },
    }).catch((e: unknown) => console.error('finanzas: aviso', e));
  }
}

export const TEXTOS_FINANZAS = {
  saldoBajo: (i: string) =>
    i === 'en'
      ? {
          titulo: 'Low wallet balance',
          cuerpo: 'Your Divoox Flex wallet is running low. Top it up to keep sending routes.',
        }
      : {
          titulo: 'Saldo bajo en tu billetera',
          cuerpo:
            'A tu billetera de Divoox Flex le queda poco. Recarga para seguir enviando rutas.',
        },
  recargaAcreditada: (i: string) =>
    i === 'en'
      ? { titulo: 'Top-up credited', cuerpo: 'Your top-up was confirmed and is in your wallet.' }
      : {
          titulo: 'Recarga acreditada',
          cuerpo: 'Tu recarga se confirmó y ya está en tu billetera.',
        },
  recargaAutomaticaFallida: (i: string) =>
    i === 'en'
      ? {
          titulo: 'Automatic top-up failed',
          cuerpo: 'Your card was declined. Top up manually or update your card.',
        }
      : {
          titulo: 'La recarga automática falló',
          cuerpo: 'Tu tarjeta fue rechazada. Recarga a mano o cambia tu tarjeta.',
        },
};

export { CUENTA_TUMBITE, ahoraSql };
