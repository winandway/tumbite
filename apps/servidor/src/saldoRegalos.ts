import { MONEDA_SALDO_DIVOOX, formatearMonto } from '@tumbite/compartido';
import type { Env } from './env';
import { nuevoId } from './cripto';
import { ErrorDatos } from './validar';
import { notificar } from './notificaciones';
import { alerta, huellaTelefono, medirViajeReal } from './regalosDivoox';
import { asegurarLotes, fechaVence } from './saldoLotes';

/**
 * Los regalos AUTOMÁTICOS del Saldo Divoox (26 nov 2026, todos los países; encendido por ciudad,
 * Venezuela primero). Richard: «si se registran de manera masiva… va a haber usuarios al que no le
 * vamos a agregar porque se nos olvidó». Tres caminos, todos en lotes de regalo con vencimiento
 * (saldoLotes.ts) y con su presupuesto de Divoox POR REGLA, comprobado en la MISMA sentencia que
 * escribe (dos a la vez no lo pasan):
 *
 * - C-SALDO-BIENVENIDA: «<Ciudad>: X a cada cliente nuevo». Nace APAGADA. Se acredita una sola vez
 *   cuando el cliente confirma su celular con el código por SMS, y solo si la ciudad de su cuenta
 *   tiene la regla encendida. Una por persona, por número y por aparato (huellas, como el cupón de
 *   bienvenida): si choca, no se acredita y queda la alerta. Si la cuenta no tiene ciudad al confirmar
 *   (lo normal en un cliente), queda pendiente y se decide en su primera cotización, con la ciudad del
 *   viaje que calcula el servidor (no la que diga la app).
 * - C-SALDO-MASIVO: el equipo elige clientes con filtros, ve la vista previa, confirma con el total
 *   escrito y la carga corre por tandas (reanudable e idempotente: una por cliente y carga).
 * - C-SALDO-FIDELIDAD: «cada N viajes reales, M». Nace APAGADA. Se cuenta al cerrar un viaje real.
 *
 * Lo regalado se le acredita al conductor como hoy (solo viaje real; lo dudoso a revisión): eso lo hace
 * saldoCliente.ts al cobrar, que separa en el libro de Divoox lo regalado del prepago.
 */

export type TipoRegla = 'bienvenida' | 'fidelidad';

/** El techo del código para las reglas (centavos de dólar). El panel no lo pasa. */
export const MAXIMOS_REGLA = {
  monto: 2_000,
  presupuesto: 1_000_000,
  topeDiario: 100_000,
  cadaViajes: 100,
  topePersonaMes: 10,
};
export const VIGENCIA_POR_DEFECTO = 30;

export type DatosRegla = {
  tipo: TipoRegla;
  zonaId: string;
  monto: number;
  vigenciaDias: number;
  encendida: boolean;
  presupuesto: number;
  topeDiario?: number | null;
  cadaViajes?: number | null;
  topePersonaMes?: number | null;
};

type FilaRegla = {
  id: string;
  tipo: TipoRegla;
  zona_id: string;
  ciudad: string | null;
  pais: string | null;
  monto: number;
  vigencia_dias: number;
  encendida: number;
  presupuesto: number;
  tope_diario: number | null;
  cada_viajes: number | null;
  tope_persona_mes: number | null;
  actualizado_en: string;
};

/** Desde cuándo cuenta el presupuesto: todo (bienvenida) o el mes en curso (fidelidad). */
const DESDE_DEL_MES = "strftime('%Y-%m-01 00:00:00', 'now')";

