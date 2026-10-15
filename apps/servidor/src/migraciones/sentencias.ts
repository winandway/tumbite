/** Separa un archivo .sql en sentencias (sin comentarios de línea). Igual que en las pruebas. */
export function sentencias(sql: string): string[] {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*\n/)
    .map((s) => s.trim().replace(/;$/, ''))
    .filter(Boolean);
}
