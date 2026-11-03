import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');

/**
 * C-SQL-LOCAL-OCUPADA (3 nov 2026): las pruebas del recorrido local leen la base del servidor de
 * pruebas con `wrangler d1 execute --local` mientras el servidor escribe en el MISMO archivo de
 * SQLite. Si coinciden, SQLite responde «database is locked» (SQLITE_BUSY) y la prueba fallaba por
 * azar (envios.spec.ts en la verificación de main del 3 nov). Una sola pieza para todas: reintenta
 * SOLO ese error, con espera creciente; cualquier otro error sale enseguida y con su mensaje (antes
 * se tiraba la salida de error y no se sabía por qué falló). Solo la base local de .recorrido.
 */
// Con la base tomada, wrangler local no dice «locked»: responde «Failed to get session commit token»
// (comprobado el 3 nov bloqueando el archivo a propósito con sqlite3).
export const BASE_OCUPADA = /SQLITE_BUSY|database is locked|session commit token/i;

function conReintento(comando: string, json: boolean): string {
  for (let intento = 1; ; intento++) {
    const r = spawnSync(
      'npx',
      [
        'wrangler',
        'd1',
        'execute',
        'tumbite-local',
        '--local',
        '--persist-to',
        '.recorrido/estado',
        '-c',
        '.recorrido/wrangler.jsonc',
        ...(json ? ['--json'] : []),
        '--command',
        comando,
      ],
      { cwd: RAIZ, encoding: 'utf8' },
    );
    if (r.status === 0) return r.stdout;
    const salida = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
    if (!BASE_OCUPADA.test(salida) || intento >= 8)
      throw new Error(`La consulta local falló (intento ${intento}): ${comando}\n${salida.trim()}`);
    // 0,25 s, 0,5 s, 1 s, 2 s… hasta 4 s: la base se libera enseguida.
    Atomics.wait(
      new Int32Array(new SharedArrayBuffer(4)),
      0,
      0,
      Math.min(250 * 2 ** (intento - 1), 4000),
    );
  }
}

/** Filas de una consulta a la base local del recorrido. */
export function sqlLocal(comando: string): Record<string, unknown>[] {
  const salida = conReintento(comando, true);
  return (JSON.parse(salida) as { results: Record<string, unknown>[] }[])[0]?.results ?? [];
}

/** La salida en texto (para las pruebas que solo escriben o buscan un texto en la respuesta). */
export function sqlLocalTexto(comando: string): string {
  return conReintento(comando, false);
}
