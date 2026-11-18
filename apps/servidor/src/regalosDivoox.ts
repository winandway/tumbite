import { sha256, nuevoId } from './cripto';
import { type RegaloDivoox, normalizarCodigoRegalo, telefonoCanonico } from '@tumbite/compartido';
import { ErrorDatos } from './validar';
import { CUENTA_TUMBITE } from './internacional/libro';

/**
 * C-CUPON-DIVOOX (17 nov 2026, piloto de El Vigía y Tucaní) — Venezuela primero, sirve en todos los
 * países. Regalos que PAGA DIVOOX, como el código de bienvenida, «tu primer viaje gratis» y los
 * códigos de promoción de Uber, DiDi, inDrive y Rappi:
 *
 * - El código se agrega a la cuenta una vez («Agregar código») y se aplica SOLO en el próximo viaje,
 *   envío o pedido que cumpla (servicio, ciudad, moneda, vigencia). El regalo de bienvenida no pide
 *   código: se aplica solo en la primera operación de la persona.
 * - El cliente paga en mano (efectivo o pago móvil) solo la diferencia. El conductor ve «Cobra X ·
 *   Divoox te paga Y» y, al terminar, Y entra a su saldo prepago (le sirve para las comisiones); si
 *   lo prefiere, el equipo se lo paga por pago móvil desde el reporte.
 * - PRESUPUESTO TOTAL por cupón: lo apartado más lo cobrado nunca lo pasa. Se comprueba en la MISMA
 *   sentencia que aparta el uso (dos pedidos a la vez no pueden gastar el último dólar dos veces). Al
 *   agotarse se apaga solo, y si un uso apartado se libera, vuelve a encenderse.
 * - Antifraude: un uso por cupón y por cuenta, por teléfono y por aparato (índices únicos de la base);
 *   el conductor no toma un viaje con regalo pedido desde su propia cuenta, teléfono o aparato; tope
 *   diario de viajes con regalo por conductor; alertas de patrones raros en el reporte.
 *
 * Los topes de abajo están en el código a propósito: el panel no los puede pasar.
 */
export const TOPES_REGALO = {
  /** Lo más que cubre un solo uso (20 USD). */
  valorMaximo: 2_000,
  /** El presupuesto más alto de un cupón (500 USD). */
  presupuestoMaximo: 50_000,
  /** La suma de los presupuestos de todos los cupones vigentes no pasa de esto (1 000 USD). */
  presupuestoGlobalMaximo: 100_000,
  /** Viajes con regalo que un conductor puede tomar en 24 horas, como máximo absoluto. */
  topeDiarioConductorMaximo: 20,
} as const;

/** Servicios donde el regalo se puede usar (los que se cobran en mano). */
export const SERVICIOS_REGALO = ['moto', 'carro', 'envios', 'comida'] as const;
export type ServicioRegalo = (typeof SERVICIOS_REGALO)[number];
/** Formas de pago en mano: el regalo baja lo que se cobra en la puerta. */
const METODOS_EN_MANO = new Set(['efectivo', 'pago_movil', 'transferencia_repartidor']);
export const conRegalo = (metodo: string | null | undefined) => METODOS_EN_MANO.has(metodo ?? '');

export type RegaloAplicado = RegaloDivoox;
export { normalizarCodigoRegalo };

type FilaCuponDivoox = {
  codigo: string;
  nombre_es: string;
  nombre_en: string;
  tipo: 'monto' | 'gratis';
  valor: number;
  moneda: string;
  servicios: string;
  zonas: string;
  vence_en: string | null;
  presupuesto: number;
  bienvenida: number;
  tope_diario_conductor: number;
  activo: number;
  apagado_motivo: string | null;
  agotado_en: string | null;
  creado_en: string;
  gastado?: number;
  apartado?: number;
  usos?: number;
};

/** Huella del aparato que manda la app (cabecera «x-aparato»). Sin ella, no hay regalo. */
export async function huellaAparato(valor: string | null | undefined): Promise<string | null> {
  const v = (valor ?? '').trim();
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(v)) return null;
  return `a:${await sha256(`aparato:${v}`)}`;
}

async function huellaTelefono(tel: string | null | undefined): Promise<string | null> {
  const t = telefonoCanonico(tel ?? '');
  return t ? `t:${await sha256(`telefono:${t}`)}` : null;
}

/** Lo que el cupón cubre sobre una base dada, sin pasar lo que le queda del presupuesto. */
export function montoDelRegalo(
  c: { tipo: 'monto' | 'gratis'; valor: number; presupuesto: number },
  gastado: number,
  base: number,
): number {
  const restante = Math.max(0, c.presupuesto - gastado);
  const cubre = Math.min(c.valor, TOPES_REGALO.valorMaximo, Math.max(0, base));
  return Math.max(0, Math.min(cubre, restante));
}

