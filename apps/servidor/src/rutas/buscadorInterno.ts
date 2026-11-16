import { Hono } from 'hono';
import {
  type BusquedaInterna,
  type FiltroEstadoPedido,
  FILTROS_ESTADO_PEDIDO,
  ESTADOS_PEDIDO_CERRADOS,
  type Usuario,
  correoCanonico,
  enmascararCorreo,
  enmascararTelefono,
  estadosDelFiltro,
  interpretarBusqueda,
  rangoPrefijo,
  semaforoPedido,
} from '@tumbite/compartido';
import type { Env } from '../env';
import { TELEFONO_DIEZ } from '../esquema';
import { CON_TELEFONO, NOMBRE_PLANO, TELEFONO_DIGITOS, TELEFONO_FINAL } from '../buscadorSql';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos } from '../validar';

/**
 * C-BUSCADOR-SERIO (15 nov 2026, pedido de Richard: buscó «407F» y no apareció). Todos los países.
 *
 * El buscador del superadmin: UNA pieza para el cuadro de arriba de todo (`GET /admin/buscar`) y
 * para «Pedidos en curso» (`listarPedidosAdmin`, que usa `GET /admin/pedidos`). El enrutador puro
 * (`interpretarBusqueda`, en compartido) dice qué se puede buscar con lo escrito; aquí cada cosa va
 * por su índice, con tope de 5 por grupo, y en paralelo.
 *
 * Reglas de la casa que no se rompen:
 * - Mirar no escribe: ninguna consulta de este archivo escribe una fila (lo fija la prueba).
 * - Ninguna recorre una tabla grande: código e id por la llave primaria (rango `id >= ? AND id < ?`,
 *   nunca `lower(id) LIKE`), nombres por el índice sin acentos, teléfonos por comienzo y por final,
 *   placas y correos por su índice, montos solo en los últimos 30 días. Sin OFFSET.
 * - `+columna` en un ORDER BY o un filtro le dice a SQLite que NO use ese índice ahí: así no elige
 *   recorrer la tabla entera por la fecha para ahorrarse ordenar cinco filas.
 */
export const buscadorInterno = new Hono<{ Bindings: Env; Variables: Variables }>();

const POR_GRUPO = 5;
/** Cuántas personas o comercios se toman como mucho para buscar sus pedidos en la lista. */
const PERSONAS_EN_LISTA = 20;
const POR_PAGINA = 50;
type Fila = Record<string, unknown>;
const texto = (v: unknown): string | null => (v == null ? null : String(v));

/**
 * Teléfonos y correos en los resultados: hoy enmascarados para todo el equipo. Cuando lleguen los
 * permisos finos (paquete 4, permiso `clientes.datos_personales`) se decide AQUÍ, en un solo lugar.
 */
export function contactoVisible(
  _quien: Usuario,
  tipo: 'telefono' | 'correo',
  valor: unknown,
): string {
  return tipo === 'telefono' ? enmascararTelefono(texto(valor)) : enmascararCorreo(texto(valor));
}

export type ResultadoBusqueda = {
  id: string;
  /** Lo que se lee primero (código, nombre, placa). */
  titulo: string;
  detalle: string;
  estado: string | null;
  /** Dónde está: la ciudad (y el estado va aparte). */
  ciudad: string | null;
  /** La ficha, relativa a la dirección del superadmin («/orders/<id>»). */
  enlace: string;
  /** Lo que coincidió, para resaltarlo dentro de `titulo` o `detalle`. */
  coincide: string;
  fecha?: string | null;
  monto?: number | null;
  moneda?: string | null;
};
export const GRUPOS_BUSQUEDA = [
  'pedidos',
  'viajes',
  'clientes',
  'repartidores',
  'restaurantes',
  'vehiculos',
  'tickets',
] as const;
export type GrupoBusqueda = (typeof GRUPOS_BUSQUEDA)[number];

const todas = (db: D1Database, sql: string, ...valores: unknown[]) =>
  db
    .prepare(sql)
    .bind(...valores)
    .all<Fila>()
    .then((r) => r.results);

// ───────────────────────── Personas: clientes, repartidores, comercios ─────────────────────────