/** Las reglas con lo gastado de su presupuesto (para el panel: gastado / disponible). */
export async function listarReglas(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT r.*, z.nombre AS ciudad, z.pais,
              (SELECT COALESCE(SUM(l.monto_inicial - l.vencido), 0) FROM saldo_cliente_lotes l
                WHERE l.regla_id = r.id AND (r.tipo = 'bienvenida' OR l.creado_en >= ${DESDE_DEL_MES})) AS comprometido,
              (SELECT COALESCE(SUM(l.monto_inicial - l.restante - l.vencido), 0) FROM saldo_cliente_lotes l WHERE l.regla_id = r.id) AS usado,
              (SELECT COALESCE(SUM(l.vencido), 0) FROM saldo_cliente_lotes l WHERE l.regla_id = r.id) AS vencido,
              (SELECT COUNT(*) FROM saldo_cliente_lotes l WHERE l.regla_id = r.id) AS personas,
              (SELECT COALESCE(SUM(l.monto_inicial), 0) FROM saldo_cliente_lotes l
                WHERE l.regla_id = r.id AND l.creado_en > datetime('now', '-1 day')) AS hoy
         FROM saldo_reglas_regalo r LEFT JOIN zonas z ON z.id = r.zona_id
        ORDER BY z.nombre, r.tipo LIMIT 200`,
    )
    .all<
      FilaRegla & {
        comprometido: number;
        usado: number;
        vencido: number;
        personas: number;
        hoy: number;
      }
    >();
  return results.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    zonaId: r.zona_id,
    ciudad: r.ciudad ?? r.zona_id,
    pais: r.pais,
    monto: Number(r.monto),
    vigenciaDias: Number(r.vigencia_dias),
    encendida: Number(r.encendida) === 1,
    presupuesto: Number(r.presupuesto),
    topeDiario: r.tope_diario == null ? null : Number(r.tope_diario),
    cadaViajes: r.cada_viajes == null ? null : Number(r.cada_viajes),
    topePersonaMes: r.tope_persona_mes == null ? null : Number(r.tope_persona_mes),
    gastado: Number(r.comprometido),
    disponible: Math.max(0, Number(r.presupuesto) - Number(r.comprometido)),
    usadoEnViajes: Number(r.usado),
    vencido: Number(r.vencido),
    personas: Number(r.personas),
    entregadoHoy: Number(r.hoy),
    actualizadoEn: r.actualizado_en,
  }));
}

/** Crea o cambia la regla de una ciudad (una por tipo y ciudad). Queda en la auditoría. */
export async function guardarRegla(db: D1Database, autorId: string, d: DatosRegla) {
  const m = MAXIMOS_REGLA;
  const entero = (v: unknown, campo: string, min: number, max: number) => {
    if (!Number.isSafeInteger(v) || (v as number) < min || (v as number) > max)
      throw new ErrorDatos(
        Number.isSafeInteger(v)
          ? 'Ese número está fuera de lo permitido.'
          : 'Escribe un número válido.',
        campo,
        422,
      );
  };
  entero(d.monto, 'monto', 1, m.monto);
  entero(d.vigenciaDias, 'vigenciaDias', 1, 365);
  entero(d.presupuesto, 'presupuesto', 0, m.presupuesto);
  if (d.monto > m.monto) throw new ErrorDatos('Ese regalo pasa el máximo de Divoox.', 'monto', 422);
  if (d.tipo === 'bienvenida') {
    if (d.topeDiario == null)
      throw new ErrorDatos('Escribe el tope de 24 horas.', 'topeDiario', 422);
    entero(d.topeDiario, 'topeDiario', 1, m.topeDiario);
  } else {
    if (d.cadaViajes == null)
      throw new ErrorDatos('Escribe cada cuántos viajes se regala.', 'cadaViajes', 422);
    entero(d.cadaViajes, 'cadaViajes', 1, m.cadaViajes);
    if (d.topePersonaMes == null)
      throw new ErrorDatos('Escribe cuántos regalos por persona al mes.', 'topePersonaMes', 422);
    entero(d.topePersonaMes, 'topePersonaMes', 1, m.topePersonaMes);
  }
  if (d.encendida && d.presupuesto < d.monto)
    throw new ErrorDatos(
      'Para encenderla, el presupuesto tiene que alcanzar al menos para un regalo.',
      'presupuesto',
      422,
    );
  const zona = await db
    .prepare('SELECT id, nombre FROM zonas WHERE id = ?')
    .bind(d.zonaId)
    .first<{ id: string; nombre: string }>();
  if (!zona) throw new ErrorDatos('Esa ciudad no existe.', 'zonaId', 404);
  const antes = await db
    .prepare('SELECT * FROM saldo_reglas_regalo WHERE tipo = ? AND zona_id = ?')
    .bind(d.tipo, d.zonaId)
    .first<FilaRegla>();
  const id = antes?.id ?? `${d.tipo}:${d.zonaId}`;
  const despues = {
    monto: d.monto,
    vigenciaDias: d.vigenciaDias,
    encendida: d.encendida,
    presupuesto: d.presupuesto,
    topeDiario: d.tipo === 'bienvenida' ? (d.topeDiario ?? null) : null,
    cadaViajes: d.tipo === 'fidelidad' ? (d.cadaViajes ?? null) : null,
    topePersonaMes: d.tipo === 'fidelidad' ? (d.topePersonaMes ?? null) : null,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO saldo_reglas_regalo (id, tipo, zona_id, monto, moneda, vigencia_dias, encendida, presupuesto,
                                          tope_diario, cada_viajes, tope_persona_mes, actualizado_por)
         VALUES (?1, ?2, ?3, ?4, '${MONEDA_SALDO_DIVOOX}', ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(tipo, zona_id) DO UPDATE SET monto = excluded.monto, vigencia_dias = excluded.vigencia_dias,
           encendida = excluded.encendida, presupuesto = excluded.presupuesto, tope_diario = excluded.tope_diario,
           cada_viajes = excluded.cada_viajes, tope_persona_mes = excluded.tope_persona_mes,
           actualizado_por = excluded.actualizado_por, actualizado_en = datetime('now')`,
      )
      .bind(
        id,
        d.tipo,
        d.zonaId,
        d.monto,
        d.vigenciaDias,
        d.encendida ? 1 : 0,
        d.presupuesto,
        despues.topeDiario,
        despues.cadaViajes,
        despues.topePersonaMes,
        autorId,
      ),
    db
      .prepare(
        'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        autorId,
        `saldo_regla_${d.tipo}`,
        `zona:${d.zonaId}`,
        antes ? JSON.stringify(antes) : null,
        JSON.stringify(despues),
      ),
  ]);
  return (await listarReglas(db)).find((r) => r.id === id) ?? null;
}

/** El aviso al cliente cuando le llega un regalo (nunca frena). */
async function avisarRegalo(
  env: Env | undefined,
  db: D1Database,
  clienteId: string,
  p: {
    monto: number;
    venceEn: string | null;
    zona: string;
    tipo: 'bienvenida' | 'masiva' | 'fidelidad';
  },
) {
  if (!env) return;
  try {
    await notificar(env, db, { id: clienteId, app: 'cliente' }, (i) => {
      const m = formatearMonto(p.monto, MONEDA_SALDO_DIVOOX, i);
      const vence = p.venceEn
        ? i === 'en'
          ? ` It expires on ${fechaVence(p.venceEn, i, p.zona)}.`
          : ` Vence el ${fechaVence(p.venceEn, i, p.zona)}.`
        : '';
      const titulo =
        p.tipo === 'bienvenida'
          ? i === 'en'
            ? 'Welcome to Divoox: a gift for you'
            : 'Bienvenido a Divoox: tienes un regalo'
          : p.tipo === 'fidelidad'
            ? i === 'en'
              ? 'A gift for your rides'
              : 'Un regalo por tus viajes'
            : i === 'en'
              ? 'You got Divoox Balance'
              : 'Te llegó Saldo Divoox';
      return {
        titulo,
        cuerpo:
          i === 'en'
            ? `We gave you ${m} of Divoox Balance to pay your rides.${vence}`
            : `Te regalamos ${m} de Saldo Divoox para pagar tus viajes.${vence}`,
        datos: { tipo: 'saldo_divoox' },
        canal: 'dinero',
      };
    });
  } catch (e) {
    console.error('saldo: no salió el aviso del regalo', String(e));
  }
}

async function zonaHoraria(db: D1Database, zonaId: string) {
  const z = await db
    .prepare('SELECT zona_horaria FROM zonas WHERE id = ?')
    .bind(zonaId)
    .first<{ zona_horaria: string }>();
  return z?.zona_horaria ?? 'America/Caracas';
}

// ───────────────────────── Bienvenida ─────────────────────────

export type ResultadoBienvenida =
  | 'acreditada'
  | 'pendiente'
  | 'sin_regla'
  | 'ya_tenia'
  | 'repetida'
  | 'sin_presupuesto'
  | 'no_aplica';

/**
 * Acredita la bienvenida de esta ciudad a este cliente (una vez). `aparato` = la huella del aparato
 * (cabecera de la app); sin ella, o sin ciudad, queda pendiente para su primera cotización.
 */
