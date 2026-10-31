import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-SEGURIDAD-A-LA-VISTA (31 oct 2026, como SafeDash de DoorDash y la ayuda de emergencia de Amazon
 * Flex): mientras trabaja, la seguridad está a un toque en el mapa y en «Mi ruta».
 */
const src = join(__dirname, '..', '..', '..', 'apps', 'repartidor', 'src');
const inicio = readFileSync(join(src, 'Inicio.tsx'), 'utf8');
const ruta = readFileSync(join(src, 'flex', 'MiRuta.tsx'), 'utf8');

describe('seguridad siempre a la vista', () => {
  it('escudo en el mapa mientras está conectado', () => {
    expect(inicio).toMatch(/testID="escudo-seguridad"/);
    expect(inicio).toMatch(/onPress=\{\(\) => setVista\('seguridad'\)\}/);
  });
  it('«Ayuda de emergencia» en Mi ruta', () => {
    expect(ruta).toContain('testID="ayuda-emergencia"');
    expect(inicio).toContain("alSeguridad={() => setVista('seguridad')}");
  });
});
