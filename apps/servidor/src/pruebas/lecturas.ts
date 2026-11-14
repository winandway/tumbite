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
    // El libro del saldo prepago y las recargas (lo que lee el canario del dinero).
    `${serie(6000)} INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia, creado_en)
       SELECT 'vol-l-' || i, 'vol-u-' || (${v.clientes} + 1 + i % ${v.repartidores}),
         CASE WHEN i % 6 < 3 THEN 'prepago' WHEN i % 6 = 3 THEN 'reservado' ELSE 'comisiones' END,
         'US', 'USD', CASE WHEN i % 6 < 3 THEN 1000 WHEN i % 6 = 3 THEN 0 ELSE 100 END,
         CASE WHEN i % 6 < 3 THEN 'recarga' WHEN i % 6 = 3 THEN 'reserva' ELSE 'comision' END,
         'vol-ref-' || i, datetime('now', '-' || (i % 30) || ' days') FROM n`,
    `${serie(1500)} INSERT INTO recargas (id, usuario_id, pais, moneda, monto, canal, estado, creado_en)
       SELECT 'vol-rc-' || i, 'vol-u-' || (${v.clientes} + 1 + i % ${v.repartidores}), 'US', 'USD', 2000,
         CASE WHEN i % 2 = 0 THEN 'stripe' ELSE 'codigo' END, 'acreditada',
         datetime('now', '-' || (i % 30) || ' days') FROM n`,
    `${serie(20000)} INSERT INTO ubicaciones_recientes (usuario_id, lat, lng, precision_m, creado_en)
       SELECT 'vol-u-' || (${v.clientes} + 1 + i % ${v.repartidores}), 25.7, -80.2, 10, datetime('now', '-' || (i % 600) || ' minutes') FROM n`,
  ];
  for (const s of sql) await db.prepare(s).run();
}

/**
 * C-LECTURAS-CATALOGO (14 nov 2026): lo que lee el listado del catálogo en el sitio de pruebas, en
 * su orden de magnitud. Va DESPUÉS de `sembrarVolumen` y antes de la primera petición. `historia`:
 * pedidos viejos de más (el sitio de pruebas tiene cientos por restaurante: los robots), con una
 * calificación por cada tres; turnos de cada restaurante (dos por día, uno cruza la medianoche),
 * cierres que vienen y promociones encendidas.
 */