export async function acreditarBienvenida(
  env: Env | undefined,
  db: D1Database,
  p: { clienteId: string; zonaId: string | null; aparato: string | null },
): Promise<ResultadoBienvenida> {
  const u = await db
    .prepare(
      `SELECT rol, activo, telefono, telefono_canonico, telefono_verificado_en,
              EXISTS (SELECT 1 FROM saldo_bienvenidas b WHERE b.cliente_id = usuarios.id) AS ya
         FROM usuarios WHERE id = ?`,
    )
    .bind(p.clienteId)
    .first<{
      rol: string;
      activo: number;
      telefono: string | null;
      telefono_canonico: string | null;
      telefono_verificado_en: string | null;
      ya: number;
    }>();
  if (!u || u.rol !== 'cliente' || !Number(u.activo) || !u.telefono_verificado_en)
    return 'no_aplica';
  if (Number(u.ya)) return 'ya_tenia';
  const tel = await huellaTelefono(u.telefono_canonico ?? u.telefono);
  if (!tel) return 'no_aplica';
  if (!p.zonaId || !p.aparato) {
    await db
      .prepare('INSERT OR IGNORE INTO saldo_bienvenida_pendiente (cliente_id) VALUES (?)')
      .bind(p.clienteId)
      .run();
    return 'pendiente';
  }
  const regla = await db
    .prepare(
      "SELECT id, monto, vigencia_dias FROM saldo_reglas_regalo WHERE tipo = 'bienvenida' AND zona_id = ? AND encendida = 1",
    )
    .bind(p.zonaId)
    .first<{ id: string; monto: number; vigencia_dias: number }>();
  const quitarPendiente = db
    .prepare('DELETE FROM saldo_bienvenida_pendiente WHERE cliente_id = ?')
    .bind(p.clienteId);
  if (!regla) {
    await quitarPendiente.run();
    return 'sin_regla';
  }
  await asegurarLotes(db, p.clienteId);
  const loteId = nuevoId();
  const ref = `bienvenida:${p.clienteId}`;
  const [ins] = await db.batch([
    // Una sola sentencia comprueba TODO: regla encendida, una por persona, número y aparato, y que lo
    // entregado más este regalo no pase el presupuesto ni el tope de 24 horas de la regla.
    db
      .prepare(
        `INSERT OR IGNORE INTO saldo_bienvenidas (cliente_id, telefono, aparato, regla_id, lote_id, monto)
         SELECT ?1, ?2, ?3, r.id, ?4, r.monto FROM saldo_reglas_regalo r
          WHERE r.id = ?5 AND r.encendida = 1
            AND NOT EXISTS (SELECT 1 FROM saldo_bienvenidas b WHERE b.cliente_id = ?1 OR b.telefono = ?2 OR b.aparato = ?3)
            AND (SELECT COALESCE(SUM(l.monto_inicial - l.vencido), 0) FROM saldo_cliente_lotes l WHERE l.regla_id = r.id)
                + r.monto <= r.presupuesto
            AND (SELECT COALESCE(SUM(l.monto_inicial), 0) FROM saldo_cliente_lotes l
                  WHERE l.regla_id = r.id AND l.creado_en > datetime('now', '-1 day')) + r.monto <= COALESCE(r.tope_diario, 0)`,
      )
      .bind(p.clienteId, tel, p.aparato, loteId, regla.id),
    db
      .prepare(
        `INSERT OR IGNORE INTO saldo_cliente_lotes (id, cliente_id, moneda, tipo, origen, regla_id, zona_id, monto_inicial, restante, vence_en, movimiento_ref)
         SELECT ?1, ?2, r.moneda, 'regalo', 'bienvenida', r.id, r.zona_id, r.monto, r.monto,
                datetime('now', '+' || r.vigencia_dias || ' days'), ?3
           FROM saldo_reglas_regalo r
          WHERE r.id = ?4 AND EXISTS (SELECT 1 FROM saldo_bienvenidas b WHERE b.cliente_id = ?2 AND b.lote_id = ?1)`,
      )
      .bind(loteId, p.clienteId, ref, regla.id),
    sentenciaMovimientoDeLote(db, loteId, 'Regalo de bienvenida'),
    quitarPendiente,
  ]);
  if (ins?.meta.changes) {
    const l = await db
      .prepare('SELECT monto_inicial, vence_en FROM saldo_cliente_lotes WHERE id = ?')
      .bind(loteId)
      .first<{ monto_inicial: number; vence_en: string | null }>();
    await avisarRegalo(env, db, p.clienteId, {
      monto: Number(l?.monto_inicial ?? regla.monto),
      venceEn: l?.vence_en ?? null,
      zona: await zonaHoraria(db, p.zonaId),
      tipo: 'bienvenida',
    });
    return 'acreditada';
  }
  // ¿Por qué no entró? Lo repetido deja su alerta (el reporte antifraude del equipo).
  const choque = await db
    .prepare(
      'SELECT cliente_id = ?1 AS mismo, telefono = ?2 AS tel, aparato = ?3 AS ap FROM saldo_bienvenidas WHERE cliente_id = ?1 OR telefono = ?2 OR aparato = ?3 LIMIT 1',
    )
    .bind(p.clienteId, tel, p.aparato)
    .first<{ mismo: number; tel: number; ap: number }>();
  if (choque && Number(choque.mismo)) return 'ya_tenia';
  if (choque) {
    await alerta(db, {
      tipo: 'saldo_bienvenida_repetida',
      clienteId: p.clienteId,
      detalle: `La bienvenida de Saldo Divoox no se acreditó: ese ${Number(choque.tel) ? 'número de celular' : 'aparato'} ya la recibió con otra cuenta.`,
    }).catch((e: unknown) => console.error('saldo: alerta de bienvenida repetida', e));
    return 'repetida';
  }
  await alerta(db, {
    tipo: 'saldo_bienvenida_sin_presupuesto',
    clienteId: p.clienteId,
    detalle:
      'La bienvenida de Saldo Divoox no se acreditó: la regla de la ciudad llegó a su presupuesto o a su tope de 24 horas.',
  }).catch((e: unknown) => console.error('saldo: alerta de bienvenida sin presupuesto', e));
  return 'sin_presupuesto';
}

