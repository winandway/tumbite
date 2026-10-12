import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Candado C-CABECERA-ANGOSTA: en celulares de 320 px el selector de idioma quedaba afuera. */
describe('cabecera en celulares angostos', () => {
  it('tiene su regla para pantallas de hasta 380 px y recorta el nombre de la cuenta', () => {
    const css = readFileSync(join(__dirname, '..', '..', 'panel', 'src', 'estilos.css'), 'utf8');
    const regla = css.slice(css.indexOf('@media (max-width: 380px)'));
    expect(regla.length).toBeGreaterThan(30);
    expect(regla).toMatch(
      /\.cabecera \.cuenta summary \{[^}]*max-width[^}]*text-overflow: ellipsis/,
    );
  });
});
