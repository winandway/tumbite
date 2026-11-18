import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-CATEGORIA-EN-INGLES (robot de Android, 18 nov 2026): en inglés, las tarjetas mostraban
 * «Mexicana» y «Hamburguesas». Toda pantalla que muestra la categoría del restaurante pasa por
 * `categoriaRestaurante` (packages/compartido).
 */
const PANTALLAS = [
  'app/restaurants.tsx',
  'app/search.tsx',
  'app/favorites.tsx',
  'app/restaurant/[id].tsx',
  'inicio/Restaurantes.tsx',
  'inicio/Categorias.tsx',
];

describe('la categoría del restaurante se muestra en el idioma de la persona', () => {
  for (const archivo of PANTALLAS)
    it(archivo, () => {
      const s = readFileSync(join(import.meta.dirname, archivo), 'utf8');
      expect(s).toContain('categoriaRestaurante(');
      // Nada de la categoría cruda a la vista.
      expect(s).not.toMatch(/\{r\.categoria\}|· \{r\.categoria\}|`\$\{r\.categoria\} · `/);
    });
});
