import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-ALTA-CONGELADA (27 nov 2026, orden de Richard y del responsable de Tucaní): «déjala tal cual hasta
 * que podamos meter a la gente». Las pantallas del alta de conductor (crear cuenta, verificar el
 * celular y la moto) NO cambian sus textos ni el orden de sus casillas. Solo se arreglan fallos, y un
 * arreglo no mueve botones ni cambia lo que el equipo ya aprendió. Si esta prueba falla, el cambio
 * necesita el permiso de Gerencia ANTES de actualizar la foto (`npx vitest -u`), y se anota en
 * CANDADOS.md quién lo autorizó. No mide colores ni tamaños: eso lo revisa la captura del robot.
 */
const RAIZ = join(import.meta.dirname, '..', '..', '..');
const PANTALLAS = [
  'packages/movil/src/Acceso.tsx',
  'apps/repartidor/src/ConfirmarTelefono.tsx',
  'apps/repartidor/src/viajes/AltaPasajeros.tsx',
];

/** Los textos en español que ve la persona (los que llevan letras y un espacio), en su orden. */
function textosVisibles(fuente: string): string[] {
  return [...fuente.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)]
    .map((m) => m[1] ?? '')
    .filter((t) => /[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(t) && /\s/.test(t) && !/^[\w./@-]+$/.test(t))
    .filter((t) => !/^(import|SELECT|POST|GET|PUT)\b/.test(t));
}

describe('C-ALTA-CONGELADA: el alta de conductor no cambia sin permiso de Gerencia', () => {
  for (const archivo of PANTALLAS) {
    it(`los textos de ${archivo} siguen iguales`, () => {
      expect(textosVisibles(readFileSync(join(RAIZ, archivo), 'utf8'))).toMatchSnapshot();
    });
  }
  it('«Tu moto» pide las casillas en el mismo orden: marca, modelo, año, color, placa', () => {
    const f = readFileSync(join(RAIZ, 'apps/repartidor/src/viajes/AltaPasajeros.tsx'), 'utf8');
    const orden = [...f.matchAll(/casilla\('(\w+)'/g)].map((m) => m[1]);
    expect(orden.slice(0, 5)).toEqual(['marca', 'modelo', 'anio', 'color', 'placa']);
  });
});
