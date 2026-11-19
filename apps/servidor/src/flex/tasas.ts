import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { actorDeEmpresa, exigirPermiso, sentenciaAuditoria } from './autorizacion';
import { paisDeEmpresa } from './ubicacion';
import { AJUSTE_MAXIMO_PCT, referenciaOficial, tasaCreible } from '../rutas/tasasReferencia';

/**
 * Divoox Flex · C-FLEX-TASA (Venezuela): la tasa del día para ver en dólares lo cobrado en
 * bolívares. La oficial se lee una vez al día de la página pública del Banco Central y se guarda; si
 * no responde, se usa la última guardada con su fecha. La empresa puede poner la suya y manda ese
 * día. Divoox no cambia dinero: solo muestra la equivalencia.
 */
export const flexTasas = new Hono<{ Bindings: Env; Variables: Variables }>();

const hoyVenezuela = () => new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10);

export type TasaDelDia = { tasa: number; fecha: string; fuente: 'bcv' | 'empresa'; deHoy: boolean };

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
  // C-TASA-CORDURA (19 nov 2026): la oficial sale de la pieza única de la tasa (la que el reloj lee
  // del Banco Central con su validación de cordura). Flex ya no la lee por su cuenta ni escribe la
  // suya: antes guardaba lo leído con la fecha de hoy, sin fecha valor y sin validar.
  const oficial = (await referenciaOficial(db, pais)).oficial;
  return oficial
    ? { tasa: oficial.tasa, fecha: oficial.fecha, fuente: 'bcv', deHoy: oficial.fecha >= hoy }
    : null;
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
  // C-TASA-CORDURA: la tasa de la empresa también tiene que parecerse a la oficial (hasta 30 %).
  if (!tasaCreible(d.tasa, await referenciaOficial(db, pais), AJUSTE_MAXIMO_PCT))
    throw new ErrorDatos(
      'Esa tasa se aleja demasiado de la oficial del Banco Central. Revisa el número.',
      'tasa',
      422,
    );
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
