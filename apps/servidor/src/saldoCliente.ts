import {
  MONEDA_SALDO_DIVOOX,
  type MotivoCargaSaldo,
  conceptoDeMotivo,
  formatearMonto,
} from '@tumbite/compartido';
import type { Env } from './env';
import { nuevoId } from './cripto';
import { ErrorDatos } from './validar';
import { CUENTA_TUMBITE } from './internacional/libro';
import { notificar } from './notificaciones';
import { detalleRevision, type MotivoRevision } from './viajeReal';
import { medirViajeReal } from './regalosDivoox';

/**
 * C-SALDO-CLIENTE (25 nov 2026, Venezuela; la pieza sirve a todos los países). El Saldo Divoox del
 * pasajero: crédito prepagado en dólares. ÚNICA pieza que escribe `saldo_cliente_movimientos` y
 * `usos_saldo_divoox` (nadie más: lo vigila la prueba del candado).
 *
 * - Entra saldo solo desde el panel (el equipo): carrera de regalo, recarga de regalo o el prepago del
 *   cliente con su referencia. Motivo obligatorio, topes por carga y por día (configurables dentro del
 *   máximo del código) y todo queda en `auditoria_admin`. No hay pasarela de recarga para el cliente.
 * - En un viaje: se APARTA al pedir (sale del saldo en la MISMA sentencia que comprueba que alcanza:
 *   dos pedidos a la vez no gastan el mismo dólar dos veces), se LIBERA entero si el viaje no se hizo y
 *   se COBRA al terminar. Si el total final baja, la diferencia vuelve al saldo; si sube, el saldo no
 *   crece (la diferencia se paga en mano).
 * - Al conductor se le acredita lo cubierto como ganancia (concepto «regalo» de `movimientos`, el mismo
 *   camino del regalo de Divoox) con su fila en el libro contra la cuenta de Divoox, solo si el viaje
 *   fue real (viajeReal.ts); lo dudoso queda «en revisión» para el equipo.
 */

/** Topes de las cargas del equipo, en centavos de dólar. El panel los cambia sin pasar el máximo. */
export type TopesSaldoCliente = {
  /** Lo más que se carga de una vez. */
  porCarga: number;
  /** Lo más que una persona del equipo carga en 24 horas (sumando todos los clientes). */
  porDiaEquipo: number;
  /** Lo más que recibe un mismo cliente en 24 horas. */
  porDiaCliente: number;
};
export const TOPES_SALDO_CLIENTE_INICIALES: TopesSaldoCliente = {
  porCarga: 2_000,
  porDiaEquipo: 20_000,
  porDiaCliente: 5_000,
};
/** El techo del código: ningún ajuste del panel lo pasa. */
export const TOPES_SALDO_CLIENTE_MAXIMOS: TopesSaldoCliente = {
  porCarga: 10_000,
  porDiaEquipo: 50_000,
  porDiaCliente: 10_000,
};
const CLAVE_TOPES = 'saldo_cliente_topes';

export async function leerTopesSaldoCliente(db: D1Database): Promise<TopesSaldoCliente> {
  const f = await db
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(CLAVE_TOPES)
    .first<{ valor: string }>();
  let guardados: Partial<TopesSaldoCliente> = {};
  try {
    guardados = f ? (JSON.parse(f.valor) as Partial<TopesSaldoCliente>) : {};
  } catch {
    console.error('saldo cliente: topes guardados dañados; se usan los iniciales');
  }
  const uno = (v: unknown, inicial: number, maximo: number) => {
    const n = Number(v);
    return Number.isSafeInteger(n) && n > 0 ? Math.min(n, maximo) : inicial;
  };
  const i = TOPES_SALDO_CLIENTE_INICIALES;
  const m = TOPES_SALDO_CLIENTE_MAXIMOS;
  return {
    porCarga: uno(guardados.porCarga, i.porCarga, m.porCarga),
    porDiaEquipo: uno(guardados.porDiaEquipo, i.porDiaEquipo, m.porDiaEquipo),
    porDiaCliente: uno(guardados.porDiaCliente, i.porDiaCliente, m.porDiaCliente),
  };
}

