import { MONEDA_SALDO_DIVOOX, formatearFechaHora, formatearMonto } from '@tumbite/compartido';
import type { Env } from './env';
import { nuevoId } from './cripto';
import { notificar } from './notificaciones';

/**
 * C-SALDO-LOTES (26 nov 2026, todos los países; Venezuela primero). El Saldo Divoox por LOTES.
 *
 * El libro (`saldo_cliente_movimientos`) sigue siendo la verdad del saldo. Cada crédito es además un
 * lote con su origen (regalo de bienvenida, carga masiva, fidelidad, regalo del equipo o prepago del
 * cliente) y, si es regalo, su fecha de vencimiento. El prepago NUNCA vence. Cada movimiento que saca
 * o devuelve saldo deja sus «consumos» (de qué lote salió o a cuál volvió), y un disparador mueve el
 * `restante` del lote: la suma de los lotes de un cliente es siempre la suma de su libro.
 *
 * - Orden de uso: primero el regalo que vence antes, después el regalo sin vencimiento y al final el
 *   prepago (lo que el cliente pagó es lo último que se gasta y lo primero que vuelve).
 * - Devolución: vuelve al MISMO lote del que salió (al revés del orden de uso). Si ese regalo venció
 *   mientras estaba apartado en un viaje que no se hizo, vuelve con una prórroga de PRORROGA_DIAS días:
 *   el cliente no pierde un regalo por un viaje que no se dio (lo más justo para él).
 * - Vencimiento: el reloj (cada hora, por el índice parcial de lo que vence) deja un movimiento
 *   «vencimiento» auditable por lo que quedaba; avisa 3 días antes y el día que vence.
 * - Las bases de antes (saldos sin lotes) se pasan a lotes sin perder un centavo: lo prepagado queda
 *   como prepago hasta donde alcance lo que hay (la misma regla del cierre de cuenta: lo gastado primero
 *   se tomó como regalo) y el resto como regalo SIN vencimiento (nunca se prometió que venciera).
 *
 * Solo esta pieza y `saldoCliente.ts` escriben en los lotes y sus consumos (prueba del candado).
 */

/** Días de prórroga de un regalo que venció mientras estaba apartado en un viaje que no se hizo. */
export const PRORROGA_DIAS = 7;
/** «Vence pronto» para la pantalla de pago: dentro de estos días. */
export const DIAS_VENCE_PRONTO = 7;

export type TipoLote = 'regalo' | 'prepago';
export type OrigenLote =
  'bienvenida' | 'masiva' | 'fidelidad' | 'regalo_manual' | 'prepago' | 'migracion' | 'devolucion';

export type LoteVigente = {
  id: string;
  tipo: TipoLote;
  origen: OrigenLote;
  restante: number;
  venceEn: string | null;
  creadoEn: string;
};

/** El orden de uso (también lo usa la base): regalo que vence antes → regalo sin vencer → prepago. */
export const ORDEN_USO_SQL =
  "CASE WHEN tipo = 'prepago' THEN 2 WHEN vence_en IS NULL THEN 1 ELSE 0 END, COALESCE(vence_en, ''), creado_en, id";

function prioridad(l: LoteVigente) {
  return l.tipo === 'prepago' ? 2 : l.venceEn == null ? 1 : 0;
}

/** Ordena los lotes como se usan (la misma regla que ORDEN_USO_SQL). */
export function ordenarParaUso<T extends LoteVigente>(lotes: readonly T[]): T[] {
  return [...lotes].sort(
    (a, b) =>
      prioridad(a) - prioridad(b) ||
      (a.venceEn ?? '').localeCompare(b.venceEn ?? '') ||
      a.creadoEn.localeCompare(b.creadoEn) ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Qué sale de cada lote para cubrir `monto`, en el orden de uso. Null si los lotes vigentes no
 * alcanzan (el regalo vencido no cuenta aunque el reloj todavía no lo haya barrido).
 */
export function planDeConsumo(
  lotes: readonly LoteVigente[],
  monto: number,
): { loteId: string; monto: number }[] | null {
  let falta = monto;
  const plan: { loteId: string; monto: number }[] = [];
  for (const l of ordenarParaUso(lotes)) {
    if (falta <= 0) break;
    const toma = Math.min(falta, l.restante);
    if (toma > 0) {
      plan.push({ loteId: l.id, monto: toma });
      falta -= toma;
    }
  }
  return falta > 0 ? null : plan;
}

/** Los lotes del cliente con algo disponible ahora (sin los regalos ya vencidos). */
export async function lotesVigentes(
  db: D1Database,
  clienteId: string,
  moneda: string = MONEDA_SALDO_DIVOOX,
): Promise<LoteVigente[]> {
  const { results } = await db
    .prepare(
      `SELECT id, tipo, origen, restante, vence_en, creado_en FROM saldo_cliente_lotes
        WHERE cliente_id = ? AND moneda = ? AND restante > 0
          AND (vence_en IS NULL OR vence_en > datetime('now'))
        ORDER BY ${ORDEN_USO_SQL}`,
    )
    .bind(clienteId, moneda)
    .all<{
      id: string;
      tipo: TipoLote;
      origen: OrigenLote;
      restante: number;
      vence_en: string | null;
      creado_en: string;
    }>();
  return results.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    origen: r.origen,
    restante: Number(r.restante),
    venceEn: r.vence_en,
    creadoEn: r.creado_en,
  }));
}

