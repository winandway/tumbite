import { describe, expect, it } from 'vitest';
import {
  destinoMapaDriver,
  origenesMapaDriver,
  origenesMapaRutaFlex,
  vistaMapaDriver,
} from './mapaDriverWeb';
import { elegirMapaWeb } from './mapaWebGoogle';

/** C-MAPA-GOOGLE-WEB en Divoox Driver (14 nov 2026): con llave, siempre Google; sin llave, Leaflet. */
const LLAVE = 'AIzaFakeKeyForTests_0123456789';
const p = { lat: 42.48, lng: -83.47 };

describe('C-MAPA-GOOGLE-WEB · mapas web del conductor', () => {
  it('solo el GPS del conductor y llave: también Google (14 nov); sin llave, Leaflet', () => {
    expect(elegirMapaWeb({ llave: LLAVE, origenes: origenesMapaDriver({ yo: p }) })).toBe('google');
    expect(elegirMapaWeb({ llave: '', origenes: origenesMapaDriver({ yo: p }) })).toBe('leaflet');
  });
  it('con pedido activo (restaurante o casa) el mapa va inclinado y abierto; sin pedido, plano', () => {
    expect(vistaMapaDriver({ yo: p, restaurante: p })).toBe('viaje');
    expect(vistaMapaDriver({ yo: p, casa: p })).toBe('viaje');
    expect(vistaMapaDriver({ yo: p, marcadores: [p] })).toBe('plano');
    const casa = { lat: 42.5, lng: -83.47 };
    expect(destinoMapaDriver({ restaurante: p, casa })).toBe(casa);
    expect(destinoMapaDriver({ restaurante: p, casa: null })).toBe(p);
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
    ).toBe('google');
  });
});
