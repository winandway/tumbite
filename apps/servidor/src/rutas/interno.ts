import {
  type LlaveFirma,
  emitirPase,
  firmarPeticion,
  geohash,
  verificarFirma,
} from '@tumbite/compartido';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { ErrorDatos } from '../validar';
import { correrReloj } from './operacion';

/**
 * Fase 2 · Puerta interna entre YaDominios Cloud y los Workers externos de Cloudflare
 * (docs/FASE-2-TIEMPO-REAL.md; V1.2 §4). Reglas:
 *   - Solo se entra con firma HMAC válida, dentro de 60 s, con un nonce que nunca se usó.
 *   - Cada ruta interna hace UNA cosa y no toca dinero: el reloj corre las tareas de siempre y el
 *     lote de ubicaciones solo mueve posiciones de repartidores libres (sin pedido en curso).
 *   - Sin las variables, nada de esto existe (404) y todo sigue como hoy.
 */
export const interno = new Hono<{ Bindings: Env; Variables: Variables }>();

/** Rutas que la llave interna puede usar. Cualquier otra ruta del servidor la ignora. */
export const RUTAS_INTERNAS = ['/datos/interno/reloj', '/datos/interno/ubicaciones/lote'] as const;

const llavesEntrada = (env: Env): (LlaveFirma | null)[] => [
  env.INTERNO_LLAVE_ID && env.INTERNO_SECRETO_ACTUAL
    ? { id: env.INTERNO_LLAVE_ID, secreto: env.INTERNO_SECRETO_ACTUAL }
    : null,
  env.INTERNO_LLAVE_ID_ANTERIOR && env.INTERNO_SECRETO_ANTERIOR
    ? { id: env.INTERNO_LLAVE_ID_ANTERIOR, secreto: env.INTERNO_SECRETO_ANTERIOR }
    : null,
];
export const llavesPase = (env: Env): (LlaveFirma | null)[] => [
  env.PASE_LLAVE_ID && env.PASE_SECRETO_ACTUAL
    ? { id: env.PASE_LLAVE_ID, secreto: env.PASE_SECRETO_ACTUAL }
    : null,
  env.PASE_LLAVE_ID_ANTERIOR && env.PASE_SECRETO_ANTERIOR
    ? { id: env.PASE_LLAVE_ID_ANTERIOR, secreto: env.PASE_SECRETO_ANTERIOR }
    : null,
];

type Firmada = { cuerpo: unknown; repetida: boolean };

/**
 * Verifica la firma y registra el nonce en la misma sentencia que decide si es nuevo.
 * Devuelve el cuerpo ya leído. Un nonce repetido no repite efectos: responde «ya hecho».
 */
async function exigirFirma(c: Ctx): Promise<Firmada> {
  const ruta = c.req.path;
  if (!llavesEntrada(c.env).some(Boolean) || !(RUTAS_INTERNAS as readonly string[]).includes(ruta))
    throw new ErrorDatos('No encontrado.', undefined, 404);
  const texto = await c.req.text();
  if (texto.length > 200_000) throw new ErrorDatos('Petición demasiado grande.', undefined, 413);
  const r = await verificarFirma(llavesEntrada(c.env), c.req.method, ruta, texto, (k) =>
    c.req.header(k),
  );
  if (!r.ok) throw new ErrorDatos('Firma no válida.', r.motivo, 401);
  const nuevo = await base(c)
    .prepare('INSERT OR IGNORE INTO peticiones_internas (nonce, llave_id, ruta) VALUES (?, ?, ?)')
    .bind(r.nonce, r.llaveId, ruta)
    .run();
  let cuerpo: unknown;
  try {
    cuerpo = texto ? JSON.parse(texto) : {};
  } catch {
    throw new ErrorDatos('Cuerpo no válido.', undefined, 400);
  }
  return { cuerpo, repetida: !nuevo.meta.changes };
}

function validar<T>(esquema: z.ZodType<T>, datos: unknown): T {
  const r = esquema.safeParse(datos);
  if (!r.success) throw new ErrorDatos('Cuerpo no válido.', undefined, 400);
  return r.data;
}

// ---------------------------------------------------------------- reloj (cada minuto)

const ventanaMinuto = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

