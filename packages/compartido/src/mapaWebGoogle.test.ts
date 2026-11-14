import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  TOPE_CARGAS_MAPA_DIA,
  cargarGoogleMaps,
  elegirMapaWeb,
  mapIdValido,
  olvidarCargaGoogleMaps,
  opcionesMapaGoogle,
  rumboEntre,
  svgMarcaIsotipo,
  urlMarcaIsotipo,
} from './mapaWebGoogle';
import { ESTILO_MAPA_DIA, ESTILO_MAPA_NOCHE } from './estiloMapaDivoox';
import { ISOTIPO_DIVOOX_SVG } from './isotipoDivoox.generado';

/**
 * C-MAPA-GOOGLE-WEB (13 nov 2026; 14 nov 2026: todos los mapas de la web en Google, decisión de
 * Richard) — todos los países. Con la llave del navegador el mapa es SIEMPRE el de Google, venga de
 * donde venga el punto (Places, GPS o propio). Sin llave, Leaflet como siempre.
 */
const LLAVE = 'AIzaSyEjemploDeLlaveDeNavegador_0123';

describe('elegirMapaWeb', () => {
  it('un punto de Google Places con llave va en el mapa de Google', () => {
    expect(elegirMapaWeb({ llave: LLAVE, origenes: ['google'] })).toBe('google');
    expect(elegirMapaWeb({ llave: LLAVE, origenes: ['gps', 'google'] })).toBe('google');
  });
  it('con llave, también el GPS del repartidor y los puntos propios van en Google (14 nov)', () => {
    expect(elegirMapaWeb({ llave: LLAVE, origenes: ['gps'] })).toBe('google');
    expect(elegirMapaWeb({ llave: LLAVE, origenes: ['propio', 'gps'] })).toBe('google');
    expect(elegirMapaWeb({ llave: LLAVE, origenes: [] })).toBe('google');
    expect(elegirMapaWeb({ llave: LLAVE })).toBe('google');
  });
  it('sin llave (o con una llave vacía o rota) sigue Leaflet como hoy', () => {
    for (const llave of [undefined, null, '', '   ', 'corta', 'con espacios dentro de la llave'])
      expect(elegirMapaWeb({ llave, origenes: ['google'] })).toBe('leaflet');
  });
  it('el tope de cargas al día es 320 (31 días × 320 = 9.920, dentro de las 10.000 gratis)', () => {
    expect(TOPE_CARGAS_MAPA_DIA).toBe(320);
    expect(TOPE_CARGAS_MAPA_DIA * 31).toBeLessThanOrEqual(10_000);
  });
});

describe('opcionesMapaGoogle (mapa vectorial con el estilo de Divoox)', () => {
  const centro = { lat: 42.48, lng: -83.47 };
  it('con Map ID: vectorial, inclinado 45° y con rumbo solo en viaje; sin `styles`', () => {
    const o = opcionesMapaGoogle({
      centro,
      zoom: 15,
      mapId: 'a1b2c3d4e5f6',
      inclinado: true,
      rumbo: 90,
    });
    expect(o.mapId).toBe('a1b2c3d4e5f6');
    expect(o.renderingType).toBe('VECTOR');
    expect(o.tilt).toBe(45);
    expect(o.heading).toBe(90);
    expect(o.styles).toBeUndefined();
    const plano = opcionesMapaGoogle({ centro, zoom: 15, mapId: 'a1b2c3d4e5f6' });
    expect(plano.tilt).toBe(0);
    expect(plano.heading).toBe(0);
  });
  it('sin Map ID: mapa de Google normal con el estilo de Divoox en `styles`, sin inclinar', () => {
    const o = opcionesMapaGoogle({ centro, zoom: 15, mapId: '', inclinado: true, rumbo: 90 });
    expect(o.mapId).toBeUndefined();
    expect(o.renderingType).toBeUndefined();
    expect(o.tilt).toBeUndefined();
    expect(o.styles).toBe(ESTILO_MAPA_DIA);
    expect(o.colorScheme).toBeUndefined();
    expect(opcionesMapaGoogle({ centro, zoom: 15, tema: 'noche' }).styles).toBe(ESTILO_MAPA_NOCHE);
    expect(o.clickableIcons).toBe(false);
  });
  it('el Map ID se valida (vacío, con espacios o raro = sin Map ID)', () => {
    expect(mapIdValido('a1b2c3d4e5f6')).toBe(true);
    for (const x of [undefined, null, '', '  ', 'a b', '<x>']) expect(mapIdValido(x)).toBe(false);
  });
  it('C-MAPA-DIA-NOCHE: con Map ID se pide a Google el esquema claro u oscuro; el estilo vive en la consola', () => {
    const dia = opcionesMapaGoogle({ centro, zoom: 15, mapId: 'a1b2c3d4e5f6' });
    const noche = opcionesMapaGoogle({ centro, zoom: 15, mapId: 'a1b2c3d4e5f6', tema: 'noche' });
    expect(dia.colorScheme).toBe('LIGHT');
    expect(noche.colorScheme).toBe('DARK');
    expect(noche.styles).toBeUndefined();
    expect(noche.backgroundColor).toBe('#1C1F24');
  });
});

