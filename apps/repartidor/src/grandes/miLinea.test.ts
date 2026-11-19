import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-LINEAS-TAXI (19 nov 2026): «Mi línea» de Divoox Driver. Sacar a un conductor va dentro de los tres
 * puntos (regla de Richard), la línea se elige de la lista de la ciudad (nunca texto libre) o con su código,
 * el código escrito no se pierde (borrador) y la emergencia se explica en español e inglés.
 */
describe('Mi línea (Driver)', () => {
  const s = readFileSync(join(import.meta.dirname, 'MiLinea.tsx'), 'utf8');
  it('sacar a un conductor está dentro del menú de tres puntos, con confirmación aparte', () => {
    expect(s).toMatch(/<MenuTresPuntos/);
    expect(s).toMatch(/texto: t\.sacar,[\s\S]*?peligro: true/);
    // El botón de sacar nunca está suelto: solo se confirma después del menú.
    expect(s).toMatch(/confirmar\?\.id === m\.id/);
    expect(s).not.toMatch(/<Boton[^>]*texto=\{t\.sacar\}/);
  });
  it('la línea se elige de la lista de la ciudad o con su código, y el código no se pierde', () => {
    expect(s).toMatch(/\/datos\/repartidor\/lineas\?q=/);
    expect(s).toMatch(/\/datos\/repartidor\/linea\/pedir/);
    expect(s).toMatch(/useBorrador\(\{[\s\S]*?almacen: almacenTelefono/);
  });
  it('el líder acepta o rechaza con un toque y tiene su QR para compartir', () => {
    expect(s).toMatch(/\/datos\/repartidor\/linea\/solicitudes\//);
    expect(s).toMatch(/<CodigoQR/);
    expect(s).toMatch(/titulo: 'Mi línea'/);
    expect(s).toMatch(/titulo: 'My line'/);
  });
});