/** ¿Esta persona ya terminó algún viaje, envío o pedido? (el regalo de bienvenida es para la primera). */
async function yaUsoDivoox(db: D1Database, clienteId: string) {
  const f = await db
    .prepare(
      `SELECT EXISTS (SELECT 1 FROM operaciones WHERE cliente_id = ?1 AND estado_general = 'terminada')
           OR EXISTS (SELECT 1 FROM pedidos WHERE cliente_id = ?1 AND estado = 'entregado') AS si`,
    )
    .bind(clienteId)
    .first<{ si: number }>();
  return Number(f?.si ?? 0) === 1;
}

const SQL_GASTADO =
  "(SELECT COALESCE(SUM(u.monto), 0) FROM usos_cupon_divoox u WHERE u.codigo = c.codigo AND u.estado <> 'liberado')";

type Contexto = {
  clienteId: string;
  servicio: string;
  zonaId: string;
  moneda: string;
  /** Lo que se cobraría en mano sin el regalo (sin la propina). */
  base: number;
  aparato: string | null;
};

/**
 * Los cupones que valen para esta persona y esta operación, con lo que cubriría cada uno. Lo usan la
 * cotización (para mostrarlo), el pedido (para apartarlo) y la app («Mis regalos»).
 */
async function candidatos(db: D1Database, p: Contexto, soloCodigo?: string) {
  const u = await db
    .prepare('SELECT telefono, telefono_canonico FROM usuarios WHERE id = ?')
    .bind(p.clienteId)
    .first<{ telefono: string | null; telefono_canonico: string | null }>();
  const tel = await huellaTelefono(u?.telefono_canonico ?? u?.telefono);
  const { results } = await db
    .prepare(
      `SELECT c.*, ${SQL_GASTADO} AS gastado FROM cupones_divoox c
        WHERE c.activo = 1 AND (c.vence_en IS NULL OR c.vence_en > datetime('now')) AND c.moneda = ?1
          AND EXISTS (SELECT 1 FROM json_each(c.servicios) WHERE value = ?2)
          AND EXISTS (SELECT 1 FROM json_each(c.zonas) WHERE value = ?3)
          AND (c.bienvenida = 1 OR ?7 <> '' OR EXISTS (SELECT 1 FROM cupones_divoox_guardados g WHERE g.codigo = c.codigo AND g.cliente_id = ?4))
          AND NOT EXISTS (SELECT 1 FROM usos_cupon_divoox x WHERE x.codigo = c.codigo AND x.estado <> 'liberado'
                           AND (x.cliente_id = ?4 OR x.telefono = ?5 OR x.aparato = ?6))
          AND (?7 = '' OR c.codigo = ?7)`,
    )
    .bind(
      p.moneda,
      p.servicio,
      p.zonaId,
      p.clienteId,
      tel ?? '-',
      p.aparato ?? '-',
      soloCodigo ?? '',
    )
    .all<FilaCuponDivoox>();
  const primera = results.some((c) => c.bienvenida) ? !(await yaUsoDivoox(db, p.clienteId)) : false;
  return {
    tel,
    lista: results
      .filter((c) => !c.bienvenida || primera)
      .map((c) => ({ c, monto: montoDelRegalo(c, Number(c.gastado ?? 0), p.base) }))
      .filter((x) => x.monto > 0)
      .sort((a, b) => b.monto - a.monto),
  };
}

const aRegalo = (c: FilaCuponDivoox, monto: number): RegaloAplicado => ({
  codigo: c.codigo,
  nombreEs: c.nombre_es,
  nombreEn: c.nombre_en,
  tipo: c.tipo,
  monto,
  moneda: c.moneda,
  bienvenida: Number(c.bienvenida) === 1,
});

/**
 * El mejor regalo que se aplicaría ahora (o null). Sin aparato identificado (app vieja) o sin
 * teléfono en la cuenta no hay regalo: son las dos llaves del antifraude.
 */
export async function regaloParaCliente(
  db: D1Database,
  p: Contexto,
): Promise<RegaloAplicado | null> {
  if (!p.aparato) return null;
  const { tel, lista } = await candidatos(db, p);
  if (!tel) return null;
  const mejor = lista[0];
  return mejor ? aRegalo(mejor.c, mejor.monto) : null;
}

/**
 * Aparta el regalo para esta operación (viaje, envío o pedido). La sentencia comprueba, en el mismo
 * paso, que el cupón siga encendido y vigente y que lo apartado más lo cobrado más este uso no pase
 * el presupuesto; los índices únicos impiden un segundo uso de la misma cuenta, teléfono o aparato.
 * Si el presupuesto queda en cero, el cupón se apaga solo. Devuelve el regalo apartado o null.
 */
