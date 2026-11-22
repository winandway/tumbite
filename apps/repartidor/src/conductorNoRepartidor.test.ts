import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-DRIVER-DICE-CONDUCTOR (22 nov 2026, Richard) — todos los países. Divoox Driver lleva pasajeros en
 * moto y en carro además de comida: a quien usa la app se le dice «conductor», nunca «repartidor».
 * Esta prueba lee los textos que la app muestra (las cadenas con espacios de su código, sin los
 * comentarios) y falla si alguno vuelve a decir «repartidor». Los nombres internos (rutas, roles,
 * llaves) no cuentan: son una sola palabra y no se muestran.
 */
const RAIZ = join(__dirname);
const MOVIL = join(__dirname, '..', '..', '..', 'packages', 'movil', 'src', 'textos.ts');

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const r = join(dir, n);
    if (statSync(r).isDirectory()) return archivos(r);
    return /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) && !/\.d\.ts$/.test(n) ? [r] : [];
  });
}

/** Las cadenas de texto de un archivo, sin comentarios de línea ni de bloque. */
export function textosVisibles(codigo: string): string[] {
  const sinComentarios = codigo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
  const cadenas = sinComentarios.match(
    /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g,
  );
  return (cadenas ?? []).filter((c) => /\s/.test(c));
}

const dicenRepartidor = (codigo: string) =>
  textosVisibles(codigo)
    // Las direcciones del servidor llevan su nombre interno (/datos/repartidor/…): no se muestran.
    .map((c) => c.replace(/\/[\w/-]*repartidor[\w/-]*/g, ''))
    .filter((c) => /\brepartidor(es|a|as)?\b/i.test(c));

describe('C-DRIVER-DICE-CONDUCTOR', () => {
  it('ningún texto de Divoox Driver dice «repartidor»', () => {
    const fallos = archivos(RAIZ).flatMap((f) =>
      dicenRepartidor(readFileSync(f, 'utf8')).map((c) => `${f.replace(RAIZ, '')}: ${c}`),
    );
    expect(fallos).toEqual([]);
  });

  it('la pantalla de entrar de Driver (textos compartidos) dice «conductor»', () => {
    const codigo = readFileSync(MOVIL, 'utf8');
    const lineas = codigo
      .split('\n')
      .filter((l) => /^\s*(repartidor|terminosRepartidores):/.test(l));
    expect(lineas.length).toBeGreaterThanOrEqual(4);
    expect(lineas.flatMap((l) => dicenRepartidor(l))).toEqual([]);
    expect(codigo).toContain('Cuenta de conductor');
    expect(codigo).toContain('Términos para conductores');
  });

  it('la prueba sí atrapa un texto que diga «repartidor» y no un nombre interno', () => {
    expect(dicenRepartidor("const t = { a: 'Para repartidores' };")).toHaveLength(1);
    expect(
      dicenRepartidor("pedir('GET', '/datos/repartidor/ofertas'); // el repartidor ve"),
    ).toEqual([]);
  });
});
