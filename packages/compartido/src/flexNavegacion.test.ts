import { describe, expect, it } from 'vitest';
import { enlaceRutaGoogle } from './flexNavegacion';

/** C-FLEX-NAVEGAR-RUTA: el enlace de Google Maps con las próximas paradas en orden. */
const p = (i: number) => ({ lat: 42.48 + i / 1000, lng: -83.47 });

describe('C-FLEX-NAVEGAR-RUTA · enlace multiparada de Google Maps', () => {
  it('lleva las próximas paradas en orden: las primeras como intermedias, la última como destino', () => {
    const r = enlaceRutaGoogle([p(1), p(2), p(3)])!;
    const u = new URL(r.url);
    expect(u.origin + u.pathname).toBe('https://www.google.com/maps/dir/');
    expect(u.searchParams.get('api')).toBe('1');
    expect(u.searchParams.get('travelmode')).toBe('driving');
    expect(u.searchParams.get('destination')).toBe('42.483,-83.47');
    expect(u.searchParams.get('waypoints')).toBe('42.481,-83.47|42.482,-83.47');
    expect(u.searchParams.has('origin')).toBe(false);
    expect(r).toMatchObject({ paradas: 3, quedan: 0 });
  });

  it('como mucho 9 intermedias + el destino; el resto queda para el siguiente tramo', () => {
    const r = enlaceRutaGoogle(Array.from({ length: 14 }, (_, i) => p(i + 1)))!;
    const u = new URL(r.url);
    expect(u.searchParams.get('waypoints')!.split('|')).toHaveLength(9);
    expect(u.searchParams.get('destination')).toBe('42.49,-83.47');
    expect(r).toMatchObject({ paradas: 10, quedan: 4 });
  });

  it('una sola parada no lleva intermedias; sin coordenadas usa la dirección; vacío, null', () => {
    const u = new URL(
      enlaceRutaGoogle([{ lat: null, lng: null, direccion: 'Av. 15, El Vigía' }])!.url,
    );
    expect(u.searchParams.get('destination')).toBe('Av. 15, El Vigía');
    expect(u.searchParams.has('waypoints')).toBe(false);
    expect(enlaceRutaGoogle([])).toBeNull();
    expect(enlaceRutaGoogle([{ lat: null, lng: null, direccion: ' ' }])).toBeNull();
  });
});