export async function apartarRegalo(
  db: D1Database,
  p: Contexto & {
    operacionId: string;
    pais: string;
    codigo?: string;
    /** El descuento ya está en el total: o se aparta exactamente `base`, o nada. */
    exacto?: boolean;
  },
): Promise<RegaloAplicado | null> {
  if (!p.aparato) return null;
  const { tel, lista } = await candidatos(db, p, p.codigo);
  if (!tel) return null;
  for (const { c, monto } of lista) {
    if (p.exacto && monto !== p.base) continue;
    const id = nuevoId();
    const [ins] = await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO usos_cupon_divoox (id, codigo, cliente_id, telefono, aparato, servicio, zona_id, pais, operacion_id, monto, moneda)
           SELECT ?1, c.codigo, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, c.moneda FROM cupones_divoox c
            WHERE c.codigo = ?10 AND c.activo = 1 AND (c.vence_en IS NULL OR c.vence_en > datetime('now'))
              AND ?9 > 0 AND ?9 <= ${TOPES_REGALO.valorMaximo}
              AND ${SQL_GASTADO} + ?9 <= c.presupuesto`,
        )
        .bind(
          id,
          p.clienteId,
          tel,
          p.aparato,
          p.servicio,
          p.zonaId,
          p.pais,
          p.operacionId,
          monto,
          c.codigo,
        ),
      // Presupuesto agotado: el cupón se apaga solo (vuelve a encenderse si se libera un uso).
      db
        .prepare(
          `UPDATE cupones_divoox SET activo = 0, apagado_motivo = 'agotado', agotado_en = datetime('now'), actualizado_en = datetime('now')
            WHERE codigo = ? AND activo = 1 AND ${SQL_GASTADO.replaceAll('c.codigo', 'cupones_divoox.codigo')} >= presupuesto`,
        )
        .bind(c.codigo),
    ]);
    if (ins?.meta.changes) return aRegalo(c, monto);
  }
  return null;
}

/** El regalo apartado o cobrado de una operación (lo que paga Divoox), o 0. */
export async function regaloDeOperacion(db: D1Database, operacionId: string) {
  const f = await db
    .prepare(
      "SELECT codigo, monto, estado FROM usos_cupon_divoox WHERE operacion_id = ? AND estado <> 'liberado'",
    )
    .bind(operacionId)
    .first<{ codigo: string; monto: number; estado: string }>();
  return f ? { codigo: f.codigo, monto: Number(f.monto), estado: f.estado } : null;
}

/** Vuelve a encender los cupones apagados por agotarse que recuperaron presupuesto. */
async function reencenderRecuperados(db: D1Database) {
  await db
    .prepare(
      `UPDATE cupones_divoox SET activo = 1, apagado_motivo = NULL, agotado_en = NULL, actualizado_en = datetime('now')
        WHERE activo = 0 AND apagado_motivo = 'agotado'
          AND ${SQL_GASTADO.replaceAll('c.codigo', 'cupones_divoox.codigo')} < presupuesto`,
    )
    .run();
}

/** La operación no se hizo (cancelada, sin conductor, el cliente no pagó): el uso vuelve al presupuesto. */
export async function liberarRegalo(db: D1Database, operacionId: string, motivo: string) {
  const r = await db
    .prepare(
      "UPDATE usos_cupon_divoox SET estado = 'liberado', cerrado_en = datetime('now'), motivo = ? WHERE operacion_id = ? AND estado = 'apartado'",
    )
    .bind(motivo.slice(0, 80), operacionId)
    .run();
  if (r.meta.changes) await reencenderRecuperados(db);
  return Number(r.meta.changes ?? 0) > 0;
}

async function alerta(
  db: D1Database,
  a: {
    tipo: string;
    codigo?: string | null;
    operacionId?: string | null;
    clienteId?: string | null;
    conductorId?: string | null;
    detalle: string;
  },
) {
  await db
    .prepare(
      'INSERT INTO alertas_regalo (id, tipo, codigo, operacion_id, cliente_id, conductor_id, detalle) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      nuevoId(),
      a.tipo,
      a.codigo ?? null,
      a.operacionId ?? null,
      a.clienteId ?? null,
      a.conductorId ?? null,
      a.detalle.slice(0, 300),
    )
    .run();
}

/**
 * Antes de que un conductor acepte una operación con regalo: no puede ser su propia cuenta, su
 * teléfono ni su aparato, y no puede pasar el tope diario de viajes con regalo. Si pasa, el uso queda
 * a su nombre. Lanza 409 con el motivo (y deja la alerta para el reporte).
 */
export async function tomarRegaloConductor(
  db: D1Database,
  operacionId: string,
  conductorId: string,
  aparatoConductor: string | null,
) {
  const u = await db
    .prepare(
      `SELECT u.codigo, u.cliente_id, u.telefono, u.aparato, u.conductor_id, c.tope_diario_conductor
         FROM usos_cupon_divoox u JOIN cupones_divoox c ON c.codigo = u.codigo
        WHERE u.operacion_id = ? AND u.estado = 'apartado'`,
    )
    .bind(operacionId)
    .first<{
      codigo: string;
      cliente_id: string;
      telefono: string;
      aparato: string;
      conductor_id: string | null;
      tope_diario_conductor: number;
    }>();
  if (!u || u.conductor_id === conductorId) return;
  const yo = await db
    .prepare('SELECT telefono, telefono_canonico FROM usuarios WHERE id = ?')
    .bind(conductorId)
    .first<{ telefono: string | null; telefono_canonico: string | null }>();
  const miTel = await huellaTelefono(yo?.telefono_canonico ?? yo?.telefono);
  const propio =
    u.cliente_id === conductorId ||
    (miTel != null && miTel === u.telefono) ||
    (aparatoConductor != null && aparatoConductor === u.aparato);
  if (propio) {
    await alerta(db, {
      tipo: 'propio',
      codigo: u.codigo,
      operacionId,
      clienteId: u.cliente_id,
      conductorId,
      detalle:
        'El conductor intentó tomar un viaje con regalo pedido desde su propia cuenta, teléfono o aparato.',
    });
    throw new ErrorDatos(
      'No puedes tomar un viaje con regalo de Divoox pedido desde tu propia cuenta o tu propio teléfono.',
      undefined,
      409,
    );
  }
  const tope = Math.min(Number(u.tope_diario_conductor), TOPES_REGALO.topeDiarioConductorMaximo);
  const hoy = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM usos_cupon_divoox WHERE conductor_id = ? AND estado <> 'liberado' AND tomado_en > datetime('now', '-1 day')",
    )
    .bind(conductorId)
    .first<{ n: number }>();
  if (Number(hoy?.n ?? 0) >= tope) {
    await alerta(db, {
      tipo: 'tope_diario',
      codigo: u.codigo,
      operacionId,
      clienteId: u.cliente_id,
      conductorId,
      detalle: `El conductor llegó al tope de ${tope} viajes con regalo en 24 horas.`,
    });
    throw new ErrorDatos(
      'Ya tomaste todos los viajes con regalo de Divoox permitidos por hoy. Este viaje pasará a otro conductor.',
      undefined,
      409,
    );
  }
  await db
    .prepare(
      "UPDATE usos_cupon_divoox SET conductor_id = ?, tomado_en = datetime('now') WHERE operacion_id = ? AND estado = 'apartado'",
    )
    .bind(conductorId, operacionId)
    .run();
}

/**
 * La operación se cobró: el regalo se cierra por lo que de verdad cubrió (nunca más de lo apartado ni
 * de `maximo`) y se le acredita al conductor en su saldo prepago, una sola vez. La contrapartida queda
 * en la cuenta de Divoox (el gasto en regalos). Todo en un lote.
 */
export async function cerrarRegalo(
  db: D1Database,
  p: { operacionId: string; conductorId: string; maximo: number; pedidoId?: string | null },
) {
  const u = await db
    .prepare(
      "SELECT id, codigo, monto, moneda, pais, cliente_id FROM usos_cupon_divoox WHERE operacion_id = ? AND estado = 'apartado'",
    )
    .bind(p.operacionId)
    .first<{
      id: string;
      codigo: string;
      monto: number;
      moneda: string;
      pais: string;
      cliente_id: string;
    }>();
  if (!u) return 0;
  const monto = Math.max(0, Math.min(Number(u.monto), p.maximo));
  if (monto === 0) {
    await liberarRegalo(db, p.operacionId, 'sin_monto');
    return 0;
  }
  const ref = `regalo-divoox:${u.id}`;
  const libro = (cuenta: string, valor: number, concepto: string, referencia: string) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, pedido_id, referencia, autor_id)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL
          WHERE EXISTS (SELECT 1 FROM usos_cupon_divoox WHERE id = ? AND estado = 'cobrado' AND conductor_id = ?)`,
      )
      .bind(
        crypto.randomUUID(),
        cuenta,
        'comisiones',
        u.pais,
        u.moneda,
        valor,
        concepto,
        p.pedidoId ?? null,
        referencia,
        u.id,
        p.conductorId,
      );
  const [cierre] = await db.batch([
    db
      .prepare(
        "UPDATE usos_cupon_divoox SET estado = 'cobrado', monto = ?, conductor_id = ?, tomado_en = COALESCE(tomado_en, datetime('now')), cerrado_en = datetime('now') WHERE id = ? AND estado = 'apartado'",
      )
      .bind(monto, p.conductorId, u.id),
    // C-SALDO-CONDUCTOR: el conductor recibió menos efectivo; lo del regalo va a sus GANANCIAS.
    // Divoox se lo paga por pago móvil, o él lo pasa a su saldo con un toque.
    db
      .prepare(
        `INSERT OR IGNORE INTO movimientos (id, usuario_id, monto, concepto, referencia)
         SELECT ?, ?, ?, 'regalo', ? WHERE EXISTS (SELECT 1 FROM usos_cupon_divoox WHERE id = ? AND estado = 'cobrado' AND conductor_id = ?)
           AND NOT EXISTS (SELECT 1 FROM movimientos WHERE referencia = ?)`,
      )
      .bind(nuevoId(), p.conductorId, monto, ref, u.id, p.conductorId, ref),
    libro(CUENTA_TUMBITE, -monto, 'regalo_divoox_pagado', `${ref}:divoox`),
  ]);
  if (!cierre?.meta.changes) return 0;
  if (monto < Number(u.monto)) await reencenderRecuperados(db);
  // Patrón raro: el mismo cliente con el mismo conductor una y otra vez.
  const juntos = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM operaciones WHERE cliente_id = ?1 AND conductor_id = ?2 AND estado_general = 'terminada' AND actualizado_en > datetime('now', '-7 days')`,
    )
    .bind(u.cliente_id, p.conductorId)
    .first<{ n: number }>();
  const regalosJuntos = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM usos_cupon_divoox WHERE cliente_id = ? AND conductor_id = ? AND estado = 'cobrado'",
    )
    .bind(u.cliente_id, p.conductorId)
    .first<{ n: number }>();
  if (Number(juntos?.n ?? 0) >= 3 || Number(regalosJuntos?.n ?? 0) >= 2)
    await alerta(db, {
      tipo: 'misma_pareja',
      codigo: u.codigo,
      operacionId: p.operacionId,
      clienteId: u.cliente_id,
      conductorId: p.conductorId,
      detalle: `El mismo cliente y el mismo conductor: ${Number(juntos?.n ?? 0)} viajes en 7 días y ${Number(regalosJuntos?.n ?? 0)} con regalo.`,
    });
  return monto;
}

/**
 * El reloj: libera los usos de operaciones que no se hicieron y cierra los de operaciones terminadas
 * cuyo cierre se cortó (idempotente). Lee solo los usos apartados (índice parcial).
 */
export async function barrerRegalos(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT u.operacion_id, u.servicio, u.creado_en < datetime('now', '-30 minutes') AS viejo,
              o.estado_general, o.conductor_id, p.estado AS pedido_estado, p.repartidor_id,
              p.conciliacion_estado, p.descuento, vp.estado AS programado
         FROM usos_cupon_divoox u
         LEFT JOIN operaciones o ON o.id = u.operacion_id
         LEFT JOIN pedidos p ON p.id = u.operacion_id
         LEFT JOIN viajes_programados vp ON vp.id = u.operacion_id
        WHERE u.estado = 'apartado' LIMIT 100`,
    )
    .all<{
      operacion_id: string;
      servicio: string;
      viejo: number;
      estado_general: string | null;
      conductor_id: string | null;
      pedido_estado: string | null;
      repartidor_id: string | null;
      conciliacion_estado: string | null;
      descuento: number | null;
      programado: string | null;
    }>();
  let n = 0;
  for (const r of results) {
    if (r.estado_general === 'terminada' && r.conductor_id) {
      const t = await db
        .prepare('SELECT total_final_centavos FROM viajes WHERE operacion_id = ?')
        .bind(r.operacion_id)
        .first<{ total_final_centavos: number | null }>();
      if (t?.total_final_centavos != null) {
        if (
          await cerrarRegalo(db, {
            operacionId: r.operacion_id,
            conductorId: r.conductor_id,
            maximo: Number(t.total_final_centavos),
          })
        )
          n++;
      }
    } else if (r.estado_general === 'cancelada' || r.estado_general === 'sin_conductor') {
      if (await liberarRegalo(db, r.operacion_id, r.estado_general)) n++;
    } else if (r.pedido_estado === 'cancelado') {
      if (await liberarRegalo(db, r.operacion_id, 'pedido_cancelado')) n++;
    } else if (
      r.pedido_estado === 'entregado' &&
      r.repartidor_id &&
      r.conciliacion_estado &&
      r.conciliacion_estado !== 'pendiente'
    ) {
      if (
        await cerrarRegalo(db, {
          operacionId: r.operacion_id,
          conductorId: r.repartidor_id,
          maximo: Number(r.descuento ?? 0),
          pedidoId: r.operacion_id,
        })
      )
        n++;
    } else if (
      r.programado === 'cancelado' ||
      r.programado === 'fallido' ||
      (r.viejo && !r.estado_general && !r.pedido_estado && !r.programado)
    ) {
      // Un viaje reservado que se canceló, o una operación que nunca llegó a nacer.
      if (await liberarRegalo(db, r.operacion_id, r.programado ?? 'sin_operacion')) n++;
    }
  }
  return n;
}

