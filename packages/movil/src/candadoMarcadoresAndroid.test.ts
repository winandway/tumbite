import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MOMENTOS_REDIBUJO, crearRedibujador } from './redibujarMarcadores';

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

/**
 * Segunda vuelta (19 nov 2026, paquete 13, emulador de Android con la Driver 0.1.45): en la oferta y
 * en el viaje el conductor seguía saliendo como un círculo blanco vacío. Causa (react-native-maps
 * 1.27.2): el seguidor de `tracksViewChanges` toma una sola foto tras la primera medida y se apaga;
 * la imagen del isotipo carga después y nadie repinta. Solo `redraw()` vuelve a pintar. Prueba vista
 * en ROJO antes del arreglo: fallaban «cada marcador con vista propia se registra…» (ningún
 * `ref={marcador}`), «el mapa avisa al terminar de cargar» y «la imagen no se funde».
 */
describe('C-MARCADOR-ANDROID (segunda vuelta): se repinta con redraw()', () => {
  for (const archivo of MAPAS)
    it(`${archivo}: cada marcador con vista propia se registra para repintarse`, () => {
      const s = leer(archivo);
      for (const m of marcadoresConVista(s)) expect(m).toMatch(/ref=\{marcador\}/);
    });

  for (const archivo of MAPAS)
    it(`${archivo}: el mapa avisa al terminar de cargar (y se repinta)`, () => {
      expect(leer(archivo)).toMatch(/onMapReady=\{\(\) => \{[^}]*vista\.listo\(\)/);
    });

  it('la pieza llama a redraw() y la imagen no se funde (Android funde 300 ms por defecto)', () => {
    const s = leer('packages/movil/src/mapaDivoox.tsx');
    expect(s).toMatch(/crearRedibujador\(/);
    expect(s).toMatch(/marcador: /);
    expect(s).toMatch(/fadeDuration=\{0\}/);
  });

  it('el redibujador pinta todos los marcadores en cada momento y suelta los que se van', () => {
    const relojes: { f: () => void; ms: number }[] = [];
    const r = crearRedibujador({
      poner: (f, ms) => relojes.push({ f, ms }),
      quitar: () => undefined,
    });
    let a = 0;
    let b = 0;
    const soltarA = r.registrar({ redraw: () => (a += 1) });
    r.registrar({ redraw: () => (b += 1) });
    r.programar();
    expect(relojes.map((x) => x.ms)).toEqual([...MOMENTOS_REDIBUJO]);
    for (const x of relojes) x.f();
    expect([a, b]).toEqual([MOMENTOS_REDIBUJO.length, MOMENTOS_REDIBUJO.length]);
    soltarA?.();
    relojes.length = 0;
    r.programar();
    for (const x of relojes) x.f();
    expect([a, b]).toEqual([MOMENTOS_REDIBUJO.length, MOMENTOS_REDIBUJO.length * 2]);
    expect(r.cuantos()).toBe(1);
  });
});