describe('C-MAPA-ISOTIPO: la marca del repartidor o conductor', () => {
  it('el isotipo del código es el vector aprobado de identidad-divoox, tal cual', () => {
    const ruta = fileURLToPath(
      new URL(
        '../../../identidad-divoox/Divoox_Vectoriales/05_Isotipo_GPS_Fondo_Claro.svg',
        import.meta.url,
      ),
    );
    expect(ISOTIPO_DIVOOX_SVG).toBe(readFileSync(ruta, 'utf8').trim());
  });
  it('va entero y sin deformar dentro de un disco blanco, que se lee de día y de noche', () => {
    const svg = svgMarcaIsotipo();
    // Los trazos del vector, sin tocar.
    const trazos = ISOTIPO_DIVOOX_SVG.match(/ d="[^"]+"/g) ?? [];
    expect(trazos.length).toBeGreaterThan(0);
    for (const t of trazos) expect(svg).toContain(t);
    expect(svg).toContain('viewBox="245 50 970 925"');
    // Encajado en un cuadro (el vector conserva su proporción: no se estira).
    expect(svg).toContain('width="26" height="26"');
    expect(svg).not.toMatch(/preserveAspectRatio="none"/);
    expect(svg).toContain('<circle cx="22" cy="22" r="20" fill="#FFFFFF"');
    expect(svgMarcaIsotipo(true)).toContain('opacity="0.55"');
    expect(decodeURIComponent(urlMarcaIsotipo())).toContain(svg);
  });
});

describe('rumboEntre', () => {
  it('norte 0°, este 90°, sur 180°, oeste 270°', () => {
    const a = { lat: 10, lng: -66 };
    expect(rumboEntre(a, { lat: 10.01, lng: -66 })).toBeCloseTo(0, 0);
    expect(rumboEntre(a, { lat: 10, lng: -65.99 })).toBeCloseTo(90, 0);
    expect(rumboEntre(a, { lat: 9.99, lng: -66 })).toBeCloseTo(180, 0);
    expect(rumboEntre(a, { lat: 10, lng: -66.01 })).toBeCloseTo(270, 0);
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
    expect(url.searchParams.get('libraries')).toBe('marker');
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

  it('con carga dinámica pide las bibliotecas con importLibrary (maps, marker y core)', async () => {
    const { doc, ventana, scripts } = documentoFalso();
    const pedidas: string[] = [];
    class MapaNuevo {}
    class Avanzada {}
    const libs: Record<string, Record<string, unknown>> = {
      core: { LatLngBounds: class {}, SymbolPath: { CIRCLE: 0 } },
      maps: { Map: MapaNuevo, Polyline: class {}, Circle: class {}, Polygon: class {} },
      marker: { AdvancedMarkerElement: Avanzada, Marker: class {} },
    };
    const a = cargarGoogleMaps(LLAVE, 'en', doc);
    ventana.google = {
      maps: {
        importLibrary: async (n: string) => {
          pedidas.push(n);
          return libs[n];
        },
      },
    };
    const url = new URL(scripts[0]!.src);
    (ventana[url.searchParams.get('callback')!] as () => void)();
    const api = await a;
    expect(pedidas.sort()).toEqual(['core', 'maps', 'marker']);
    expect(api.Map).toBe(MapaNuevo);
    expect(api.marker?.AdvancedMarkerElement).toBe(Avanzada);
    expect(api.Polygon).toBe(libs.maps!.Polygon);
    expect(api.LatLngBounds).toBe(libs.core!.LatLngBounds);
  });

  it('si Google Maps ya está en la página, no agrega otro script', async () => {
    const { doc, ventana, scripts } = documentoFalso();
    const api = { Map: class {} };
    ventana.google = { maps: api };
    await expect(cargarGoogleMaps(LLAVE, 'en', doc)).resolves.toBe(api);
    expect(scripts).toHaveLength(0);
  });
});
