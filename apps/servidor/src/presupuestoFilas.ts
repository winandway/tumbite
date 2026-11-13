/**
 * Presupuesto de filas de la base (C-PRESUPUESTO-FILAS, regla global de Richard del 5 nov 2026:
 * «cada escritura tiene presupuesto»).
 *
 * `contarFilas` envuelve la base y suma las filas leídas y escritas que informa D1 en cada
 * `run`, `all` y `batch`. Las lecturas hechas con `first` no traen ese dato y no se cuentan. Si
 * D1 no informa las filas escritas, se usan las filas cambiadas.
 *
 * El reloj corre cada minuto con la base envuelta. Si una vuelta pasa del tope, las tareas que
 * faltan NO corren, y la vuelta queda con la tarea «presupuesto» fallida. Eso se guarda en
 * reloj_tareas y la salud del reloj lo ve: nunca en silencio.
 */
export type CuentaFilas = { leidas: number; escritas: number };

/** Tope por vuelta del reloj (una por minuto). Un uso normal escribe decenas de filas. */
export const PRESUPUESTO_VUELTA_RELOJ: CuentaFilas = { leidas: 250_000, escritas: 2_000 };

type Meta = { rows_read?: number; rows_written?: number; changes?: number } | undefined;

function sumar(cuenta: CuentaFilas, meta: Meta) {
  if (!meta) return;
  cuenta.leidas += Number(meta.rows_read ?? 0);
  cuenta.escritas += Number(meta.rows_written ?? meta.changes ?? 0);
}

/**
 * `conFirst` (C-LECTURAS-POR-PETICION, solo la vuelta de pruebas): también cuenta las lecturas
 * hechas con `first`, pidiéndolas con `all` (D1 lee lo mismo: `first` ejecuta la consulta entera y
 * se queda con la primera fila, pero no informa las filas). El reloj no lo usa: su tope se fijó
 * midiendo sin esas lecturas.
 */
export function contarFilas(
  db: D1Database,
  { conFirst = false }: { conFirst?: boolean } = {},
): { db: D1Database; cuenta: CuentaFilas } {
  const cuenta: CuentaFilas = { leidas: 0, escritas: 0 };
  const reales = new WeakMap<object, D1PreparedStatement>();

  const envolver = (s: D1PreparedStatement): D1PreparedStatement => {
    const p = new Proxy(s, {
      get(t, prop) {
        if (prop === 'bind') return (...a: unknown[]) => envolver(t.bind(...a));
        if (prop === 'run')
          return async () => {
            const r = await t.run();
            sumar(cuenta, r?.meta as Meta);
            return r;
          };
        if (prop === 'all')
          return async () => {
            const r = await t.all();
            sumar(cuenta, r?.meta as Meta);
            return r;
          };
        if (prop === 'first' && conFirst)
          return async (columna?: string) => {
            const r = await t.all<Record<string, unknown>>();
            sumar(cuenta, r?.meta as Meta);
            const fila = r?.results?.[0];
            if (fila == null) return null;
            if (columna === undefined) return fila;
            const valores = new Map(Object.entries(fila));
            if (!valores.has(columna))
              throw new Error(`D1_COLUMN_NOTFOUND: Column not found (${columna})`);
            return valores.get(columna);
          };
        const v = Reflect.get(t, prop, t) as unknown;
        return typeof v === 'function' ? (v as (...x: unknown[]) => unknown).bind(t) : v;
      },
    });
    reales.set(p, s);
    return p;
  };

  const envuelta = new Proxy(db, {
    get(t, prop) {
      if (prop === 'prepare') return (sql: string) => envolver(t.prepare(sql));
      if (prop === 'batch')
        return async (stmts: D1PreparedStatement[]) => {
          const rs = await t.batch(stmts.map((s) => reales.get(s) ?? s));
          for (const r of rs) sumar(cuenta, (r as { meta?: Meta })?.meta);
          return rs;
        };
      const v = Reflect.get(t, prop, t) as unknown;
      return typeof v === 'function' ? (v as (...x: unknown[]) => unknown).bind(t) : v;
    },
  });
  return { db: envuelta, cuenta };
}

/** Devuelve el motivo si la cuenta pasó del tope; si no, null. */
export function pasoDelTope(cuenta: CuentaFilas, tope: CuentaFilas): string | null {
  if (cuenta.escritas > tope.escritas)
    return `presupuesto: ${cuenta.escritas} filas escritas en la vuelta (tope ${tope.escritas})`;
  if (cuenta.leidas > tope.leidas)
    return `presupuesto: ${cuenta.leidas} filas leídas en la vuelta (tope ${tope.leidas})`;
  return null;
}
