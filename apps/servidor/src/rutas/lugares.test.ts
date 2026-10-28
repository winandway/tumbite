import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';

const SESION = 'sesion-prueba-1';

/** Búsqueda de direcciones por el servidor (Google Places): apagada sin llave, la llave nunca sale. */
describe('búsqueda de direcciones (C-FLEX-UBICACION)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sin la llave está apagada y pide marcar el pin', async () => {
    const m = mundo();
    expect((await m.llamar('GET', '/datos/lugares/estado')).datos).toEqual({ busqueda: false });
    const r = await m.llamar('GET', '/datos/lugares/sugerencias?q=Chacao&pais=VE');
    expect(r.estado).toBe(503);
  });

  it('con la llave sugiere direcciones de ese país y da el punto exacto, sin mostrar la llave', async () => {
    const llave = 'llave-de-prueba-de-google-places-123';
    const m = mundo({ GOOGLE_PLACES_KEY: llave });
    const original = globalThis.fetch;
    const llamadas: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal('fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (!u.includes('googleapis.com')) return original(url, init);
      llamadas.push({ url: u, init });
      if (u.includes(':autocomplete'))
        return Response.json({
          suggestions: [
            { placePrediction: { placeId: 'ChIJ_prueba_123', text: { text: 'Chacao, Caracas' } } },
          ],
        });
      return Response.json({
        location: { latitude: 10.49, longitude: -66.85 },
        formattedAddress: 'Chacao, Caracas, Venezuela',
      });
    });
    const s = await m.llamar('GET', `/datos/lugares/sugerencias?q=Chacao&pais=VE&sesion=${SESION}`);
    expect(s.datos).toEqual({ sugerencias: [{ id: 'ChIJ_prueba_123', texto: 'Chacao, Caracas' }] });
    expect(JSON.parse(String(llamadas[0]?.init?.body))).toMatchObject({
      includedRegionCodes: ['ve'],
      sessionToken: SESION,
    });
    const p = await m.llamar('GET', '/datos/lugares/punto/ChIJ_prueba_123');
    expect(p.datos).toEqual({
      punto: { lat: 10.49, lng: -66.85 },
      direccion: 'Chacao, Caracas, Venezuela',
    });
    expect(JSON.stringify(s.datos) + JSON.stringify(p.datos)).not.toContain(llave);
  });

  it('C-DIRECCION-SUGERENCIAS: sin país en la pantalla usa el de la conexión, y sin él no limita', async () => {
    const m = mundo({ GOOGLE_PLACES_KEY: 'llave-de-prueba-de-google-places-123' });
    const original = globalThis.fetch;
    const cuerpos: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
      if (!String(url).includes('googleapis.com')) return original(url, init);
      cuerpos.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return Response.json({ suggestions: [] });
    });
    await m.llamar('GET', '/datos/lugares/sugerencias?q=30080%20Montmor', undefined, undefined, {
      'cf-ipcountry': 'US',
    });
    await m.llamar('GET', '/datos/lugares/sugerencias?q=Chacao&pais=ve');
    await m.llamar('GET', '/datos/lugares/sugerencias?q=Chacao');
    expect(cuerpos[0]).toMatchObject({ includedRegionCodes: ['us'] });
    expect(cuerpos[1]).toMatchObject({ includedRegionCodes: ['ve'] });
    expect(cuerpos[2]?.includedRegionCodes).toBeUndefined();
  });
});
