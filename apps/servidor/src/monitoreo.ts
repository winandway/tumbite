import {
  type ServicioConcreto,
  type ServicioMonitoreo,
  SERVICIOS_DE_VIAJE,
  ESTADOS_PEDIDO_VIVOS,
  esquemaTarifaViaje,
  interpretarBusqueda,
  rangoPrefijo,
  segundosPorKm,
  semaforoPedido,
  semaforoViaje,
  servicioDeOperacion,
  servicioDePedido,
  servicioIdDeOperacion,
} from '@tumbite/compartido';
import {
  ORDEN_LUZ,
  type ParametrosLista,
  TANDA_IDS,
  UMBRAL_RANGO_CODIGO,
  contarPorCodigo,
  cursorDe,
  despuesDe,
  listarPedidosAdmin,
  ordenarPorClave,
  paginaEnMemoria,
  paginaPorClave,
} from './rutas/buscadorInterno';

/**
 * C-MONITOREO-SERVICIOS (15 nov 2026, pedido de Richard). Todos los países. «Pedidos en curso»
 * vigila pedidos de comida, de tiendas, viajes en auto, viajes en moto y envíos en UNA lista, con
 * pestañas por servicio, el mismo semáforo y paginación por clave («Cargar más», nunca OFFSET ni un
 * tope mudo). El servicio se calcula al leer: no se escribe nada ni se migran datos.
 *
 * Viajes vivos sin recorrer la tabla: «buscando» por el índice parcial `operaciones_busqueda`,
 * asignados y en curso por el índice parcial único `operaciones_una_activa`, y los que esperan el
 * pago de los últimos 30 minutos por `operaciones_viaje_creado` (a los 20 minutos sin pagar se
 * cancelan solos). Cerrados y todos, por `operaciones_viaje_creado` hacia atrás.
 */

type Fila = Record<string, unknown>;
const POR_PAGINA = 50;
const texto = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const numero = (v: unknown): number | null =>
  v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const marcas = (n: number) => Array.from({ length: n }, () => '?').join(', ');
const todas = (db: D1Database, sql: string, ...v: unknown[]) =>
  db
    .prepare(sql)
    .bind(...v)
    .all<Fila>()
    .then((r) => r.results);

/** `operaciones.estado_general` de cada filtro de estado. */
export const ESTADOS_GENERALES = {
  vivos: ['pago_pendiente', 'buscando', 'asignada', 'en_curso'],
  cerrados: ['terminada', 'cancelada', 'sin_conductor'],
} as const;
/** Una espera de pago más vieja que esto ya se canceló sola (C-VIAJE-TARJETA: 20 minutos). */
const MINUTOS_PAGO_PENDIENTE = 30;

const COLUMNAS_VIAJE = `o.id, o.rowid AS fila, o.servicio_id, o.tipo_operacion, o.zona_id, o.creado_en,
  o.estado_general, v.estado, v.asignado_en, v.llego_en, v.iniciado_en, v.origen_direccion,
  v.destino_direccion, v.total_final_centavos, q.total, q.moneda, q.duracion_s, q.tarifa_json,
  pu.nombre AS pasajero, pu.activo AS pasajero_activo, cu.nombre AS conductor, d.codigo AS conductor_codigo,
  z.nombre AS ciudad, z.zona_horaria,
  (SELECT f.km FROM ofertas_operacion f WHERE f.operacion_id = o.id AND f.conductor_id = o.conductor_id) AS km,
  (SELECT MAX(e.creado_en) FROM eventos_operacion e WHERE e.operacion_id = o.id AND e.estado_nuevo = 'buscando') AS buscando_desde,
  EXISTS (SELECT 1 FROM emergencias_viaje m WHERE m.atendida_en IS NULL AND m.operacion_id = o.id) AS emergencia`;
