import { describe, expect, it } from 'vitest';
import { MARCA } from './marca';

// C-COLOR-LOGISTICA (decisión de Richard, 30 oct 2026): logística (Flex y Envíos) tiene su propio
// color, distinto de comida, para reconocer una captura de un vistazo. Referencia: Amazon Flex.
const luz = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contraste = (a: string, b: string) => {
  const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
};

describe('C-COLOR-LOGISTICA', () => {
  it('logística no se confunde con el rojo de comida ni con el verde del éxito', () => {
    const c = MARCA.colores;
    for (const otro of [c.primario, c.acento, c.exito, c.secundario])
      expect(c.logistica.toLowerCase()).not.toBe(otro.toLowerCase());
  });
  it('el texto blanco sobre el fondo de logística y el texto sobre el botón se leen bien', () => {
    expect(contraste('#FFFFFF', MARCA.colores.logistica)).toBeGreaterThanOrEqual(4.5);
    expect(
      contraste(MARCA.colores.logisticaTexto, MARCA.colores.logisticaAccion),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