/** Ids de cuentas de un rol por comienzo del nombre (sin acentos), del teléfono o del correo. */
async function idsDeCuentas(
  db: D1Database,
  rol: 'cliente' | 'repartidor',
  b: BusquedaInterna,
  tope: number,
): Promise<string[]> {
  const consultas: Promise<Fila[]>[] = [];
  if (b.nombre) {
    const [desde, hasta] = rangoPrefijo(b.nombre);
    consultas.push(
      todas(
        db,
        `SELECT id FROM usuarios WHERE rol = ? AND ${NOMBRE_PLANO} >= ? AND ${NOMBRE_PLANO} < ? AND activo = 1 LIMIT ?`,
        rol,
        desde,
        hasta,
        tope,
      ),
    );
  }
  if (b.telefono) {
    const d = b.telefono;
    // El teléfono único guarda solo dígitos y suma el «1» a los de diez cifras de EE. UU.
    const comienzos = new Set([d]);
    if (!d.startsWith('1') && d.length <= 10) comienzos.add(`1${d}`);
    for (const c of comienzos) {
      const [desde, hasta] = rangoPrefijo(c);
      consultas.push(
        todas(
          db,
          'SELECT id FROM usuarios WHERE telefono_canonico >= ? AND telefono_canonico < ? AND +rol = ? AND activo = 1 LIMIT ?',
          desde,
          hasta,
          rol,
          tope,
        ),
      );
    }
    // Cuentas de antes del teléfono único (sin canónico): por los últimos diez dígitos, con el índice
    // parcial que ya usa el registro (sin INDEXED BY, SQLite elegía «canónico IS NULL»: todas las viejas).
    const diez = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
    const [desde, hasta] = rangoPrefijo(diez);
    consultas.push(
      todas(
        db,
        `SELECT id FROM usuarios INDEXED BY usuarios_telefono_viejo WHERE telefono_canonico IS NULL AND telefono IS NOT NULL AND telefono != '' AND ${TELEFONO_DIEZ} >= ? AND ${TELEFONO_DIEZ} < ? AND +rol = ? AND activo = 1 LIMIT ?`,
        desde,
        hasta,
        rol,
        tope,
      ),
    );
    // Por el final: los últimos cuatro con índice, y el resto de lo escrito como filtro.
    consultas.push(
      todas(
        db,
        `SELECT id FROM usuarios WHERE ${CON_TELEFONO} AND ${TELEFONO_FINAL} = ? AND ${TELEFONO_DIGITOS} LIKE ? AND +rol = ? AND activo = 1 LIMIT ?`,
        d.slice(-4),
        `%${d}`,
        rol,
        tope,
      ),
    );
  }
  if (b.correo) {
    if (/@[^@\s]+\.[a-z]{2,}$/i.test(b.correo))
      consultas.push(
        todas(
          db,
          'SELECT id FROM usuarios WHERE correo_canonico = ? AND +rol = ? LIMIT ?',
          correoCanonico(b.correo),
          rol,
          tope,
        ),
        todas(
          db,
          'SELECT id FROM usuarios WHERE correo = ? AND +rol = ? LIMIT ?',
          b.correo,
          rol,
          1,
        ),
      );
    else {
      const [desde, hasta] = rangoPrefijo(b.correo);
      consultas.push(
        todas(
          db,
          'SELECT id FROM usuarios WHERE correo >= ? AND correo < ? AND +rol = ? AND activo = 1 LIMIT ?',
          desde,
          hasta,
          rol,
          tope,
        ),
      );
    }
  }
  if (rol === 'repartidor' && b.codigoRepartidor) {
    const [desde, hasta] = rangoPrefijo(b.codigoRepartidor);
    consultas.push(
      todas(
        db,
        'SELECT usuario_id AS id FROM repartidores WHERE codigo >= ? AND codigo < ? ORDER BY codigo LIMIT ?',
        desde,
        hasta,
        tope,
      ),
    );
  }
  if (rol === 'repartidor' && b.placa) {
    const [desde, hasta] = rangoPrefijo(b.placa);
    consultas.push(
      todas(
        db,
        "SELECT usuario_id AS id FROM repartidor_datos WHERE placa != '' AND placa >= ? AND placa < ? LIMIT ?",
        desde,
        hasta,
        tope,
      ),
      todas(
        db,
        "SELECT conductor_id AS id FROM vehiculos WHERE placa != '' AND upper(placa) >= ? AND upper(placa) < ? LIMIT ?",
        desde,
        hasta,
        tope,
      ),
    );
  }
  if (b.id)
    consultas.push(todas(db, 'SELECT id FROM usuarios WHERE id = ? AND +rol = ?', b.id, rol));
  const listas = await Promise.all(consultas);
  return [...new Set(listas.flat().map((f) => String(f.id)))].slice(0, tope);
}

