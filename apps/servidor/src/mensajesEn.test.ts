import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MENSAJES_EN } from './mensajesEn';
import { mundo } from './pruebas/ayuda';

/**
 * Candado C-INGLES-PRINCIPAL: todo mensaje que el servidor le muestra a una persona tiene su
 * versión en inglés. Si alguien escribe un ErrorDatos nuevo o un mensaje de validación nuevo sin
 * agregarlo a MENSAJES_EN, esta prueba se pone en rojo.
 */
const archivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const r = join(dir, n);
    if (statSync(r).isDirectory()) return n === 'pruebas' ? [] : archivos(r);
    return r.endsWith('.ts') && !r.endsWith('.test.ts') ? [r] : [];
  });

const ESPANOL =
  /[ñáéíóú¿¡]|\b(el|la|de|que|tu|un|una|no|para|ya|se|es|esa|ese|este|esta|los|las|con|en|debe|ser|fecha)\b/i;

/** Los textos entre comillas dentro de cada «new ErrorDatos(…)». */
function deErrorDatos(s: string): string[] {
  const out: string[] = [];
  for (let i = s.indexOf('new ErrorDatos('); i !== -1; i = s.indexOf('new ErrorDatos(', i + 1)) {
    let p = 1;
    let j = i + 'new ErrorDatos('.length;
    const desde = j;
    while (j < s.length && p > 0) {
      if (s[j] === '(') p++;
      else if (s[j] === ')') p--;
      j++;
    }
    for (const m of s.slice(desde, j - 1).matchAll(/'((?:[^'\\]|\\.)*)'/g))
      if (m[1] && m[1].includes(' ') && ESPANOL.test(m[1])) out.push(m[1]);
  }
  return out;
}

/** Los mensajes de los esquemas de validación (lo que sale cuando un campo está mal). */
function deEsquemas(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(
    /(?:(?:message|error):\s*|\.(?:min|max|email|regex|length|url|int|positive|nonnegative|gte|lte|refine)\([^'`)]*?)'((?:[^'\\]|\\.)+)'/g,
  ))
    if (m[1] && m[1].includes(' ') && ESPANOL.test(m[1])) out.push(m[1]);
  return out;
}

describe('mensajes del servidor en inglés', () => {
  it('cada mensaje para la persona tiene su traducción', () => {
    const servidor = archivos(join(__dirname));
    const compartido = archivos(join(__dirname, '..', '..', '..', 'packages', 'compartido', 'src'));
    const faltan = new Set<string>();
    for (const f of [...servidor, ...compartido]) {
      const s = readFileSync(f, 'utf8');
      const msgs = [
        ...deErrorDatos(s),
        ...(/esquemas|catalogo|espera|rutas/.test(f) ? deEsquemas(s) : []),
      ];
      for (const m of msgs) if (!MENSAJES_EN.has(m)) faltan.add(m);
    }
    expect([...faltan]).toEqual([]);
  });

  it('el servidor contesta en el idioma que pide la app', async () => {
    const m = mundo();
    const pedir = (idioma: string) =>
      m.crudo('/datos/cuentas/entrar', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-idioma': idioma,
          'cf-connecting-ip': '10.9.9.9',
        },
        body: JSON.stringify({ correo: 'nadie@ejemplo.com', clave: 'clave-que-no-existe' }),
      });
    expect(((await (await pedir('en')).json()) as { error: string }).error).toBe(
      'The email or password is incorrect.',
    );
    expect(((await (await pedir('es')).json()) as { error: string }).error).toBe(
      'El correo o la contraseña no coinciden.',
    );
  });
});
