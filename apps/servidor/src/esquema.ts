/**
 * Migraciones seguras. schema.sql corre en cada publicación pero solo crea lo que no existe:
 * NO agrega columnas a tablas que ya están en producción. Esto sí, sin tocar datos:
 * revisa qué columnas faltan, las agrega, y crea los índices que dependen de ellas.
 * Corre una vez por arranque del servidor. Si algo falla, lo dice la salud.
 */
const COLUMNAS: [tabla: string, columna: string, definicion: string][] = [
  ['usuarios', 'zona_id', 'TEXT'],
  ['restaurantes', 'zona_id', "TEXT NOT NULL DEFAULT 'US-FL-MIAMI'"],
  ['restaurantes', 'geohash', 'TEXT'],
  ['repartidores', 'zona_id', "TEXT NOT NULL DEFAULT 'US-FL-MIAMI'"],
  ['repartidores', 'geohash', 'TEXT'],
  ['pedidos', 'zona_id', "TEXT NOT NULL DEFAULT 'US-FL-MIAMI'"],
];

/** Índices compuestos: primero la zona (filtra casi todo), luego el estado, luego orden o celda. */
const INDICES = [
  'CREATE INDEX IF NOT EXISTS restaurantes_zona_estado ON restaurantes(zona_id, estado, abierto)',
  'CREATE INDEX IF NOT EXISTS restaurantes_zona_celda ON restaurantes(zona_id, geohash)',
  'CREATE INDEX IF NOT EXISTS repartidores_zona_celda ON repartidores(zona_id, conectado, geohash)',
  'CREATE INDEX IF NOT EXISTS pedidos_zona_estado ON pedidos(zona_id, estado, creado_en)',
  'CREATE INDEX IF NOT EXISTS pedidos_repartidor_estado ON pedidos(repartidor_id, estado)',
  'CREATE INDEX IF NOT EXISTS lista_espera_zona ON lista_espera(zona_id, tipo, creado_en)',
];

let listo: Promise<void> | null = null;
export let ultimoErrorEsquema: string | null = null;

async function migrar(db: D1Database): Promise<void> {
  for (const [tabla, columna, definicion] of COLUMNAS) {
    const { results } = await db
      .prepare(`SELECT name FROM pragma_table_info('${tabla}')`)
      .all<{ name: string }>();
    if (!results.length) continue; // la tabla aún no existe (la crea schema.sql)
    if (!results.some((r) => r.name === columna)) {
      await db.prepare(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`).run();
      console.warn(`esquema: columna agregada ${tabla}.${columna}`);
    }
  }
  for (const sql of INDICES) await db.prepare(sql).run();
}

export function asegurarEsquema(db: D1Database): Promise<void> {
  listo ??= migrar(db).then(
    () => {
      ultimoErrorEsquema = null;
    },
    (e: unknown) => {
      ultimoErrorEsquema = String(e);
      console.error('esquema: la migración falló', e);
      listo = null; // se reintenta en la siguiente petición
    },
  );
  return listo;
}

/** Solo para pruebas: cada base nueva vuelve a migrar. */
export function reiniciarEsquema(): void {
  listo = null;
}
