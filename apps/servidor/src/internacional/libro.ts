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
  const r = await sentenciaDescontar(db, f).run();
  return Number(r.meta.changes) === 1;
}

/** La sentencia de `descontarSiAlcanza`, para meterla en un lote con otras. */
export function sentenciaDescontar(db: D1Database, f: FilaLibro & { monto: number }) {
  entero(f.monto);
  if (f.monto <= 0) throw new Error('libro: el descuento tiene que ser positivo');
  return db
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
    );
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
  // Las dos patas van en UN lote (C-RESERVA-ATOMICA): sale de prepago y entra en reservado, o nada.
  // La segunda solo entra si la primera existe; un reintento después de una caída vieja (prepago sin
  // reservado) termina la reserva en vez de tomarlo como «no alcanza».
  await db.batch([
    sentenciaDescontar(db, {
      cuentaId: p.repartidorId,
      bolsillo: 'prepago',
      pais: p.pais,
      moneda: p.moneda,
      monto: p.monto,
      concepto: 'reserva_comision',
      pedidoId: p.pedidoId,
      referencia: `${ref}:prepago`,
    }),
    db
      .prepare(
        `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, pedido_id, referencia)
         SELECT ?, ?, 'reservado', ?, ?, ?, 'reserva_comision', ?, ?
          WHERE EXISTS (SELECT 1 FROM libro WHERE referencia = ?)`,
      )
      .bind(
        crypto.randomUUID(),
        p.repartidorId,
        p.pais,
        p.moneda,
        p.monto,
        p.pedidoId,
        `${ref}:reservado`,
        `${ref}:prepago`,
      ),
  ]);
  return Boolean(
    await db.prepare('SELECT 1 FROM libro WHERE referencia = ?').bind(`${ref}:reservado`).first(),
  );
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

/**
 * C-CANCELACION-POLITICA: cierra la reserva de una operación cancelada. Divoox se queda `quedarse`
 * (nunca más de lo apartado) y el resto vuelve al prepago. Con 0 es una liberación normal.
 * Referencias únicas: dos llamadas no cobran dos veces.
 */
export async function cerrarReservaCancelada(
  db: D1Database,
  pedidoId: string,
  repartidorId: string,
  quedarse: number,
) {
  const r = await reservaVigente(db, pedidoId, repartidorId);
  const parte = Math.min(Math.max(0, Math.floor(quedarse)), r.monto);
  if (r.monto <= 0) return { cobrado: 0, liberado: 0 };
  if (parte === 0)
    return { cobrado: 0, liberado: await liberarReserva(db, pedidoId, repartidorId, 'cancelado') };
  const ref = `cancelacion:${pedidoId}:${repartidorId}`;
  const base = { pais: r.pais, moneda: r.moneda, pedidoId, concepto: 'comision_por_cancelacion' };
  const sentencias = [
    sentenciaLibro(db, {
      ...base,
      cuentaId: repartidorId,
      bolsillo: 'reservado',
      monto: -r.monto,
      referencia: `${ref}:reservado`,
    }),
    sentenciaLibro(db, {
      ...base,
      cuentaId: CUENTA_TUMBITE,
      bolsillo: 'comisiones',
      monto: parte,
      referencia: `${ref}:tumbite`,
    }),
  ];
  if (r.monto > parte)
    sentencias.push(
      sentenciaLibro(db, {
        ...base,
        cuentaId: repartidorId,
        bolsillo: 'prepago',
        monto: r.monto - parte,
        referencia: `${ref}:prepago`,
      }),
    );
  await db.batch(sentencias);
  return { cobrado: parte, liberado: r.monto - parte };
}

/** Libera las reservas de cualquier repartidor sobre un pedido (cancelación). */
export async function liberarReservasDe(db: D1Database, pedidoId: string, motivo: string) {
  const { results } = await db
    .prepare("SELECT DISTINCT cuenta_id FROM libro WHERE pedido_id = ? AND bolsillo = 'reservado'")
    .bind(pedidoId)
    .all<{ cuenta_id: string }>();
  for (const r of results) await liberarReserva(db, pedidoId, r.cuenta_id, motivo);
}

