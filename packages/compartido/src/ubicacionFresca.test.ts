import { describe, expect, it } from 'vitest';
import { posicionFrescaWeb } from './ubicacionFresca';

describe('C-FLEX-UBICACION-FRESCA · en la web se pide una posición nueva', () => {
  it('pide maximumAge 0 (nunca la posición vieja del navegador) y devuelve la nueva', async () => {
    const pedidas: { maximumAge: number }[] = [];
    const geo = {
      getCurrentPosition: (
        ok: (p: { coords: { latitude: number; longitude: number } }) => void,
        _mal: (e: unknown) => void,
        op: { enableHighAccuracy: boolean; maximumAge: number; timeout: number },
      ) => {
        pedidas.push(op);
        ok({ coords: { latitude: 42.5373, longitude: -83.4583 } });
      },
    };
    expect(await posicionFrescaWeb(geo)).toEqual({ lat: 42.5373, lng: -83.4583 });
    expect(pedidas[0]?.maximumAge).toBe(0);
  });
  it('sin permiso o sin GPS devuelve null (la app avisa; no inventa la posición)', async () => {
    const geo = {
      getCurrentPosition: (_ok: unknown, mal: (e: unknown) => void) => mal(new Error('denegado')),
    };
    expect(await posicionFrescaWeb(geo as never)).toBeNull();
    expect(await posicionFrescaWeb(undefined)).toBeNull();
  });
});
