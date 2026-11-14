import { Hono } from 'hono';
import { z } from 'zod';
import {
  HORAS_VIGENCIA_TASA,
  MONEDA_REFERENCIA,
  type Referencia,
  equivalenteLocal,
  leerTasaBcv,
} from '@tumbite/compartido';
import type { TareaReloj } from '../reloj';
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

/**
 * C-TASA-BCV-AUTO: la oficial automática vale con fecha valor de hoy o de hasta estos días atrás
 * (fines de semana y feriados largos no tienen publicación).
 */
export const DIAS_VIGENCIA_BCV = 5;

/** La tasa vigente del país, o null. Lee una fila (una sola consulta por el índice de la tabla). */
export async function tasaVigente(
  db: D1Database,
  pais: string,
  ahora = Date.now(),
): Promise<FilaTasa | null> {
  if (!MONEDA_REFERENCIA.has(pais)) return null;
  const hoy = hoyEn(pais, ahora);
  return db
    .prepare(
      `SELECT tasa, fecha, creado_en, creado_por, fuente FROM tasas_cambio
        WHERE pais = ?
          AND ((fuente = 'equipo' AND creado_en > datetime(?, '-${HORAS_VIGENCIA_TASA} hours'))
            OR (fuente = 'bcv' AND fecha <= ? AND fecha >= date(?, '-${DIAS_VIGENCIA_BCV} days')))
        ORDER BY CASE WHEN fuente = 'equipo' AND fecha = ? THEN 0 WHEN fuente = 'bcv' THEN 1 ELSE 2 END,
                 fecha DESC, creado_en DESC
        LIMIT 1`,
    )
    .bind(pais, sqlUtc(ahora), hoy, hoy, hoy)
    .first<FilaTasa>();
}

/** Una hora como la escribe SQLite («AAAA-MM-DD HH:MM:SS», UTC). */
const sqlUtc = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

const URL_BCV = 'https://www.bcv.org.ve/';
/** Más de esto de diferencia con la última oficial guardada: no se usa (queda retenida). */
export const SALTO_MAXIMO_PCT = 20;

