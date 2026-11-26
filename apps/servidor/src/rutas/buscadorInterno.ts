import { Hono } from 'hono';
import {
  alcanceEsTotal,
  type AccesoInterno,
  type BusquedaInterna,
  type PermisoInterno,
  puedeVer,
  type FiltroEstadoPedido,
  FILTROS_ESTADO_PEDIDO,
  ESTADOS_PEDIDO_CERRADOS,
  ESTADOS_PEDIDO_VIVOS,
  type Usuario,
  correoCanonico,
  enmascararCorreo,
  enmascararTelefono,
  estadosDelFiltro,
  interpretarBusqueda,
  rangoPrefijo,
  semaforoPedido,
  type ServicioConcreto,
  type ServicioMonitoreo,
  esServicioMonitoreo,
  servicioDePedido,
  SERVICIOS_DE_VIAJE,
  servicioIdDeOperacion,
} from '@tumbite/compartido';
import type { Env } from '../env';
import { ESTADOS_US, ESTADOS_VE, lugarEscrito, sinAcentos } from '@tumbite/compartido';
import { LUGAR_CIUDAD_PLANA } from '../esquemaLugar';
import { lugarDeFila } from '../lugarEspera';
import { zonaRealSql } from '../cuentaPais';
import { TELEFONO_DIEZ } from '../esquema';
import {
  CON_TELEFONO,
  NOMBRE_DESDE_PALABRA,
  NOMBRE_PLANO,
  TELEFONO_DIGITOS,
  TELEFONO_FINAL,
} from '../buscadorSql';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos } from '../validar';
import {
  accesoDe,
  alcanceObjetoSql,
  alcancePedidosDe,
  filtroAlcance,
  servicioOperacionSql,
} from '../accesoInterno';
// C-BUSCADOR-INSTANTANEO: la misma pieza de viajes por código que «Pedidos en curso».
import { viajesPorCodigo } from '../monitoreo';

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

/** Países donde el celular se dice con un «0» delante (prefijo nacional): Venezuela, Colombia, Perú. */
const PREFIJOS_CON_CERO = ['58', '57', '51'] as const;

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
  /** La clase, sin traducir: tipo de comercio, servicio del viaje, tipo de vehículo o de ticket. */
  clase?: string | null;
  fecha?: string | null;
  monto?: number | null;
  moneda?: string | null;
  /**
   * C-BUSCADOR-SECCIONES: un acceso directo más, debajo del resultado («Ver sus papeles» abre la
   * verificación de un conductor o del dueño de un comercio). Relativo a la dirección del superadmin.
   */
  atajo?: { clave: 'papeles'; enlace: string };
};
export const GRUPOS_BUSQUEDA = [
  'pedidos',
  'viajes',
  'clientes',
  'repartidores',
  'restaurantes',
  'vehiculos',
  'tickets',
  // C-BUSCADOR-SECCIONES: las empresas de Divoox Flex.
  'empresas',
] as const;
export type GrupoBusqueda = (typeof GRUPOS_BUSQUEDA)[number];

const todas = (db: D1Database, sql: string, ...valores: unknown[]) =>
  db
    .prepare(sql)
    .bind(...valores)
    .all<Fila>()
    .then((r) => r.results);
const todasSinAlcance = todas;

// ───────────────────────── Personas: clientes, repartidores, comercios ─────────────────────────

/**
 * C-BUSCADOR-SECCIONES (19 nov 2026): una cuenta se encuentra en CUALQUIER estado. Antes las
 * búsquedas por nombre, teléfono y comienzo del correo pedían `activo = 1`, así que una cuenta
 * suspendida no salía; y el comienzo del correo solo se buscaba con «@». Solo quedan fuera las
 * cuentas borradas por su dueño (nombre «Cuenta borrada», sin datos): esas se abren por su id.
 * Es un filtro de la fila ya encontrada por el índice: no cambia el índice ni lee de más.
 */
export const SIN_BORRADAS = "NOT (activo = 0 AND nombre = 'Cuenta borrada')";

