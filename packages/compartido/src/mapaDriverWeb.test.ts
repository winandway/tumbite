import { describe, expect, it } from 'vitest';
import { origenesMapaDriver, origenesMapaRutaFlex } from './mapaDriverWeb';
import { elegirMapaWeb } from './mapaWebGoogle';

/** C-MAPA-GOOGLE-WEB en Divoox Driver: Google solo con puntos de Places y llave; si no, Leaflet. */
const LLAVE = 'AIzaFakeKeyForTests_0123456789';
const p = { lat: 42.48, lng: -83.47 };

describe('C-MAPA-GOOGLE-WEB · mapas web del conductor', () => {
  it('solo el GPS del conductor: Leaflet aunque haya llave', () => {
    expect(elegirMapaWeb({ llave: LLAVE, origenes: origenesMapaDriver({ yo: p }) })).toBe(
      'leaflet',
    );
  });
  it('con el restaurante o la casa (Google Places) y llave: Google; sin llave: Leaflet', () => {
    const o = origenesMapaDriver({ yo: p, casa: p });
    expect(elegirMapaWeb({ llave: LLAVE, origenes: o })).toBe('google');
    expect(elegirMapaWeb({ llave: '', origenes: o })).toBe('leaflet');
    expect(origenesMapaDriver({ marcadores: [p] })).toEqual(['google']);
  });
  it('ruta Flex con paradas: Google con llave; sin paradas, Leaflet', () => {
    expect(
      elegirMapaWeb({ llave: LLAVE, origenes: origenesMapaRutaFlex({ paradas: 3, yo: p }) }),
    ).toBe('google');
    expect(
      elegirMapaWeb({ llave: LLAVE, origenes: origenesMapaRutaFlex({ paradas: 0, yo: p }) }),
    ).toBe('leaflet');
  });
});