export async function guardarTopesSaldoCliente(
  db: D1Database,
  topes: TopesSaldoCliente,
  autorId: string,
) {
  const m = TOPES_SALDO_CLIENTE_MAXIMOS;
  for (const [k, v, maximo] of [
    ['porCarga', topes.porCarga, m.porCarga],
    ['porDiaEquipo', topes.porDiaEquipo, m.porDiaEquipo],
    ['porDiaCliente', topes.porDiaCliente, m.porDiaCliente],
  ] as const) {
    if (!Number.isSafeInteger(v) || v <= 0)
      throw new ErrorDatos('Escribe un tope mayor que cero.', k, 422);
    if (v > maximo) throw new ErrorDatos('Ese tope pasa el máximo de Divoox.', k, 422);
  }
  const antes = await leerTopesSaldoCliente(db);
  await db.batch([
    db
      .prepare(
        "INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
      )
      .bind(CLAVE_TOPES, JSON.stringify(topes)),
    db
      .prepare(
        'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        autorId,
        'saldo_cliente_topes',
        'saldo_cliente',
        JSON.stringify(antes),
        JSON.stringify(topes),
      ),
  ]);
  return leerTopesSaldoCliente(db);
}

/** El saldo disponible del cliente (la suma de su libro), en centavos de dólar. */
export async function saldoDeCliente(
  db: D1Database,
  clienteId: string,
  moneda: string = MONEDA_SALDO_DIVOOX,
): Promise<number> {
  const f = await db
    .prepare(
      'SELECT COALESCE(SUM(monto), 0) AS s FROM saldo_cliente_movimientos WHERE cliente_id = ? AND moneda = ?',
    )
    .bind(clienteId, moneda)
    .first<{ s: number }>();
  return Number(f?.s ?? 0);
}

/** La condición «al cliente le alcanza el saldo para ?monto» (la misma en las sentencias que restan). */
const ALCANZA = (cliente: string, monto: string) =>
  `(SELECT COALESCE(SUM(m.monto), 0) FROM saldo_cliente_movimientos m WHERE m.cliente_id = ${cliente} AND m.moneda = '${MONEDA_SALDO_DIVOOX}') >= ${monto}`;

export const NOMBRE_MOTIVO_CARGA: Record<MotivoCargaSaldo, string> = {
  carrera_regalo: 'Carrera de regalo',
  recarga_regalo: 'Recarga de regalo',
  prepago: 'Prepago del cliente',
};

/**
 * El equipo carga saldo a un cliente. Idempotente por `idempotencia` (el panel manda una por
 * formulario: un doble toque no carga dos veces). Los topes del día se comprueban en la MISMA
 * sentencia que escribe: dos cargas a la vez no pasan el tope juntas.
 */