const UNIONES_VIAJE = `JOIN viajes v ON v.operacion_id = o.id
  LEFT JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id
  LEFT JOIN usuarios pu ON pu.id = o.cliente_id LEFT JOIN usuarios cu ON cu.id = o.conductor_id
  LEFT JOIN repartidores d ON d.usuario_id = o.conductor_id LEFT JOIN zonas z ON z.id = o.zona_id`;

/** Una fila de viaje para la lista del monitoreo (misma forma general que la de un pedido). */
export function aFilaViaje(f: Fila, ahora = Date.now()) {
  let tarifa: { factorCallePb: number; velocidadKmh: number; esperaGratisS: number } | null = null;
  try {
    const t = esquemaTarifaViaje.safeParse(JSON.parse(String(f.tarifa_json ?? 'null')));
    if (t.success) tarifa = t.data;
    else if (f.tarifa_json != null)
      console.error('monitoreo: tarifa_json no válida', String(f.id), t.error);
  } catch (e) {
    // El semáforo sigue sin la tarifa (usa los valores de siempre), pero queda en el registro.
    console.error('monitoreo: tarifa_json ilegible', String(f.id), e);
    tarifa = null;
  }
  const km = numero(f.km);
  const estado = String(f.estado ?? f.estado_general);
  const s = semaforoViaje(
    {
      estado,
      creadoEn: String(f.creado_en),
      buscandoDesde: texto(f.buscando_desde),
      asignadoEn: texto(f.asignado_en),
      llegoEn: texto(f.llego_en),
      iniciadoEn: texto(f.iniciado_en),
      llegadaPrevistaMin: km != null && tarifa ? Math.round(segundosPorKm(km, tarifa) / 60) : null,
      esperaGratisMin: tarifa ? Math.round(tarifa.esperaGratisS / 60) : null,
      duracionMin: numero(f.duracion_s) == null ? null : Math.round(Number(f.duracion_s) / 60),
      emergenciaAbierta: Number(f.emergencia) === 1,
    },
    ahora,
  );
  return {
    id: String(f.id),
    /** La clave de la paginación («fecha~fila»): la usa el monitoreo para seguir donde se dejó. */
    clave: cursorDe(f),
    tipo: 'viaje' as const,
    servicio: (servicioDeOperacion(texto(f.servicio_id)) ?? 'auto') as ServicioConcreto,
    estado,
    creadoEn: String(f.creado_en),
    total: numero(f.total_final_centavos) ?? numero(f.total) ?? 0,
    moneda: String(f.moneda ?? 'USD'),
    origen: String(f.origen_direccion ?? ''),
    destino: String(f.destino_direccion ?? ''),
    pasajero:
      f.pasajero == null || Number(f.pasajero_activo ?? 1) === 0 ? null : String(f.pasajero),
    conductor: texto(f.conductor),
    conductorCodigo: texto(f.conductor_codigo),
    ciudad: texto(f.ciudad),
    zonaId: texto(f.zona_id),
    zonaHoraria: texto(f.zona_horaria),
    emergencia: Number(f.emergencia) === 1,
    luz: s?.luz ?? ('verde' as const),
    semaforo: s,
    /** C-BUSCADOR-INSTANTANEO: fijo arriba de la primera página al buscar por código (los vivos). */
    fijo: false,
  };
}
export type FilaListaViaje = ReturnType<typeof aFilaViaje>;

/** Los `servicio_id` de los viajes a mirar según la pestaña. */
function serviciosIdDe(s: ServicioMonitoreo | undefined): string[] {
  if (s === 'auto' || s === 'moto' || s === 'envios') {
    const id = servicioIdDeOperacion(s);
    return id ? [id] : [];
  }
  if (s === 'comida' || s === 'tiendas') return [];
  return SERVICIOS_DE_VIAJE.map((x) => servicioIdDeOperacion(x) ?? '').filter(Boolean);
}

