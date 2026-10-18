import { describe, expect, it } from 'vitest';
import { ORDEN_SERVICIOS, ordenarServicios } from './servicios';

/** El orden lo dictó Richard (18 oct 2026): lo que ya se vende primero, después lo que viene. */
describe('orden de los servicios en el inicio', () => {
  it('es Comida, Moto, Carro, Envíos, Mercado, Farmacia, Licores, Más', () => {
    expect(ORDEN_SERVICIOS).toEqual([
      'comida',
      'moto',
      'carro',
      'envios',
      'mercado',
      'farmacia',
      'licores',
      'mas',
    ]);
  });
  it('ordena lo que manda el servidor sin importar cómo venga, y lo desconocido va al final', () => {
    const lista = ordenarServicios([
      { id: 'farmacia', orden: 60 },
      { id: 'nuevo', orden: 5 },
      { id: 'comida', orden: 10 },
      { id: 'mas', orden: 80 },
      { id: 'moto', orden: 20 },
    ]);
    expect(lista.map((s) => s.id)).toEqual(['comida', 'moto', 'farmacia', 'mas', 'nuevo']);
  });
});
