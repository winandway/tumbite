import { equivalenteLocal, telefonoCanonico } from '@tumbite/compartido';
import { correosEquipo } from './avisosEquipo';
import { cuantosHay, disparadoresPresentes } from './canarioLecturas';
import { DISPARADORES_AGENTE } from './esquemaAgentes';
import { enviarCorreo } from './correo';
import { nuevoId } from './cripto';
import type { Env } from './env';
import { leerConfigPais } from './internacional/paises';
import { saldoLibro } from './internacional/libro';
import { SOLO_LO_COBRADO } from './liquidaciones';
import { notificar } from './notificaciones';
import { resolverCodigo } from './programaReferidos';
import { tasaVigente } from './rutas/tasasReferencia';
import { cuentaDeConductor } from './saldoConductores';
import { ErrorDatos } from './validar';

/**
 * C-AGENTE-DIVOOX (18 nov 2026) — todos los países con prepago; arranca en Venezuela.
 * El «Agente Divoox» paga en efectivo las ganancias de los conductores y les vende saldo, como los
 * agentes de M-Pesa o los corresponsales bancarios [DOC] (ficha:
 * docs/investigaciones-rea/2026-11-18-agente-divoox-redes-de-agentes.md).
 *
 * El dinero se mueve SOLO con sentencias únicas y disparadores de la base (schema.sql):
 * - pedir el código aparta el monto de las ganancias (`cobros_efectivo_aparta`);
 * - vencer o cancelar lo devuelve una sola vez (`cobros_efectivo_devuelve`);
 * - pagar baja el fondo del agente en la misma sentencia (`cobros_efectivo_paga`), y la sentencia
 *   solo entra si el código sigue vivo, hay fondo y no se pasa ningún tope;
 * - vender saldo acredita al conductor y sube la deuda del agente juntos (`ventas_saldo_agente_acredita`).
 * La ganancia del agente NO vive en el sistema (decisión de Richard): aquí no hay comisiones.
 */
export const HORAS_COBRO = 24;
/** Códigos mal escritos seguidos que bloquean los pagos del agente hasta que el equipo lo revise. */
export const MAX_CODIGOS_FALLIDOS = 5;
/** Tiempo que vale haber buscado a un conductor para venderle saldo o ver su foto. */
export const MINUTOS_BUSQUEDA = 15;
/** Búsquedas de conductor sin resultado, por agente y por hora, antes de frenarlo. */
export const MAX_BUSQUEDAS_FALLIDAS = 10;
/** Lo menos que vende un agente de una vez (1 dólar), aunque el país permita menos. */
export const VENTA_MINIMA = 100;

/** Lo más alto que el equipo puede configurar (centavos de dólar). Nada pasa de aquí por código. */
export const TOPES_AGENTE = {
  pagoMaximo: 50_000,
  diaMaximo: 300_000,
  ventaMaxima: 50_000,
  deudaMaxima: 300_000,
  /** Lo más que se anota de una vez en el fondo de un agente. */
  anotacionMaxima: 500_000,
  conductorDiaMaximo: 100_000,
  minimoMaximo: 5_000,
} as const;

const ahoraSql = "datetime('now')";
const HOY = "datetime('now', '-1 day')";

export type Agente = {
  id: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  idioma: string;
  zona_id: string;
  direccion: string;
  horario: string;
  estado: string;
  tope_pago: number;
  tope_dia: number;
  tope_venta: number;
  tope_deuda: number;
  aviso_fondo: number;
  codigos_fallidos: number;
  bloqueado_en: string | null;
};

export const COLUMNAS_AGENTE =
  'a.id, a.nombre, a.correo, a.telefono, a.idioma, a.zona_id, a.direccion, a.horario, a.estado, a.tope_pago, a.tope_dia, a.tope_venta, a.tope_deuda, a.aviso_fondo, a.codigos_fallidos, a.bloqueado_en';

