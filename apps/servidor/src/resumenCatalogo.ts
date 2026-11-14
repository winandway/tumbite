/**
 * C-LECTURAS-CATALOGO (14 nov 2026, orden de Richard; regla «la nube no se come el dinero»). Todos
 * los países.
 *
 * `GET /datos/restaurantes` es lo primero que abre CADA cliente. Leyó 179.848 filas en una vuelta
 * del sitio de pruebas: para la calificación de cada restaurante unía `calificaciones` con TODOS
 * los pedidos de su historia (por el índice del restaurante, no hay otro), y además leía los turnos
 * de cada restaurante de la zona en otra consulta.
 *
 * Ahora cada restaurante guarda su resumen en su propia fila, al día por disparadores:
 *  - `calif_suma` y `calif_n`: la suma y la cuenta de las estrellas al restaurante (las mismas que
 *    sumaba `conCalificaciones`: promedio = suma / n). Cuesta una escritura en `restaurantes` por
 *    cada calificación nueva o cambiada (nada en los índices: esas columnas no tienen índice).
 *  - `horarios_json`: sus turnos (lo que leía `conHorarios`). Cuesta una escritura por cada turno
 *    que el restaurante cambia (cosa de una vez cada tanto). NULL = todavía sin calcular: el listado
 *    vuelve a leer la tabla de turnos de ese restaurante, como antes.
 * El listado lee así una fila por restaurante y nada más por restaurante.
 *
 * El relleno inicial corre UNA vez (marca `resumen_catalogo` en `config`), en la misma transacción
 * que crea los disparadores: ninguna calificación queda contada dos veces ni fuera.
 */
export const COLUMNAS_RESUMEN_CATALOGO: [tabla: string, columna: string, definicion: string][] = [
  ['restaurantes', 'calif_suma', 'INTEGER NOT NULL DEFAULT 0'],
  ['restaurantes', 'calif_n', 'INTEGER NOT NULL DEFAULT 0'],
  ['restaurantes', 'horarios_json', 'TEXT'],
];

export const MARCA_RESUMEN_CATALOGO = 'resumen_catalogo';
const VERSION = 'v1';

/** El restaurante de un pedido (NEW/OLD.pedido_id de la calificación), por la clave del pedido. */
const DE = (x: 'NEW' | 'OLD') => `(SELECT restaurante_id FROM pedidos WHERE id = ${x}.pedido_id)`;
const TURNOS = (rid: string) =>
  `(SELECT json_group_array(json_object('dia', dia, 'abre', abre, 'cierra', cierra))
      FROM horarios_restaurante WHERE restaurante_id = ${rid})`;

export const DISPARADORES_RESUMEN_CATALOGO = [
  `CREATE TRIGGER IF NOT EXISTS calif_resumen_alta AFTER INSERT ON calificaciones
     WHEN NEW.estrellas_restaurante IS NOT NULL
   BEGIN
     UPDATE restaurantes SET calif_suma = calif_suma + NEW.estrellas_restaurante, calif_n = calif_n + 1
      WHERE id = ${DE('NEW')};
   END`,
  `CREATE TRIGGER IF NOT EXISTS calif_resumen_cambio AFTER UPDATE OF estrellas_restaurante ON calificaciones
     WHEN OLD.estrellas_restaurante IS NOT NEW.estrellas_restaurante
   BEGIN
     UPDATE restaurantes
        SET calif_suma = calif_suma - COALESCE(OLD.estrellas_restaurante, 0) + COALESCE(NEW.estrellas_restaurante, 0),
            calif_n = calif_n - (OLD.estrellas_restaurante IS NOT NULL) + (NEW.estrellas_restaurante IS NOT NULL)
      WHERE id = ${DE('NEW')};
   END`,
  `CREATE TRIGGER IF NOT EXISTS calif_resumen_baja AFTER DELETE ON calificaciones
     WHEN OLD.estrellas_restaurante IS NOT NULL
   BEGIN
     UPDATE restaurantes SET calif_suma = calif_suma - OLD.estrellas_restaurante, calif_n = calif_n - 1
      WHERE id = ${DE('OLD')};
   END`,
  `CREATE TRIGGER IF NOT EXISTS horarios_resumen_alta AFTER INSERT ON horarios_restaurante
   BEGIN
     UPDATE restaurantes SET horarios_json = ${TURNOS('NEW.restaurante_id')} WHERE id = NEW.restaurante_id;
   END`,
  `CREATE TRIGGER IF NOT EXISTS horarios_resumen_cambio AFTER UPDATE ON horarios_restaurante
   BEGIN
     UPDATE restaurantes SET horarios_json = ${TURNOS('OLD.restaurante_id')} WHERE id = OLD.restaurante_id;
     UPDATE restaurantes SET horarios_json = ${TURNOS('NEW.restaurante_id')} WHERE id = NEW.restaurante_id;
   END`,
  `CREATE TRIGGER IF NOT EXISTS horarios_resumen_baja AFTER DELETE ON horarios_restaurante
   BEGIN
     UPDATE restaurantes SET horarios_json = ${TURNOS('OLD.restaurante_id')} WHERE id = OLD.restaurante_id;
   END`,
];

/**
 * Crea los disparadores y, la primera vez, rellena el resumen de todos los restaurantes (una sola
 * transacción). Corre dentro de la migración (después de agregar las columnas).
 */
export async function asegurarResumenCatalogo(db: D1Database): Promise<void> {
  const hecho = await db
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(MARCA_RESUMEN_CATALOGO)
    .first<{ valor: string }>();
  const disparadores = DISPARADORES_RESUMEN_CATALOGO.map((sql) => db.prepare(sql));
  if (hecho?.valor === VERSION) {
    await db.batch(disparadores);
    return;
  }
  await db.batch([
    ...disparadores,
    db.prepare(
      `UPDATE restaurantes SET
         calif_suma = COALESCE((SELECT SUM(c.estrellas_restaurante) FROM calificaciones c JOIN pedidos p ON p.id = c.pedido_id
                                 WHERE p.restaurante_id = restaurantes.id AND c.estrellas_restaurante IS NOT NULL), 0),
         calif_n = (SELECT COUNT(*) FROM calificaciones c JOIN pedidos p ON p.id = c.pedido_id
                     WHERE p.restaurante_id = restaurantes.id AND c.estrellas_restaurante IS NOT NULL),
         horarios_json = ${TURNOS('restaurantes.id')}`,
    ),
    db
      .prepare(
        `INSERT INTO config (clave, valor) VALUES (?, ?)
         ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')`,
      )
      .bind(MARCA_RESUMEN_CATALOGO, VERSION),
  ]);
}