interno.post('/interno/reloj', async (c) => {
  const f = await exigirFirma(c);
  if (f.repetida) return c.json({ ok: true, yaHecho: true });
  const { ventana } = validar(z.object({ ventana: ventanaMinuto }), f.cuerpo);
  // No se aceptan ventanas inventadas: a lo sumo 5 minutos de diferencia con la hora real.
  if (Math.abs(Date.parse(`${ventana}:00Z`) - Date.now()) > 5 * 60_000)
    throw new ErrorDatos('Ventana fuera de tiempo.', 'ventana', 409);
  const db = base(c);
  const clave = `reloj:${ventana}`;
  const nueva = await db
    .prepare("INSERT OR IGNORE INTO tareas_programadas (clave, tarea) VALUES (?, 'reloj')")
    .bind(clave)
    .run();
  if (!nueva.meta.changes) return c.json({ ok: true, yaHecho: true, ventana });
  let resultado: Awaited<ReturnType<typeof correrReloj>>;
  try {
    resultado = await correrReloj(c.env, db);
  } catch (e) {
    console.error('reloj interno', e);
    await db
      .prepare("UPDATE tareas_programadas SET resultado = 'error' WHERE clave = ?")
      .bind(clave)
      .run();
    throw e;
  }
  // Limpieza: nonces de más de 10 minutos, tareas y lotes de más de 7 días.
  await db.batch([
    db
      .prepare(
        "UPDATE tareas_programadas SET terminada_en = datetime('now'), resultado = ? WHERE clave = ?",
      )
      .bind(JSON.stringify(resultado).slice(0, 2000), clave),
    db.prepare(
      "DELETE FROM peticiones_internas WHERE recibida_en < datetime('now', '-10 minutes')",
    ),
    db.prepare("DELETE FROM tareas_programadas WHERE empezada_en < datetime('now', '-7 days')"),
    db.prepare("DELETE FROM lotes_ubicacion WHERE recibido_en < datetime('now', '-7 days')"),
  ]);
  return c.json({ ok: true, ventana, resultado });
});

// ---------------------------------------------------------------- lote de ubicaciones

const muestra = z.object({
  c: z.string().min(1).max(64),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  t: z.number().int().positive(), // milisegundos Unix
});
const MAX_MUESTRAS = 500;

/** «2026-10-15 13:04:05», el mismo formato que datetime('now') de la base. */
const aSql = (ms: number) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);

interno.post('/interno/ubicaciones/lote', async (c) => {
  const f = await exigirFirma(c);
  if (f.repetida) return c.json({ ok: true, yaHecho: true });
  const d = validar(
    z.object({
      loteId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
      zona: z.string().min(2).max(40),
      muestras: z.array(muestra).max(MAX_MUESTRAS),
    }),
    f.cuerpo,
  );
  const ahora = Date.now();
  // Ni del futuro (más de 60 s) ni viejas (más de 10 minutos): esas no mueven a nadie.
  const utiles = d.muestras
    .filter((m) => m.t <= ahora + 60_000 && m.t >= ahora - 10 * 60_000)
    .map((m) => ({ c: m.c, lat: m.lat, lng: m.lng, g: geohash(m.lat, m.lng), t: aSql(m.t) }));
  const db = base(c);
  const [lote, cambio] = await db.batch([
    db
      .prepare(
        'INSERT INTO lotes_ubicacion (lote_id, zona_id, muestras) SELECT ?1, ?2, ?3 WHERE NOT EXISTS (SELECT 1 FROM lotes_ubicacion WHERE lote_id = ?1)',
      )
      .bind(d.loteId, d.zona, utiles.length),
    // Solo la ficha de posición. Un repartidor con un pedido en curso NO se mueve desde aquí:
    // su ubicación sigue por la ruta actual, que detecta saltos de GPS y marca las llegadas.
    db
      .prepare(
        `UPDATE repartidores
            SET lat = m.lat, lng = m.lng, geohash = m.g, ubicacion_en = m.t
           FROM (SELECT json_extract(value, '$.c') AS c, json_extract(value, '$.lat') AS lat,
                        json_extract(value, '$.lng') AS lng, json_extract(value, '$.g') AS g,
                        json_extract(value, '$.t') AS t
                   FROM json_each(?2)) AS m
          WHERE repartidores.usuario_id = m.c AND repartidores.zona_id = ?1
            AND repartidores.conectado = 1
            AND (repartidores.ubicacion_en IS NULL OR m.t > repartidores.ubicacion_en)
            AND NOT EXISTS (SELECT 1 FROM pedidos p WHERE p.repartidor_id = repartidores.usuario_id
                             AND p.estado IN ('aceptado', 'listo', 'en_camino'))`,
      )
      .bind(d.zona, JSON.stringify(utiles)),
  ]);
  return c.json({
    ok: true,
    loteNuevo: Boolean(lote?.meta.changes),
    aplicadas: cambio?.meta.changes ?? 0,
    descartadas: d.muestras.length - utiles.length,
  });
});

