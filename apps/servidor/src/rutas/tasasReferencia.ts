import { Hono } from 'hono';
import { z } from 'zod';
import {
  HORAS_VIGENCIA_TASA,
  MONEDA_REFERENCIA,
  type Referencia,
  equivalenteLocal,
} from '@tumbite/compartido';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';

/**
 * C-BS-REFERENCIA (13 nov 2026, Venezuela): la tasa del día para mostrar el equivalente en
 * bolívares de un viaje cobrado en dólares. La escribe una persona del equipo en el panel (la
 * oficial del BCV, copiada a mano): sin proveedor externo ni tarea automática. Vive en
 * `tasas_cambio` con fuente «equipo», quién la puso y cuándo. Con más de 48 horas no se muestra.
 * Solo informativa: no cambia ningún monto ni la comisión.
 */
export const tasasReferencia = new Hono<{ Bindings: Env; Variables: Variables }>();

const hoyEn = (pais: string) =>
  // Venezuela: UTC−4 todo el año (sin horario de verano).
  new Date(Date.now() - (pais === 'VE' ? 4 : 0) * 3600_000).toISOString().slice(0, 10);

type FilaTasa = { tasa: number; fecha: string; creado_en: string; creado_por: string | null };

/** La tasa vigente del país (escrita hace menos de 48 horas), o null. Lee una fila. */
export async function tasaVigente(db: D1Database, pais: string): Promise<FilaTasa | null> {
  if (!MONEDA_REFERENCIA.has(pais)) return null;
  return db
    .prepare(
      `SELECT tasa, fecha, creado_en, creado_por FROM tasas_cambio
        WHERE pais = ? AND fuente = 'equipo' AND creado_en > datetime('now', '-${HORAS_VIGENCIA_TASA} hours')
        ORDER BY creado_en DESC LIMIT 1`,
    )
    .bind(pais)
    .first<FilaTasa>();
}

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
  return c.json({
    horasVigencia: HORAS_VIGENCIA_TASA,
    tasas: paises.map((pais, i) => {
      const f = filas.at(i);
      return {
        pais,
        moneda: MONEDA_REFERENCIA.get(pais),
        tasa: f?.tasa ?? null,
        fecha: f?.fecha ?? null,
        puestaEn: f?.creado_en ?? null,
        puestaPor: f?.puesta_por ?? null,
        vigente: f?.vigente === 1,
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