export const TAREA_REGALOS = {
  nombre: 'regalos_divoox',
  critica: false,
  escriturasEsperadas: 400,
  correr: (_env: unknown, db: D1Database) => barrerRegalos(db),
};

/**
 * Pieza «regalos» del canario: rojo si un cupón gastó más que su presupuesto (no debe pasar nunca),
 * si un regalo cobrado no llegó al saldo del conductor, o si un uso quedó apartado en una operación
 * cerrada hace más de una hora (el reloj no la está cerrando).
 */
export async function saludRegalos(db: D1Database): Promise<'ok' | 'error'> {
  const f = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM cupones_divoox c WHERE ${SQL_GASTADO} > c.presupuesto) AS pasados,
         (SELECT COUNT(*) FROM usos_cupon_divoox u WHERE u.estado = 'cobrado'
            AND u.cerrado_en > datetime('now', '-7 days')
            AND NOT EXISTS (SELECT 1 FROM movimientos m WHERE m.usuario_id = u.conductor_id AND m.referencia = 'regalo-divoox:' || u.id)) AS sin_credito,
         (SELECT COUNT(*) FROM usos_cupon_divoox u
            LEFT JOIN operaciones o ON o.id = u.operacion_id LEFT JOIN pedidos p ON p.id = u.operacion_id
           WHERE u.estado = 'apartado' AND (
             (o.estado_general IN ('terminada', 'cancelada', 'sin_conductor') AND o.actualizado_en < datetime('now', '-1 hour'))
             OR (p.estado = 'cancelado' AND COALESCE(p.cancelado_en, p.creado_en) < datetime('now', '-1 hour')))) AS colgados`,
    )
    .first<{ pasados: number; sin_credito: number; colgados: number }>();
  return Number(f?.pasados ?? 0) + Number(f?.sin_credito ?? 0) + Number(f?.colgados ?? 0) > 0
    ? 'error'
    : 'ok';
}

// ───────────────────────── Superadmin ─────────────────────────

export type DatosCupon = {
  codigo: string;
  nombreEs: string;
  nombreEn: string;
  tipo: 'monto' | 'gratis';
  valor: number;
  moneda: string;
  servicios: string[];
  zonas: string[];
  venceEn: string | null;
  presupuesto: number;
  bienvenida: boolean;
  topeDiarioConductor: number;
};

/** Los topes del código: el panel no los puede pasar. */
export async function revisarTopes(
  db: D1Database,
  d: { presupuesto: number; valor: number; topeDiarioConductor: number },
  codigoEditado?: string,
) {
  if (d.valor > TOPES_REGALO.valorMaximo)
    throw new ErrorDatos('Ese monto por uso pasa el máximo permitido de Divoox.', 'valor', 422);
  if (d.presupuesto > TOPES_REGALO.presupuestoMaximo)
    throw new ErrorDatos('Ese presupuesto pasa el máximo permitido de Divoox.', 'presupuesto', 422);
  if (d.topeDiarioConductor > TOPES_REGALO.topeDiarioConductorMaximo)
    throw new ErrorDatos(
      'Ese tope diario por conductor pasa el máximo permitido de Divoox.',
      'topeDiarioConductor',
      422,
    );
  const otros = await db
    .prepare(
      `SELECT COALESCE(SUM(presupuesto), 0) AS s FROM cupones_divoox
        WHERE codigo <> ? AND COALESCE(creado_por, '') <> 'referidos' AND (vence_en IS NULL OR vence_en > datetime('now'))`,
    )
    .bind(codigoEditado ?? '')
    .first<{ s: number }>();
  if (Number(otros?.s ?? 0) + d.presupuesto > TOPES_REGALO.presupuestoGlobalMaximo)
    throw new ErrorDatos(
      'Con este presupuesto, el total de los cupones vigentes pasa el máximo permitido de Divoox.',
      'presupuesto',
      422,
    );
}

export const aCuponAdmin = (c: FilaCuponDivoox) => {
  const gastado = Number(c.gastado ?? 0);
  const apartado = Number(c.apartado ?? 0);
  return {
    codigo: c.codigo,
    nombreEs: c.nombre_es,
    nombreEn: c.nombre_en,
    tipo: c.tipo,
    valor: Number(c.valor),
    moneda: c.moneda,
    servicios: JSON.parse(c.servicios) as string[],
    zonas: JSON.parse(c.zonas) as string[],
    venceEn: c.vence_en,
    presupuesto: Number(c.presupuesto),
    bienvenida: Number(c.bienvenida) === 1,
    topeDiarioConductor: Number(c.tope_diario_conductor),
    activo: Number(c.activo) === 1,
    agotado: c.apagado_motivo === 'agotado',
    /** Ya cobrado (pagado a conductores). */
    gastado,
    /** Apartado en viajes y pedidos en curso. */
    apartado,
    restante: Math.max(0, Number(c.presupuesto) - gastado - apartado),
    usos: Number(c.usos ?? 0),
    creadoEn: c.creado_en,
  };
};

export async function listarCupones(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT c.*,
         (SELECT COALESCE(SUM(monto), 0) FROM usos_cupon_divoox u WHERE u.codigo = c.codigo AND u.estado = 'cobrado') AS gastado,
         (SELECT COALESCE(SUM(monto), 0) FROM usos_cupon_divoox u WHERE u.codigo = c.codigo AND u.estado = 'apartado') AS apartado,
         (SELECT COUNT(*) FROM usos_cupon_divoox u WHERE u.codigo = c.codigo AND u.estado = 'cobrado') AS usos
         FROM cupones_divoox c WHERE COALESCE(c.creado_por, '') <> 'referidos'
         ORDER BY c.activo DESC, c.creado_en DESC LIMIT 100`,
    )
    .all<FilaCuponDivoox>();
  return results.map(aCuponAdmin);
}