export async function anotarAccion(
  db: D1Database,
  agenteId: string,
  accion: string,
  objeto = '',
  detalle = '',
  ip = '',
) {
  await db
    .prepare(
      'INSERT INTO agente_acciones (agente_id, accion, objeto, detalle, ip) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(agenteId, accion, objeto.slice(0, 80), detalle.slice(0, 200), ip.slice(0, 60))
    .run();
}

async function saldoAgente(db: D1Database, agenteId: string, cuenta: 'fondo' | 'deuda') {
  const f = await db
    .prepare(
      'SELECT COALESCE(SUM(monto), 0) AS s FROM agente_libro WHERE agente_id = ? AND cuenta = ?',
    )
    .bind(agenteId, cuenta)
    .first<{ s: number }>();
  return Number(f?.s ?? 0);
}

/** La ciudad: si el servicio está encendido, en qué se paga, el mínimo y el tope diario por conductor. */
export async function ciudadAgentes(db: D1Database, zonaId: string) {
  const f = await db
    .prepare(
      `SELECT z.nombre, z.pais, z.moneda, c.activo, c.paga_en, c.minimo, c.tope_conductor_dia
         FROM zonas z LEFT JOIN agentes_ciudad c ON c.zona_id = z.id WHERE z.id = ?`,
    )
    .bind(zonaId)
    .first<{
      nombre: string;
      pais: string;
      moneda: string;
      activo: number | null;
      paga_en: string | null;
      minimo: number | null;
      tope_conductor_dia: number | null;
    }>();
  if (!f) throw new ErrorDatos('Una de las ciudades no existe.', 'zonaId', 422);
  return {
    zonaId,
    nombre: f.nombre,
    pais: f.pais,
    moneda: f.moneda,
    activo: Number(f.activo ?? 0) === 1,
    pagaEn: (f.paga_en === 'VES' ? 'VES' : 'USD') as 'USD' | 'VES',
    minimo: Number(f.minimo ?? 500),
    topeConductorDia: Number(f.tope_conductor_dia ?? 20_000),
  };
}

/**
 * Lo que se entrega en la mano: dólares enteros, o bolívares exactos a la tasa del día (que queda
 * fijada con la operación). Sin tasa vigente, una ciudad que paga en bolívares no puede operar.
 */
async function enMano(db: D1Database, pais: string, pagaEn: 'USD' | 'VES', monto: number) {
  if (pagaEn === 'USD') return { tasa: null, fecha: null, refMonto: null };
  const t = await tasaVigente(db, pais);
  if (!t)
    throw new ErrorDatos(
      'Todavía no hay tasa del día. Intenta de nuevo en unos minutos.',
      undefined,
      409,
    );
  return { tasa: t.tasa, fecha: t.fecha, refMonto: equivalenteLocal(monto, t.tasa) };
}

// ───────────────────────────── El conductor: «Cobrar en efectivo» ─────────────────────────────

/** Los códigos vencidos devuelven su monto (el disparador). Sin vencidos no escribe nada. */
export async function vencerCobros(db: D1Database, conductorId?: string) {
  const r = await db
    .prepare(
      `UPDATE cobros_efectivo SET estado = 'vencido', cerrado_en = ${ahoraSql}
        WHERE estado = 'activo' AND expira_en <= ${ahoraSql}${conductorId ? ' AND conductor_id = ?' : ''}`,
    )
    .bind(...(conductorId ? [conductorId] : []))
    .run();
  return Number(r.meta.changes ?? 0);
}

const SQL_GANANCIAS = `(SELECT COALESCE(SUM(monto), 0) FROM movimientos WHERE usuario_id = ?1 AND ${SOLO_LO_COBRADO})`;
const SQL_COBRADO_HOY = `(SELECT COALESCE(SUM(x.monto), 0) FROM cobros_efectivo x WHERE x.conductor_id = ?1 AND x.estado IN ('activo', 'pagado') AND x.creado_en > ${HOY})`;

type FilaCobro = {
  id: string;
  monto: number;
  moneda: string;
  paga_en: string;
  ref_tasa: number | null;
  ref_fecha: string | null;
  ref_monto: number | null;
  codigo: string;
  estado: string;
  expira_en: string;
  pagado_en: string | null;
  creado_en: string;
  agente: string | null;
};

const aCobro = (f: FilaCobro, conCodigo: boolean) => ({
  id: f.id,
  monto: Number(f.monto),
  moneda: f.moneda,
  pagaEn: f.paga_en,
  refTasa: f.ref_tasa == null ? null : Number(f.ref_tasa),
  refFecha: f.ref_fecha,
  refMonto: f.ref_monto == null ? null : Number(f.ref_monto),
  ...(conCodigo ? { codigo: f.codigo } : {}),
  estado: f.estado,
  expiraEn: f.expira_en,
  pagadoEn: f.pagado_en,
  creadoEn: f.creado_en,
  agente: f.agente,
});

/** Lo que ve el conductor: si su ciudad tiene el servicio, cuánto puede cobrar, su código vivo y sus agentes. */
export async function estadoCobroEfectivo(db: D1Database, conductorId: string) {
  const cuenta = await cuentaDeConductor(db, conductorId);
  await vencerCobros(db, conductorId);
  const ciudad = await ciudadAgentes(db, cuenta.zonaId);
  const { results: agentes } = await db
    .prepare(
      `SELECT a.nombre, a.direccion, a.horario, a.telefono, a.tope_pago FROM agentes a
        WHERE a.zona_id = ? AND a.estado = 'activo' AND a.clave_hash IS NOT NULL ORDER BY a.nombre LIMIT 20`,
    )
    .bind(cuenta.zonaId)
    .all<{
      nombre: string;
      direccion: string;
      horario: string;
      telefono: string | null;
      tope_pago: number;
    }>();
  const disponible = ciudad.activo && agentes.length > 0;
  const sumas = await db
    .prepare(`SELECT ${SQL_GANANCIAS} AS ganancias, ${SQL_COBRADO_HOY} AS hoy`)
    .bind(conductorId)
    .first<{ ganancias: number; hoy: number }>();
  const ganancias = Math.max(0, Number(sumas?.ganancias ?? 0));
  const { results: cobros } = await db
    .prepare(
      `SELECT c.id, c.monto, c.moneda, c.paga_en, c.ref_tasa, c.ref_fecha, c.ref_monto, c.codigo, c.estado,
              c.expira_en, c.pagado_en, c.creado_en, a.nombre AS agente
         FROM cobros_efectivo c LEFT JOIN agentes a ON a.id = c.agente_id
        WHERE c.conductor_id = ? ORDER BY c.creado_en DESC LIMIT 10`,
    )
    .bind(conductorId)
    .all<FilaCobro>();
  const vivo = cobros.find((c) => c.estado === 'activo');
  const topePago = Math.max(0, ...agentes.map((a) => Number(a.tope_pago)));
  let maximo = Math.min(
    ganancias,
    topePago,
    Math.max(0, ciudad.topeConductorDia - Number(sumas?.hoy ?? 0)),
  );
  // En dólares solo se entregan billetes enteros: el resto se queda en la billetera.
  if (ciudad.pagaEn === 'USD') maximo -= maximo % 100;
  const tasa = disponible && ciudad.pagaEn === 'VES' ? await tasaVigente(db, cuenta.pais) : null;
  return {
    disponible,
    moneda: cuenta.moneda,
    pagaEn: ciudad.pagaEn,
    minimo: ciudad.minimo,
    maximo,
    ganancias,
    horas: HORAS_COBRO,
    tasa: tasa ? { tasa: tasa.tasa, fecha: tasa.fecha } : null,
    sinTasa: disponible && ciudad.pagaEn === 'VES' && !tasa,
    vivo: vivo ? aCobro(vivo, true) : null,
    agentes: disponible
      ? agentes.map((a) => ({
          nombre: a.nombre,
          direccion: a.direccion,
          horario: a.horario,
          telefono: a.telefono,
        }))
      : [],
    historial: cobros.filter((c) => c.estado !== 'activo').map((c) => aCobro(c, false)),
  };
}

function codigoNuevo(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  // Nunca empieza por cero: los códigos de ejemplo de las guías (012 345) no existen de verdad.
  return String(100_000 + (n % 900_000));
}

/** El conductor pide su código: el monto queda apartado de sus ganancias en la misma sentencia. */
export async function pedirCobroEfectivo(db: D1Database, conductorId: string, monto: number) {
  if (!Number.isSafeInteger(monto) || monto <= 0)
    throw new ErrorDatos('El monto no es válido.', 'monto', 400);
  const e = await estadoCobroEfectivo(db, conductorId);
  if (!e.disponible)
    throw new ErrorDatos(
      'Cobrar en efectivo todavía no está disponible en tu ciudad.',
      undefined,
      409,
    );
  if (e.vivo)
    throw new ErrorDatos(
      'Ya tienes un código vivo. Úsalo o cancélalo antes de pedir otro.',
      undefined,
      409,
    );
  if (monto < e.minimo) throw new ErrorDatos('Ese monto está por debajo del mínimo.', 'monto', 422);
  if (e.pagaEn === 'USD' && monto % 100 !== 0)
    throw new ErrorDatos(
      'En efectivo solo se entregan dólares enteros. El resto se queda en tu billetera.',
      'monto',
      422,
    );
  if (monto > e.ganancias)
    throw new ErrorDatos('No tienes ganancias suficientes para ese monto.', 'monto', 409);
  if (monto > e.maximo)
    throw new ErrorDatos('Ese monto pasa lo que puedes cobrar en efectivo hoy.', 'monto', 409);
  const cuenta = await cuentaDeConductor(db, conductorId);
  const mano = await enMano(db, cuenta.pais, e.pagaEn, monto);
  const ciudad = await ciudadAgentes(db, cuenta.zonaId);
  for (let intento = 0; intento < 6; intento++) {
    const id = nuevoId();
    const r = await db
      .prepare(
        // Solo nace si las ganancias cobradas alcanzan y no se pasa el tope del día (dos toques a la
        // vez no apartan dos veces: además, el índice único deja un solo código vivo por conductor).
        `INSERT OR IGNORE INTO cobros_efectivo (id, conductor_id, zona_id, pais, moneda, monto, paga_en, ref_tasa, ref_fecha, ref_monto, codigo, expira_en)
         SELECT ?2, ?1, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, datetime('now', ?12)
          WHERE ${SQL_GANANCIAS} >= ?6 AND ${SQL_COBRADO_HOY} + ?6 <= ?13
            AND EXISTS (SELECT 1 FROM agentes_ciudad c WHERE c.zona_id = ?3 AND c.activo = 1)`,
      )
      .bind(
        conductorId,
        id,
        cuenta.zonaId,
        cuenta.pais,
        cuenta.moneda,
        monto,
        e.pagaEn,
        mano.tasa,
        mano.fecha,
        mano.refMonto,
        codigoNuevo(),
        `+${HORAS_COBRO} hours`,
        ciudad.topeConductorDia,
      )
      .run();
    if (r.meta.changes) return (await estadoCobroEfectivo(db, conductorId)).vivo;
    const despues = await estadoCobroEfectivo(db, conductorId);
    if (despues.vivo) return despues.vivo;
    if (despues.ganancias < monto || despues.maximo < monto)
      throw new ErrorDatos('No tienes ganancias suficientes para ese monto.', 'monto', 409);
    // Si no fue nada de eso, el código chocó con otro vivo: se prueba con otro.
  }
  throw new ErrorDatos('No pudimos crear tu código. Intenta de nuevo.', undefined, 503);
}

/** El conductor cancela su código vivo: el monto vuelve a sus ganancias. */
export async function cancelarCobroEfectivo(db: D1Database, conductorId: string) {
  const r = await db
    .prepare(
      `UPDATE cobros_efectivo SET estado = 'cancelado', cerrado_en = ${ahoraSql} WHERE conductor_id = ? AND estado = 'activo'`,
    )
    .bind(conductorId)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('No tienes un código vivo.', undefined, 409);
}

// ───────────────────────────── El agente: su panel ─────────────────────────────

const finalDe = (telefono: string | null) => {
  const d = String(telefono ?? '').replace(/\D/g, '');
  return d.length >= 4 ? d.slice(-4) : '';
};

/** Lo que el agente ve de sí mismo: su fondo, lo que debe, sus topes y lo que lleva hoy. */
export async function resumenAgente(db: D1Database, a: Agente) {
  const ciudad = await ciudadAgentes(db, a.zona_id);
  const f = await db
    .prepare(
      `SELECT
         (SELECT COALESCE(SUM(monto), 0) FROM agente_libro WHERE agente_id = ?1 AND cuenta = 'fondo') AS fondo,
         (SELECT COALESCE(SUM(monto), 0) FROM agente_libro WHERE agente_id = ?1 AND cuenta = 'deuda') AS deuda,
         (SELECT COALESCE(SUM(monto), 0) FROM cobros_efectivo WHERE agente_id = ?1 AND estado = 'pagado' AND pagado_en > ${HOY}) AS pagado_hoy,
         (SELECT COALESCE(SUM(monto), 0) FROM ventas_saldo_agente WHERE agente_id = ?1 AND creado_en > ${HOY}) AS vendido_hoy`,
    )
    .bind(a.id)
    .first<{ fondo: number; deuda: number; pagado_hoy: number; vendido_hoy: number }>();
  const cfg = await leerConfigPais(db, ciudad.pais);
  const tasa = ciudad.pagaEn === 'VES' ? await tasaVigente(db, ciudad.pais) : null;
  const fondo = Number(f?.fondo ?? 0);
  return {
    nombre: a.nombre,
    correo: a.correo,
    idioma: a.idioma,
    ciudad: ciudad.nombre,
    servicioActivo: ciudad.activo,
    moneda: ciudad.moneda,
    pagaEn: ciudad.pagaEn,
    tasa: tasa ? { tasa: tasa.tasa, fecha: tasa.fecha } : null,
    fondo,
    fondoBajo: fondo <= Number(a.aviso_fondo),
    deuda: Number(f?.deuda ?? 0),
    pagadoHoy: Number(f?.pagado_hoy ?? 0),
    vendidoHoy: Number(f?.vendido_hoy ?? 0),
    topePago: Number(a.tope_pago),
    topeDia: Number(a.tope_dia),
    topeVenta: Math.min(Number(a.tope_venta), cfg.recargaMax),
    ventaMinima: Math.max(cfg.recargaMin, VENTA_MINIMA),
    topeDeuda: Number(a.tope_deuda),
    pagosBloqueados: Boolean(a.bloqueado_en),
  };
}

function exigirOperando(a: Agente) {
  if (a.estado !== 'activo')
    throw new ErrorDatos('Tu cuenta de agente está suspendida. Habla con Divoox.', undefined, 403);
}

/**
 * El agente escribe (o escanea) el código del conductor. Si no existe, cuenta como fallo; al llegar a
 * `MAX_CODIGOS_FALLIDOS` seguidos los pagos quedan bloqueados hasta que el equipo lo revise.
 */
export async function buscarCobro(db: D1Database, a: Agente, escrito: string, ip = '') {
  exigirOperando(a);
  if (a.bloqueado_en)
    throw new ErrorDatos(
      'Los pagos están bloqueados por varios códigos equivocados. Habla con Divoox para reactivarlos.',
      'bloqueado',
      403,
    );
  const codigo = escrito.replace(/\D/g, '');
  await vencerCobros(db);
  const f =
    codigo.length === 6
      ? await db
          .prepare(
            `SELECT c.id, c.monto, c.moneda, c.paga_en, c.ref_tasa, c.ref_fecha, c.ref_monto, c.expira_en,
                    u.nombre, u.telefono, (SELECT k.selfie FROM kyc k WHERE k.usuario_id = u.id) AS selfie
               FROM cobros_efectivo c JOIN usuarios u ON u.id = c.conductor_id
              WHERE c.codigo = ? AND c.estado = 'activo' AND c.zona_id = ? AND c.expira_en > ${ahoraSql}`,
          )
          .bind(codigo, a.zona_id)
          .first<{
            id: string;
            monto: number;
            moneda: string;
            paga_en: string;
            ref_tasa: number | null;
            ref_fecha: string | null;
            ref_monto: number | null;
            expira_en: string;
            nombre: string;
            telefono: string | null;
            selfie: string | null;
          }>()
      : null;
  if (!f) {
    const r = await db
      .prepare(
        `UPDATE agentes SET codigos_fallidos = codigos_fallidos + 1,
                bloqueado_en = CASE WHEN codigos_fallidos + 1 >= ?2 THEN ${ahoraSql} ELSE bloqueado_en END
          WHERE id = ?1 RETURNING codigos_fallidos`,
      )
      .bind(a.id, MAX_CODIGOS_FALLIDOS)
      .first<{ codigos_fallidos: number }>();
    await anotarAccion(db, a.id, 'codigo_fallido', '', `intento ${r?.codigos_fallidos ?? '?'}`, ip);
    const quedan = Math.max(0, MAX_CODIGOS_FALLIDOS - Number(r?.codigos_fallidos ?? 0));
    throw new ErrorDatos(
      quedan > 0
        ? 'Ese código no sirve, ya se usó o se venció. Pídele al conductor que te lo muestre de nuevo.'
        : 'Los pagos están bloqueados por varios códigos equivocados. Habla con Divoox para reactivarlos.',
      quedan > 0 ? 'codigo' : 'bloqueado',
      quedan > 0 ? 404 : 403,
    );
  }
  if (Number(a.codigos_fallidos) > 0)
    await db.prepare('UPDATE agentes SET codigos_fallidos = 0 WHERE id = ?').bind(a.id).run();
  await anotarAccion(db, a.id, 'codigo_visto', f.id, '', ip);
  const fondo = await saldoAgente(db, a.id, 'fondo');
  return {
    id: f.id,
    monto: Number(f.monto),
    moneda: f.moneda,
    pagaEn: f.paga_en,
    refTasa: f.ref_tasa == null ? null : Number(f.ref_tasa),
    refFecha: f.ref_fecha,
    refMonto: f.ref_monto == null ? null : Number(f.ref_monto),
    expiraEn: f.expira_en,
    conductor: { nombre: f.nombre, telefonoFinal: finalDe(f.telefono), conFoto: Boolean(f.selfie) },
    alcanzaFondo: fondo >= Number(f.monto),
    pasaTope: Number(f.monto) > Number(a.tope_pago),
  };
}

/**
 * «Pagado»: UNA sentencia. Solo entra si el código sigue vivo, es de la ciudad del agente, hay fondo
 * y no se pasa el tope por pago ni el del día. El disparador baja el fondo en la misma sentencia.
 */
export async function pagarCobro(
  env: Env,
  db: D1Database,
  a: Agente,
  p: { cobroId: string; codigo: string; ip?: string },
) {
  exigirOperando(a);
  if (a.bloqueado_en)
    throw new ErrorDatos(
      'Los pagos están bloqueados por varios códigos equivocados. Habla con Divoox para reactivarlos.',
      'bloqueado',
      403,
    );
  const codigo = p.codigo.replace(/\D/g, '');
  const r = await db
    .prepare(
      `UPDATE cobros_efectivo SET estado = 'pagado', agente_id = ?1, pagado_en = ${ahoraSql}, cerrado_en = ${ahoraSql}
        WHERE id = ?2 AND codigo = ?3 AND estado = 'activo' AND expira_en > ${ahoraSql} AND zona_id = ?4
          AND monto <= ?5
          AND (SELECT COALESCE(SUM(l.monto), 0) FROM agente_libro l WHERE l.agente_id = ?1 AND l.cuenta = 'fondo') >= monto
          AND (SELECT COALESCE(SUM(x.monto), 0) FROM cobros_efectivo x WHERE x.agente_id = ?1 AND x.estado = 'pagado' AND x.pagado_en > ${HOY}) + monto <= ?6
          AND EXISTS (SELECT 1 FROM agentes g WHERE g.id = ?1 AND g.estado = 'activo' AND g.bloqueado_en IS NULL)
          AND EXISTS (SELECT 1 FROM agentes_ciudad c WHERE c.zona_id = ?4 AND c.activo = 1)`,
    )
    .bind(a.id, p.cobroId, codigo, a.zona_id, a.tope_pago, a.tope_dia)
    .run();
  if (!r.meta.changes) {
    // Nada cambió: se dice por qué, sin mover dinero.
    const c = await db
      .prepare(
        `SELECT estado, monto, agente_id, expira_en > ${ahoraSql} AS vigente,
                COALESCE(pagado_en > datetime('now', '-10 minutes'), 0) AS reciente
           FROM cobros_efectivo WHERE id = ? AND codigo = ? AND zona_id = ?`,
      )
      .bind(p.cobroId, codigo, a.zona_id)
      .first<{
        estado: string;
        monto: number;
        agente_id: string | null;
        vigente: number;
        reciente: number;
      }>();
    // El mismo agente repite «Pagado» porque se le perdió la respuesta (hace menos de 10 minutos):
    // recibe su recibo otra vez. No se mueve nada: el pago ya quedó hecho la primera vez.
    if (c?.estado === 'pagado' && c.agente_id === a.id && c.reciente) {
      const mismo = await reciboPago(db, a.id, p.cobroId);
      if (mismo) return mismo;
    }
    await anotarAccion(db, a.id, 'pago_rechazado', p.cobroId, c?.estado ?? 'no existe', p.ip);
    if (!c) throw new ErrorDatos('Ese código no sirve.', 'codigo', 404);
    if (c.estado === 'pagado')
      throw new ErrorDatos(
        'Ese código ya se pagó. No entregues el dinero otra vez.',
        'codigo',
        409,
      );
    if (c.estado !== 'activo' || !c.vigente)
      throw new ErrorDatos('Ese código ya se venció o el conductor lo canceló.', 'codigo', 410);
    if (Number(c.monto) > Number(a.tope_pago))
      throw new ErrorDatos('Ese pago pasa tu tope por pago.', 'tope', 409);
    if ((await saldoAgente(db, a.id, 'fondo')) < Number(c.monto))
      throw new ErrorDatos(
        'Tu fondo no alcanza para este pago. Pídele a Divoox que te recargue el fondo.',
        'fondo',
        409,
      );
    throw new ErrorDatos('Ese pago pasa tu tope del día.', 'tope', 409);
  }
  const recibo = await reciboPago(db, a.id, p.cobroId);
  // El dinero ya se movió: si el registro falla, el agente igual recibe su recibo (y queda el error).
  await anotarAccion(db, a.id, 'pago', p.cobroId, `${recibo?.monto ?? ''}`, p.ip).catch(
    (e: unknown) => console.error('agente: registro del pago', e),
  );
  const conductor = await db
    .prepare('SELECT conductor_id FROM cobros_efectivo WHERE id = ?')
    .bind(p.cobroId)
    .first<{ conductor_id: string }>();
  if (conductor && recibo) {
    const usd = (recibo.monto / 100).toFixed(2);
    await notificar(env, db, conductor.conductor_id, (i) =>
      i === 'es'
        ? {
            titulo: 'Cobraste en efectivo',
            cuerpo: `${a.nombre} te pagó $${usd} de tus ganancias. Recibo ${recibo.numero}.`,
          }
        : {
            titulo: 'You cashed out',
            cuerpo: `${a.nombre} paid you $${usd} from your earnings. Receipt ${recibo.numero}.`,
          },
    ).catch((e: unknown) => console.error('agente: aviso de pago', e));
  }
  await avisarFondoBajo(env, db, a.id).catch((e: unknown) =>
    console.error('agente: aviso de fondo bajo', e),
  );
  return recibo;
}

const numeroRecibo = (id: string) => id.replace(/-/g, '').slice(0, 8).toUpperCase();

async function reciboPago(db: D1Database, agenteId: string, cobroId: string) {
  const f = await db
    .prepare(
      `SELECT c.id, c.monto, c.moneda, c.paga_en, c.ref_tasa, c.ref_monto, c.pagado_en, u.nombre
         FROM cobros_efectivo c JOIN usuarios u ON u.id = c.conductor_id
        WHERE c.id = ? AND c.agente_id = ? AND c.estado = 'pagado'`,
    )
    .bind(cobroId, agenteId)
    .first<{
      id: string;
      monto: number;
      moneda: string;
      paga_en: string;
      ref_tasa: number | null;
      ref_monto: number | null;
      pagado_en: string;
      nombre: string;
    }>();
  if (!f) return null;
  return {
    tipo: 'pago' as const,
    numero: numeroRecibo(f.id),
    monto: Number(f.monto),
    moneda: f.moneda,
    pagaEn: f.paga_en,
    refTasa: f.ref_tasa == null ? null : Number(f.ref_tasa),
    refMonto: f.ref_monto == null ? null : Number(f.ref_monto),
    cuando: f.pagado_en,
    conductor: f.nombre,
    fondo: await saldoAgente(db, agenteId, 'fondo'),
  };
}

/** Si el fondo bajó del umbral, el equipo recibe UN correo (como mucho uno cada 12 horas por agente). */
export async function avisarFondoBajo(env: Env, db: D1Database, agenteId: string) {
  const marca = await db
    .prepare(
      `UPDATE agentes SET avisado_fondo_en = ${ahoraSql}
        WHERE id = ?1 AND (avisado_fondo_en IS NULL OR avisado_fondo_en < datetime('now', '-12 hours'))
          AND (SELECT COALESCE(SUM(monto), 0) FROM agente_libro WHERE agente_id = ?1 AND cuenta = 'fondo') <= aviso_fondo
        RETURNING nombre, (SELECT COALESCE(SUM(monto), 0) FROM agente_libro WHERE agente_id = ?1 AND cuenta = 'fondo') AS fondo`,
    )
    .bind(agenteId)
    .first<{ nombre: string; fondo: number }>();
  if (!marca) return false;
  const usd = (Number(marca.fondo) / 100).toFixed(2);
  let enviados = 0;
  for (const para of await correosEquipo(env, 'dinero')) {
    const r = await enviarCorreo(env, {
      de: 'avisos',
      para,
      idioma: 'es',
      asunto: `Fondo bajo del agente ${marca.nombre}: $${usd}`,
      texto: `Al agente ${marca.nombre} le quedan $${usd} de fondo para pagar a los conductores.\n\nSin fondo su panel no deja pagar. Cuando le transfieras, anótalo en el panel: Dinero, Agentes.`,
    }).catch((e: unknown) => {
      console.error('agente: correo de fondo bajo', e);
      return { ok: false as const };
    });
    if (r.ok) enviados++;
  }
  // Si no salió ninguno, la marca se deshace: el próximo pago vuelve a intentar el aviso.
  if (!enviados) {
    await db
      .prepare('UPDATE agentes SET avisado_fondo_en = NULL WHERE id = ?')
      .bind(agenteId)
      .run();
    return false;
  }
  return true;
}

/** Variantes de un teléfono como lo escribiría la gente de ese país (con o sin prefijo). */
function variantesTelefono(escrito: string, pais: string): string[] {
  const d = escrito.replace(/\D/g, '');
  const prefijo = pais === 'VE' ? '58' : pais === 'CO' ? '57' : pais === 'PE' ? '51' : '1';
  const v = new Set<string>();
  const c = telefonoCanonico(d);
  if (c) v.add(c);
  if (d.startsWith('0')) v.add(`${prefijo}${d.slice(1)}`);
  if (d.length >= 7 && !d.startsWith(prefijo)) v.add(`${prefijo}${d}`);
  return [...v];
}

/**
 * Para vender saldo: el agente busca al conductor por su teléfono COMPLETO o por su código de
 * invitación. Solo conductores de su ciudad, y solo devuelve el nombre, el final del teléfono y si
 * tiene foto. Nunca una lista.
 */
export async function buscarConductor(
  db: D1Database,
  a: Agente,
  p: { telefono?: string; codigo?: string; ip?: string },
) {
  exigirOperando(a);
  // Muchas búsquedas sin resultado en una hora: alguien está probando números. Se frena.
  const fallidas = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM agente_acciones WHERE agente_id = ? AND accion = 'conductor_no_encontrado' AND creado_en > datetime('now', '-1 hour')",
    )
    .bind(a.id)
    .first<{ n: number }>();
  if (Number(fallidas?.n ?? 0) >= MAX_BUSQUEDAS_FALLIDAS)
    throw new ErrorDatos(
      'Demasiadas búsquedas sin resultado. Espera una hora o habla con Divoox.',
      'conductor',
      429,
    );
  const ciudad = await ciudadAgentes(db, a.zona_id);
  let id: string | null = null;
  if (p.codigo?.trim()) {
    const r = await resolverCodigo(db, p.codigo);
    if (r && r.rol === 'repartidor' && !r.equipoId) id = r.invitadorId;
  } else if (p.telefono) {
    const variantes = variantesTelefono(p.telefono, ciudad.pais);
    if (variantes.length) {
      const { results } = await db
        .prepare(
          `SELECT id FROM usuarios WHERE rol = 'repartidor' AND activo = 1
              AND telefono_canonico IN (${variantes.map(() => '?').join(', ')}) LIMIT 2`,
        )
        .bind(...variantes)
        .all<{ id: string }>();
      if (results.length === 1) id = results[0]?.id ?? null;
    }
  }
  const f = id
    ? await db
        .prepare(
          `SELECT u.id, u.nombre, u.telefono, (SELECT k.selfie FROM kyc k WHERE k.usuario_id = u.id) AS selfie
             FROM usuarios u JOIN repartidores r ON r.usuario_id = u.id
            WHERE u.id = ? AND u.rol = 'repartidor' AND u.activo = 1 AND r.zona_id = ?`,
        )
        .bind(id, a.zona_id)
        .first<{ id: string; nombre: string; telefono: string | null; selfie: string | null }>()
    : null;
  if (!f) {
    await anotarAccion(db, a.id, 'conductor_no_encontrado', '', '', p.ip);
    throw new ErrorDatos(
      'No encontramos a un conductor de tu ciudad con ese dato. Revísalo con él.',
      'conductor',
      404,
    );
  }
  await anotarAccion(db, a.id, 'conductor_buscado', f.id, '', p.ip);
  return {
    id: f.id,
    nombre: f.nombre,
    telefonoFinal: finalDe(f.telefono),
    conFoto: Boolean(f.selfie),
  };
}