/** Ids de cuentas de un rol por comienzo de cualquier palabra del nombre (sin acentos), del teléfono o del correo. */
async function idsDeCuentas(
  db: D1Database,
  rol: 'cliente' | 'repartidor' | 'restaurante',
  b: BusquedaInterna,
  tope: number,
  acceso: AccesoInterno | null = null,
): Promise<string[]> {
  // C-PERMISOS-FINOS: con alcance, cada consulta lleva la condición de la persona (por su llave),
  // antes del LIMIT: el tope de 5 se llena con gente de su zona, no se recorta después.
  const objeto = rol === 'cliente' ? 'cliente' : rol === 'repartidor' ? 'repartidor' : 'persona';
  const al = (id: string) => alcanceObjetoSql(acceso, objeto, id);
  const todas = (db: D1Database, sql: string, ...valores: unknown[]) => {
    const tabla = /FROM (\w+)/.exec(sql)?.[1] ?? 'usuarios';
    const id =
      tabla === 'repartidores' || tabla === 'repartidor_datos'
        ? `${tabla}.usuario_id`
        : tabla === 'vehiculos'
          ? 'vehiculos.conductor_id'
          : 'usuarios.id';
    const a = al(id);
    if (!a.sql) return todasSinAlcance(db, sql, ...valores);
    // El alcance va justo antes del ORDER BY o del LIMIT final (si hay LIMIT, el último valor es
    // el tope): así cuenta antes de cortar en 5.
    const conTope = sql.endsWith(' LIMIT ?');
    const orden = sql.lastIndexOf(' ORDER BY ');
    const corte = orden >= 0 ? orden : conTope ? sql.length - ' LIMIT ?'.length : sql.length;
    const conAlcance = `${sql.slice(0, corte)}${a.sql}${sql.slice(corte)}`;
    const tope = conTope ? valores.slice(-1) : [];
    const resto = conTope ? valores.slice(0, -1) : valores;
    return todasSinAlcance(db, conAlcance, ...resto, ...a.valores, ...tope);
  };
  const consultas: Promise<Fila[]>[] = [];
  if (b.nombre) {
    const [desde, hasta] = rangoPrefijo(b.nombre);
    consultas.push(
      todas(
        db,
        `SELECT id FROM usuarios WHERE rol = ? AND ${NOMBRE_PLANO} >= ? AND ${NOMBRE_PLANO} < ? AND ${SIN_BORRADAS} LIMIT ?`,
        rol,
        desde,
        hasta,
        tope,
      ),
    );
    // C-BUSCADOR-APELLIDO: también por el comienzo de su segunda, tercera o cuarta palabra.
    for (const palabra of NOMBRE_DESDE_PALABRA)
      consultas.push(
        todas(
          db,
          `SELECT id FROM usuarios WHERE rol = ? AND ${palabra} >= ? AND ${palabra} < ? AND ${SIN_BORRADAS} LIMIT ?`,
          rol,
          desde,
          hasta,
          tope,
        ),
      );
  }
  // C-REGISTRO-TODO-EL-PAIS: por la ciudad donde vive (desde la primera letra, sin acentos) y por el
  // nombre de su estado («zulia», «califor»): por sus índices parciales, solo cuentas con lugar.
  if (b.nombre && rol !== 'restaurante') {
    const [desde, hasta] = rangoPrefijo(b.nombre);
    consultas.push(
      todas(
        db,
        `SELECT id FROM usuarios WHERE rol = ? AND ${LUGAR_CIUDAD_PLANA} >= ? AND ${LUGAR_CIUDAD_PLANA} < ? AND lugar_id IS NOT NULL AND ${SIN_BORRADAS} LIMIT ?`,
        rol,
        desde,
        hasta,
        tope,
      ),
    );
    if (b.nombre.length >= 3)
      for (const [pais, e] of [
        ...ESTADOS_VE.map((x) => ['VE', x] as const),
        ...ESTADOS_US.map((x) => ['US', x] as const),
      ]
        .filter(([, x]) => sinAcentos(x.nombre).startsWith(b.nombre!))
        .slice(0, 3))
        consultas.push(
          todas(
            db,
            `SELECT id FROM usuarios WHERE rol = ? AND lugar_pais = ? AND lugar_estado = ? AND lugar_id IS NOT NULL AND ${SIN_BORRADAS} LIMIT ?`,
            rol,
            pais,
            e.codigo,
            tope,
          ),
        );
  }
  if (b.telefono) {
    const d = b.telefono;
    // El teléfono único guarda solo dígitos y suma el «1» a los de diez cifras de EE. UU.
    const comienzos = new Set([d]);
    if (!d.startsWith('1') && d.length <= 10) comienzos.add(`1${d}`);
    // C-TELEFONO-E164: «0424…» como lo dice la gente en Venezuela, Colombia o Perú también encuentra
    // el número guardado con su código («58424…»).
    if (d.startsWith('0') && d.length >= 4)
      for (const p of PREFIJOS_CON_CERO) comienzos.add(`${p}${d.slice(1)}`);
    for (const c of comienzos) {
      const [desde, hasta] = rangoPrefijo(c);
      consultas.push(
        todas(
          db,
          `SELECT id FROM usuarios WHERE telefono_canonico >= ? AND telefono_canonico < ? AND +rol = ? AND ${SIN_BORRADAS} LIMIT ?`,
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
        `SELECT id FROM usuarios INDEXED BY usuarios_telefono_viejo WHERE telefono_canonico IS NULL AND telefono IS NOT NULL AND telefono != '' AND ${TELEFONO_DIEZ} >= ? AND ${TELEFONO_DIEZ} < ? AND +rol = ? AND ${SIN_BORRADAS} LIMIT ?`,
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
        `SELECT id FROM usuarios WHERE ${CON_TELEFONO} AND ${TELEFONO_FINAL} = ? AND ${TELEFONO_DIGITOS} LIKE ? AND +rol = ? AND ${SIN_BORRADAS} LIMIT ?`,
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
          `SELECT id FROM usuarios WHERE correo >= ? AND correo < ? AND +rol = ? AND ${SIN_BORRADAS} LIMIT ?`,
          desde,
          hasta,
          rol,
          tope,
        ),
      );
    }
  }
  // C-BUSCADOR-SECCIONES: «kpr» ya encuentra «kprado07@gmail.com», desde la primera letra, por el
  // índice del correo (y por el del correo único, que en Gmail no lleva puntos).
  if (b.inicioCorreo && !b.correo) {
    const variantes = new Map<string, string>([['correo', b.inicioCorreo]]);
    if (b.inicioCorreo.includes('.'))
      variantes.set('correo_canonico', b.inicioCorreo.replace(/\./g, ''));
    for (const [columna, inicio] of variantes) {
      const [desde, hasta] = rangoPrefijo(inicio);
      consultas.push(
        todas(
          db,
          `SELECT id FROM usuarios WHERE ${columna} >= ? AND ${columna} < ? AND +rol = ? AND ${SIN_BORRADAS} LIMIT ?`,
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
      // C-ID-DEL-PAIS: el ID viejo de un conductor (reasignado) también lo encuentra.
      todas(
        db,
        'SELECT usuario_id AS id FROM codigos_repartidor_anteriores WHERE codigo >= ? AND codigo < ? LIMIT ?',
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

async function idsDeComercios(
  db: D1Database,
  b: BusquedaInterna,
  tope: number,
  acceso: AccesoInterno | null = null,
) {
  const al = alcanceObjetoSql(acceso, 'restaurante', 'restaurantes.id');
  const consultas: Promise<Fila[]>[] = [];
  if (b.nombre) {
    const [desde, hasta] = rangoPrefijo(b.nombre);
    consultas.push(
      todas(
        db,
        `SELECT id FROM restaurantes WHERE ${NOMBRE_PLANO} >= ? AND ${NOMBRE_PLANO} < ?${al.sql} LIMIT ?`,
        desde,
        hasta,
        ...al.valores,
        tope,
      ),
    );
    for (const palabra of NOMBRE_DESDE_PALABRA)
      consultas.push(
        todas(
          db,
          `SELECT id FROM restaurantes WHERE ${palabra} >= ? AND ${palabra} < ?${al.sql} LIMIT ?`,
          desde,
          hasta,
          ...al.valores,
          tope,
        ),
      );
  }
  if (b.id)
    consultas.push(
      todas(db, `SELECT id FROM restaurantes WHERE id = ?${al.sql}`, b.id, ...al.valores),
    );
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

/** Un grupo del buscador de arriba con cuántos hay en total (solo pedidos y viajes por código). */
type GrupoConTotal = { resultados: ResultadoBusqueda[]; total?: number; totalMas?: boolean };

const aResultadoPedido = (f: Fila, coincide: string): ResultadoBusqueda => ({
  id: String(f.id),
  titulo: `#${String(f.id).slice(0, 6).toUpperCase()}`,
  detalle: [texto(f.restaurante), nombreCliente(f)].filter(Boolean).join(' · '),
  estado: texto(f.estado),
  ciudad: texto(f.ciudad),
  enlace: `/orders/${String(f.id)}`,
  coincide,
  fecha: texto(f.creado_en),
  monto: f.total == null ? null : Number(f.total),
  moneda: texto(f.moneda) ?? 'USD',
});

async function grupoPedidos(
  db: D1Database,
  b: BusquedaInterna,
  acceso: AccesoInterno | null,
): Promise<GrupoConTotal> {
  // C-PERMISOS-FINOS: el alcance va EN cada consulta, antes del LIMIT (con `+`: no cambia el índice).
  const al = alcancePedidosDe(acceso);
  // C-BUSCADOR-INSTANTANEO: por código desde la primera letra, vivos (en problemas) primero, y
  // cuántos hay en total para «Ver todos».
  const [exacto, porCodigo, porMonto] = await Promise.all([
    b.id
      ? todas(db, `SELECT p.id FROM pedidos p WHERE p.id = ?${al.sql}`, b.id, ...al.valores)
      : [],
    b.codigo
      ? pedidosPorCodigo(db, b.codigo, { alcance: al, limite: POR_GRUPO, cursor: '' })
      : null,
    b.monto !== undefined
      ? todas(
          db,
          `SELECT p.id FROM pedidos p WHERE p.creado_en >= datetime('now', '-30 days') AND p.total = ?${al.sql} ORDER BY p.creado_en DESC LIMIT ?`,
          b.monto,
          ...al.valores,
          POR_GRUPO,
        )
      : [],
  ]);
  // Los pocos que se muestran, con su restaurante, cliente y ciudad (una consulta por la llave).
  const ids = [
    ...new Set([
      ...exacto.map((f) => String(f.id)),
      ...(porCodigo ? [...porCodigo.vivos, ...porCodigo.cerrados].map((x) => x.id) : []),
      ...porMonto.map((f) => String(f.id)),
    ]),
  ].slice(0, POR_GRUPO);
  if (!ids.length)
    return { resultados: [], total: porCodigo?.total, totalMas: porCodigo?.totalMas };
  const porId = new Map(
    (
      await todas(
        db,
        `SELECT ${PEDIDO_COLUMNAS} FROM pedidos p ${PEDIDO_UNIONES} WHERE p.id IN (${marcas(ids.length)})`,
        ...ids,
      )
    ).map((f) => [String(f.id), f]),
  );
  const resultados = ids.flatMap((id) => {
    const f = porId.get(id);
    return f ? [aResultadoPedido(f, b.codigo ?? (b.id ? String(f.id).slice(0, 6) : ''))] : [];
  });
  return porCodigo
    ? {
        resultados,
        total: Math.max(porCodigo.total, resultados.length),
        totalMas: porCodigo.totalMas,
      }
    : { resultados };
}

async function grupoViajes(
  db: D1Database,
  b: BusquedaInterna,
  acceso: AccesoInterno | null,
): Promise<GrupoConTotal> {
  if (!b.codigo && !b.id) return { resultados: [] };
  const al = filtroAlcance(acceso, {
    zona: '+o.zona_id',
    servicio: servicioOperacionSql('o.servicio_id'),
  });
  // C-BUSCADOR-INSTANTANEO: la MISMA pieza que «Pedidos en curso» (vivos primero, total).
  const r = await viajesPorCodigo(db, b, {
    servicios: SERVICIOS_DE_VIAJE.map((x) => servicioIdDeOperacion(x) ?? '').filter(Boolean),
    alcanceSql: al,
    limite: POR_GRUPO,
    cursor: '',
  });
  const resultados = [...r.vivos, ...r.cerrados].slice(0, POR_GRUPO).map((v) => ({
    id: v.id,
    titulo: `#${v.id.slice(0, 6).toUpperCase()}`,
    clase: servicioIdDeOperacion(v.servicio) ?? null,
    detalle: [v.pasajero, v.conductor].filter(Boolean).join(' · '),
    estado: v.estado,
    ciudad: v.ciudad,
    // C-FICHA-OPERACION: cada viaje abre su propia ficha.
    enlace: `/rides/${v.id}`,
    coincide: b.codigo ?? v.id.slice(0, 6),
    fecha: v.creadoEn,
    monto: v.total,
    moneda: v.moneda,
  }));
  return { resultados, total: Math.max(r.total, resultados.length), totalMas: r.totalMas };
}

/**
 * C-BUSCADOR-SECCIONES: el estado de una cuenta, en una clave que el panel dice en palabras. El de
 * un conductor sale de su verificación (KYC) y de sus papeles; el de un cliente, del correo.
 * - `eliminada`: la borró su dueño. `suspendido`: el equipo la apagó (activo = 0).
 * - Conductor: `rechazado` (verificación no aprobada), `papeles_pendientes` (envió su verificación
 *   o un papel y espera revisión), `sin_verificar` (todavía no envió nada), o `aprobado`.
 * - Cliente: `sin_confirmar` mientras no confirme su correo; si no, sin estado (todo bien).
 */
export function estadoDeCuenta(
  rol: 'cliente' | 'repartidor',
  f: {
    activo?: unknown;
    nombre?: unknown;
    kyc?: unknown;
    papeles_pendientes?: unknown;
    correo_confirmado_en?: unknown;
  },
): string | null {
  if (Number(f.activo ?? 1) !== 1)
    return String(f.nombre) === 'Cuenta borrada' ? 'eliminada' : 'suspendido';
  if (rol === 'cliente') return f.correo_confirmado_en ? null : 'sin_confirmar';
  const kyc = texto(f.kyc) ?? 'sin_enviar';
  if (kyc === 'rechazado') return 'rechazado';
  if (kyc === 'pendiente' || Number(f.papeles_pendientes ?? 0) === 1) return 'papeles_pendientes';
  if (kyc === 'aprobado') return 'aprobado';
  return 'sin_verificar';
}

async function grupoCuentas(
  db: D1Database,
  quien: Usuario,
  rol: 'cliente' | 'repartidor',
  b: BusquedaInterna,
  acceso: AccesoInterno | null,
): Promise<ResultadoBusqueda[]> {
  const ids = await idsDeCuentas(db, rol, b, POR_GRUPO, acceso);
  if (!ids.length) return [];
  // La verificación (por su llave) y un papel pendiente (por el índice del conductor): una o dos
  // filas por cuenta, nunca la tabla.
  const filas = await todas(
    db,
    `SELECT u.id, u.nombre, u.correo, u.telefono, u.activo, u.correo_confirmado_en,
        z.nombre AS ciudad, d.codigo, x.placa, x.vehiculo_tipo, k.estado AS kyc,
        u.lugar_pais, u.lugar_estado, u.lugar_municipio, u.lugar_ciudad, u.lugar_id, u.lugar_lat, u.lugar_lng,
        ${rol === 'repartidor' ? `${zonaRealSql('d', 'u')} IS NULL` : '1'} AS sin_zona_real,
        ${
          rol === 'repartidor'
            ? "EXISTS (SELECT 1 FROM conductor_documentos cd WHERE cd.conductor_id = u.id AND cd.estado = 'pendiente')"
            : '0'
        } AS papeles_pendientes
       FROM usuarios u LEFT JOIN repartidores d ON d.usuario_id = u.id
       LEFT JOIN repartidor_datos x ON x.usuario_id = u.id
       LEFT JOIN kyc k ON k.usuario_id = u.id
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
    const estado = estadoDeCuenta(rol, f);
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
        estado,
        // C-REGISTRO-TODO-EL-PAIS: sin ciudad real, la ciudad donde vive (nunca el Miami por defecto).
        ciudad: (() => {
          const lugar = lugarDeFila(f as never);
          return Number(f.sin_zona_real) === 1 && lugar ? lugarEscrito(lugar) : texto(f.ciudad);
        })(),
        enlace: `/${rol === 'cliente' ? 'customers' : 'drivers'}/${id}`,
        coincide,
        // C-BUSCADOR-SECCIONES: el acceso directo a sus papeles (la verificación de ESA persona).
        ...(rol === 'repartidor' && estado !== 'eliminada'
          ? { atajo: { clave: 'papeles' as const, enlace: `/verifications/${id}` } }
          : {}),
      },
    ];
  });
}

/** Ids en tandas de 80 (D1 acepta 100 valores por consulta; queda sitio para el alcance). */
const TANDA = 80;
async function enTandas(ids: string[], f: (tanda: string[]) => Promise<Fila[]>): Promise<Fila[]> {
  const partes: Promise<Fila[]>[] = [];
  for (let i = 0; i < ids.length; i += TANDA) partes.push(f(ids.slice(i, i + TANDA)));
  return (await Promise.all(partes)).flat();
}

/**
 * Restaurantes y tiendas: por su nombre o su id, y — C-BUSCADOR-SECCIONES — también por la cuenta de
 * su dueño (nombre, teléfono o correo, en cualquier estado). Un dueño que se registró y todavía no
 * terminó de cargar su comercio sale igual, con «Registro sin terminar», y lleva a su verificación.
 */
async function grupoComercios(
  db: D1Database,
  quien: Usuario,
  b: BusquedaInterna,
  acceso: AccesoInterno | null,
): Promise<ResultadoBusqueda[]> {
  const [porNombre, duenos] = await Promise.all([
    idsDeComercios(db, b, POR_GRUPO, acceso),
    // Desde la segunda letra: con una sola, el comercio ya sugiere por su nombre (y no se lee de más).
    b.texto.length >= 2 ? idsDeCuentas(db, 'restaurante', b, POR_GRUPO, null) : [],
  ]);
  const al = alcanceObjetoSql(acceso, 'restaurante', 'restaurantes.id');
  const deDuenos = duenos.length
    ? await enTandas(duenos, (t) =>
        todas(
          db,
          `SELECT id, dueno_id FROM restaurantes WHERE dueno_id IN (${marcas(t.length)})${al.sql}`,
          ...t,
          ...al.valores,
        ),
      )
    : [];
  const conComercio = new Set(deDuenos.map((f) => String(f.dueno_id)));
  // Los dueños sin comercio: solo los que su alcance deja ver (por la cuenta).
  const sinComercio = duenos.filter((d) => !conComercio.has(d));
  const ap = alcanceObjetoSql(acceso, 'persona', 'usuarios.id');
  const cuentas = sinComercio.length
    ? await todas(
        db,
        `SELECT id, nombre, correo, activo FROM usuarios WHERE id IN (${marcas(sinComercio.length)})${ap.sql}`,
        ...sinComercio,
        ...ap.valores,
      )
    : [];
  const ids = [...new Set([...porNombre, ...deDuenos.map((f) => String(f.id))])].slice(
    0,
    POR_GRUPO,
  );
  const filas = ids.length
    ? await todas(
        db,
        `SELECT r.id, r.nombre, r.tipo_comercio, r.estado, r.dueno_id, z.nombre AS ciudad
           FROM restaurantes r LEFT JOIN zonas z ON z.id = r.zona_id WHERE r.id IN (${marcas(ids.length)})`,
        ...ids,
      )
    : [];
  const porId = new Map(filas.map((f) => [String(f.id), f]));
  const comercios: ResultadoBusqueda[] = ids.flatMap((id) => {
    const f = porId.get(id);
    return f
      ? [
          {
            id,
            titulo: String(f.nombre),
            detalle: '',
            clase: String(f.tipo_comercio ?? 'restaurante'),
            estado: texto(f.estado),
            ciudad: texto(f.ciudad),
            enlace: `/restaurants/${id}`,
            coincide: b.nombre ?? '',
            ...(f.dueno_id
              ? {
                  atajo: {
                    clave: 'papeles' as const,
                    enlace: `/verifications/${String(f.dueno_id)}`,
                  },
                }
              : {}),
          },
        ]
      : [];
  });
  const registros: ResultadoBusqueda[] = cuentas.map((f) => ({
    id: String(f.id),
    titulo: String(f.nombre),
    detalle: contactoVisible(quien, 'correo', f.correo),
    clase: 'registro',
    estado: Number(f.activo ?? 1) === 1 ? 'registro_sin_terminar' : 'suspendido',
    ciudad: null,
    enlace: `/verifications/${String(f.id)}`,
    coincide: b.nombre ?? '',
  }));
  return [...comercios, ...registros].slice(0, POR_GRUPO);
}

/**
 * C-BUSCADOR-SECCIONES: las empresas de Divoox Flex, en cualquier estado (activa, pausada, cerrada),
 * por su nombre (índice sin acentos), su id o el correo de su dueño o de un miembro. El dinero de
 * las empresas es de toda la startup: solo lo ve quien tiene alcance total (como su ficha).
 */
async function grupoEmpresas(
  db: D1Database,
  quien: Usuario,
  b: BusquedaInterna,
  acceso: AccesoInterno | null,
): Promise<ResultadoBusqueda[]> {
  if (acceso && !alcanceEsTotal(acceso.alcance)) return [];
  const consultas: Promise<Fila[]>[] = [];
  // Desde la segunda letra, como el dueño de un comercio.
  if (b.nombre && b.nombre.length >= 2) {
    const [desde, hasta] = rangoPrefijo(b.nombre);
    consultas.push(
      todas(
        db,
        `SELECT id FROM empresas WHERE ${NOMBRE_PLANO} >= ? AND ${NOMBRE_PLANO} < ? LIMIT ?`,
        desde,
        hasta,
        POR_GRUPO,
      ),
    );
  }
  if (b.id) consultas.push(todas(db, 'SELECT id FROM empresas WHERE id = ?', b.id));
  const correoCompleto = b.correo && /@[^@\s]+\.[a-z]{2,}$/i.test(b.correo) ? b.correo : null;
  const inicio = b.correo && !correoCompleto ? b.correo : (b.inicioCorreo ?? null);
  if (correoCompleto || inicio) {
    const [desde, hasta] = rangoPrefijo(inicio ?? '');
    const personas = (
      correoCompleto
        ? await todas(db, 'SELECT id FROM usuarios WHERE correo = ? LIMIT ?', correoCompleto, 1)
        : await todas(
            db,
            'SELECT id FROM usuarios WHERE correo >= ? AND correo < ? LIMIT ?',
            desde,
            hasta,
            POR_GRUPO,
          )
    ).map((f) => String(f.id));
    if (personas.length)
      consultas.push(
        todas(
          db,
          `SELECT id FROM empresas WHERE dueno_id IN (${marcas(personas.length)}) LIMIT ?`,
          ...personas,
          POR_GRUPO,
        ),
        todas(
          db,
          `SELECT empresa_id AS id FROM empresa_miembros WHERE usuario_id IN (${marcas(personas.length)}) LIMIT ?`,
          ...personas,
          POR_GRUPO,
        ),
      );
  }
  if (!consultas.length) return [];
  const ids = [...new Set((await Promise.all(consultas)).flat().map((f) => String(f.id)))].slice(
    0,
    POR_GRUPO,
  );
  if (!ids.length) return [];
  const filas = await todas(
    db,
    `SELECT e.id, e.nombre, e.pais, e.estado, u.correo
       FROM empresas e LEFT JOIN usuarios u ON u.id = e.dueno_id WHERE e.id IN (${marcas(ids.length)})`,
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
            detalle: contactoVisible(quien, 'correo', f.correo),
            clase: 'empresa',
            estado: texto(f.estado),
            ciudad: texto(f.pais),
            enlace: `/flexfinance/${id}`,
            coincide: b.nombre ?? '',
          },
        ]
      : [];
  });
}

async function grupoVehiculos(
  db: D1Database,
  b: BusquedaInterna,
  acceso: AccesoInterno | null,
): Promise<ResultadoBusqueda[]> {
  if (!b.placa) return [];
  const [desde, hasta] = rangoPrefijo(b.placa);
  const al = alcanceObjetoSql(acceso, 'repartidor', 'vehiculos.conductor_id');
  const filas = await todas(
    db,
    `SELECT x.id, x.placa, x.tipo, x.estado, x.marca, x.modelo, x.conductor_id, u.nombre AS dueno
       FROM (SELECT id, placa, tipo, estado, marca, modelo, conductor_id FROM vehiculos
              WHERE placa != '' AND upper(placa) >= ? AND upper(placa) < ?${al.sql} LIMIT ?) x
       LEFT JOIN usuarios u ON u.id = x.conductor_id`,
    desde,
    hasta,
    ...al.valores,
    POR_GRUPO,
  );
  return filas.map((f) => ({
    id: String(f.id),
    titulo: String(f.placa).toUpperCase(),
    clase: texto(f.tipo),
    detalle: [[f.marca, f.modelo].filter(Boolean).join(' '), texto(f.dueno)]
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
  acceso: AccesoInterno | null,
): Promise<ResultadoBusqueda[]> {
  const al = alcanceObjetoSql(acceso, 'ticket', 'tickets.id');
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
            WHERE ${donde}${al.sql} ORDER BY +actualizado_en DESC LIMIT ?`,
          ...valores,
          ...al.valores,
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
      clase: texto(f.tipo),
      detalle: contactoVisible(quien, 'correo', f.correo),
      estado: texto(f.estado),
      ciudad: texto(f.ciudad) || null,
      enlace: `/tickets/${String(f.id)}`,
      coincide: b.codigo ?? '',
      fecha: texto(f.actualizado_en),
    }));
}

/**
 * El permiso de lectura que pide cada grupo (además de `monitoreo.buscar`, que pide la ruta): nadie
 * encuentra en el buscador lo que no podría abrir. Los pedidos, con `pedidos.ver` o `monitoreo.ver`.
 */
export const PERMISO_GRUPO: Record<GrupoBusqueda, readonly PermisoInterno[]> = {
  pedidos: ['pedidos.ver', 'monitoreo.ver'],
  viajes: ['viajes.ver'],
  clientes: ['clientes.ver'],
  repartidores: ['repartidores.ver'],
  restaurantes: ['restaurantes.ver'],
  vehiculos: ['repartidores.ver'],
  tickets: ['tickets.ver'],
  empresas: ['dinero.ver'],
};

/**
 * Todo el buscador de arriba: grupos con tope de 5, y el salto directo si lo escrito es un id.
 * C-PERMISOS-FINOS: cada grupo exige su permiso de lectura y lleva el alcance (ciudad, país,
 * servicio) de quien busca EN la consulta. `acceso` null = sin límites (solo pruebas internas).
 */
export async function buscarEnSuperadmin(
  db: D1Database,
  quien: Usuario,
  q: string,
  acceso: AccesoInterno | null = null,
) {
  const b = interpretarBusqueda(q);
  if (b.vacia) return { q: b.texto, grupos: [], salto: null, avisoMonto: false };
  const permisos = new Map(Object.entries(PERMISO_GRUPO));
  const toca = (g: GrupoBusqueda) =>
    !acceso || (permisos.get(g) ?? []).some((p) => puedeVer(acceso, p));
  const si = (g: GrupoBusqueda, f: () => Promise<ResultadoBusqueda[] | GrupoConTotal>) =>
    toca(g)
      ? f().then((x) => (Array.isArray(x) ? { resultados: x } : x))
      : Promise.resolve<GrupoConTotal>({ resultados: [] });
  const [pedidos, viajes, clientes, repartidores, restaurantes, vehiculos, tickets, empresas] =
    await Promise.all([
      si('pedidos', () => grupoPedidos(db, b, acceso)),
      si('viajes', () => grupoViajes(db, b, acceso)),
      si('clientes', () => grupoCuentas(db, quien, 'cliente', b, acceso)),
      si('repartidores', () => grupoCuentas(db, quien, 'repartidor', b, acceso)),
      si('restaurantes', () => grupoComercios(db, quien, b, acceso)),
      si('vehiculos', () => grupoVehiculos(db, b, acceso)),
      si('tickets', () => grupoTickets(db, quien, b, acceso)),
      si('empresas', () => grupoEmpresas(db, quien, b, acceso)),
    ]);
  const grupos = Object.entries({
    pedidos,
    viajes,
    clientes,
    repartidores,
    restaurantes,
    vehiculos,
    tickets,
    empresas,
  })
    .filter(([, g]) => g.resultados.length > 0)
    .map(([tipo, g]) => ({
      tipo: tipo as GrupoBusqueda,
      resultados: g.resultados,
      // C-BUSCADOR-INSTANTANEO: cuántos hay (pedidos y viajes por código) para «Ver todos».
      ...(g.total !== undefined ? { total: g.total, totalMas: Boolean(g.totalMas) } : {}),
    }));
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
  return c.json(await buscarEnSuperadmin(base(c), u, q, accesoDe(c)));
});

// ───────────────────────── «Pedidos en curso» con la misma lógica ─────────────────────────

export type ParametrosLista = {
  zona: string;
  estado: FiltroEstadoPedido;
  orden: 'recientes' | 'antiguos';
  q: string;
  despues: string;
  /**
   * C-PERMISOS-FINOS: el alcance de quien mira (ciudad, país, servicio), ya armado por
   * `alcancePedidos`. Sin alcance, nada. Va con `+` en las columnas: no cambia el índice elegido.
   */
  alcance?: { sql: string; valores: unknown[] };
  /** C-PERMISOS-FINOS: lo mismo para los viajes del monitoreo (se mira en cada fila leída). */
  dentroViaje?: (f: Record<string, unknown>) => boolean;
  /** C-MONITOREO-SERVICIOS: pestaña de servicio (comida o tiendas filtra; lo demás no). */
  servicio?: ServicioMonitoreo;
  /** C-BUSCADOR-INSTANTANEO: cuántos cerrados por página al buscar por código (el buscador de arriba pide 5). */
  limite?: number;
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
  // Una clave «fecha~fila», o la doble del monitoreo «p:<clave|fin>|v:<clave|fin>».
  const clave = '(?:[0-9: -]{10,19}~\\d{1,19}|fin)?';
  const doble = new RegExp(`^p:${clave}\\|v:${clave}$`);
  if (despues && !/^[0-9: -]{10,19}~\d{1,19}$/.test(despues) && !doble.test(despues))
    throw new ErrorDatos('La página pedida no es válida.', 'despues', 400);
  const sv = consulta('servicio');
  return {
    zona: (consulta('zona') ?? '').slice(0, 60),
    estado,
    orden,
    q: (consulta('q') ?? '').slice(0, 80),
    despues,
    servicio: esServicioMonitoreo(sv) ? sv : 'todos',
  };
}

/**
 * La condición de «después de esta fila» para la paginación por clave: la fecha y, si empata, el
 * número de fila (rowid). Los índices por fecha ya guardan el rowid al final, así que el orden
 * (fecha, rowid) sale del índice sin ordenar nada y la consulta para al juntar la página.
 */
export function despuesDe(
  cursor: string,
  orden: 'recientes' | 'antiguos',
  t = 'p',
): [string, unknown[]] {
  if (!cursor) return ['', []];
  const [fecha = '', fila = '0'] = cursor.split('~');
  return orden === 'recientes'
    ? [
        ` AND ${t}.creado_en <= ? AND (${t}.creado_en < ? OR ${t}.rowid < ?)`,
        [fecha, fecha, Number(fila)],
      ]
    : [
        ` AND ${t}.creado_en >= ? AND (${t}.creado_en > ? OR ${t}.rowid > ?)`,
        [fecha, fecha, Number(fila)],
      ];
}

export const cursorDe = (f: Fila) => `${String(f.creado_en)}~${Number(f.fila)}`;

/** Ordena filas por (fecha, rowid) en la dirección pedida. */
export function ordenarPorClave(filas: Fila[], direccion: 'ASC' | 'DESC'): Fila[] {
  return [...filas].sort((a, b) => {
    const c =
      String(a.creado_en).localeCompare(String(b.creado_en)) || Number(a.fila) - Number(b.fila);
    return direccion === 'ASC' ? c : -c;
  });
}

/** Cuántas filas se leen por vuelta y cuántas vueltas como mucho cuando hay un filtro que el índice no ve. */
const LOTE_FILTRADO = 200;
const VUELTAS_FILTRADO = 5;

/**
 * C-MONITOREO-SERVICIOS: una página por clave con un filtro que el índice no ve (el servicio).
 * Sin filtro, una sola consulta de 51 (lo de siempre). Con filtro, se leen lotes de 200 en orden
 * hasta juntar 51 o hasta cinco lotes: así nunca se recorre la historia entera por una pestaña con
 * pocos pedidos, y si se paró por el tope, «Cargar más» sigue desde la última fila MIRADA (nunca
 * hay un tope mudo: la siguiente página empieza justo donde se dejó de mirar).
 */
export async function paginaPorClave(
  traer: (cursor: string, limite: number) => Promise<Fila[]>,
  cursor: string,
  filtro: ((f: Fila) => boolean) | null,
): Promise<{ filas: Fila[]; siguiente: string | null }> {
  if (!filtro) {
    const filas = await traer(cursor, POR_PAGINA + 1);
    const pagina = filas.slice(0, POR_PAGINA);
    const ultima = pagina.at(-1);
    return {
      filas: pagina,
      siguiente: filas.length > POR_PAGINA && ultima ? cursorDe(ultima) : null,
    };
  }
  const elegidas: Fila[] = [];
  let mirada = cursor;
  let agotado = false;
  for (let vuelta = 0; vuelta < VUELTAS_FILTRADO && elegidas.length <= POR_PAGINA; vuelta++) {
    const lote = await traer(mirada, LOTE_FILTRADO);
    for (const f of lote) {
      mirada = cursorDe(f);
      if (filtro(f)) elegidas.push(f);
      if (elegidas.length > POR_PAGINA) break;
    }
    if (lote.length < LOTE_FILTRADO) {
      agotado = elegidas.length <= POR_PAGINA;
      break;
    }
  }
  if (elegidas.length > POR_PAGINA) {
    const pagina = elegidas.slice(0, POR_PAGINA);
    return { filas: pagina, siguiente: cursorDe(pagina[POR_PAGINA - 1] as Fila) };
  }
  return { filas: elegidas, siguiente: agotado ? null : mirada };
}

const FILA_LISTA = `p.id, p.rowid AS fila, p.estado, p.total, p.moneda, p.creado_en, p.pagado_en, p.aceptado_en, p.listo_en,
  p.recogido_en, p.tiempo_prep_min, p.zona_id, r.nombre AS restaurante, r.tipo_comercio, uc.nombre AS cliente,
  uc.activo AS cliente_activo, ur.nombre AS repartidor, d.codigo AS repartidor_codigo, z.nombre AS ciudad,
  z.zona_horaria`;
const UNIONES_LISTA = `LEFT JOIN restaurantes r ON r.id = p.restaurante_id
  LEFT JOIN usuarios uc ON uc.id = p.cliente_id LEFT JOIN usuarios ur ON ur.id = p.repartidor_id
  LEFT JOIN repartidores d ON d.usuario_id = p.repartidor_id LEFT JOIN zonas z ON z.id = p.zona_id`;
/** El tipo de comercio de la fila, por la llave primaria del restaurante (para filtrar por servicio). */
const TIPO_DE_FILA =
  '(SELECT r2.tipo_comercio FROM restaurantes r2 WHERE r2.id = p.restaurante_id) AS tipo_comercio';

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
    /** La clave de la paginación («fecha~fila»): la usa el monitoreo para seguir donde se dejó. */
    clave: cursorDe(f),
    tipo: 'pedido' as const,
    servicio: servicioDePedido(texto(f.tipo_comercio)) as ServicioConcreto,
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
    zonaHoraria: texto(f.zona_horaria),
    luz:
      cerrado || fechas.estado === 'pago_pendiente'
        ? ('verde' as const)
        : (semaforoPedido(fechas)?.luz ?? ('verde' as const)),
    /**
     * C-BUSCADOR-INSTANTANEO: al buscar por código, los vivos (y el id exacto) van fijos arriba de
     * la primera página; lo demás sigue el orden por clave de «Cargar más».
     */
    fijo: false,
  };
}
export type FilaListaPedido = ReturnType<typeof aFilaLista>;

export const ORDEN_LUZ = new Map([
  ['rojo', 0],
  ['amarillo', 1],
  ['verde', 2],
]);

/** El filtro de servicio sobre filas de pedidos (null = sin filtro). */
function filtroServicioPedido(s: ServicioMonitoreo | undefined): ((f: Fila) => boolean) | null {
  if (s !== 'comida' && s !== 'tiendas') return null;
  return (f) => servicioDePedido(texto(f.tipo_comercio)) === s;
}

/**
 * La lista de «Pedidos en curso» del superadmin. Tres formas, según lo escrito:
 * 1. Código o id: se busca sin importar el estado, la ciudad ni el servicio, y se dice dónde se encontró.
 * 2. Persona, comercio o monto: sus pedidos con el estado, la ciudad y el servicio elegidos.
 * 3. Nada escrito: la lista del estado, la ciudad y el servicio elegidos, de a 50 con «Cargar más».
 */
export async function listarPedidosAdmin(db: D1Database, p: ParametrosLista) {
  const b = interpretarBusqueda(p.q);
  const alc = p.alcance?.sql ?? '';
  const alcValores = p.alcance?.valores ?? [];
  const estados = estadosDelFiltro(p.estado);
  const direccion = p.orden === 'recientes' ? 'DESC' : 'ASC';

  // 1. Por código o id: todos, de cualquier estado y ciudad. Desde la PRIMERA letra del código
  // (C-BUSCADOR-INSTANTANEO): los vivos primero (en problemas arriba), después los cerrados del más
  // reciente al más viejo, con «Cargar más» y cuántos hay en total.
  if (b.codigo || b.id) {
    const limite = p.limite ?? POR_PAGINA;
    const [exacto, porCodigo] = await Promise.all([
      b.id && !p.despues
        ? todas(
            db,
            `SELECT p.id, p.rowid AS fila, p.creado_en FROM pedidos p WHERE p.id = ?${alc}`,
            b.id,
            ...alcValores,
          ).then((ids) => detalles(db, ids, 'DESC'))
        : Promise.resolve([] as Fila[]),
      b.codigo
        ? pedidosPorCodigo(db, b.codigo, { alcance: p.alcance, limite, cursor: p.despues })
        : Promise.resolve(null),
    ]);
    const exactos = exacto.map((f) => ({ ...aFilaLista(f), fijo: true }));
    const yaEsta = new Set(exactos.map((x) => x.id));
    const vivos = (porCodigo?.vivos ?? [])
      .filter((x) => !yaEsta.has(x.id))
      .map((x) => ({ ...x, fijo: true }));
    const cerrados = (porCodigo?.cerrados ?? []).filter((x) => !yaEsta.has(x.id));
    const pedidos = [...exactos, ...vivos, ...cerrados];
    const fuera = pedidos.filter((x) => !estados.includes(x.estado));
    const otrasCiudades = [
      ...new Set(
        pedidos.filter((x) => p.zona && x.zonaId !== p.zona).map((x) => x.ciudad ?? x.zonaId ?? ''),
      ),
    ].filter(Boolean);
    return {
      pedidos,
      siguiente: porCodigo?.siguiente ?? null,
      porCodigo: true,
      masCoincidencias: false,
      total: porCodigo ? porCodigo.total : exactos.length,
      totalMas: porCodigo?.totalMas ?? false,
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

  const zona = p.zona ? ' AND p.zona_id = ?' : '';
  const zonaValores = p.zona ? [p.zona] : [];
  const filtro = filtroServicioPedido(p.servicio);
  let pagina: { filas: Fila[]; siguiente: string | null };

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
        total: 0,
        totalMas: false,
        encontrado: null,
        avisoMonto: false,
      };
    pagina = await paginaPorClave(
      (cursor, limite) => {
        const [tras, trasValores] = despuesDe(cursor, p.orden);
        return todas(
          db,
          `SELECT ${FILA_LISTA} FROM pedidos p ${UNIONES_LISTA}
            WHERE (${quien.join(' OR ')}) AND +p.estado IN (${marcas(estados.length)})${zona.replace('p.zona_id', '+p.zona_id')}${tras}${alc}
            ORDER BY +p.creado_en ${direccion}, p.rowid ${direccion} LIMIT ?`,
          ...valores,
          ...estados,
          ...zonaValores,
          ...trasValores,
          ...alcValores,
          limite,
        );
      },
      p.despues,
      filtro,
    );
  } else if (p.zona) {
    // 3a. Una ciudad: cada estado por su índice (zona, estado, fecha) y se juntan en orden.
    pagina = await paginaPorClave(
      async (cursor, limite) => {
        const [tras, trasValores] = despuesDe(cursor, p.orden);
        const partes = await Promise.all(
          estados.map((e) =>
            todas(
              db,
              `SELECT p.id, p.rowid AS fila, p.creado_en${filtro ? `, ${TIPO_DE_FILA}` : ''} FROM pedidos p
                WHERE p.zona_id = ? AND p.estado = ?${tras}${alc}
                ORDER BY p.creado_en ${direccion}, p.rowid ${direccion} LIMIT ?`,
              p.zona,
              e,
              ...trasValores,
              ...alcValores,
              limite,
            ),
          ),
        );
        return ordenarPorClave(partes.flat(), direccion).slice(0, limite);
      },
      p.despues,
      filtro,
    );
    pagina.filas = await detalles(db, pagina.filas, direccion);
  } else if (p.estado === 'vivos') {
    // 3b. Vivos de todas las ciudades: son pocos (el Manager cierra los viejos); por el estado.
    pagina = await paginaPorClave(
      (cursor, limite) => {
        const [tras, trasValores] = despuesDe(cursor, p.orden);
        return todas(
          db,
          `SELECT p.id, p.rowid AS fila, p.creado_en${filtro ? `, ${TIPO_DE_FILA}` : ''} FROM pedidos p
            WHERE p.estado IN (${marcas(estados.length)})${tras}${alc}
            ORDER BY +p.creado_en ${direccion}, p.rowid ${direccion} LIMIT ?`,
          ...estados,
          ...trasValores,
          ...alcValores,
          limite,
        );
      },
      p.despues,
      filtro,
    );
    pagina.filas = await detalles(db, pagina.filas, direccion);
  } else {
    // 3c. Cerrados o todos, de todas las ciudades: por la fecha (casi todo coincide). La primera
    // página lleva un rango abierto sobre la fecha («hasta el fin de los tiempos»): no cambia nada
    // de lo que trae, pero deja el plan como búsqueda por rango que para en el LIMIT.
    pagina = await paginaPorClave(
      (cursor, limite) => {
        const [tras, trasValores] = cursor
          ? despuesDe(cursor, p.orden)
          : p.orden === 'recientes'
            ? [' AND p.creado_en <= ?', ['9999-12-31 23:59:59']]
            : [' AND p.creado_en >= ?', ['0000-01-01 00:00:00']];
        return todas(
          db,
          // INDEXED BY: con un lote de 200, SQLite prefería recorrer y ordenar (medido: 6.000 filas).
          `SELECT p.id, p.rowid AS fila, p.creado_en${filtro ? `, ${TIPO_DE_FILA}` : ''} FROM pedidos p INDEXED BY pedidos_creado
            WHERE +p.estado IN (${marcas(estados.length)})${tras}${alc}
            ORDER BY p.creado_en ${direccion}, p.rowid ${direccion} LIMIT ?`,
          ...estados,
          ...trasValores,
          ...alcValores,
          limite,
        );
      },
      p.despues,
      filtro,
    );
    pagina.filas = await detalles(db, pagina.filas, direccion);
  }
  let pedidos = pagina.filas.map(aFilaLista);
  // C-MANAGER-1: entre los vivos, los que están en problemas primero.
  if (p.estado === 'vivos')
    pedidos = [...pedidos].sort(
      (a, x) => (ORDEN_LUZ.get(a.luz) ?? 2) - (ORDEN_LUZ.get(x.luz) ?? 2),
    );
  return {
    pedidos,
    siguiente: pagina.siguiente,
    porCodigo: false,
    masCoincidencias: false,
    total: null as number | null,
    totalMas: false,
    encontrado: null,
    avisoMonto: b.monto !== undefined,
  };
}

/**
 * Trae los datos de una página de ids ya ordenada (por la llave primaria). D1 acepta como mucho
 * 100 valores por consulta: con más ids se pide en tandas de `TANDA_IDS`.
 */
async function detalles(
  db: D1Database,
  ids: Fila[],
  direccion: 'ASC' | 'DESC',
  tope = POR_PAGINA + 1,
): Promise<Fila[]> {
  const elegidos = ordenarPorClave(ids, direccion)
    .slice(0, tope)
    .map((f) => String(f.id));
  if (!elegidos.length) return [];
  const tandas: string[][] = [];
  for (let i = 0; i < elegidos.length; i += TANDA_IDS)
    tandas.push(elegidos.slice(i, i + TANDA_IDS));
  const filas = (
    await Promise.all(
      tandas.map((t) =>
        todas(
          db,
          `SELECT ${FILA_LISTA} FROM pedidos p ${UNIONES_LISTA} WHERE p.id IN (${marcas(t.length)})`,
          ...t,
        ),
      ),
    )
  ).flat();
  const porId = new Map(filas.map((f) => [String(f.id), f]));
  return elegidos.flatMap((id) => {
    const f = porId.get(id);
    return f ? [f] : [];
  });
}
/** Ids por consulta `IN (…)`: por debajo del límite de 100 valores de D1. */
export const TANDA_IDS = 80;

// ───────────────────────── Código desde la primera letra (C-BUSCADOR-INSTANTANEO) ─────────────────────────

/**
 * C-BUSCADOR-INSTANTANEO (16 nov 2026, pedido de Richard: escribió «7», «73» y «b4» y no salió
 * nada). Todos los países. El código de un pedido o de un viaje se busca DESDE LA PRIMERA LETRA.
 * Con una o dos letras coinciden muchos (1 de cada 16 con una letra), así que:
 * - Cuántos hay: un conteo por la llave primaria con tope (`TOPE_CUENTA_CODIGO`; después, «1000+»).
 *   Es un recorrido del índice dentro del rango, nunca de la tabla, y para en el tope.
 * - Primero los vivos (con los que están en problemas arriba): por el índice del estado (los vivos
 *   son pocos) y con el comienzo del código como filtro.
 * - Después los cerrados, el más reciente primero, con «Cargar más» por clave:
 *   - si el rango tiene pocos (≤ `UMBRAL_RANGO_CODIGO`, lo normal desde 3 letras), se leen por la
 *     llave primaria y se ordenan en memoria;
 *   - si tiene muchos (una o dos letras), se lee hacia atrás por el índice de la fecha con el
 *     comienzo como filtro: como 1 de cada 16 (o de 256) coincide, para enseguida en el LIMIT.
 * Mirar no escribe nada. Lo fija la prueba de presupuesto de `buscadorInterno.test.ts`.
 */
export const TOPE_CUENTA_CODIGO = 1000;
export const UMBRAL_RANGO_CODIGO = 60;
/** Vivos que entran como mucho en la primera página de una búsqueda por código. */
const TOPE_VIVOS_CODIGO = 200;

/** Cuántos empiezan así (hasta el tope), con una consulta por el índice del rango. */
export async function contarPorCodigo(
  db: D1Database,
  sqlDesde: string,
  valores: unknown[],
  yaContados = 0,
): Promise<{ total: number; totalMas: boolean }> {
  const resto = TOPE_CUENTA_CODIGO + 1 - yaContados;
  const fila = await db
    .prepare(`SELECT count(*) AS n FROM (SELECT 1 ${sqlDesde} LIMIT ${Math.max(resto, 0)})`)
    .bind(...valores)
    .first<{ n: number }>();
  const n = yaContados + Number(fila?.n ?? 0);
  return { total: Math.min(n, TOPE_CUENTA_CODIGO), totalMas: n > TOPE_CUENTA_CODIGO };
}

/** Los cerrados de una página en memoria, después del cursor, el más reciente primero. */
export function paginaEnMemoria(
  filas: Fila[],
  cursor: string,
  limite: number,
): { filas: Fila[]; siguiente: string | null } {
  const orden = ordenarPorClave(filas, 'DESC');
  const [fecha = '', fila = '0'] = cursor ? cursor.split('~') : [];
  const resto = cursor
    ? orden.filter(
        (f) =>
          String(f.creado_en) < fecha ||
          (String(f.creado_en) === fecha && Number(f.fila) < Number(fila)),
      )
    : orden;
  const pagina = resto.slice(0, limite);
  const ultima = pagina.at(-1);
  return { filas: pagina, siguiente: resto.length > limite && ultima ? cursorDe(ultima) : null };
}

export type PedidosPorCodigo = {
  vivos: FilaListaPedido[];
  cerrados: FilaListaPedido[];
  siguiente: string | null;
  total: number;
  totalMas: boolean;
};

/**
 * Pedidos cuyo código empieza por `codigo` (hexadecimal en minúscula, desde UNA letra): vivos
 * primero (en problemas arriba) y después los cerrados, de a `limite`, el más reciente primero.
 * `cursor` vacío = primera página (con los vivos); con cursor, solo cerrados después de esa fila.
 */
export async function pedidosPorCodigo(
  db: D1Database,
  codigo: string,
  opciones: { alcance?: { sql: string; valores: unknown[] }; limite: number; cursor: string },
): Promise<PedidosPorCodigo> {
  const [desde, hasta] = rangoPrefijo(codigo);
  const alc = opciones.alcance?.sql ?? '';
  const alcValores = opciones.alcance?.valores ?? [];
  const vivosSql = marcas(ESTADOS_PEDIDO_VIVOS.length);
  const esVivo = (f: Fila) =>
    (ESTADOS_PEDIDO_VIVOS as readonly string[]).includes(String(f.estado));
  // Primero, el rango por la llave primaria con tope: lo normal (desde 3 letras) es que traiga
  // pocos y con esa sola lectura ya se tiene todo (cuántos, vivos y cerrados).
  const enRango = await todas(
    db,
    `SELECT p.id, p.rowid AS fila, p.creado_en, p.estado FROM pedidos p
      WHERE p.id >= ? AND p.id < ?${alc} ORDER BY p.id LIMIT ?`,
    desde,
    hasta,
    ...alcValores,
    UMBRAL_RANGO_CODIGO + 1,
  );
  let cuenta: { total: number; totalMas: boolean };
  let vivosIds: Fila[];
  let cerrados: { filas: Fila[]; siguiente: string | null };
  if (enRango.length <= UMBRAL_RANGO_CODIGO) {
    cuenta = { total: enRango.length, totalMas: false };
    vivosIds = opciones.cursor ? [] : enRango.filter(esVivo);
    cerrados = paginaEnMemoria(
      enRango.filter((f) => !esVivo(f)),
      opciones.cursor,
      opciones.limite,
    );
  } else {
    // Muchos (una o dos letras): cuántos con tope, los vivos por el índice del estado (pocos) y los
    // cerrados hacia atrás por la fecha con el comienzo del código como filtro (1 de cada 16).
    const [tras, trasValores] = opciones.cursor
      ? despuesDe(opciones.cursor, 'recientes')
      : [' AND p.creado_en <= ?', ['9999-12-31 23:59:59']];
    const [c, v, filas] = await Promise.all([
      // Cuántos más hay después de los ya leídos (sigue el rango desde el último, sin releerlos).
      contarPorCodigo(
        db,
        `FROM pedidos p WHERE p.id > ? AND p.id < ?${alc}`,
        [String(enRango.at(-1)?.id ?? desde), hasta, ...alcValores],
        enRango.length,
      ),
      opciones.cursor
        ? Promise.resolve([] as Fila[])
        : todas(
            db,
            // `+p.id` para que use el índice del estado y no el rango del código.
            `SELECT p.id, p.rowid AS fila, p.creado_en FROM pedidos p
              WHERE p.estado IN (${vivosSql}) AND +p.id >= ? AND +p.id < ?${alc} LIMIT ?`,
            ...ESTADOS_PEDIDO_VIVOS,
            desde,
            hasta,
            ...alcValores,
            TOPE_VIVOS_CODIGO,
          ),
      todas(
        db,
        `SELECT p.id, p.rowid AS fila, p.creado_en FROM pedidos p INDEXED BY pedidos_creado
          WHERE +p.id >= ? AND +p.id < ? AND +p.estado NOT IN (${vivosSql})${tras}${alc}
          ORDER BY p.creado_en DESC, p.rowid DESC LIMIT ?`,
        desde,
        hasta,
        ...ESTADOS_PEDIDO_VIVOS,
        ...trasValores,
        ...alcValores,
        opciones.limite + 1,
      ),
    ]);
    cuenta = c;
    vivosIds = v;
    const pagina = filas.slice(0, opciones.limite);
    const ultima = pagina.at(-1);
    cerrados = {
      filas: pagina,
      siguiente: filas.length > opciones.limite && ultima ? cursorDe(ultima) : null,
    };
  }
  const [vivosDet, cerradosDet] = await Promise.all([
    detalles(db, vivosIds, 'DESC', TOPE_VIVOS_CODIGO),
    detalles(db, cerrados.filas, 'DESC'),
  ]);
  const vivos = vivosDet
    .map(aFilaLista)
    .sort(
      (a, b) =>
        (ORDEN_LUZ.get(a.luz) ?? 2) - (ORDEN_LUZ.get(b.luz) ?? 2) || b.clave.localeCompare(a.clave),
    );
  return {
    vivos,
    cerrados: cerradosDet.map(aFilaLista),
    siguiente: cerrados.siguiente,
    ...cuenta,
  };
}