/** Lo acreditado a cada conductor por regalos, lo que ya se le pagó por pago móvil y lo pendiente. */
export async function liquidacionConductores(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT x.conductor_id, x.moneda, x.pais, x.acreditado, x.viajes, us.nombre,
              COALESCE((SELECT SUM(monto) FROM pagos_regalo_conductor p WHERE p.conductor_id = x.conductor_id AND p.moneda = x.moneda), 0) AS pagado,
              COALESCE((SELECT SUM(monto) FROM pagos_regalo_conductor p WHERE p.conductor_id = x.conductor_id AND p.moneda = x.moneda AND p.referencia LIKE 'saldo:%'), 0) AS a_saldo,
              COALESCE((SELECT SUM(m.monto) FROM movimientos m WHERE m.usuario_id = x.conductor_id), 0) AS saldo
         FROM (SELECT conductor_id, moneda, pais, SUM(monto) AS acreditado, COUNT(*) AS viajes
                 FROM usos_cupon_divoox WHERE estado = 'cobrado' GROUP BY conductor_id, moneda, pais) x
         LEFT JOIN usuarios us ON us.id = x.conductor_id
        ORDER BY x.acreditado DESC LIMIT 200`,
    )
    .all<{
      conductor_id: string;
      moneda: string;
      pais: string;
      acreditado: number;
      viajes: number;
      nombre: string | null;
      pagado: number;
      a_saldo: number;
      saldo: number;
    }>();
  return results.map((r) => ({
    conductorId: r.conductor_id,
    nombre: r.nombre ?? '',
    moneda: r.moneda,
    pais: r.pais,
    viajes: Number(r.viajes),
    acreditado: Number(r.acreditado),
    pagadoPagoMovil: Number(r.pagado) - Number(r.a_saldo),
    /** Lo que el conductor pasó a su saldo con un toque. */
    pasadoASaldo: Number(r.a_saldo),
    /** Lo que todavía está en sus ganancias y se le puede pagar por pago móvil o pasar a su saldo. */
    porPagar: Math.max(0, Math.min(Number(r.acreditado) - Number(r.pagado), Number(r.saldo))),
  }));
}

/**
 * El equipo le paga al conductor por pago móvil lo acreditado por regalos: sale de su saldo prepago
 * (nunca más de lo acreditado ni de lo que tiene), una vez por referencia bancaria.
 */
export async function pagarRegaloConductor(
  db: D1Database,
  p: { conductorId: string; moneda: string; monto: number; referencia: string; autorId: string },
) {
  const fila = (await liquidacionConductores(db)).find(
    (x) => x.conductorId === p.conductorId && x.moneda === p.moneda,
  );
  if (!fila || p.monto > fila.porPagar)
    throw new ErrorDatos(
      'Ese monto pasa lo que este conductor tiene por cobrar de regalos.',
      'monto',
      409,
    );
  const id = nuevoId();
  const [pago] = await db.batch([
    db
      .prepare(
        'INSERT OR IGNORE INTO pagos_regalo_conductor (id, conductor_id, monto, moneda, pais, referencia, pagado_por) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(id, p.conductorId, p.monto, p.moneda, fila.pais, p.referencia, p.autorId),
    // Sale de sus ganancias: Divoox ya se lo pagó por pago móvil.
    db
      .prepare(
        `INSERT OR IGNORE INTO movimientos (id, usuario_id, monto, concepto, referencia)
         SELECT ?, ?, ?, 'retiro', ? WHERE EXISTS (SELECT 1 FROM pagos_regalo_conductor WHERE id = ?)`,
      )
      .bind(nuevoId(), p.conductorId, -p.monto, `regalo-pago:${id}`, id),
  ]);
  if (!pago?.meta.changes)
    throw new ErrorDatos('Esa referencia de pago ya está registrada.', 'referencia', 409);
  return id;
}

/** Las alertas antifraude de los últimos 30 días, lo más nuevo primero. */
export async function alertasRegalo(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT a.*, cli.nombre AS cliente, con.nombre AS conductor FROM alertas_regalo a
         LEFT JOIN usuarios cli ON cli.id = a.cliente_id LEFT JOIN usuarios con ON con.id = a.conductor_id
        WHERE a.creado_en > datetime('now', '-30 days') ORDER BY a.creado_en DESC LIMIT 100`,
    )
    .all<Record<string, unknown>>();
  return results.map((a) => ({
    id: String(a.id),
    tipo: String(a.tipo),
    codigo: a.codigo == null ? null : String(a.codigo),
    operacionId: a.operacion_id == null ? null : String(a.operacion_id),
    cliente: a.cliente == null ? null : String(a.cliente),
    conductor: a.conductor == null ? null : String(a.conductor),
    detalle: String(a.detalle),
    creadoEn: String(a.creado_en),
  }));
}