async function idsDeComercios(db: D1Database, b: BusquedaInterna, tope: number) {
  const consultas: Promise<Fila[]>[] = [];
  if (b.nombre) {
    const [desde, hasta] = rangoPrefijo(b.nombre);
    consultas.push(
      todas(
        db,
        `SELECT id FROM restaurantes WHERE ${NOMBRE_PLANO} >= ? AND ${NOMBRE_PLANO} < ? LIMIT ?`,
        desde,
        hasta,
        tope,
      ),
    );
  }
  if (b.id) consultas.push(todas(db, 'SELECT id FROM restaurantes WHERE id = ?', b.id));
  const listas = await Promise.all(consultas);
  return [...new Set(listas.flat().map((f) => String(f.id)))].slice(0, tope);
}

const marcas = (n: number) => Array.from({ length: n }, () => '?').join(', ');

// ───────────────────────── Grupos del buscador de arriba ─────────────────────────

const PEDIDO_COLUMNAS = `p.id, p.estado, p.total, p.moneda, p.creado_en, r.nombre AS restaurante,
  uc.nombre AS cliente, uc.activo AS cliente_activo, z.nombre AS ciudad`;
const PEDIDO_UNIONES = `LEFT JOIN restaurantes r ON r.id = p.restaurante_id
  LEFT JOIN usuarios uc ON uc.id = p.cliente_id LEFT JOIN zonas z ON z.id = p.zona_id`;

/** Un cliente borrado o que no está: nunca rompe una lista. */
export const nombreCliente = (f: Fila): string | null =>
  f.cliente == null || Number(f.cliente_activo ?? 1) === 0 ? null : String(f.cliente);

async function grupoPedidos(db: D1Database, b: BusquedaInterna): Promise<ResultadoBusqueda[]> {
  // Primero los ids (por la llave primaria o la fecha), después los datos de esos pocos: así las
  // uniones con restaurante, cliente y ciudad corren para 5 filas y no para todas las que empiezan así.
  const partes = await Promise.all([
    b.id ? todas(db, 'SELECT p.id FROM pedidos p WHERE p.id = ?', b.id) : [],
    b.codigo
      ? todas(
          db,
          'SELECT p.id FROM pedidos p WHERE p.id >= ? AND p.id < ? ORDER BY +p.creado_en DESC LIMIT ?',
          ...rangoPrefijo(b.codigo),
          POR_GRUPO,
        )
      : [],
    b.monto !== undefined
      ? todas(
          db,
          "SELECT p.id FROM pedidos p WHERE p.creado_en >= datetime('now', '-30 days') AND p.total = ? ORDER BY p.creado_en DESC LIMIT ?",
          b.monto,
          POR_GRUPO,
        )
      : [],
  ]);
  const ids = [...new Set(partes.flat().map((f) => String(f.id)))].slice(0, POR_GRUPO);
  if (!ids.length) return [];
  const porId = new Map(
    (
      await todas(
        db,
        `SELECT ${PEDIDO_COLUMNAS} FROM pedidos p ${PEDIDO_UNIONES} WHERE p.id IN (${marcas(ids.length)})`,
        ...ids,
      )
    ).map((f) => [String(f.id), f]),
  );
  const filas = ids.flatMap((id) => {
    const f = porId.get(id);
    return f ? [f] : [];
  });
  const vistos = new Set<string>();
  return filas
    .filter((f) => !vistos.has(String(f.id)) && vistos.add(String(f.id)))
    .slice(0, POR_GRUPO)
    .map((f) => ({
      id: String(f.id),
      titulo: `#${String(f.id).slice(0, 6).toUpperCase()}`,
      detalle: [texto(f.restaurante), nombreCliente(f)].filter(Boolean).join(' · '),
      estado: texto(f.estado),
      ciudad: texto(f.ciudad),
      enlace: `/orders/${String(f.id)}`,
      coincide: b.codigo ?? (b.id ? String(f.id).slice(0, 6) : ''),
      fecha: texto(f.creado_en),
      monto: f.total == null ? null : Number(f.total),
      moneda: texto(f.moneda) ?? 'USD',
    }));
}