/** ¿Este agente buscó a ese conductor (o vio su código) hace poco? Sin eso no ve su foto ni le vende. */
export async function loTieneDelante(db: D1Database, agenteId: string, objeto: string) {
  const f = await db
    .prepare(
      `SELECT 1 FROM agente_acciones WHERE agente_id = ? AND objeto = ? AND accion IN ('conductor_buscado', 'codigo_visto')
          AND creado_en > datetime('now', ?) LIMIT 1`,
    )
    .bind(agenteId, objeto, `-${MINUTOS_BUSQUEDA} minutes`)
    .first();
  return Boolean(f);
}

/**
 * «Vender saldo»: el agente cobra en efectivo y el conductor recibe el saldo al instante. UNA
 * sentencia (el disparador acredita el saldo y sube la deuda del agente). `idem` hace que repetir el
 * mismo toque no venda dos veces.
 */
export async function venderSaldo(
  env: Env,
  db: D1Database,
  a: Agente,
  p: { conductorId: string; monto: number; idem: string; ip?: string },
) {
  exigirOperando(a);
  if (!Number.isSafeInteger(p.monto) || p.monto <= 0)
    throw new ErrorDatos('El monto no es válido.', 'monto', 400);
  const ciudad = await ciudadAgentes(db, a.zona_id);
  if (!ciudad.activo)
    throw new ErrorDatos(
      'El servicio de agentes todavía no está encendido en tu ciudad.',
      undefined,
      409,
    );
  const cfg = await leerConfigPais(db, ciudad.pais);
  const maximo = Math.min(Number(a.tope_venta), cfg.recargaMax);
  if (p.monto < Math.max(cfg.recargaMin, VENTA_MINIMA) || p.monto > maximo)
    throw new ErrorDatos('La recarga está fuera de los límites permitidos.', 'monto', 409);
  const id = `va-${a.id.slice(0, 8)}-${p.idem}`;
  const ya = await reciboVenta(db, a.id, id);
  if (ya) {
    // La misma llave solo vale para la misma venta (mismo conductor y mismo monto).
    if (ya.conductorId !== p.conductorId || ya.monto !== p.monto)
      throw new ErrorDatos('Esa venta ya quedó hecha. Empieza una venta nueva.', undefined, 409);
    return sinConductor(ya);
  }
  if (!(await loTieneDelante(db, a.id, p.conductorId)))
    throw new ErrorDatos('Busca de nuevo al conductor antes de venderle saldo.', 'conductor', 409);
  const mano = await enMano(db, ciudad.pais, ciudad.pagaEn, p.monto);
  const r = await db
    .prepare(
      `INSERT OR IGNORE INTO ventas_saldo_agente (id, agente_id, conductor_id, zona_id, pais, moneda, monto, paga_en, ref_tasa, ref_fecha, ref_monto)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11
        WHERE EXISTS (SELECT 1 FROM agentes g WHERE g.id = ?2 AND g.estado = 'activo')
          AND EXISTS (SELECT 1 FROM usuarios u JOIN repartidores r ON r.usuario_id = u.id
                       WHERE u.id = ?3 AND u.rol = 'repartidor' AND u.activo = 1 AND r.zona_id = ?4)
          AND (SELECT COALESCE(SUM(l.monto), 0) FROM agente_libro l WHERE l.agente_id = ?2 AND l.cuenta = 'deuda') + ?7 <= ?12`,
    )
    .bind(
      id,
      a.id,
      p.conductorId,
      a.zona_id,
      ciudad.pais,
      ciudad.moneda,
      p.monto,
      ciudad.pagaEn,
      mano.tasa,
      mano.fecha,
      mano.refMonto,
      a.tope_deuda,
    )
    .run();
  if (!r.meta.changes) {
    const repetido = await reciboVenta(db, a.id, id);
    if (repetido) return sinConductor(repetido);
    await anotarAccion(db, a.id, 'venta_rechazada', p.conductorId, String(p.monto), p.ip);
    if ((await saldoAgente(db, a.id, 'deuda')) + p.monto > Number(a.tope_deuda))
      throw new ErrorDatos(
        'Llegaste al tope de saldo vendido sin entregar a Divoox. Entrega lo vendido para seguir.',
        'tope',
        409,
      );
    throw new ErrorDatos('No encontramos a ese conductor en tu ciudad.', 'conductor', 404);
  }
  await anotarAccion(db, a.id, 'venta', p.conductorId, String(p.monto), p.ip).catch((e: unknown) =>
    console.error('agente: registro de la venta', e),
  );
  const recibo = sinConductor((await reciboVenta(db, a.id, id))!);
  const usd = (p.monto / 100).toFixed(2);
  await notificar(env, db, p.conductorId, (i) =>
    i === 'es'
      ? {
          titulo: 'Recargaste tu saldo',
          cuerpo: `${a.nombre} te acreditó $${usd} de saldo. Recibo ${recibo.numero}.`,
        }
      : {
          titulo: 'Balance topped up',
          cuerpo: `${a.nombre} added $${usd} to your balance. Receipt ${recibo.numero}.`,
        },
  ).catch((e: unknown) => console.error('agente: aviso de venta', e));
  return recibo;
}