/** Ids de los viajes vivos (pocos), cada estado por su índice parcial. */
async function idsViajesVivos(db: D1Database): Promise<Fila[]> {
  const [buscando, activos, pago] = await Promise.all([
    todas(
      db,
      "SELECT o.id, o.rowid AS fila, o.creado_en, o.zona_id, o.servicio_id FROM operaciones o WHERE o.estado_general = 'buscando' AND o.tipo_operacion IN ('viaje_pasajero', 'envio_paquete')",
    ),
    todas(
      db,
      "SELECT o.id, o.rowid AS fila, o.creado_en, o.zona_id, o.servicio_id FROM operaciones o WHERE o.estado_general IN ('asignada', 'en_curso') AND o.conductor_id IS NOT NULL AND +o.tipo_operacion IN ('viaje_pasajero', 'envio_paquete')",
    ),
    Promise.all(
      ['viaje_pasajero', 'envio_paquete'].map((tipo) =>
        todas(
          db,
          `SELECT o.id, o.rowid AS fila, o.creado_en, o.zona_id, o.servicio_id FROM operaciones o
            WHERE o.tipo_operacion = ? AND o.creado_en >= datetime('now', ?) AND +o.estado_general = 'pago_pendiente'`,
          tipo,
          `-${MINUTOS_PAGO_PENDIENTE} minutes`,
        ),
      ),
    ).then((x) => x.flat()),
  ]);
  const vistos = new Set<string>();
  return [...buscando, ...activos, ...pago].filter(
    (f) => !vistos.has(String(f.id)) && vistos.add(String(f.id)),
  );
}

