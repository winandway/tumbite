import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Paquete 13 (19 nov 2026, emulador de Android con la Driver 0.1.45) — todos los países.
 *
 * C-MAPA-SIEMPRE-CLARO (segunda vuelta): de cerca, el mapa de Google levantaba los edificios en 3D y
 * oscurecía las manzanas (gris medio 176,178,180 en la captura 12a, ningún color de la paleta).
 * Arreglo: todos los mapas nativos van sin edificios en relieve ni planos interiores
 * (`showsBuildings: false`, `showsIndoors: false`), desde la pieza única `usePropsMapaDivoox`.
 *
 * C-MAPA-VISTA-PREVIA: el mapa pequeño de la oferta (150) y del viaje (200) de Driver, y el del precio
 * del cliente (160), estaba dentro de una hoja que se desplaza: si el dedo caía en el mapa se movía el
 * mapa (no la pantalla), el conductor no llegaba al deslizador y los puntos se salían del cuadro.
 * Como Uber Driver y DoorDash Dasher, el mapa de vista previa no se toca: sin gestos, sin robar el
 * toque (`pointerEvents="none"`) y siempre encuadrado en recogida, destino y conductor. En el viaje,
 * tocarlo abre la navegación. Los mapas grandes de seguimiento del cliente no cambian.
 *
 * Prueba vista en ROJO antes del arreglo: fallaban las seis (ni `showsBuildings`, ni `vistaPrevia`).
 */
const raiz = join(import.meta.dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

describe('C-MAPA-SIEMPRE-CLARO: sin edificios en 3D', () => {
  it('la pieza única apaga los edificios en relieve y los interiores', () => {
    const s = leer('packages/movil/src/mapaDivoox.tsx');
    expect(s).toMatch(/showsBuildings: false/);
    expect(s).toMatch(/showsIndoors: false/);
  });

  // Visto en el emulador (paquete 13) con los edificios ya apagados: el mapa de Google para Android
  // oscurece un 18 % las manzanas de `landscape.man_made` (#E3E6EA salía 186,189,192, la mancha gris
  // medio de las capturas 12a y del viaje). En rojo antes: el estilo nativo no las apagaba.
  it('en el teléfono las manzanas no se pintan (el suelo queda en el gris claro de la paleta)', () => {
    const s = leer('packages/movil/src/mapaDivoox.tsx');
    expect(s).toMatch(
      /featureType: 'landscape\.man_made',\s*elementType: 'geometry',\s*stylers: \[\{ visibility: 'off' \}\]/,
    );
    expect(s).toMatch(/customMapStyle: \[\.\.\.estiloMapaDe\(tema\), \.\.\.SOLO_EN_EL_TELEFONO\]/);
  });
});

describe('C-MAPA-VISTA-PREVIA: el mapa pequeño no se toca', () => {
  for (const archivo of ['apps/repartidor/src/piezas/Mapa.tsx', 'apps/cliente/src/MapaEntrega.tsx'])
    it(`${archivo}: con vistaPrevia, sin gestos, sin robar el toque y sin el acercamiento de llegada`, () => {
      const s = leer(archivo);
      expect(s).toMatch(/vistaPrevia\?: boolean/);
      expect(s).toMatch(/pointerEvents=\{vistaPrevia \? 'none' : 'auto'\}/);
      for (const gesto of [
        'scrollEnabled',
        'zoomEnabled',
        'rotateEnabled',
        'pitchEnabled',
        'zoomTapEnabled',
      ])
        expect(s).toContain(`${gesto}={!vistaPrevia}`);
      // Siempre encuadrado en todos los puntos: la vista de llegada no aplica en la vista previa.
      expect(s).toMatch(/vistaPrevia \? null : /);
    });

  it('la oferta y el viaje de Driver usan la vista previa; el viaje abre la navegación al tocar', () => {
    const o = leer('apps/repartidor/src/viajes/OfertaViaje.tsx');
    expect(o).toMatch(/testID="oferta-viaje-mapa"[\s\S]{0,300}<Mapa[^>]*vistaPrevia/);
    const v = leer('apps/repartidor/src/viajes/ViajeActivo.tsx');
    expect(v).toMatch(/testID="viaje-mapa"[\s\S]{0,400}onPress=\{\(\) => comoLlegar\(/);
    expect(v).toMatch(/<Mapa[^>]*vistaPrevia/);
  });

  it('el precio del cliente usa la vista previa; el seguimiento grande no', () => {
    const p = leer('apps/cliente/src/viajes/PedirMoto.tsx');
    expect(p).toMatch(/testID="moto-precio-mapa"[\s\S]{0,400}vistaPrevia/);
    expect(leer('apps/cliente/src/viajes/ViajeEnCurso.tsx')).not.toMatch(/vistaPrevia/);
    expect(leer('apps/cliente/src/app/order/[id].tsx')).not.toMatch(/vistaPrevia/);
  });

  it('en la web la vista previa del conductor tampoco roba el toque', () => {
    const w = leer('apps/repartidor/src/piezas/Mapa.web.tsx');
    expect(w).toMatch(/vistaPrevia/);
    expect(w).toMatch(/pointerEvents: 'none'/);
  });
});