async function grupoViajes(db: D1Database, b: BusquedaInterna): Promise<ResultadoBusqueda[]> {
  const condiciones: [string, unknown[]][] = [];
  if (b.id) condiciones.push(['o.id = ?', [b.id]]);
  if (b.codigo) condiciones.push(['o.id >= ? AND o.id < ?', rangoPrefijo(b.codigo)]);
  const filas = (
    await Promise.all(
      condiciones.map(([donde, valores]) =>
        todas(
          db,
          `SELECT o.id, o.servicio_id, o.estado_general, o.creado_en, v.estado, q.total, q.moneda,
              pu.nombre AS pasajero, pu.activo AS pasajero_activo, d.nombre AS conductor, z.nombre AS ciudad
             FROM operaciones o LEFT JOIN viajes v ON v.operacion_id = o.id
             LEFT JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id
             LEFT JOIN usuarios pu ON pu.id = o.cliente_id LEFT JOIN usuarios d ON d.id = o.conductor_id
             LEFT JOIN zonas z ON z.id = o.zona_id
            WHERE ${donde} AND +o.tipo_operacion IN ('viaje_pasajero', 'envio_paquete')
            ORDER BY +o.creado_en DESC LIMIT ?`,
          ...valores,
          POR_GRUPO,
        ),
      ),
    )
  ).flat();
  const vistos = new Set<string>();
  return filas
    .filter((f) => !vistos.has(String(f.id)) && vistos.add(String(f.id)))
    .slice(0, POR_GRUPO)
    .map((f) => ({
      id: String(f.id),
      titulo: `#${String(f.id).slice(0, 6).toUpperCase()}`,
      detalle: [
        texto(f.servicio_id),
        Number(f.pasajero_activo ?? 1) === 0 ? null : texto(f.pasajero),
        texto(f.conductor),
      ]
        .filter(Boolean)
        .join(' · '),
      estado: texto(f.estado ?? f.estado_general),
      ciudad: texto(f.ciudad),
      enlace: `/rides?q=${String(f.id)}`,
      coincide: b.codigo ?? String(f.id).slice(0, 6),
      fecha: texto(f.creado_en),
      monto: f.total == null ? null : Number(f.total),
      moneda: texto(f.moneda) ?? 'USD',
    }));
}

async function grupoCuentas(
  db: D1Database,
  quien: Usuario,
  rol: 'cliente' | 'repartidor',
  b: BusquedaInterna,
): Promise<ResultadoBusqueda[]> {
  const ids = await idsDeCuentas(db, rol, b, POR_GRUPO);
  if (!ids.length) return [];
  const filas = await todas(
    db,
    `SELECT u.id, u.nombre, u.correo, u.telefono, u.activo, z.nombre AS ciudad, d.codigo,
        x.placa, x.vehiculo_tipo
       FROM usuarios u LEFT JOIN repartidores d ON d.usuario_id = u.id
       LEFT JOIN repartidor_datos x ON x.usuario_id = u.id
       LEFT JOIN zonas z ON z.id = ${rol === 'repartidor' ? 'COALESCE(d.zona_id, u.zona_id)' : 'u.zona_id'}
      WHERE u.id IN (${marcas(ids.length)})`,
    ...ids,
  );
  const porId = new Map(filas.map((f) => [String(f.id), f]));
  return ids.flatMap((id) => {
    const f = porId.get(id);
    if (!f) return [];
    const telefono = contactoVisible(quien, 'telefono', f.telefono);
    const correo = contactoVisible(quien, 'correo', f.correo);
    const coincide =
      b.nombre ?? b.codigoRepartidor ?? (b.telefono ? b.telefono.slice(-4) : (b.placa ?? ''));
    return [
      {
        id,
        titulo: String(f.nombre),
        detalle: [
          rol === 'repartidor' ? texto(f.codigo) : null,
          rol === 'repartidor' && f.placa ? String(f.placa) : null,
          telefono || null,
          correo || null,
        ]
          .filter(Boolean)
          .join(' · '),
        estado: Number(f.activo ?? 1) === 1 ? null : 'eliminada',
        ciudad: texto(f.ciudad),
        enlace: `/${rol === 'cliente' ? 'customers' : 'drivers'}/${id}`,
        coincide,
      },
    ];
  });
}

async function grupoComercios(db: D1Database, b: BusquedaInterna): Promise<ResultadoBusqueda[]> {
  const ids = await idsDeComercios(db, b, POR_GRUPO);
  if (!ids.length) return [];
  const filas = await todas(
    db,
    `SELECT r.id, r.nombre, r.tipo_comercio, r.estado, z.nombre AS ciudad
       FROM restaurantes r LEFT JOIN zonas z ON z.id = r.zona_id WHERE r.id IN (${marcas(ids.length)})`,
    ...ids,
  );
  const porId = new Map(filas.map((f) => [String(f.id), f]));
  return ids.flatMap((id) => {
    const f = porId.get(id);
    return f
      ? [
          {
            id,
            titulo: String(f.nombre),
            detalle: String(f.tipo_comercio ?? 'restaurante'),
            estado: texto(f.estado),
            ciudad: texto(f.ciudad),
            enlace: `/restaurants/${id}`,
            coincide: b.nombre ?? '',
          },
        ]
      : [];
  });
}

