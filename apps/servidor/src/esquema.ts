import { CONFIG_DINERO_ANTERIOR, CONFIG_DINERO_INICIAL } from '@tumbite/compartido';
import { COLUMNAS_DEL_ESQUEMA } from './esquemaColumnas';
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
  // Inglés como idioma principal (13 oct 2026): la categoría del plato también va en inglés.
  ['platos', 'categoria_en', "TEXT NOT NULL DEFAULT ''"],
  // Retención de fotos (14 oct 2026): a los 30 días se borra el archivo y queda cuándo.
  ['evidencias', 'borrada_en', 'TEXT'],
  // Mayoría de edad (14 oct 2026): platos que solo se entregan en mano a un adulto con documento.
  ['platos', 'requiere_edad', 'INTEGER NOT NULL DEFAULT 0'],
  // Cómo se entregó (14 oct 2026). Se agregaron al CREATE de una tabla que ya existía y nunca
  // llegaron a la base: el estado del repartidor y las fotos de recogida y entrega fallaban
  // (encontrado en la validación del 15 oct; candado C-ESQUEMA-COMPLETO).
  ['evidencias', 'modo', 'TEXT'],
  ['evidencias', 'nota', "TEXT NOT NULL DEFAULT ''"],
  // Multiservicio, Fase 1 (15 oct 2026): el vehículo con el que el conductor trabaja ahora.
  // Nadie lo lee todavía para Comida; queda vacío hasta la migración M5 (docs/fase-1/).
  ['repartidores', 'vehiculo_activo_id', 'TEXT REFERENCES vehiculos(id)'],
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
  // Fase 3 (16 oct 2026): usan repartidores.vehiculo_activo_id, que llega por COLUMNAS. En
  // schema.sql romperían la base vieja (SQLite revisa disparadores y vistas al tocar columnas).
  // El vehículo activo no cambia con un pedido u operación en curso (aunque llegue a la vez):
  `CREATE TRIGGER IF NOT EXISTS repartidores_vehiculo_fijo_en_operacion
BEFORE UPDATE OF vehiculo_activo_id ON repartidores
WHEN NEW.vehiculo_activo_id IS NOT OLD.vehiculo_activo_id
 AND EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = NEW.usuario_id)
BEGIN
  SELECT RAISE(ABORT, 'no_se_cambia_vehiculo_en_operacion');
END`,
  // Quién puede recibir una operación de cada servicio (servicio, zona, vehículo aprobado con
  // documentos vigentes, habilitación, requisitos, preferencia, sin bloqueo y conectado).
  `CREATE VIEW IF NOT EXISTS conductores_elegibles AS
SELECT d.usuario_id AS conductor_id, s.id AS servicio_id, v.id AS vehiculo_id, d.zona_id,
       d.lat, d.lng, d.ubicacion_en, d.puntos
  FROM repartidores d
  JOIN usuarios u              ON u.id = d.usuario_id AND u.activo = 1 AND u.rol = 'repartidor'
  JOIN vehiculos v             ON v.id = d.vehiculo_activo_id AND v.conductor_id = d.usuario_id
                              AND v.estado = 'aprobado'
  JOIN servicios_zona sz       ON sz.zona_id = d.zona_id AND sz.estado = 'disponible'
                              AND (sz.activo_desde IS NULL OR sz.activo_desde <= datetime('now'))
                              AND (sz.activo_hasta IS NULL OR sz.activo_hasta > datetime('now'))
  JOIN servicios s             ON s.id = sz.servicio_id AND s.estado = 'disponible'
  JOIN servicios_implementados si ON si.servicio_id = s.id
  JOIN servicio_vehiculos sv   ON sv.servicio_id = s.id AND sv.vehiculo_tipo = v.tipo
                              AND (sv.anio_minimo IS NULL OR v.anio >= sv.anio_minimo)
  JOIN habilitaciones h        ON h.conductor_id = d.usuario_id AND h.servicio_id = s.id
                              AND h.estado = 'aprobada'
                              AND (h.vence_en IS NULL OR h.vence_en > datetime('now'))
  JOIN preferencias_servicio p ON p.conductor_id = d.usuario_id AND p.servicio_id = s.id AND p.activa = 1
 WHERE d.conectado = 1
   AND NOT EXISTS (
         SELECT 1 FROM conductor_bloqueos b
          WHERE b.conductor_id = d.usuario_id AND b.levantado_en IS NULL
            AND (b.servicio_id IS NULL OR b.servicio_id = s.id)
            AND (b.hasta IS NULL OR b.hasta > datetime('now')))
   AND (v.tipo NOT IN ('carro', 'moto', 'scooter') OR (
         SELECT COUNT(DISTINCT tipo) FROM vehiculo_documentos
          WHERE vehiculo_id = v.id AND estado = 'aprobado' AND tipo IN ('registro', 'seguro')
            AND (vence_en IS NULL OR vence_en > datetime('now'))) = 2)
   AND (s.transporta_personas = 0 OR EXISTS (
         SELECT 1 FROM vehiculo_documentos
          WHERE vehiculo_id = v.id AND estado = 'aprobado' AND tipo = 'seguro_pasajeros'
            AND (vence_en IS NULL OR vence_en > datetime('now'))))
   AND NOT EXISTS (
         SELECT 1 FROM servicio_requisitos sr
           JOIN requisitos_def rd ON rd.requisito = sr.requisito
          WHERE sr.servicio_id = s.id AND sr.obligatorio = 1
            AND NOT EXISTS (
                  SELECT 1 FROM cumplimientos c
                   WHERE c.conductor_id = d.usuario_id
                     AND c.vehiculo_id = CASE rd.nivel WHEN 'vehiculo' THEN v.id ELSE '' END
                     AND c.requisito = sr.requisito AND c.estado = 'aprobado'
                     AND (c.vence_en IS NULL OR c.vence_en > datetime('now'))))`,
];