async function detallesViajes(db: D1Database, ids: Fila[], direccion: 'ASC' | 'DESC') {
  const elegidos = ordenarPorClave(ids, direccion).map((f) => String(f.id));
  if (!elegidos.length) return [];
  // D1 acepta como mucho 100 valores por consulta: en tandas.
  const tandas: string[][] = [];
  for (let i = 0; i < elegidos.length; i += TANDA_IDS)
    tandas.push(elegidos.slice(i, i + TANDA_IDS));
  const filas = (
    await Promise.all(
      tandas.map((t) =>
        todas(
          db,
          `SELECT ${COLUMNAS_VIAJE} FROM operaciones o ${UNIONES_VIAJE} WHERE o.id IN (${marcas(t.length)})`,
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

/** De estas filas de viajes, las que entran en el alcance dado en SQL (en tandas, por la llave). */
async function permitidos(db: D1Database, filas: Fila[], alc: string, valores: unknown[]) {
  const ok = new Set<string>();
  for (let i = 0; i < filas.length; i += TANDA_IDS) {
    const t = filas.slice(i, i + TANDA_IDS).map((f) => String(f.id));
    for (const f of await todas(
      db,
      `SELECT o.id FROM operaciones o WHERE o.id IN (${marcas(t.length)})${alc}`,
      ...t,
      ...valores,
    ))
      ok.add(String(f.id));
  }
  return filas.filter((f) => ok.has(String(f.id)));
}

/** Los tipos de operación que son viajes y envíos (lo demás, como las rutas de Flex, no entra). */
const TIPOS_VIAJE = ['viaje_pasajero', 'envio_paquete'] as const;

/**
 * C-BUSCADOR-INSTANTANEO: viajes cuyo código empieza por lo escrito (desde UNA letra), o el id
 * exacto. Misma regla que `pedidosPorCodigo`: cuántos hay (tope), los vivos primero (de los índices
 * parciales de vivos, pocos) con los que están en problemas arriba, y los cerrados del más reciente
 * al más viejo: por la llave primaria si el rango es chico; si no, hacia atrás por
 * `operaciones_viaje_creado` con el comienzo del código como filtro.
 */
export async function viajesPorCodigo(
  db: D1Database,
  b: { codigo?: string; id?: string },
  o: {
    servicios: string[];
    dentroViaje?: (f: Fila) => boolean;
    /** El alcance como SQL (el buscador de arriba); el monitoreo usa `dentroViaje`. */
    alcanceSql?: { sql: string; valores: unknown[] };
    limite: number;
    cursor: string;
  },
): Promise<{
  vivos: FilaListaViaje[];
  cerrados: FilaListaViaje[];
  siguiente: string | null;
  total: number;
  totalMas: boolean;
}> {
  const vacio = { vivos: [], cerrados: [], siguiente: null, total: 0, totalMas: false };
  if (!o.servicios.length) return vacio;
  const alc = o.alcanceSql?.sql ?? '';
  const alcValores = o.alcanceSql?.valores ?? [];
  const tipos = `+o.tipo_operacion IN ('viaje_pasajero', 'envio_paquete') AND +o.servicio_id IN (${marcas(o.servicios.length)})`;
  const dentro = (f: Fila) =>
    o.servicios.includes(String(f.servicio_id)) && (!o.dentroViaje || o.dentroViaje(f));
  const cols = 'o.id, o.rowid AS fila, o.creado_en, o.zona_id, o.servicio_id';

  const exacto =
    b.id && !o.cursor
      ? (
          await todas(
            db,
            `SELECT ${cols} FROM operaciones o WHERE o.id = ? AND ${tipos}${alc}`,
            b.id,
            ...o.servicios,
            ...alcValores,
          )
        ).filter(dentro)
      : [];
  if (!b.codigo) {
    const det = await detallesViajes(db, exacto, 'DESC');
    return {
      ...vacio,
      vivos: det.map((f) => ({ ...aFilaViaje(f), fijo: true })),
      total: det.length,
    };
  }
  const [desde, hasta] = rangoPrefijo(b.codigo);
  const enRango = (f: Fila) => String(f.id) >= desde && String(f.id) < hasta;
  // El rango por la llave primaria con tope (lo normal desde 3 letras: pocos, y basta esta lectura)
  // y los vivos de los índices parciales (pocos).
  const [rango, todosVivos] = await Promise.all([
    todas(
      db,
      `SELECT ${cols} FROM operaciones o WHERE o.id >= ? AND o.id < ? AND ${tipos}${alc} ORDER BY o.id LIMIT ?`,
      desde,
      hasta,
      ...o.servicios,
      ...alcValores,
      UMBRAL_RANGO_CODIGO + 1,
    ),
    idsViajesVivos(db),
  ]);
  const idsVivos = new Set(todosVivos.map((f) => String(f.id)));
  const candidatos = o.cursor ? [] : todosVivos.filter((f) => enRango(f) && dentro(f));
  // C-PERMISOS-FINOS: los vivos salen de los índices de vivos, sin el alcance; si quien busca tiene
  // un alcance en SQL (el buscador de arriba), se comprueba aquí, por la llave, antes de mostrarlos.
  const vivosIds =
    alc && candidatos.length ? await permitidos(db, candidatos, alc, alcValores) : candidatos;
  let cuenta: { total: number; totalMas: boolean };
  let cerrados: { filas: Fila[]; siguiente: string | null };
  if (rango.length <= UMBRAL_RANGO_CODIGO) {
    const visibles = rango.filter(dentro);
    cuenta = { total: visibles.length, totalMas: false };
    cerrados = paginaEnMemoria(
      visibles.filter((f) => !idsVivos.has(String(f.id))),
      o.cursor,
      o.limite,
    );
  } else {
    // Muchos (una o dos letras): cuántos con tope, y hacia atrás por la fecha de cada tipo con el
    // código como filtro.
    const [tras, trasValores] = despuesDe(o.cursor, 'recientes', 'o');
    const [c, partes] = await Promise.all([
      contarPorCodigo(
        db,
        `FROM operaciones o WHERE o.id > ? AND o.id < ? AND ${tipos}${alc}`,
        [String(rango.at(-1)?.id ?? desde), hasta, ...o.servicios, ...alcValores],
        rango.length,
      ),
      Promise.all(
        TIPOS_VIAJE.map((tipo) =>
          todas(
            db,
            `SELECT ${cols} FROM operaciones o
              WHERE o.tipo_operacion = ? AND +o.id >= ? AND +o.id < ? AND +o.servicio_id IN (${marcas(o.servicios.length)})${tras}${alc}
              ORDER BY o.creado_en DESC, o.rowid DESC LIMIT ?`,
            tipo,
            desde,
            hasta,
            ...o.servicios,
            ...trasValores,
            ...alcValores,
            o.limite + 1,
          ),
        ),
      ),
    ]);
    cuenta = c;
    const juntos = ordenarPorClave(partes.flat(), 'DESC').slice(0, o.limite + 1);
    const pagina = juntos.slice(0, o.limite);
    const ultima = pagina.at(-1);
    cerrados = {
      filas: pagina.filter((f) => dentro(f) && !idsVivos.has(String(f.id))),
      siguiente: juntos.length > o.limite && ultima ? cursorDe(ultima) : null,
    };
  }
  const yaEsta = new Set(exacto.map((f) => String(f.id)));
  const [detExacto, detVivos, detCerrados] = await Promise.all([
    detallesViajes(db, exacto, 'DESC'),
    detallesViajes(
      db,
      vivosIds.filter((f) => !yaEsta.has(String(f.id))),
      'DESC',
    ),
    detallesViajes(
      db,
      cerrados.filas.filter((f) => !yaEsta.has(String(f.id))),
      'DESC',
    ),
  ]);
  const vivos = [
    ...detExacto.map((f) => ({ ...aFilaViaje(f), fijo: true })),
    ...detVivos
      .map((f) => ({ ...aFilaViaje(f), fijo: true }))
      .sort(
        (x, y) =>
          (ORDEN_LUZ.get(x.luz) ?? 2) - (ORDEN_LUZ.get(y.luz) ?? 2) || -compararElementos(x, y),
      ),
  ];
  return {
    vivos,
    cerrados: detCerrados.map((f) => aFilaViaje(f)),
    siguiente: cerrados.siguiente,
    ...cuenta,
  };
}

/** Una página de viajes del monitoreo (vivos en memoria; cerrados y todos por el índice de fecha). */
export async function listarViajesMonitoreo(
  db: D1Database,
  p: ParametrosLista,
): Promise<{
  viajes: FilaListaViaje[];
  siguiente: string | null;
  porCodigo: boolean;
  total?: number;
  totalMas?: boolean;
}> {
  const servicios = serviciosIdDe(p.servicio);
  if (!servicios.length) return { viajes: [], siguiente: null, porCodigo: false };
  const direccion = p.orden === 'recientes' ? 'DESC' : 'ASC';
  const b = interpretarBusqueda(p.q);

  // Por código o id: todos, de cualquier estado y ciudad, desde la PRIMERA letra
  // (C-BUSCADOR-INSTANTANEO): vivos primero, después los cerrados con «Cargar más».
  if (b.codigo || b.id) {
    const r = await viajesPorCodigo(db, b, {
      servicios,
      dentroViaje: p.dentroViaje,
      limite: p.limite ?? POR_PAGINA,
      cursor: p.despues,
    });
    return {
      viajes: [...r.vivos, ...r.cerrados],
      siguiente: r.siguiente,
      porCodigo: true,
      total: r.total,
      totalMas: r.totalMas,
    };
  }
  // Lo escrito que no es un código (nombre, teléfono…) se busca en pedidos; los viajes no salen.
  if (!b.vacia) return { viajes: [], siguiente: null, porCodigo: false };

  const enFiltro = (f: Fila) =>
    servicios.includes(String(f.servicio_id)) &&
    (!p.zona || f.zona_id === p.zona) &&
    // C-PERMISOS-FINOS: solo los viajes de la zona de trabajo y servicios de quien mira.
    (!p.dentroViaje || p.dentroViaje(f));

  if (p.estado === 'vivos') {
    // Pocos: se juntan todos, se ordenan y se pagina en memoria con la misma clave.
    const vivos = ordenarPorClave((await idsViajesVivos(db)).filter(enFiltro), direccion);
    const signo = direccion === 'DESC' ? -1 : 1;
    const desde = p.despues ? vivos.findIndex((f) => signo * comparaClave(f, p.despues) > 0) : 0;
    const resto = desde < 0 ? [] : vivos.slice(desde);
    const pagina = resto.slice(0, POR_PAGINA);
    const ultima = pagina.at(-1);
    return {
      viajes: (await detallesViajes(db, pagina, direccion)).map((f) => aFilaViaje(f)),
      siguiente: resto.length > POR_PAGINA && ultima ? cursorDe(ultima) : null,
      porCodigo: false,
    };
  }
  const estados = p.estado === 'cerrados' ? ESTADOS_GENERALES.cerrados : null;
  const filtrar =
    Boolean(p.zona) || servicios.length < 3 || Boolean(estados) || Boolean(p.dentroViaje);
  const pagina = await paginaPorClave(
    async (cursor, limite) => {
      const [tras, trasValores] = despuesDe(cursor, p.orden, 'o');
      const partes = await Promise.all(
        ['viaje_pasajero', 'envio_paquete'].map((tipo) =>
          todas(
            db,
            `SELECT o.id, o.rowid AS fila, o.creado_en, o.zona_id, o.servicio_id, o.estado_general FROM operaciones o
              WHERE o.tipo_operacion = ?${tras}
              ORDER BY o.creado_en ${direccion}, o.rowid ${direccion} LIMIT ?`,
            tipo,
            ...trasValores,
            limite,
          ),
        ),
      );
      return ordenarPorClave(partes.flat(), direccion).slice(0, limite);
    },
    p.despues,
    filtrar
      ? (f) =>
          enFiltro(f) &&
          (!estados || (estados as readonly string[]).includes(String(f.estado_general)))
      : null,
  );
  return {
    viajes: (await detallesViajes(db, pagina.filas, direccion)).map((f) => aFilaViaje(f)),
    siguiente: pagina.siguiente,
    porCodigo: false,
  };
}

export type Contador = { vivos: number; problemas: number };
/** Cuántos pedidos vivos se miran como mucho por estado para los contadores (después, «50+»). */
const TOPE_CONTADOR = 50;

/**
 * Vivos y en problemas por servicio (de la ciudad elegida): los números de cada pestaña. Lecturas
 * acotadas: como mucho 51 pedidos por estado vivo (por su índice) y los viajes vivos (pocos, por sus
 * índices parciales). Si un estado tiene más, la respuesta dice `limitado` y la pantalla escribe
 * «50+» en vez de inventar un número. Es su propia ruta (la pantalla la pide cada 30 segundos).
 */
export async function contadoresMonitoreo(
  db: D1Database,
  zona: string,
  alcance: Pick<ParametrosLista, 'alcance' | 'dentroViaje'> = {},
) {
  const alc = alcance.alcance ?? { sql: '', valores: [] };
  const [porEstado, viajesIds, envio] = await Promise.all([
    Promise.all(
      ESTADOS_PEDIDO_VIVOS.map((estado) =>
        todas(
          db,
          `SELECT p.estado, p.creado_en, p.pagado_en, p.aceptado_en, p.listo_en, p.recogido_en, p.tiempo_prep_min,
              (SELECT r.tipo_comercio FROM restaurantes r WHERE r.id = p.restaurante_id) AS tipo_comercio
             FROM pedidos p WHERE ${zona ? 'p.zona_id = ? AND ' : ''}p.estado = ?${alc.sql} LIMIT ?`,
          ...(zona ? [zona] : []),
          estado,
          ...alc.valores,
          TOPE_CONTADOR + 1,
        ),
      ),
    ),
    idsViajesVivos(db),
    db
      .prepare("SELECT 1 AS hay FROM operaciones WHERE tipo_operacion = 'envio_paquete' LIMIT 1")
      .first<{ hay: number }>(),
  ]);
  const limitado = porEstado.some((filas) => filas.length > TOPE_CONTADOR);
  const pedidos = porEstado.flatMap((filas) => filas.slice(0, TOPE_CONTADOR));
  const cuentas = new Map<string, Contador>(
    ['todos', 'comida', 'tiendas', 'auto', 'moto', 'envios'].map((k) => [
      k,
      { vivos: 0, problemas: 0 },
    ]),
  );
  const sumar = (servicio: string, rojo: boolean) => {
    for (const k of ['todos', servicio]) {
      const c = cuentas.get(k);
      if (!c) continue;
      c.vivos++;
      if (rojo) c.problemas++;
    }
  };
  for (const f of pedidos) {
    const s = semaforoPedido({
      estado: String(f.estado),
      creadoEn: String(f.creado_en),
      pagadoEn: texto(f.pagado_en),
      aceptadoEn: texto(f.aceptado_en),
      listoEn: texto(f.listo_en),
      recogidoEn: texto(f.recogido_en),
      tiempoPrepMin: numero(f.tiempo_prep_min),
    });
    sumar(servicioDePedido(texto(f.tipo_comercio)), s?.luz === 'rojo');
  }
  const viajes = (
    await detallesViajes(
      db,
      viajesIds.filter((f) => (!zona || f.zona_id === zona) && (alcance.dentroViaje?.(f) ?? true)),
      'ASC',
    )
  ).map((f) => aFilaViaje(f));
  for (const v of viajes) sumar(v.servicio, v.luz === 'rojo');
  return {
    contadores: Object.fromEntries(cuentas) as Record<ServicioMonitoreo, Contador>,
    limitado,
    hayEnvios: Boolean(envio?.hay) || (cuentas.get('envios')?.vivos ?? 0) > 0,
  };
}

/** Compara la clave (fecha, fila) de una fila con un cursor «fecha~fila». */
function comparaClave(f: Fila, cursor: string): number {
  const [fecha = '', fila = '0'] = cursor.split('~');
  return String(f.creado_en).localeCompare(fecha) || Number(f.fila) - Number(fila);
}

type ConClave = { creadoEn: string; clave: string };
const compararElementos = (a: ConClave, b: ConClave) =>
  a.creadoEn.localeCompare(b.creadoEn) ||
  Number(a.clave.split('~')[1] ?? 0) - Number(b.clave.split('~')[1] ?? 0);

/**
 * La lista del monitoreo: pedidos (comida, tiendas) y viajes (auto, moto, envíos) juntos, en el
 * orden pedido. Con «Todos», cada fuente pagina por su clave y el cursor lleva las dos
 * («p:<fecha>~<fila>|v:<fecha>~<fila>»): la página siguiente sigue cada una donde se dejó, y una
 * fila de una fuente nunca se salta aunque la otra tenga más páginas.
 */
export async function listarMonitoreo(db: D1Database, p: ParametrosLista) {
  const servicio = p.servicio ?? 'todos';
  const conPedidos = servicio === 'todos' || servicio === 'comida' || servicio === 'tiendas';
  const conViajes = serviciosIdDe(servicio).length > 0;
  const [cursorP, cursorV] = leerCursorDoble(p.despues);
  const [pedidos, viajes] = await Promise.all([
    conPedidos && cursorP !== 'fin'
      ? listarPedidosAdmin(db, { ...p, despues: cursorP })
      : Promise.resolve(null),
    conViajes && cursorV !== 'fin'
      ? listarViajesMonitoreo(db, { ...p, despues: cursorV })
      : Promise.resolve(null),
  ]);
  const porCodigo = Boolean(pedidos?.porCodigo || viajes?.porCodigo);
  // Por código, los cerrados van siempre del más reciente al más viejo (C-BUSCADOR-INSTANTANEO).
  const signo = porCodigo || p.orden === 'recientes' ? -1 : 1;
  const enOrden = <T extends ConClave>(xs: T[]) =>
    [...xs].sort((a, b) => signo * compararElementos(a, b));
  const todosP = pedidos?.pedidos ?? [];
  const todosV = viajes?.viajes ?? [];
  type Elemento = (typeof todosP)[number] | (typeof todosV)[number];
  // Por código: los vivos (y el id exacto) fijos arriba, en problemas primero; fuera de la paginación.
  const fijos: Elemento[] = [...todosP.filter((x) => x.fijo), ...todosV.filter((x) => x.fijo)].sort(
    (a, b) => (ORDEN_LUZ.get(a.luz) ?? 2) - (ORDEN_LUZ.get(b.luz) ?? 2) || -compararElementos(a, b),
  );
  const listaP = enOrden(todosP.filter((x) => !x.fijo));
  const listaV = enOrden(todosV.filter((x) => !x.fijo));
  let juntos: Elemento[] = enOrden<Elemento>([...listaP, ...listaV]);
  // Si una fuente tiene más páginas, solo se muestra hasta su último elemento: lo que venga
  // después en la otra fuente podría ir intercalado con la página siguiente de la primera.
  const topes = [
    pedidos?.siguiente ? listaP.at(-1) : undefined,
    viajes?.siguiente ? listaV.at(-1) : undefined,
  ].filter((x): x is Elemento => Boolean(x));
  const tope = topes.sort((a, b) => signo * compararElementos(a, b))[0];
  if (tope) juntos = juntos.filter((x) => signo * compararElementos(x, tope) <= 0);
  juntos = juntos.slice(0, p.limite ?? POR_PAGINA);
  const siguienteP = siguienteDe(cursorP, pedidos?.siguiente ?? null, listaP, juntos, conPedidos);
  const siguienteV = siguienteDe(cursorV, viajes?.siguiente ?? null, listaV, juntos, conViajes);
  // C-MANAGER-1: entre los vivos, los que están en problemas primero.
  if (p.estado === 'vivos' && !porCodigo)
    juntos = [...juntos].sort((a, b) => (ORDEN_LUZ.get(a.luz) ?? 2) - (ORDEN_LUZ.get(b.luz) ?? 2));
  const siguiente =
    siguienteP === 'fin' && siguienteV === 'fin' ? null : `p:${siguienteP}|v:${siguienteV}`;
  return {
    pedidos: [...fijos, ...juntos],
    siguiente,
    porCodigo,
    masCoincidencias: pedidos?.masCoincidencias ?? false,
    /** C-BUSCADOR-INSTANTANEO: cuántos empiezan así entre pedidos y viajes (null si no es por código). */
    total: porCodigo ? (pedidos?.total ?? 0) + (viajes?.total ?? 0) : null,
    totalMas: Boolean(pedidos?.totalMas || viajes?.totalMas),
    encontrado: pedidos?.encontrado ?? null,
    avisoMonto: pedidos?.avisoMonto ?? false,
  };
}

/** Dónde sigue una fuente en la página siguiente («fin» si ya no tiene más). */
function siguienteDe(
  anterior: string,
  siguienteFuente: string | null,
  lista: ConClave[],
  mostrados: ConClave[],
  activa: boolean,
): string {
  if (!activa || anterior === 'fin') return 'fin';
  const claves = new Set(mostrados.map((x) => x.clave));
  const vistos = lista.filter((x) => claves.has(x.clave)).length;
  // Se mostró todo lo que trajo: sigue donde la fuente dijo (o se acabó).
  if (vistos >= lista.length) return siguienteFuente ?? 'fin';
  // Se cortó en medio: sigue después del último que sí se mostró (o donde estaba, si ninguno).
  return vistos > 0 ? (lista[vistos - 1]?.clave ?? anterior) : anterior;
}

export function leerCursorDoble(c: string): [string, string] {
  if (!c) return ['', ''];
  const m = /^p:([^|]*)\|v:(.*)$/.exec(c);
  if (!m) return [c, ''];
  return [m[1] ?? '', m[2] ?? ''];
}
