/**
 * C-LECTURAS-POR-PETICION (13 nov 2026, regla global «la nube no se come el dinero»). Todos los
 * países. Solo para pruebas.
 *
 * La base de pruebas (SQLite en memoria) no informa cuántas filas lee una consulta, como sí lo hace
 * D1. Esto lo estima de la forma que más pesa en la factura: cada consulta que corre durante la
 * medición se mira con EXPLAIN QUERY PLAN, y cada recorrido COMPLETO de una tabla («SCAN tabla»)
 * suma todas las filas de esa tabla. Las búsquedas por índice («SEARCH») cuentan una fila: leen
 * las que piden, que es lo correcto. Con una base con volumen (`sembrarVolumen`), una consulta
 * sin índice salta a miles de filas y la prueba se pone en rojo.
 */

type Sentencia = {
  sql: string;
  valores: unknown[];
  real: D1PreparedStatement;
};

export type Lectura = { sql: string; filas: number; escaneos: string[] };

/** Las tablas grandes de un sitio con uso: miles de filas (como el sitio de pruebas). */
export const VOLUMEN = {
  clientes: 4000,
  repartidores: 1000,
  restaurantes: 600,
  platosPorRestaurante: 5,
  pedidos: 6000,
};

/**
 * Siembra la base con el volumen de un sitio con uso. Va ANTES de la primera petición (antes de
 * que la migración ponga los disparadores de los pedidos), directo en SQL.
 */
