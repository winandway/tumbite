import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS } from './guias';

/**
 * C-SIN-MARCA-COMPETENCIA (22 nov 2026, Richard vía Gerencia) — todos los países. La marca de motos
 * de los dueños de la competencia no se nombra ni se muestra en nada nuestro: ejemplos, datos de
 * prueba, textos de relleno, guiones de capturas, banners, Docs y guías. Los ejemplos usan «Motos
 * Divoox» (modelo «M150») u otra marca neutra.
 *
 * Lo prohibido es la publicidad y los ejemplos, NO el dato real: un conductor con una moto de esa
 * marca la registra con su marca verdadera (el formulario no tiene lista cerrada de marcas y nada la
 * bloquea), y sus datos reales en la base no se tocan.
 *
 * El repositorio es público: se revisa TODO el texto de apps, paquetes, recorridos, guiones, docs y
 * simulador. Comprobado en ROJO volviendo a poner la marca en un dato de prueba.
 */
const RAIZ = join(__dirname, '..', '..', '..', '..', '..');
const llano = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/**
 * La marca y sus modelos, como palabra entera. «BRF» solo cuando no es el nombre interno de un
 * bloque de trabajo («BRF-1», «BRF-4b»), que no tiene nada que ver.
 */
export const MARCA_VETADA = /\b(bera|br200|sbr|brx|brz|gbr)\b|\bbrf\b(?!-\d)/;

const ESTE = 'apps/panel/src/sitio/docs/sinMarcaCompetencia.test.ts';
const archivos = execFileSync(
  'git',
  ['ls-files', '--', 'apps', 'packages', 'e2e', 'scripts', 'docs', 'simulador', 'progreso'],
  { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
)
  .split('\n')
  .filter((a) => /\.(ts|tsx|mjs|js|json|md|css|html|sql|txt)$/.test(a) && a !== ESTE);

describe('C-SIN-MARCA-COMPETENCIA', () => {
  it('la regla reconoce la marca y deja pasar los nombres internos de bloques', () => {
    expect(MARCA_VETADA.test(llano("marca: 'Bera'"))).toBe(true);
    expect(MARCA_VETADA.test(llano('modelo SBR'))).toBe(true);
    expect(MARCA_VETADA.test(llano('BRF-4b: columnas'))).toBe(false);
    expect(MARCA_VETADA.test(llano('Motos Divoox M150'))).toBe(false);
    expect(MARCA_VETADA.test(llano('Bella Pizza, cebra, beraterin'))).toBe(false);
  });

  it('ninguna guía pública nombra la marca', () => {
    expect(MARCA_VETADA.test(llano(JSON.stringify(DOCS)))).toBe(false);
  });

  it('ningún archivo de texto del repositorio nombra la marca ni sus modelos', () => {
    expect(archivos.length).toBeGreaterThan(500);
    const malos = archivos.filter((a) =>
      MARCA_VETADA.test(llano(readFileSync(join(RAIZ, a), 'utf8'))),
    );
    expect(malos).toEqual([]);
  }, 60_000);
});
