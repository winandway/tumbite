import {
  type ReglaComision,
  calcularComision,
  equivalenteLocal,
  esquemaRegla,
  tasaGuardada,
} from '@tumbite/compartido';
import { z } from 'zod';
import type { Env } from '../env';
import { cancelarConReembolso, anotarEvento } from '../manager';
import { notificar } from '../notificaciones';
import { politicaVigente } from '../finanzas/politicas';
import { tasaParaFijar } from '../rutas/tasasReferencia';
import { ErrorDatos } from '../validar';
import { abrirIncidencia } from './bandeja';
import { CUENTA_TUMBITE, saldoLibro, sentenciaDescontar, sentenciaLibro } from './libro';
import { MINUTOS_CORREGIR_PAGO_MOVIL, decidirPagoMovil } from './pagoMovil';
import { type ConfigPais, TIEMPOS_PAGO_COMIDA, leerConfigPais, paisDeZona } from './paises';

/**
 * C-COMIDA-PAGO-RESTAURANTE (22 nov 2026) — Venezuela y todo país con `comidaPagoRestaurante`.
 *
 * El cliente le paga la comida DIRECTO al restaurante por pago móvil y el envío al conductor (efectivo
 * o pago móvil al conductor, como siempre). El conductor ya no adelanta nada en el local. Divoox nunca
 * recibe ni custodia el dinero de la comida: aquí solo queda lo que cada uno dijo.
 *
 * Orden (un pedido es de pago directo si tiene fila en `pagos_comida`):
 * 1. El cliente confirma: `esperando_conductor` (nadie paga todavía).
 * 2. El restaurante acepta: la oferta al conductor sale de inmediato (no espera la cocina).
 * 3. Un conductor acepta (con su comisión apartada del saldo prepago): `por_pagar`, con el monto en
 *    bolívares CONGELADO con la tasa vigente y un vencimiento. En la recogida en el local, al aceptar
 *    el restaurante.
 * 4. El cliente paga y escribe la referencia (obligatoria; la foto es opcional y nunca es la prueba):
 *    `reportado`.
 * 5. El restaurante mira SU banco: «Me llegó» (`confirmado`) o «No me llegó» (`no_llego` + caso).
 *    El cliente corrige la referencia UNA vez; el restaurante corrige a «sí» UNA vez en 30 minutos.
 * 6. Solo con `confirmado` se marca listo, se recoge y el conductor ve «ya puedes ir».
 * 7. El conductor cobra al cliente SOLO el envío: total − propina − comida.
 *
 * Tiempos (por país, `pagoComida`): sin conductor → se cancela, nadie pagó; pago vencido sin
 * referencia → se cancela, nadie pagó; restaurante que no responde → avisos y cancelación con caso y
 * devolución pendiente. Toda cancelación con el pago reportado o confirmado deja la devolución
 * pendiente: la hace el restaurante (tiene el dinero) y la marca con su referencia.
 */

export const ESTADOS_PAGO_COMIDA = [
  'esperando_conductor',
  'por_pagar',
  'reportado',
  'confirmado',
  'no_llego',
  'vencido',
  'cancelado',
] as const;
export type EstadoPagoComida = (typeof ESTADOS_PAGO_COMIDA)[number];

/** Los estados en que el cliente ya dijo que pagó: si se cancela, el restaurante devuelve. */
const CON_PAGO_DEL_CLIENTE = new Set(['reportado', 'confirmado', 'no_llego']);

export const cuentaRestaurante = (rid: string) => `restaurante:${rid}`;

export type TiemposPagoComida = { -readonly [K in keyof typeof TIEMPOS_PAGO_COMIDA]: number };
export const tiemposDe = (cfg: ConfigPais): TiemposPagoComida => ({
  ...TIEMPOS_PAGO_COMIDA,
  ...(cfg.pagoComida ?? {}),
});

type FilaPago = {
  pedido_id: string;
  restaurante_id: string;
  cliente_id: string;
  estado: string;
  moneda: string;
  monto: number;
  moneda_ref: string | null;
  monto_ref: number | null;
  tasa: number | null;
  tasa_fecha: string | null;
  vence_en: string | null;
  cuenta_json: string | null;
  referencia: string;
  banco_emisor: string;
  comprobante_clave: string | null;
  reportado_en: string | null;
  confirmado_en: string | null;
  no_llego_en: string | null;
  corregido_en: string | null;
  corregido_restaurante_en: string | null;
  comision_restaurante: number;
  /** C-COMIDA-VE-QUIEN-PAGA: la regla congelada al pedir (NULL en las filas de antes). */
  comision_regla_json: string | null;
  devolucion_estado: string;
  devolucion_referencia: string;
  devolucion_en: string | null;
  creado_en: string;
  /** Calculadas por la consulta. */
  segundos_vence?: number | null;
  a_tiempo_restaurante?: number | null;
  zona_id?: string | null;
  pedido_estado?: string;
  total?: number;
  propina?: number;
  dueno_id?: string;
  repartidor_id?: string | null;
};

const SELECT_PAGO = `SELECT pc.*, p.zona_id, p.estado AS pedido_estado, p.total, p.propina, p.repartidor_id, r.dueno_id,
    CAST((julianday(pc.vence_en) - julianday('now')) * 86400 AS INTEGER) AS segundos_vence,
    (pc.no_llego_en > datetime('now', '-${MINUTOS_CORREGIR_PAGO_MOVIL} minutes')) AS a_tiempo_restaurante
  FROM pagos_comida pc JOIN pedidos p ON p.id = pc.pedido_id JOIN restaurantes r ON r.id = pc.restaurante_id`;

export async function filaPagoComida(db: D1Database, pedidoId: string) {
  return db.prepare(`${SELECT_PAGO} WHERE pc.pedido_id = ?`).bind(pedidoId).first<FilaPago>();
}

/** ¿Este país usa el pago directo al restaurante? EE. UU. nunca (cobra con tarjeta). */
export async function usaPagoRestaurante(db: D1Database, pais: string): Promise<boolean> {
  if (pais === 'US') return false;
  return (await leerConfigPais(db, pais)).comidaPagoRestaurante === true;
}

// ───────────────────────── Cuenta de cobro del restaurante ─────────────────────────

export type CuentaRestaurante = {
  id: string;
  tipo: string;
  banco: string;
  telefono: string;
  documento: string;
  titular: string;
  verificacion: 'declarada' | 'confirmada';
  activa: boolean;
  activaDesde: string;
  vigente: boolean;
  creadoEn: string;
};

/** Un cambio de cuenta entra en vigor a las 24 horas; la primera, al instante. */
export const HORAS_ESPERA_CUENTA_RESTAURANTE = 24;

function aCuentaRestaurante(r: Record<string, unknown>, vigenteId: string | null) {
  return {
    id: String(r.id),
    tipo: String(r.tipo),
    banco: String(r.banco ?? ''),
    telefono: String(r.telefono ?? ''),
    documento: String(r.documento ?? ''),
    titular: String(r.titular ?? ''),
    verificacion: String(r.verificacion) as 'declarada' | 'confirmada',
    activa: Number(r.activa) === 1,
    activaDesde: String(r.activa_desde),
    vigente: String(r.id) === vigenteId,
    creadoEn: String(r.creado_en),
  } satisfies CuentaRestaurante;
}