/**
 * Precios de fábrica nuevos (13 oct 2026, C-EQUILIBRIO): si la configuración de dinero guardada
 * es EXACTAMENTE la de fábrica anterior, pasa a la nueva. Si alguien ya la cambió a mano en el
 * superadmin, no se toca: lo que decidió una persona manda sobre la fábrica.
 */
async function preciosDeFabrica(db: D1Database): Promise<void> {
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'dinero'")
    .first<{ valor: string }>()
    .catch(() => null);
  if (!f) return;
  let guardada: unknown;
  try {
    guardada = JSON.parse(f.valor);
  } catch {
    return;
  }
  // Comparación completa, sin importar el orden de las claves (también las de adentro).
  const ordenar = (v: unknown): unknown =>
    v && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, x]) => [k, ordenar(x)]),
        )
      : v;
  const igual = (a: unknown, b: unknown) =>
    JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b));
  if (!igual(guardada, CONFIG_DINERO_ANTERIOR)) return;
  await db
    .prepare("UPDATE config SET valor = ?, actualizado_en = datetime('now') WHERE clave = 'dinero'")
    .bind(JSON.stringify(CONFIG_DINERO_INICIAL))
    .run();
  console.warn('esquema: precios de fábrica actualizados al punto de equilibrio');
}

/**
 * Multiservicio, Fase 1 (C-SERVICIOS-IMPLEMENTADOS): los servicios que ESTE código sabe atender,
 * con la versión de su contrato. Solo Comida. Moto, Carro, Mercado, Envíos y Farmacia están en el
 * catálogo pero, sin fila aquí, los disparadores de schema.sql no dejan encenderlos. Agregar un
 * servicio a esta lista exige su fase aprobada (V1.2 §11).
 */
export const SERVICIOS_IMPLEMENTADOS = new Map<string, number>([['comida', 1]]);