export type DetalleSaldo = {
  /** Lo que se puede usar ahora. */
  disponible: number;
  /** Cuánto de eso es regalo de Divoox y cuánto prepagó el cliente. */
  regalo: number;
  prepago: number;
  /** El regalo que vence primero (todo lo que vence ese mismo día) o null. */
  proximoVence: { monto: number; venceEn: string } | null;
  lotes: LoteVigente[];
};

/** De qué está hecho el saldo del cliente (para su pantalla y para el panel). */
export async function detalleSaldo(
  db: D1Database,
  clienteId: string,
  moneda: string = MONEDA_SALDO_DIVOOX,
): Promise<DetalleSaldo> {
  await asegurarLotes(db, clienteId);
  const lotes = await lotesVigentes(db, clienteId, moneda);
  let regalo = 0;
  let prepago = 0;
  for (const l of lotes) {
    if (l.tipo === 'prepago') prepago += l.restante;
    else regalo += l.restante;
  }
  const conFecha = lotes.filter((l) => l.tipo === 'regalo' && l.venceEn);
  const primero = conFecha[0]?.venceEn ?? null;
  const proximoVence = primero
    ? {
        venceEn: primero,
        // Lo que vence ese mismo día (mismos 10 primeros caracteres: AAAA-MM-DD en UTC).
        monto: conFecha
          .filter((l) => (l.venceEn ?? '').slice(0, 10) === primero.slice(0, 10))
          .reduce((s, l) => s + l.restante, 0),
      }
    : null;
  return { disponible: regalo + prepago, regalo, prepago, proximoVence, lotes };
}

// ───────────────────────── Pasar a lotes los saldos de antes ─────────────────────────

/**
 * Las sentencias que pasan a lotes los saldos de antes (todos, o solo los de un cliente). Solo tocan a
 * quien tiene libro y NINGÚN lote. Por cliente y moneda: el prepago que queda = lo menor entre lo
 * prepagado y el saldo de hoy; el regalo = el resto. Lo apartado en viajes abiertos no cuenta (ya salió
 * del libro): si vuelve, vuelve como un lote propio (ver `sentenciasDevolver`). Un lote marca de 0
 * («migracion:<cliente>:<moneda>») deja dicho que ese cliente ya pasó, aunque tuviera saldo 0.
 */