/** El conductor no se quedó con la operación (otro la tomó, la soltó): el uso deja de estar a su nombre. */
export async function soltarRegaloConductor(
  db: D1Database,
  operacionId: string,
  conductorId: string,
) {
  await db
    .prepare(
      "UPDATE usos_cupon_divoox SET conductor_id = NULL, tomado_en = NULL WHERE operacion_id = ? AND conductor_id = ? AND estado = 'apartado'",
    )
    .bind(operacionId, conductorId)
    .run();
}

/** ¿Este código es un regalo de Divoox (y no un cupón de comida)? Devuelve el código normalizado. */
export async function esCodigoRegalo(db: D1Database, escrito: string): Promise<string | null> {
  const codigo = normalizarCodigoRegalo(escrito);
  if (codigo.length < 3) return null;
  const f = await db
    .prepare('SELECT codigo FROM cupones_divoox WHERE codigo = ?')
    .bind(codigo)
    .first<{ codigo: string }>();
  return f?.codigo ?? null;
}

/**
 * El regalo de ESTE código para esta operación, o el motivo claro de por qué no aplica. Lo usan el
 * carrito (al escribir el código) y el pedido de comida.
 */
export async function regaloDeCodigo(
  db: D1Database,
  p: Contexto,
  codigo: string,
): Promise<RegaloAplicado> {
  if (!p.aparato)
    throw new ErrorDatos('Actualiza la app para usar códigos de regalo.', 'cupon', 409);
  const { tel, lista } = await candidatos(db, p, codigo);
  if (!tel)
    throw new ErrorDatos(
      'Agrega tu número de celular en tu cuenta para usar códigos de regalo.',
      'cupon',
      409,
    );
  const r = lista[0];
  if (!r) throw new ErrorDatos('Ese regalo no aplica a este pedido.', 'cupon', 409);
  // Queda en la cuenta, como «Agregar código»: si este pedido no sale, sirve para el próximo.
  await db
    .prepare('INSERT OR IGNORE INTO cupones_divoox_guardados (cliente_id, codigo) VALUES (?, ?)')
    .bind(p.clienteId, r.c.codigo)
    .run();
  return aRegalo(r.c, r.monto);
}

