// Lee schema.sql y escribe la lista de columnas de cada tabla en apps/servidor/src/esquemaColumnas.ts.
// El servidor la compara con la base real al arrancar (candado C-ESQUEMA-COMPLETO): si una columna
// del esquema no existe en la base, la salud dice «esquema: error» y el semáforo frena la
// publicación. Uso (desde la raíz): node scripts/generar-columnas.mjs
import { readFileSync, writeFileSync } from 'node:fs';

export function columnasDelEsquema(sql) {
  const limpio = sql.replace(/--[^\n]*/g, '');
  const tablas = {};
  for (const m of limpio.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\);/g)) {
    const cols = [];
    for (const linea of m[2].split('\n')) {
      const w = /^\s*([a-z_][a-z0-9_]*)\s+(TEXT|INTEGER|REAL|BLOB|NUMERIC)\b/.exec(linea);
      if (w) cols.push(w[1]);
    }
    tablas[m[1]] = cols;
  }
  return tablas;
}

if (process.argv[1]?.endsWith('generar-columnas.mjs')) {
  const tablas = columnasDelEsquema(readFileSync('schema.sql', 'utf8'));
  writeFileSync(
    'apps/servidor/src/esquemaColumnas.ts',
    `// GENERADO por scripts/generar-columnas.mjs a partir de schema.sql. No editar a mano.\nexport const COLUMNAS_DEL_ESQUEMA: Record<string, readonly string[]> = ${JSON.stringify(tablas, null, 2)};\n`,
  );
  console.log(`columnas de ${Object.keys(tablas).length} tablas`);
}
