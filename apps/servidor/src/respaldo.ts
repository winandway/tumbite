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

const HOSTS_PRUEBAS = new Set([
  'staging.tumbite.com',
  'tumbite-pruebas.sitios.dev',
  'localhost',
  '127.0.0.1',
]);

/**
 * Restaurar un respaldo (punto 28): vuelve a dejar cada tabla como estaba ese día. SOLO en el sitio
 * de pruebas (doble cerrojo: host de pruebas + secreto del reloj): es la prueba de que los respaldos
 * sirven. En producción nunca; si hiciera falta, se hace a mano con la copia y el equipo delante.
 */
export async function restaurarDesdeRespaldo(db: D1Database, almacen: R2Bucket, dia: string) {
  const lista = await almacen.list({ prefix: `respaldos/${dia}/` });
  const borrados: D1PreparedStatement[] = [];
  const insertados: D1PreparedStatement[] = [];
  let tablas = 0;
  let filas = 0;
  for (const o of lista.objects) {
    const tabla = o.key.split('/')[2]?.replace(/\.json$/, '') ?? '';
    if (!/^[a-z_]+$/.test(tabla) || NO_SE_RESPALDAN.has(tabla)) continue;
    const obj = await almacen.get(o.key);
    if (!obj) continue;
    // `body` es un stream tanto en R2 real como en el almacén de pruebas.
    const datos = JSON.parse(await new Response(obj.body).text()) as Record<string, unknown>[];
    const existe = await db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .bind(tabla)
      .first();
    if (!existe) continue;
    borrados.push(db.prepare(`DELETE FROM "${tabla}"`));
    if (datos.length) {
      const columnas = Object.keys(datos[0]!).filter((k) => /^[a-z_0-9]+$/.test(k));
      const sql = `INSERT INTO "${tabla}" (${columnas.map((k) => `"${k}"`).join(',')}) VALUES (${columnas.map(() => '?').join(',')})`;
      for (const f of datos)
        insertados.push(
          db.prepare(sql).bind(...columnas.map((k) => new Map(Object.entries(f)).get(k) ?? null)),
        );
    }
    tablas++;
    filas += datos.length;
  }
  if (!tablas) return { tablas, filas };
  // Los disparadores de negocio (transiciones de pedidos, servicios) no aplican a una copia fiel:
  // se quitan durante la carga y se vuelven a crear con su mismo SQL al terminar.
  const { results: disparadores } = await db
    .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND sql IS NOT NULL")
    .all<{ name: string; sql: string }>();
  // Las llaves foráneas se revisan al final: primero se vacían todas las tablas y después se
  // vuelven a llenar, en una sola transacción (D1 difiere las comprobaciones; en local se apagan).
  await db
    .prepare('PRAGMA foreign_keys = OFF')
    .run()
    .catch(() => undefined);
  try {
    await db.batch([
      db.prepare('PRAGMA defer_foreign_keys = ON'),
      ...disparadores.map((d) => db.prepare(`DROP TRIGGER IF EXISTS "${d.name}"`)),
      ...borrados,
      ...insertados,
      ...disparadores.map((d) => db.prepare(d.sql)),
    ]);
  } finally {
    await db
      .prepare('PRAGMA foreign_keys = ON')
      .run()
      .catch(() => undefined);
  }
  return { tablas, filas };
}

respaldo.post('/respaldo/restaurar', async (c) => {
  const host = new URL(c.req.url).hostname;
  if (!HOSTS_PRUEBAS.has(host)) return c.json({ error: 'Solo en el sitio de pruebas.' }, 403);
  const secreto = c.env.RELOJ_SECRETO;
  if (!secreto || c.req.header('x-reloj-secreto') !== secreto)
    return c.json({ error: 'no autorizado' }, 401);
  if (!c.env.BUCKET) return c.json({ error: 'Sin almacén (BUCKET).' }, 503);
  const dia = String(c.req.query('dia') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return c.json({ error: 'Falta el día (AAAA-MM-DD).' }, 400);
  const r = await restaurarDesdeRespaldo(base(c), c.env.BUCKET, dia);
  return c.json({ ok: true, ...r });
});