/** Lee la portada del Banco Central: UNA petición, con tope de tiempo, sin reintentos. */
async function leerPortadaBcv(): Promise<string> {
  const r = await fetch(URL_BCV, {
    headers: { 'user-agent': 'Divoox/1.0 (+https://divoox.com)' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`el Banco Central respondió ${r.status}`);
  return r.text();
}

export type ResultadoTasaBcv =
  | { estado: 'guardada'; tasa: number; fecha: string }
  | { estado: 'retenida'; tasa: number; fecha: string; anterior: number }
  | { estado: 'sin-lectura'; motivo: string };

/**
 * C-TASA-BCV-AUTO: toma la tasa oficial del día de la portada del Banco Central y la guarda con su
 * fecha valor y fuente «bcv» (una lectura externa y una escritura). Si se aparta de la última
 * guardada más de `saltoMaximoPct`, NO se usa: se guarda como «bcv-retenida» (nadie la lee para
 * cobrar ni mostrar) y el canario se pone en rojo. Nunca lanza.
 */
export async function tomarTasaBcv(
  db: D1Database,
  opciones: { leer?: () => Promise<string>; ahora?: number; saltoMaximoPct?: number } = {},
): Promise<ResultadoTasaBcv> {
  let html: string;
  try {
    html = await (opciones.leer ?? leerPortadaBcv)();
  } catch (e) {
    console.error('tasa bcv: no se pudo leer la portada', e);
    return { estado: 'sin-lectura', motivo: String(e) };
  }
  const leida = leerTasaBcv(html);
  if (!leida?.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(leida.fecha)) {
    console.error('tasa bcv: la portada no trae la tasa o su fecha valor');
    return { estado: 'sin-lectura', motivo: 'la portada cambió de forma' };
  }
  const ultima = await db
    .prepare(
      "SELECT tasa FROM tasas_cambio WHERE pais = 'VE' AND fuente = 'bcv' AND fecha <= ? ORDER BY fecha DESC LIMIT 1",
    )
    .bind(leida.fecha)
    .first<{ tasa: number }>();
  const pct = opciones.saltoMaximoPct ?? SALTO_MAXIMO_PCT;
  const retenida = ultima && ultima.tasa > 0 && Math.abs(leida.tasa / ultima.tasa - 1) * 100 > pct;
  await db
    .prepare('INSERT OR REPLACE INTO tasas_cambio (pais, fecha, fuente, tasa) VALUES (?, ?, ?, ?)')
    .bind('VE', leida.fecha, retenida ? 'bcv-retenida' : 'bcv', leida.tasa)
    .run();
  if (retenida) {
    console.error(
      `tasa bcv: ${leida.tasa} se aparta más de ${pct} % de la última (${ultima.tasa}); retenida`,
    );
    return { estado: 'retenida', tasa: leida.tasa, fecha: leida.fecha, anterior: ultima.tasa };
  }
  return { estado: 'guardada', tasa: leida.tasa, fecha: leida.fecha };
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
         (SELECT max(creado_en) FROM tasas_cambio WHERE pais = 'VE' AND fuente = 'bcv-retenida') AS retenida`,
    )
    .first<{ buena: string | null; fecha: string | null; retenida: string | null }>();
  if (r?.retenida && (!r.buena || r.retenida >= r.buena)) return 'error';
  if (!r?.buena || !r.fecha) return 'pendiente';
  const limite = new Date(ahora - 4 * 3600_000 - DIAS_VIGENCIA_BCV * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return r.fecha < limite ? 'atrasado' : 'ok';
}

/**
 * La tarea del reloj (C-TASA-BCV-AUTO): a las 14:00 UTC (10:00 de Caracas) lee una vez; a las 20:00
 * UTC solo si ese día no hubo ninguna lectura guardada. Máximo dos lecturas externas al día, nunca en
 * bucle. No es crítica: sin tasa automática, el equipo la escribe a mano como siempre.
 */
export const TAREA_TASA_BCV: TareaReloj = {
  nombre: 'tasa_bcv',
  critica: false,
  correr: async (env, db) => {
    const prueba = env as unknown as { __lectorTasaBcv?: () => Promise<string>; __ahora?: number };
    const ahora = prueba.__ahora ?? Date.now();
    const d = new Date(ahora);
    const hhmm = d.toISOString().slice(11, 16);
    if (hhmm !== '14:00' && hhmm !== '20:00') return null;
    if (hhmm === '20:00') {
      // La de las 14:00 de hoy quedó hace 6 horas: con algo guardado en las últimas 12, no se lee.
      const hubo = await db
        .prepare(
          "SELECT 1 FROM tasas_cambio WHERE pais = 'VE' AND fuente IN ('bcv', 'bcv-retenida') AND creado_en >= datetime('now', '-12 hours') LIMIT 1",
        )
        .first();
      if (hubo) return null;
    }
    return tomarTasaBcv(db, { leer: prueba.__lectorTasaBcv, ahora });
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
  // C-TASA-BCV-AUTO: la oficial automática y la que se usa hoy, para que el equipo las vea.
  const enUso = await Promise.all(paises.map((pais) => tasaVigente(db, pais)));
  return c.json({
    horasVigencia: HORAS_VIGENCIA_TASA,
    tasas: paises.map((pais, i) => {
      const f = filas.at(i);
      const u = enUso.at(i);
      return {
        pais,
        moneda: MONEDA_REFERENCIA.get(pais),
        tasa: f?.tasa ?? null,
        fecha: f?.fecha ?? null,
        puestaEn: f?.creado_en ?? null,
        puestaPor: f?.puesta_por ?? null,
        vigente: f?.vigente === 1,
        enUso: u ? { tasa: u.tasa, fecha: u.fecha, fuente: u.fuente } : null,
      };
    }),
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