/** La reserva se convierte en comisión cobrada por Divoox. Idempotente. */
export async function cobrarReserva(db: D1Database, pedidoId: string, repartidorId: string) {
  const { monto, sentencias } = await sentenciasCobrarReserva(db, pedidoId, repartidorId);
  if (sentencias.length) await db.batch(sentencias);
  return monto;
}

/** Las sentencias de `cobrarReserva`, para meterlas en un lote con otras (referencias únicas). */
export async function sentenciasCobrarReserva(
  db: D1Database,
  pedidoId: string,
  repartidorId: string,
): Promise<{ monto: number; sentencias: D1PreparedStatement[] }> {
  const r = await reservaVigente(db, pedidoId, repartidorId);
  if (r.monto <= 0) return { monto: 0, sentencias: [] };
  const ref = `comision:${pedidoId}:${repartidorId}`;
  return {
    monto: r.monto,
    sentencias: [
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
    ],
  };
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

/** Sin conciliación vigente, cuánto se recuerda un «ok» de la suma del libro en el aislado. */
export const LIBRO_OK_RECORDADO_MS = 60_000;
const libroOkHasta = new WeakMap<D1Database, number>();

/** Una conciliación del reloj de hace menos de esto vale para la pieza «libro» del canario. */
export const LIBRO_CONCILIACION_VIGENTE_MS = 2 * 3_600_000;

/**
 * Pieza «libro» de la salud: ningún prepago ni fondo de punto en negativo.
 * C-LECTURAS-SALUD: el libro solo crece (no se edita ni se borra), así que sumarlo entero en cada
 * llamada al canario era leerlo todo cada pocos minutos. Con el reloj andando, la conciliación de
 * finanzas ya lo suma cada minuto y guarda el resultado (solo si cambió, o una vez por hora): se
 * usa ese resultado si tiene menos de 2 horas. Un saldo negativo nuevo se ve en el canario a la
 * vuelta siguiente del reloj (un minuto). Sin conciliación vigente (reloj en pausa), se suma aquí.
 */
export async function saludLibro(db: D1Database): Promise<'ok' | 'error'> {
  const conc = await db
    .prepare("SELECT valor FROM config WHERE clave = 'fin_conciliacion'")
    .first<{ valor: string }>()
    .then((f) => (f ? (JSON.parse(f.valor) as { cuando?: string; libroNegativos?: number }) : null))
    .catch(() => null);
  if (
    conc &&
    typeof conc.libroNegativos === 'number' &&
    Date.now() - Date.parse(String(conc.cuando)) < LIBRO_CONCILIACION_VIGENTE_MS
  )
    return conc.libroNegativos > 0 ? 'error' : 'ok';
  // Sin reloj: la suma se hace aquí. Un «ok» se recuerda 60 segundos en este aislado (varias
  // llamadas seguidas no vuelven a sumar); un «error» nunca se recuerda.
  const recordado = libroOkHasta.get(db);
  if (recordado && recordado > Date.now()) return 'ok';
  const f = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM (SELECT cuenta_id, bolsillo, pais, moneda, SUM(monto) AS s FROM libro WHERE bolsillo IN ('prepago','punto','reservado') GROUP BY 1,2,3,4) WHERE s < 0",
    )
    .first<{ n: number }>();
  if (Number(f?.n ?? 0) > 0) {
    libroOkHasta.delete(db);
    return 'error';
  }
  libroOkHasta.set(db, Date.now() + LIBRO_OK_RECORDADO_MS);
  return 'ok';
}

export function exigirPositivo(n: number, campo: string) {
  if (!Number.isSafeInteger(n) || n <= 0)
    throw new ErrorDatos('El monto no es válido.', campo, 400);
}
