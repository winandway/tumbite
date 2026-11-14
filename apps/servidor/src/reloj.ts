import { entornoDe } from './entorno';
import type { Env } from './env';

/**
 * C-RELOJ-PRUEBAS-PAUSA (7 nov 2026, orden de Richard por Gerencia): mientras Divoox esté en
 * pausa, el reloj del sitio de pruebas no hace NADA. No toca la base ni corre tareas, venga de
 * GitHub o del reloj externo de Cloudflare. Producción no cambia.
 * PARA ENCENDERLO AL RETOMAR: poner esto en false, volver a poner el paso «Pruebas» en
 * .github/workflows/reloj.yml y publicar.
 */
export const RELOJ_PRUEBAS_EN_PAUSA = true;

export const relojEnPausa = (url: string) => RELOJ_PRUEBAS_EN_PAUSA && entornoDe(url) === 'pruebas';

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
  /**
   * LECT-3: las limpiezas que pueden esperar corren una vez por hora (la primera vuelta de cada
   * hora), no cada minuto. Sin esto, cada vuelta.
   */
  cada?: 'hora';
  /** LECT-3: cuántas filas espera escribir como mucho en una vuelta (la declara cada limpieza). */
  escriturasEsperadas?: number;
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
  /** C-PRESUPUESTO-FILAS: si devuelve un motivo, las tareas que faltan no corren. */
  alto: () => string | null = () => null,
): Promise<ResultadoVuelta> {
  const resultados: ResultadoTarea[] = [];
  for (const t of tareas) {
    const motivo = alto();
    if (motivo) {
      console.error(`reloj: la tarea «${t.nombre}» no corrió: ${motivo}`);
      resultados.push({ nombre: t.nombre, critica: t.critica, ok: false, ms: 0, error: motivo });
      continue;
    }
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
  const motivoFinal = alto();
  if (motivoFinal) {
    console.error(`reloj: ${motivoFinal}`);
    resultados.push({
      nombre: 'presupuesto',
      critica: false,
      ok: false,
      ms: 0,
      error: motivoFinal,
    });
  }
  const fallidas = resultados.filter((r) => !r.ok).map((r) => r.nombre);
  return { estado: fallidas.length ? 'parcial' : 'ok', tareas: resultados, fallidas };
}

/**
 * Guarda SOLO las tareas que fallaron (C-RELOJ-SOLO-FALLAS). Antes se guardaba una fila por tarea
 * en cada vuelta, también las buenas: unas 43 filas por minuto, 62.000 al día en el sitio de
 * pruebas, y una tabla de 212.000 filas que la limpieza y la salud recorrían enteras (390 millones
 * de lecturas el 6 nov). Una vuelta buena ya queda en tareas_programadas; aquí solo va lo que
 * hay que mirar.
 */
export async function anotarTareas(db: D1Database, clave: string, r: ResultadoVuelta) {
  const fallidas = r.tareas.filter((t) => !t.ok);
  if (!fallidas.length) return;
  await db.batch(
    fallidas.map((t) =>
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
/**
 * C-RELOJ-CANARIO-MINUTOS (13 nov 2026): el reloj de producción es el Worker de Cloudflare
 * `tumbite-reloj-produccion`, que llama cada minuto a la MISMA ruta que GitHub (sin las llaves de
 * la ruta firmada, así que el servidor no lo distingue por la configuración). Se reconoce por su
 * ritmo: entre las últimas `VUELTAS_RITMO` vueltas, al menos `SEGUIDAS_RITMO` separaciones de 2
 * minutos o menos. Con ese ritmo, la pieza se vigila como con el reloj externo: error si pasan
 * más de 5 minutos sin una vuelta buena. Si el Worker se cae, el canario se pone en rojo a los 5
 * minutos (antes, 6 horas) y sigue en rojo mientras las últimas vueltas conserven ese ritmo,
 * aunque GitHub (el respaldo) haga alguna vuelta suelta: tras cada una hay 5 minutos en verde.
 * Sin ritmo de minuto (solo GitHub), las reglas de siempre (6 h atrasado, 24 h error).
 */
export const VUELTAS_RITMO = 6;
export const SEGUIDAS_RITMO = 3;

/** Las últimas vueltas tienen el ritmo de un reloj de cada minuto. */
export function ritmoDeMinuto(empezadas: readonly string[]): boolean {
  const t = empezadas.map((x) => Date.parse(`${x.replace(' ', 'T')}Z`)).filter(Number.isFinite);
  const seguidas = t
    .slice(1)
    .filter((x, i) => Math.abs((t.at(i) ?? x) - x) <= 2 * 60_000 + 30_000).length;
  return seguidas >= SEGUIDAS_RITMO;
}

/** Solo con GitHub (impuntual): más de esto sin vuelta buena es «atrasado», no error. */
export const HORAS_ATRASO_GITHUB = 6;
/** Solo con GitHub: pasado un día entero sin vuelta buena, el canario SÍ se pone en rojo (F11). */
export const HORAS_ERROR_GITHUB = 24;

/**
 * Pieza «reloj» de la salud.
 *
 * - Con el reloj externo (Cloudflare) configurado, que corre cada minuto:
 *   error si no hubo una vuelta BUENA (terminada y sin tareas fallidas) en 5 minutos, si hubo
 *   3 o más vueltas con error en 15 minutos, o si la última vuelta terminada tuvo una tarea
 *   crítica fallida, aunque la vuelta haya terminado. Igual si las últimas vueltas llevan el
 *   ritmo de un reloj de cada minuto (el Worker por la ruta de GitHub, C-RELOJ-CANARIO-MINUTOS).
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
  // LECT-3: con la marca fija, la hora de la última vuelta y el ritmo salen de UNA fila.
  const marcadas = await vueltasMarcadas(db);
  if (marcadas.length) return saludPorMarca(db, externo, marcadas);
  return saludPorFilas(db, externo);
}

/**
 * LECT-3: la salud del reloj leyendo la marca fija. Una vuelta marcada es buena si no dejó fila de
 * error ni tareas fallidas (las vueltas buenas y ociosas no dejan fila: ahí está el ahorro). Las
 * mismas reglas de siempre: con ritmo de minuto (Worker), error a los 5 minutos sin vuelta buena,
 * con 3 fallidas en 15 minutos o con una crítica fallida en la última; solo GitHub, 6 h y 24 h.
 */
async function saludPorMarca(
  db: D1Database,
  externo: boolean,
  marcadas: VueltaMarcada[],
): Promise<'ok' | 'error' | 'atrasado' | 'pendiente'> {
  const claves = marcadas.map((v) => `reloj:${v.ventana}`);
  const marcas = claves.map((_, i) => `?${i + 3}`).join(', ');
  const f = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM tareas_programadas t
           WHERE t.tarea = 'reloj' AND t.empezada_en > datetime('now', ?1)
             AND (t.resultado LIKE '% error' OR EXISTS (SELECT 1 FROM reloj_tareas r WHERE r.clave = t.clave AND r.ok = 0))) AS fallidas,
         (SELECT COUNT(*) FROM reloj_tareas r WHERE r.clave = ?2 AND r.critica = 1 AND r.ok = 0) AS criticas_ultima,
         (SELECT group_concat(t.clave, ' ') FROM tareas_programadas t
           WHERE t.clave IN (${marcas})
             AND (t.resultado LIKE '% error' OR EXISTS (SELECT 1 FROM reloj_tareas r WHERE r.clave = t.clave AND r.ok = 0))) AS falladas,
         (SELECT t.terminada_en FROM tareas_programadas t
           WHERE t.empezada_en > datetime('now', '-25 hours') AND t.tarea = 'reloj'
             AND t.terminada_en IS NOT NULL AND t.resultado NOT LIKE '% error'
             AND NOT EXISTS (SELECT 1 FROM reloj_tareas r WHERE r.clave = t.clave AND r.ok = 0)
           ORDER BY t.empezada_en DESC LIMIT 1) AS buena_en_filas`,
    )
    .bind(`-${VENTANA_FALLIDAS_MIN} minutes`, claves[0], ...claves)
    .first<{
      fallidas: number;
      criticas_ultima: number;
      falladas: string | null;
      buena_en_filas: string | null;
    }>();
  if (Number(f?.criticas_ultima ?? 0) > 0) return 'error';
  const falladas = new Set(String(f?.falladas ?? '').split(' '));
  const buena = marcadas.find((v) => !falladas.has(`reloj:${v.ventana}`));
  const ultimaBuena = [buena ? horaDeVentana(buena.ventana) : null, f?.buena_en_filas ?? null]
    .filter((x): x is string => !!x)
    .sort()
    .at(-1);
  const cadaMinuto = externo || ritmoDeMinuto(marcadas.map((v) => horaDeVentana(v.ventana)));
  const viejaHace = (minutos: number) =>
    !ultimaBuena ||
    ultimaBuena <
      new Date(Date.now() - minutos * 60_000).toISOString().replace('T', ' ').slice(0, 19);
  if (cadaMinuto) {
    if (Number(f?.fallidas ?? 0) >= FALLIDAS_MAX) return 'error';
    if (viejaHace(MINUTOS_SIN_VUELTA_BUENA)) return 'error';
    return 'ok';
  }
  if (viejaHace(HORAS_ERROR_GITHUB * 60)) return 'error';
  return viejaHace(HORAS_ATRASO_GITHUB * 60) ? 'atrasado' : 'ok';
}

/** La hora de la última vuelta del reloj (la marca; sin marca, la última fila de vuelta). */
export async function ultimaVueltaReloj(db: D1Database): Promise<string | null> {
  const [ultima] = await vueltasMarcadas(db);
  if (ultima) return horaDeVentana(ultima.ventana);
  const f = await db
    .prepare("SELECT MAX(empezada_en) AS ultima FROM tareas_programadas WHERE tarea = 'reloj'")
    .first<{ ultima: string | null }>();
  return f?.ultima ?? null;
}

/** La salud del reloj por las filas de vuelta: bases que todavía no tienen la marca (LECT-3). */
async function saludPorFilas(
  db: D1Database,
  externo: boolean,
): Promise<'ok' | 'error' | 'atrasado' | 'pendiente'> {
  const f = await db
    .prepare(
      // C-RELOJ-SOLO-FALLAS: cada subconsulta camina el índice de empezada_en desde la vuelta
      // más nueva y se corta enseguida; nada recorre la tabla entera (antes, 261.000 lecturas
      // por llamada a la salud).
      `SELECT
         (SELECT t.terminada_en FROM tareas_programadas t
           WHERE t.empezada_en > datetime('now', '-25 hours') AND t.tarea = 'reloj'
             AND t.terminada_en IS NOT NULL AND t.resultado NOT LIKE '% error'
             AND NOT EXISTS (SELECT 1 FROM reloj_tareas r WHERE r.clave = t.clave AND r.ok = 0)
           ORDER BY t.empezada_en DESC LIMIT 1) AS ultima_buena,
         (SELECT COUNT(*) FROM tareas_programadas t
           WHERE t.tarea = 'reloj' AND t.empezada_en > datetime('now', ?1)
             AND (t.resultado LIKE '% error' OR EXISTS (SELECT 1 FROM reloj_tareas r WHERE r.clave = t.clave AND r.ok = 0))) AS fallidas,
         (SELECT COUNT(*) FROM reloj_tareas r
           WHERE r.clave = (SELECT t.clave FROM tareas_programadas t
                             WHERE t.empezada_en > datetime('now', '-25 hours') AND t.tarea = 'reloj'
                               AND t.terminada_en IS NOT NULL
                             ORDER BY t.empezada_en DESC LIMIT 1)
             AND r.critica = 1 AND r.ok = 0) AS criticas_ultima,
         (SELECT COUNT(*) FROM (SELECT 1 FROM tareas_programadas t WHERE t.tarea = 'reloj' LIMIT 1)) AS vueltas`,
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
  // C-RELOJ-CANARIO-MINUTOS: el ritmo de las últimas vueltas (por el índice de empezada_en, se
  // corta a las 6).
  const { results: ultimas } = await db
    .prepare(
      `SELECT empezada_en FROM tareas_programadas
        WHERE empezada_en > datetime('now', '-25 hours') AND tarea = 'reloj'
        ORDER BY empezada_en DESC LIMIT ${VUELTAS_RITMO}`,
    )
    .all<{ empezada_en: string }>();
  const cadaMinuto = externo || ritmoDeMinuto(ultimas.map((u) => u.empezada_en));
  const viejaHace = (minutos: number) =>
    !f.ultima_buena ||
    f.ultima_buena <
      new Date(Date.now() - minutos * 60_000).toISOString().replace('T', ' ').slice(0, 19);
  if (cadaMinuto) {
    if (Number(f.fallidas) >= FALLIDAS_MAX) return 'error';
    if (viejaHace(MINUTOS_SIN_VUELTA_BUENA)) return 'error';
    return 'ok';
  }
  if (viejaHace(HORAS_ERROR_GITHUB * 60)) return 'error';
  return viejaHace(HORAS_ATRASO_GITHUB * 60) ? 'atrasado' : 'ok';
}

// ======================= LECT-3: la marca fija del reloj =======================

/**
 * LECT-3 (13 nov 2026, orden de Richard; regla «la nube no se come el dinero»). Todos los países.
 *
 * Antes cada vuelta del reloj (una por minuto con el Worker de producción) creaba una fila en
 * `tareas_programadas` y la actualizaba al terminar: unas 4 filas escritas por minuto, 5.800 al
 * día, más 4.300 que la limpieza borraba: unas 10.000 filas al día con el reloj ocioso.
 *
 * Ahora el candado por minuto (C-RELOJ-UNA-VEZ) es UNA fila fija de `config` (`reloj_marca`),
 * tomada en una sola sentencia atómica: `INSERT … ON CONFLICT DO UPDATE … WHERE la última ventana
 * < la nueva`. El que llega segundo en ese minuto (GitHub, el Worker o un reintento en otro
 * aislado) no cambia nada y no corre. La misma fila guarda las últimas seis ventanas con su origen
 * (`AAAA-MM-DDTHH:MMe`, «e» externo, «g» GitHub): con eso el canario sabe la hora de la última
 * vuelta y el ritmo del Worker sin leer filas de vueltas. Cuesta una fila escrita por minuto.
 *
 * En `tareas_programadas` queda una fila solo si la vuelta falló, si sus tareas escribieron algo,
 * y una por hora (el latido: la primera vuelta de cada hora).
 */
export const VUELTAS_EN_MARCA = 6;
export const claveMarca = (tarea: string) => `${tarea}_marca`;
const VENTANA_CANONICA = /^\d{4}-\d\d-\d\dT\d\d:\d\d$/;
const LARGO_MARCA = VUELTAS_EN_MARCA * 17 + (VUELTAS_EN_MARCA - 1);

export type VueltaMarcada = { ventana: string; origen: 'externo' | 'github' };

/** Las vueltas de la marca, de la más nueva a la más vieja (pueden haberse tomado en otro orden). */
function leerVentanas(valor: string | null | undefined): VueltaMarcada[] {
  return String(valor ?? '')
    .split(' ')
    .filter((x) => x.length >= 16)
    .map((x) => ({
      ventana: x.slice(0, 16),
      origen: x.charAt(16) === 'g' ? ('github' as const) : ('externo' as const),
    }))
    .sort((x, y) => (x.ventana < y.ventana ? 1 : x.ventana > y.ventana ? -1 : 0));
}

/**
 * Toma el minuto `ventana` para `tarea`. Devuelve las vueltas marcadas (la más nueva primero) si
 * este llamado ganó el minuto, o null si ese minuto ya está en la marca (lo tomó otro). Una vuelta
 * lenta y la del minuto siguiente pueden llegar en cualquier orden: las dos corren.
 */
export async function tomarMinuto(
  db: D1Database,
  tarea: string,
  ventana: string,
  origen: 'externo' | 'github',
): Promise<VueltaMarcada[] | null> {
  // El reloj real solo acepta ventanas de minuto: una ventana rara («diag-…») escrita en la marca
  // la dejaría por delante de todas las de verdad y el reloj no volvería a correr.
  if (tarea === 'reloj' && !VENTANA_CANONICA.test(ventana))
    throw new Error(`reloj: ventana inválida «${ventana}»`);
  const fila = await db
    .prepare(
      `INSERT INTO config (clave, valor) VALUES (?1, ?2)
       ON CONFLICT(clave) DO UPDATE SET valor = substr(excluded.valor || ' ' || config.valor, 1, ${LARGO_MARCA}),
         actualizado_en = datetime('now')
       WHERE instr(config.valor, substr(excluded.valor, 1, 16)) = 0
       RETURNING valor`,
    )
    .bind(claveMarca(tarea), `${ventana}${origen === 'github' ? 'g' : 'e'}`)
    .first<{ valor: string }>();
  return fila ? leerVentanas(fila.valor) : null;
}

/** Las últimas vueltas marcadas del reloj (la más nueva primero); vacío si nunca corrió. */
export async function vueltasMarcadas(db: D1Database, tarea = 'reloj'): Promise<VueltaMarcada[]> {
  const f = await db
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(claveMarca(tarea))
    .first<{ valor: string }>();
  return leerVentanas(f?.valor);
}

/** La hora de una ventana en el formato de las fechas de la base («AAAA-MM-DD HH:MM:00»). */
export const horaDeVentana = (ventana: string) => `${ventana.replace('T', ' ')}:00`;

/** Las tareas de cada hora corren en la primera vuelta de cada hora (y en la primera de todas). */
export const esPrimeraDeLaHora = (ventana: string, anterior: string | undefined) =>
  !anterior || anterior.slice(0, 13) !== ventana.slice(0, 13);

/** La limpieza diaria: la primera vuelta del día desde las 04:00 UTC. */
export const esPrimeraDelDia = (ventana: string, anterior: string | undefined) => {
  const corte = `${ventana.slice(0, 10)}T04:00`;
  return ventana >= corte && (!anterior || anterior < corte);
};
