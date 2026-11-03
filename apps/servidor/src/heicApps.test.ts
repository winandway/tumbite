import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { selectorDeCapturas } from '../../../packages/movil/src/elegirCapturas';

/**
 * NXT-4y (C-FOTOS-HEIC-LIMPIAS): el servidor no guarda HEIC; las tres apps piden a la galería del
 * iPhone la versión «compatible» (JPEG) de las capturas de los casos de ayuda. Las apps no corren
 * en vitest: el candado mira su código y prueba la pieza común.
 */
const leer = (...r: string[]) => readFileSync(join(__dirname, '..', '..', ...r), 'utf8');

describe('las apps mandan JPEG, no HEIC (NXT-4y)', () => {
  it('el selector pasa el modo compatible a la galería', async () => {
    const pedidos: unknown[] = [];
    const elegir = selectorDeCapturas(async (o) => {
      pedidos.push(o);
      return { canceled: false, assets: [{ uri: 'file://a.jpg' }] };
    }, 'compatible');
    expect(await elegir(3)).toEqual([{ uri: 'file://a.jpg', nombre: 'captura-1.jpg' }]);
    expect(pedidos[0]).toMatchObject({ preferredAssetRepresentationMode: 'compatible' });
  });
  it.each([
    ['cliente', 'src', 'app', 'account.tsx'],
    ['repartidor', 'src', 'Inicio.tsx'],
    ['restaurante', 'src', 'MasPantallas.tsx'],
  ])('%s usa el modo compatible del iPhone', (...ruta) => {
    expect(leer(...ruta)).toMatch(
      /selectorDeCapturas\(\s*ImagePicker\.launchImageLibraryAsync,\s*ImagePicker\.UIImagePickerPreferredAssetRepresentationMode\.Compatible,?\s*\)/,
    );
  });
  it('NXT-4z: TODA apertura de la galería de las tres apps pide el modo compatible, y la cámara entrega JPEG', () => {
    const raiz = join(__dirname, '..', '..', '..');
    const fuentes = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const r = join(dir, n);
        if (statSync(r).isDirectory()) return n === 'node_modules' ? [] : fuentes(r);
        return /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [r] : [];
      });
    let galerias = 0;
    let camaras = 0;
    for (const app of [
      'apps/cliente/src',
      'apps/repartidor/src',
      'apps/restaurante/src',
      'packages/movil/src',
    ])
      for (const f of fuentes(join(raiz, app))) {
        const s = readFileSync(f, 'utf8');
        for (const m of s.matchAll(/launchImageLibraryAsync/g)) {
          if (f.endsWith('elegirCapturas.ts')) continue;
          galerias++;
          const llamada = s.slice(m.index, m.index + 400);
          expect(llamada, `${f}`).toMatch(
            /UIImagePickerPreferredAssetRepresentationMode\.Compatible/,
          );
          // NXT-4w: en Android, con calidad 1 la galería copia el HEIC crudo; menor que 1, JPEG.
          // Las que pasan por selectorDeCapturas toman la calidad de ahí (se mira aparte).
          if (
            !/selectorDeCapturas\(\s*$/.test(
              s.slice(Math.max(0, m.index - 80), m.index).replace(/ImagePicker\.$/, ''),
            )
          )
            expect(llamada, `${f} calidad`).toMatch(/quality: 0\.\d/);
        }
        for (const m of s.matchAll(/launchCameraAsync\(/g)) {
          camaras++;
          // Con calidad menor que 1 la foto de la cámara se guarda como JPEG.
          expect(s.slice(m.index, m.index + 300), `${f}`).toMatch(/quality: 0\.\d/);
        }
      }
    expect(galerias).toBeGreaterThanOrEqual(5);
    const selector = readFileSync(
      join(raiz, 'packages', 'movil', 'src', 'elegirCapturas.ts'),
      'utf8',
    );
    expect(selector).toMatch(/quality: 0\.\d/);
    expect(camaras).toBeGreaterThanOrEqual(5);
  });
});
