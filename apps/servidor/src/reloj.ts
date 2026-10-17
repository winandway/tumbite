import type { Env } from './env';

/**
 * Reloj seguro (docs/EVALUACION-RELOJ-CLOUDFLARE.md, candado C-RELOJ-AISLADO).
 *
 * Cada tarea del reloj corre con su propio manejo de errores: si una falla, las demás corren
 * igual, y el resultado de cada una queda en `reloj_tareas`. Antes, la primera tarea que fallaba
 * frenaba a todas las de detrás en esa vuelta (11 minutos seguidos en el sitio de pruebas, 16 oct).
 *
 * Recuperarse es seguro porque cada tarea ya es repetible: la vuelta siguiente la vuelve a
 * intentar, y lo que mueve dinero usa siempre la misma clave en Stripe (no hay dos devoluciones
 * ni dos transferencias). Aquí no se reintenta dentro de la misma vuelta.
 */
export type TareaReloj = {
  nombre: string;
  /** Crítica = toca pedidos o dinero. Si falla, la salud se pone en rojo aunque la vuelta termine. */
  critica: boolean;
  correr: (env: Env, db: D1Database) => Promise<unknown>;
};

export type ResultadoTarea = {
  nombre: string;
  critica: boolean;
  ok: boolean;
  ms: number;
  error?: string;
  datos?: unknown;
};

export type ResultadoVuelta = {
  estado: 'ok' | 'parcial';
  tareas: ResultadoTarea[];
  fallidas: string[];
};

export async function correrTareas(
  env: Env,
  db: D1Database,
  tareas: readonly TareaReloj[],
  ahora: () => number = Date.now,
): Promise<ResultadoVuelta> {
  const resultados: ResultadoTarea[] = [];
  for (const t of tareas) {
    const inicio = ahora();
    try {
      const datos = await t.correr(env, db);
      resultados.push({
        nombre: t.nombre,
        critica: t.critica,
        ok: true,
        ms: ahora() - inicio,
        datos,
      });
    } catch (e) {
      // Nunca en silencio: queda en el registro y en reloj_tareas, y la salud lo ve.
      console.error(`reloj: la tarea «${t.nombre}» falló`, e);
      resultados.push({
        nombre: t.nombre,
        critica: t.critica,
        ok: false,
        ms: ahora() - inicio,
        error: String((e as { message?: string })?.message ?? e).slice(0, 300),
      });
    }
  }
  const fallidas = resultados.filter((r) => !r.ok).map((r) => r.nombre);
  return { estado: fallidas.length ? 'parcial' : 'ok', tareas: resultados, fallidas };
}

/** Guarda el resultado de cada tarea de la vuelta (una fila por tarea, en un solo lote). */
export async function anotarTareas(db: D1Database, clave: string, r: ResultadoVuelta) {
  if (!r.tareas.length) return;
  await db.batch(
    r.tareas.map((t) =>
      db
        .prepare(
          'INSERT OR REPLACE INTO reloj_tareas (clave, tarea, critica, ok, ms, error) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(
          clave,
          t.nombre,
          t.critica ? 1 : 0,
          t.ok ? 1 : 0,
          Math.max(0, Math.round(t.ms)),
          t.error ?? '',
        ),
    ),
  );
}

/** Minutos sin una vuelta buena para dar el reloj por caído (con el reloj externo cada minuto). */
export const MINUTOS_SIN_VUELTA_BUENA = 5;
/** Vueltas con error en la ventana de vigilancia que ya son un problema. */
export const FALLIDAS_MAX = 3;
export const VENTANA_FALLIDAS_MIN = 15;
/** Solo con GitHub (impuntual): más de esto sin vuelta buena es «atrasado», no error. */
export const HORAS_ATRASO_GITHUB = 6;

/**
 * Pieza «reloj» de la salud.
 *
 * - Con el reloj externo (Cloudflare) configurado, que corre cada minuto:
 *   error si no hubo una vuelta BUENA (terminada y sin tareas fallidas) en 5 minutos, si hubo
 *   3 o más vueltas con error en 15 minutos, o si la última vuelta terminada tuvo una tarea
 *   crítica fallida, aunque la vuelta haya terminado.
 * - Solo con GitHub (impuntual por diseño): «atrasado» si no hubo vuelta buena en 6 horas; error
 *   solo si la última vuelta tuvo una tarea crítica fallida.
 * - Se recupera sola: en cuanto llega una vuelta buena y las fallidas salen de la ventana.
 */
export async function saludReloj(
  env: Env,
  db: D1Database,
): Promise<'ok' | 'error' | 'atrasado' | 'pendiente'> {
  const externo = Boolean(
    (env.INTERNO_LLAVE_ID && env.INTERNO_SECRETO_ACTUAL) ||
    (env.INTERNO_LLAVE_ID_ANTERIOR && env.INTERNO_SECRETO_ANTERIOR),
  );
  const f = await db
    .prepare(
      `SELECT
         (SELECT MAX(t.terminada_en) FROM tareas_programadas t
           WHERE t.tarea = 'reloj' AND t.terminada_en IS NOT NULL AND t.resultado NOT LIKE '% error'
             AND NOT EXISTS (SELECT 1 FROM reloj_tareas r WHERE r.clave = t.clave AND r.ok = 0)) AS ultima_buena,
         (SELECT COUNT(*) FROM tareas_programadas t
           WHERE t.tarea = 'reloj' AND t.empezada_en > datetime('now', ?1)
             AND (t.resultado LIKE '% error' OR EXISTS (SELECT 1 FROM reloj_tareas r WHERE r.clave = t.clave AND r.ok = 0))) AS fallidas,
         (SELECT COUNT(*) FROM reloj_tareas r
           WHERE r.clave = (SELECT t.clave FROM tareas_programadas t
                             WHERE t.tarea = 'reloj' AND t.terminada_en IS NOT NULL
                             ORDER BY t.terminada_en DESC LIMIT 1)
             AND r.critica = 1 AND r.ok = 0) AS criticas_ultima,
         (SELECT COUNT(*) FROM tareas_programadas t WHERE t.tarea = 'reloj') AS vueltas`,
    )
    .bind(`-${VENTANA_FALLIDAS_MIN} minutes`)
    .first<{
      ultima_buena: string | null;
      fallidas: number;
      criticas_ultima: number;
      vueltas: number;
    }>();
  if (!f || Number(f.vueltas) === 0) return 'pendiente';
  if (Number(f.criticas_ultima) > 0) return 'error';
  const viejaHace = (minutos: number) =>
    !f.ultima_buena ||
    f.ultima_buena <
      new Date(Date.now() - minutos * 60_000).toISOString().replace('T', ' ').slice(0, 19);
  if (externo) {
    if (Number(f.fallidas) >= FALLIDAS_MAX) return 'error';
    if (viejaHace(MINUTOS_SIN_VUELTA_BUENA)) return 'error';
    return 'ok';
  }
  return viejaHace(HORAS_ATRASO_GITHUB * 60) ? 'atrasado' : 'ok';
}