/** El movimiento del libro que nace con un lote de regalo (mismo monto, misma referencia). */
function sentenciaMovimientoDeLote(
  db: D1Database,
  loteId: string,
  motivo: string,
  /** Quién lo hizo (la carga masiva); la bienvenida y la fidelidad son automáticas: sin autor. */
  autorId: string | null = null,
) {
  return db
    .prepare(
      `INSERT OR IGNORE INTO saldo_cliente_movimientos (id, cliente_id, monto, moneda, concepto, referencia, motivo, autor_id)
       SELECT ?1, l.cliente_id, l.monto_inicial, l.moneda, 'regalo', l.movimiento_ref, ?2, ?4
         FROM saldo_cliente_lotes l WHERE l.id = ?3 AND l.monto_inicial > 0`,
    )
    .bind(nuevoId(), motivo.slice(0, 160), loteId, autorId);
}

/** Al confirmar el celular: la bienvenida con la ciudad de la cuenta (si la tiene). Nunca frena. */
export async function alConfirmarCelular(
  env: Env | undefined,
  db: D1Database,
  clienteId: string,
  aparato: string | null,
) {
  try {
    const u = await db
      .prepare('SELECT zona_id FROM usuarios WHERE id = ?')
      .bind(clienteId)
      .first<{ zona_id: string | null }>();
    return await acreditarBienvenida(env, db, { clienteId, zonaId: u?.zona_id ?? null, aparato });
  } catch (e) {
    console.error('saldo: la bienvenida al confirmar el celular falló', String(e));
    return 'no_aplica' as const;
  }
}

/**
 * La bienvenida pendiente (confirmó el celular sin ciudad o sin aparato) se decide en su cotización,
 * con la ciudad del viaje que calcula el servidor. Una lectura por la llave cuando no hay nada.
 */
export async function bienvenidaPendiente(
  env: Env | undefined,
  db: D1Database,
  p: { clienteId: string; zonaId: string; aparato: string | null },
) {
  if (!p.aparato) return null;
  const f = await db
    .prepare('SELECT 1 AS si FROM saldo_bienvenida_pendiente WHERE cliente_id = ?')
    .bind(p.clienteId)
    .first<{ si: number }>();
  if (!f) return null;
  try {
    return await acreditarBienvenida(env, db, p);
  } catch (e) {
    console.error('saldo: la bienvenida pendiente falló', String(e));
    return null;
  }
}

// ───────────────────────── Fidelidad ─────────────────────────

/**
 * Al cerrar un viaje REAL (viajeReal.ts): se cuenta en la regla de fidelidad de su ciudad (una vez por
 * viaje) y cada N viajes se regala M, sin pasar el presupuesto del mes ni los premios por persona al
 * mes. Lee la regla por su llave única; sin regla encendida no lee nada más. Nunca frena el viaje.
 */