export async function cargarSaldoCliente(
  env: Env | undefined,
  db: D1Database,
  p: {
    clienteId: string;
    monto: number;
    motivo: MotivoCargaSaldo;
    nota: string;
    comprobante: string;
    autorId: string;
    idempotencia: string;
  },
) {
  if (!Number.isSafeInteger(p.monto) || p.monto <= 0)
    throw new ErrorDatos('Escribe un monto mayor que cero.', 'monto', 422);
  if (p.motivo === 'prepago' && p.comprobante.trim().length < 3)
    throw new ErrorDatos(
      'Para un prepago del cliente escribe la referencia del pago.',
      'comprobante',
      422,
    );
  const cliente = await db
    .prepare("SELECT id, nombre FROM usuarios WHERE id = ? AND rol = 'cliente' AND activo = 1")
    .bind(p.clienteId)
    .first<{ id: string; nombre: string }>();
  if (!cliente) throw new ErrorDatos('No encontramos a ese cliente.', undefined, 404);
  const topes = await leerTopesSaldoCliente(db);
  if (p.monto > topes.porCarga)
    throw new ErrorDatos('Esa carga pasa el tope por carga.', 'monto', 422);
  const referencia = `carga:${p.idempotencia}`;
  const ya = await db
    .prepare('SELECT id, cliente_id, monto FROM saldo_cliente_movimientos WHERE referencia = ?')
    .bind(referencia)
    .first<{ id: string; cliente_id: string; monto: number }>();
  if (ya) {
    if (ya.cliente_id !== p.clienteId || Number(ya.monto) !== p.monto)
      throw new ErrorDatos('Esa carga ya se registró con otros datos.', undefined, 409);
    return { id: ya.id, saldo: await saldoDeCliente(db, p.clienteId), repetida: true };
  }
  const id = nuevoId();
  const concepto = conceptoDeMotivo(p.motivo);
  const motivo = `${NOMBRE_MOTIVO_CARGA[p.motivo]}${p.nota.trim() ? ` · ${p.nota.trim()}` : ''}`;
  const [ins] = await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO saldo_cliente_movimientos (id, cliente_id, monto, moneda, concepto, referencia, autor_id, motivo, comprobante)
         SELECT ?1, ?2, ?3, '${MONEDA_SALDO_DIVOOX}', ?4, ?5, ?6, ?7, ?8
          WHERE (SELECT COALESCE(SUM(monto), 0) FROM saldo_cliente_movimientos
                  WHERE autor_id = ?6 AND monto > 0 AND creado_en > datetime('now', '-1 day')) + ?3 <= ?9
            AND (SELECT COALESCE(SUM(monto), 0) FROM saldo_cliente_movimientos
                  WHERE cliente_id = ?2 AND autor_id IS NOT NULL AND monto > 0 AND creado_en > datetime('now', '-1 day')) + ?3 <= ?10`,
      )
      .bind(
        id,
        p.clienteId,
        p.monto,
        concepto,
        referencia,
        p.autorId,
        motivo.slice(0, 160),
        p.comprobante.trim().slice(0, 80),
        topes.porDiaEquipo,
        topes.porDiaCliente,
      ),
    db
      .prepare(
        `INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json)
         SELECT ?, 'saldo_cliente_carga', ?, NULL, ? WHERE EXISTS (SELECT 1 FROM saldo_cliente_movimientos WHERE id = ?)`,
      )
      .bind(
        p.autorId,
        `cliente:${p.clienteId}`,
        JSON.stringify({
          movimiento: id,
          monto: p.monto,
          moneda: MONEDA_SALDO_DIVOOX,
          motivo: p.motivo,
          nota: p.nota.trim().slice(0, 120),
          comprobante: p.comprobante.trim().slice(0, 80),
        }),
        id,
      ),
  ]);
  if (!ins?.meta.changes)
    throw new ErrorDatos(
      'Esa carga pasa el tope del día (tuyo o de este cliente). Inténtalo mañana o pide que suban el tope.',
      'monto',
      422,
    );
  const saldo = await saldoDeCliente(db, p.clienteId);
  await avisarSaldoCliente(env, db, p.clienteId, saldo);
  return { id, saldo, repetida: false };
}

/** «Tienes X $ de Saldo Divoox»: el aviso al cliente cuando el equipo le carga saldo (nunca frena). */
async function avisarSaldoCliente(
  env: Env | undefined,
  db: D1Database,
  clienteId: string,
  saldo: number,
) {
  if (!env || saldo <= 0) return;
  try {
    await notificar(env, db, { id: clienteId, app: 'cliente' }, (i) => ({
      titulo: i === 'en' ? 'You have Divoox Balance' : 'Tienes Saldo Divoox',
      cuerpo:
        i === 'en'
          ? `You have ${formatearMonto(saldo, 'USD', 'en')} of Divoox Balance. Use it to pay your next ride.`
          : `Tienes ${formatearMonto(saldo, 'USD', 'es')} de Saldo Divoox. Úsalo para pagar tu próximo viaje.`,
      datos: { tipo: 'saldo_divoox' },
      canal: 'dinero',
    }));
  } catch (e) {
    console.error('saldo cliente: no salió el aviso de la carga', String(e));
  }
}

/** Los últimos movimientos del saldo de un cliente (lo más nuevo primero). */
export async function movimientosSaldoCliente(db: D1Database, clienteId: string, limite = 50) {
  const { results } = await db
    .prepare(
      `SELECT m.id, m.monto, m.moneda, m.concepto, m.referencia, m.operacion_id, m.motivo, m.comprobante, m.creado_en,
              a.nombre AS autor
         FROM saldo_cliente_movimientos m LEFT JOIN usuarios a ON a.id = m.autor_id
        WHERE m.cliente_id = ? ORDER BY m.creado_en DESC, m.rowid DESC LIMIT ?`,
    )
    .bind(clienteId, limite)
    .all<Record<string, unknown>>();
  return results.map((m) => ({
    id: String(m.id),
    monto: Number(m.monto),
    moneda: String(m.moneda),
    concepto: String(m.concepto),
    operacionId: m.operacion_id == null ? null : String(m.operacion_id),
    motivo: String(m.motivo ?? ''),
    comprobante: String(m.comprobante ?? ''),
    autor: m.autor == null ? null : String(m.autor),
    creadoEn: String(m.creado_en),
  }));
}

// ───────────────────────── El saldo en un viaje ─────────────────────────

/**
 * Aparta `monto` del saldo para esta operación, en UN lote: el movimiento negativo solo entra si el
 * saldo alcanza (en la misma sentencia) y el uso solo nace si entró el movimiento. Devuelve si se
 * apartó. Repetirlo con la misma operación no aparta dos veces (referencia única).
 */
export async function apartarSaldoViaje(
  db: D1Database,
  p: { operacionId: string; clienteId: string; monto: number; pais: string },
): Promise<boolean> {
  if (!Number.isSafeInteger(p.monto) || p.monto <= 0) return false;
  const ref = `viaje:${p.operacionId}:uso`;
  const [mov] = await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO saldo_cliente_movimientos (id, cliente_id, monto, moneda, concepto, referencia, operacion_id)
         SELECT ?1, ?2, -?3, '${MONEDA_SALDO_DIVOOX}', 'uso_viaje', ?4, ?5 WHERE ${ALCANZA('?2', '?3')}`,
      )
      .bind(nuevoId(), p.clienteId, p.monto, ref, p.operacionId),
    db
      .prepare(
        `INSERT OR IGNORE INTO usos_saldo_divoox (operacion_id, cliente_id, monto, apartado, moneda, pais)
         SELECT ?1, ?2, ?3, ?3, '${MONEDA_SALDO_DIVOOX}', ?4
          WHERE EXISTS (SELECT 1 FROM saldo_cliente_movimientos WHERE referencia = ?5)`,
      )
      .bind(p.operacionId, p.clienteId, p.monto, p.pais, ref),
  ]);
  return Boolean(mov?.meta.changes);
}

