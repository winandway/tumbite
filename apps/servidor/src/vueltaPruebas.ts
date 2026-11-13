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
 * tope diario, la vuelta se frena: cada petición siguiente responde 429 sin tocar nada más, la
 * corrida queda en rojo en GitHub y el canario (`pruebasContinuas`) sale en error.
 *
 * En producción la cabecera se ignora: ahí no hay vueltas de prueba. Solo se guarda la cuenta de
 * una petición que escribió algo o que leyó mucho (LECTURAS_PESADAS): mirar poco no escribe.
 */
export const TOPE_VUELTA_PRUEBAS = { escritas: 6_000 };
/** El recorrido completo de una rama (`rama-…`) prueba todos los servicios: tope aparte. */
export const TOPE_VUELTA_RAMA = { escritas: 20_000 };
export const TOPE_DIA_PRUEBAS = { escritas: 30_000 };
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
    topes: { vuelta: topeDeVuelta(id), dia: TOPE_DIA_PRUEBAS },
  };
}

/** Canario: rojo si hoy se frenó una vuelta o el día pasó del tope. En producción no aplica. */
export async function saludVueltasPruebas(db: D1Database): Promise<'ok' | 'error'> {
  const r = (await db
    .prepare(
      'SELECT COALESCE(SUM(escritas), 0) AS escritas, COALESCE(MAX(frenada), 0) AS frenada FROM vueltas_pruebas WHERE dia = ?',
    )
    .bind(hoy())
    .first()) as { escritas: number; frenada: number } | null;
  return r && (r.frenada || r.escritas > TOPE_DIA_PRUEBAS.escritas) ? 'error' : 'ok';
}