async function sincronizarServicios(db: D1Database): Promise<void> {
  const hay = await db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'servicios_implementados'",
    )
    .first();
  if (!hay) return;
  const ids = [...SERVICIOS_IMPLEMENTADOS.keys()];
  const marcas = ids.map(() => '?').join(',');
  await db.batch([
    ...[...SERVICIOS_IMPLEMENTADOS].map(([id, contrato]) =>
      db
        .prepare(
          'INSERT INTO servicios_implementados (servicio_id, contrato) SELECT id, ? FROM servicios WHERE id = ? ' +
            "ON CONFLICT(servicio_id) DO UPDATE SET contrato = excluded.contrato, desplegado_en = datetime('now')",
        )
        .bind(contrato, id),
    ),
    // Lo que este código ya no sabe atender se suspende antes de dejar de declararlo.
    db
      .prepare(
        `UPDATE servicios SET estado = 'suspendido', actualizado_en = datetime('now') WHERE estado = 'disponible' AND id NOT IN (${marcas})`,
      )
      .bind(...ids),
    db
      .prepare(
        `UPDATE servicios_zona SET estado = 'suspendido', motivo = 'no implementado en esta versión', actualizado_en = datetime('now') WHERE estado = 'disponible' AND servicio_id NOT IN (${marcas})`,
      )
      .bind(...ids),
    db
      .prepare(`DELETE FROM servicios_implementados WHERE servicio_id NOT IN (${marcas})`)
      .bind(...ids),
  ]);
  // La primera vez, Comida queda disponible en las zonas activas (como funciona hoy). Después
  // manda lo que decida el panel: esto no vuelve a correr.
  const primera = await db.prepare("SELECT 1 FROM config WHERE clave = 'servicios_inicio'").first();
  if (!primera)
    await db.batch([
      db.prepare(
        "UPDATE servicios SET estado = 'disponible' WHERE id = 'comida' AND estado = 'proximamente'",
      ),
      db.prepare(
        "UPDATE servicios_zona SET estado = 'disponible' WHERE servicio_id = 'comida' AND estado = 'proximamente' AND zona_id IN (SELECT id FROM zonas WHERE activa = 1)",
      ),
      db.prepare("INSERT OR IGNORE INTO config (clave, valor) VALUES ('servicios_inicio', '1')"),
    ]);
}

/**
 * C-ESQUEMA-COMPLETO: cada columna de schema.sql tiene que existir en la base real. Una columna
 * nueva en una tabla que ya existe NO la crea schema.sql: va en COLUMNAS. Si falta alguna, la
 * salud dice «esquema: error» y el semáforo frena la publicación antes de producción.
 */
export let columnasFaltantes: string[] = [];
async function revisarColumnas(db: D1Database): Promise<void> {
  // D1 no deja cruzar sqlite_master con pragma_table_info: se arma UNA consulta con una parte por
  // tabla (pragma_table_info('…') solo sí está permitido). Los nombres salen del propio esquema.
  const tablasEsquema = Object.keys(COLUMNAS_DEL_ESQUEMA).filter((t) =>
    /^[a-z_][a-z0-9_]*$/.test(t),
  );
  try {
    // D1 acepta hasta 5 partes por consulta: bloques de 5, todos en un solo lote (un viaje).
    const bloques: string[][] = [];
    for (let i = 0; i < tablasEsquema.length; i += 5) bloques.push(tablasEsquema.slice(i, i + 5));
    const respuestas = await db.batch(
      bloques.map((b) =>
        db.prepare(
          b
            .map((t) => `SELECT '${t}' AS t, name AS c FROM pragma_table_info('${t}')`)
            .join(' UNION ALL '),
        ),
      ),
    );
    const results = respuestas.flatMap((r) => (r.results ?? []) as { t: string; c: string }[]);
    const reales = new Set(results.map((r) => `${r.t}.${r.c}`));
    const tablas = new Set(results.map((r) => r.t));
    columnasFaltantes = Object.entries(COLUMNAS_DEL_ESQUEMA).flatMap(([t, cols]) =>
      tablas.has(t) ? cols.filter((c) => !reales.has(`${t}.${c}`)).map((c) => `${t}.${c}`) : [],
    );
  } catch (e) {
    columnasFaltantes = [`no se pudo revisar: ${String(e).slice(0, 120)}`];
  }
  if (columnasFaltantes.length)
    console.error('esquema: faltan columnas en la base', columnasFaltantes.join(', '));
}

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
  await preciosDeFabrica(db);
  await sincronizarServicios(db);
  await revisarColumnas(db);
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
