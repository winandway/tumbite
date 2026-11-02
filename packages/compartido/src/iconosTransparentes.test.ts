import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

/**
 * C-ICONOS-TRANSPARENTES (2 nov 2026): la barra de abajo de la app del cliente pinta sus íconos con
 * `tintColor`. Los PNG tenían fondo blanco, así que se pintaba el cuadro entero: en la web y en el
 * iPhone salían cuadros grises en vez de íconos. Un ícono que se pinta necesita fondo transparente.
 */
const raiz = join(__dirname, '..', '..', '..');
// pngjs llega con qrcode (dependencia de las apps); sin tipos propios, se declara lo que se usa.
const { PNG } = createRequire(import.meta.url)('pngjs') as {
  PNG: { sync: { read: (b: Buffer) => { width: number; height: number; data: Buffer } } };
};

describe('los íconos que se pintan tienen fondo transparente', () => {
  it('barras de abajo y botones pintados de las apps', () => {
    const archivos = [
      ...['inicio', 'pedidos', 'favoritos', 'cuenta'].map(
        (n) => `apps/cliente/assets/inicio/nav-${n}.png`,
      ),
      'apps/cliente/assets/inicio/icono-corazon.png',
      ...['inicio', 'pedidos', 'menu', 'estadisticas', 'mas'].map(
        (n) => `apps/restaurante/assets/rest/nav-${n}.png`,
      ),
      'apps/restaurante/assets/rest/icono-camara.png',
    ];
    for (const n of archivos) {
      const png = PNG.sync.read(readFileSync(join(raiz, n)));
      const alfa = (x: number, y: number) => png.data[(png.width * y + x) * 4 + 3];
      const esquinas = [
        alfa(0, 0),
        alfa(png.width - 1, 0),
        alfa(0, png.height - 1),
        alfa(png.width - 1, png.height - 1),
      ];
      expect(esquinas, n).toEqual([0, 0, 0, 0]);
    }
  });
});
