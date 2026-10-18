import { ErrorDatos } from '../validar';

export type Bolsillo =
  'prepago' | 'reservado' | 'comisiones' | 'punto' | 'deuda_cliente' | 'directo';

export type FilaLibro = {
  cuentaId: string;
  bolsillo: Bolsillo;
  pais: string;
  moneda: string;
  monto: number;
  concepto: string;
  pedidoId?: string | null;
  referencia?: string | null;
  autorId?: string | null;
};

export const CUENTA_TUMBITE = 'tumbite';
export const cuentaPunto = (puntoId: string) => `punto:${puntoId}`;

function entero(n: number) {
  if (!Number.isSafeInteger(n)) throw new Error(`libro: monto inválido (${n})`);
}

/** Una fila del libro. La referencia (si viene) es única: repetirla no duplica el movimiento. */
export function sentenciaLibro(db: D1Database, f: FilaLibro) {
  entero(f.monto);
  return db
    .prepare(
      'INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, pedido_id, referencia, autor_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      crypto.randomUUID(),
      f.cuentaId,
      f.bolsillo,
      f.pais,
      f.moneda,
      f.monto,
      f.concepto,
      f.pedidoId ?? null,
      f.referencia ?? null,
      f.autorId ?? null,
    );
}

export async function anotarLibro(db: D1Database, f: FilaLibro) {
  return sentenciaLibro(db, f).run();
}

export async function saldoLibro(
  db: D1Database,
  cuentaId: string,
  bolsillo: Bolsillo,
  pais: string,
  moneda: string,
): Promise<number> {
  const f = await db
    .prepare(
      'SELECT COALESCE(SUM(monto), 0) AS saldo FROM libro WHERE cuenta_id = ? AND bolsillo = ? AND pais = ? AND moneda = ?',
    )
    .bind(cuentaId, bolsillo, pais, moneda)
    .first<{ saldo: number }>();
  return Number(f?.saldo ?? 0);
}

/**
 * Descuenta `monto` de un bolsillo SOLO si alcanza, en una sola sentencia (dos a la vez no pueden
 * dejarlo negativo). Devuelve false si no alcanzó: nada cambió.
 */
export async function descontarSiAlcanza(
  db: D1Database,
  f: FilaLibro & { monto: number },
): Promise<boolean> {
  entero(f.monto);
  if (f.monto <= 0) throw new Error('libro: el descuento tiene que ser positivo');
  const r = await db
    .prepare(
      `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, pedido_id, referencia, autor_id)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
        WHERE (SELECT COALESCE(SUM(monto), 0) FROM libro WHERE cuenta_id = ?2 AND bolsillo = ?3 AND pais = ?4 AND moneda = ?5) >= ?11`,
    )
    .bind(
      crypto.randomUUID(),
      f.cuentaId,
      f.bolsillo,
      f.pais,
      f.moneda,
      -f.monto,
      f.concepto,
      f.pedidoId ?? null,
      f.referencia ?? null,
      f.autorId ?? null,
      f.monto,
    )
    .run();
  return Number(r.meta.changes) === 1;
}

/** Comisión apartada al aceptar un pedido en cobro directo: sale de `prepago` y entra en `reservado`. */
export async function reservarComision(
  db: D1Database,
  p: { pedidoId: string; repartidorId: string; pais: string; moneda: string; monto: number },
): Promise<boolean> {
  if (p.monto <= 0) return true;
  const ref = `reserva:${p.pedidoId}:${p.repartidorId}`;
  const ya = await db
    .prepare('SELECT 1 FROM libro WHERE referencia = ?')
    .bind(`${ref}:reservado`)
    .first();
  if (ya) return true;
  const ok = await descontarSiAlcanza(db, {
    cuentaId: p.repartidorId,
    bolsillo: 'prepago',
    pais: p.pais,
    moneda: p.moneda,
    monto: p.monto,
    concepto: 'reserva_comision',
    pedidoId: p.pedidoId,
    referencia: `${ref}:prepago`,
  });
  if (!ok) return false;
  await anotarLibro(db, {
    cuentaId: p.repartidorId,
    bolsillo: 'reservado',
    pais: p.pais,
    moneda: p.moneda,
    monto: p.monto,
    concepto: 'reserva_comision',
    pedidoId: p.pedidoId,
    referencia: `${ref}:reservado`,
  });
  return true;
}

