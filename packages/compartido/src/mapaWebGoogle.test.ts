import { beforeEach, describe, expect, it } from 'vitest';
import {
  TOPE_CARGAS_MAPA_DIA,
  cargarGoogleMaps,
  elegirMapaWeb,
  olvidarCargaGoogleMaps,
} from './mapaWebGoogle';

/**
 * C-MAPA-GOOGLE-WEB (13 nov 2026) — todos los países. Lo que viene de Google Places solo se dibuja
 * sobre el mapa de Google; lo que no (GPS, puntos propios) sigue en Leaflet. Sin llave, Leaflet.
 */
const LLAVE = 'AIzaSyEjemploDeLlaveDeNavegador_0123';

describe('elegirMapaWeb', () => {
  it('un punto de Google Places con llave va en el mapa de Google', () => {
    expect(elegirMapaWeb({ llave: LLAVE, origenes: ['google'] })).toBe('google');
    expect(elegirMapaWeb({ llave: LLAVE, origenes: ['gps', 'google'] })).toBe('google');
  });
  it('sin ningún punto de Google (GPS del repartidor, puntos propios) sigue Leaflet', () => {
    expect(elegirMapaWeb({ llave: LLAVE, origenes: ['gps'] })).toBe('leaflet');
    expect(elegirMapaWeb({ llave: LLAVE, origenes: ['propio', 'gps'] })).toBe('leaflet');
    expect(elegirMapaWeb({ llave: LLAVE, origenes: [] })).toBe('leaflet');
  });
  it('sin llave (o con una llave vacía o rota) sigue Leaflet como hoy', () => {
    for (const llave of [undefined, null, '', '   ', 'corta', 'con espacios dentro de la llave'])
      expect(elegirMapaWeb({ llave, origenes: ['google'] })).toBe('leaflet');
  });
  it('el tope de cargas al día es 300', () => {
    expect(TOPE_CARGAS_MAPA_DIA).toBe(300);
  });
});

/** Un documento de mentira: guarda los scripts que se agregan. */
function documentoFalso() {
  const ventana: Record<string, unknown> = {};
  const scripts: { src: string; onerror?: () => void }[] = [];
  const doc = {
    defaultView: ventana,
    createElement: () => {
      const s: { src: string; async: boolean; onerror?: () => void } = { src: '', async: false };
      scripts.push(s);
      return s;
    },
    head: { appendChild: () => undefined },
  } as unknown as Document;
  return { doc, ventana, scripts };
}

describe('cargarGoogleMaps', () => {
  beforeEach(() => olvidarCargaGoogleMaps());

  it('agrega el script una sola vez, con carga dinámica, y resuelve con la API', async () => {
    const { doc, ventana, scripts } = documentoFalso();
    const a = cargarGoogleMaps(LLAVE, 'es', doc);
    const b = cargarGoogleMaps(LLAVE, 'es', doc);
    expect(scripts).toHaveLength(1);
    const url = new URL(scripts[0]!.src);
    expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/js');
    expect(url.searchParams.get('key')).toBe(LLAVE);
    expect(url.searchParams.get('loading')).toBe('async');
    expect(url.searchParams.get('language')).toBe('es');
    const api = { Map: class {} };
    ventana.google = { maps: api };
    (ventana[url.searchParams.get('callback')!] as () => void)();
    await expect(a).resolves.toBe(api);
    expect(b).toBe(a);
  });

  it('si el script falla, rechaza y la próxima vez lo vuelve a intentar', async () => {
    const { doc, scripts } = documentoFalso();
    const a = cargarGoogleMaps(LLAVE, 'en', doc);
    scripts[0]!.onerror?.();
    await expect(a).rejects.toThrow();
    void cargarGoogleMaps(LLAVE, 'en', doc).catch(() => undefined);
    expect(scripts).toHaveLength(2);
  });

  it('si Google Maps ya está en la página, no agrega otro script', async () => {
    const { doc, ventana, scripts } = documentoFalso();
    const api = { Map: class {} };
    ventana.google = { maps: api };
    await expect(cargarGoogleMaps(LLAVE, 'en', doc)).resolves.toBe(api);
    expect(scripts).toHaveLength(0);
  });
});
