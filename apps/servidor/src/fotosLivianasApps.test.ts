import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { subirFotoLivianaApp } from '../../../packages/movil/src/fotoLiviana';

/**
 * NXT-7 · C-FOTOS-LIVIANAS: en el teléfono la foto del plato se convierte a WebP en tres tamaños
 * (completa 1400, tarjeta 640, miniatura 200) antes de subir, sin servicios de pago. Las apps no
 * corren en vitest: se prueba la pieza común con un convertidor de mentira y se mira el código.
 */
const leer = (...r: string[]) => readFileSync(join(__dirname, '..', '..', ...r), 'utf8');

describe('fotos livianas en la app del restaurante (NXT-7)', () => {
  it('convierte y sube la completa, la tarjeta y la miniatura con su calidad', async () => {
    const pedidos: { lado: number; compress: number; format: string }[] = [];
    const rutas: string[] = [];
    const url = await subirFotoLivianaApp(
      async (_b, ruta) => {
        rutas.push(ruta ?? '');
        return { url: '/media/fotos/r1/abc-1.webp' };
      },
      { uri: 'file://foto.jpg', width: 4032, height: 3024 },
      async (_uri, acciones, op) => {
        const r = acciones[0]!.resize;
        pedidos.push({
          lado: Math.max(r.width, r.height),
          compress: op.compress,
          format: op.format,
        });
        return { uri: `file://${r.width}.webp` };
      },
      'webp',
      undefined,
      async () => new Blob([new Uint8Array(4)], { type: 'image/webp' }),
    );
    expect(url).toBe('/media/fotos/r1/abc-1.webp');
    expect(pedidos).toEqual([
      { lado: 1400, compress: 0.82, format: 'webp' },
      { lado: 640, compress: 0.78, format: 'webp' },
      { lado: 200, compress: 0.7, format: 'webp' },
    ]);
    expect(rutas).toEqual([
      '/datos/mi-restaurante/fotos',
      '/datos/mi-restaurante/fotos?de=abc-1&tam=tarjeta',
      '/datos/mi-restaurante/fotos?de=abc-1&tam=miniatura',
    ]);
  });

  it('si un tamaño chico falla, la foto queda igual (el servidor entrega la completa)', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let n = 0;
    const url = await subirFotoLivianaApp(
      async () => {
        if (n++ === 1) throw new Error('sin señal');
        return { url: '/media/fotos/r1/abc-2.webp' };
      },
      { uri: 'file://foto.jpg', width: 800, height: 600 },
      async () => ({ uri: 'file://x.webp' }),
      'webp',
      undefined,
      async () => new Blob([new Uint8Array(4)]),
    );
    expect(url).toBe('/media/fotos/r1/abc-2.webp');
    expect(n).toBe(3);
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });

  it('la app del restaurante usa la pieza con WebP y tiene el convertidor instalado', () => {
    expect(leer('restaurante', 'src', 'MiMenu.tsx')).toMatch(
      /subirFotoLivianaApp\(\s*api\.subirFoto,\s*foto,\s*manipulateAsync,\s*SaveFormat\.WEBP,?\s*\)/,
    );
    expect(leer('restaurante', 'package.json')).toMatch(/"expo-image-manipulator"/);
  });

  it.each([
    [['cliente', 'src', 'inicio', 'Restaurantes.tsx'], /urlFoto\(r\.imagen, 'tarjeta'\)/],
    [['cliente', 'src', 'app', 'restaurants.tsx'], /urlFoto\(r\.imagen, 'tarjeta'\)/],
    [['cliente', 'src', 'app', 'cart.tsx'], /urlFoto\(l\.imagen, 'miniatura'\)/],
    [['cliente', 'src', 'app', 'restaurant', '[id].tsx'], /urlFoto\(p\.imagen, 'miniatura'\)/],
    [['restaurante', 'src', 'MiMenu.tsx'], /urlFoto\(p\.imagen, 'miniatura'\)/],
  ])('%s pide el tamaño que toca', (ruta, patron) => {
    expect(leer(...ruta)).toMatch(patron);
  });
  it('urlFoto arma la ruta del tamaño', () => {
    const s = leer('..', 'packages', 'movil', 'src', 'sesion.tsx');
    expect(s).toMatch(/\$\{URL_SERVIDOR\}\$\{rutaFotoTamano\(ruta, tam\)\}/);
  });
});
