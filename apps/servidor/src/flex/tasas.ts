import { Hono } from 'hono';
import { z } from 'zod';
import { leerTasaBcv } from '@tumbite/compartido';
import type { Env } from '../env';
import { type Variables, base } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { actorDeEmpresa, exigirPermiso, sentenciaAuditoria } from './autorizacion';
import { paisDeEmpresa } from './ubicacion';

/**
 * Divoox Flex · C-FLEX-TASA (Venezuela): la tasa del día para ver en dólares lo cobrado en
 * bolívares. La oficial se lee una vez al día de la página pública del Banco Central y se guarda; si
 * no responde, se usa la última guardada con su fecha. La empresa puede poner la suya y manda ese
 * día. Divoox no cambia dinero: solo muestra la equivalencia.
 */
export const flexTasas = new Hono<{ Bindings: Env; Variables: Variables }>();

const URL_BCV = 'https://www.bcv.org.ve/';
/**
 * Respaldo: el mismo dólar oficial del Banco Central, republicado por DolarApi (código abierto). Hace
 * falta porque el certificado del Banco Central falla en el entorno del servidor (visto el 28 oct).
 */
const URL_RESPALDO = 'https://ve.dolarapi.com/v1/dolares/oficial';
const hoyVenezuela = () => new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10);

export type TasaDelDia = { tasa: number; fecha: string; fuente: 'bcv' | 'empresa'; deHoy: boolean };

async function leerDelRespaldo(): Promise<{ tasa: number; fecha: string | null } | null> {
  try {
    const r = await fetch(URL_RESPALDO, { signal: AbortSignal.timeout(8_000) });
    if (!r.ok) {
      console.error('tasa: el respaldo respondió', r.status);
      return null;
    }
    const d = (await r.json()) as { promedio?: number; fechaActualizacion?: string };
    if (typeof d.promedio !== 'number' || !(d.promedio > 0)) return null;
    return { tasa: d.promedio, fecha: d.fechaActualizacion?.slice(0, 10) ?? null };
  } catch (e) {
    console.error('tasa: el respaldo no respondió', e);
    return null;
  }
}

async function leerDelBcv(): Promise<{ tasa: number; fecha: string | null } | null> {
  try {
    const r = await fetch(URL_BCV, {
      headers: { 'user-agent': 'Divoox/1.0 (+https://divoox.com)' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) {
      console.error('tasa: el Banco Central respondió', r.status);
      return null;
    }
    const t = leerTasaBcv(await r.text());
    if (!t) console.error('tasa: no se encontró la tasa en la página del Banco Central');
    return t;
  } catch (e) {
    console.error('tasa: el Banco Central no respondió', e);
    return null;
  }
}

/** La tasa que se usa hoy para un país (solo Venezuela por ahora) y, si se da, para una empresa. */
export async function tasaDelDia(
  db: D1Database,
  pais: string,
  empresaId?: string,
): Promise<TasaDelDia | null> {
  if (pais !== 'VE') return null;
  const hoy = hoyVenezuela();
  if (empresaId) {
    const propia = await db
      .prepare('SELECT tasa, fecha FROM tasas_cambio WHERE pais = ? AND fecha = ? AND fuente = ?')
      .bind(pais, hoy, `empresa:${empresaId}`)
      .first<{ tasa: number; fecha: string }>();
    if (propia) return { tasa: propia.tasa, fecha: propia.fecha, fuente: 'empresa', deHoy: true };
  }
  const oficial = await db
    .prepare("SELECT tasa, fecha FROM tasas_cambio WHERE pais = ? AND fecha = ? AND fuente = 'bcv'")
    .bind(pais, hoy)
    .first<{ tasa: number; fecha: string }>();
  if (oficial) return { tasa: oficial.tasa, fecha: oficial.fecha, fuente: 'bcv', deHoy: true };
  const leida = (await leerDelBcv()) ?? (await leerDelRespaldo());
  if (leida) {
    await db
      .prepare(
        "INSERT OR REPLACE INTO tasas_cambio (pais, fecha, fuente, tasa) VALUES (?, ?, 'bcv', ?)",
      )
      .bind(pais, hoy, leida.tasa)
      .run();
    return { tasa: leida.tasa, fecha: hoy, fuente: 'bcv', deHoy: true };
  }
  // Sin respuesta: la última guardada, diciendo de qué día es.
  const ultima = await db
    .prepare(
      "SELECT tasa, fecha FROM tasas_cambio WHERE pais = ? AND fuente = 'bcv' ORDER BY fecha DESC LIMIT 1",
    )
    .bind(pais)
    .first<{ tasa: number; fecha: string }>();
  return ultima ? { tasa: ultima.tasa, fecha: ultima.fecha, fuente: 'bcv', deHoy: false } : null;
}

flexTasas.get('/empresas/:id/tasa', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.ver');
  const db = base(c);
  return c.json({
    tasa: await tasaDelDia(db, await paisDeEmpresa(db, actor.empresaId), actor.empresaId),
  });
});

/** La empresa pone su tasa del día (bolívares por dólar). Solo personas con permiso de finanzas. */
flexTasas.post('/empresas/:id/tasa', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'finanzas.gestionar');
  if (actor.actorTipo !== 'usuario')
    throw new ErrorDatos('La tasa la pone una persona, no una clave.', undefined, 403);
  const d = await leerCuerpo(c, z.object({ tasa: z.number().positive().max(10_000_000) }));
  const db = base(c);
  const pais = await paisDeEmpresa(db, actor.empresaId);
  if (pais !== 'VE')
    throw new ErrorDatos('En este país no hace falta una tasa del día.', 'tasa', 422);
  const hoy = hoyVenezuela();
  await db.batch([
    db
      .prepare(
        'INSERT OR REPLACE INTO tasas_cambio (pais, fecha, fuente, tasa, creado_por) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(pais, hoy, `empresa:${actor.empresaId}`, d.tasa, actor.actorId),
    sentenciaAuditoria(db, actor, 'tasa.guardar', actor.empresaId, { tasa: d.tasa, fecha: hoy }),
  ]);
  return c.json({ tasa: await tasaDelDia(db, pais, actor.empresaId) });
});