export function sentenciasMigrarLotes(db: D1Database, clienteId: string | null) {
  const filtro = clienteId ? 'WHERE m.cliente_id = ?1' : '';
  const binds = clienteId ? [clienteId] : [];
  const base = `SELECT m.cliente_id, m.moneda, SUM(m.monto) AS saldo,
                       MIN(SUM(m.monto), SUM(CASE WHEN m.concepto = 'recarga' THEN m.monto ELSE 0 END)) AS prepago
                  FROM saldo_cliente_movimientos m ${filtro}
                 GROUP BY m.cliente_id, m.moneda
                HAVING NOT EXISTS (SELECT 1 FROM saldo_cliente_lotes l WHERE l.cliente_id = m.cliente_id
                                     AND (l.origen <> 'migracion' OR l.id = 'migracion:' || m.cliente_id || ':' || m.moneda))`;
  const ins = (tipo: TipoLote, valor: string, cond: string) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO saldo_cliente_lotes (id, cliente_id, moneda, tipo, origen, monto_inicial, restante, movimiento_ref)
         SELECT 'migracion-${tipo}:' || cliente_id || ':' || moneda, cliente_id, moneda, '${tipo}', 'migracion',
                ${valor}, ${valor}, 'migracion-${tipo}:' || cliente_id || ':' || moneda
           FROM (${base}) WHERE ${cond}`,
      )
      .bind(...binds);
  return [
    ins('prepago', 'MAX(prepago, 0)', 'prepago > 0'),
    ins('regalo', 'saldo - MAX(prepago, 0)', 'saldo - MAX(prepago, 0) > 0'),
    // La marca va al final: las dos de arriba miran que el cliente no tenga todavía ni la marca ni un
    // lote de después de esta regla (con deterministas e INSERT OR IGNORE, repetirlo no duplica).
    db
      .prepare(
        `INSERT OR IGNORE INTO saldo_cliente_lotes (id, cliente_id, moneda, tipo, origen, monto_inicial, restante, movimiento_ref)
         SELECT 'migracion:' || m.cliente_id || ':' || m.moneda, m.cliente_id, m.moneda, 'regalo', 'migracion', 0, 0,
                'migracion:' || m.cliente_id || ':' || m.moneda
           FROM saldo_cliente_movimientos m ${filtro}
          GROUP BY m.cliente_id, m.moneda
         HAVING NOT EXISTS (SELECT 1 FROM saldo_cliente_lotes l WHERE l.cliente_id = m.cliente_id AND l.origen <> 'migracion')`,
      )
      .bind(...binds),
  ];
}

/** Una vez por versión (esquema.ts): todos los saldos de antes a lotes, en un lote. */
export async function migrarSaldosALotes(db: D1Database): Promise<number> {
  const r = await db.batch(sentenciasMigrarLotes(db, null));
  const n = r.reduce((s, x) => s + Number(x.meta?.changes ?? 0), 0);
  if (n) console.warn(`saldo: ${n} lotes creados a partir de saldos de antes (C-SALDO-LOTES)`);
  return n;
}

/**
 * La red de seguridad: si este cliente tiene libro y ningún lote (un saldo de antes que la migración no
 * alcanzó), se pasa ahora. Toda pieza que crea un lote nuevo la llama ANTES: si no, el lote nuevo
 * escondería el saldo viejo.
 */
export async function asegurarLotes(db: D1Database, clienteId: string) {
  const f = await db
    .prepare(
      `SELECT EXISTS (SELECT 1 FROM saldo_cliente_lotes WHERE cliente_id = ?1) AS lotes,
              EXISTS (SELECT 1 FROM saldo_cliente_movimientos WHERE cliente_id = ?1) AS libro`,
    )
    .bind(clienteId)
    .first<{ lotes: number; libro: number }>();
  if (Number(f?.lotes) || !Number(f?.libro)) return;
  await db.batch(sentenciasMigrarLotes(db, clienteId));
}

// ───────────────────────── Sacar y devolver ─────────────────────────

/**
 * Los consumos de un uso (lo que sale de cada lote), atados a su movimiento del libro. El disparador
 * frena el lote de sentencias entero si un lote no alcanza o ya venció.
 */
export function sentenciasConsumir(
  db: D1Database,
  p: {
    clienteId: string;
    referencia: string;
    /** El id del movimiento que se intenta poner en ESTE lote de sentencias (nuevo en cada intento). */
    movimientoId: string;
    operacionId: string | null;
    plan: { loteId: string; monto: number }[];
  },
) {
  // Atados al movimiento por su id: si el movimiento ya estaba (un reintento), su id es otro y no
  // entra ningún consumo; si no entró (no alcanzaba), tampoco.
  return p.plan.map((x) =>
    db
      .prepare(
        `INSERT INTO saldo_cliente_consumos (id, lote_id, cliente_id, referencia, operacion_id, tipo, monto)
         SELECT ?1, ?2, ?3, ?4, ?5, 'uso', ?6
          WHERE EXISTS (SELECT 1 FROM saldo_cliente_movimientos WHERE referencia = ?4 AND id = ?7)`,
      )
      .bind(nuevoId(), x.loteId, p.clienteId, p.referencia, p.operacionId, x.monto, p.movimientoId),
  );
}

/** «Todo lo que salió para esta operación» (devolución completa). */
export const DEVOLVER_TODO = Number.MAX_SAFE_INTEGER;

/**
 * Lo que vuelve al saldo por una operación (`referencia` = la del movimiento positivo que ya está en el
 * MISMO lote de sentencias, antes que estas). Vuelve a los mismos lotes de los que salió, al revés del
 * orden de uso (primero el prepago, al final el regalo que vence antes), hasta `monto`. Si el regalo
 * venció mientras estaba apartado, vuelve con su prórroga. Si la operación es de antes de los lotes (no
 * tiene consumos), lo devuelto se vuelve un lote propio de regalo sin vencimiento.
 */
export function sentenciasDevolver(
  db: D1Database,
  p: { operacionId: string; referencia: string; monto: number },
) {
  return [
    db
      .prepare(
        `INSERT INTO saldo_cliente_consumos (id, lote_id, cliente_id, referencia, operacion_id, tipo, monto)
         SELECT lower(hex(randomblob(16))), lote_id, cliente_id, ?2, ?1, 'devolucion', -MIN(neto, ?3 - (acum - neto))
           FROM (SELECT n.*, SUM(n.neto) OVER (ORDER BY n.prio DESC, n.vence DESC, n.creado DESC, n.lote_id DESC) AS acum
                   FROM (SELECT c.lote_id, c.cliente_id, SUM(c.monto) AS neto,
                                CASE WHEN l.tipo = 'prepago' THEN 2 WHEN l.vence_en IS NULL THEN 1 ELSE 0 END AS prio,
                                COALESCE(l.vence_en, '') AS vence, l.creado_en AS creado
                           FROM saldo_cliente_consumos c JOIN saldo_cliente_lotes l ON l.id = c.lote_id
                          WHERE c.operacion_id = ?1
                          GROUP BY c.lote_id, c.cliente_id HAVING SUM(c.monto) > 0) n)
          WHERE acum - neto < ?3
            AND EXISTS (SELECT 1 FROM saldo_cliente_movimientos WHERE referencia = ?2)
            AND NOT EXISTS (SELECT 1 FROM saldo_cliente_consumos x WHERE x.referencia = ?2)`,
      )
      .bind(p.operacionId, p.referencia, p.monto),
    // El regalo que venció mientras estaba apartado vuelve con su prórroga (y sus avisos de nuevo).
    db
      .prepare(
        `UPDATE saldo_cliente_lotes SET vence_en = datetime('now', '+${PRORROGA_DIAS} days'), prorrogado_en = datetime('now'),
                aviso_3d_en = NULL, aviso_hoy_en = NULL
          WHERE id IN (SELECT lote_id FROM saldo_cliente_consumos WHERE referencia = ?1)
            AND vence_en IS NOT NULL AND vence_en <= datetime('now')`,
      )
      .bind(p.referencia),
    // Una operación de antes de los lotes: lo que vuelve es un lote propio (regalo sin vencimiento).
    db
      .prepare(
        `INSERT OR IGNORE INTO saldo_cliente_lotes (id, cliente_id, moneda, tipo, origen, monto_inicial, restante, movimiento_ref)
         SELECT ?1, m.cliente_id, m.moneda, 'regalo', 'devolucion', m.monto, m.monto, m.referencia
           FROM saldo_cliente_movimientos m
          WHERE m.referencia = ?2 AND m.monto > 0
            AND NOT EXISTS (SELECT 1 FROM saldo_cliente_consumos c WHERE c.operacion_id = ?3)`,
      )
      .bind(nuevoId(), p.referencia, p.operacionId),
  ];
}

/**
 * El cierre de la cuenta: cada lote con algo queda en cero (consumo «cierre»), atado al movimiento
 * `cierre_cuenta` ya puesto en el mismo lote de sentencias. Si los lotes no cuadran con el libro, la
 * guarda (un movimiento de 0, que la tabla no acepta) frena el lote entero.
 */
export function sentenciasCierreLotes(db: D1Database, clienteId: string, referencia: string) {
  return [
    db
      .prepare(
        `INSERT INTO saldo_cliente_movimientos (id, cliente_id, monto, concepto, referencia, motivo)
         SELECT ?1, ?2, 0, 'ajuste', ?1, 'Los lotes no cuadran con el libro'
          WHERE (SELECT COALESCE(SUM(restante), 0) FROM saldo_cliente_lotes WHERE cliente_id = ?2)
             <> (SELECT COALESCE(SUM(monto), 0) FROM saldo_cliente_movimientos WHERE cliente_id = ?2)`,
      )
      .bind(`guarda-lotes:${crypto.randomUUID()}`, clienteId),
    db
      .prepare(
        `INSERT INTO saldo_cliente_consumos (id, lote_id, cliente_id, referencia, tipo, monto)
         SELECT lower(hex(randomblob(16))), l.id, l.cliente_id, ?2, 'cierre', l.restante
           FROM saldo_cliente_lotes l
          WHERE l.cliente_id = ?1 AND l.restante > 0
            AND EXISTS (SELECT 1 FROM saldo_cliente_movimientos WHERE referencia = ?2)
            AND NOT EXISTS (SELECT 1 FROM saldo_cliente_consumos x WHERE x.referencia = ?2)`,
      )
      .bind(clienteId, referencia),
  ];
}

/** Lo que el cliente prepagó y todavía no usó (lo que hay que devolverle si borra la cuenta). */
export async function prepagoRestante(db: D1Database, clienteId: string): Promise<number> {
  const f = await db
    .prepare(
      "SELECT COALESCE(SUM(restante), 0) AS s FROM saldo_cliente_lotes WHERE cliente_id = ? AND tipo = 'prepago'",
    )
    .bind(clienteId)
    .first<{ s: number }>();
  return Number(f?.s ?? 0);
}

/**
 * Lo que un uso cobrado sacó de regalos y de prepago (para el libro de Divoox: nunca se mezclan).
 * Lo que no tiene consumos (un uso de antes de los lotes) se toma como regalo, como se hacía.
 */
export const SQL_PARTE_DE_USO = (tipo: TipoLote) =>
  `(SELECT COALESCE(SUM(c.monto), 0) FROM saldo_cliente_consumos c JOIN saldo_cliente_lotes l ON l.id = c.lote_id
     WHERE c.operacion_id = u.operacion_id AND l.tipo = '${tipo}')`;

// ───────────────────────── Vencer y avisar ─────────────────────────

/** Lotes por vuelta del reloj (cada hora): lo que no alcance queda para la siguiente. */
export const LOTES_POR_VUELTA = 100;

/**
 * Vence lo que quedaba de los regalos cuya fecha pasó: un movimiento «vencimiento» por lote (auditable
 * en el libro) y su consumo. Lee solo el índice parcial de lo que tiene algo por vencer. Con
 * `clienteId`, solo los suyos (antes de cerrar una cuenta). Idempotente: la referencia lleva la fecha.
 */
export async function vencerLotes(db: D1Database, p: { clienteId?: string } = {}) {
  const { results } = await db
    .prepare(
      `SELECT id, vence_en FROM saldo_cliente_lotes INDEXED BY saldo_cliente_lotes_vencer
        WHERE vence_en IS NOT NULL AND restante > 0 AND vence_en <= datetime('now')
          ${p.clienteId ? 'AND cliente_id = ?1' : ''}
        ORDER BY vence_en LIMIT ${LOTES_POR_VUELTA}`,
    )
    .bind(...(p.clienteId ? [p.clienteId] : []))
    .all<{ id: string; vence_en: string }>();
  let n = 0;
  for (const l of results) {
    const ref = `vencimiento:${l.id}:${l.vence_en}`;
    try {
      const [mov] = await db.batch([
        db
          .prepare(
            `INSERT OR IGNORE INTO saldo_cliente_movimientos (id, cliente_id, monto, moneda, concepto, referencia, motivo)
             SELECT ?1, l.cliente_id, -l.restante, l.moneda, 'vencimiento', ?2, 'Venció el regalo'
               FROM saldo_cliente_lotes l
              WHERE l.id = ?3 AND l.restante > 0 AND l.vence_en = ?4 AND l.vence_en <= datetime('now')`,
          )
          .bind(nuevoId(), ref, l.id, l.vence_en),
        db
          .prepare(
            `INSERT INTO saldo_cliente_consumos (id, lote_id, cliente_id, referencia, tipo, monto)
             SELECT ?1, ?2, m.cliente_id, ?3, 'vencimiento', -m.monto FROM saldo_cliente_movimientos m
              WHERE m.referencia = ?3 AND NOT EXISTS (SELECT 1 FROM saldo_cliente_consumos c WHERE c.referencia = ?3)`,
          )
          .bind(nuevoId(), l.id, ref),
      ]);
      if (mov?.meta.changes) n++;
    } catch (e) {
      // Un lote que no se pudo vencer no frena a los demás; el canario lo ve si se queda.
      console.error('saldo: no se pudo vencer un lote', l.id, String(e));
    }
  }
  return n;
}

/** La fecha de vencimiento en palabras, en la hora de la ciudad («28 nov» / «Nov 28»). */
export function fechaVence(venceEn: string, idioma: 'es' | 'en', zona: string) {
  return formatearFechaHora(venceEn, {
    idioma,
    formato: idioma === 'en' ? '12' : '24',
    zona,
    estilo: 'fecha',
  });
}

/** Zona horaria por defecto cuando el lote no dice su ciudad (el saldo nació en Venezuela). */
const ZONA_POR_DEFECTO = 'America/Caracas';

/**
 * Avisos del vencimiento (cada hora): «vence en 3 días» y «vence hoy», una vez cada uno por lote y UN
 * aviso por cliente aunque tenga varios lotes. Lee solo los índices parciales de lo que falta avisar.
 */
export async function avisarVencimientos(env: Env | undefined, db: D1Database) {
  let avisos = 0;
  for (const cual of ['hoy', '3d'] as const) {
    const columna = cual === 'hoy' ? 'aviso_hoy_en' : 'aviso_3d_en';
    const indice = cual === 'hoy' ? 'saldo_cliente_lotes_avisohoy' : 'saldo_cliente_lotes_aviso3';
    const desde = cual === 'hoy' ? "datetime('now')" : "datetime('now', '+1 day')";
    const hasta = cual === 'hoy' ? "datetime('now', '+1 day')" : "datetime('now', '+3 days')";
    const { results } = await db
      .prepare(
        `SELECT l.id, l.cliente_id, l.restante, l.vence_en, COALESCE(z.zona_horaria, '${ZONA_POR_DEFECTO}') AS zona
           FROM saldo_cliente_lotes l INDEXED BY ${indice} LEFT JOIN zonas z ON z.id = l.zona_id
          WHERE l.vence_en IS NOT NULL AND l.restante > 0 AND l.${columna} IS NULL
            AND l.vence_en > ${desde} AND l.vence_en <= ${hasta}
          ORDER BY l.vence_en LIMIT 200`,
      )
      .all<{ id: string; cliente_id: string; restante: number; vence_en: string; zona: string }>();
    if (!results.length) continue;
    const porCliente = new Map<string, { monto: number; venceEn: string; zona: string }>();
    for (const r of results) {
      const ya = porCliente.get(r.cliente_id);
      porCliente.set(r.cliente_id, {
        monto: (ya?.monto ?? 0) + Number(r.restante),
        venceEn: ya?.venceEn ?? r.vence_en,
        zona: ya?.zona ?? r.zona,
      });
    }
    // Primero se marcan (una escritura por lote), después se avisa: un aviso que falle no se repite
    // cada hora para siempre, y uno que salga no sale dos veces.
    const ids = results.map((r) => r.id);
    await db.batch(
      ids.map((id) =>
        db
          .prepare(
            cual === 'hoy'
              ? "UPDATE saldo_cliente_lotes SET aviso_hoy_en = datetime('now'), aviso_3d_en = COALESCE(aviso_3d_en, datetime('now')) WHERE id = ?"
              : "UPDATE saldo_cliente_lotes SET aviso_3d_en = datetime('now') WHERE id = ?",
          )
          .bind(id),
      ),
    );
    if (!env) continue;
    for (const [clienteId, a] of porCliente) {
      try {
        await notificar(env, db, { id: clienteId, app: 'cliente' }, (i) => {
          const m = formatearMonto(a.monto, MONEDA_SALDO_DIVOOX, i);
          const f = fechaVence(a.venceEn, i, a.zona);
          return {
            titulo:
              cual === 'hoy'
                ? i === 'en'
                  ? 'Your Divoox Balance gift expires today'
                  : 'Tu regalo de Saldo Divoox vence hoy'
                : i === 'en'
                  ? 'Your Divoox Balance gift expires soon'
                  : 'Tu regalo de Saldo Divoox vence pronto',
            cuerpo:
              cual === 'hoy'
                ? i === 'en'
                  ? `${m} of your gift expires today. Use it on your next ride.`
                  : `Hoy vencen ${m} de tu regalo. Úsalos en tu próximo viaje.`
                : i === 'en'
                  ? `${m} of your gift expires on ${f}. Use it on your next ride.`
                  : `${m} de tu regalo vencen el ${f}. Úsalos en tu próximo viaje.`,
            datos: { tipo: 'saldo_divoox' },
            canal: 'dinero',
          };
        });
        avisos++;
      } catch (e) {
        console.error('saldo: no salió el aviso del vencimiento', String(e));
      }
    }
  }
  return avisos;
}