/** El recibo que ve el agente no lleva el id del conductor. */
function sinConductor<T extends { conductorId: string }>(r: T): Omit<T, 'conductorId'> {
  const copia: Partial<T> = { ...r };
  delete copia.conductorId;
  return copia as Omit<T, 'conductorId'>;
}

async function reciboVenta(db: D1Database, agenteId: string, ventaId: string) {
  const f = await db
    .prepare(
      `SELECT v.id, v.monto, v.moneda, v.pais, v.paga_en, v.ref_tasa, v.ref_monto, v.creado_en, v.conductor_id, u.nombre
         FROM ventas_saldo_agente v JOIN usuarios u ON u.id = v.conductor_id WHERE v.id = ? AND v.agente_id = ?`,
    )
    .bind(ventaId, agenteId)
    .first<{
      id: string;
      monto: number;
      moneda: string;
      pais: string;
      paga_en: string;
      ref_tasa: number | null;
      ref_monto: number | null;
      creado_en: string;
      conductor_id: string;
      nombre: string;
    }>();
  if (!f) return null;
  return {
    tipo: 'venta' as const,
    numero: numeroRecibo(f.id.split('-').slice(2).join('')),
    monto: Number(f.monto),
    moneda: f.moneda,
    pagaEn: f.paga_en,
    refTasa: f.ref_tasa == null ? null : Number(f.ref_tasa),
    refMonto: f.ref_monto == null ? null : Number(f.ref_monto),
    cuando: f.creado_en,
    conductor: f.nombre,
    conductorId: f.conductor_id,
    saldoConductor: await saldoLibro(db, f.conductor_id, 'prepago', f.pais, f.moneda),
    deuda: await saldoAgente(db, agenteId, 'deuda'),
  };
}