/** La cuenta que el cliente ve para pagar: la más nueva activa y ya en vigor de ese país. */
export async function cuentaRestauranteVigente(db: D1Database, rid: string, pais: string) {
  const r = await db
    .prepare(
      `SELECT * FROM cuentas_cobro_restaurante WHERE restaurante_id = ? AND pais = ? AND activa = 1
         AND activa_desde <= datetime('now') ORDER BY activa_desde DESC, creado_en DESC LIMIT 1`,
    )
    .bind(rid, pais)
    .first<Record<string, unknown>>();
  return r ? aCuentaRestaurante(r, String(r.id)) : null;
}

export async function cuentasDeRestaurante(db: D1Database, rid: string, pais: string) {
  const vigente = await cuentaRestauranteVigente(db, rid, pais);
  const { results } = await db
    .prepare(
      'SELECT * FROM cuentas_cobro_restaurante WHERE restaurante_id = ? ORDER BY creado_en DESC LIMIT 20',
    )
    .bind(rid)
    .all<Record<string, unknown>>();
  return { vigente, cuentas: results.map((r) => aCuentaRestaurante(r, vigente?.id ?? null)) };
}

export async function crearCuentaRestaurante(
  db: D1Database,
  p: {
    rid: string;
    pais: string;
    moneda: string;
    banco: string;
    telefono: string;
    documento: string;
    titular: string;
    autorId: string;
  },
) {
  const hay = await db
    .prepare(
      'SELECT 1 FROM cuentas_cobro_restaurante WHERE restaurante_id = ? AND activa = 1 LIMIT 1',
    )
    .bind(p.rid)
    .first();
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO cuentas_cobro_restaurante (id, restaurante_id, pais, moneda, tipo, banco, telefono, documento, titular, activa, activa_desde, creado_por)
       VALUES (?, ?, ?, ?, 'pago_movil', ?, ?, ?, ?, 1, datetime('now', ?), ?)`,
    )
    .bind(
      id,
      p.rid,
      p.pais,
      p.moneda,
      p.banco,
      p.telefono,
      p.documento,
      p.titular,
      hay ? `+${HORAS_ESPERA_CUENTA_RESTAURANTE} hours` : '+0 seconds',
      p.autorId,
    )
    .run();
  return { id, enVigorYa: !hay };
}

export async function desactivarCuentaRestaurante(db: D1Database, rid: string, id: string) {
  const r = await db
    .prepare(
      'UPDATE cuentas_cobro_restaurante SET activa = 0 WHERE id = ? AND restaurante_id = ? AND activa = 1',
    )
    .bind(id, rid)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Esa cuenta de cobro no existe.', undefined, 404);
}

/** El equipo revisó la cuenta: entra en vigor ya y queda «confirmada» (nunca «verificada por el banco»). */
export async function confirmarCuentaRestaurante(db: D1Database, rid: string, id: string) {
  const r = await db
    .prepare(
      `UPDATE cuentas_cobro_restaurante SET verificacion = 'confirmada', activa_desde = MIN(activa_desde, datetime('now'))
        WHERE id = ? AND restaurante_id = ?`,
    )
    .bind(id, rid)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Esa cuenta de cobro no existe.', undefined, 404);
}

/** Al pedir: un restaurante sin cuenta para recibir el pago no recibe pedidos de pago directo. */
export async function exigirCuentaRestaurante(db: D1Database, rid: string, pais: string) {
  if (!(await cuentaRestauranteVigente(db, rid, pais)))
    throw new ErrorDatos(
      'Este restaurante todavía no puede recibir pagos por la app. Prueba con otro restaurante.',
      'restauranteId',
      409,
    );
}

// ───────────────────────── Comisión y saldo prepago del restaurante ─────────────────────────

/**
 * C-SALDO-RESTAURANTE: la comisión de Divoox al restaurante por la comida de un pedido. Sale de una
 * política `politicas_financieras` del restaurante (servicio `food`, modalidad prepago) que solo rige
 * con la revisión legal aprobada. Sin política (o en 0 %), cero: «gratis para empezar».
 */
export async function comisionRestauranteDe(
  db: D1Database,
  c: { pais: string; moneda: string; comida: number },
): Promise<number> {
  return comisionConRegla(await reglaComisionRestaurante(db, c), c.comida);
}

/**
 * C-COMIDA-VE-QUIEN-PAGA (23 nov 2026): la regla de la comisión del restaurante que rige AHORA (null
 * = ninguna: 0 %). Se congela en el pago del pedido al pedir, para cobrar al «Me llegó» lo que regía
 * cuando el cliente pidió, aunque la palanca cambie mientras tanto.
 */
export type ComisionCongelada = { regla: ReglaComision; descuentoPb: number } | null;

export async function reglaComisionRestaurante(
  db: D1Database,
  c: { pais: string; moneda: string },
): Promise<ComisionCongelada> {
  const pol = await politicaVigente(db, {
    servicio: 'food',
    tipoCuenta: 'restaurante',
    pais: c.pais,
    moneda: c.moneda,
  });
  if (!pol || pol.modalidad !== 'prepago') return null;
  return { regla: pol.regla, descuentoPb: pol.descuentoPb };
}

/** La comisión de una comida con una regla (congelada o vigente). Sin regla, 0. */
export const comisionConRegla = (cg: ComisionCongelada, comida: number) =>
  cg ? calcularComision(cg.regla, { unidades: 1, valor: comida, descuentoPb: cg.descuentoPb }) : 0;

/** Lo que se guarda en `pagos_comida.comision_regla_json` (nunca NULL en un pago nuevo). */
export const congelarComision = (cg: ComisionCongelada) => JSON.stringify({ congelada: cg });

/** La regla congelada de una fila; `undefined` = fila de antes (sin el dato) o dañada. */
function reglaCongeladaDe(json: string | null | undefined): ComisionCongelada | undefined {
  if (json == null) return undefined;
  try {
    const v = JSON.parse(json) as { congelada?: unknown };
    if (v.congelada === null) return null;
    const r = z
      .object({ regla: esquemaRegla, descuentoPb: z.number().int().min(0).max(10_000) })
      .safeParse(v.congelada);
    if (r.success) return r.data;
  } catch {
    // Se anota abajo y se cobra como las filas de antes: la vigente.
  }
  console.error('pago de la comida: comisión congelada dañada; se usa la vigente', json);
  return undefined;
}

export const saldoRestaurante = (db: D1Database, rid: string, pais: string, moneda: string) =>
  saldoLibro(db, cuentaRestaurante(rid), 'prepago', pais, moneda);

/** Cuántos avisos de «te quedaste sin saldo» como mucho por hora y restaurante. */
const AVISO_SIN_SALDO_POR_HORA = 1;

/**
 * Al pedir: con una comisión mayor que cero y sin saldo para cubrirla, el restaurante no recibe el
 * pedido (409). Se le avisa a su dueño, como mucho una vez por hora, para que recargue.
 */
export async function exigirSaldoRestaurante(
  env: Env,
  db: D1Database,
  p: { rid: string; pais: string; moneda: string; comida: number },
): Promise<ComisionCongelada> {
  const regla = await reglaComisionRestaurante(db, p);
  const comision = comisionConRegla(regla, p.comida);
  if (comision <= 0) return regla;
  if ((await saldoRestaurante(db, p.rid, p.pais, p.moneda)) >= comision) return regla;
  const hora = new Date().toISOString().slice(0, 13);
  const marca = await db
    .prepare(
      `INSERT INTO contadores (clave, n) VALUES (?1, 1)
       ON CONFLICT(clave) DO UPDATE SET n = n + 1 WHERE n < ?2`,
    )
    .bind(`sin-saldo-restaurante:${p.rid}:${hora}`, AVISO_SIN_SALDO_POR_HORA)
    .run();
  if (marca.meta.changes) {
    const d = await db
      .prepare('SELECT dueno_id FROM restaurantes WHERE id = ?')
      .bind(p.rid)
      .first<{ dueno_id: string }>();
    if (d)
      await notificar(env, db, d.dueno_id, (i) => ({
        ...AVISOS_PAGO.sinSaldo(i),
        datos: { tipo: 'saldo_restaurante' },
      })).catch((e: unknown) => console.error('saldo del restaurante: aviso', e));
  }
  throw new ErrorDatos(
    'Este restaurante no está recibiendo pedidos en este momento. Prueba con otro restaurante.',
    'restauranteId',
    409,
  );
}

/**
 * Al confirmar el pago: la comisión del restaurante sale UNA vez de su saldo prepago y entra en las
 * comisiones de Divoox (referencia única). Si no alcanza, el pedido sigue (la comida ya se pagó) y
 * queda un caso para el equipo. Nunca deja el saldo en negativo.
 */
async function cobrarComisionRestaurante(db: D1Database, f: FilaPago, pais: string) {
  // C-COMIDA-VE-QUIEN-PAGA: la regla que regía al pedir (sobre la comida de hoy, por si cambió antes
  // de pagar); las filas de antes, sin el dato, se cobran con la vigente.
  const congelada = reglaCongeladaDe(f.comision_regla_json);
  const comision =
    congelada === undefined
      ? await comisionRestauranteDe(db, { pais, moneda: f.moneda, comida: f.monto })
      : comisionConRegla(congelada, f.monto);
  if (comision <= 0) return 0;
  const ref = `comision-restaurante:${f.pedido_id}`;
  const [descuento] = await db.batch([
    sentenciaDescontar(db, {
      cuentaId: cuentaRestaurante(f.restaurante_id),
      bolsillo: 'prepago',
      pais,
      moneda: f.moneda,
      monto: comision,
      concepto: 'comision_restaurante',
      pedidoId: f.pedido_id,
      referencia: `${ref}:prepago`,
    }),
    db
      .prepare(
        `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, pedido_id, referencia)
         SELECT ?, ?, 'comisiones', ?, ?, ?, 'comision_restaurante', ?, ? WHERE EXISTS (SELECT 1 FROM libro WHERE referencia = ?)`,
      )
      .bind(
        crypto.randomUUID(),
        CUENTA_TUMBITE,
        pais,
        f.moneda,
        comision,
        f.pedido_id,
        `${ref}:tumbite`,
        `${ref}:prepago`,
      ),
    db
      .prepare(
        'UPDATE pagos_comida SET comision_restaurante = ? WHERE pedido_id = ? AND EXISTS (SELECT 1 FROM libro WHERE referencia = ?)',
      )
      .bind(comision, f.pedido_id, `${ref}:prepago`),
  ]);
  if (descuento?.meta.changes) return comision;
  const ya = await db
    .prepare('SELECT 1 FROM libro WHERE referencia = ?')
    .bind(`${ref}:prepago`)
    .first();
  if (ya) return comision;
  await abrirIncidencia(db, {
    tipo: 'comision_restaurante_sin_saldo',
    referencia: `comision-restaurante-sin-saldo:${f.pedido_id}`,
    pedidoId: f.pedido_id,
    cuentaId: cuentaRestaurante(f.restaurante_id),
    pais,
    moneda: f.moneda,
    esperado: comision,
    recibido: 0,
    detalle: `El restaurante no tenía saldo para la comisión del pedido ${f.pedido_id}. La comida ya estaba pagada: el pedido siguió.`,
  });
  return 0;
}

/** Si el pedido se cancela después de cobrar la comisión al restaurante, vuelve a su saldo (una vez). */
async function devolverComisionRestaurante(db: D1Database, f: FilaPago, pais: string) {
  const ref = `comision-restaurante:${f.pedido_id}`;
  const cobrada = await db
    .prepare('SELECT -monto AS monto FROM libro WHERE referencia = ?')
    .bind(`${ref}:prepago`)
    .first<{ monto: number }>();
  const monto = Number(cobrada?.monto ?? 0);
  if (monto <= 0) return;
  await db.batch([
    sentenciaLibro(db, {
      cuentaId: cuentaRestaurante(f.restaurante_id),
      bolsillo: 'prepago',
      pais,
      moneda: f.moneda,
      monto,
      concepto: 'comision_restaurante_devuelta',
      pedidoId: f.pedido_id,
      referencia: `${ref}:devuelta:prepago`,
    }),
    sentenciaLibro(db, {
      cuentaId: CUENTA_TUMBITE,
      bolsillo: 'comisiones',
      pais,
      moneda: f.moneda,
      monto: -monto,
      concepto: 'comision_restaurante_devuelta',
      pedidoId: f.pedido_id,
      referencia: `${ref}:devuelta:tumbite`,
    }),
  ]);
}

// ───────────────────────── El ciclo del pago ─────────────────────────

/** Al crear el pedido (todavía en pago_pendiente): nace esperando a su conductor. */
export async function abrirPagoComida(
  db: D1Database,
  p: {
    pedidoId: string;
    restauranteId: string;
    clienteId: string;
    moneda: string;
    monto: number;
    /** C-COMIDA-VE-QUIEN-PAGA: la comisión del restaurante que regía al pedir. */
    comision: ComisionCongelada;
  },
) {
  if (!Number.isSafeInteger(p.monto) || p.monto <= 0)
    throw new Error(`pago de la comida: monto inválido (${p.monto})`);
  await db
    .prepare(
      `INSERT OR IGNORE INTO pagos_comida (pedido_id, restaurante_id, cliente_id, estado, moneda, monto, comision_regla_json)
       VALUES (?, ?, ?, 'esperando_conductor', ?, ?, ?)`,
    )
    .bind(p.pedidoId, p.restauranteId, p.clienteId, p.moneda, p.monto, congelarComision(p.comision))
    .run();
}

/** Si el pedido no llegó a confirmarse (deuda, interruptor), su pago queda cerrado. */
export async function anularPagoComida(db: D1Database, pedidoId: string) {
  await db
    .prepare(
      "UPDATE pagos_comida SET estado = 'cancelado' WHERE pedido_id = ? AND estado = 'esperando_conductor'",
    )
    .bind(pedidoId)
    .run();
}

/**
 * Hay conductor (o es recogida en el local): se le piden los datos al cliente. Congela el monto en
 * bolívares con la tasa vigente (o la del pedido si hoy no hay) y fija el vencimiento. Idempotente:
 * solo pasa una vez de `esperando_conductor` a `por_pagar`.
 */
export async function pedirPagoComida(env: Env | null, db: D1Database, pedidoId: string) {
  const f = await filaPagoComida(db, pedidoId);
  if (!f || f.estado !== 'esperando_conductor') return false;
  const { pais } = await paisDeZona(db, String(f.zona_id ?? ''));
  const cfg = await leerConfigPais(db, pais);
  const cuenta = await cuentaRestauranteVigente(db, f.restaurante_id, pais);
  if (!cuenta) {
    // El restaurante quitó su cuenta después de recibir el pedido: no hay a dónde pagar.
    if (env) await cancelarPorPago(env, db, f, 'cancelado_sin_cuenta_restaurante');
    return false;
  }
  const ped = await db
    .prepare('SELECT ref_tasa, ref_fecha FROM pedidos WHERE id = ?')
    .bind(pedidoId)
    .first<{ ref_tasa: number | null; ref_fecha: string | null }>();
  const tasa =
    (await tasaParaFijar(db, pais, f.moneda)) ??
    tasaGuardada(pais, ped?.ref_tasa ?? null, ped?.ref_fecha ?? null);
  const minutos = tiemposDe(cfg).minutosPagar;
  const r = await db
    .prepare(
      `UPDATE pagos_comida SET estado = 'por_pagar', moneda_ref = ?, monto_ref = ?, tasa = ?, tasa_fecha = ?,
         vence_en = datetime('now', ?), cuenta_json = ?
       WHERE pedido_id = ? AND estado = 'esperando_conductor'`,
    )
    .bind(
      tasa?.moneda ?? null,
      tasa ? equivalenteLocal(f.monto, tasa.tasa) : null,
      tasa?.tasa ?? null,
      tasa?.fecha ?? null,
      `+${minutos} minutes`,
      JSON.stringify({
        tipo: cuenta.tipo,
        banco: cuenta.banco,
        telefono: cuenta.telefono,
        documento: cuenta.documento,
        titular: cuenta.titular,
      }),
      pedidoId,
    )
    .run();
  if (!r.meta.changes) return false;
  await anotarEvento(db, pedidoId, 'pago_comida_pedido', `${minutos} min`);
  if (env)
    await notificar(env, db, f.cliente_id, (i) => ({
      ...AVISOS_PAGO.paga(i, minutos),
      datos: { pedidoId, tipo: 'pago_comida' },
    })).catch((e: unknown) => console.error('pago de la comida: aviso al cliente', e));
  return true;
}

/** Al aceptar el restaurante: en la recogida en el local no hay conductor que esperar. */
export async function alAceptarRestaurante(env: Env, db: D1Database, pedidoId: string) {
  const recogida = await db
    .prepare(
      "SELECT 1 FROM recogidas rc JOIN pagos_comida pc ON pc.pedido_id = rc.pedido_id WHERE rc.pedido_id = ? AND pc.estado = 'esperando_conductor'",
    )
    .bind(pedidoId)
    .first();
  if (recogida) await pedirPagoComida(env, db, pedidoId);
}

const REFERENCIA = /^[A-Za-z0-9-]{4,30}$/;

/** El cliente escribe la referencia de su pago (o la corrige UNA vez después de un «no me llegó»). */
export async function reportarPagoComida(
  env: Env,
  db: D1Database,
  p: { pedidoId: string; clienteId: string; referencia: string; banco: string },
) {
  const referencia = p.referencia.replace(/\s+/g, '');
  if (!REFERENCIA.test(referencia))
    throw new ErrorDatos(
      'Escribe el número de referencia del pago, como sale en tu banco.',
      'referencia',
      422,
    );
  const f = await filaPagoComida(db, p.pedidoId);
  if (!f || f.cliente_id !== p.clienteId)
    throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  if ((f.estado === 'reportado' || f.estado === 'confirmado') && f.referencia === referencia)
    return f.estado; // doble toque
  if (f.estado === 'esperando_conductor')
    throw new ErrorDatos(
      'Todavía estamos buscando a tu conductor. Te avisamos cuando puedas pagar.',
      undefined,
      409,
    );
  if (f.estado === 'vencido' || f.estado === 'cancelado')
    throw new ErrorDatos('Este pedido se canceló: no hagas el pago.', undefined, 409);
  if (f.estado === 'reportado' || f.estado === 'confirmado')
    throw new ErrorDatos('Ya enviaste la referencia de este pago.', undefined, 409);
  // La misma referencia en otro pedido del mismo restaurante es un error (o un intento de engaño).
  const usada = await db
    .prepare(
      "SELECT 1 FROM pagos_comida WHERE restaurante_id = ? AND referencia = ? AND pedido_id <> ? AND creado_en > datetime('now', '-30 days') LIMIT 1",
    )
    .bind(f.restaurante_id, referencia, p.pedidoId)
    .first();
  if (usada)
    throw new ErrorDatos(
      'Esa referencia ya se usó en otro pedido. Revisa el número de tu pago.',
      'referencia',
      409,
    );
  const banco = p.banco.trim().slice(0, 60);
  let r: D1Result;
  if (f.estado === 'no_llego') {
    if (f.corregido_en)
      throw new ErrorDatos(
        'Ya corregiste la referencia una vez. Escríbenos desde Ayuda y lo revisamos.',
        undefined,
        409,
      );
    r = await db
      .prepare(
        `UPDATE pagos_comida SET estado = 'reportado', referencia = ?, banco_emisor = CASE WHEN ? != '' THEN ? ELSE banco_emisor END,
           corregido_en = datetime('now'), reportado_en = datetime('now')
         WHERE pedido_id = ? AND estado = 'no_llego' AND corregido_en IS NULL`,
      )
      .bind(referencia, banco, banco, p.pedidoId)
      .run();
  } else {
    r = await db
      .prepare(
        `UPDATE pagos_comida SET estado = 'reportado', referencia = ?, banco_emisor = ?, reportado_en = datetime('now')
         WHERE pedido_id = ? AND estado = 'por_pagar' AND vence_en > datetime('now')`,
      )
      .bind(referencia, banco, p.pedidoId)
      .run();
    if (!r.meta.changes && f.estado === 'por_pagar')
      throw new ErrorDatos(
        'Se acabó el tiempo para pagar este pedido. Si ya pagaste, escríbenos desde Ayuda.',
        undefined,
        409,
      );
  }
  if (!r.meta.changes)
    throw new ErrorDatos('El pago cambió. Actualiza la pantalla.', undefined, 409);
  await anotarEvento(
    db,
    p.pedidoId,
    f.estado === 'no_llego' ? 'pago_comida_corregido' : 'pago_comida_reportado',
    `referencia ${referencia}`,
  );
  const corto = p.pedidoId.slice(0, 4).toUpperCase();
  if (f.dueno_id)
    await notificar(env, db, f.dueno_id, (i) => ({
      ...AVISOS_PAGO.revisaTuBanco(i, corto),
      datos: { pedidoId: p.pedidoId, tipo: 'pago_comida' },
    })).catch((e: unknown) => console.error('pago de la comida: aviso al restaurante', e));
  return 'reportado';
}

/**
 * El restaurante mira su banco y responde. «Me llegó» confirma (y, si había comisión, la cobra de su
 * saldo); «No me llegó» abre un caso para el equipo y le dice al cliente que revise. Un «no» se
 * corrige a «sí» UNA vez dentro de 30 minutos (la misma regla del pago móvil del conductor).
 */
export async function responderPagoComida(
  env: Env,
  db: D1Database,
  p: { pedidoId: string; rid: string; actorId: string; llego: boolean },
) {
  const f = await filaPagoComida(db, p.pedidoId);
  if (!f || f.restaurante_id !== p.rid)
    throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  const { pais } = await paisDeZona(db, String(f.zona_id ?? ''));
  if (f.estado === 'esperando_conductor' || f.estado === 'por_pagar')
    throw new ErrorDatos(
      'El cliente todavía no ha enviado la referencia del pago.',
      undefined,
      409,
    );
  if (f.estado === 'vencido' || f.estado === 'cancelado')
    throw new ErrorDatos('Este pedido ya se canceló.', undefined, 409);
  const corto = p.pedidoId.slice(0, 4).toUpperCase();
  if (p.llego) {
    if (f.estado === 'confirmado') return 'confirmado';
    let r: D1Result;
    let corrigio = false;
    if (f.estado === 'reportado') {
      r = await db
        .prepare(
          `UPDATE pagos_comida SET estado = 'confirmado', confirmado_en = datetime('now'), confirmado_por = ?
           WHERE pedido_id = ? AND estado = 'reportado'`,
        )
        .bind(p.actorId, p.pedidoId)
        .run();
    } else {
      const decision = decidirPagoMovil(
        {
          estado: 'no_recibido',
          corregido_en: f.corregido_restaurante_en,
          a_tiempo: Number(f.a_tiempo_restaurante ?? 0),
        },
        true,
      );
      if (decision !== 'corregir')
        throw new ErrorDatos(
          'Ya respondiste este pago. Si hay que cambiarlo, escribe a soporte desde Ayuda.',
          undefined,
          409,
        );
      corrigio = true;
      r = await db
        .prepare(
          `UPDATE pagos_comida SET estado = 'confirmado', confirmado_en = datetime('now'), confirmado_por = ?,
             corregido_restaurante_en = datetime('now')
           WHERE pedido_id = ? AND estado = 'no_llego' AND corregido_restaurante_en IS NULL
             AND no_llego_en > datetime('now', '-${MINUTOS_CORREGIR_PAGO_MOVIL} minutes')`,
        )
        .bind(p.actorId, p.pedidoId)
        .run();
    }
    if (!r.meta.changes)
      throw new ErrorDatos('El pago cambió. Actualiza la pantalla.', undefined, 409);
    await db
      .prepare(
        `UPDATE incidencias_dinero SET estado = 'resuelta', resuelta_en = datetime('now'), detalle = detalle || ?
         WHERE referencia = ? AND estado = 'abierta'`,
      )
      .bind(
        ' Nota: el restaurante confirmó que le llegó el pago; el caso se cerró solo.',
        `pago-comida:${p.pedidoId}`,
      )
      .run();
    // Confirmación MANUAL del restaurante mirando su banco: nunca «verificado por el banco».
    await anotarEvento(
      db,
      p.pedidoId,
      corrigio ? 'pago_comida_confirmado_corregido' : 'pago_comida_confirmado',
      `confirmación manual del restaurante ${p.actorId}`,
    );
    await cobrarComisionRestaurante(db, f, pais);
    await notificar(env, db, f.cliente_id, (i) => ({
      ...AVISOS_PAGO.confirmado(i),
      datos: { pedidoId: p.pedidoId, tipo: 'pago_comida' },
    })).catch((e: unknown) => console.error('pago de la comida: aviso al cliente', e));
    if (f.repartidor_id)
      await notificar(env, db, f.repartidor_id, (i) => ({
        ...AVISOS_PAGO.yaPuedesIr(i, corto),
        datos: { pedidoId: p.pedidoId, tipo: 'pago_comida' },
      })).catch((e: unknown) => console.error('pago de la comida: aviso al conductor', e));
    return 'confirmado';
  }
  if (f.estado === 'no_llego') return 'no_llego';
  if (f.estado === 'confirmado')
    throw new ErrorDatos(
      'Ya respondiste este pago. Si hay que cambiarlo, escribe a soporte desde Ayuda.',
      undefined,
      409,
    );
  const r = await db
    .prepare(
      "UPDATE pagos_comida SET estado = 'no_llego', no_llego_en = datetime('now') WHERE pedido_id = ? AND estado = 'reportado'",
    )
    .bind(p.pedidoId)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('El pago cambió. Actualiza la pantalla.', undefined, 409);
  const detalle = `El restaurante dice que no le llegó el pago de la comida del pedido ${p.pedidoId} (referencia ${f.referencia}).`;
  await abrirIncidencia(db, {
    tipo: 'pago_comida',
    referencia: `pago-comida:${p.pedidoId}`,
    pedidoId: p.pedidoId,
    cuentaId: f.cliente_id,
    pais,
    moneda: f.moneda,
    esperado: f.monto,
    recibido: 0,
    detalle,
  });
  // Un segundo «no» (después de que el cliente corrigió) vuelve a abrir el mismo caso.
  await db
    .prepare(
      `UPDATE incidencias_dinero SET estado = 'abierta', resuelta_en = NULL, detalle = detalle || ?
       WHERE referencia = ? AND estado = 'resuelta'`,
    )
    .bind(` Otra vez: ${detalle}`, `pago-comida:${p.pedidoId}`)
    .run();
  await anotarEvento(db, p.pedidoId, 'pago_comida_no_llego', `referencia ${f.referencia}`);
  await notificar(env, db, f.cliente_id, (i) => ({
    ...AVISOS_PAGO.noLlego(i, !f.corregido_en),
    datos: { pedidoId: p.pedidoId, tipo: 'pago_comida' },
  })).catch((e: unknown) => console.error('pago de la comida: aviso al cliente', e));
  return 'no_llego';
}

/** El restaurante ya le devolvió el dinero al cliente: lo marca con la referencia de su devolución. */
export async function marcarDevolucionHecha(
  env: Env,
  db: D1Database,
  p: { pedidoId: string; rid: string; referencia: string },
) {
  const referencia = p.referencia.replace(/\s+/g, '');
  if (!REFERENCIA.test(referencia))
    throw new ErrorDatos(
      'Escribe el número de referencia de la devolución, como sale en tu banco.',
      'referencia',
      422,
    );
  const f = await filaPagoComida(db, p.pedidoId);
  if (!f || f.restaurante_id !== p.rid)
    throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  if (f.devolucion_estado === 'hecha') return;
  if (f.devolucion_estado !== 'pendiente')
    throw new ErrorDatos('Este pedido no tiene una devolución pendiente.', undefined, 409);
  const r = await db
    .prepare(
      `UPDATE pagos_comida SET devolucion_estado = 'hecha', devolucion_referencia = ?, devolucion_en = datetime('now')
       WHERE pedido_id = ? AND devolucion_estado = 'pendiente'`,
    )
    .bind(referencia, p.pedidoId)
    .run();
  if (!r.meta.changes) return;
  await db
    .prepare(
      `UPDATE incidencias_dinero SET estado = 'resuelta', resuelta_en = datetime('now'), detalle = detalle || ?
       WHERE referencia = ? AND estado = 'abierta'`,
    )
    .bind(
      ` Nota: el restaurante marcó la devolución hecha (referencia ${referencia}). Confirmar con el cliente si hace falta.`,
      `devolucion-comida:${p.pedidoId}`,
    )
    .run();
  await anotarEvento(db, p.pedidoId, 'devolucion_comida_hecha', `referencia ${referencia}`);
  await notificar(env, db, f.cliente_id, (i) => ({
    ...AVISOS_PAGO.devuelto(i),
    datos: { pedidoId: p.pedidoId, tipo: 'pago_comida' },
  })).catch((e: unknown) => console.error('pago de la comida: aviso de devolución', e));
}

/**
 * Se canceló el pedido (por cualquier camino: soporte, el Manager, el restaurante). Lo llama
 * `cancelarConReembolso`. Si el cliente ya había pagado (reportado, confirmado o en revisión), la
 * devolución queda PENDIENTE: la hace el restaurante, con caso para el equipo y aviso a los dos.
 */
export async function alCancelarPedido(env: Env, db: D1Database, pedidoId: string) {
  const f = await filaPagoComida(db, pedidoId);
  if (!f) return;
  const { pais } = await paisDeZona(db, String(f.zona_id ?? ''));
  if (CON_PAGO_DEL_CLIENTE.has(f.estado)) {
    const r = await db
      .prepare(
        "UPDATE pagos_comida SET estado = 'cancelado', devolucion_estado = 'pendiente' WHERE pedido_id = ? AND estado = ?",
      )
      .bind(pedidoId, f.estado)
      .run();
    if (!r.meta.changes) return;
    await devolverComisionRestaurante(db, f, pais);
    await abrirIncidencia(db, {
      tipo: 'devolucion_comida',
      referencia: `devolucion-comida:${pedidoId}`,
      pedidoId,
      cuentaId: f.cliente_id,
      pais,
      moneda: f.moneda,
      esperado: f.monto,
      recibido: 0,
      detalle: `Pedido ${pedidoId} cancelado con el pago de la comida ${f.estado === 'confirmado' ? 'confirmado por el restaurante' : 'reportado por el cliente'} (referencia ${f.referencia}). El restaurante tiene que devolverle al cliente lo que pagó; Divoox no tuvo ese dinero.`,
    });
    await anotarEvento(db, pedidoId, 'devolucion_comida_pendiente', f.estado);
    const corto = pedidoId.slice(0, 4).toUpperCase();
    if (f.dueno_id)
      await notificar(env, db, f.dueno_id, (i) => ({
        ...AVISOS_PAGO.devuelve(i, corto),
        datos: { pedidoId, tipo: 'pago_comida' },
      })).catch((e: unknown) => console.error('pago de la comida: aviso de devolver', e));
    await notificar(env, db, f.cliente_id, (i) => ({
      ...AVISOS_PAGO.teDevuelven(i),
      datos: { pedidoId, tipo: 'pago_comida' },
    })).catch((e: unknown) => console.error('pago de la comida: aviso al cliente', e));
    return;
  }
  if (f.estado === 'esperando_conductor' || f.estado === 'por_pagar')
    await db
      .prepare("UPDATE pagos_comida SET estado = 'cancelado' WHERE pedido_id = ? AND estado = ?")
      .bind(pedidoId, f.estado)
      .run();
}

async function cancelarPorPago(env: Env, db: D1Database, f: FilaPago, evento: string) {
  const ok = await cancelarConReembolso(env, db, f.pedido_id, {
    desde: ['pagado', 'aceptado', 'listo'],
    actorId: null,
  });
  if (!ok) return false;
  await anotarEvento(db, f.pedido_id, evento);
  const corto = f.pedido_id.slice(0, 4).toUpperCase();
  const motivo =
    evento === 'cancelado_sin_conductor'
      ? 'sin_conductor'
      : evento === 'cancelado_pago_vencido'
        ? 'pago_vencido'
        : evento === 'cancelado_restaurante_no_confirmo'
          ? 'restaurante_no_confirmo'
          : 'sin_cuenta';
  await notificar(env, db, f.cliente_id, (i) => ({
    ...AVISOS_PAGO.cancelado(i, motivo),
    datos: { pedidoId: f.pedido_id, tipo: 'pago_comida' },
  })).catch((e: unknown) => console.error('pago de la comida: aviso de cancelación', e));
  if (f.dueno_id)
    await notificar(env, db, f.dueno_id, (i) => ({
      ...AVISOS_PAGO.canceladoRestaurante(i, corto, motivo),
      datos: { pedidoId: f.pedido_id, tipo: 'pago_comida' },
    })).catch((e: unknown) => console.error('pago de la comida: aviso de cancelación', e));
  if (f.repartidor_id)
    await notificar(env, db, f.repartidor_id, (i) => ({
      ...AVISOS_PAGO.canceladoConductor(i, corto),
      datos: { pedidoId: f.pedido_id, tipo: 'pago_comida' },
    })).catch((e: unknown) => console.error('pago de la comida: aviso de cancelación', e));
  return true;
}

/** Cuántas filas puede escribir una vuelta del vigilante (cancelaciones con su libro, casos y avisos). */
export const ESCRITURAS_VIGILANTE_PAGO_COMIDA = 600;

/**
 * El vigilante de los tiempos (reloj cada minuto y el seguimiento del cliente). Con pedidoId, solo
 * mira ese pedido. Como mucho 50 pagos por vuelta; mirar no escribe nada. CROSS JOIN a propósito
 * (C-LECTURAS-VUELTA-RUTAS): la consulta arranca por el índice de estado de `pagos_comida` (pocas
 * filas vivas) y no por los miles de pedidos en curso.
 */
export async function vigilarPagosComida(env: Env, db: D1Database, pedidoId?: string) {
  const solo = pedidoId ? ' AND pc.pedido_id = ?' : '';
  const { results } = await db
    .prepare(
      `SELECT pc.*, p.zona_id, p.estado AS pedido_estado, p.repartidor_id, r.dueno_id,
         CAST((julianday('now') - julianday(p.aceptado_en)) * 1440 AS INTEGER) AS min_aceptado,
         (pc.vence_en <= datetime('now')) AS vencido,
         CAST((julianday('now') - julianday(pc.reportado_en)) * 1440 AS INTEGER) AS min_reportado,
         EXISTS (SELECT 1 FROM recogidas rc WHERE rc.pedido_id = pc.pedido_id) AS recogida
       FROM pagos_comida pc CROSS JOIN pedidos p ON p.id = pc.pedido_id CROSS JOIN restaurantes r ON r.id = pc.restaurante_id
       WHERE pc.estado IN ('esperando_conductor', 'por_pagar', 'reportado') AND p.estado IN ('aceptado', 'listo')${solo}
       ORDER BY pc.creado_en LIMIT 50`,
    )
    .bind(...(pedidoId ? [pedidoId] : []))
    .all<
      FilaPago & {
        min_aceptado: number | null;
        vencido: number | null;
        min_reportado: number | null;
        recogida: number;
      }
    >();
  const configs = new Map<string, TiemposPagoComida>();
  let hechos = 0;
  for (const f of results) {
    try {
      const { pais } = await paisDeZona(db, String(f.zona_id ?? ''));
      let t = configs.get(pais);
      if (!t) {
        t = tiemposDe(await leerConfigPais(db, pais));
        configs.set(pais, t);
      }
      if (f.estado === 'esperando_conductor') {
        if (f.repartidor_id || Number(f.recogida) === 1) {
          // Ya hay conductor (o es recogida) y el pago no se pidió (se cortó): se pide ahora.
          if (await pedirPagoComida(env, db, f.pedido_id)) hechos++;
        } else if (Number(f.min_aceptado ?? 0) >= t.minutosConductor) {
          if (await cancelarPorPago(env, db, f, 'cancelado_sin_conductor')) hechos++;
        }
        continue;
      }
      if (f.estado === 'por_pagar') {
        if (Number(f.vencido) !== 1) continue;
        const r = await db
          .prepare(
            "UPDATE pagos_comida SET estado = 'vencido' WHERE pedido_id = ? AND estado = 'por_pagar' AND vence_en <= datetime('now')",
          )
          .bind(f.pedido_id)
          .run();
        if (r.meta.changes && (await cancelarPorPago(env, db, f, 'cancelado_pago_vencido')))
          hechos++;
        continue;
      }
      // reportado: el restaurante no responde.
      const min = Number(f.min_reportado ?? 0);
      if (min >= t.minutosConfirmar) {
        if (await cancelarPorPago(env, db, f, 'cancelado_restaurante_no_confirmo')) hechos++;
        continue;
      }
      const aviso =
        min >= t.avisoConfirmar2
          ? 'pago_comida_aviso_2'
          : min >= t.avisoConfirmar1
            ? 'pago_comida_aviso_1'
            : null;
      if (aviso && (await anotarEvento(db, f.pedido_id, aviso, `${min} min`))) {
        hechos++;
        await db
          .prepare('UPDATE pagos_comida SET recordatorios = recordatorios + 1 WHERE pedido_id = ?')
          .bind(f.pedido_id)
          .run();
        const corto = f.pedido_id.slice(0, 4).toUpperCase();
        const quedan = Math.max(1, t.minutosConfirmar - min);
        if (f.dueno_id)
          await notificar(env, db, f.dueno_id, (i) => ({
            ...AVISOS_PAGO.recordatorio(i, corto, quedan),
            datos: { pedidoId: f.pedido_id, tipo: 'pago_comida' },
          })).catch((e: unknown) => console.error('pago de la comida: recordatorio', e));
      }
    } catch (e) {
      // Un pago con problema no frena la vuelta: queda en el registro y se reintenta en la próxima.
      console.error('pago de la comida: vigilante', f.pedido_id, e);
    }
  }
  return hechos;
}

/** ¿Se puede preparar, marcar listo o recoger? Solo con el pago confirmado por el restaurante. */
export async function exigirPagoComidaConfirmado(db: D1Database, pedidoId: string) {
  const f = await db
    .prepare('SELECT estado FROM pagos_comida WHERE pedido_id = ?')
    .bind(pedidoId)
    .first<{ estado: string }>();
  if (f && f.estado !== 'confirmado')
    throw new ErrorDatos(
      'El restaurante todavía no confirmó que le llegó el pago del cliente.',
      undefined,
      409,
    );
  return Boolean(f);
}

/** ¿Este pedido es de pago directo al restaurante? (una lectura por llave). */
export async function esPagoComida(db: D1Database, pedidoId: string) {
  return Boolean(
    await db.prepare('SELECT 1 FROM pagos_comida WHERE pedido_id = ?').bind(pedidoId).first(),
  );
}

/** La parte del cobro en mano que va al restaurante (0 si el pedido no es de pago directo). */
export async function comidaAlRestaurante(db: D1Database, pedidoId: string): Promise<number> {
  const f = await db
    .prepare('SELECT monto FROM pagos_comida WHERE pedido_id = ?')
    .bind(pedidoId)
    .first<{ monto: number }>();
  return Number(f?.monto ?? 0);
}

/** Las filas de varios pedidos en una sola consulta (para las listas). */
export async function pagosComidaDe(db: D1Database, ids: string[]) {
  const mapa = new Map<string, FilaPago>();
  if (!ids.length) return mapa;
  for (let i = 0; i < ids.length; i += 50) {
    const bloque = ids.slice(i, i + 50);
    const { results } = await db
      .prepare(`${SELECT_PAGO} WHERE pc.pedido_id IN (${bloque.map(() => '?').join(',')})`)
      .bind(...bloque)
      .all<FilaPago>();
    for (const r of results) mapa.set(r.pedido_id, r);
  }
  return mapa;
}

export type RolVista = 'cliente' | 'restaurante' | 'conductor' | 'admin';

/** Lo que cada quien ve del pago. La cuenta del restaurante solo la ven el cliente y el equipo. */
export function vistaPagoComida(f: FilaPago, rol: RolVista) {
  const cuenta = f.cuenta_json ? (JSON.parse(f.cuenta_json) as Record<string, string>) : null;
  const venceEn = f.vence_en ? `${f.vence_en.replace(' ', 'T')}Z` : null;
  const enMano = Number(f.total ?? 0) - Number(f.propina ?? 0) - f.monto;
  return {
    estado: f.estado as EstadoPagoComida,
    moneda: f.moneda,
    comida: f.monto,
    envioAlConductor: Math.max(0, enMano),
    montoLocal:
      f.moneda_ref && f.monto_ref != null && f.tasa
        ? {
            moneda: f.moneda_ref,
            monto: Number(f.monto_ref),
            tasa: Number(f.tasa),
            fecha: String(f.tasa_fecha ?? '').slice(0, 10),
          }
        : null,
    venceEn: f.estado === 'por_pagar' ? venceEn : null,
    segundosParaVencer:
      f.estado === 'por_pagar' ? Math.max(0, Number(f.segundos_vence ?? 0)) : null,
    cuenta:
      (rol === 'cliente' || rol === 'admin') &&
      cuenta &&
      ['por_pagar', 'reportado', 'no_llego'].includes(f.estado)
        ? {
            tipo: cuenta.tipo ?? 'pago_movil',
            banco: cuenta.banco ?? '',
            telefono: cuenta.telefono ?? '',
            documento: cuenta.documento ?? '',
            titular: cuenta.titular ?? '',
          }
        : null,
    referencia: rol === 'conductor' ? null : f.referencia || null,
    bancoEmisor: rol === 'conductor' ? null : f.banco_emisor || null,
    conComprobante: rol === 'conductor' ? false : Boolean(f.comprobante_clave),
    reportadoEn: f.reportado_en,
    confirmadoEn: f.confirmado_en,
    noLlegoEn: f.no_llego_en,
    // El cliente corrige la referencia UNA vez después de un «no me llegó».
    puedeCorregir: rol !== 'conductor' && f.estado === 'no_llego' && !f.corregido_en,
    // El restaurante corrige su «no» a «sí» UNA vez dentro de 30 minutos.
    puedeCorregirRestaurante:
      f.estado === 'no_llego' &&
      !f.corregido_restaurante_en &&
      Number(f.a_tiempo_restaurante ?? 0) === 1,
    listoParaIr: f.estado === 'confirmado',
    devolucion:
      f.devolucion_estado === 'no_aplica'
        ? null
        : {
            estado: f.devolucion_estado as 'pendiente' | 'hecha',
            referencia: f.devolucion_referencia || null,
            en: f.devolucion_en,
          },
  };
}

export async function vistaDePedido(db: D1Database, pedidoId: string, rol: RolVista) {
  const f = await filaPagoComida(db, pedidoId);
  return f ? vistaPagoComida(f, rol) : null;
}

/**
 * C-COMIDA-PAGO-RESTAURANTE: pieza `pagoComida` de /datos/salud. Rojo si algún pago quedó atascado
 * (el vigilante no lo cerró): por pagar y vencido hace más de 10 minutos, reportado sin respuesta hace
 * más de 30 o esperando conductor con el pedido aceptado hace más de una hora. Una sola lectura por el
 * índice de estado; no escribe.
 */
export async function saludPagoComida(db: D1Database): Promise<'ok' | 'error'> {
  const f = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM pagos_comida WHERE estado = 'por_pagar' AND vence_en <= datetime('now', '-10 minutes'))
       + (SELECT COUNT(*) FROM pagos_comida WHERE estado = 'reportado' AND reportado_en <= datetime('now', '-30 minutes'))
       + (SELECT COUNT(*) FROM pagos_comida pc CROSS JOIN pedidos p ON p.id = pc.pedido_id
           WHERE pc.estado = 'esperando_conductor' AND p.estado IN ('aceptado', 'listo')
             AND p.aceptado_en <= datetime('now', '-60 minutes')) AS n`,
    )
    .first<{ n: number }>();
  return Number(f?.n ?? 0) > 0 ? 'error' : 'ok';
}

