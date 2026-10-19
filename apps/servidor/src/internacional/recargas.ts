import { ErrorDatos } from '../validar';
import { anotarLibro, cuentaPunto, descontarSiAlcanza, saldoLibro, sentenciaLibro } from './libro';
import { leerConfigPais } from './paises';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I: se dicta por teléfono sin confusión
const MAX_FALLIDOS_HORA = 10;

async function sha256(texto: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function codigoNuevo(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  const letras = [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join('');
  return `${letras.slice(0, 4)}-${letras.slice(4, 8)}-${letras.slice(8, 12)}`;
}

export const normalizarCodigo = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Tumbite le vende saldo a un punto de venta (contra pago fuera del sistema: el comprobante queda escrito). */
export async function fondearPunto(
  db: D1Database,
  p: { puntoId: string; monto: number; comprobante: string; autorId: string },
) {
  const punto = await db
    .prepare('SELECT id, pais, moneda, activo FROM puntos_venta WHERE id = ?')
    .bind(p.puntoId)
    .first<{ id: string; pais: string; moneda: string; activo: number }>();
  if (!punto || !punto.activo)
    throw new ErrorDatos('Ese punto de venta no existe.', undefined, 404);
  const r = await anotarLibro(db, {
    cuentaId: cuentaPunto(punto.id),
    bolsillo: 'punto',
    pais: punto.pais,
    moneda: punto.moneda,
    monto: p.monto,
    concepto: 'fondo_comprado',
    referencia: `fondo:${punto.id}:${p.comprobante}`,
    autorId: p.autorId,
  });
  // El comprobante identifica el pago: el mismo dos veces no suma dos veces, y se dice.
  if (!r.meta.changes)
    throw new ErrorDatos(
      'Ese comprobante ya se usó para este punto de venta. Escribe el número del pago nuevo.',
      'comprobante',
      409,
    );
  return saldoLibro(db, cuentaPunto(punto.id), 'punto', punto.pais, punto.moneda);
}

/**
 * El punto emite un código por `monto`: sale de su fondo en la misma sentencia (si no alcanza, no
 * hay código). El código se muestra UNA vez; aquí solo queda su hash.
 */
export async function emitirCodigo(
  db: D1Database,
  p: { puntoId: string; monto: number; emitidoPor: string },
) {
  const punto = await db
    .prepare('SELECT id, pais, moneda, activo FROM puntos_venta WHERE id = ?')
    .bind(p.puntoId)
    .first<{ id: string; pais: string; moneda: string; activo: number }>();
  if (!punto || !punto.activo)
    throw new ErrorDatos('Ese punto de venta no existe.', undefined, 404);
  const cfg = await leerConfigPais(db, punto.pais);
  if (!cfg.recargasPuntoVentaActivas)
    throw new ErrorDatos(
      'Las recargas en puntos de venta no están activas en este país.',
      undefined,
      409,
    );
  if (p.monto < cfg.recargaMin || p.monto > cfg.recargaMax)
    throw new ErrorDatos('La recarga está fuera de los límites permitidos.', 'monto', 409);
  const id = crypto.randomUUID();
  const ok = await descontarSiAlcanza(db, {
    cuentaId: cuentaPunto(punto.id),
    bolsillo: 'punto',
    pais: punto.pais,
    moneda: punto.moneda,
    monto: p.monto,
    concepto: 'codigo_emitido',
    referencia: `codigo:${id}:emitido`,
    autorId: p.emitidoPor,
  });
  if (!ok) throw new ErrorDatos('Ese punto de venta no tiene saldo suficiente.', 'monto', 409);
  const codigo = codigoNuevo();
  await db
    .prepare(
      'INSERT INTO codigos_recarga (id, codigo_hash, punto_id, pais, moneda, monto, emitido_por) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      await sha256(normalizarCodigo(codigo)),
      punto.id,
      punto.pais,
      punto.moneda,
      p.monto,
      p.emitidoPor,
    )
    .run();
  return { id, codigo, monto: p.monto, moneda: punto.moneda };
}

/** Un código emitido y no canjeado vuelve al fondo del punto. */
export async function anularCodigo(
  db: D1Database,
  /** puntoId null = soporte (código perdido, robado o vendido por error, también de un punto desactivado). */
  p: { codigoId: string; puntoId: string | null; autorId: string },
) {
  const c = await db
    .prepare('SELECT punto_id, pais, moneda, monto FROM codigos_recarga WHERE id = ?')
    .bind(p.codigoId)
    .first<{ punto_id: string; pais: string; moneda: string; monto: number }>();
  if (!c || (p.puntoId != null && c.punto_id !== p.puntoId))
    throw new ErrorDatos('Ese código no existe.', undefined, 404);
  const ref = `codigo:${p.codigoId}:anulado`;
  // Marcar y devolver el fondo en un solo lote: si algo falla, no queda el código anulado sin fondo.
  const [r] = await db.batch([
    db
      .prepare(
        "UPDATE codigos_recarga SET estado = 'anulado', anulado_en = datetime('now') WHERE id = ? AND estado = 'emitido'",
      )
      .bind(p.codigoId),
    db
      .prepare(
        `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia, autor_id)
         SELECT ?, ?, 'punto', ?, ?, ?, 'codigo_anulado', ?, ?
          WHERE EXISTS (SELECT 1 FROM codigos_recarga WHERE id = ? AND estado = 'anulado')`,
      )
      .bind(
        crypto.randomUUID(),
        cuentaPunto(c.punto_id),
        c.pais,
        c.moneda,
        c.monto,
        ref,
        p.autorId,
        p.codigoId,
      ),
  ]);
  if (!r?.meta.changes)
    throw new ErrorDatos('Ese código ya se canjeó: no se puede anular.', undefined, 409);
}

/** Recargas de los últimos 7 días (acreditadas o con tarjeta todavía pendientes), para el tope semanal. */
async function recargasDeLaSemana(db: D1Database, usuarioId: string) {
  const f = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM recargas WHERE usuario_id = ? AND estado IN ('acreditada', 'pendiente') AND creado_en > datetime('now', '-7 days')",
    )
    .bind(usuarioId)
    .first<{ n: number }>();
  return Number(f?.n ?? 0);
}

/**
 * El repartidor canjea un código: atómico (solo el primero que lo marca canjeado se lo lleva), con
 * tope de intentos fallidos por hora y límite de recargas por semana del país.
 */
export async function canjearCodigo(
  db: D1Database,
  p: { codigo: string; repartidorId: string; pais: string; moneda: string },
) {
  const intentos = await db
    .prepare(
      "SELECT fallidos, ultimo_en FROM intentos_canje WHERE usuario_id = ? AND ultimo_en > datetime('now', '-1 hour')",
    )
    .bind(p.repartidorId)
    .first<{ fallidos: number }>();
  if (Number(intentos?.fallidos ?? 0) >= MAX_FALLIDOS_HORA)
    throw new ErrorDatos(
      'Demasiados intentos. Espera una hora y vuelve a intentar.',
      undefined,
      409,
    );
  const cfg = await leerConfigPais(db, p.pais);
  if ((await recargasDeLaSemana(db, p.repartidorId)) >= cfg.recargasSemanaMax)
    throw new ErrorDatos('Llegaste al máximo de recargas de esta semana.', undefined, 409);
  const hash = await sha256(normalizarCodigo(p.codigo));
  const r = await db
    .prepare(
      // Solo códigos de un punto ACTIVO: si soporte desactiva un punto, sus códigos dejan de servir.
      "UPDATE codigos_recarga SET estado = 'canjeado', canjeado_por = ?, canjeado_en = datetime('now') WHERE codigo_hash = ? AND estado = 'emitido' AND pais = ? AND moneda = ? AND punto_id IN (SELECT id FROM puntos_venta WHERE activo = 1)",
    )
    .bind(p.repartidorId, hash, p.pais, p.moneda)
    .run();
  // Reintento después de una caída: el código ya quedó canjeado por ESTA persona pero el saldo no
  // llegó. Se termina de acreditar (la referencia del libro es única: nunca se acredita dos veces).
  const atascado = r.meta.changes
    ? null
    : await db
        .prepare(
          "SELECT c.id FROM codigos_recarga c WHERE c.codigo_hash = ? AND c.estado = 'canjeado' AND c.canjeado_por = ? AND NOT EXISTS (SELECT 1 FROM recargas x WHERE x.canal = 'codigo' AND x.referencia = c.id)",
        )
        .bind(hash, p.repartidorId)
        .first<{ id: string }>();
  if (!r.meta.changes && !atascado) {
    await db
      .prepare(
        `INSERT INTO intentos_canje (usuario_id, fallidos, ultimo_en) VALUES (?, 1, datetime('now'))
         ON CONFLICT(usuario_id) DO UPDATE SET
           fallidos = CASE WHEN ultimo_en > datetime('now', '-1 hour') THEN fallidos + 1 ELSE 1 END,
           ultimo_en = datetime('now')`,
      )
      .bind(p.repartidorId)
      .run();
    throw new ErrorDatos('Ese código no sirve o ya se usó.', 'codigo', 409);
  }
  const c = (await db
    .prepare('SELECT id, monto FROM codigos_recarga WHERE codigo_hash = ?')
    .bind(hash)
    .first<{ id: string; monto: number }>())!;
  const recargaId = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        `INSERT INTO recargas (id, usuario_id, pais, moneda, monto, canal, estado, referencia, acreditada_en)
         SELECT ?, ?, ?, ?, ?, 'codigo', 'acreditada', ?, datetime('now')
          WHERE NOT EXISTS (SELECT 1 FROM recargas WHERE canal = 'codigo' AND referencia = ?)`,
      )
      .bind(recargaId, p.repartidorId, p.pais, p.moneda, c.monto, c.id, c.id),
    sentenciaLibro(db, {
      cuentaId: p.repartidorId,
      bolsillo: 'prepago',
      pais: p.pais,
      moneda: p.moneda,
      monto: c.monto,
      concepto: 'recarga_codigo',
      referencia: `canje:${c.id}`,
      autorId: p.repartidorId,
    }),
    db.prepare('DELETE FROM intentos_canje WHERE usuario_id = ?').bind(p.repartidorId),
  ]);
  return { recargaId, monto: c.monto };
}