/** Nombre corto para el historial: «Carlos R.» (el agente no guarda nombres completos de más). */
const nombreCorto = (n: string) => {
  const [primero = '', segundo = ''] = n.trim().split(/\s+/);
  return segundo ? `${primero} ${segundo.charAt(0).toUpperCase()}.` : primero;
};

/** El historial del agente: SOLO sus pagos, sus ventas y los movimientos de su fondo. */
export async function historialAgente(db: D1Database, agenteId: string, corto = true) {
  const { results } = await db
    .prepare(
      `SELECT * FROM (
         SELECT 'pago' AS tipo, c.id, c.monto, c.ref_monto, c.pagado_en AS cuando, u.nombre, '' AS concepto, '' AS motivo
           FROM cobros_efectivo c JOIN usuarios u ON u.id = c.conductor_id WHERE c.agente_id = ?1 AND c.estado = 'pagado'
         UNION ALL
         SELECT 'venta', v.id, v.monto, v.ref_monto, v.creado_en, u.nombre, '', ''
           FROM ventas_saldo_agente v JOIN usuarios u ON u.id = v.conductor_id WHERE v.agente_id = ?1
         UNION ALL
         SELECT l.cuenta, l.id, l.monto, NULL, l.creado_en, '', l.concepto, l.motivo
           FROM agente_libro l WHERE l.agente_id = ?1 AND l.concepto NOT IN ('pago_conductor', 'venta_saldo')
       ) ORDER BY cuando DESC LIMIT 100`,
    )
    .bind(agenteId)
    .all<{
      tipo: string;
      id: string;
      monto: number;
      ref_monto: number | null;
      cuando: string;
      nombre: string;
      concepto: string;
      motivo: string;
    }>();
  return results.map((r) => ({
    tipo: r.tipo,
    numero:
      r.tipo === 'pago'
        ? numeroRecibo(r.id)
        : r.tipo === 'venta'
          ? numeroRecibo(r.id.split('-').slice(2).join(''))
          : '',
    monto: Number(r.monto),
    refMonto: r.ref_monto == null ? null : Number(r.ref_monto),
    cuando: r.cuando,
    conductor: r.nombre ? (corto ? nombreCorto(r.nombre) : r.nombre) : '',
    concepto: r.concepto,
    motivo: r.motivo,
  }));
}

