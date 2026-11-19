import { Hono } from 'hono';
import { z } from 'zod';
import {
  HORAS_VIGENCIA_TASA,
  MONEDA_REFERENCIA,
  type Referencia,
  type MontoEnMano,
  type TasaFijada,
  aplicaReferencia,
  equivalenteLocal,
  montoEnMano,
  leerTasaBcv,
  tasaGuardada,
} from '@tumbite/compartido';
import type { TareaReloj } from '../reloj';
import { paisDeZona } from '../internacional/paises';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';

/**
 * C-BS-REFERENCIA (13 nov 2026, Venezuela): la tasa del día para mostrar el equivalente en
 * bolívares de un viaje cobrado en dólares. La escribe una persona del equipo en el panel (la
 * oficial del BCV, copiada a mano): sin proveedor externo ni tarea automática. Vive en
 * `tasas_cambio` con fuente «equipo», quién la puso y cuándo. Con más de 48 horas no se muestra.
 * Solo informativa: no cambia ningún monto ni la comisión.
 *
 * C-TASA-BCV-AUTO (14 nov 2026, Venezuela): además se toma SOLA una vez al día de la portada del
 * Banco Central (fuente «bcv», con su fecha valor), con validación de cordura. Prioridad: la del
 * equipo escrita HOY manda; si no, la oficial automática más reciente con fecha valor de hoy o de
 * los últimos días; si no, la del equipo de las últimas 48 horas.
 */
export const tasasReferencia = new Hono<{ Bindings: Env; Variables: Variables }>();

const hoyEn = (pais: string, ahora = Date.now()) =>
  // Venezuela: UTC−4 todo el año (sin horario de verano).
  new Date(ahora - (pais === 'VE' ? 4 : 0) * 3600_000).toISOString().slice(0, 10);

type FilaTasa = {
  tasa: number;
  fecha: string;
  creado_en: string;
  creado_por: string | null;
  fuente: 'equipo' | 'bcv';
};

/** Lo que se usa hoy: la oficial (o la del equipo) o, según el modo del país, flotante o fija. */
export type TasaEnUso = {
  tasa: number;
  fecha: string;
  fuente: 'equipo' | 'bcv' | 'flotante' | 'fija';
  /** En «flotante», la oficial sobre la que se calculó. */
  base?: { tasa: number; fecha: string; fuente: 'equipo' | 'bcv' };
  ajustePct?: number;
};

/**
 * C-TASA-BCV-AUTO: la oficial automática vale con fecha valor de hoy o de hasta estos días atrás
 * (fines de semana y feriados largos no tienen publicación).
 */
export const DIAS_VIGENCIA_BCV = 5;
/**
 * C-TASA-MODOS: el Banco Central publica el viernes la tasa con fecha valor del lunes (y antes de un
 * feriado, la del día hábil siguiente). Si no hay ninguna oficial con fecha valor de hoy o anterior,
 * se usa la publicada con fecha valor futura hasta estos días adelante, en vez de no mostrar nada.
 */
export const DIAS_ADELANTO_BCV = 4;
/** C-TASA-MODOS: tope del ajuste de la tasa flotante, en porcentaje (positivo o negativo). */
export const AJUSTE_MAXIMO_PCT = 30;

/**
 * La oficial del país, o null: la del equipo escrita hoy; si no, la «bcv» más reciente con fecha valor
 * de hoy o de los últimos días; si no, la del equipo de las últimas 48 horas; si no, la «bcv» con la
 * fecha valor futura más cercana (C-TASA-MODOS). Una sola consulta.
 */
export async function tasaOficial(
  db: D1Database,
  pais: string,
  ahora = Date.now(),
): Promise<FilaTasa | null> {
  if (!MONEDA_REFERENCIA.has(pais)) return null;
  const hoy = hoyEn(pais, ahora);
  return db
    .prepare(
      `SELECT tasa, fecha, creado_en, creado_por, fuente FROM tasas_cambio
        WHERE pais = ?1
          AND ((fuente = 'equipo' AND creado_en > datetime(?2, '-${HORAS_VIGENCIA_TASA} hours'))
            OR (fuente = 'bcv' AND fecha <= date(?3, '+${DIAS_ADELANTO_BCV} days')
                AND fecha >= date(?3, '-${DIAS_VIGENCIA_BCV} days')))
        ORDER BY CASE WHEN fuente = 'equipo' AND fecha = ?3 THEN 0
                      WHEN fuente = 'bcv' AND fecha <= ?3 THEN 1
                      WHEN fuente = 'equipo' THEN 2 ELSE 3 END,
                 CASE WHEN fecha > ?3 THEN fecha END ASC,
                 fecha DESC, creado_en DESC
        LIMIT 1`,
    )
    .bind(pais, sqlUtc(ahora), hoy)
    .first<FilaTasa>();
}

