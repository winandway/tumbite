import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-UNIONES-D1 (22 nov 2026): la base real (D1) no admite más de CINCO consultas unidas en un mismo
 * SELECT («too many terms in compound SELECT»). El motor de las pruebas sí las admite, así que el
 * fallo solo se ve en el sitio: el borrado de cuenta respondió 500 al sumarle una sexta. Este candado
 * lee el código y falla si una consulta escrita en una sola plantilla pasa de cinco términos.
 */
const TOPE = 5;
const raiz = join(__dirname);

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    // `pruebas/` son ayudantes que solo corren con el motor de las pruebas, nunca en D1.
    if (statSync(ruta).isDirectory()) return n === 'pruebas' ? [] : archivos(ruta);
    return /\.ts$/.test(n) && !/\.test\.ts$/.test(n) ? [ruta] : [];
  });
}

describe('C-UNIONES-D1', () => {
  it('ninguna consulta de una sola plantilla une más de cinco SELECT', () => {
    const pasadas: string[] = [];
    for (const ruta of archivos(raiz)) {
      const texto = readFileSync(ruta, 'utf8');
      for (const plantilla of texto.match(/`[^`]*`/g) ?? []) {
        const terminos = (plantilla.match(/\bUNION\b/g) ?? []).length + 1;
        if (terminos > TOPE) pasadas.push(`${ruta.replace(raiz, '')}: ${terminos} términos`);
      }
    }
    expect(pasadas).toEqual([]);
  });
});