/**
 * Antes de que un conductor acepte un viaje pagado (en parte) con Saldo Divoox: no puede ser el que
 * lo pidió (su misma cuenta o su mismo celular). Es la misma llave del regalo: así nadie cambia su
 * propio saldo por dinero con un viaje de mentira.
 */
export async function tomarSaldoConductor(
  db: D1Database,
  operacionId: string,
  conductorId: string,
) {
  const f = await db
    .prepare(
      `SELECT u.cliente_id, cli.telefono_canonico AS tel_cliente, yo.telefono_canonico AS tel_conductor
         FROM usos_saldo_divoox u LEFT JOIN usuarios cli ON cli.id = u.cliente_id
         LEFT JOIN usuarios yo ON yo.id = ?2
        WHERE u.operacion_id = ?1 AND u.estado = 'apartado'`,
    )
    .bind(operacionId, conductorId)
    .first<{ cliente_id: string; tel_cliente: string | null; tel_conductor: string | null }>();
  if (!f) return;
  if (f.cliente_id === conductorId || (f.tel_cliente != null && f.tel_cliente === f.tel_conductor))
    throw new ErrorDatos(
      'No puedes tomar un viaje pagado con el Saldo Divoox de tu propia cuenta o tu propio teléfono.',
      undefined,
      409,
    );
}

/** Lo que el Saldo Divoox cubre (apartado o cobrado) en una operación, o 0. */
export async function saldoDeOperacion(db: D1Database, operacionId: string): Promise<number> {
  const f = await db
    .prepare(
      "SELECT monto FROM usos_saldo_divoox WHERE operacion_id = ? AND estado IN ('apartado', 'cobrado', 'en_revision')",
    )
    .bind(operacionId)
    .first<{ monto: number }>();
  return Number(f?.monto ?? 0);
}