async function grupoVehiculos(db: D1Database, b: BusquedaInterna): Promise<ResultadoBusqueda[]> {
  if (!b.placa) return [];
  const [desde, hasta] = rangoPrefijo(b.placa);
  const filas = await todas(
    db,
    `SELECT x.id, x.placa, x.tipo, x.estado, x.marca, x.modelo, x.conductor_id, u.nombre AS dueno
       FROM (SELECT id, placa, tipo, estado, marca, modelo, conductor_id FROM vehiculos
              WHERE placa != '' AND upper(placa) >= ? AND upper(placa) < ? LIMIT ?) x
       LEFT JOIN usuarios u ON u.id = x.conductor_id`,
    desde,
    hasta,
    POR_GRUPO,
  );
  return filas.map((f) => ({
    id: String(f.id),
    titulo: String(f.placa).toUpperCase(),
    detalle: [texto(f.tipo), [f.marca, f.modelo].filter(Boolean).join(' '), texto(f.dueno)]
      .filter(Boolean)
      .join(' · '),
    estado: texto(f.estado),
    ciudad: null,
    enlace: `/drivers/${String(f.conductor_id)}`,
    coincide: b.placa ?? '',
  }));
}

async function grupoTickets(
  db: D1Database,
  quien: Usuario,
  b: BusquedaInterna,
): Promise<ResultadoBusqueda[]> {
  const consultas: [string, unknown[]][] = [];
  if (b.id) consultas.push(['id = ?', [b.id]]);
  if (b.codigo) consultas.push(['id >= ? AND id < ?', rangoPrefijo(b.codigo)]);
  if (b.correo && b.correo.includes('.')) consultas.push(['correo = ?', [b.correo]]);
  const filas = (
    await Promise.all(
      consultas.map(([donde, valores]) =>
        todas(
          db,
          `SELECT id, asunto, estado, tipo, correo, actualizado_en, ciudad FROM tickets
            WHERE ${donde} ORDER BY +actualizado_en DESC LIMIT ?`,
          ...valores,
          POR_GRUPO,
        ),
      ),
    )
  ).flat();
  const vistos = new Set<string>();
  return filas
    .filter((f) => !vistos.has(String(f.id)) && vistos.add(String(f.id)))
    .slice(0, POR_GRUPO)
    .map((f) => ({
      id: String(f.id),
      titulo: `#${String(f.id).slice(0, 6).toUpperCase()} · ${String(f.asunto)}`,
      detalle: [texto(f.tipo), contactoVisible(quien, 'correo', f.correo)]
        .filter(Boolean)
        .join(' · '),
      estado: texto(f.estado),
      ciudad: texto(f.ciudad) || null,
      enlace: `/tickets/${String(f.id)}`,
      coincide: b.codigo ?? '',
      fecha: texto(f.actualizado_en),
    }));
}

/** Todo el buscador de arriba: grupos con tope de 5, y el salto directo si lo escrito es un id. */
export async function buscarEnSuperadmin(db: D1Database, quien: Usuario, q: string) {
  const b = interpretarBusqueda(q);
  if (b.vacia) return { q: b.texto, grupos: [], salto: null, avisoMonto: false };
  const [pedidos, viajes, clientes, repartidores, restaurantes, vehiculos, tickets] =
    await Promise.all([
      grupoPedidos(db, b),
      grupoViajes(db, b),
      grupoCuentas(db, quien, 'cliente', b),
      grupoCuentas(db, quien, 'repartidor', b),
      grupoComercios(db, b),
      grupoVehiculos(db, b),
      grupoTickets(db, quien, b),
    ]);
  const grupos = Object.entries({
    pedidos,
    viajes,
    clientes,
    repartidores,
    restaurantes,
    vehiculos,
    tickets,
  })
    .filter(([, resultados]) => resultados.length > 0)
    .map(([tipo, resultados]) => ({ tipo: tipo as GrupoBusqueda, resultados }));
  // Un id completo que existe: se salta directo a su ficha (si es uno solo).
  const exactos = b.id ? grupos.flatMap((g) => g.resultados.filter((r) => r.id === b.id)) : [];
  return {
    q: b.texto,
    grupos,
    salto: exactos.length === 1 ? (exactos[0]?.enlace ?? null) : null,
    avisoMonto: b.monto !== undefined,
  };
}