/** Recarga digital (Stripe, EE.UU.): queda pendiente hasta que Stripe confirme el cobro por webhook. */
export async function crearRecargaStripe(
  db: D1Database,
  p: { repartidorId: string; pais: string; moneda: string; monto: number },
) {
  const cfg = await leerConfigPais(db, p.pais);
  if (!cfg.recargasStripeActivas)
    throw new ErrorDatos('Las recargas con tarjeta no están activas en este país.', undefined, 409);
  if (p.monto < cfg.recargaMin || p.monto > cfg.recargaMax)
    throw new ErrorDatos('La recarga está fuera de los límites permitidos.', 'monto', 409);
  // El mismo tope semanal que los códigos (también cuenta las pendientes: no se abren cobros sin fin).
  if ((await recargasDeLaSemana(db, p.repartidorId)) >= cfg.recargasSemanaMax)
    throw new ErrorDatos('Llegaste al máximo de recargas de esta semana.', undefined, 409);
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO recargas (id, usuario_id, pais, moneda, monto, canal, estado) VALUES (?, ?, ?, ?, ?, 'stripe', 'pendiente')",
    )
    .bind(id, p.repartidorId, p.pais, p.moneda, p.monto)
    .run();
  return id;
}

/** Aviso payment_intent.succeeded con metadata.recarga_id: acredita UNA vez (referencia única). */
export async function acreditarRecargaStripe(db: D1Database, obj: Record<string, unknown>) {
  const recargaId = (obj.metadata as Record<string, string> | undefined)?.recarga_id;
  if (!recargaId) return false;
  const r = await db
    .prepare('SELECT id, usuario_id, pais, moneda, monto, estado FROM recargas WHERE id = ?')
    .bind(recargaId)
    .first<{
      id: string;
      usuario_id: string;
      pais: string;
      moneda: string;
      monto: number;
      estado: string;
    }>();
  if (!r) {
    console.error('recarga: aviso de Stripe sin recarga conocida', recargaId);
    return false;
  }
  if (Number(obj.amount_received) !== r.monto) {
    console.error('recarga: el monto de Stripe no cuadra', recargaId, obj.amount_received, r.monto);
    return false;
  }
  await db.batch([
    db
      .prepare(
        "UPDATE recargas SET estado = 'acreditada', acreditada_en = datetime('now'), referencia = ? WHERE id = ? AND estado = 'pendiente'",
      )
      .bind(String(obj.id), r.id),
    sentenciaLibro(db, {
      cuentaId: r.usuario_id,
      bolsillo: 'prepago',
      pais: r.pais,
      moneda: r.moneda,
      monto: r.monto,
      concepto: 'recarga_stripe',
      referencia: `recarga:${r.id}`,
    }),
  ]);
  return true;
}
