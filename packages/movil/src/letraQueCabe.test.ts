import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { letraQueCabe } from './letraQueCabe';

/**
 * C-DESLIZAR-TEXTO-ENTERO (19 nov 2026) — todos los países. En la versión web de Driver, a 360 de
 * ancho, el botón decía «Desliza para terminar el vi…»: en la web `adjustsFontSizeToFit` no hace
 * nada y el texto se cortaba. Ahora el deslizador calcula la letra que cabe en su ancho.
 * Comprobado en ROJO: sin la pieza el módulo no existe; y quitando `letraQueCabe(` del deslizador
 * falla la última prueba.
 */
describe('C-DESLIZAR-TEXTO-ENTERO · el texto del deslizador nunca se corta', () => {
  it('con espacio de sobra deja la letra base', () => {
    expect(letraQueCabe('Llegué', 300, 17)).toBe(17);
    expect(letraQueCabe('Desliza para terminar el viaje', 400, 17)).toBe(17);
  });
  it('en un teléfono de 360 el texto largo se achica hasta caber, sin bajar de lo legible', () => {
    // 360 de pantalla − márgenes − pulgar ≈ 232 de espacio para el texto.
    const letra = letraQueCabe('Desliza para terminar el viaje', 232, 17);
    expect(letra).toBeLessThan(17);
    expect(letra).toBeGreaterThanOrEqual(12);
    expect('Desliza para terminar el viaje'.length * letra * 0.56).toBeLessThanOrEqual(232);
  });
  it('sin medida todavía (ancho 0) no inventa: deja la base', () => {
    expect(letraQueCabe('Desliza para completar', 0, 17)).toBe(17);
  });
  it('nunca baja del mínimo', () => {
    expect(letraQueCabe('x'.repeat(200), 100, 17)).toBe(12);
  });
  it('el deslizador usa la pieza para su texto', () => {
    const s = readFileSync(join(__dirname, 'Deslizador.tsx'), 'utf8');
    expect(s).toMatch(/fontSize: letraQueCabe\(/);
  });
});
