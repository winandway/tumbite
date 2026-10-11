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