export async function contarViajeFidelidad(
  env: Env | undefined,
  db: D1Database,
  p: { operacionId: string; conductorId: string },
) {
  try {
    const op = await db
      .prepare(
        `SELECT o.cliente_id, o.zona_id, r.id AS regla, r.cada_viajes
           FROM operaciones o JOIN saldo_reglas_regalo r ON r.tipo = 'fidelidad' AND r.zona_id = o.zona_id AND r.encendida = 1
          WHERE o.id = ? AND o.tipo_operacion = 'viaje_pasajero' AND o.estado_general = 'terminada'`,
      )
      .bind(p.operacionId)
      .first<{ cliente_id: string; zona_id: string; regla: string; cada_viajes: number | null }>();
    if (!op || !op.cada_viajes) return null;
    const medida = await medirViajeReal(db, { ...p, alTerminar: true });
    if (!medida || medida.motivos.length > 0) return null;
    const ins = await db
      .prepare(
        `INSERT OR IGNORE INTO saldo_fidelidad_viajes (operacion_id, regla_id, cliente_id, numero)
         SELECT ?1, ?2, ?3, (SELECT COUNT(*) + 1 FROM saldo_fidelidad_viajes WHERE regla_id = ?2 AND cliente_id = ?3)`,
      )
      .bind(p.operacionId, op.regla, op.cliente_id)
      .run();
    if (!ins.meta.changes) return null;
    const n = await db
      .prepare('SELECT numero FROM saldo_fidelidad_viajes WHERE operacion_id = ?')
      .bind(p.operacionId)
      .first<{ numero: number }>();
    const numero = Number(n?.numero ?? 0);
    if (!numero || numero % Number(op.cada_viajes) !== 0) return { numero, premio: false };
    await asegurarLotes(db, op.cliente_id);
    const loteId = nuevoId();
    const [lote] = await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO saldo_cliente_lotes (id, cliente_id, moneda, tipo, origen, regla_id, zona_id, monto_inicial, restante, vence_en, movimiento_ref)
           SELECT ?1, ?2, r.moneda, 'regalo', 'fidelidad', r.id, r.zona_id, r.monto, r.monto,
                  datetime('now', '+' || r.vigencia_dias || ' days'), ?3
             FROM saldo_reglas_regalo r
            WHERE r.id = ?4 AND r.encendida = 1
              AND (SELECT COALESCE(SUM(l.monto_inicial - l.vencido), 0) FROM saldo_cliente_lotes l
                    WHERE l.regla_id = r.id AND l.creado_en >= ${DESDE_DEL_MES}) + r.monto <= r.presupuesto
              AND (SELECT COUNT(*) FROM saldo_cliente_lotes l
                    WHERE l.regla_id = r.id AND l.cliente_id = ?2 AND l.creado_en >= ${DESDE_DEL_MES}) < COALESCE(r.tope_persona_mes, 0)`,
        )
        .bind(loteId, op.cliente_id, `fidelidad:${op.regla}:${op.cliente_id}:${numero}`, op.regla),
      sentenciaMovimientoDeLote(db, loteId, `Regalo por tus viajes (${numero})`),
    ]);
    if (!lote?.meta.changes) {
      // No se pierde en silencio: queda la alerta para el equipo, como en la bienvenida.
      await alerta(db, {
        tipo: 'saldo_fidelidad_sin_presupuesto',
        operacionId: p.operacionId,
        clienteId: op.cliente_id,
        detalle: `El regalo por viajes (viaje ${numero}) no se acreditó: la regla de la ciudad llegó a su presupuesto del mes o al tope de regalos por persona al mes.`,
      }).catch((e: unknown) => console.error('saldo: alerta de fidelidad sin presupuesto', e));
      return { numero, premio: false };
    }
    const l = await db
      .prepare('SELECT monto_inicial, vence_en FROM saldo_cliente_lotes WHERE id = ?')
      .bind(loteId)
      .first<{ monto_inicial: number; vence_en: string | null }>();
    await avisarRegalo(env, db, op.cliente_id, {
      monto: Number(l?.monto_inicial ?? 0),
      venceEn: l?.vence_en ?? null,
      zona: await zonaHoraria(db, op.zona_id),
      tipo: 'fidelidad',
    });
    return { numero, premio: true };
  } catch (e) {
    console.error('saldo: la fidelidad del viaje falló', String(e));
    return null;
  }
}

// ───────────────────────── Carga masiva ─────────────────────────

export type FiltrosMasiva = {
  zonaId: string | null;
  /** AAAA-MM-DD, en el día de la base (UTC). */
  desde: string | null;
  hasta: string | null;
  viajesMin: number | null;
  viajesMax: number | null;
  celularVerificado: boolean;
};

/**
 * Topes de la carga masiva (centavos de dólar): por cliente, por carga, y lo que una persona del equipo
 * y todo el equipo reparten en 24 horas con cargas masivas. No se mezclan con los topes de las cargas a
 * mano (esos cuentan solo las cargas a mano) ni con los de la bienvenida y la fidelidad (por regla).
 */
export type TopesMasiva = {
  porCliente: number;
  porCarga: number;
  porDiaPersona: number;
  porDiaGlobal: number;
};
export const TOPES_MASIVA_INICIALES: TopesMasiva = {
  porCliente: 500,
  porCarga: 50_000,
  porDiaPersona: 50_000,
  porDiaGlobal: 100_000,
};
export const TOPES_MASIVA_MAXIMOS: TopesMasiva = {
  porCliente: 2_000,
  porCarga: 500_000,
  porDiaPersona: 500_000,
  porDiaGlobal: 1_000_000,
};
const CLAVE_TOPES_MASIVA = 'saldo_masiva_topes';
/** Clientes por tanda (cada uno: un lote, un movimiento y su aviso). */
export const TANDA_MASIVA = 50;
/** La vista previa cuenta hasta aquí (una carga no pasa de esto). */
export const MAX_CLIENTES_CARGA = 5_000;

export async function leerTopesMasiva(db: D1Database): Promise<TopesMasiva> {
  const f = await db
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(CLAVE_TOPES_MASIVA)
    .first<{ valor: string }>();
  let g: Partial<TopesMasiva> = {};
  try {
    g = f ? (JSON.parse(f.valor) as Partial<TopesMasiva>) : {};
  } catch {
    console.error('saldo: topes de la carga masiva dañados; se usan los iniciales');
  }
  const uno = (v: unknown, i: number, m: number) => {
    const n = Number(v);
    return Number.isSafeInteger(n) && n > 0 ? Math.min(n, m) : i;
  };
  return {
    porCliente: uno(
      g.porCliente,
      TOPES_MASIVA_INICIALES.porCliente,
      TOPES_MASIVA_MAXIMOS.porCliente,
    ),
    porCarga: uno(g.porCarga, TOPES_MASIVA_INICIALES.porCarga, TOPES_MASIVA_MAXIMOS.porCarga),
    porDiaPersona: uno(
      g.porDiaPersona,
      TOPES_MASIVA_INICIALES.porDiaPersona,
      TOPES_MASIVA_MAXIMOS.porDiaPersona,
    ),
    porDiaGlobal: uno(
      g.porDiaGlobal,
      TOPES_MASIVA_INICIALES.porDiaGlobal,
      TOPES_MASIVA_MAXIMOS.porDiaGlobal,
    ),
  };
}

/**
 * Lo repartido con cargas masivas en las últimas 24 horas (todo el equipo y la persona). Las cargas de
 * esa ventana se buscan por su fecha (índice) y sus lotes por la regla (índice): no recorre tablas.
 */
const SQL_MASIVA_HOY = (autor: string) =>
  `(SELECT COALESCE(SUM(l.monto_inicial), 0) FROM saldo_cliente_lotes l
     WHERE l.origen = 'masiva' AND l.creado_en > datetime('now', '-1 day')
       AND l.regla_id IN (SELECT k.id FROM saldo_cargas_masivas k INDEXED BY saldo_cargas_masivas_fecha
                           WHERE k.creado_en > datetime('now', '-8 days') ${autor ? `AND k.autor_id = ${autor}` : ''}))`;

async function repartidoHoy(db: D1Database, autorId: string) {
  const f = await db
    .prepare(`SELECT ${SQL_MASIVA_HOY('?1')} AS persona, ${SQL_MASIVA_HOY('')} AS global`)
    .bind(autorId)
    .first<{ persona: number; global: number }>();
  return { persona: Number(f?.persona ?? 0), global: Number(f?.global ?? 0) };
}

export async function guardarTopesMasiva(db: D1Database, t: TopesMasiva, autorId: string) {
  for (const [k, v, max] of [
    ['porCliente', t.porCliente, TOPES_MASIVA_MAXIMOS.porCliente],
    ['porCarga', t.porCarga, TOPES_MASIVA_MAXIMOS.porCarga],
    ['porDiaPersona', t.porDiaPersona, TOPES_MASIVA_MAXIMOS.porDiaPersona],
    ['porDiaGlobal', t.porDiaGlobal, TOPES_MASIVA_MAXIMOS.porDiaGlobal],
  ] as const) {
    if (!Number.isSafeInteger(v) || v <= 0)
      throw new ErrorDatos('Escribe un tope mayor que cero.', k, 422);
    if (v > max) throw new ErrorDatos('Ese tope pasa el máximo de Divoox.', k, 422);
  }
  const antes = await leerTopesMasiva(db);
  await db.batch([
    db
      .prepare(
        "INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
      )
      .bind(CLAVE_TOPES_MASIVA, JSON.stringify(t)),
    db
      .prepare(
        'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        autorId,
        'saldo_masiva_topes',
        'saldo_cliente',
        JSON.stringify(antes),
        JSON.stringify(t),
      ),
  ]);
  return leerTopesMasiva(db);
}

/**
 * Los clientes que cumplen los filtros (cuentas activas, creadas hasta `corte`), por la llave
 * (creado_en, id) desde `despues`. La ciudad de un cliente: la de su cuenta, la de algún viaje suyo o
 * la de un regalo que ya recibió allí (casi ningún cliente tiene ciudad en su cuenta).
 */
function sqlCandidatos(limite: number) {
  return `SELECT * FROM (
      SELECT u.id, u.nombre, u.creado_en, u.telefono_verificado_en IS NOT NULL AS verificado,
             COALESCE(v.n, 0) AS viajes
        FROM usuarios u INDEXED BY usuarios_rol_creado
        -- Los viajes terminados de todos los clientes en UNA consulta agregada (no uno por uno).
        LEFT JOIN (SELECT o.cliente_id, COUNT(*) AS n FROM operaciones o
                    WHERE o.tipo_operacion = 'viaje_pasajero' AND o.estado_general = 'terminada'
                    GROUP BY o.cliente_id) v ON v.cliente_id = u.id
       WHERE u.rol = 'cliente' AND u.activo = 1 AND u.creado_en <= ?1
         AND (?2 IS NULL OR u.creado_en >= ?2)
         AND (?3 IS NULL OR u.creado_en < date(?3, '+1 day'))
         AND (?4 = 0 OR u.telefono_verificado_en IS NOT NULL)
         AND (?5 IS NULL OR u.zona_id = ?5
              OR EXISTS (SELECT 1 FROM operaciones o WHERE o.cliente_id = u.id AND o.zona_id = ?5)
              OR EXISTS (SELECT 1 FROM saldo_cliente_lotes l WHERE l.cliente_id = u.id AND l.zona_id = ?5))
         AND (u.creado_en > ?8 OR (u.creado_en = ?8 AND u.id > ?9))
       ORDER BY u.creado_en, u.id) c
     WHERE (?6 IS NULL OR c.viajes >= ?6) AND (?7 IS NULL OR c.viajes <= ?7)
     LIMIT ${limite}`;
}

type Candidato = {
  id: string;
  nombre: string;
  creado_en: string;
  verificado: number;
  viajes: number;
};

async function candidatos(
  db: D1Database,
  f: FiltrosMasiva,
  corte: string,
  despues: { fecha: string; id: string },
  limite: number,
) {
  const { results } = await db
    .prepare(sqlCandidatos(limite))
    .bind(
      corte,
      f.desde,
      f.hasta,
      f.celularVerificado ? 1 : 0,
      f.zonaId,
      f.viajesMin,
      f.viajesMax,
      despues.fecha,
      despues.id,
    )
    .all<Candidato>();
  return results;
}

const AHORA_SQL = "SELECT datetime('now') AS ahora";
const CURSOR_INICIAL = { fecha: '', id: '' };
const leerCursor = (c: string) => {
  const [fecha = '', id = ''] = c.split('|');
  return { fecha, id };
};

/** La vista previa: cuántos, el total y una página de la lista (paginada por la llave). */
export async function vistaPreviaMasiva(
  db: D1Database,
  p: { filtros: FiltrosMasiva; monto: number; pagina?: string | null },
) {
  const ahora = (await db.prepare(AHORA_SQL).first<{ ahora: string }>())?.ahora ?? '';
  // Contar en la base (hasta el máximo de una carga, más uno para decir «más de…»), sin traer las filas.
  const f = p.filtros;
  const cuenta = await db
    .prepare(`SELECT COUNT(*) AS n FROM (${sqlCandidatos(MAX_CLIENTES_CARGA + 1)})`)
    .bind(
      ahora,
      f.desde,
      f.hasta,
      f.celularVerificado ? 1 : 0,
      f.zonaId,
      f.viajesMin,
      f.viajesMax,
      CURSOR_INICIAL.fecha,
      CURSOR_INICIAL.id,
    )
    .first<{ n: number }>();
  const todos = { length: Number(cuenta?.n ?? 0) };
  const clientes = Math.min(todos.length, MAX_CLIENTES_CARGA);
  const desde = p.pagina ? leerCursor(p.pagina) : CURSOR_INICIAL;
  const pagina = (await candidatos(db, p.filtros, ahora, desde, 51)).slice(0, 51);
  const lista = pagina.slice(0, 50);
  const ultimo = lista.at(-1);
  return {
    clientes,
    masDeLaCuenta: todos.length > MAX_CLIENTES_CARGA,
    total: clientes * p.monto,
    lista: lista.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      registrado: c.creado_en,
      viajes: Number(c.viajes),
      celularVerificado: Number(c.verificado) === 1,
    })),
    siguiente: pagina.length > 50 && ultimo ? `${ultimo.creado_en}|${ultimo.id}` : null,
    corte: ahora,
  };
}

/**
 * Confirma una carga masiva: el total escrito por el equipo tiene que ser el de la vista previa de
 * AHORA (si la lista cambió, 409 y se vuelve a mirar). Topes, motivo obligatorio y auditoría. La
 * primera tanda corre aquí; las demás las pide el panel (o el reloj, si el panel se cerró).
 */
export async function crearCargaMasiva(
  env: Env | undefined,
  db: D1Database,
  p: {
    filtros: FiltrosMasiva;
    monto: number;
    vigenciaDias: number;
    motivo: string;
    totalEscrito: number;
    autorId: string;
    idempotencia: string;
  },
) {
  const ya = await db
    .prepare('SELECT id FROM saldo_cargas_masivas WHERE idempotencia = ?')
    .bind(p.idempotencia)
    .first<{ id: string }>();
  if (ya) return { carga: await cargaMasiva(db, ya.id), repetida: true };
  if (p.motivo.trim().length < 5)
    throw new ErrorDatos('Escribe el motivo de la carga (para la auditoría).', 'motivo', 422);
  if (!Number.isSafeInteger(p.vigenciaDias) || p.vigenciaDias < 1 || p.vigenciaDias > 365)
    throw new ErrorDatos('La vigencia va de 1 a 365 días.', 'vigenciaDias', 422);
  const topes = await leerTopesMasiva(db);
  if (!Number.isSafeInteger(p.monto) || p.monto <= 0)
    throw new ErrorDatos('Escribe un monto mayor que cero.', 'monto', 422);
  if (p.monto > topes.porCliente)
    throw new ErrorDatos('Ese monto pasa el tope por cliente de la carga masiva.', 'monto', 422);
  const previa = await vistaPreviaMasiva(db, { filtros: p.filtros, monto: p.monto });
  if (previa.clientes === 0)
    throw new ErrorDatos('Ningún cliente cumple esos filtros.', undefined, 422);
  if (previa.masDeLaCuenta)
    throw new ErrorDatos(
      `Son más de ${MAX_CLIENTES_CARGA} clientes. Ajusta los filtros y haz cargas más pequeñas.`,
      undefined,
      422,
    );
  if (previa.total > topes.porCarga)
    throw new ErrorDatos('Ese total pasa el tope por carga masiva.', 'totalEscrito', 422);
  const hoy = await repartidoHoy(db, p.autorId);
  if (hoy.persona + previa.total > topes.porDiaPersona)
    throw new ErrorDatos(
      'Esa carga pasa tu tope de cargas masivas de 24 horas. Hazla más pequeña o espera a mañana.',
      'totalEscrito',
      422,
    );
  if (hoy.global + previa.total > topes.porDiaGlobal)
    throw new ErrorDatos(
      'Esa carga pasa el tope de cargas masivas de 24 horas del equipo. Hazla más pequeña o espera a mañana.',
      'totalEscrito',
      422,
    );
  if (p.totalEscrito !== previa.total)
    throw new ErrorDatos(
      'El total escrito no coincide con el de la lista de ahora. Revisa la vista previa y escríbelo otra vez.',
      'totalEscrito',
      409,
    );
  const id = nuevoId();
  // Dos confirmaciones a la vez con la misma clave: la segunda devuelve la carga que ya nació.
  const insertar = db.batch([
    db
      .prepare(
        `INSERT INTO saldo_cargas_masivas (id, autor_id, motivo, filtros_json, monto, vigencia_dias, clientes, total, corte_en, idempotencia)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        p.autorId,
        p.motivo.trim().slice(0, 160),
        JSON.stringify(p.filtros),
        p.monto,
        p.vigenciaDias,
        previa.clientes,
        previa.total,
        previa.corte,
        p.idempotencia,
      ),
    db
      .prepare(
        'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, NULL, ?)',
      )
      .bind(
        p.autorId,
        'saldo_carga_masiva',
        `carga:${id}`,
        JSON.stringify({
          filtros: p.filtros,
          monto: p.monto,
          vigenciaDias: p.vigenciaDias,
          clientes: previa.clientes,
          total: previa.total,
          motivo: p.motivo.trim().slice(0, 160),
        }),
      ),
  ]);
  try {
    await insertar;
  } catch (e) {
    if (!/UNIQUE/i.test(String(e))) throw e;
    const otra = await db
      .prepare('SELECT id FROM saldo_cargas_masivas WHERE idempotencia = ?')
      .bind(p.idempotencia)
      .first<{ id: string }>();
    if (!otra) throw e;
    return { carga: await cargaMasiva(db, otra.id), repetida: true };
  }
  await procesarTandaMasiva(env, db, id);
  return { carga: await cargaMasiva(db, id), repetida: false };
}

