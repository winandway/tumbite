/**
 * Migraciones seguras. schema.sql corre en cada publicación pero solo crea lo que no existe:
 * NO agrega columnas a tablas que ya están en producción. Esto sí, sin tocar datos:
 * revisa qué columnas faltan, las agrega, y crea los índices que dependen de ellas.
 * Corre una vez por arranque del servidor. Si algo falla, lo dice la salud.
 */
const COLUMNAS: [tabla: string, columna: string, definicion: string][] = [
  ['usuarios', 'zona_id', 'TEXT'],
  ['usuarios', 'correo_confirmado_en', 'TEXT'],
  ['usuarios', 'stripe_cliente', 'TEXT'],
  ['restaurantes', 'zona_id', "TEXT NOT NULL DEFAULT 'US-FL-MIAMI'"],
  ['restaurantes', 'geohash', 'TEXT'],
  ['repartidores', 'zona_id', "TEXT NOT NULL DEFAULT 'US-FL-MIAMI'"],
  ['repartidores', 'geohash', 'TEXT'],
  ['pedidos', 'zona_id', "TEXT NOT NULL DEFAULT 'US-FL-MIAMI'"],
  // Superadmin a escala (12 oct 2026): código de ciudad (MIA, NOV…) e ID del repartidor.
  ['zonas', 'codigo_ciudad', 'TEXT'],
  ['repartidores', 'codigo', 'TEXT'],
];

/** Índices compuestos: primero la zona (filtra casi todo), luego el estado, luego orden o celda. */
const INDICES = [
  'CREATE INDEX IF NOT EXISTS restaurantes_zona_estado ON restaurantes(zona_id, estado, abierto)',
  'CREATE INDEX IF NOT EXISTS restaurantes_zona_celda ON restaurantes(zona_id, geohash)',
  'CREATE INDEX IF NOT EXISTS repartidores_zona_celda ON repartidores(zona_id, conectado, geohash)',
  'CREATE INDEX IF NOT EXISTS pedidos_zona_estado ON pedidos(zona_id, estado, creado_en)',
  'CREATE INDEX IF NOT EXISTS pedidos_repartidor_estado ON pedidos(repartidor_id, estado)',
  'CREATE INDEX IF NOT EXISTS lista_espera_zona ON lista_espera(zona_id, tipo, creado_en)',
  // Buscadores del superadmin pensados para millones de cuentas: por ID, por nombre (que empiece
  // por…), por teléfono, y listas por ciudad paginadas por clave (sin OFFSET).
  'CREATE UNIQUE INDEX IF NOT EXISTS repartidores_codigo ON repartidores(codigo)',
  'CREATE INDEX IF NOT EXISTS repartidores_zona_codigo ON repartidores(zona_id, codigo)',
  'CREATE INDEX IF NOT EXISTS usuarios_rol_nombre ON usuarios(rol, nombre COLLATE NOCASE)',
  'CREATE INDEX IF NOT EXISTS usuarios_rol_zona ON usuarios(rol, zona_id, creado_en)',
  'CREATE INDEX IF NOT EXISTS usuarios_telefono ON usuarios(telefono)',
  'CREATE INDEX IF NOT EXISTS pedidos_repartidor_fecha ON pedidos(repartidor_id, creado_en)',
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