// ───────────────────────── Avisos (siempre en el idioma de cada aparato) ─────────────────────────

type Motivo = 'sin_conductor' | 'pago_vencido' | 'restaurante_no_confirmo' | 'sin_cuenta';

export const AVISOS_PAGO = {
  paga: (i: string, min: number) =>
    i === 'en'
      ? {
          titulo: 'Your driver is assigned: pay for your food',
          cuerpo: `Pay the restaurant by mobile payment and enter the reference number. You have ${min} minutes.`,
        }
      : {
          titulo: 'Ya tienes conductor: paga tu comida',
          cuerpo: `Paga al restaurante por pago móvil y escribe el número de referencia. Tienes ${min} minutos.`,
        },
  revisaTuBanco: (i: string, corto: string) =>
    i === 'en'
      ? {
          titulo: `Order #${corto}: check your bank`,
          cuerpo:
            'The customer says they paid. Check YOUR bank (not the photo) and tap “It arrived” or “It didn’t arrive.”',
        }
      : {
          titulo: `Pedido #${corto}: revisa tu banco`,
          cuerpo:
            'El cliente dice que ya pagó. Mira TU banco (no la foto) y toca «Me llegó» o «No me llegó».',
        },
  recordatorio: (i: string, corto: string, min: number) =>
    i === 'en'
      ? {
          titulo: `Order #${corto} is waiting for you`,
          cuerpo: `Confirm the customer’s payment in your bank. If you don’t answer within ${min} minutes, the order will be canceled.`,
        }
      : {
          titulo: `El pedido #${corto} te está esperando`,
          cuerpo: `Confirma en tu banco el pago del cliente. Si no respondes en ${min} minutos, el pedido se cancela.`,
        },
  confirmado: (i: string) =>
    i === 'en'
      ? {
          titulo: 'The restaurant received your payment',
          cuerpo: 'They’re preparing your order. You pay the delivery to your driver.',
        }
      : {
          titulo: 'El restaurante recibió tu pago',
          cuerpo: 'Ya están preparando tu pedido. El envío se lo pagas a tu conductor.',
        },
  yaPuedesIr: (i: string, corto: string) =>
    i === 'en'
      ? {
          titulo: `Order #${corto}: you can head to the restaurant`,
          cuerpo: 'The customer’s payment was confirmed. You only collect the delivery fee.',
        }
      : {
          titulo: `Pedido #${corto}: ya puedes ir al restaurante`,
          cuerpo: 'El pago del cliente está confirmado. Tú cobras solo el envío.',
        },
  noLlego: (i: string, puedeCorregir: boolean) =>
    i === 'en'
      ? {
          titulo: 'The restaurant doesn’t see your payment',
          cuerpo: puedeCorregir
            ? 'Check the reference number and correct it in the app. Our team is reviewing it.'
            : 'Our team is reviewing it. Write to us from Help if you need anything.',
        }
      : {
          titulo: 'El restaurante no ve tu pago',
          cuerpo: puedeCorregir
            ? 'Revisa el número de referencia y corrígelo en la app. Nuestro equipo lo está revisando.'
            : 'Nuestro equipo lo está revisando. Escríbenos desde Ayuda si necesitas algo.',
        },
  devuelve: (i: string, corto: string) =>
    i === 'en'
      ? {
          titulo: `Order #${corto} was canceled: refund the customer`,
          cuerpo:
            'The customer had already paid you for the food. Send it back and mark the refund with its reference.',
        }
      : {
          titulo: `Se canceló el pedido #${corto}: devuélvele al cliente`,
          cuerpo:
            'El cliente ya te había pagado la comida. Devuélvesela y marca la devolución con su referencia.',
        },
  teDevuelven: (i: string) =>
    i === 'en'
      ? {
          titulo: 'Your order was canceled',
          cuerpo:
            'The restaurant has to send back what you paid for the food. Our team is following up.',
        }
      : {
          titulo: 'Tu pedido se canceló',
          cuerpo:
            'El restaurante tiene que devolverte lo que pagaste por la comida. Nuestro equipo le hace seguimiento.',
        },
  devuelto: (i: string) =>
    i === 'en'
      ? {
          titulo: 'The restaurant refunded you',
          cuerpo: 'Check your bank. If it didn’t arrive, write to us from Help.',
        }
      : {
          titulo: 'El restaurante te devolvió el dinero',
          cuerpo: 'Revisa tu banco. Si no te llegó, escríbenos desde Ayuda.',
        },
  cancelado: (i: string, motivo: Motivo) => {
    const en = {
      sin_conductor: 'We couldn’t find a driver in time. You didn’t pay anything.',
      pago_vencido: 'The time to pay ran out. Don’t make the payment.',
      restaurante_no_confirmo:
        'The restaurant didn’t confirm your payment in time. It has to refund you and our team is following up.',
      sin_cuenta: 'The restaurant can’t receive payments right now. You didn’t pay anything.',
    } satisfies Record<Motivo, string>;
    const es = {
      sin_conductor: 'No encontramos conductor a tiempo. No pagaste nada.',
      pago_vencido: 'Se acabó el tiempo para pagar. No hagas el pago.',
      restaurante_no_confirmo:
        'El restaurante no confirmó tu pago a tiempo. Te lo tiene que devolver y nuestro equipo le hace seguimiento.',
      sin_cuenta: 'El restaurante no puede recibir pagos ahora mismo. No pagaste nada.',
    } satisfies Record<Motivo, string>;
    return i === 'en'
      ? { titulo: 'Your order was canceled', cuerpo: new Map(Object.entries(en)).get(motivo) ?? '' }
      : { titulo: 'Tu pedido se canceló', cuerpo: new Map(Object.entries(es)).get(motivo) ?? '' };
  },
  canceladoRestaurante: (i: string, corto: string, motivo: Motivo) => {
    const en = {
      sin_conductor: 'No driver took it in time. The customer didn’t pay.',
      pago_vencido: 'The customer didn’t pay in time.',
      restaurante_no_confirmo:
        'You didn’t confirm the payment in time. If it arrived, refund the customer and mark it in the app.',
      sin_cuenta: 'You don’t have an account to receive payments. Add it in the app.',
    } satisfies Record<Motivo, string>;
    const es = {
      sin_conductor: 'Ningún conductor lo tomó a tiempo. El cliente no pagó.',
      pago_vencido: 'El cliente no pagó a tiempo.',
      restaurante_no_confirmo:
        'No confirmaste el pago a tiempo. Si te llegó, devuélveselo al cliente y márcalo en la app.',
      sin_cuenta: 'No tienes una cuenta para recibir pagos. Agrégala en la app.',
    } satisfies Record<Motivo, string>;
    return i === 'en'
      ? {
          titulo: `Order #${corto} was canceled`,
          cuerpo: new Map(Object.entries(en)).get(motivo) ?? '',
        }
      : {
          titulo: `Se canceló el pedido #${corto}`,
          cuerpo: new Map(Object.entries(es)).get(motivo) ?? '',
        };
  },
  canceladoConductor: (i: string, corto: string) =>
    i === 'en'
      ? {
          titulo: `Order #${corto} was canceled`,
          cuerpo: 'The customer’s payment didn’t go through. You’re free for the next one.',
        }
      : {
          titulo: `Se canceló el pedido #${corto}`,
          cuerpo: 'El pago del cliente no se completó. Quedas libre para el siguiente.',
        },
  sinSaldo: (i: string) =>
    i === 'en'
      ? {
          titulo: 'Your balance ran out',
          cuerpo:
            'Customers can’t order from you until you top up your balance. Top up in the app.',
        }
      : {
          titulo: 'Te quedaste sin saldo',
          cuerpo: 'Los clientes no pueden pedirte hasta que recargues tu saldo. Recarga en la app.',
        },
} as const;