export async function sembrarCatalogo(db: D1Database, historia = 100_000): Promise<void> {
  const v = VOLUMEN;
  const serie = (n: number) =>
    `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${n})`;
  const sql = [
    `${serie(historia)} INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio,
         servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia,
         plan, direccion, lat, lng, creado_en, pagado_en, entregado_en)
       SELECT 'vol-h-' || i, 'vol-u-' || (1 + i % ${v.clientes}), 'vol-r-' || (1 + i % ${v.restaurantes}), 'entregado',
         '[]', 2000, 300, 200, 0, 300, 2800, 400, 1600, 600, 0, 200, 'basico', 'Calle ' || i, 25.78, -80.2,
         datetime('now', '-' || (40 + i % 300) || ' days'), datetime('now', '-' || (40 + i % 300) || ' days'),
         datetime('now', '-' || (40 + i % 300) || ' days') FROM n`,
    `INSERT INTO calificaciones (pedido_id, estrellas_restaurante, estrellas_repartidor, comentario)
       SELECT id, CASE WHEN CAST(substr(id, 7) AS INTEGER) % 9 = 0 THEN NULL ELSE 1 + CAST(substr(id, 7) AS INTEGER) % 5 END,
         5, '' FROM pedidos WHERE id >= 'vol-h-' AND id < 'vol-h.' AND CAST(substr(id, 7) AS INTEGER) % 3 = 0`,
    `${serie(v.restaurantes)} INSERT INTO horarios_restaurante (restaurante_id, dia, abre, cierra)
       SELECT 'vol-r-' || i, d.dia, '08:00', '15:00' FROM n, (SELECT 0 AS dia UNION ALL SELECT 1 UNION ALL SELECT 2
         UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) d
       UNION ALL SELECT 'vol-r-' || i, d.dia, '18:00', '02:00' FROM n, (SELECT 0 AS dia UNION ALL SELECT 1
         UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) d
         WHERE i % 2 = 0`,
    `${serie(60)} INSERT INTO cierres_restaurante (id, restaurante_id, fecha)
       SELECT 'vol-ci-' || i, 'vol-r-' || (i * 7), date('now', '+' || (i % 5) || ' days') FROM n`,
    `${serie(600)} INSERT INTO cierres_restaurante (id, restaurante_id, fecha)
       SELECT 'vol-cv-' || i, 'vol-r-' || i, date('now', '-' || (10 + i % 200) || ' days') FROM n`,
    `${serie(120)} INSERT INTO promociones_restaurante (id, restaurante_id, tipo, valor, inicia_en, vence_en)
       SELECT 'vol-pr-' || i, 'vol-r-' || (i * 5), 'porcentaje', 10, datetime('now', '-1 day'), datetime('now', '+5 days') FROM n`,
    `INSERT INTO config (clave, valor) VALUES ('promociones_restaurante', '{"encendidas":true}')
       ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
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
   * («>», «<») lee una cuarta parte de eso, y un rango cerrado por los dos lados («> ? AND < ?»)
   * una decimosexta, como lo supone el propio SQLite sin estadísticas (cada lado divide por 4).
   */
  const promedios = new Map<string, number>();
  const porBusqueda = async (tabla: string, indice: string, condicion: string) => {
    // SQLite escribe «<expr>» por la columna de un índice de expresión: no es un rango.
    const terminos = condicion.replace(/<expr>/g, 'expr').split(' AND ');
    const iguales = terminos.filter((t) => /=\?$/.test(t.trim()) && !/[<>]/.test(t)).length;
    const rangos = terminos.filter((t) => /[<>]/.test(t)).length;
    const clave = `${indice}:${iguales}`;
    if (!promedios.has(clave)) promedios.set(clave, await promedioDe(tabla, indice, iguales));
    const n = promedios.get(clave)!;
    return Math.max(1, rangos ? Math.ceil(n / (rangos > 1 ? 16 : 4)) : n);
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
  /**
   * LECT-4 (13 nov 2026): cuántos valores trae la lista de un «col IN (…)» de la consulta. El plan
   * dice «col=?» una sola vez, pero SQLite repite la búsqueda por cada valor de la lista: sin esto,
   * leer los horarios de 100 restaurantes contaba como leer los de uno.
   */
  const valoresDeLista = (
    sql: string,
    columna: string,
    valores: unknown[],
    apodo?: string,
  ): number => {
    let total = 1;
    // Espacios de una sola forma: «col IN (», aunque venga en varias líneas o sin espacio.
    const texto = sql.replace(/\s+/g, ' ').replace(/ IN\(/gi, ' IN (');
    for (const m of texto.matchAll(/(\w+)\.?"?(\w*)"? IN \(/gi)) {
      // «p.id IN (…)»: m[1] = p, m[2] = id; «id IN (…)»: m[1] = id, m[2] vacío.
      const [tablaDe, col] = m[2] ? [m[1], m[2]] : [undefined, m[1]];
      if (col?.toLowerCase() !== columna.toLowerCase()) continue;
      // «p.id IN (…)» es la lista de la tabla p, no la de otra tabla que también tenga «id».
      if (tablaDe && apodo && tablaDe.toLowerCase() !== apodo.toLowerCase()) continue;
      const dentro = dentroDe(texto, (m.index ?? 0) + m[0].length - 1) ?? '';
      if (/json_each\s*\(\s*\?/i.test(dentro)) {
        // La lista va como JSON en un parámetro: se cuenta el arreglo más largo de los valores.
        const largos = valores.map((v) => {
          try {
            const x = typeof v === 'string' ? (JSON.parse(v) as unknown) : null;
            return Array.isArray(x) ? x.length : 0;
          } catch {
            return 0;
          }
        });
        total = Math.max(total, ...largos, 1);
      } else if (!/\bSELECT\b/i.test(dentro)) {
        total = Math.max(total, dentro.split(',').length);
      }
    }
    return total;
  };

  /** Filas que lee un plan (EXPLAIN QUERY PLAN) de una sentencia, sin disparadores. */
  const filasDePlan = async (
    sql: string,
    valores: unknown[],
  ): Promise<{ filas: number; escaneos: string[] }> => {
    const plan = await db
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .bind(...valores)
      .all<{ id: number; parent: number; detail: string }>()
      .catch(() => ({ results: [] as { id: number; parent: number; detail: string }[] }));
    const nombres = apodos(sql);
    let filas = 0;
    const escaneos: string[] = [];
    /**
     * LECT-4: los recorridos hermanos de un mismo nivel son bucles anidados: el segundo corre una
     * vez por cada fila del primero (un JOIN que parte de 600 restaurantes y busca los pedidos de
     * cada uno lee 600 veces lo de uno). Antes cada línea del plan sumaba una sola vez.
     */
    const bucle = new Map<number, number>();
    /**
     * LECT-4: un LIMIT al final de la consulta, sin orden que obligue a juntarlo todo (ningún
     * «USE TEMP B-TREE»), hace que SQLite pare al llegar a esa cantidad: la búsqueda de afuera no
     * lee más que eso (antes, «LIMIT 50» contaba como el índice entero).
     */
    const ordena = plan.results.some((x) => x.detail.includes('TEMP B-TREE'));
    const tope = /\bLIMIT\s+(\d+|\?\d*)\s*$/i.exec(sql.trim())?.[1];
    const limite =
      ordena || !tope
        ? Infinity
        : tope.startsWith('?')
          ? Number(tope.length > 1 ? valores[Number(tope.slice(1)) - 1] : valores.at(-1))
          : Number(tope);
    const raiz = plan.results.find((x) => /^(SCAN|SEARCH) /.test(x.detail))?.parent;
    let primera = true;
    for (const { detail, parent } of plan.results) {
      const veces0 = bucle.get(parent) ?? 1;
      const sumar = (n0: number) => {
        // Solo la búsqueda de afuera, si es por índice (un SCAN con filtro puede leer de más).
        const n =
          primera && parent === raiz && detail.startsWith('SEARCH ') && Number.isFinite(limite)
            ? Math.min(n0, Math.max(1, limite))
            : n0;
        if (parent === raiz) primera = false;
        filas += n * veces0;
        bucle.set(parent, Math.min(1e9, veces0 * Math.max(1, n)));
        return n * veces0;
      };
      const m = /^SCAN (\w+)/.exec(detail);
      if (!m) {
        if (!detail.startsWith('SEARCH ')) continue;
        const indice = /INDEX (\w+)/.exec(detail)?.[1];
        const automatico = detail.includes(' AUTOMATIC ');
        const condicion = dentroDe(detail, detail.indexOf('(')) ?? '';
        // Las columnas fijadas con «=?» que en la consulta van con IN (…): una búsqueda por valor.
        const veces = condicion
          .split(' AND ')
          .map((t) => /^(\w+)=\?$/.exec(t.trim())?.[1])
          .filter((c): c is string => !!c)
          .reduce((x, c) => x * valoresDeLista(sql, c, valores, detail.split(' ')[1]), 1);
        if (!indice && !automatico) {
          sumar(veces); // por la clave primaria: una fila por valor
          continue;
        }
        const tabla = nombres.get((detail.split(' ')[1] ?? '').toLowerCase());
        if (!tabla) continue;
        if (automatico) {
          // Índice automático: SQLite recorre la tabla entera UNA vez para armarlo.
          const n = await tamano(tabla);
          filas += n;
          escaneos.push(`${tabla} por índice automático (${n})`);
          continue;
        }
        const n = sumar((await porBusqueda(tabla, indice ?? '', condicion)) * veces);
        if (n > 50) escaneos.push(`${tabla} por ${indice} (${n})`);
        continue;
      }
      const tabla = nombres.get(m[1]!.toLowerCase());
      if (!tabla) continue; // una subconsulta o una tabla temporal
      const n = sumar(await tamano(tabla));
      escaneos.push(`${tabla} (${n})`);
    }
    return { filas, escaneos };
  };

  /**
   * LECT-4 (13 nov 2026): lo que el plan NO muestra y D1 sí cobra. Por cada fila que cambia una
   * sentencia: (1) los disparadores de esa tabla (su WHEN y su cuerpo, con NEW/OLD como
   * parámetros, y los disparadores y claves foráneas de lo que ellos tocan) y (2) las claves
   * foráneas: al borrar en la tabla madre, SQLite busca en CADA tabla hija que la referencia (sin
   * índice en la columna hija, la recorre entera por cada fila borrada); al insertar o cambiar la
   * columna hija, busca la madre por su clave. Con más de 140 tablas que apuntan a `usuarios`,
   * borrar una cuenta cuesta más de 140 búsquedas: eso es lo que el medidor no veía.
   */
  type Disparador = { evento: string; columnas: string[]; cuando: string; cuerpo: string[] };
  const disparadores = new Map<string, Disparador[]>();
  const disparadoresDe = async (tabla: string): Promise<Disparador[]> => {
    const ya = disparadores.get(tabla);
    if (ya) return ya;
    const { results } = await db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ?")
      .bind(tabla)
      .all<{ sql: string }>();
    const lista = results.map(({ sql }) => {
      // La cabecera: «… AFTER UPDATE OF col1, col2 ON tabla …» (sin expresiones de las lentas).
      const inicio = sql.search(/\bBEGIN\b/i);
      const cabecera = sql.slice(0, inicio).replace(/\s+/g, ' ');
      const evento = / (INSERT|DELETE|UPDATE) /i.exec(cabecera);
      const tras = evento ? cabecera.slice(evento.index + evento[0].length) : '';
      const cab = [
        '',
        evento?.[1] ?? '',
        /^OF /i.test(tras) ? tras.slice(3, tras.search(/ ON /i)) : '',
      ];
      const cuando = /\bWHEN\b([\s\S]*?)\bBEGIN\b/i.exec(sql)?.[1]?.trim() ?? '';
      const cuerpo = sql
        .slice(inicio + 5, sql.search(/\bEND\s*;?\s*$/i))
        .split(';')
        .map((x) => x.trim())
        .filter(Boolean);
      return {
        evento: (cab?.[1] ?? '').toUpperCase(),
        columnas: (cab?.[2] ?? '')
          .split(',')
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean),
        cuando,
        cuerpo,
      };
    });
    disparadores.set(tabla, lista);
    return lista;
  };
  type Clave = { hija: string; columnas: string[]; madre: string; alBorrar: string };
  let claves: Clave[] | null = null;
  const clavesForaneas = async (): Promise<Clave[]> => {
    if (claves) return claves;
    const { results: tablas } = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
      )
      .all<{ name: string }>();
    const lista: Clave[] = [];
    for (const { name } of tablas) {
      const { results } = await db
        .prepare(
          'SELECT id, "table" AS madre, "from" AS col, on_delete FROM pragma_foreign_key_list(?)',
        )
        .bind(name)
        .all<{ id: number; madre: string; col: string; on_delete: string }>();
      const porId = new Map<number, Clave>();
      for (const f of results) {
        const c = porId.get(f.id) ?? {
          hija: name,
          columnas: [],
          madre: f.madre.toLowerCase(),
          alBorrar: f.on_delete,
        };
        c.columnas.push(f.col);
        porId.set(f.id, c);
      }
      lista.push(...porId.values());
    }
    claves = lista;
    return lista;
  };
  /** Filas que lee buscar en `tabla` por `columnas` (=): con índice, el promedio; sin él, toda. */
  const busquedaHija = async (tabla: string, columnas: string[]): Promise<number> => {
    const { results } = await db
      .prepare('SELECT name FROM pragma_index_list(?)')
      .bind(tabla)
      .all<{ name: string }>();
    for (const { name } of results) {
      const cols = (
        await db
          .prepare('SELECT name FROM pragma_index_info(?) ORDER BY seqno')
          .bind(name)
          .all<{ name: string | null }>()
      ).results.map((c) => c.name);
      const prefijo = cols.slice(0, columnas.length);
      if (prefijo.length === columnas.length && columnas.every((c) => prefijo.includes(c)))
        return Math.max(1, await promedioDe(tabla, name, columnas.length));
    }
    return await tamano(tabla);
  };
  const costoBusquedaHija = new Map<string, number>();
  /** Las columnas que cambia un UPDATE (lo que va entre SET y WHERE). */
  const columnasDelSet = (sql: string): string[] => {
    const set = /\bSET\b([\s\S]*?)(?:\bWHERE\b|\bRETURNING\b|$)/i.exec(sql)?.[1] ?? '';
    return [...set.matchAll(/(?:^|,)\s*"?(\w+)"?\s*=/g)].map((m) => m[1]!.toLowerCase());
  };
  /** Filas leídas de más por CADA fila que la sentencia `verbo` cambia en `tabla`. */
  const porFilaCambiada = async (
    tabla: string,
    verbo: string,
    setCols: string[],
    nivel: number,
    detalle: string[],
  ): Promise<number> => {
    if (nivel > 3) return 0;
    let filas = 0;
    // Claves foráneas.
    for (const k of await clavesForaneas()) {
      if (verbo === 'DELETE' && k.madre === tabla.toLowerCase()) {
        const clave = `${k.hija}:${k.columnas.join(',')}`;
        if (!costoBusquedaHija.has(clave))
          costoBusquedaHija.set(clave, await busquedaHija(k.hija, k.columnas));
        const n = costoBusquedaHija.get(clave)!;
        filas += n;
        if (n > 50) detalle.push(`clave foránea ${k.hija}(${k.columnas.join(',')}) ${n}`);
        if (/CASCADE|SET NULL|SET DEFAULT/i.test(k.alBorrar))
          filas += await porFilaCambiada(
            k.hija,
            /CASCADE/i.test(k.alBorrar) ? 'DELETE' : 'UPDATE',
            k.columnas.map((c) => c.toLowerCase()),
            nivel + 1,
            detalle,
          );
      }
      if (
        k.hija.toLowerCase() === tabla.toLowerCase() &&
        (verbo === 'INSERT' ||
          (verbo === 'UPDATE' && k.columnas.some((c) => setCols.includes(c.toLowerCase()))))
      )
        filas += 1; // busca la madre por su clave
    }
    // Disparadores.
    const conParametros = (t: string) => {
      const sql = t.replace(/\b(NEW|OLD)\.\w+/gi, '?').replace(/RAISE\s*\([^)]*\)/gi, 'NULL');
      return { sql, valores: Array.from({ length: (sql.match(/\?/g) ?? []).length }, () => null) };
    };
    for (const d of await disparadoresDe(tabla)) {
      if (d.evento !== verbo) continue;
      if (verbo === 'UPDATE' && d.columnas.length && !d.columnas.some((c) => setCols.includes(c)))
        continue;
      if (d.cuando) {
        const w = conParametros(`SELECT (${d.cuando})`);
        filas += (await filasDePlan(w.sql, w.valores)).filas;
      }
      for (const t of d.cuerpo) {
        const c = conParametros(t);
        const p = await filasDePlan(c.sql, c.valores);
        filas += p.filas;
        if (p.filas > 50) detalle.push(`disparador sobre ${tabla} ${p.filas}`);
        const v = /^\s*(INSERT|UPDATE|DELETE)/i.exec(c.sql)?.[1]?.toUpperCase();
        const destino = v ? destinoDe(c.sql) : undefined;
        if (v && destino)
          filas += await porFilaCambiada(destino, v, columnasDelSet(c.sql), nivel + 1, detalle);
      }
    }
    return filas;
  };
  /** La tabla que cambia una sentencia INSERT, UPDATE o DELETE. */
  const destinoDe = (sql: string): string | undefined => {
    const palabras = sql.trim().replace(/"/g, '').split(/\s+/);
    const verbo = (palabras[0] ?? '').toUpperCase();
    let i = 1;
    if (palabras[i]?.toUpperCase() === 'OR') i += 2; // con «OR» y su resolución
    if (verbo === 'INSERT' || verbo === 'DELETE') i += 1; // INTO / FROM
    return ['INSERT', 'UPDATE', 'DELETE'].includes(verbo) ? palabras[i] : undefined;
  };

  const estimar = async (s: Sentencia, cambiadas = 0) => {
    if (!anotar || !/^\s*(SELECT|WITH|UPDATE|DELETE|INSERT)/i.test(s.sql)) return;
    const lista = anotar;
    const { filas: delPlan, escaneos } = await filasDePlan(s.sql, s.valores);
    let filas = delPlan;
    const verbo = /^\s*(INSERT|UPDATE|DELETE)\b/i.exec(s.sql)?.[1]?.toUpperCase();
    const destino = verbo ? destinoDe(s.sql) : undefined;
    if (verbo && destino && cambiadas > 0) {
      const extra: string[] = [];
      const una = await porFilaCambiada(destino, verbo, columnasDelSet(s.sql), 0, extra);
      filas += una * cambiadas;
      if (una * cambiadas > 50)
        escaneos.push(
          `${cambiadas} filas × ${una}: ${[...new Set(extra)].join(', ') || 'claves y disparadores'}`,
        );
    }
    lista.push({ sql: s.sql.replace(/\s+/g, ' ').slice(0, 160), filas, escaneos });
  };
  const cambiosDe = (r: unknown): number =>
    Number((r as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0);

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
        const r = await real.all();
        await estimar(s, /^\s*(SELECT|WITH)/i.test(sql) ? 0 : r.results.length || cambiosDe(r));
        return r;
      },
      run: async () => {
        const r = await real.run();
        await estimar(s, cambiosDe(r));
        return r;
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
      const r = await db.batch(reales.map((s, i) => s?.real ?? lista[i]!));
      for (const [i, s] of reales.entries()) if (s) await estimar(s, cambiosDe(r[i]));
      return r;
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