type FilaCarga = {
  id: string;
  autor: string | null;
  motivo: string;
  filtros_json: string;
  monto: number;
  vigencia_dias: number;
  clientes: number;
  total: number;
  corte_en: string;
  estado: string;
  cursor: string;
  revisados: number;
  acreditados: number;
  creado_en: string;
  terminado_en: string | null;
  entregado: number;
};

const SELECT_CARGA = `SELECT c.*, a.nombre AS autor,
    (SELECT COALESCE(SUM(l.monto_inicial), 0) FROM saldo_cliente_lotes l WHERE l.regla_id = c.id) AS entregado
   FROM saldo_cargas_masivas c LEFT JOIN usuarios a ON a.id = c.autor_id`;

function verCarga(c: FilaCarga) {
  return {
    id: c.id,
    autor: c.autor,
    motivo: c.motivo,
    filtros: JSON.parse(c.filtros_json) as FiltrosMasiva,
    monto: Number(c.monto),
    vigenciaDias: Number(c.vigencia_dias),
    clientes: Number(c.clientes),
    total: Number(c.total),
    estado: c.estado as 'en_curso' | 'terminada' | 'detenida',
    revisados: Number(c.revisados),
    acreditados: Number(c.acreditados),
    entregado: Number(c.entregado),
    creadoEn: c.creado_en,
    terminadoEn: c.terminado_en,
  };
}

