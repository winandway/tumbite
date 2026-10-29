import { describe, expect, it } from 'vitest';
import { entregaMostrada } from './entregaMostrada';

// C-ENTREGA-REAL: el detalle del pedido dice cómo se entregó de verdad.
describe('C-ENTREGA-REAL', () => {
  it('un pedido entregado en mano dice «en mano» aunque se pidiera en la puerta', () => {
    expect(entregaMostrada('puerta', 'mano')).toBe('mano');
  });
  it('dejado en un lugar seguro cuenta como en la puerta', () => {
    expect(entregaMostrada('mano', 'seguro')).toBe('puerta');
  });
  it('sin entregar, muestra lo que se pidió', () => {
    expect(entregaMostrada('puerta', null)).toBe('puerta');
    expect(entregaMostrada('recoger', undefined)).toBe('recoger');
  });
  it('sin datos, no muestra nada', () => {
    expect(entregaMostrada(undefined, null)).toBeNull();
  });
});
