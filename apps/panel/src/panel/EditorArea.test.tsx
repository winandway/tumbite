import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { olvidarCargaGoogleMaps } from '@tumbite/compartido/src/mapaWebGoogle';
import type { Poligono } from '@tumbite/compartido';

/**
 * C-MAPA-GOOGLE-WEB en el editor de áreas (C-TERRITORIO), 14 nov 2026 — todos los países. Con la
 * llave del navegador el editor dibuja sobre el mapa de Google (sin la biblioteca Drawing, retirada
 * en mayo de 2026): tocar el mapa agrega una esquina, arrastrar una esquina la mueve y las otras
 * áreas se ven en gris. Sin llave, Leaflet como siempre. API de Google de mentira (sin red).
 */
type EventoMapa = { latLng?: { lat(): number; lng(): number } };
const g = vi.hoisted(() => ({
  clicMapa: null as null | ((e: EventoMapa) => void),
  poligonos: [] as Record<string, unknown>[],
  esquinas: [] as { o: Record<string, unknown>; soltar?: (e: EventoMapa) => void }[],
  leaflet: 0,
}));
vi.mock('leaflet', () => {
  const mapa = {
    setView: () => mapa,
    on: () => mapa,
    remove: () => undefined,
  };
  return {
    map: () => {
      g.leaflet += 1;
      return mapa;
    },
    tileLayer: () => ({ addTo: () => undefined }),
    layerGroup: () => ({ addTo: () => ({ clearLayers: () => undefined }) }),
  };
});
vi.mock('leaflet/dist/leaflet.css', () => ({}));

import { EditorArea } from './EditorArea';

const API = {
  Map: class {
    addListener(evento: string, cb: (e: EventoMapa) => void) {
      if (evento === 'click') g.clicMapa = cb;
      return { remove() {} };
    }
    setCenter() {}
    setZoom() {}
    getZoom() {
      return 11;
    }
    fitBounds() {}
  },
  Marker: class {
    r: { o: Record<string, unknown>; soltar?: (e: EventoMapa) => void };
    constructor(o: Record<string, unknown>) {
      this.r = { o };
      g.esquinas.push(this.r);
    }
    setMap() {}
    addListener(evento: string, cb: (e: EventoMapa) => void) {
      if (evento === 'dragend') this.r.soltar = cb;
      return { remove() {} };
    }
  },
  Polygon: class {
    constructor(o: Record<string, unknown>) {
      g.poligonos.push(o);
    }
    setMap() {}
  },
  LatLngBounds: class {
    extend() {}
  },
  SymbolPath: { CIRCLE: 0 },
};

const LLAVE = 'AIzaSyEjemploDeLlaveDeNavegador_0123';
const ev = (lat: number, lng: number): EventoMapa => ({
  latLng: { lat: () => lat, lng: () => lng },
});

describe('EditorArea: qué mapa se usa y cómo se edita (C-MAPA-GOOGLE-WEB)', () => {
  beforeEach(() => {
    g.clicMapa = null;
    g.poligonos = [];
    g.esquinas = [];
    g.leaflet = 0;
    olvidarCargaGoogleMaps();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as { google?: unknown }).google;
  });

  it('con llave: Google; tocar agrega una esquina, arrastrar la mueve y las otras áreas van en gris', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_WEB_KEY', LLAVE);
    (window as { google?: unknown }).google = { maps: API };
    const cambiar = vi.fn();
    const poligono: Poligono = [
      [-83.5, 42.4],
      [-83.4, 42.4],
      [-83.4, 42.5],
    ];
    render(
      <EditorArea
        centro={{ lat: 42.45, lng: -83.45 }}
        poligono={poligono}
        otras={[
          {
            id: 'x',
            nombre: 'Otra',
            poligono: [
              [-83.6, 42.3],
              [-83.55, 42.3],
              [-83.55, 42.35],
            ],
          },
        ]}
        cambiar={cambiar}
        idioma="es"
      />,
    );
    await waitFor(() => expect(g.esquinas).toHaveLength(3));
    expect(g.leaflet).toBe(0);
    // La otra área en gris y la que se edita en rojo.
    expect(g.poligonos.map((p) => p.strokeColor)).toEqual(['#6b6b6b', '#F20D20']);
    expect(g.poligonos[1]!.paths).toEqual([
      { lat: 42.4, lng: -83.5 },
      { lat: 42.4, lng: -83.4 },
      { lat: 42.5, lng: -83.4 },
    ]);
    expect(g.esquinas[0]!.o.draggable).toBe(true);
    g.clicMapa?.(ev(42.55, -83.45));
    expect(cambiar).toHaveBeenLastCalledWith([...poligono, [-83.45, 42.55]]);
    g.esquinas[1]!.soltar?.(ev(42.41, -83.39));
    expect(cambiar).toHaveBeenLastCalledWith([poligono[0], [-83.39, 42.41], poligono[2]]);
  });

  it('con llave rechazada por Google: lo dice en palabras y deja rastro en la consola', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_WEB_KEY', LLAVE);
    (window as { google?: unknown }).google = { maps: API };
    const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <EditorArea
        centro={{ lat: 42.45, lng: -83.45 }}
        poligono={[]}
        otras={[]}
        cambiar={() => undefined}
        idioma="es"
      />,
    );
    await waitFor(() => expect(g.clicMapa).not.toBeNull());
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure?.();
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos abrir el mapa.');
    expect(consola).toHaveBeenCalled();
    consola.mockRestore();
  });

  it('sin llave: Leaflet como siempre', async () => {
    render(
      <EditorArea
        centro={{ lat: 42.45, lng: -83.45 }}
        poligono={[]}
        otras={[]}
        cambiar={() => undefined}
        idioma="es"
      />,
    );
    await waitFor(() => expect(g.leaflet).toBe(1));
    expect(g.esquinas).toHaveLength(0);
  });
});