/** Lo que Divoox le debe a un conductor por regalos (en ganancias, sin pagar ni pasar al saldo). */
export async function porCobrarRegalos(db: D1Database, conductorId: string) {
  // C-REFERIDOS-SIN-TRAMPA: se consulta por conductor (índice usos_cupon_divoox_conductor), no en la
  // lista del equipo, que solo trae los 200 con más regalos: el que quedaba fuera veía 0.
  const r = await db
    .prepare(
      `SELECT x.moneda, x.pais, x.acreditado,
              COALESCE((SELECT SUM(monto) FROM pagos_regalo_conductor p WHERE p.conductor_id = ?1 AND p.moneda = x.moneda), 0) AS pagado,
              COALESCE((SELECT SUM(m.monto) FROM movimientos m WHERE m.usuario_id = ?1), 0) AS saldo
         FROM (SELECT moneda, pais, SUM(monto) AS acreditado FROM usos_cupon_divoox
                WHERE conductor_id = ?1 AND estado = 'cobrado' GROUP BY moneda, pais) x
        ORDER BY x.acreditado DESC LIMIT 1`,
    )
    .bind(conductorId)
    .first<{ moneda: string; pais: string; acreditado: number; pagado: number; saldo: number }>();
  if (!r) return null;
  return {
    monto: Math.max(0, Math.min(Number(r.acreditado) - Number(r.pagado), Number(r.saldo))),
    moneda: r.moneda,
    pais: r.pais,
  };
}