/** Lo que un repartidor tiene reservado para un pedido (0 si nada o si ya se cobró o liberó). */
export async function reservaVigente(db: D1Database, pedidoId: string, repartidorId: string) {
  const f = await db
    .prepare(
      "SELECT COALESCE(SUM(monto), 0) AS monto, MAX(pais) AS pais, MAX(moneda) AS moneda FROM libro WHERE pedido_id = ? AND cuenta_id = ? AND bolsillo = 'reservado'",
    )
    .bind(pedidoId, repartidorId)
    .first<{ monto: number; pais: string | null; moneda: string | null }>();
  return { monto: Number(f?.monto ?? 0), pais: f?.pais ?? 'US', moneda: f?.moneda ?? 'USD' };
}

/** Devuelve la reserva al prepago (pedido cancelado, soltado o sin cobro). Idempotente. */
export async function liberarReserva(
  db: D1Database,
  pedidoId: string,
  repartidorId: string,
  motivo: string,
) {
  const r = await reservaVigente(db, pedidoId, repartidorId);
  if (r.monto <= 0) return 0;
  const ref = `liberacion:${pedidoId}:${repartidorId}`;
  await db.batch([
    sentenciaLibro(db, {
      cuentaId: repartidorId,
      bolsillo: 'reservado',
      pais: r.pais,
      moneda: r.moneda,
      monto: -r.monto,
      concepto: `liberacion:${motivo}`,
      pedidoId,
      referencia: `${ref}:reservado`,
    }),
    sentenciaLibro(db, {
      cuentaId: repartidorId,
      bolsillo: 'prepago',
      pais: r.pais,
      moneda: r.moneda,
      monto: r.monto,
      concepto: `liberacion:${motivo}`,
      pedidoId,
      referencia: `${ref}:prepago`,
    }),
  ]);
  return r.monto;
}

/** Libera las reservas de cualquier repartidor sobre un pedido (cancelación). */
export async function liberarReservasDe(db: D1Database, pedidoId: string, motivo: string) {
  const { results } = await db
    .prepare("SELECT DISTINCT cuenta_id FROM libro WHERE pedido_id = ? AND bolsillo = 'reservado'")
    .bind(pedidoId)
    .all<{ cuenta_id: string }>();
  for (const r of results) await liberarReserva(db, pedidoId, r.cuenta_id, motivo);
}

/** La reserva se convierte en comisión cobrada por Tumbite. Idempotente. */
export async function cobrarReserva(db: D1Database, pedidoId: string, repartidorId: string) {
  const r = await reservaVigente(db, pedidoId, repartidorId);
  if (r.monto <= 0) return 0;
  const ref = `comision:${pedidoId}:${repartidorId}`;
  await db.batch([
    sentenciaLibro(db, {
      cuentaId: repartidorId,
      bolsillo: 'reservado',
      pais: r.pais,
      moneda: r.moneda,
      monto: -r.monto,
      concepto: 'comision_cobrada',
      pedidoId,
      referencia: `${ref}:reservado`,
    }),
    sentenciaLibro(db, {
      cuentaId: CUENTA_TUMBITE,
      bolsillo: 'comisiones',
      pais: r.pais,
      moneda: r.moneda,
      monto: r.monto,
      concepto: 'comision_cobrada',
      pedidoId,
      referencia: `${ref}:tumbite`,
    }),
  ]);
  return r.monto;
}

/** Todas las filas del libro de un pedido, para reconstruir quién recibió qué. */
export async function libroDePedido(db: D1Database, pedidoId: string) {
  const { results } = await db
    .prepare(
      'SELECT cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia, autor_id, creado_en FROM libro WHERE pedido_id = ? ORDER BY creado_en, rowid',
    )
    .bind(pedidoId)
    .all<Record<string, unknown>>();
  return results.map((r) => ({
    cuentaId: String(r.cuenta_id),
    bolsillo: String(r.bolsillo) as Bolsillo,
    pais: String(r.pais),
    moneda: String(r.moneda),
    monto: Number(r.monto),
    concepto: String(r.concepto),
    referencia: r.referencia ? String(r.referencia) : null,
    autorId: r.autor_id ? String(r.autor_id) : null,
    creadoEn: String(r.creado_en),
  }));
}

/** Pieza «libro» de la salud: ningún prepago ni fondo de punto en negativo. */
export async function saludLibro(db: D1Database): Promise<'ok' | 'error'> {
  const f = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM (SELECT cuenta_id, bolsillo, pais, moneda, SUM(monto) AS s FROM libro WHERE bolsillo IN ('prepago','punto','reservado') GROUP BY 1,2,3,4) WHERE s < 0",
    )
    .first<{ n: number }>();
  return Number(f?.n ?? 0) > 0 ? 'error' : 'ok';
}

export function exigirPositivo(n: number, campo: string) {
  if (!Number.isSafeInteger(n) || n <= 0)
    throw new ErrorDatos('El monto no es válido.', campo, 400);
}