export async function cargaMasiva(db: D1Database, id: string) {
  const c = await db.prepare(`${SELECT_CARGA} WHERE c.id = ?`).bind(id).first<FilaCarga>();
  if (!c) throw new ErrorDatos('Esa carga no existe.', undefined, 404);
  return verCarga(c);
}

export async function listarCargasMasivas(db: D1Database) {
  const { results } = await db
    .prepare(`${SELECT_CARGA} ORDER BY c.creado_en DESC LIMIT 30`)
    .all<FilaCarga>();
  return results.map(verCarga);
}

/**
 * Una tanda de la carga (hasta TANDA_MASIVA clientes por la llave del cursor). Cada cliente: un lote y
 * su movimiento, en la MISMA sentencia que comprueba que lo entregado no pasa el total confirmado (el
 * presupuesto de la carga). La referencia «masiva:<carga>:<cliente>» hace que repetir no acredite dos
 * veces. Reanudable: el cursor queda guardado.
 */
export async function procesarTandaMasiva(env: Env | undefined, db: D1Database, cargaId: string) {
  const c = await db
    .prepare('SELECT * FROM saldo_cargas_masivas WHERE id = ?')
    .bind(cargaId)
    .first<FilaCarga & { autor_id: string }>();
  if (!c) throw new ErrorDatos('Esa carga no existe.', undefined, 404);
  if (c.estado !== 'en_curso') return cargaMasiva(db, cargaId);
  const filtros = JSON.parse(c.filtros_json) as FiltrosMasiva;
  // C-SALDO-MASIVO: los topes de 24 horas (la persona que la hizo y todo el equipo). Sin cupo hoy, la
  // carga espera sin avanzar y el reloj la sigue cuando se libere (nadie se queda sin su regalo).
  const topes = await leerTopesMasiva(db);
  const hoy = await repartidoHoy(db, c.autor_id);
  const cupo = Math.min(
    Math.floor((topes.porDiaPersona - hoy.persona) / Number(c.monto)),
    Math.floor((topes.porDiaGlobal - hoy.global) / Number(c.monto)),
  );
  if (cupo <= 0) return { ...(await cargaMasiva(db, cargaId)), frenadaPorTope: true };
  const limite = Math.min(TANDA_MASIVA, cupo);
  const desde = c.cursor ? leerCursor(c.cursor) : CURSOR_INICIAL;
  const tanda = await candidatos(db, filtros, c.corte_en, desde, limite);
  const refDe = (clienteId: string) => `masiva:${cargaId}:${clienteId}`;
  const conLote = async () =>
    new Set(
      tanda.length
        ? (
            await db
              .prepare(
                `SELECT movimiento_ref FROM saldo_cliente_lotes WHERE movimiento_ref IN (${tanda.map(() => '?').join(',')})`,
              )
              .bind(...tanda.map((x) => refDe(x.id)))
              .all<{ movimiento_ref: string }>()
          ).results.map((r) => r.movimiento_ref)
        : [],
    );
  const previos = await conLote();
  for (const x of tanda) await asegurarLotes(db, x.id);
  const sentencias: D1PreparedStatement[] = [];
  const nuevos: { clienteId: string; loteId: string }[] = [];
  for (const x of tanda) {
    const ref = refDe(x.id);
    if (previos.has(ref)) continue;
    const loteId = nuevoId();
    nuevos.push({ clienteId: x.id, loteId });
    sentencias.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO saldo_cliente_lotes (id, cliente_id, moneda, tipo, origen, regla_id, zona_id, monto_inicial, restante, vence_en, movimiento_ref)
           SELECT ?1, ?2, c.moneda, 'regalo', 'masiva', c.id, ?3, c.monto, c.monto,
                  datetime('now', '+' || c.vigencia_dias || ' days'), ?4
             FROM saldo_cargas_masivas c
            WHERE c.id = ?5 AND c.estado = 'en_curso'
              -- El total confirmado (el presupuesto de la carga) y los topes de 24 horas, en la MISMA
              -- sentencia que escribe: dos tandas a la vez no los pasan.
              AND (SELECT COALESCE(SUM(l.monto_inicial), 0) FROM saldo_cliente_lotes l WHERE l.regla_id = c.id) + c.monto <= c.total
              AND ${SQL_MASIVA_HOY('c.autor_id')} + c.monto <= ?6
              AND ${SQL_MASIVA_HOY('')} + c.monto <= ?7`,
        )
        .bind(loteId, x.id, filtros.zonaId, ref, cargaId, topes.porDiaPersona, topes.porDiaGlobal),
      // El movimiento queda a nombre de quien hizo la carga (auditoría del libro).
      sentenciaMovimientoDeLote(db, loteId, `Carga masiva · ${c.motivo}`, c.autor_id),
    );
  }
  if (sentencias.length) await db.batch(sentencias);
  // El cursor avanza solo hasta el último cliente que YA tiene su regalo, sin saltarse a nadie: si un
  // tope frenó a alguien en medio de la tanda, la próxima empieza por él.
  const hechos = await conLote();
  const primeroSin = tanda.findIndex((x) => !hechos.has(refDe(x.id)));
  const hasta = primeroSin === -1 ? tanda.length - 1 : primeroSin - 1;
  const ultimo = tanda.slice(0, hasta + 1).at(-1);
  const completa = hasta === tanda.length - 1;
  const terminada = completa && tanda.length < limite;
  await db
    .prepare(
      `UPDATE saldo_cargas_masivas SET cursor = ?1, revisados = revisados + ?2,
              acreditados = (SELECT COUNT(*) FROM saldo_cliente_lotes l WHERE l.regla_id = ?3),
              estado = CASE WHEN ?4 = 1 OR (SELECT COALESCE(SUM(l.monto_inicial), 0) FROM saldo_cliente_lotes l WHERE l.regla_id = ?3) + monto > total
                            THEN 'terminada' ELSE estado END,
              terminado_en = CASE WHEN ?4 = 1 OR (SELECT COALESCE(SUM(l.monto_inicial), 0) FROM saldo_cliente_lotes l WHERE l.regla_id = ?3) + monto > total
                                  THEN datetime('now') ELSE terminado_en END
        WHERE id = ?3 AND cursor = ?5 AND estado = 'en_curso'`,
    )
    .bind(
      ultimo ? `${ultimo.creado_en}|${ultimo.id}` : c.cursor,
      hasta + 1,
      cargaId,
      terminada ? 1 : 0,
      c.cursor,
    )
    .run();
  if (nuevos.length) {
    const zona = filtros.zonaId ? await zonaHoraria(db, filtros.zonaId) : 'America/Caracas';
    const { results } = await db
      .prepare(
        `SELECT id, cliente_id, monto_inicial, vence_en FROM saldo_cliente_lotes WHERE id IN (${nuevos.map(() => '?').join(',')})`,
      )
      .bind(...nuevos.map((n) => n.loteId))
      .all<{ id: string; cliente_id: string; monto_inicial: number; vence_en: string | null }>();
    for (const l of results)
      await avisarRegalo(env, db, l.cliente_id, {
        monto: Number(l.monto_inicial),
        venceEn: l.vence_en,
        zona,
        tipo: 'masiva',
      });
  }
  // Frenada por un tope de 24 horas: alguien quedó esperando, o la tanda fue más corta por falta de cupo.
  const frenadaPorTope = !completa || (limite < TANDA_MASIVA && !terminada);
  return { ...(await cargaMasiva(db, cargaId)), frenadaPorTope };
}

/** El reloj sigue las cargas en curso si el panel se cerró (una tanda por carga y vuelta). */
export async function continuarCargasMasivas(env: Env | undefined, db: D1Database) {
  const { results } = await db
    .prepare(
      "SELECT id FROM saldo_cargas_masivas INDEXED BY saldo_cargas_masivas_en_curso WHERE estado = 'en_curso' ORDER BY creado_en LIMIT 3",
    )
    .all<{ id: string }>();
  let n = 0;
  for (const r of results) {
    await procesarTandaMasiva(env, db, r.id);
    n++;
  }
  return n;
}

/** Detener una carga en curso (lo acreditado se queda; lo que falta ya no se hace). Auditado. */
export async function detenerCargaMasiva(db: D1Database, id: string, autorId: string) {
  const r = await db
    .prepare(
      "UPDATE saldo_cargas_masivas SET estado = 'detenida', terminado_en = datetime('now') WHERE id = ? AND estado = 'en_curso'",
    )
    .bind(id)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Esa carga ya no está en curso. Actualiza la pantalla.', undefined, 409);
  await db
    .prepare(
      "INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, 'saldo_carga_masiva_detenida', ?, NULL, NULL)",
    )
    .bind(autorId, `carga:${id}`)
    .run();
  return cargaMasiva(db, id);
}