/**
 * El viaje no se hizo (cancelado, sin conductor, no se presentó sin cargo, no se pudo crear): lo
 * apartado vuelve ENTERO al saldo. Una sola vez.
 */
export async function liberarSaldoViaje(db: D1Database, operacionId: string, motivo: string) {
  const r = await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO saldo_cliente_movimientos (id, cliente_id, monto, moneda, concepto, referencia, operacion_id, motivo)
         SELECT ?1, cliente_id, apartado, moneda, 'devolucion', ?2, operacion_id, ?3
           FROM usos_saldo_divoox WHERE operacion_id = ?4 AND estado = 'apartado'`,
      )
      .bind(nuevoId(), `viaje:${operacionId}:devolucion`, motivo.slice(0, 80), operacionId),
    db
      .prepare(
        `UPDATE usos_saldo_divoox SET estado = 'liberado', monto = 0, cerrado_en = datetime('now'), motivo = ?
          WHERE operacion_id = ? AND estado = 'apartado'
            AND EXISTS (SELECT 1 FROM saldo_cliente_movimientos WHERE referencia = ?)`,
      )
      .bind(motivo.slice(0, 80), operacionId, `viaje:${operacionId}:devolucion`),
    db
      .prepare(
        'UPDATE viajes SET saldo_divoox = 0 WHERE operacion_id = ? AND saldo_divoox <> 0 AND EXISTS (SELECT 1 FROM usos_saldo_divoox WHERE operacion_id = ? AND estado = ?)',
      )
      .bind(operacionId, operacionId, 'liberado'),
  ]);
  return Number(r[1]?.meta.changes ?? 0) > 0;
}

/** Acredita al conductor lo cubierto por el saldo (estado de origen `desde`), en un lote. */
async function pagarSaldoAlConductor(
  db: D1Database,
  p: { operacionId: string; conductorId: string; monto: number; desde: 'apartado' | 'en_revision' },
) {
  const ref = `saldo-divoox:${p.operacionId}`;
  const [cierre] = await db.batch([
    db
      .prepare(
        `UPDATE usos_saldo_divoox SET estado = 'cobrado', monto = ?, conductor_id = ?, cerrado_en = datetime('now')
          WHERE operacion_id = ? AND estado = ?`,
      )
      .bind(p.monto, p.conductorId, p.operacionId, p.desde),
    // Va a sus GANANCIAS por el mismo camino del regalo de Divoox (se le paga por pago móvil o lo
    // pasa a su saldo con un toque).
    db
      .prepare(
        `INSERT OR IGNORE INTO movimientos (id, usuario_id, monto, concepto, referencia)
         SELECT ?, ?, ?, 'regalo', ? WHERE ? > 0
           AND EXISTS (SELECT 1 FROM usos_saldo_divoox WHERE operacion_id = ? AND estado = 'cobrado' AND conductor_id = ?)
           AND NOT EXISTS (SELECT 1 FROM movimientos WHERE referencia = ?)`,
      )
      .bind(nuevoId(), p.conductorId, p.monto, ref, p.monto, p.operacionId, p.conductorId, ref),
    // La contrapartida: lo paga la cuenta de Divoox (el saldo del cliente ya salió de su libro).
    db
      .prepare(
        `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia, autor_id)
         SELECT ?, ?, 'comisiones', u.pais, u.moneda, ?, 'saldo_divoox_pagado', ?, NULL
           FROM usos_saldo_divoox u WHERE u.operacion_id = ? AND u.estado = 'cobrado' AND u.conductor_id = ? AND ? > 0`,
      )
      .bind(
        crypto.randomUUID(),
        CUENTA_TUMBITE,
        -p.monto,
        `${ref}:divoox`,
        p.operacionId,
        p.conductorId,
        p.monto,
      ),
    db
      .prepare('UPDATE viajes SET saldo_divoox = ? WHERE operacion_id = ?')
      .bind(p.monto, p.operacionId),
  ]);
  return Boolean(cierre?.meta.changes);
}

export type CierreSaldoViaje = { monto: number; enRevision: boolean };

/**
 * El cierre del saldo de un viaje terminado. `maximo` = lo que queda del total final después del
 * regalo: el saldo cubre hasta eso y nunca más de lo apartado; la diferencia que sobre vuelve al
 * saldo del cliente. Si el viaje no parece real, queda en revisión (el pasajero ya pagó su parte con
 * saldo; el conductor no la recibe hasta que el equipo apruebe). Idempotente.
 */
export async function cerrarSaldoDeViaje(
  db: D1Database,
  p: { operacionId: string; conductorId: string; maximo: number; alTerminar: boolean },
): Promise<CierreSaldoViaje> {
  const u = await db
    .prepare(
      "SELECT apartado, monto, estado FROM usos_saldo_divoox WHERE operacion_id = ? AND estado IN ('apartado', 'en_revision', 'cobrado')",
    )
    .bind(p.operacionId)
    .first<{ apartado: number; monto: number; estado: string }>();
  if (!u) return { monto: 0, enRevision: false };
  if (u.estado === 'cobrado') return { monto: Number(u.monto), enRevision: false };
  if (u.estado === 'en_revision') return { monto: Number(u.monto), enRevision: true };
  const apartado = Number(u.apartado);
  const monto = Math.max(0, Math.min(apartado, Math.floor(p.maximo)));
  if (monto === 0) {
    await liberarSaldoViaje(db, p.operacionId, 'sin_monto');
    return { monto: 0, enRevision: false };
  }
  // El total final bajó: lo que sobra de lo apartado vuelve al saldo del cliente (una vez).
  if (monto < apartado)
    await db
      .prepare(
        `INSERT OR IGNORE INTO saldo_cliente_movimientos (id, cliente_id, monto, moneda, concepto, referencia, operacion_id, motivo)
         SELECT ?, cliente_id, ?, moneda, 'devolucion', ?, operacion_id, 'total_final_menor'
           FROM usos_saldo_divoox WHERE operacion_id = ? AND estado = 'apartado'`,
      )
      .bind(nuevoId(), apartado - monto, `viaje:${p.operacionId}:sobrante`, p.operacionId)
      .run();
  const medida = await medirViajeReal(db, p);
  if (!medida || medida.motivos.length === 0) {
    await pagarSaldoAlConductor(db, { ...p, monto, desde: 'apartado' });
    return { monto, enRevision: false };
  }
  const detalle = detalleRevision(medida.motivos, medida.medidas);
  await db.batch([
    db
      .prepare(
        `UPDATE usos_saldo_divoox SET estado = 'en_revision', monto = ?, conductor_id = ?, motivos = ?, detalle = ?
          WHERE operacion_id = ? AND estado = 'apartado'`,
      )
      .bind(monto, p.conductorId, JSON.stringify(medida.motivos), detalle, p.operacionId),
    db
      .prepare('UPDATE viajes SET saldo_divoox = ? WHERE operacion_id = ?')
      .bind(monto, p.operacionId),
  ]);
  return { monto, enRevision: true };
}

/** Lo que el saldo de clientes tiene en revisión (lo pendiente primero). */
export async function revisionesSaldo(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT u.operacion_id, u.monto, u.moneda, u.motivos, u.detalle, u.estado, u.creado_en, u.cerrado_en,
              cli.nombre AS cliente, con.nombre AS conductor
         FROM usos_saldo_divoox u
         LEFT JOIN usuarios cli ON cli.id = u.cliente_id LEFT JOIN usuarios con ON con.id = u.conductor_id
        WHERE u.estado = 'en_revision' ORDER BY u.creado_en DESC LIMIT 100`,
    )
    .all<Record<string, unknown>>();
  return results.map((r) => ({
    operacionId: String(r.operacion_id),
    monto: Number(r.monto),
    moneda: String(r.moneda),
    motivos: JSON.parse(String(r.motivos ?? '[]')) as MotivoRevision[],
    detalle: String(r.detalle ?? ''),
    cliente: String(r.cliente ?? '').split(' ')[0] ?? '',
    conductor: String(r.conductor ?? ''),
    creadoEn: String(r.creado_en),
  }));
}