// ───────────────────────────── El equipo: Dinero → Agentes ─────────────────────────────

export const CONCEPTOS_EQUIPO = ['fondo', 'devolucion_fondo', 'entrega', 'compensacion'] as const;
export type ConceptoEquipo = (typeof CONCEPTOS_EQUIPO)[number];

/**
 * Lo que el equipo anota en el libro de un agente:
 * - `fondo`: Divoox le transfirió por fuera y se le anota (el comprobante no se repite);
 * - `devolucion_fondo`: el agente devolvió fondo que no usó (nunca más de lo que tiene);
 * - `entrega`: el agente le entregó a Divoox el efectivo del saldo vendido (baja su deuda);
 * - `compensacion`: lo que debe por saldo vendido pasa a ser fondo para pagar (no viaja dinero).
 */
export async function anotarEnAgente(
  db: D1Database,
  p: {
    agenteId: string;
    concepto: ConceptoEquipo;
    monto: number;
    comprobante: string;
    motivo: string;
    autorId: string;
  },
) {
  if (!Number.isSafeInteger(p.monto) || p.monto <= 0)
    throw new ErrorDatos('El monto no es válido.', 'monto', 400);
  if (p.monto > TOPES_AGENTE.anotacionMaxima)
    throw new ErrorDatos(
      'Ese monto pasa el máximo permitido de Divoox por anotación.',
      'monto',
      422,
    );
  // «abc 1» y «ABC1» son el mismo comprobante: el mismo pago no se anota dos veces.
  const comprobante = p.comprobante.toUpperCase().replace(/\s+/g, '');
  if (comprobante.length < 3)
    throw new ErrorDatos('Escribe el número del comprobante.', 'comprobante', 422);
  const agente = await db.prepare('SELECT id FROM agentes WHERE id = ?').bind(p.agenteId).first();
  if (!agente) throw new ErrorDatos('Ese agente no existe.', undefined, 404);
  const ref = `${p.concepto}:${p.agenteId}:${comprobante}`;
  const fila = (cuenta: 'fondo' | 'deuda', monto: number, sufijo: string, exige: string) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO agente_libro (id, agente_id, cuenta, monto, concepto, referencia, motivo, autor_id)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8 WHERE ${exige}`,
      )
      .bind(
        nuevoId(),
        p.agenteId,
        cuenta,
        monto,
        p.concepto,
        `${ref}${sufijo}`,
        p.motivo.trim().slice(0, 120),
        p.autorId,
        p.monto,
      );
  const HAY_FONDO =
    "(SELECT COALESCE(SUM(monto), 0) FROM agente_libro WHERE agente_id = ?2 AND cuenta = 'fondo') >= ?9";
  const HAY_DEUDA =
    "(SELECT COALESCE(SUM(monto), 0) FROM agente_libro WHERE agente_id = ?2 AND cuenta = 'deuda') >= ?9";
  let hechas: D1Result[];
  if (p.concepto === 'fondo') hechas = await db.batch([fila('fondo', p.monto, '', '?9 > 0')]);
  else if (p.concepto === 'devolucion_fondo')
    hechas = await db.batch([fila('fondo', -p.monto, '', HAY_FONDO)]);
  else if (p.concepto === 'entrega')
    hechas = await db.batch([fila('deuda', -p.monto, '', HAY_DEUDA)]);
  else
    hechas = await db.batch([
      fila('deuda', -p.monto, ':deuda', HAY_DEUDA),
      db
        .prepare(
          `INSERT OR IGNORE INTO agente_libro (id, agente_id, cuenta, monto, concepto, referencia, motivo, autor_id)
           SELECT ?, ?, 'fondo', ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM agente_libro WHERE referencia = ?)`,
        )
        .bind(
          nuevoId(),
          p.agenteId,
          p.monto,
          p.concepto,
          `${ref}:fondo`,
          p.motivo.trim().slice(0, 120),
          p.autorId,
          `${ref}:deuda`,
        ),
    ]);
  if (!hechas[0]?.meta.changes) {
    const repetido = await db
      .prepare('SELECT 1 FROM agente_libro WHERE referencia IN (?, ?)')
      .bind(ref, `${ref}:deuda`)
      .first();
    if (repetido)
      throw new ErrorDatos(
        'Ese comprobante ya se usó para este agente. Escribe el número del pago nuevo.',
        'comprobante',
        409,
      );
    throw new ErrorDatos(
      p.concepto === 'devolucion_fondo'
        ? 'El agente no tiene tanto fondo.'
        : 'El agente no debe tanto por saldo vendido.',
      'monto',
      409,
    );
  }
  // El fondo volvió a subir: el próximo aviso de fondo bajo puede salir de nuevo.
  if (p.concepto === 'fondo' || p.concepto === 'compensacion')
    await db
      .prepare(
        'UPDATE agentes SET avisado_fondo_en = NULL WHERE id = ? AND avisado_fondo_en IS NOT NULL',
      )
      .bind(p.agenteId)
      .run();
  return {
    fondo: await saldoAgente(db, p.agenteId, 'fondo'),
    deuda: await saldoAgente(db, p.agenteId, 'deuda'),
  };
}

/** Los agentes con su fondo, su deuda y lo pagado y vendido (conciliación). */
export async function listarAgentes(db: D1Database, agenteId?: string) {
  const { results } = await db
    .prepare(
      `SELECT ${COLUMNAS_AGENTE}, a.clave_hash IS NOT NULL AS con_clave, a.creado_en, z.nombre AS ciudad,
         (SELECT COALESCE(SUM(monto), 0) FROM agente_libro WHERE agente_id = a.id AND cuenta = 'fondo') AS fondo,
         (SELECT COALESCE(SUM(monto), 0) FROM agente_libro WHERE agente_id = a.id AND cuenta = 'deuda') AS deuda,
         (SELECT COALESCE(SUM(monto), 0) FROM agente_libro WHERE agente_id = a.id AND cuenta = 'fondo' AND monto > 0) AS fondo_recibido,
         (SELECT COALESCE(SUM(monto), 0) FROM cobros_efectivo WHERE agente_id = a.id AND estado = 'pagado') AS pagado,
         (SELECT COUNT(*) FROM cobros_efectivo WHERE agente_id = a.id AND estado = 'pagado') AS pagos,
         (SELECT COALESCE(SUM(monto), 0) FROM ventas_saldo_agente WHERE agente_id = a.id) AS vendido,
         (SELECT COUNT(*) FROM ventas_saldo_agente WHERE agente_id = a.id) AS ventas
         FROM agentes a JOIN zonas z ON z.id = a.zona_id
        ${agenteId ? 'WHERE a.id = ?' : ''} ORDER BY a.estado, a.nombre LIMIT 200`,
    )
    .bind(...(agenteId ? [agenteId] : []))
    .all<Agente & Record<string, unknown>>();
  return results.map((a) => ({
    id: a.id,
    nombre: a.nombre,
    correo: a.correo,
    telefono: a.telefono,
    idioma: a.idioma,
    zonaId: a.zona_id,
    ciudad: String(a.ciudad),
    direccion: a.direccion,
    horario: a.horario,
    estado: a.estado,
    conClave: Number(a.con_clave) === 1,
    pagosBloqueados: Boolean(a.bloqueado_en),
    topePago: Number(a.tope_pago),
    topeDia: Number(a.tope_dia),
    topeVenta: Number(a.tope_venta),
    topeDeuda: Number(a.tope_deuda),
    avisoFondo: Number(a.aviso_fondo),
    fondo: Number(a.fondo),
    fondoBajo: Number(a.fondo) <= Number(a.aviso_fondo),
    deuda: Number(a.deuda),
    fondoRecibido: Number(a.fondo_recibido),
    pagado: Number(a.pagado),
    pagos: Number(a.pagos),
    vendido: Number(a.vendido),
    ventas: Number(a.ventas),
    creadoEn: String(a.creado_en),
  }));
}

/** Las ciudades con su interruptor de agentes. */
export async function ciudadesAgentes(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT z.id, z.nombre, z.pais, z.moneda, c.activo, c.paga_en, c.minimo, c.tope_conductor_dia,
              (SELECT COUNT(*) FROM agentes a WHERE a.zona_id = z.id AND a.estado = 'activo') AS agentes
         FROM zonas z LEFT JOIN agentes_ciudad c ON c.zona_id = z.id
        WHERE z.activa = 1 ORDER BY z.pais DESC, z.nombre LIMIT 200`,
    )
    .all<Record<string, unknown>>();
  return results.map((z) => ({
    zonaId: String(z.id),
    nombre: String(z.nombre),
    pais: String(z.pais),
    moneda: String(z.moneda),
    activo: Number(z.activo ?? 0) === 1,
    pagaEn: z.paga_en === 'VES' ? 'VES' : 'USD',
    minimo: Number(z.minimo ?? 500),
    topeConductorDia: Number(z.tope_conductor_dia ?? 20_000),
    agentes: Number(z.agentes),
  }));
}