buscadorInterno.get('/admin/buscar', async (c) => {
  const u = exigir(c, 'admin');
  const q = (c.req.query('q') ?? '').slice(0, 80);
  return c.json(await buscarEnSuperadmin(base(c), u, q));
});

// ───────────────────────── «Pedidos en curso» con la misma lógica ─────────────────────────

export type ParametrosLista = {
  zona: string;
  estado: FiltroEstadoPedido;
  orden: 'recientes' | 'antiguos';
  q: string;
  despues: string;
};

/** Lee los parámetros de la lista (acepta el viejo `cerrados=1`). */
export function parametrosLista(consulta: (k: string) => string | undefined): ParametrosLista {
  const e = consulta('estado') ?? (consulta('cerrados') === '1' ? 'cerrados' : 'vivos');
  const estado = (FILTROS_ESTADO_PEDIDO as readonly string[]).includes(e)
    ? (e as FiltroEstadoPedido)
    : 'vivos';
  const o = consulta('orden');
  const orden =
    o === 'recientes' || o === 'antiguos' ? o : estado === 'vivos' ? 'antiguos' : 'recientes';
  const despues = consulta('despues') ?? '';
  if (despues && !/^[0-9: -]{10,19}~\d{1,19}$/.test(despues))
    throw new ErrorDatos('La página pedida no es válida.', 'despues', 400);
  return {
    zona: (consulta('zona') ?? '').slice(0, 60),
    estado,
    orden,
    q: (consulta('q') ?? '').slice(0, 80),
    despues,
  };
}

/**
 * La condición de «después de esta fila» para la paginación por clave: la fecha y, si empata, el
 * número de fila (rowid). Los índices por fecha ya guardan el rowid al final, así que el orden
 * (fecha, rowid) sale del índice sin ordenar nada y la consulta para al juntar la página.
 */
function despuesDe(cursor: string, orden: 'recientes' | 'antiguos'): [string, unknown[]] {
  if (!cursor) return ['', []];
  const [fecha = '', fila = '0'] = cursor.split('~');
  return orden === 'recientes'
    ? [' AND p.creado_en <= ? AND (p.creado_en < ? OR p.rowid < ?)', [fecha, fecha, Number(fila)]]
    : [' AND p.creado_en >= ? AND (p.creado_en > ? OR p.rowid > ?)', [fecha, fecha, Number(fila)]];
}

const FILA_LISTA = `p.id, p.rowid AS fila, p.estado, p.total, p.moneda, p.creado_en, p.pagado_en, p.aceptado_en, p.listo_en,
  p.recogido_en, p.tiempo_prep_min, p.zona_id, r.nombre AS restaurante, uc.nombre AS cliente,
  uc.activo AS cliente_activo, ur.nombre AS repartidor, d.codigo AS repartidor_codigo, z.nombre AS ciudad`;
const UNIONES_LISTA = `LEFT JOIN restaurantes r ON r.id = p.restaurante_id
  LEFT JOIN usuarios uc ON uc.id = p.cliente_id LEFT JOIN usuarios ur ON ur.id = p.repartidor_id
  LEFT JOIN repartidores d ON d.usuario_id = p.repartidor_id LEFT JOIN zonas z ON z.id = p.zona_id`;

function aFilaLista(f: Fila) {
  const fechas = {
    estado: String(f.estado),
    creadoEn: String(f.creado_en),
    pagadoEn: texto(f.pagado_en),
    aceptadoEn: texto(f.aceptado_en),
    listoEn: texto(f.listo_en),
    recogidoEn: texto(f.recogido_en),
    tiempoPrepMin: f.tiempo_prep_min == null ? null : Number(f.tiempo_prep_min),
  };
  const cerrado = (ESTADOS_PEDIDO_CERRADOS as readonly string[]).includes(fechas.estado);
  return {
    id: String(f.id),
    ...fechas,
    total: Number(f.total),
    // C-MONEDA-RECORRIDO: cada pedido en su moneda (la lista no suma montos).
    moneda: String(f.moneda ?? 'USD'),
    restaurante: String(f.restaurante ?? ''),
    // C-BUSCADOR-SERIO: un cliente con la cuenta borrada no rompe la lista (null = «Cuenta eliminada»).
    cliente: nombreCliente(f),
    repartidor: texto(f.repartidor),
    repartidorCodigo: texto(f.repartidor_codigo),
    ciudad: texto(f.ciudad),
    zonaId: texto(f.zona_id),
    luz:
      cerrado || fechas.estado === 'pago_pendiente'
        ? ('verde' as const)
        : (semaforoPedido(fechas)?.luz ?? ('verde' as const)),
  };
}
export type FilaListaPedido = ReturnType<typeof aFilaLista>;

