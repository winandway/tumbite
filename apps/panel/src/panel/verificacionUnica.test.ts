import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-VERIFICACION-UNICA (23 nov 2026, Richard: «todo lo que sea verificación que esté dentro de ese
 * menú»). Candado: lo que aprueba algo de un conductor (su identidad, su vehículo y los papeles del
 * vehículo, sus papeles, su habilitación y sus requisitos) vive en UN solo lugar: la pieza de
 * Verificaciones (`RevisionConductor`, que también sale en su ficha) y la decisión de identidad. Si
 * alguien pone un botón de aprobar en otra pantalla, esta prueba se pone en rojo.
 */
const DECIDIR = [
  /'PATCH', `\/datos\/admin\/kyc\/\$\{/,
  /`\/datos\/admin\/vehiculos\/\$\{[^}]+\}`/,
  /`\/datos\/admin\/vehiculos\/\$\{[^}]+\}\/documentos\/\$\{[^}]+\}`/,
  /`\/datos\/admin\/papeles-conductor\/\$\{[^}]+\}`/,
  /`\/datos\/admin\/habilitaciones\/\$\{/,
  /`\/datos\/admin\/cumplimientos\/\$\{/,
];
/** Las únicas fuentes que pueden decidir algo de un conductor. */
const PERMITIDOS = ['RevisionConductor.tsx', 'SuperKycFicha.tsx', 'SuperMoto.tsx'];
/** Las piezas de revisión que viven en SuperMoto solo se dibujan desde la pieza de Verificaciones. */
const PIEZAS = [/<FilaMoto\b/, /<FilaPapel\b/, /<Conductor\b/];

function fuentes(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return fuentes(ruta);
    return /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [ruta] : [];
  });
}

describe('C-VERIFICACION-UNICA: un solo lugar para aprobar lo de un conductor (candado)', () => {
  const todas = fuentes(join(__dirname, '..'));
  const nombre = (r: string) => r.split('/').at(-1) ?? r;

  it('ninguna otra pantalla aprueba identidad, vehículo, papeles, habilitación ni requisitos', () => {
    const fuera = todas
      .filter((r) => DECIDIR.some((x) => x.test(readFileSync(r, 'utf8'))))
      .map(nombre)
      .filter((n) => !PERMITIDOS.includes(n));
    expect(fuera).toEqual([]);
  });

  it('las piezas de revisión solo se dibujan dentro de la pieza de Verificaciones', () => {
    // Las que traen las piezas de SuperMoto (otras pantallas tienen su propio «Conductor»).
    const donde = todas
      .filter((r) => {
        const s = readFileSync(r, 'utf8');
        return /from '\.\/SuperMoto'/.test(s) && PIEZAS.some((x) => x.test(s));
      })
      .map(nombre)
      .sort();
    expect(donde).toEqual(['RevisionConductor.tsx']);
  });

  it('la pieza de Verificaciones es la misma en Verificaciones y en la ficha del conductor', () => {
    const usan = todas
      .filter((r) => /<RevisionConductor\b/.test(readFileSync(r, 'utf8')))
      .map(nombre)
      .sort();
    expect(usan).toEqual(['SuperFichas.tsx', 'SuperKycFicha.tsx']);
  });
});