// ---------------------------------------------------------------- pase corto para las apps

interno.post('/tiempo-real/pase', async (c) => {
  const u = exigir(c, 'repartidor', 'cliente');
  const llave = llavesPase(c.env)[0];
  if (!llave || !c.env.TIEMPO_REAL_URL)
    throw new ErrorDatos(
      'El seguimiento en vivo no está disponible ahora; la app sigue funcionando como siempre.',
      undefined,
      503,
    );
  const db = base(c);
  const cuerpo = (await c.req.json().catch(() => ({}))) as unknown;
  if (u.rol === 'repartidor') {
    const f = await db
      .prepare(
        `SELECT COALESCE(r.zona_id, u.zona_id, 'US-FL-MIAMI') AS zona FROM usuarios u
           LEFT JOIN repartidores r ON r.usuario_id = u.id WHERE u.id = ?`,
      )
      .bind(u.id)
      .first<{ zona: string }>();
    const p = await emitirPase(llave, {
      u: u.id,
      rol: 'repartidor',
      zona: f?.zona ?? 'US-FL-MIAMI',
    });
    return c.json({ ...p, url: c.env.TIEMPO_REAL_URL });
  }
  // Cliente: solo sigue SU pedido, y solo mientras está en curso.
  const { pedidoId } = validar(z.object({ pedidoId: z.string().min(1).max(64) }), cuerpo);
  const ped = await db
    .prepare(
      `SELECT zona_id, repartidor_id FROM pedidos
        WHERE id = ? AND cliente_id = ? AND estado IN ('pagado', 'aceptado', 'listo', 'en_camino')`,
    )
    .bind(pedidoId, u.id)
    .first<{ zona_id: string; repartidor_id: string | null }>();
  if (!ped) throw new ErrorDatos('Este pedido ya no se puede seguir en vivo.', undefined, 404);
  const p = await emitirPase(llave, {
    u: u.id,
    rol: 'cliente',
    zona: ped.zona_id,
    p: pedidoId,
    ...(ped.repartidor_id ? { r: ped.repartidor_id } : {}),
  });
  return c.json({ ...p, url: c.env.TIEMPO_REAL_URL });
});

// ---------------------------------------------------------------- avisos hacia el Worker

export type AvisoTiempoReal = {
  /** id único del aviso: el Worker lo usa para no entregarlo dos veces */
  id: string;
  /** a quién: usuarios o seguidores de un pedido */
  para: { usuarios?: string[]; pedido?: string };
  datos: Record<string, unknown>;
};

/**
 * Empuja avisos al Worker de tiempo real (ofertas, cambios de estado). Nunca lanza: si el tiempo
 * real no está o falla, las apps se enteran igual con su consulta de respaldo.
 */
export async function avisarTiempoReal(
  env: Env,
  zona: string,
  avisos: AvisoTiempoReal[],
  hacer: typeof fetch = fetch,
): Promise<boolean> {
  if (!env.TIEMPO_REAL_URL || !env.AVISOS_LLAVE_ID || !env.AVISOS_SECRETO || !avisos.length)
    return false;
  const ruta = `/v1/interno/zona/${encodeURIComponent(zona)}/avisar`;
  const cuerpo = JSON.stringify({ avisos });
  try {
    const h = await firmarPeticion(
      { id: env.AVISOS_LLAVE_ID, secreto: env.AVISOS_SECRETO },
      'POST',
      ruta,
      cuerpo,
    );
    const r = await hacer(new URL(ruta, env.TIEMPO_REAL_URL).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...h },
      body: cuerpo,
      signal: AbortSignal.timeout(3000),
    });
    return r.ok;
  } catch (e) {
    console.error('tiempo real: aviso', e);
    return false;
  }
}

/** Pieza «tiempoReal» de la salud: apagado (pendiente), o al día con el reloj externo. */
export async function saludTiempoReal(
  env: Env,
  db: D1Database,
): Promise<'ok' | 'pendiente' | 'atrasado'> {
  if (!env.TIEMPO_REAL_URL || !llavesEntrada(env).some(Boolean)) return 'pendiente';
  const f = await db
    .prepare("SELECT MAX(empezada_en) AS ultima FROM tareas_programadas WHERE tarea = 'reloj'")
    .first<{ ultima: string | null }>();
  if (!f?.ultima) return 'pendiente';
  return f.ultima >= aSql(Date.now() - 5 * 60_000) ? 'ok' : 'atrasado';
}