export type ModoTasa = {
  modo: 'oficial' | 'flotante' | 'fija';
  ajuste_pct: number | null;
  tasa_fija: number | null;
  cambiado_en: string | null;
  cambiado_por: string | null;
};

/** El modo del país (C-TASA-MODOS). Sin fila: «oficial». */
export async function modoTasa(db: D1Database, pais: string): Promise<ModoTasa> {
  const m = await db
    .prepare(
      'SELECT modo, ajuste_pct, tasa_fija, cambiado_en, cambiado_por FROM tasas_modo WHERE pais = ?',
    )
    .bind(pais)
    .first<ModoTasa>();
  return (
    m ?? {
      modo: 'oficial',
      ajuste_pct: null,
      tasa_fija: null,
      cambiado_en: null,
      cambiado_por: null,
    }
  );
}

/** Bolívares por dólar con 4 decimales, como los publica el Banco Central. */
const a4 = (n: number) => Math.round(n * 10_000) / 10_000;

/**
 * C-TASA-MODOS: la tasa que se usa hoy en el país, respetando su modo. ÚNICA pieza que leen viajes,
 * comida y el panel; solo convierte a bolívares de referencia, nunca cambia un monto en dólares.
 * Solo lee (dos consultas como mucho); nunca escribe.
 */
export async function tasaVigente(
  db: D1Database,
  pais: string,
  ahora = Date.now(),
): Promise<TasaEnUso | null> {
  if (!MONEDA_REFERENCIA.has(pais)) return null;
  const m = await modoTasa(db, pais);
  if (m.modo === 'fija' && m.tasa_fija && m.tasa_fija > 0)
    return {
      tasa: m.tasa_fija,
      fecha: (m.cambiado_en ?? sqlUtc(ahora)).slice(0, 10),
      fuente: 'fija',
    };
  const o = await tasaOficial(db, pais, ahora);
  if (!o) return null;
  const base = { tasa: o.tasa, fecha: o.fecha, fuente: o.fuente };
  if (m.modo === 'flotante' && m.ajuste_pct != null && Math.abs(m.ajuste_pct) <= AJUSTE_MAXIMO_PCT)
    return {
      tasa: a4(o.tasa * (1 + m.ajuste_pct / 100)),
      fecha: o.fecha,
      fuente: 'flotante',
      base,
      ajustePct: m.ajuste_pct,
    };
  return base;
}

/** Una hora como la escribe SQLite («AAAA-MM-DD HH:MM:SS», UTC). */
const sqlUtc = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

const URL_BCV = 'https://www.bcv.org.ve/';
/** Más de esto de diferencia con la última oficial guardada: no se usa (queda retenida). */
export const SALTO_MAXIMO_PCT = 20;
/** Dos lecturas seguidas de una tasa nueva que no se apartan más que esto la confirman. */
export const MARGEN_CONFIRMA_PCT = 2;

