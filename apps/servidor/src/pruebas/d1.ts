import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Base de datos de pruebas: imita la interfaz de D1 sobre SQLite en memoria.
 * Carga el mismo schema.sql que corre en producción.
 */
export function crearBasePruebas(): D1Database {
  const db = new DatabaseSync(':memory:');
  const schema = readFileSync(
    fileURLToPath(new URL('../../../../schema.sql', import.meta.url).href),
    'utf8',
  );
  db.exec(schema);

  function sentencia(sql: string, valores: unknown[] = []) {
    const params = valores.map((v) =>
      v === undefined ? null : typeof v === 'boolean' ? Number(v) : v,
    ) as never[];
    const s = {
      bind: (...nuevos: unknown[]) => sentencia(sql, nuevos),
      async first<T>(columna?: string) {
        const fila = db.prepare(sql).get(...params) as Record<string, unknown> | undefined;
        if (!fila) return null;
        return (columna ? fila[columna] : { ...fila }) as T;
      },
      async all<T>() {
        return {
          results: db
            .prepare(sql)
            .all(...params)
            .map((f: object) => ({ ...f })) as T[],
          success: true,
          meta: {},
        };
      },
      async run() {
        const r = db.prepare(sql).run(...params);
        return {
          success: true,
          meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) },
          results: [],
        };
      },
      async raw() {
        return db
          .prepare(sql)
          .all(...params)
          .map((f: object) => Object.values(f));
      },
      __ejecutar() {
        return db.prepare(sql).run(...params);
      },
    };
    return s;
  }

  return {
    prepare: (sql: string) => sentencia(sql),
    async batch(lista: ReturnType<typeof sentencia>[]) {
      db.exec('BEGIN');
      try {
        const r = lista.map((s) => s.__ejecutar());
        db.exec('COMMIT');
        return r.map(() => ({ success: true, meta: {}, results: [] }));
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    async exec(sql: string) {
      db.exec(sql);
      return { count: 1, duration: 0 };
    },
  } as unknown as D1Database;
}