/**
 * El equipo resuelve un saldo en revisión. Aprobado: se le acredita al conductor. Rechazado: el
 * saldo vuelve al cliente (Divoox no paga un viaje que no fue). Una sola vez; queda en la auditoría.
 */
export async function resolverRevisionSaldo(
  db: D1Database,
  p: { operacionId: string; aprobar: boolean; autorId: string; nota: string },
) {
  const u = await db
    .prepare(
      "SELECT conductor_id, monto FROM usos_saldo_divoox WHERE operacion_id = ? AND estado = 'en_revision'",
    )
    .bind(p.operacionId)
    .first<{ conductor_id: string | null; monto: number }>();
  if (!u || !u.conductor_id)
    throw new ErrorDatos('Este saldo ya fue revisado. Actualiza la pantalla.', undefined, 409);
  const auditoria = db
    .prepare(
      'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(
      p.autorId,
      p.aprobar ? 'saldo_cliente_revision_aprobada' : 'saldo_cliente_revision_rechazada',
      `viaje:${p.operacionId}`,
      JSON.stringify({ estado: 'en_revision', monto: Number(u.monto) }),
      JSON.stringify({ nota: p.nota.slice(0, 200) }),
    );
  if (p.aprobar) {
    const ok = await pagarSaldoAlConductor(db, {
      operacionId: p.operacionId,
      conductorId: u.conductor_id,
      monto: Number(u.monto),
      desde: 'en_revision',
    });
    if (!ok)
      throw new ErrorDatos('Este saldo ya fue revisado. Actualiza la pantalla.', undefined, 409);
    await auditoria.run();
    return { pagado: Number(u.monto) };
  }
  const ref = `viaje:${p.operacionId}:rechazo`;
  const [, cambio] = await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO saldo_cliente_movimientos (id, cliente_id, monto, moneda, concepto, referencia, operacion_id, motivo)
         SELECT ?, cliente_id, monto, moneda, 'devolucion', ?, operacion_id, 'revision_rechazada'
           FROM usos_saldo_divoox WHERE operacion_id = ? AND estado = 'en_revision' AND monto > 0`,
      )
      .bind(nuevoId(), ref, p.operacionId),
    db
      .prepare(
        `UPDATE usos_saldo_divoox SET estado = 'liberado', monto = 0, cerrado_en = datetime('now'), motivo = 'revision_rechazada', resuelto_por = ?
          WHERE operacion_id = ? AND estado = 'en_revision'`,
      )
      .bind(p.autorId, p.operacionId),
    db.prepare('UPDATE viajes SET saldo_divoox = 0 WHERE operacion_id = ?').bind(p.operacionId),
    auditoria,
  ]);
  if (!cambio?.meta.changes)
    throw new ErrorDatos('Este saldo ya fue revisado. Actualiza la pantalla.', undefined, 409);
  return { pagado: 0 };
}

/** Minutos que el reloj espera antes de cerrar el saldo de un viaje recién terminado. */
const MINUTOS_RELOJ_ESPERA = 10;

/**
 * El reloj: libera lo apartado de viajes que no se hicieron y cierra lo de viajes terminados cuyo
 * cierre se cortó. Lee solo los usos abiertos (índice parcial); sin ninguno, no escribe.
 */
export async function barrerSaldos(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT u.operacion_id, u.creado_en < datetime('now', '-30 minutes') AS viejo,
              o.estado_general, o.conductor_id, v.total_final_centavos,
              v.terminado_en > datetime('now', '-${MINUTOS_RELOJ_ESPERA} minutes') AS reciente,
              (SELECT rg.monto FROM usos_cupon_divoox rg WHERE rg.operacion_id = u.operacion_id AND rg.estado <> 'liberado') AS regalo
         FROM usos_saldo_divoox u
         LEFT JOIN operaciones o ON o.id = u.operacion_id
         LEFT JOIN viajes v ON v.operacion_id = u.operacion_id
        WHERE u.estado = 'apartado' LIMIT 100`,
    )
    .all<{
      operacion_id: string;
      viejo: number;
      estado_general: string | null;
      conductor_id: string | null;
      total_final_centavos: number | null;
      reciente: number | null;
      regalo: number | null;
    }>();
  let n = 0;
  for (const r of results) {
    if (r.estado_general === 'terminada' && r.conductor_id) {
      if (r.total_final_centavos == null || Number(r.reciente) === 1) continue;
      const c = await cerrarSaldoDeViaje(db, {
        operacionId: r.operacion_id,
        conductorId: r.conductor_id,
        maximo: Math.max(0, Number(r.total_final_centavos) - Number(r.regalo ?? 0)),
        alTerminar: false,
      });
      if (c.monto) n++;
    } else if (r.estado_general === 'cancelada' || r.estado_general === 'sin_conductor') {
      if (await liberarSaldoViaje(db, r.operacion_id, r.estado_general)) n++;
    } else if (r.viejo && !r.estado_general) {
      // Una operación que nunca llegó a nacer.
      if (await liberarSaldoViaje(db, r.operacion_id, 'sin_operacion')) n++;
    }
  }
  return n;
}

