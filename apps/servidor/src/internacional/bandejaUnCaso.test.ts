import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// C-BANDEJA-UN-CASO: abrir un caso filtra DENTRO de la consulta. Si una fuente nueva no lleva la
// marca {{id}}, el detalle volvería a calcular todos los casos (más de 20 s con muchos casos).
describe('C-BANDEJA-UN-CASO', () => {
  const src = readFileSync(join(__dirname, 'bandeja.ts'), 'utf8');
  it('cada fuente de casos lleva su columna y su marca de filtro', () => {
    const fuentes = src.match(/^\s+tipo: '[a-z_]+',$/gm) ?? [];
    expect(fuentes.length).toBeGreaterThan(5);
    expect(src.match(/idCol: '[a-z]\.id',/g)?.length).toBe(fuentes.length);
    expect(src.match(/AND \{\{id\}\}`|WHERE \{\{id\}\}`|AND \{\{id\}\}\n/g)?.length).toBe(
      fuentes.length,
    );
    expect(src).not.toMatch(/FROM \(\$\{f\.sql\}\) x \$\{sinResueltos/);
  });
});
