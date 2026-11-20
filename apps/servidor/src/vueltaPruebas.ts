import type { MiddlewareHandler } from 'hono';
import { entornoDe } from './entorno';
import { contarFilas } from './presupuestoFilas';
import type { Env } from './env';

/**
 * C-PRESUPUESTO-VUELTA-PRUEBAS (orden de Gerencia, 12 nov 2026; regla global «cada escritura
 * tiene presupuesto»). Todos los países.
 *
 * Las pruebas automáticas que corren contra el SITIO DE PRUEBAS (la máquina «pruebas-continuas»
 * y el recorrido de cada rama) mandan la cabecera `x-vuelta-pruebas` con el número de su corrida.
 * El servidor cuenta las filas leídas y escritas de cada petición de esa vuelta y las suma en
 * `vueltas_pruebas`. Si la vuelta pasa de su tope, o entre todas las vueltas del día pasan del
 * tope diario (el de desbocado, ver TOPE_DIA_PRUEBAS), la vuelta se frena: cada petición siguiente responde 429 sin tocar nada más, la
 * corrida queda en rojo en GitHub y el canario (`pruebasContinuas`) sale en error.
 *
 * En producción la cabecera se ignora: ahí no hay vueltas de prueba. Solo se guarda la cuenta de
 * una petición que escribió algo o que leyó mucho (LECTURAS_PESADAS): mirar poco no escribe.
 */
export const TOPE_VUELTA_PRUEBAS = { escritas: 6_000 };
/** El recorrido completo de una rama (`rama-…`) prueba todos los servicios: tope aparte. */
export const TOPE_VUELTA_RAMA = { escritas: 20_000 };
/**
 * C-PRUEBAS-NO-SE-FRENAN-POR-EL-DIA (orden de Richard, 20 nov 2026). El 20 nov la suma del día llegó
 * a 120.007 filas y frenó con 429 la corrida que faltaba para publicar: horas paradas por un
 * contador nuestro. Desde hoy la suma del día tiene dos escalones:
 *  - AVISO_DIA_PRUEBAS (120.000): pasado, la corrida SIGUE; se avisa en el registro del servidor y
 *    en el último paso de la corrida (`cuenta-vuelta.mjs`). No frena ni pone el canario en rojo.
 *  - TOPE_DIA_PRUEBAS (600.000): freno de desbocado. Son treinta recorridos completos de rama en un
 *    día (60 centavos de dólar en D1); llegar ahí ya no es trabajo, es un bucle.
 * El freno de verdad contra un bucle sigue siendo el tope POR VUELTA, que no cambia. El presupuesto
 * de PRODUCCIÓN es otra pieza y no se tocó.
 */
export const AVISO_DIA_PRUEBAS = { escritas: 120_000 };
export const TOPE_DIA_PRUEBAS = { escritas: 600_000 };
export const topeDeVuelta = (id: string) =>
  id.startsWith('rama-') ? TOPE_VUELTA_RAMA : TOPE_VUELTA_PRUEBAS;
export const CABECERA_VUELTA = 'x-vuelta-pruebas';

const hoy = () => new Date().toISOString().slice(0, 10);
const idValido = (id: string) => /^[A-Za-z0-9_-]{4,60}$/.test(id);

type Fila = { escritas: number; frenada: number } | null;