/** Las últimas acciones de un agente en su panel (para la ficha del equipo). */
export async function accionesDeAgente(db: D1Database, agenteId: string) {
  const { results } = await db
    .prepare(
      'SELECT accion, objeto, detalle, ip, creado_en FROM agente_acciones WHERE agente_id = ? ORDER BY id DESC LIMIT 100',
    )
    .bind(agenteId)
    .all<{ accion: string; objeto: string; detalle: string; ip: string; creado_en: string }>();
  return results.map((r) => ({
    accion: r.accion,
    objeto: r.objeto,
    detalle: r.detalle,
    ip: r.ip,
    creadoEn: r.creado_en,
  }));
}

/**
 * Pieza «agentes» de la salud: ningún fondo ni deuda en negativo, y lo pagado por los agentes es
 * exactamente lo que bajó de sus fondos (si no cuadra, algo movió dinero por fuera del circuito).
 */
const agentesOkHasta = new WeakMap<D1Database, number>();
export async function saludAgentes(
  db: D1Database,
  /** C-LECTURAS-SALUD: los disparadores ya leídos por el canario (una sola lectura de sqlite_master). */
  presentes?: Set<string>,
): Promise<'ok' | 'error' | 'pendiente'> {
  // C-LECTURAS-SALUD: un «ok» se recuerda un minuto en el aislado; un «error» nunca.
  if ((agentesOkHasta.get(db) ?? 0) > Date.now()) return 'ok';
  const f = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM agentes) AS agentes,
         (SELECT COUNT(*) FROM (SELECT agente_id, cuenta, SUM(monto) AS s FROM agente_libro GROUP BY 1, 2) WHERE s < 0) AS negativos,
         (SELECT COALESCE(SUM(monto), 0) FROM cobros_efectivo WHERE estado = 'pagado') AS pagado,
         (SELECT COALESCE(-SUM(monto), 0) FROM agente_libro WHERE concepto = 'pago_conductor') AS bajado,
         (SELECT COALESCE(SUM(monto), 0) FROM ventas_saldo_agente) AS vendido,
         (SELECT COALESCE(SUM(monto), 0) FROM agente_libro WHERE concepto = 'venta_saldo') AS debido,
         (SELECT COUNT(*) FROM cobros_efectivo c WHERE c.creado_en > datetime('now', '-3 days')
            AND (NOT EXISTS (SELECT 1 FROM movimientos m WHERE m.id = 'mov-cobro-' || c.id)
              OR (c.estado IN ('vencido', 'cancelado')
                  AND NOT EXISTS (SELECT 1 FROM movimientos m WHERE m.id = 'mov-cobro-dev-' || c.id)))) AS sin_apartar`,
    )
    .first<Record<string, number>>();
  // Sin sus disparadores el dinero no se mueve (apartar, devolver, bajar el fondo, acreditar).
  const hay = cuantosHay(presentes ?? (await disparadoresPresentes(db)), DISPARADORES_AGENTE);
  if (hay !== DISPARADORES_AGENTE.length) return 'error';
  if (!f || Number(f.agentes) === 0) return 'pendiente';
  if (
    Number(f.negativos) > 0 ||
    Number(f.sin_apartar) > 0 ||
    Number(f.pagado) !== Number(f.bajado) ||
    Number(f.vendido) !== Number(f.debido)
  ) {
    agentesOkHasta.delete(db);
    return 'error';
  }
  agentesOkHasta.set(db, Date.now() + 60_000);
  return 'ok';
}