export async function sembrarVolumen(db: D1Database): Promise<void> {
  const v = VOLUMEN;
  const usuarios = v.clientes + v.repartidores + v.restaurantes;
  const serie = (n: number) =>
    `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${n})`;
  const sql = [
    `${serie(usuarios)} INSERT INTO usuarios (id, correo, nombre, telefono, rol, clave_hash, creado_en)
       SELECT 'vol-u-' || i, 'vol' || i || '@ejemplo.com', 'Persona ' || i, '+1305555' || printf('%04d', i),
         CASE WHEN i <= ${v.clientes} THEN 'cliente' WHEN i <= ${v.clientes + v.repartidores} THEN 'repartidor' ELSE 'restaurante' END,
         'x', datetime('now', '-' || (i % 60) || ' days') FROM n`,
    `${serie(usuarios)} INSERT INTO sesiones (id, usuario_id, expira_en)
       SELECT 'vol-s-' || i, 'vol-u-' || i, datetime('now', '+30 days') FROM n`,
    `${serie(v.repartidores)} INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id)
       SELECT 'vol-u-' || (${v.clientes} + i), i % 3 = 0, 25.7 + (i % 50) / 1000.0, -80.2 - (i % 40) / 1000.0,
         datetime('now', '-' || (i % 120) || ' minutes'), 'US-FL-MIAMI' FROM n`,
    `${serie(v.restaurantes)} INSERT INTO restaurantes (id, dueno_id, nombre, lat, lng, estado, abierto, zona_id)
       SELECT 'vol-r-' || i, 'vol-u-' || (${v.clientes + v.repartidores} + i), 'Restaurante ' || i,
         25.7 + (i % 60) / 1000.0, -80.2 - (i % 30) / 1000.0, 'aprobado', i % 2, 'US-FL-MIAMI' FROM n`,
    `${serie(v.restaurantes * v.platosPorRestaurante)} INSERT INTO platos (id, restaurante_id, nombre_es, precio_centavos)
       SELECT 'vol-pl-' || i, 'vol-r-' || (1 + i % ${v.restaurantes}), 'Plato ' || i, 1000 + i % 900 FROM n`,
    `${serie(v.pedidos)} INSERT INTO pedidos (id, cliente_id, restaurante_id, repartidor_id, estado, lineas_json,
         subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor,
         complemento, ganancia, plan, direccion, lat, lng, creado_en, pagado_en, entregado_en, cancelado_en)
       SELECT 'vol-p-' || i, 'vol-u-' || (1 + i % ${v.clientes}), 'vol-r-' || (1 + i % ${v.restaurantes}),
         CASE WHEN i % 10 < 8 THEN 'vol-u-' || (${v.clientes} + 1 + i % ${v.repartidores}) END,
         CASE WHEN i % 10 < 7 THEN 'entregado' WHEN i % 10 = 7 THEN 'en_camino' ELSE 'cancelado' END,
         '[]', 2000, 300, 200, 0, 300, 2800, 400, 1600, 600, 0, 200, 'basico', 'Calle ' || i, 25.78, -80.2,
         datetime('now', '-' || (i % 30) || ' days', '-2 hours'), datetime('now', '-' || (i % 30) || ' days', '-2 hours'),
         CASE WHEN i % 10 < 7 THEN datetime('now', '-' || (i % 30) || ' days', '-1 hours') END,
         CASE WHEN i % 10 >= 8 THEN datetime('now', '-' || (i % 30) || ' days', '-1 hours') END FROM n`,
    `INSERT INTO cobros (pedido_id, autorizado_en, capturado_en, capturado)
       SELECT id, pagado_en, entregado_en, total FROM pedidos WHERE estado = 'entregado'`,
    `INSERT INTO historial_estados (pedido_id, estado, creado_en)
       SELECT id, 'pagado', pagado_en FROM pedidos UNION ALL SELECT id, estado, COALESCE(entregado_en, cancelado_en, pagado_en) FROM pedidos`,
    `INSERT INTO bitacora_pedidos (pedido_id, evento, creado_en)
       SELECT id, 'creado', creado_en FROM pedidos UNION ALL SELECT id, 'pagado', pagado_en FROM pedidos`,
    `INSERT INTO ofertas (pedido_id, repartidor_id, estado, creada_en)
       SELECT id, repartidor_id, 'aceptada', pagado_en FROM pedidos WHERE repartidor_id IS NOT NULL
       UNION ALL SELECT id, 'vol-u-' || (${v.clientes} + 1 + (CAST(substr(id, 7) AS INTEGER) + 7) % ${v.repartidores}), 'vencida', pagado_en
         FROM pedidos WHERE repartidor_id IS NOT NULL`,
    `INSERT INTO movimientos (id, usuario_id, pedido_id, monto, concepto, creado_en)
       SELECT 'vol-mv-' || p.id, r.dueno_id, p.id, p.pago_restaurante, 'venta', p.entregado_en
         FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.estado = 'entregado'
       UNION ALL SELECT 'vol-me-' || id, repartidor_id, id, pago_repartidor, 'entrega', entregado_en FROM pedidos WHERE estado = 'entregado'
       UNION ALL SELECT 'vol-mp-' || id, repartidor_id, id, propina, 'propina', entregado_en FROM pedidos WHERE estado = 'entregado'`,
    `${serie(20000)} INSERT INTO ubicaciones_recientes (usuario_id, lat, lng, precision_m, creado_en)
       SELECT 'vol-u-' || (${v.clientes} + 1 + i % ${v.repartidores}), 25.7, -80.2, 10, datetime('now', '-' || (i % 600) || ' minutes') FROM n`,
  ];
  for (const s of sql) await db.prepare(s).run();
}

/** Los nombres de tabla de una consulta, con sus apodos («pedidos p» → p = pedidos). */
function apodos(sql: string): Map<string, string> {
  const m = new Map<string, string>();
  const palabras = sql.toLowerCase().split(/[^a-z0-9_]+/);
  const antes = new Set(['from', 'join', 'update', 'into']);
  const reservada = new Set(
    'where on set join left inner group order limit values select using natural cross default as'.split(
      ' ',
    ),
  );
  palabras.forEach((p, i) => {
    if (!antes.has(p)) return;
    const tabla = palabras[i + 1];
    if (!tabla || reservada.has(tabla)) return;
    m.set(tabla, tabla);
    const apodo = palabras[i + 2] === 'as' ? palabras[i + 3] : palabras[i + 2];
    if (apodo && !reservada.has(apodo)) m.set(apodo, tabla);
  });
  return m;
}