/** Lee la portada del Banco Central: UNA petición, con tope de tiempo, sin reintentos. */
async function leerPortadaBcv(): Promise<string> {
  const r = await fetch(URL_BCV, {
    headers: { 'user-agent': 'Divoox/1.0 (+https://divoox.com)' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`el Banco Central respondió ${r.status}`);
  return r.text();
}

/**
 * C-TASA-MODOS: el respaldo, el mismo dólar oficial del Banco Central republicado por DolarApi (código
 * abierto, sin llave), con su fecha valor en `fechaActualizacion`. Flex ya lo usa (flex/tasas.ts).
 */
const URL_RESPALDO_BCV = 'https://ve.dolarapi.com/v1/dolares/oficial';
async function leerRespaldoBcv(): Promise<unknown> {
  const r = await fetch(URL_RESPALDO_BCV, { signal: AbortSignal.timeout(8_000) });
  if (!r.ok) throw new Error(`el respaldo respondió ${r.status}`);
  return r.json();
}

/** La tasa y su fecha valor del respaldo, o null si no trae la forma esperada. */
function leerRespuestaRespaldo(d: unknown): { tasa: number; fecha: string } | null {
  const r = d as { promedio?: unknown; fechaActualizacion?: unknown } | null;
  const tasa = r?.promedio;
  const fecha = typeof r?.fechaActualizacion === 'string' ? r.fechaActualizacion.slice(0, 10) : '';
  if (typeof tasa !== 'number' || !(tasa > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  return { tasa, fecha };
}

const enVitest = () =>
  Boolean(
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.VITEST,
  );

export type ResultadoTasaBcv =
  | { estado: 'guardada'; tasa: number; fecha: string }
  | { estado: 'retenida'; tasa: number; fecha: string; anterior: number }
  | { estado: 'sin-lectura'; motivo: string };

/**
 * Guarda una oficial leída con su fecha valor, con la validación de cordura (C-TASA-BCV-AUTO): si se
 * aparta de la referencia más de `pct`, queda «bcv-retenida» (nadie la lee). Una lectura y una
 * escritura, y solo si cambió (la misma tasa ya guardada para esa fecha no se reescribe).
 */
async function guardarOficial(
  db: D1Database,
  leida: { tasa: number; fecha: string },
  pct: number,
): Promise<ResultadoTasaBcv> {
  // Una sola lectura: la última oficial aceptada, la última retenida anterior, la del equipo y la
  // misma fecha si ya estaba guardada.
  const ref = await db
    .prepare(
      `SELECT
         (SELECT tasa FROM tasas_cambio WHERE pais = 'VE' AND fuente = 'bcv' AND fecha <= ?1
           ORDER BY fecha DESC LIMIT 1) AS oficial,
         (SELECT tasa FROM tasas_cambio WHERE pais = 'VE' AND fuente = 'bcv-retenida'
           AND fecha < ?1 AND fecha >= date(?1, '-${DIAS_VIGENCIA_BCV} days')
           ORDER BY fecha DESC LIMIT 1) AS retenida,
         (SELECT tasa FROM tasas_cambio WHERE pais = 'VE' AND fuente = 'equipo'
           ORDER BY creado_en DESC LIMIT 1) AS equipo,
         (SELECT tasa FROM tasas_cambio WHERE pais = 'VE' AND fuente = 'bcv' AND fecha = ?1) AS misma`,
    )
    .bind(leida.fecha)
    .first<{
      oficial: number | null;
      retenida: number | null;
      equipo: number | null;
      misma: number | null;
    }>();
  if (ref?.misma === leida.tasa)
    return { estado: 'guardada', tasa: leida.tasa, fecha: leida.fecha };
  const aparte = (a: number, b: number) => Math.abs(a / b - 1) * 100;
  // Contra qué se compara: la última oficial; el primer día, la última del equipo (si hay).
  const contra = ref?.oficial ?? ref?.equipo ?? null;
  let retenida = contra !== null && contra > 0 && aparte(leida.tasa, contra) > pct;
  // Devaluación real: la misma tasa nueva (dentro de MARGEN_CONFIRMA_PCT) leída dos días seguidos
  // se acepta. Mientras tanto, la del equipo manda.
  if (retenida && ref?.retenida && aparte(leida.tasa, ref.retenida) <= MARGEN_CONFIRMA_PCT)
    retenida = false;
  await db
    .prepare('INSERT OR REPLACE INTO tasas_cambio (pais, fecha, fuente, tasa) VALUES (?, ?, ?, ?)')
    .bind('VE', leida.fecha, retenida ? 'bcv-retenida' : 'bcv', leida.tasa)
    .run();
  if (retenida && contra !== null) {
    console.error(
      `tasa bcv: ${leida.tasa} se aparta más de ${pct} % de la referencia (${contra}); retenida`,
    );
    return { estado: 'retenida', tasa: leida.tasa, fecha: leida.fecha, anterior: contra };
  }
  return { estado: 'guardada', tasa: leida.tasa, fecha: leida.fecha };
}

/**
 * C-TASA-BCV-AUTO: toma la tasa oficial del día de la portada del Banco Central y la guarda con su
 * fecha valor y fuente «bcv». C-TASA-MODOS: si la portada no responde, o trae una fecha valor futura
 * (publicada el viernes para el lunes) y no hay ninguna oficial vigente hoy, hace UNA lectura del
 * respaldo (DolarApi, el mismo dólar oficial con su fecha valor). Como mucho dos lecturas externas y
 * dos escrituras. Nunca lanza.
 */
export async function tomarTasaBcv(
  db: D1Database,
  opciones: {
    leer?: () => Promise<string>;
    leerRespaldo?: (() => Promise<unknown>) | null;
    ahora?: number;
    saltoMaximoPct?: number;
  } = {},
): Promise<ResultadoTasaBcv> {
  const ahora = opciones.ahora ?? Date.now();
  const hoy = hoyEn('VE', ahora);
  const pct = opciones.saltoMaximoPct ?? SALTO_MAXIMO_PCT;
  // Ninguna prueba sale a internet: dentro de vitest, sin lector de prueba, no hay respaldo.
  const lectorRespaldo =
    opciones.leerRespaldo !== undefined
      ? opciones.leerRespaldo
      : enVitest()
        ? null
        : leerRespaldoBcv;
  const delRespaldo = async (): Promise<{ tasa: number; fecha: string } | null> => {
    if (!lectorRespaldo) return null;
    try {
      const r = leerRespuestaRespaldo(await lectorRespaldo());
      if (!r) console.error('tasa bcv: el respaldo no trae la tasa o su fecha valor');
      return r;
    } catch (e) {
      console.error('tasa bcv: no se pudo leer el respaldo', e);
      return null;
    }
  };
  let leida: { tasa: number; fecha: string | null } | null = null;
  let motivo = 'la portada cambió de forma';
  try {
    leida = leerTasaBcv(await (opciones.leer ?? leerPortadaBcv)());
  } catch (e) {
    console.error('tasa bcv: no se pudo leer la portada', e);
    motivo = String(e);
  }
  if (!leida?.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(leida.fecha)) {
    if (leida) console.error('tasa bcv: la portada no trae la tasa o su fecha valor');
    const r = await delRespaldo();
    return r ? guardarOficial(db, r, pct) : { estado: 'sin-lectura', motivo };
  }
  const portada = { tasa: leida.tasa, fecha: leida.fecha };
  const resultado = await guardarOficial(db, portada, pct);
  if (portada.fecha > hoy) {
    // Fecha valor futura: ¿hay alguna oficial vigente hoy? Si no, la del día sale del respaldo.
    const vigente = await db
      .prepare(
        `SELECT 1 FROM tasas_cambio WHERE pais = 'VE' AND fuente = 'bcv' AND fecha <= ?1
           AND fecha >= date(?1, '-${DIAS_VIGENCIA_BCV} days') LIMIT 1`,
      )
      .bind(hoy)
      .first();
    if (!vigente) {
      const r = await delRespaldo();
      const minimo = new Date(Date.parse(`${hoy}T00:00:00Z`) - DIAS_VIGENCIA_BCV * 86_400_000)
        .toISOString()
        .slice(0, 10);
      if (r && r.fecha <= hoy && r.fecha >= minimo) await guardarOficial(db, r, pct);
    }
  }
  return resultado;
}

/**
 * Canario de la tasa oficial: «pendiente» si nunca se tomó; «error» si la última lectura quedó
 * retenida (salto anormal) y no hay una buena posterior; «atrasado» si la última buena es más vieja
 * que la vigencia; «ok» si no. Lee dos filas.
 */
export async function saludTasaBcv(
  db: D1Database,
  ahora = Date.now(),
): Promise<'ok' | 'error' | 'pendiente' | 'atrasado'> {
  const r = await db
    .prepare(
      `SELECT
         (SELECT max(creado_en) FROM tasas_cambio WHERE pais = 'VE' AND fuente = 'bcv') AS buena,
         (SELECT max(fecha) FROM tasas_cambio WHERE pais = 'VE' AND fuente = 'bcv') AS fecha,
         (SELECT max(fecha) FROM tasas_cambio WHERE pais = 'VE' AND fuente = 'bcv-retenida') AS retenida`,
    )
    .first<{ buena: string | null; fecha: string | null; retenida: string | null }>();
  if (r?.retenida && (!r.fecha || r.retenida > r.fecha)) return 'error';
  if (!r?.buena || !r.fecha) return 'pendiente';
  const limite = new Date(ahora - 4 * 3600_000 - DIAS_VIGENCIA_BCV * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return r.fecha < limite ? 'atrasado' : 'ok';
}

/**
 * La tarea del reloj (C-TASA-BCV-AUTO): a las 14:00 UTC (10:00 de Caracas) lee una vez; a las 20:00
 * UTC solo si ese día no hubo ninguna lectura guardada. Cada vuelta, como mucho la portada y una del
 * respaldo (C-TASA-MODOS); nunca en bucle. No es crítica: sin tasa automática, el equipo la escribe a mano como siempre.
 */
export const TAREA_TASA_BCV: TareaReloj = {
  nombre: 'tasa_bcv',
  critica: false,
  correr: async (env, db) => {
    const prueba = env as unknown as {
      __lectorTasaBcv?: () => Promise<string>;
      __lectorRespaldoBcv?: () => Promise<unknown>;
      __ahora?: number;
    };
    const ahora = prueba.__ahora ?? Date.now();
    const d = new Date(ahora);
    const hhmm = d.toISOString().slice(11, 16);
    if (hhmm !== '14:00' && hhmm !== '20:00') return null;
    // Ninguna prueba sale a internet: sin lector de prueba, dentro de vitest no se lee nada.
    const enPruebas = enVitest();
    if (enPruebas && !prueba.__lectorTasaBcv) return null;
    if (hhmm === '20:00') {
      // La de las 14:00 de hoy quedó hace 6 horas: con algo guardado en las últimas 12, no se lee.
      const hubo = await db
        .prepare(
          "SELECT 1 FROM tasas_cambio WHERE pais = 'VE' AND fuente IN ('bcv', 'bcv-retenida') AND creado_en >= datetime('now', '-12 hours') LIMIT 1",
        )
        .first();
      if (hubo) return null;
    }
    // Rango de cordura configurable por variable del sitio (por defecto, 20 %).
    const pct = Number(env.TASA_BCV_SALTO_PCT);
    return tomarTasaBcv(db, {
      leer: prueba.__lectorTasaBcv,
      // Dentro de vitest, sin lector de prueba del respaldo, tampoco se sale a internet.
      leerRespaldo: prueba.__lectorRespaldoBcv,
      ahora,
      saltoMaximoPct: pct > 0 ? pct : undefined,
    });
  },
};

/** El equivalente local de un monto en dólares, o null si no aplica o no hay tasa vigente. */
export async function referenciaLocal(
  db: D1Database,
  pais: string | null | undefined,
  centavos: number | null | undefined,
  moneda: string | null | undefined,
): Promise<Referencia | null> {
  const local = MONEDA_REFERENCIA.get(pais ?? '');
  if (!local || moneda !== 'USD' || centavos == null || !Number.isSafeInteger(centavos))
    return null;
  const t = await tasaVigente(db, pais ?? '');
  if (!t) return null;
  return { moneda: local, monto: equivalenteLocal(centavos, t.tasa), tasa: t.tasa, fecha: t.fecha };
}

/**
 * C-BS-EN-MANO (18 nov 2026, Venezuela): la tasa que se FIJA con una operación nueva (al cotizar el
 * viaje o al crear el pedido). Null si el país no usa moneda de referencia o no hay tasa vigente.
 * Solo lee (la escritura va en el mismo INSERT de la operación).
 */
export async function tasaParaFijar(
  db: D1Database,
  pais: string | null | undefined,
  moneda: string | null | undefined,
): Promise<TasaFijada | null> {
  if (!aplicaReferencia(pais, moneda)) return null;
  const t = await tasaVigente(db, String(pais));
  const local = MONEDA_REFERENCIA.get(String(pais));
  return t && local ? { moneda: local, tasa: t.tasa, fecha: t.fecha } : null;
}

/**
 * La tasa de una operación: la guardada con ella o, solo si no se guardó (operación de antes del
 * candado, o sin tasa vigente al cotizar), la del día. Mientras haya una guardada, nunca cambia.
 */
export async function tasaDeOperacion(
  db: D1Database,
  pais: string | null | undefined,
  moneda: string | null | undefined,
  guardada: { tasa: number | null | undefined; fecha: string | null | undefined },
): Promise<TasaFijada | null> {
  if (!aplicaReferencia(pais, moneda)) return null;
  return tasaGuardada(pais, guardada.tasa, guardada.fecha) ?? tasaParaFijar(db, pais, moneda);
}

/**
 * C-BS-EN-MANO (Comida con pago al recibir, Venezuela): el equivalente de un monto del pedido con la
 * tasa FIJADA al crearlo (`pedidos.ref_tasa`); un pedido de antes del candado usa la del día.
 */
export async function referenciaDePedido(
  db: D1Database,
  p: { zona_id?: unknown; moneda?: unknown; ref_tasa?: unknown; ref_fecha?: unknown },
  centavos: number,
): Promise<Referencia | null> {
  return (await enManoDePedido(db, p, centavos))?.local ?? null;
}

/**
 * C-BS-EN-MANO (revisión del 18 nov 2026): lo que se paga en mano de un pedido de comida (el total sin
 * la propina), en dólares y en bolívares con la tasa fijada al crearlo, con `sinTasa` si el país la
 * usa y no hay. Lo ven igual el cliente y el repartidor. Null si el pedido no está en dólares.
 */
export async function enManoDePedido(
  db: D1Database,
  p: { zona_id?: unknown; moneda?: unknown; ref_tasa?: unknown; ref_fecha?: unknown },
  centavos: number,
): Promise<MontoEnMano | null> {
  if (p.moneda !== 'USD' || p.zona_id == null || !Number.isSafeInteger(centavos) || centavos < 0)
    return null;
  const { pais } = await paisDeZona(db, String(p.zona_id));
  const tasa = await tasaDeOperacion(db, pais, 'USD', {
    tasa: p.ref_tasa == null ? null : Number(p.ref_tasa),
    fecha: p.ref_fecha == null ? null : String(p.ref_fecha),
  });
  return montoEnMano(centavos, 'USD', pais, tasa);
}

/**
 * C-BS-EN-MANO (revisión del 18 nov 2026): fija la tasa del viaje si todavía no tiene (cotizado sin
 * tasa, o pedido antes del candado) o, con `refijar`, si se cotizó hace más de 48 horas (un viaje
 * programado o tomado mucho después): conductor y pasajero pasan a ver el mismo número nuevo. La
 * llaman los pasos del viaje (aceptar, llegar, iniciar con `refijar`, terminar): mirar no escribe.
 * Una lectura; escribe solo si fija o cambia.
 */
export async function fijarTasaViaje(
  db: D1Database,
  operacionId: string,
  refijar = false,
): Promise<void> {
  const v = await db
    .prepare(
      `SELECT v.ref_tasa, z.pais, q.moneda,
              q.creado_en < datetime('now', '-${HORAS_VIGENCIA_TASA} hours') AS vieja
         FROM viajes v JOIN operaciones o ON o.id = v.operacion_id JOIN zonas z ON z.id = o.zona_id
         LEFT JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id
        WHERE v.operacion_id = ?`,
    )
    .bind(operacionId)
    .first<{
      ref_tasa: number | null;
      pais: string;
      moneda: string | null;
      vieja: number | null;
    }>();
  if (!v || !aplicaReferencia(v.pais, v.moneda)) return;
  if (v.ref_tasa != null && !(refijar && v.vieja === 1)) return;
  const t = await tasaParaFijar(db, v.pais, v.moneda);
  if (!t || t.tasa === v.ref_tasa) return;
  await db
    .prepare('UPDATE viajes SET ref_tasa = ?, ref_fecha = ? WHERE operacion_id = ?')
    .bind(t.tasa, t.fecha, operacionId)
    .run();
}

/**
 * C-BS-EN-MANO: lo cobrado en mano al cerrar el viaje (el total final menos lo que cubrió el regalo),
 * en dólares y en bolívares con la tasa del viaje; deja guardado `ref_monto`. Lee todo de la base, así
 * sirve igual en el cierre y en el reintento de «terminar» (si la respuesta se perdió, se rellena ahí).
 * Con tarjeta no hay nada en mano: null y no se guarda nada.
 */
export async function cobroEnManoDeViaje(
  db: D1Database,
  operacionId: string,
): Promise<{ cobrarEnMano: number; enMano: MontoEnMano | null } | null> {
  await fijarTasaViaje(db, operacionId);
  const f = await db
    .prepare(
      `SELECT v.total_final_centavos AS total, v.metodo_pago, v.ref_tasa, v.ref_fecha, v.ref_monto,
              z.pais, q.moneda,
              (SELECT rg.monto FROM usos_cupon_divoox rg WHERE rg.operacion_id = o.id
                 AND rg.estado <> 'liberado') AS regalo
         FROM viajes v JOIN operaciones o ON o.id = v.operacion_id JOIN zonas z ON z.id = o.zona_id
         LEFT JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id
        WHERE v.operacion_id = ?`,
    )
    .bind(operacionId)
    .first<{
      total: number | null;
      metodo_pago: string;
      ref_tasa: number | null;
      ref_fecha: string | null;
      ref_monto: number | null;
      pais: string;
      moneda: string | null;
      regalo: number | null;
    }>();
  if (!f || f.total == null) return null;
  const total = Number(f.total);
  const cobrarEnMano = Math.max(0, total - Math.min(Number(f.regalo ?? 0), total));
  if (f.metodo_pago === 'tarjeta') return { cobrarEnMano, enMano: null };
  const enMano = montoEnMano(
    cobrarEnMano,
    f.moneda ?? 'USD',
    f.pais,
    tasaGuardada(f.pais, f.ref_tasa, f.ref_fecha),
  );
  if (enMano.local && f.ref_monto !== enMano.local.monto)
    await db
      .prepare('UPDATE viajes SET ref_monto = ? WHERE operacion_id = ?')
      .bind(enMano.local.monto, operacionId)
      .run();
  return { cobrarEnMano, enMano };
}

tasasReferencia.get('/admin/tasas-referencia', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const paises = [...MONEDA_REFERENCIA.keys()];
  const filas = await Promise.all(
    paises.map((pais) =>
      db
        .prepare(
          `SELECT t.tasa, t.fecha, t.creado_en, u.nombre AS puesta_por,
                  t.creado_en > datetime('now', '-${HORAS_VIGENCIA_TASA} hours') AS vigente
             FROM tasas_cambio t LEFT JOIN usuarios u ON u.id = t.creado_por
            WHERE t.pais = ? AND t.fuente = 'equipo' ORDER BY t.creado_en DESC LIMIT 1`,
        )
        .bind(pais)
        .first<{
          tasa: number;
          fecha: string;
          creado_en: string;
          puesta_por: string | null;
          vigente: number;
        }>(),
    ),
  );
  // C-TASA-BCV-AUTO / C-TASA-MODOS: la oficial, el modo y la que se usa hoy, para que el equipo
  // las vea. Solo lecturas.
  const detalle = await Promise.all(
    paises.map(async (pais) => {
      const [enUso, oficial, m] = await Promise.all([
        tasaVigente(db, pais),
        tasaOficial(db, pais),
        db
          .prepare(
            `SELECT m.modo, m.ajuste_pct, m.tasa_fija, m.cambiado_en, u.nombre AS cambiado_por
               FROM tasas_modo m LEFT JOIN usuarios u ON u.id = m.cambiado_por WHERE m.pais = ?`,
          )
          .bind(pais)
          .first<ModoTasa>(),
      ]);
      return { enUso, oficial, m };
    }),
  );
  return c.json({
    horasVigencia: HORAS_VIGENCIA_TASA,
    ajusteMaximoPct: AJUSTE_MAXIMO_PCT,
    tasas: paises.map((pais, i) => {
      const f = filas.at(i);
      const d = detalle.at(i);
      const u = d?.enUso;
      return {
        pais,
        moneda: MONEDA_REFERENCIA.get(pais),
        tasa: f?.tasa ?? null,
        fecha: f?.fecha ?? null,
        puestaEn: f?.creado_en ?? null,
        puestaPor: f?.puesta_por ?? null,
        vigente: f?.vigente === 1,
        enUso: u ? { tasa: u.tasa, fecha: u.fecha, fuente: u.fuente } : null,
        oficial: d?.oficial
          ? { tasa: d.oficial.tasa, fecha: d.oficial.fecha, fuente: d.oficial.fuente }
          : null,
        modo: {
          modo: d?.m?.modo ?? 'oficial',
          ajustePct: d?.m?.ajuste_pct ?? null,
          tasaFija: d?.m?.tasa_fija ?? null,
          cambiadoEn: d?.m?.cambiado_en ?? null,
          cambiadoPor: d?.m?.cambiado_por ?? null,
        },
      };
    }),
  });
});

const CUERPO_MODO = z.discriminatedUnion('modo', [
  z.object({ modo: z.literal('oficial') }),
  z.object({
    modo: z.literal('flotante'),
    ajustePct: z.number().finite().min(-AJUSTE_MAXIMO_PCT).max(AJUSTE_MAXIMO_PCT),
  }),
  z.object({ modo: z.literal('fija'), tasaFija: z.number().positive().max(10_000_000) }),
]);

/**
 * C-TASA-MODOS: el equipo elige cómo sale la tasa del país. Una escritura y su auditoría (antes y
 * después); el cambio vale desde ya para todo lo que muestra bolívares de referencia.
 */
tasasReferencia.put('/admin/tasas-referencia/:pais/modo', async (c) => {
  const admin = exigir(c, 'admin');
  const pais = c.req.param('pais').toUpperCase();
  if (!MONEDA_REFERENCIA.has(pais))
    throw new ErrorDatos('En este país los viajes no necesitan tasa de referencia.', 'pais', 422);
  const d = await leerCuerpo(c, CUERPO_MODO);
  const db = base(c);
  const antes = await modoTasa(db, pais);
  const ajuste = d.modo === 'flotante' ? d.ajustePct : null;
  const fija = d.modo === 'fija' ? d.tasaFija : null;
  await db.batch([
    db
      .prepare(
        `INSERT INTO tasas_modo (pais, modo, ajuste_pct, tasa_fija, cambiado_por, cambiado_en)
         VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
         ON CONFLICT (pais) DO UPDATE SET modo = ?2, ajuste_pct = ?3, tasa_fija = ?4,
           cambiado_por = ?5, cambiado_en = datetime('now')`,
      )
      .bind(pais, d.modo, ajuste, fija, admin.id),
    db
      .prepare(
        'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        admin.id,
        'tasa.modo',
        `tasa:${pais}`,
        JSON.stringify({
          modo: antes.modo,
          ajustePct: antes.ajuste_pct,
          tasaFija: antes.tasa_fija,
        }),
        JSON.stringify({ modo: d.modo, ajustePct: ajuste, tasaFija: fija }),
      ),
  ]);
  const enUso = await tasaVigente(db, pais);
  return c.json({
    pais,
    modo: d.modo,
    enUso: enUso ? { tasa: enUso.tasa, fecha: enUso.fecha, fuente: enUso.fuente } : null,
  });
});

tasasReferencia.put('/admin/tasas-referencia/:pais', async (c) => {
  const admin = exigir(c, 'admin');
  const pais = c.req.param('pais').toUpperCase();
  if (!MONEDA_REFERENCIA.has(pais))
    throw new ErrorDatos('En este país los viajes no necesitan tasa de referencia.', 'pais', 422);
  const { tasa } = await leerCuerpo(c, z.object({ tasa: z.number().positive().max(10_000_000) }));
  const db = base(c);
  const fecha = hoyEn(pais);
  // Una por día: si se corrige el mismo día, la nueva reemplaza a la anterior (y su hora cuenta
  // de nuevo para las 48 horas). La auditoría guarda las dos.
  await db.batch([
    db
      .prepare(
        "INSERT OR REPLACE INTO tasas_cambio (pais, fecha, fuente, tasa, creado_por) VALUES (?, ?, 'equipo', ?, ?)",
      )
      .bind(pais, fecha, tasa, admin.id),
    db
      .prepare(
        'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(admin.id, 'tasa.referencia', `tasa:${pais}`, null, JSON.stringify({ tasa, fecha })),
  ]);
  return c.json({ pais, tasa, fecha });
});
