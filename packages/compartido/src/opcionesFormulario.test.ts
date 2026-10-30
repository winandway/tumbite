import { describe, expect, it } from 'vitest';
import { formularioAGrupos, gruposAFormulario } from './opcionesFormulario';

// C-APP-OPCIONES (30 oct 2026): ida y vuelta de las opciones, con «abre el grupo» bien numerado.
describe('C-APP-OPCIONES', () => {
  it('ida y vuelta conserva precios y a qué grupo abre cada opción, aunque haya grupos vacíos', () => {
    const form = gruposAFormulario(
      [
        {
          id: 'g1',
          nombreEs: 'Bebida',
          nombreEn: 'Drink',
          minimo: 1,
          maximo: 1,
          opciones: [
            {
              id: 'o1',
              nombreEs: 'Refresco',
              nombreEn: 'Soda',
              precioCentavos: 150,
              disponible: true,
              abreGrupoId: 'g2',
            },
          ],
        },
        {
          id: 'g2',
          nombreEs: 'Tamaño',
          nombreEn: 'Size',
          minimo: 1,
          maximo: 1,
          anidado: true,
          opciones: [
            {
              id: 'o2',
              nombreEs: 'Grande',
              nombreEn: 'Large',
              precioCentavos: 0,
              disponible: true,
            },
          ],
        },
      ],
      'USD',
    );
    expect(form[0]!.opciones[0]).toMatchObject({ precio: '1.50', abreGrupo: '1' });
    // Un grupo vacío en medio: el número del grupo abierto se recalcula.
    const conVacio = [
      form[0]!,
      { nombreEs: '', nombreEn: '', minimo: '0', maximo: '1', opciones: [] },
      form[1]!,
    ];
    conVacio[0] = { ...conVacio[0]!, opciones: [{ ...conVacio[0]!.opciones[0]!, abreGrupo: '2' }] };
    const g = formularioAGrupos(conVacio, 'USD');
    expect(g).toHaveLength(2);
    expect(g[0]!.opciones[0]).toMatchObject({ precioCentavos: 150, abreGrupo: 1 });
  });
});
