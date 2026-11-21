import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// C-EDITAR-ES-EDITAR (21 nov 2026, visto en pantalla contra el sitio de pruebas): al subir o borrar
// una foto de la entrada, la hoja avisaba a la pantalla de afuera (`alCambiar`) DENTRO de la función
// que calcula el estado nuevo de `setFotos`. React lo marca («Cannot update a component while
// rendering a different component») y, con el modo estricto, ese aviso corre dos veces. El aviso va
// después, fuera del cálculo del estado.
const fuente = readFileSync(join(__dirname, 'FotosPuerta.tsx'), 'utf8');

/** El cuerpo de cada `setFotos((x) => { ... })`, contando llaves. */
function cuerposDeSetFotos(texto: string): string[] {
  const cuerpos: string[] = [];
  for (const m of texto.matchAll(/setFotos\(\(\w+\) => \{/g)) {
    let i = (m.index ?? 0) + m[0].length;
    let nivel = 1;
    const inicio = i;
    while (i < texto.length && nivel > 0) {
      if (texto[i] === '{') nivel++;
      else if (texto[i] === '}') nivel--;
      i++;
    }
    cuerpos.push(texto.slice(inicio, i - 1));
  }
  return cuerpos;
}

describe('C-EDITAR-ES-EDITAR: la hoja de fotos no avisa afuera mientras calcula su estado', () => {
  it('ningún setFotos llama a avisar ni a alCambiar dentro de su función', () => {
    for (const c of cuerposDeSetFotos(fuente)) {
      expect(c).not.toMatch(/\bavisar\(/);
      expect(c).not.toMatch(/\balCambiar\b/);
    }
  });

  it('ningún cálculo de estado (set…(x => {…})) llama a avisar', () => {
    for (const m of fuente.matchAll(/\bset\w+\(\(\w+\) => \{/g)) {
      const desde = (m.index ?? 0) + m[0].length;
      const cuerpo = cuerposDeSetFotos(`setFotos((x) => {${fuente.slice(desde)}`)[0] ?? '';
      expect(cuerpo).not.toMatch(/\bavisar\(/);
    }
  });

  it('subir y borrar siguen avisando a la pantalla de afuera', () => {
    const avisos = [...fuente.matchAll(/\bavisar\(tipo, /g)];
    expect(avisos.length).toBeGreaterThanOrEqual(2);
  });
});
