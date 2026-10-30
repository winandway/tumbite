import { CONFIG_DINERO_ANTERIOR, CONFIG_DINERO_INICIAL, type Entorno } from '@tumbite/compartido';
import { COLUMNAS_DEL_ESQUEMA } from './esquemaColumnas';
import { rehacerFranquicias } from './esquemaTerritorio';
import { ESQUEMA_FASE3 } from './esquemaFase3';
import { ESQUEMA_PEDIDOS } from './esquemaPedidos';
import { ESQUEMA_FLEX, rehacerFlex } from './esquemaFlex';
/**
 * Migraciones seguras. schema.sql corre en cada publicación pero solo crea lo que no existe:
 * NO agrega columnas a tablas que ya están en producción. Esto sí, sin tocar datos:
 * revisa qué columnas faltan, las agrega, y crea los índices que dependen de ellas.
 * Corre una vez por arranque del servidor. Si algo falla, lo dice la salud.
 */
const COLUMNAS: [tabla: string, columna: string, definicion: string][] = [
  // C-PEDIDO-PROGRAMADO (29 oct 2026): inicio de la franja elegida (UTC); NULL = lo antes posible.
  ['pedidos', 'programado_para', 'TEXT'],
  // C-TICKETS-EQUIPO (29 oct 2026): prioridad y persona del equipo a cargo.
  ['tickets', 'prioridad', "TEXT NOT NULL DEFAULT 'normal'"],
  ['tickets', 'asignado_a', 'TEXT'],
  // C-REPARTIDOR-DESTACADO (29 oct 2026): cumple los requisitos del «Top Dasher».
  ['repartidores', 'destacado', 'INTEGER NOT NULL DEFAULT 0'],
  // C-PEDIDO-GRUPO-HORA (29 oct 2026): hora de cierre opcional y cuándo se avisó al anfitrión.
  ['pedidos_grupo', 'cierra_en', 'TEXT'],
  ['pedidos_grupo', 'avisado_en', 'TEXT'],
  // C-PEDIDO-GRUPO-TIENDA: en una tienda, qué hacer si falta cada producto.
  ['pedidos_grupo_items', 'sustitucion', 'TEXT'],
  ['usuarios', 'zona_id', 'TEXT'],
  ['usuarios', 'correo_confirmado_en', 'TEXT'],
  ['usuarios', 'stripe_cliente', 'TEXT'],
  // F19 (18 oct 2026): tope de intentos del PIN de entrega.
  ['pines_entrega', 'intentos', 'INTEGER NOT NULL DEFAULT 0'],
  // Pantalla de dinero del superadmin (18 oct 2026): abonos fallidos resueltos a mano.
  ['abonos_fallidos', 'resuelto_en', 'TEXT'],
  // Impuesto de ventas por pedido (18 oct 2026).
  ['pedidos', 'impuesto', 'INTEGER NOT NULL DEFAULT 0'],
  // Fase 2 · cobro directo (18 oct 2026). En SQLite el CHECK no se puede agregar después: lo vigila el código.
  ['pedidos', 'metodo_pago', "TEXT NOT NULL DEFAULT 'tarjeta'"],
  ['pedidos', 'cobro_estado', "TEXT NOT NULL DEFAULT 'no_aplica'"],
  ['pedidos', 'monto_recibido', 'INTEGER'],
  ['pedidos', 'cobro_confirmado_en', 'TEXT'],
  ['pedidos', 'cobro_nota', 'TEXT'],
  ['pedidos', 'cobro_confirmado_por', 'TEXT'],
  // Cupones (18 oct 2026).
  ['calificaciones', 'respuesta', 'TEXT'],
  ['calificaciones', 'respondida_en', 'TEXT'],
  ['restaurantes', 'categorias_orden', 'TEXT'],
  ['pedidos', 'cupon', 'TEXT'],
  ['pedidos', 'descuento', 'INTEGER NOT NULL DEFAULT 0'],
  ['pedidos', 'conciliacion_estado', "TEXT NOT NULL DEFAULT 'no_aplica'"],
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
  // C-FILTROS-DIETA (29 oct 2026): marcas del plato separadas por coma («vegano,halal»).
  ['platos', 'etiquetas', "TEXT NOT NULL DEFAULT ''"],
  // Cómo se entregó (14 oct 2026). Se agregaron al CREATE de una tabla que ya existía y nunca
  // llegaron a la base: el estado del repartidor y las fotos de recogida y entrega fallaban
  // (encontrado en la validación del 15 oct; candado C-ESQUEMA-COMPLETO).
  ['evidencias', 'modo', 'TEXT'],
  ['evidencias', 'nota', "TEXT NOT NULL DEFAULT ''"],
  // Multiservicio, Fase 1 (15 oct 2026): el vehículo con el que el conductor trabaja ahora.
  // Nadie lo lee todavía para Comida; queda vacío hasta la migración M5 (docs/fase-1/).
  ['repartidores', 'vehiculo_activo_id', 'TEXT REFERENCES vehiculos(id)'],
  // Idempotencia persistente de los avisos de Stripe (16 oct 2026, C-FALLOS-CRITICOS 1): los
  // avisos ya guardados estaban aplicados, por eso nacen como 'hecho'.
  ['avisos_stripe', 'estado', "TEXT NOT NULL DEFAULT 'hecho'"],
  // Divoox Flex · Fase 2 (27 oct 2026): pruebas de entrega exigidas por empresa y por envío.
  ['empresas', 'config_entrega_json', "TEXT NOT NULL DEFAULT '{}'"],
  ['envios', 'config_entrega_json', 'TEXT'],
  ['ruta_paradas', 'llegada_en', 'TEXT'],
  // Flex · Fase 3: archivo de prueba borrado por una política de retención aprobada.
  ['flex_pruebas', 'purgada_en', 'TEXT'],
  // Divoox Moto · M1 (28 oct 2026, después de REA): cargo fijo, ruta estimada por ciudad y la copia
  // de la tarifa dentro de cada cotización. Las tablas ya existían en el sitio de pruebas.
  ['tarifas_viaje', 'cargo_fijo', 'INTEGER NOT NULL DEFAULT 0'],
  ['tarifas_viaje', 'factor_calle_pb', 'INTEGER NOT NULL DEFAULT 13000'],
  ['tarifas_viaje', 'velocidad_kmh', 'INTEGER NOT NULL DEFAULT 24'],
  ['cotizaciones_viaje', 'tarifa_json', "TEXT NOT NULL DEFAULT '{}'"],
  // C-VIAJE-PASOS-REALES: tope de intentos del código de inicio del viaje.
  ['viajes', 'intentos_pin', 'INTEGER NOT NULL DEFAULT 0'],
  // Divoox Moto · M2: con qué paga el pasajero y de qué cotización salió el viaje.
  ['viajes', 'metodo_pago', "TEXT NOT NULL DEFAULT 'efectivo'"],
  ['viajes', 'cotizacion_id', 'TEXT'],
  // Divoox Moto · M7: el viaje en el que se cobró la deuda del pasajero.
  ['deudas_pasajero', 'cobrada_en', 'TEXT'],
  // Flex · Fase 5 (C-FLEX-UBICACION): destinatario y ubicación exacta de cada envío.
  ['envios', 'destinatario_correo', "TEXT NOT NULL DEFAULT ''"],
  ['envios', 'destinatario_documento', "TEXT NOT NULL DEFAULT ''"],
  ['envios', 'referencias', "TEXT NOT NULL DEFAULT ''"],
  ['envios', 'ubicacion_estado', "TEXT NOT NULL DEFAULT 'sin_coordenadas'"],
  ['envios', 'ubicacion_fuente', "TEXT NOT NULL DEFAULT ''"],
  ['envios', 'ubicacion_confirmada_en', 'TEXT'],
  ['envios', 'destinatario_usuario_id', 'TEXT'],
  ['envios', 'enlace_ubicacion_huella', 'TEXT'],
  ['envios', 'enlace_ubicacion_vence', 'TEXT'],
  // Flex · Fase 6 (C-FLEX-COBRO): cobro contra entrega y quién recibió.
  ['envios', 'cobro_monto', 'INTEGER'],
  ['envios', 'cobro_moneda', 'TEXT'],
  ['envios', 'cobro_estado', "TEXT NOT NULL DEFAULT 'sin_cobro'"],
  ['envios', 'cobro_metodo', 'TEXT'],
  ['envios', 'cobro_monto_recibido', 'INTEGER'],
  ['envios', 'cobro_moneda_recibida', 'TEXT'],
  ['envios', 'cobro_referencia', 'TEXT'],
  ['envios', 'cobro_conductor_id', 'TEXT'],
  ['envios', 'cobro_ruta_id', 'TEXT'],
  ['envios', 'cobrado_en', 'TEXT'],
  ['envios', 'liquidado_en', 'TEXT'],
  ['envios', 'liquidado_por', 'TEXT'],
  ['envios', 'recibio_documento', "TEXT NOT NULL DEFAULT ''"],
  ['envios', 'recibio_relacion', "TEXT NOT NULL DEFAULT ''"],
  // Tiendas · C-TIENDAS-CATALOGO: el tipo de comercio (restaurante, mercado, farmacia…).
  ['restaurantes', 'tipo_comercio', "TEXT NOT NULL DEFAULT 'restaurante'"],
  // Flex · C-FLEX-RETIRO: retiro en un punto (centro) con plazo.
  ['envios', 'entrega_tipo', "TEXT NOT NULL DEFAULT 'domicilio'"],
  ['envios', 'punto_centro_id', 'TEXT'],
  ['envios', 'retiro_disponible_en', 'TEXT'],
  ['envios', 'retiro_vence', 'TEXT'],
  // Flex · Fase 4: disputa de una recarga de la billetera de una empresa.
  ['disputas', 'recarga_empresa_id', 'TEXT'],
  ['ruta_paradas', 'resuelta_en', 'TEXT'],
  // Pausa automática sin señal (16 oct 2026, C-PAUSA-SIN-SENAL): la última vez que la app o el
  // panel del restaurante preguntó por pedidos, y cuándo se le avisó de la pausa.
  ['restaurantes', 'senal_en', 'TEXT'],
  ['restaurantes', 'pausa_aviso_en', 'TEXT'],
  // Territorio (17 oct 2026, C-TERRITORIO): estado o provincia e idioma de cada ciudad, y el área
  // de cobertura (polígono) en la que cae cada restaurante, repartidor y pedido.
  ['zonas', 'region', "TEXT NOT NULL DEFAULT ''"],
  ['zonas', 'idioma', "TEXT NOT NULL DEFAULT 'en'"],
  ['restaurantes', 'area_id', 'TEXT'],
  ['repartidores', 'area_id', 'TEXT'],
  ['pedidos', 'area_id', 'TEXT'],
  // Repartidor como los grandes (18 oct 2026, C-REPARTIDOR-GRANDES): pausa sin desconectarse.
  ['repartidores', 'pausado', 'INTEGER NOT NULL DEFAULT 0'],
  // C-COBRO-DIRECTO-LOCAL (19 oct 2026): foto del ticket del restaurante.
  ['pagos_local', 'ticket_clave', 'TEXT'],
  // C-TARIFAS-PAIS (19 oct 2026): moneda del pedido y tarifas aplicadas al crearlo.
  ['pedidos', 'moneda', "TEXT NOT NULL DEFAULT 'USD'"],
  ['pedidos', 'tarifas_json', 'TEXT'],
  // Disputa de una recarga del saldo prepago pagada con tarjeta (19 oct 2026).
  ['disputas', 'recarga_id', 'TEXT'],
  // C-TIENDAS-REEMPLAZOS (29 oct 2026): los reemplazos que propone la tienda y el que se eligió.
  ['ajustes_pedido', 'propuestas_json', 'TEXT'],
  ['ajustes_pedido', 'reemplazo_id', 'TEXT'],
];

