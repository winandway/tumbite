/**
 * C-INDICES-SIN-USO (26 nov 2026, Gerencia, punto 8 del plan de mejoras) — todos los países.
 * Índices que NINGUNA consulta real usa, retirados de la base. Cada índice es una escritura más en
 * cada alta o cambio de su tabla (regla «la nube no se come el dinero»).
 *
 * Cómo se decidió (estudio en docs/INDICES-D1-2026-11-26.md): el plan de SQLite de TODAS las consultas
 * reales de 31 días de producción (2.828 distintas, `wrangler d1 insights`), de las 5.000 más usadas
 * del sitio de pruebas, de los cuerpos de los disparadores y de las 9.460 consultas distintas que corre
 * la batería completa de pruebas del servidor. Ninguna usa estos seis; ninguno es único (no protege
 * ningún dato). Dos de ellos repetían un índice que ya existe:
 *   - miembros_restaurante_usuario = miembros_restaurante_una_persona (único, la misma columna);
 *   - catalogo_productos_barras: las búsquedas por código van con OR junto al nombre (no lo usan) y
 *     las del comercio usan UNIQUE (comercio_id, sku).
 *
 * schema.sql corre en cada publicación con CREATE … IF NOT EXISTS y no borra nada: por eso la
 * migración de arranque los borra con DROP INDEX IF EXISTS (una vez por huella del esquema).
 * Para volver a ponerlo: quitarlo de aquí y devolver su CREATE INDEX a schema.sql.
 */
export const INDICES_RETIRADOS = [
  'pedidos_sesion',
  'retiros_por_procesar',
  'vehiculo_documentos_vence',
  'miembros_restaurante_usuario',
  'catalogo_productos_barras',
  'invitaciones_flota_correo',
] as const;

export const SQL_INDICES_RETIRADOS = INDICES_RETIRADOS.map((n) => `DROP INDEX IF EXISTS ${n}`);
