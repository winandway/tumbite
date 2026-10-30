import { describe, expect, it } from 'vitest';
import { type GrupoOpciones, gruposActivos } from './catalogo';

// C-OPCIONES-ANIDADAS (30 oct 2026): el combo pide la bebida y la bebida pide su tamaño.
describe('C-OPCIONES-ANIDADAS', () => {
  const op = (id: string, abre?: string) => ({
    id,
    nombreEs: id,
    nombreEn: id,
    precioCentavos: 0,
    disponible: true,
    abreGrupoId: abre ?? null,
  });
  const grupos: GrupoOpciones[] = [
    {
      id: 'bebida',
      nombreEs: 'Bebida',
      nombreEn: 'Drink',
      minimo: 1,
      maximo: 1,
      opciones: [op('refresco', 'tamano'), op('agua')],
    },
    {
      id: 'tamano',
      nombreEs: 'Tamaño',
      nombreEn: 'Size',
      minimo: 1,
      maximo: 1,
      opciones: [op('chico'), op('grande')],
      anidado: true,
    },
    {
      id: 'extras',
      nombreEs: 'Extras',
      nombreEn: 'Extras',
      minimo: 0,
      maximo: 3,
      opciones: [op('queso')],
    },
  ];
  it('sin elegir nada, solo los de primer nivel', () => {
    expect(gruposActivos(grupos, []).map((g) => g.id)).toEqual(['bebida', 'extras']);
  });
  it('al elegir la opción que lo abre, aparece el anidado en su lugar', () => {
    expect(gruposActivos(grupos, ['refresco']).map((g) => g.id)).toEqual([
      'bebida',
      'tamano',
      'extras',
    ]);
    expect(gruposActivos(grupos, ['agua']).map((g) => g.id)).toEqual(['bebida', 'extras']);
  });
});
