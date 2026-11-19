import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-MARCADOR-ANDROID (18 nov 2026, todos los países). En Android (mapa de Google) un marcador con
 * vista propia se convierte en una FOTO de esa vista. Con `tracksViewChanges={false}` desde el primer
 * cuadro, la foto se toma antes de que se dibujen el texto o la imagen: el rótulo salía como una
 * píldora negra vacía y el isotipo del conductor como un círculo blanco (visto en el robot del 18 nov).
 * En iPhone (mapa de Apple) la vista se dibuja en vivo y se veía bien. Arreglo: la pieza
 * `useCapturaMarcador` deja la foto «viva» hasta que el texto se acomodó y la imagen cargó, y después
 * la congela (no repinta cada segundo).
 */
const raiz = join(import.meta.dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');
const MAPAS = [
  'apps/cliente/src/MapaEntrega.tsx',
  'apps/repartidor/src/piezas/Mapa.tsx',
  'apps/repartidor/src/flex/MapaRuta.tsx',
];

/** Los marcadores con vista propia (los que tienen hijos) de un archivo. */
function marcadoresConVista(s: string): string[] {
  return [...s.matchAll(/<Marker\b[^>]*?>[\s\S]*?<\/Marker>/g)].map((m) => m[0]);
}

describe('C-MARCADOR-ANDROID: ningún marcador con vista propia se congela antes de dibujarse', () => {
  for (const archivo of MAPAS)
    it(archivo, () => {
      const s = leer(archivo);
      const lista = marcadoresConVista(s);
      expect(lista.length).toBeGreaterThan(0);
      for (const m of lista) {
        expect(m).not.toMatch(/tracksViewChanges=\{false\}/);
        expect(m).toMatch(/tracksViewChanges=\{vista\.seguir\}/);
      }
      expect(s).toMatch(/useCapturaMarcador\(/);
    });

  it('el isotipo avisa cuando su imagen cargó (y entonces se vuelve a tomar la foto)', () => {
    const s = leer('packages/movil/src/mapaDivoox.tsx');
    expect(s).toMatch(/onLoad=\{alCargar\}/);
    for (const archivo of [
      'apps/cliente/src/MapaEntrega.tsx',
      'apps/repartidor/src/piezas/Mapa.tsx',
    ])
      expect(leer(archivo)).toMatch(/<MarcaIsotipo[^>]*alCargar=\{vista\.listo\}/);
  });
});
