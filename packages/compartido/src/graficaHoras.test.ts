import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Text: 'Text',
  View: 'View',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
}));
vi.mock('@tumbite/movil', () => ({}));

/**
 * Repaso de la app del restaurante (31 oct 2026): con un solo pedido, «Pedidos por hora» era un
 * bloque negro que llenaba todo el ancho. La gráfica muestra al menos 12 horas.
 */
describe('gráfica de pedidos por hora', async () => {
  const { ventanaHoras, horaCorta } = await import('../../../apps/restaurante/src/Estadisticas');
  it('un solo pedido a las 8 muestra 12 horas alrededor', () => {
    const [d, h] = ventanaHoras(8, 8);
    expect(h - d).toBe(11);
    expect(d).toBeLessThanOrEqual(8);
    expect(h).toBeGreaterThanOrEqual(8);
  });
  it('no se sale del día', () => {
    expect(ventanaHoras(0, 0)).toEqual([0, 11]);
    expect(ventanaHoras(23, 23)).toEqual([12, 23]);
    expect(ventanaHoras(2, 21)).toEqual([2, 21]);
  });
  it('horas al estilo de cada idioma', () => {
    expect(horaCorta(8, 'en')).toBe('8a');
    expect(horaCorta(12, 'en')).toBe('12p');
    expect(horaCorta(17, 'en')).toBe('5p');
    expect(horaCorta(17, 'es')).toBe('17');
  });
});
