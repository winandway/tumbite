import { describe, expect, it } from 'vitest';
import { NOTA_PLATO_MAX, limpiarNotaPlato, textoLinea } from './catalogo';

// C-NOTA-PLATO (30 oct 2026): «sin cebolla» por plato, como las instrucciones especiales de Uber Eats y DoorDash.
describe('C-NOTA-PLATO', () => {
  it('la línea del pedido lleva la nota del plato, en el idioma de quien lee', () => {
    const l = {
      nombreEs: 'Pizza',
      nombreEn: 'Pizza',
      opciones: [{ id: 'g', nombreEs: 'Grande', nombreEn: 'Large', precioCentavos: 0 }],
      nota: 'sin cebolla',
    };
    expect(textoLinea(l, 'es')).toBe('Pizza (Grande) · Nota: sin cebolla');
    expect(textoLinea(l, 'en')).toBe('Pizza (Large) · Note: sin cebolla');
    expect(textoLinea({ nombreEs: 'Pizza', nombreEn: '' }, 'es')).toBe('Pizza');
  });
  it('la nota se limpia: sin saltos de línea, sin espacios de más y con tope', () => {
    expect(limpiarNotaPlato('  bien\n\ncocido   por favor ')).toBe('bien cocido por favor');
    expect(limpiarNotaPlato('   ')).toBe('');
    expect(limpiarNotaPlato('x'.repeat(500))).toHaveLength(NOTA_PLATO_MAX);
  });
});