/** Índices compuestos: primero la zona (filtra casi todo), luego el estado, luego orden o celda. */
const INDICES = [
  // Flex · Fase 5: sobre columnas que llegan con COLUMNAS (en schema.sql romperían la publicación).
  'CREATE INDEX IF NOT EXISTS envios_destinatario ON envios(destinatario_usuario_id, creado_en)',
  // Fase 6: el efectivo en la mano de cada conductor y los cobros de cada ruta.
  'CREATE INDEX IF NOT EXISTS envios_cobro_conductor ON envios(cobro_conductor_id, cobro_estado)',
  'CREATE INDEX IF NOT EXISTS envios_cobro_ruta ON envios(cobro_ruta_id, cobro_estado)',
  'CREATE UNIQUE INDEX IF NOT EXISTS envios_enlace_ubicacion ON envios(enlace_ubicacion_huella) WHERE enlace_ubicacion_huella IS NOT NULL',
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
  'CREATE INDEX IF NOT EXISTS restaurantes_area ON restaurantes(area_id)',
  'CREATE INDEX IF NOT EXISTS repartidores_area ON repartidores(area_id, conectado)',
  'CREATE INDEX IF NOT EXISTS pedidos_area_estado ON pedidos(area_id, estado, creado_en)',
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

/**
 * Divoox Moto · Fase M1 (C-MOTO-SOLO-PRUEBAS): servicios que este código atiende SOLO en el sitio
 * de pruebas, mientras se construyen (docs/PLAN-MOTO-PASAJEROS.md). En producción no existen: la
 * sincronización los suspende como a cualquier servicio no implementado.
 */
export const SERVICIOS_EN_PRUEBA = new Map<string, number>([
  ['moto', 1],
  // Tiendas (C-TIENDAS-VITRINA, 28 oct 2026): solo en pruebas hasta que Richard abra cada país.
  ['mercado', 1],
  ['farmacia', 1],
  ['licores', 1],
  ['mas', 1],
]);

/** Lo que este código atiende en ese entorno (el entorno sale del dominio que sirve la petición). */
export function serviciosImplementados(entorno: Entorno | null): Map<string, number> {
  return entorno === 'pruebas'
    ? new Map([...SERVICIOS_IMPLEMENTADOS, ...SERVICIOS_EN_PRUEBA])
    : SERVICIOS_IMPLEMENTADOS;
}

async function sincronizarServicios(db: D1Database, entorno: Entorno | null): Promise<void> {
  const hay = await db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'servicios_implementados'",
    )
    .first();
  if (!hay) return;
  const implementados = serviciosImplementados(entorno);
  const ids = [...implementados.keys()];
  const marcas = ids.map(() => '?').join(',');
  await db.batch([
    ...[...implementados].map(([id, contrato]) =>
      db
        .prepare(
          'INSERT INTO servicios_implementados (servicio_id, contrato) SELECT id, ? FROM servicios WHERE id = ? ' +
            "ON CONFLICT(servicio_id) DO UPDATE SET contrato = excluded.contrato, desplegado_en = datetime('now') " +
            // Sin cambio de contrato no se escribe: cada arranque en frío dejaba la base ocupada.
            'WHERE servicios_implementados.contrato <> excluded.contrato',
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

/**
 * Fase 3: disparadores, vistas y cuadre de la ocupación (después de las columnas nuevas). Una
 * consulta comprueba si ya están todos; solo si falta alguno se crean, todos en UN lote (una
 * transacción: el cuadre ve los disparadores ya puestos). Antes corrían uno por uno en cada
 * arranque: la primera respuesta tardaba más de 5 s y el tiempo real se cortaba (16 oct 2026).
 */
async function asegurarFase3(db: D1Database): Promise<void> {
  // Una sola consulta para los disparadores de la Fase 3 y los de los pedidos
  // (C-TRANSICIONES-PEDIDO): el arranque sigue barato.
  const todo = [...ESQUEMA_FASE3, ...ESQUEMA_PEDIDOS, ...ESQUEMA_FLEX];
  const nombres = todo
    .map((sql) => /CREATE (?:TRIGGER|VIEW) IF NOT EXISTS (\w+)/.exec(sql)?.[1])
    .filter((n): n is string => Boolean(n));
  const { results } = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM sqlite_master WHERE name IN (${nombres.map(() => '?').join(',')})`,
    )
    .bind(...nombres)
    .all<{ n: number }>();
  if (Number(results[0]?.n) === nombres.length) return;
  await db.batch(todo.map((sql) => db.prepare(sql)));
  console.warn('esquema: disparadores y vistas de la Fase 3 y de los pedidos creados');
}

let listo: Promise<void> | null = null;
export let ultimoErrorEsquema: string | null = null;

async function migrar(db: D1Database, entorno: Entorno | null): Promise<void> {
  await rehacerFranquicias(db);
  // C-ARRANQUE-RAPIDO: las columnas de TODAS las tablas de la lista en un solo lote (un viaje a la
  // base). Antes era una consulta por columna: 40 viajes seguidos en cada arranque, y la primera
  // respuesta tardaba tanto que la app del cliente no alcanzaba a confirmar la sesión (18 oct 2026).
  const tablasLista = [...new Set(COLUMNAS.map(([t]) => t))];
  const bloques: string[][] = [];
  for (let i = 0; i < tablasLista.length; i += 5) bloques.push(tablasLista.slice(i, i + 5));
  const respuestas = await db.batch(
    bloques.map((b) =>
      db.prepare(
        b
          .map((t) => `SELECT '${t}' AS t, name AS c FROM pragma_table_info('${t}')`)
          .join(' UNION ALL '),
      ),
    ),
  );
  const reales = new Set(
    respuestas
      .flatMap((r) => (r.results ?? []) as { t: string; c: string }[])
      .map((r) => `${r.t}.${r.c}`),
  );
  const existen = new Set([...reales].map((x) => x.split('.')[0]));
  for (const [tabla, columna, definicion] of COLUMNAS) {
    if (!existen.has(tabla)) continue; // la tabla aún no existe (la crea schema.sql)
    if (!reales.has(`${tabla}.${columna}`)) {
      await db.prepare(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`).run();
      console.warn(`esquema: columna agregada ${tabla}.${columna}`);
    }
  }
  // Un solo viaje a la base para todos los índices (antes, uno por índice en cada arranque).
  await db.batch(INDICES.map((sql) => db.prepare(sql)));
  // Flex · Fase 2: rehacer rutas_flex y conductor_ocupacion si vienen de antes (sin perder filas);
  // suelta sus disparadores y vistas, que asegurarFase3 vuelve a crear justo después.
  await rehacerFlex(db);
  await asegurarFase3(db);
  await preciosDeFabrica(db);
  await sincronizarServicios(db, entorno);
  await revisarColumnas(db);
}

/**
 * C-ESQUEMA-SIN-ATASCO (29 oct 2026): la migración corre una vez por servidor y todas las
 * peticiones la esperan. Si una consulta suya se quedaba trabada, ese servidor dejaba colgadas
 * TODAS sus peticiones durante minutos (visto en el sitio de pruebas: la sesión y el resumen del
 * superadmin sin respuesta mientras otro servidor contestaba al instante). Ahora ninguna petición
 * espera más de ESPERA_ESQUEMA_MS; la que pasa la espera sigue (la base ya tiene sus tablas), la
 * salud lo dice en rojo, y una migración que pasa de ESQUEMA_TRABADO_MS se descarta y se reintenta.
 */
export const ESPERA_ESQUEMA_MS = 8_000;
export const ESQUEMA_TRABADO_MS = 30_000;
let inicioMigracion = 0;

export function asegurarEsquema(db: D1Database, entorno: Entorno | null = null): Promise<void> {
  if (listo && inicioMigracion && Date.now() - inicioMigracion > ESQUEMA_TRABADO_MS) {
    ultimoErrorEsquema = `la migración lleva más de ${ESQUEMA_TRABADO_MS / 1000} s sin terminar; se reintenta`;
    console.error('esquema:', ultimoErrorEsquema);
    listo = null;
  }
  if (!listo) {
    inicioMigracion = Date.now();
    const esta: Promise<void> = migrar(db, entorno).then(
      () => {
        if (listo === esta) inicioMigracion = 0;
        ultimoErrorEsquema = null;
      },
      (e: unknown) => {
        ultimoErrorEsquema = String(e);
        console.error('esquema: la migración falló', e);
        if (listo === esta) listo = null; // se reintenta en la siguiente petición
      },
    );
    listo = esta;
  }
  const actual = listo;
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const espera = new Promise<void>((resolver) => {
    reloj = setTimeout(() => {
      if (listo === actual && inicioMigracion) {
        ultimoErrorEsquema = `la migración tardó más de ${ESPERA_ESQUEMA_MS / 1000} s`;
        console.error('esquema:', ultimoErrorEsquema);
      }
      resolver();
    }, ESPERA_ESQUEMA_MS);
  });
  return Promise.race([actual, espera]).finally(() => clearTimeout(reloj));
}

/** Solo para pruebas: cada base nueva vuelve a migrar. */
export function reiniciarEsquema(): void {
  listo = null;
  inicioMigracion = 0;
}