/** Lo que va dentro del paréntesis que abre en `desde` (respetando los paréntesis de adentro). */
function dentroDe(texto: string, desde: number): string | undefined {
  if (desde < 0) return undefined;
  let nivel = 0;
  for (let i = desde; i < texto.length; i++) {
    if (texto[i] === '(') nivel++;
    else if (texto[i] === ')' && --nivel === 0) return texto.slice(desde + 1, i);
  }
  return undefined;
}

/**
 * Envuelve la base: mientras `medir` corre, cada consulta se anota con su estimación de filas
 * leídas. Fuera de `medir` no hace nada (la preparación de la prueba no cuenta).
 */
export function medidorDeLecturas(db: D1Database) {
  let anotar: Lectura[] | null = null;
  const tamanos = new Map<string, number>();
  const tamano = async (tabla: string) => {
    if (!tamanos.has(tabla)) {
      const f = await db
        .prepare(`SELECT COUNT(*) AS n FROM "${tabla.replace(/"/g, '')}"`)
        .first<{ n: number }>()
        .catch(() => null);
      tamanos.set(tabla, Number(f?.n ?? 0));
    }
    return tamanos.get(tabla)!;
  };
  /**
   * Filas que lee una búsqueda por índice: las filas de la tabla repartidas entre los valores
   * distintos de las columnas fijadas con «=» (las primeras del índice). Una condición de rango
   * («>», «<») lee una cuarta parte de eso, como lo supone el propio SQLite sin estadísticas.
   */
  const promedios = new Map<string, number>();
  const porBusqueda = async (tabla: string, indice: string, condicion: string) => {
    // SQLite escribe «<expr>» por la columna de un índice de expresión: no es un rango.
    const terminos = condicion.replace(/<expr>/g, 'expr').split(' AND ');
    const iguales = terminos.filter((t) => /=\?$/.test(t.trim()) && !/[<>]/.test(t)).length;
    const rango = terminos.some((t) => /[<>]/.test(t));
    const clave = `${indice}:${iguales}`;
    if (!promedios.has(clave)) promedios.set(clave, await promedioDe(tabla, indice, iguales));
    const n = promedios.get(clave)!;
    return Math.max(1, rango ? Math.ceil(n / 4) : n);
  };
  /**
   * Cuántas filas trae, en promedio, fijar las primeras `iguales` claves del índice. Cuenta solo
   * las filas que el índice guarda (un índice parcial guarda las de su WHERE) y deja fuera los
   * NULL: «= ?» nunca los encuentra.
   */
  const promedioDe = async (tabla: string, indice: string, iguales: number) => {
    const def = await db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?")
      .bind(indice)
      .first<{ sql: string | null }>();
    const sql = def?.sql ?? '';
    const parcial = /\)\s+WHERE\s+([\s\S]+)$/i.exec(sql)?.[1];
    const nombres = (
      await db
        .prepare('SELECT name FROM pragma_index_info(?) ORDER BY seqno')
        .bind(indice)
        .all<{ name: string | null }>()
    ).results.map((c) => c.name);
    // Un índice de una sola expresión (pragma_index_info no la nombra): se toma del CREATE INDEX.
    const expresion = dentroDe(sql, sql.indexOf('(', sql.toUpperCase().indexOf(' ON ')));
    const claves = nombres
      .slice(0, iguales)
      .map((n) => (n ? `"${n}"` : nombres.length === 1 ? expresion : null));
    if (claves.some((c) => !c)) return tamano(tabla);
    const filtro = [parcial, ...claves.map((c) => `(${c}) IS NOT NULL`)].filter(Boolean);
    const donde = filtro.length ? ` WHERE ${filtro.join(' AND ')}` : '';
    const total = await db
      .prepare(`SELECT COUNT(*) AS n FROM "${tabla}"${donde}`)
      .first<{ n: number }>()
      .catch(() => null);
    if (!claves.length) return Number(total?.n ?? 0);
    const distintos = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM (SELECT DISTINCT ${claves.join(', ')} FROM "${tabla}"${donde})`,
      )
      .first<{ n: number }>()
      .catch(() => null);
    return Math.ceil(Number(total?.n ?? 0) / Math.max(1, Number(distintos?.n ?? 1)));
  };
  const estimar = async (s: Sentencia) => {
    if (!anotar || !/^\s*(SELECT|WITH|UPDATE|DELETE|INSERT)/i.test(s.sql)) return;
    const lista = anotar;
    const plan = await db
      .prepare(`EXPLAIN QUERY PLAN ${s.sql}`)
      .bind(...s.valores)
      .all<{ detail: string }>()
      .catch(() => ({ results: [] as { detail: string }[] }));
    const nombres = apodos(s.sql);
    let filas = 0;
    const escaneos: string[] = [];
    for (const { detail } of plan.results) {
      const m = /^SCAN (\w+)/.exec(detail);
      if (!m) {
        if (!detail.startsWith('SEARCH ')) continue;
        const indice = /INDEX (\w+)/.exec(detail)?.[1];
        const automatico = detail.includes(' AUTOMATIC ');
        if (!indice && !automatico) {
          filas += 1; // por la clave primaria: una fila
          continue;
        }
        const condicion = dentroDe(detail, detail.indexOf('(')) ?? '';
        const tabla = nombres.get((detail.split(' ')[1] ?? '').toLowerCase());
        if (!tabla) continue;
        const n = automatico
          ? await tamano(tabla) // índice automático: SQLite recorre la tabla entera para armarlo
          : await porBusqueda(tabla, indice ?? '', condicion);
        filas += n;
        if (n > 50) escaneos.push(`${tabla} por ${indice ?? 'índice automático'} (${n})`);
        continue;
      }
      const tabla = nombres.get(m[1]!.toLowerCase());
      if (!tabla) continue; // una subconsulta o una tabla temporal
      const n = await tamano(tabla);
      filas += n;
      escaneos.push(`${tabla} (${n})`);
    }
    lista.push({ sql: s.sql.replace(/\s+/g, ' ').slice(0, 160), filas, escaneos });
  };

  const envolver = (sql: string, real: D1PreparedStatement, valores: unknown[] = []) => {
    const s: Sentencia = { sql, valores, real };
    const o = {
      __s: s,
      bind: (...v: unknown[]) => envolver(sql, real.bind(...v), v),
      first: async (c?: string) => {
        await estimar(s);
        return c ? real.first(c) : real.first();
      },
      all: async () => {
        await estimar(s);
        return real.all();
      },
      run: async () => {
        await estimar(s);
        return real.run();
      },
      raw: async () => {
        await estimar(s);
        return real.raw();
      },
    };
    return o as unknown as D1PreparedStatement;
  };

  const envuelta = {
    prepare: (sql: string) => envolver(sql, db.prepare(sql)),
    batch: async (lista: D1PreparedStatement[]) => {
      const reales = lista.map((x) => (x as unknown as { __s?: Sentencia }).__s);
      for (const s of reales) if (s) await estimar(s);
      return db.batch(reales.map((s, i) => s?.real ?? lista[i]!));
    },
    exec: (sql: string) => db.exec(sql),
    dump: () => db.dump(),
    withSession: () => envuelta,
  } as unknown as D1Database;

  return {
    db: envuelta,
    /** Corre `fn` y devuelve las consultas que hizo, con sus filas estimadas. */
    async medir<T>(
      fn: () => Promise<T>,
    ): Promise<{ resultado: T; total: number; lecturas: Lectura[] }> {
      const lista: Lectura[] = [];
      anotar = lista;
      try {
        const resultado = await fn();
        return { resultado, total: lista.reduce((a, x) => a + x.filas, 0), lecturas: lista };
      } finally {
        anotar = null;
      }
    },
  };
}
