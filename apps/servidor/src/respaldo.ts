import { Hono } from 'hono';
import type { Env } from './env';
import { type Variables, base } from './sesion';
import { ErrorDatos } from './validar';

/**
 * Copia de seguridad diaria de la base: cada tabla se vuelca a JSON en el almacén del sitio
 * (`respaldos/AAAA-MM-DD/<tabla>.json`). El reloj de GitHub la pide una vez al día.
 * Se guardan los últimos 30 días; lo más viejo se borra. El canario dice cuándo fue el último.
 */
export const respaldo = new Hono<{ Bindings: Env; Variables: Variables }>();

export const DIAS_QUE_SE_GUARDAN = 30;
/** Las sesiones no se respaldan: son tokens vivos y volverían a servir si alguien leyera el archivo. */
const NO_SE_RESPALDAN = new Set(['sesiones']);

export let ultimoRespaldo: { cuando: string; tablas: number; filas: number } | null = null;
export let ultimoErrorRespaldo: { cuando: string; motivo: string } | null = null;

async function igualesSeguro(a: string, b: string): Promise<boolean> {
  const h = async (x: string) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(x)));
  const [ha, hb] = await Promise.all([h(a), h(b)]);
  return ha.every((v, i) => v === hb.at(i));
}

respaldo.post('/respaldo', async (c) => {
  const secreto = c.env.RELOJ_SECRETO;
  const dado = c.req.header('x-reloj-secreto') ?? '';
  if (!secreto || dado.length !== secreto.length || !(await igualesSeguro(dado, secreto)))
    throw new ErrorDatos('No encontrado.', undefined, 404);
  if (!c.env.BUCKET) {
    ultimoErrorRespaldo = { cuando: new Date().toISOString(), motivo: 'Sin almacén (BUCKET).' };
    throw new ErrorDatos('El almacén no está disponible.', undefined, 503);
  }
  // El reloj de GitHub no corre a horario fijo (a veces pasa horas sin correr): lo pide en cada
  // vuelta con ?siHaceFalta=1 y aquí se hace solo si hoy todavía no hay uno.
  const hoy = new Date().toISOString().slice(0, 10);
  if (c.req.query('siHaceFalta') && (await fechaUltimoRespaldo(c.env.BUCKET)) === hoy)
    return c.json({ ok: true, omitido: true, ultimo: hoy });
  try {
    const r = await respaldarBase(base(c), c.env.BUCKET);
    ultimoRespaldo = { cuando: new Date().toISOString(), ...r };
    ultimoErrorRespaldo = null;
    return c.json({ ok: true, ...ultimoRespaldo });
  } catch (e) {
    ultimoErrorRespaldo = { cuando: new Date().toISOString(), motivo: String(e) };
    console.error('respaldo:', e);
    throw new ErrorDatos('No se pudo hacer la copia de seguridad.', undefined, 503);
  }
});

/**
 * Fecha (AAAA-MM-DD) del respaldo más nuevo que hay de verdad en el almacén, o null.
 * El canario lee esto y no una variable en memoria (que se pierde en cada reinicio y decía
 * «ok» sin que hubiera ni un respaldo). Candado C-RESPALDO-REAL.
 */
export async function fechaUltimoRespaldo(almacen: R2Bucket): Promise<string | null> {
  let ultima: string | null = null;
  let cursor: string | undefined;
  do {
    const lista = await almacen.list({ prefix: 'respaldos/', cursor });
    for (const o of lista.objects) {
      const dia = o.key.split('/')[1] ?? '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(dia) && (!ultima || dia > ultima)) ultima = dia;
    }
    cursor = lista.truncated ? lista.cursor : undefined;
  } while (cursor);
  return ultima;
}

/** 'ok' si hay respaldo de hoy o de ayer; 'atrasado' si no (visible en /datos/salud). */
export function estadoRespaldo(ultima: string | null, ahora = new Date()): 'ok' | 'atrasado' {
  const ayer = new Date(ahora.getTime() - 86_400_000).toISOString().slice(0, 10);
  return ultima && ultima >= ayer ? 'ok' : 'atrasado';
}

export async function respaldarBase(db: D1Database, almacen: R2Bucket) {
  const dia = new Date().toISOString().slice(0, 10);
  const { results: tablas } = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
    )
    .all<{ name: string }>();
  let filas = 0;
  let n = 0;
  for (const { name } of tablas) {
    if (NO_SE_RESPALDAN.has(name) || !/^[a-z_]+$/.test(name)) continue;
    const { results } = await db.prepare(`SELECT * FROM "${name}"`).all<Record<string, unknown>>();
    await almacen.put(`respaldos/${dia}/${name}.json`, JSON.stringify(results), {
      httpMetadata: { contentType: 'application/json' },
    });
    filas += results.length;
    n++;
  }
  // Se borra lo más viejo que 30 días.
  const limite = new Date(Date.now() - DIAS_QUE_SE_GUARDAN * 86_400_000).toISOString().slice(0, 10);
  let cursor: string | undefined;
  do {
    const lista = await almacen.list({ prefix: 'respaldos/', cursor });
    const viejos = lista.objects
      .map((o) => o.key)
      .filter((k) => (k.split('/')[1] ?? '9999') < limite);
    if (viejos.length) await almacen.delete(viejos);
    cursor = lista.truncated ? lista.cursor : undefined;
  } while (cursor);
  return { tablas: n, filas };
}
