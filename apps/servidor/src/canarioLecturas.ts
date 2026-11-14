/**
 * C-LECTURAS-SALUD (13 nov 2026, regla global «la nube no se come el dinero»). Todos los países.
 *
 * El canario (/datos/salud) es público y lo llama GitHub cada pocos minutos. En una vuelta de
 * pruebas del 13 nov leyó unas 94.000 filas del sitio de pruebas por llamada. Aquí viven las
 * piezas que comparte para leer poco:
 *
 * - `disparadoresPresentes`: los nombres de todos los disparadores en UNA lectura de
 *   `sqlite_master` (que no tiene índice: cada consulta la recorre entera, unas 730 filas). Antes,
 *   cuatro piezas la recorrían cada una por su lado.
 */
export async function disparadoresPresentes(db: D1Database): Promise<Set<string>> {
  const { results } = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'")
    .all<{ name: string }>();
  return new Set(results.map((r) => r.name));
}

/** Cuántos de `nombres` están en el conjunto. */
export const cuantosHay = (presentes: Set<string>, nombres: readonly string[]) =>
  nombres.filter((n) => presentes.has(n)).length;