export const presupuestoVueltaPruebas: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const id = c.req.header(CABECERA_VUELTA);
  const entorno = entornoDe(c.req.url);
  if (!id || !idValido(id) || !c.env.DB || entorno === 'produccion' || entorno === null)
    return next();
  // La lectura de la cuenta no se frena: es como la corrida se entera de por qué paró.
  if (c.req.path.startsWith('/datos/interno/diagnostico/vuelta')) return next();
  const real = c.env.DB;
  const dia = hoy();
  const vuelta = (await real
    .prepare('SELECT escritas, frenada FROM vueltas_pruebas WHERE id = ?')
    .bind(id)
    .first()) as Fila;
  const delDia = (await real
    .prepare('SELECT COALESCE(SUM(escritas), 0) AS n FROM vueltas_pruebas WHERE dia = ?')
    .bind(dia)
    .first()) as { n: number } | null;
  const motivo =
    (vuelta?.escritas ?? 0) > topeDeVuelta(id).escritas
      ? `presupuesto: la vuelta de pruebas ${id} escribió ${vuelta?.escritas} filas (tope ${topeDeVuelta(id).escritas})`
      : (delDia?.n ?? 0) > TOPE_DIA_PRUEBAS.escritas
        ? `presupuesto: las vueltas de pruebas de hoy escribieron ${delDia?.n} filas (tope diario ${TOPE_DIA_PRUEBAS.escritas})`
        : null;
  if (!motivo && (delDia?.n ?? 0) > AVISO_DIA_PRUEBAS.escritas && !vuelta)
    console.error(
      `aviso: las vueltas de pruebas de hoy llevan ${delDia?.n} filas (aviso desde ${AVISO_DIA_PRUEBAS.escritas}); la vuelta ${id} sigue`,
    );
  if (motivo) {
    console.error(motivo);
    if (!vuelta?.frenada)
      await real
        .prepare(
          `INSERT INTO vueltas_pruebas (id, dia, frenada, creada_en) VALUES (?, ?, 1, ?)
           ON CONFLICT(id) DO UPDATE SET frenada = 1`,
        )
        .bind(id, dia, new Date().toISOString())
        .run();
    return c.json({ error: motivo }, 429);
  }
  const contada = contarFilas(real, { conFirst: true });
  c.env = { ...c.env, DB: contada.db };
  try {
    await next();
  } finally {
    // C-LECTURAS-POR-PETICION: también se anota la petición que solo leyó, si leyó mucho (la que
    // lee poco no gasta ni una fila en anotarse).
    const pesada = contada.cuenta.leidas >= LECTURAS_PESADAS;
    if (contada.cuenta.escritas > 0 || pesada)
      await real
        .prepare(
          `INSERT INTO vueltas_pruebas (id, dia, leidas, escritas, peticiones, creada_en)
           VALUES (?, ?, ?, ?, 1, ?)
           ON CONFLICT(id) DO UPDATE SET leidas = leidas + excluded.leidas,
             escritas = escritas + excluded.escritas, peticiones = peticiones + 1`,
        )
        .bind(id, dia, contada.cuenta.leidas, contada.cuenta.escritas, new Date().toISOString())
        .run()
        .catch((e: unknown) => console.error('vuelta de pruebas: no se pudo anotar la cuenta', e));
    // C-LECTURAS-VUELTA: solo las peticiones pesadas dejan su ruta, para encontrar a la culpable
    // sin gastar una fila por cada petición.
    if (pesada)
      await real
        .prepare(
          `INSERT INTO vueltas_pruebas_rutas (vuelta, ruta, leidas, escritas, veces)
           VALUES (?, ?, ?, ?, 1)
           ON CONFLICT(vuelta, ruta) DO UPDATE SET leidas = leidas + excluded.leidas,
             escritas = escritas + excluded.escritas, veces = veces + 1`,
        )
        .bind(
          id,
          `${c.req.method} ${c.req.routePath}`.slice(0, 120),
          contada.cuenta.leidas,
          contada.cuenta.escritas,
        )
        .run()
        .catch((e: unknown) => console.error('vuelta de pruebas: no se pudo anotar la ruta', e));
  }
};

/** Desde cuántas filas leídas una petición se anota con su ruta. */
export const LECTURAS_PESADAS = 2_000;

/** La cuenta de una vuelta y la del día (para el final de la corrida y para Gerencia). */
export async function cuentaVuelta(db: D1Database, id: string) {
  const vuelta = await db
    .prepare(
      'SELECT id, dia, leidas, escritas, peticiones, frenada FROM vueltas_pruebas WHERE id = ?',
    )
    .bind(id)
    .first();
  const dia = (await db
    .prepare(
      'SELECT COUNT(*) AS vueltas, COALESCE(SUM(escritas), 0) AS escritas FROM vueltas_pruebas WHERE dia = ?',
    )
    .bind(hoy())
    .first()) as { vueltas: number; escritas: number } | null;
  const pesadas = await db
    .prepare(
      'SELECT ruta, leidas, escritas, veces FROM vueltas_pruebas_rutas WHERE vuelta = ? ORDER BY leidas DESC LIMIT 12',
    )
    .bind(id)
    .all();
  return {
    vuelta,
    hoy: dia,
    pesadas: pesadas.results,
    topes: { vuelta: topeDeVuelta(id), dia: TOPE_DIA_PRUEBAS, avisoDia: AVISO_DIA_PRUEBAS },
    avisoDia: (dia?.escritas ?? 0) > AVISO_DIA_PRUEBAS.escritas,
  };
}

/**
 * Canario: rojo si hoy el día pasó del tope o si una vuelta pasó de SU propio tope (un bucle).
 * Una vuelta frenada solo porque el día había llegado al tope no cuenta: dejaba el canario en rojo
 * hasta la medianoche aunque el tope diario ya se hubiera subido (14 nov 2026), y con eso el
 * semáforo del sitio de pruebas rechazaba todas las ramas. En producción no aplica.
 */
export async function saludVueltasPruebas(db: D1Database): Promise<'ok' | 'error'> {
  const filas = (
    await db.prepare('SELECT id, escritas FROM vueltas_pruebas WHERE dia = ?').bind(hoy()).all()
  ).results as { id: string; escritas: number }[];
  const delDia = filas.reduce((n, f) => n + f.escritas, 0);
  const pasada = filas.some((f) => f.escritas > topeDeVuelta(f.id).escritas);
  return pasada || delDia > TOPE_DIA_PRUEBAS.escritas ? 'error' : 'ok';
}