export const TAREA_SALDO_CLIENTES = {
  nombre: 'saldo_clientes',
  critica: false,
  // Hasta 100 usos abiertos por vuelta, cuatro filas cada uno como mucho.
  escriturasEsperadas: 400,
  correr: (_env: unknown, db: D1Database) => barrerSaldos(db),
};

/**
 * Pieza «saldo_clientes» del canario: rojo si algún cliente quedó con saldo negativo (no puede pasar:
 * dos llaves lo impiden), si lo apartado no cuadra con su viaje (apartado en un viaje cerrado hace más
 * de una hora, o un uso cobrado sin su crédito al conductor) o si una revisión lleva días olvidada.
 */
export async function saludSaldoClientes(db: D1Database): Promise<'ok' | 'error'> {
  const f = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM (SELECT 1 FROM saldo_cliente_movimientos GROUP BY cliente_id, moneda HAVING SUM(monto) < 0 LIMIT 1)) AS negativos,
         (SELECT COUNT(*) FROM usos_saldo_divoox u LEFT JOIN operaciones o ON o.id = u.operacion_id
           WHERE u.estado = 'apartado' AND o.estado_general IN ('terminada', 'cancelada', 'sin_conductor')
             AND o.actualizado_en < datetime('now', '-1 hour')) AS colgados,
         (SELECT COUNT(*) FROM usos_saldo_divoox u WHERE u.estado = 'cobrado' AND u.monto > 0
             AND u.cerrado_en > datetime('now', '-7 days')
             AND NOT EXISTS (SELECT 1 FROM movimientos m WHERE m.usuario_id = u.conductor_id AND m.referencia = 'saldo-divoox:' || u.operacion_id)) AS sin_credito,
         (SELECT COUNT(*) FROM usos_saldo_divoox u WHERE u.estado = 'en_revision'
             AND u.creado_en < datetime('now', '-7 days')) AS olvidadas`,
    )
    .first<{ negativos: number; colgados: number; sin_credito: number; olvidadas: number }>();
  const malos =
    Number(f?.negativos ?? 0) +
    Number(f?.colgados ?? 0) +
    Number(f?.sin_credito ?? 0) +
    Number(f?.olvidadas ?? 0);
  return malos > 0 ? 'error' : 'ok';
}

/** Resumen para el panel: cuánto saldo hay en manos de los clientes y cuánto está apartado. */
export async function resumenSaldoClientes(db: D1Database) {
  const f = await db
    .prepare(
      `SELECT (SELECT COALESCE(SUM(monto), 0) FROM saldo_cliente_movimientos WHERE moneda = '${MONEDA_SALDO_DIVOOX}') AS disponible,
              (SELECT COALESCE(SUM(apartado), 0) FROM usos_saldo_divoox WHERE estado = 'apartado') AS apartado,
              (SELECT COUNT(*) FROM usos_saldo_divoox WHERE estado = 'en_revision') AS en_revision`,
    )
    .first<{ disponible: number; apartado: number; en_revision: number }>();
  return {
    disponible: Number(f?.disponible ?? 0),
    apartado: Number(f?.apartado ?? 0),
    enRevision: Number(f?.en_revision ?? 0),
    moneda: MONEDA_SALDO_DIVOOX,
  };
}
