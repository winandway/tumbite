import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-TEXTO-ENTERO y C-FOTO-QUE-CORRESPONDE (auditor de tiendas, 18 nov 2026). En las capturas del
 * inicio salían cortados el nombre y el tiempo de los restaurantes («Bella I…», «15–25 m…»), las
 * categorías («Pollo I…»), las píldoras de filtro («Top rat…») y el «+» del último chip; y un
 * restaurante sin foto propia llevaba una pizza, una hamburguesa o un sushi que no le correspondía.
 */
const leer = (r: string) => readFileSync(join(import.meta.dirname, r), 'utf8');

describe('los textos del inicio no se cortan', () => {
  it('nombre y tiempo de los restaurantes cercanos: hasta dos renglones', () => {
    const s = leer('inicio/PiezasInicio.tsx');
    const i = s.lastIndexOf('{r.nombre}\n');
    expect(s.slice(i - 200, i)).toContain('numberOfLines={2}');
    expect(s).not.toMatch(
      /<Text numberOfLines=\{1\} style=\{\{ fontWeight: '700', fontSize: 14 \}\}>/,
    );
  });
  it('las categorías: hasta dos renglones', () => {
    const s = leer('inicio/Categorias.tsx');
    const i = s.indexOf('{categoriaRestaurante(c, idioma)}\n');
    expect(s.slice(i - 400, i)).toContain('numberOfLines={2}');
  });
  it('las píldoras no se encogen y la fila deja aire al final', () => {
    const p = leer('comida/piezas.tsx');
    const i = p.indexOf('export function Pildora');
    expect(p.slice(i, i + 1500)).toContain('flexShrink: 0');
    expect(p.slice(i, i + 1500)).toContain('textBreakStrategy="simple"');
    expect(leer('app/restaurants.tsx')).toContain('paddingRight: 16');
  });
  it('un restaurante sin foto no lleva la foto de otra comida', () => {
    const s = leer('inicio/recursos.ts');
    expect(s).not.toMatch(/indice % 3/);
    expect(leer('inicio/PiezasInicio.tsx')).not.toContain('IMG_NUEVO.fotoPizza}');
  });
  it('C-CERRADO-LEGIBLE: un restaurante cerrado atenúa la foto, no el texto (contraste mínimo)', () => {
    for (const r of ['app/restaurants.tsx', 'app/search.tsx', 'inicio/Restaurantes.tsx']) {
      const s = leer(r);
      expect(s, r).not.toMatch(/abierto\(r\) \? 1 : 0\.6|!abierto\(r\) \? 0\.6|apagado \? 0\.65/);
      expect(s, r).toMatch(/opacity: (abierto\(r\)|p\.abiertoAhora) \? 1 : 0\.55/);
    }
  });
});