const ORDEN_LUZ = new Map([
  ['rojo', 0],
  ['amarillo', 1],
  ['verde', 2],
]);

/**
 * La lista de «Pedidos en curso» del superadmin. Tres formas, según lo escrito:
 * 1. Código o id: se busca sin importar el estado ni la ciudad, y se dice dónde se encontró.
 * 2. Persona, comercio o monto: sus pedidos con el estado y la ciudad elegidos.
 * 3. Nada escrito: la lista del estado y la ciudad elegidos, de a 50 con «Cargar más».
 */
export async function listarPedidosAdmin(db: D1Database, p: ParametrosLista) {
  const b = interpretarBusqueda(p.q);
  const estados = estadosDelFiltro(p.estado);
  const direccion = p.orden === 'recientes' ? 'DESC' : 'ASC';

  // 1. Por código o id: todos, de cualquier estado y ciudad, el más reciente primero.
  if (b.codigo || b.id) {
    const condiciones: [string, unknown[]][] = [];
    if (b.id) condiciones.push(['p.id = ?', [b.id]]);
    if (b.codigo) condiciones.push(['p.id >= ? AND p.id < ?', rangoPrefijo(b.codigo)]);
    const ids = (
      await Promise.all(
        condiciones.map(([donde, valores]) =>
          todas(
            db,
            `SELECT p.id, p.rowid AS fila, p.creado_en FROM pedidos p WHERE ${donde}
              ORDER BY +p.creado_en DESC LIMIT ?`,
            ...valores,
            POR_PAGINA + 1,
          ),
        ),
      )
    ).flat();
    const vistos = new Set<string>();
    const unicos = await detalles(
      db,
      ids.filter((f) => !vistos.has(String(f.id)) && vistos.add(String(f.id))),
      'DESC',
    );
    const pedidos = unicos.slice(0, POR_PAGINA).map(aFilaLista);
    const fuera = pedidos.filter((x) => !estados.includes(x.estado));
    const otrasCiudades = [
      ...new Set(
        pedidos.filter((x) => p.zona && x.zonaId !== p.zona).map((x) => x.ciudad ?? x.zonaId ?? ''),
      ),
    ].filter(Boolean);
    return {
      pedidos,
      siguiente: null,
      porCodigo: true,
      masCoincidencias: unicos.length > POR_PAGINA,
      encontrado: {
        cerrados: fuera.some((x) =>
          (ESTADOS_PEDIDO_CERRADOS as readonly string[]).includes(x.estado),
        ),
        vivos: fuera.some(
          (x) => !(ESTADOS_PEDIDO_CERRADOS as readonly string[]).includes(x.estado),
        ),
        otrasCiudades,
      },
      avisoMonto: false,
    };
  }

  const [tras, trasValores] = despuesDe(p.despues, p.orden);
  const zona = p.zona ? ' AND p.zona_id = ?' : '';
  const zonaValores = p.zona ? [p.zona] : [];
  let filas: Fila[];

  if (!b.vacia) {
    // 2. Por persona, comercio o monto: sus pedidos, con los filtros elegidos.
    const [clientes, repartidores, comercios] = await Promise.all([
      idsDeCuentas(db, 'cliente', b, PERSONAS_EN_LISTA),
      idsDeCuentas(db, 'repartidor', b, PERSONAS_EN_LISTA),
      idsDeComercios(db, b, PERSONAS_EN_LISTA),
    ]);
    const quien: string[] = [];
    const valores: unknown[] = [];
    if (clientes.length) {
      quien.push(`p.cliente_id IN (${marcas(clientes.length)})`);
      valores.push(...clientes);
    }
    if (repartidores.length) {
      quien.push(`p.repartidor_id IN (${marcas(repartidores.length)})`);
      valores.push(...repartidores);
    }
    if (comercios.length) {
      quien.push(`p.restaurante_id IN (${marcas(comercios.length)})`);
      valores.push(...comercios);
    }
    if (b.monto !== undefined) {
      quien.push("(p.creado_en >= datetime('now', '-30 days') AND p.total = ?)");
      valores.push(b.monto);
    }
    if (!quien.length)
      return {
        pedidos: [],
        siguiente: null,
        porCodigo: false,
        masCoincidencias: false,
        encontrado: null,
        avisoMonto: false,
      };
    filas = await todas(
      db,
      `SELECT ${FILA_LISTA} FROM pedidos p ${UNIONES_LISTA}
        WHERE (${quien.join(' OR ')}) AND +p.estado IN (${marcas(estados.length)})${zona.replace('p.zona_id', '+p.zona_id')}${tras}
        ORDER BY +p.creado_en ${direccion}, p.rowid ${direccion} LIMIT ?`,
      ...valores,
      ...estados,
      ...zonaValores,
      ...trasValores,
      POR_PAGINA + 1,
    );
  } else if (p.zona) {
    // 3a. Una ciudad: cada estado por su índice (zona, estado, fecha) y se juntan en orden.
    const partes = await Promise.all(
      estados.map((e) =>
        todas(
          db,
          `SELECT p.id, p.rowid AS fila, p.creado_en FROM pedidos p WHERE p.zona_id = ? AND p.estado = ?${tras}
            ORDER BY p.creado_en ${direccion}, p.rowid ${direccion} LIMIT ?`,
          p.zona,
          e,
          ...trasValores,
          POR_PAGINA + 1,
        ),
      ),
    );
    filas = await detalles(db, partes.flat(), direccion);
  } else if (p.estado === 'vivos') {
    // 3b. Vivos de todas las ciudades: son pocos (el Manager cierra los viejos); por el estado.
    const ids = await todas(
      db,
      `SELECT p.id, p.rowid AS fila, p.creado_en FROM pedidos p WHERE p.estado IN (${marcas(estados.length)})${tras}
        ORDER BY +p.creado_en ${direccion}, p.rowid ${direccion} LIMIT ?`,
      ...estados,
      ...trasValores,
      POR_PAGINA + 1,
    );
    filas = await detalles(db, ids, direccion);
  } else {
    // 3c. Cerrados o todos, de todas las ciudades: por la fecha (casi todo coincide).
    const ids = await todas(
      db,
      `SELECT p.id, p.rowid AS fila, p.creado_en FROM pedidos p WHERE +p.estado IN (${marcas(estados.length)})${tras}
        ORDER BY p.creado_en ${direccion}, p.rowid ${direccion} LIMIT ?`,
      ...estados,
      ...trasValores,
      POR_PAGINA + 1,
    );
    filas = await detalles(db, ids, direccion);
  }
  const hayMas = filas.length > POR_PAGINA;
  const pagina = filas.slice(0, POR_PAGINA);
  const ultima = pagina.at(-1);
  let pedidos = pagina.map(aFilaLista);
  // C-MANAGER-1: entre los vivos, los que están en problemas primero.
  if (p.estado === 'vivos')
    pedidos = [...pedidos].sort(
      (a, x) => (ORDEN_LUZ.get(a.luz) ?? 2) - (ORDEN_LUZ.get(x.luz) ?? 2),
    );
  return {
    pedidos,
    siguiente: hayMas && ultima ? `${String(ultima.creado_en)}~${Number(ultima.fila)}` : null,
    porCodigo: false,
    masCoincidencias: false,
    encontrado: null,
    avisoMonto: b.monto !== undefined,
  };
}

/** Ordena los ids de una página y trae sus datos (una consulta por la llave primaria). */
async function detalles(db: D1Database, ids: Fila[], direccion: 'ASC' | 'DESC'): Promise<Fila[]> {
  const orden = [...ids].sort((a, b) => {
    const c =
      String(a.creado_en).localeCompare(String(b.creado_en)) || Number(a.fila) - Number(b.fila);
    return direccion === 'ASC' ? c : -c;
  });
  const elegidos = orden.slice(0, POR_PAGINA + 1).map((f) => String(f.id));
  if (!elegidos.length) return [];
  const filas = await todas(
    db,
    `SELECT ${FILA_LISTA} FROM pedidos p ${UNIONES_LISTA} WHERE p.id IN (${marcas(elegidos.length)})`,
    ...elegidos,
  );
  const porId = new Map(filas.map((f) => [String(f.id), f]));
  return elegidos.flatMap((id) => {
    const f = porId.get(id);
    return f ? [f] : [];
  });
}
