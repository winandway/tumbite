import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { olvidarCargaGoogleMaps } from '@tumbite/compartido/src/mapaWebGoogle';

/**
 * C-MAPA-GOOGLE-WEB (13 nov 2026) — todos los países. En el punto de entrega de Divoox Flex, si la
 * búsqueda de direcciones de Google está encendida y existe la llave del navegador, el mapa es el
 * de Google y se carga solo al tocar «Ver en el mapa». Sin llave, Leaflet como siempre.
 */
const leaflet = vi.hoisted(() => ({ creados: 0 }));
vi.mock('leaflet', () => {
  const mapa = { setView: () => mapa, on: () => mapa, remove: () => undefined };
  return {
    map: () => {
      leaflet.creados += 1;
      return mapa;
    },
    tileLayer: () => ({ addTo: () => undefined }),
    circleMarker: () => ({ bindTooltip: () => ({ addTo: () => undefined }) }),
  };
});
vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('../panel/api', () => ({
  api: { pedir: vi.fn(async () => ({ busqueda: true })) },
}));

import { ElegirPunto } from './ElegirPunto';

const LLAVE = 'AIzaSyEjemploDeLlaveDeNavegador_0123';

function scriptsDeGoogle() {
  return [...document.querySelectorAll('script')].filter((s) =>
    s.src.startsWith('https://maps.googleapis.com/'),
  );
}

describe('ElegirPunto: qué mapa se usa (C-MAPA-GOOGLE-WEB)', () => {
  beforeEach(() => {
    leaflet.creados = 0;
    olvidarCargaGoogleMaps();
    for (const s of scriptsDeGoogle()) s.remove();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('con la llave y la búsqueda de Google: botón «Ver en el mapa» y Google se carga al tocarlo', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_WEB_KEY', LLAVE);
    render(
      <ElegirPunto
        punto={null}
        cambiar={() => undefined}
        centro={{ lat: 10.5, lng: -66.9 }}
        pais="VE"
        idioma="es"
      />,
    );
    const boton = await screen.findByRole('button', { name: 'Ver en el mapa' });
    expect(scriptsDeGoogle()).toHaveLength(0);
    await userEvent.click(boton);
    await waitFor(() => expect(scriptsDeGoogle()).toHaveLength(1));
    expect(scriptsDeGoogle()[0]?.src).toContain('loading=async');
    expect(leaflet.creados).toBe(0);
  });

  it('sin la llave: Leaflet como hoy, sin botón y sin cargar Google', async () => {
    render(
      <ElegirPunto
        punto={null}
        cambiar={() => undefined}
        centro={{ lat: 10.5, lng: -66.9 }}
        pais="VE"
        idioma="es"
      />,
    );
    await waitFor(() => expect(leaflet.creados).toBe(1));
    expect(screen.queryByRole('button', { name: 'Ver en el mapa' })).toBeNull();
    expect(scriptsDeGoogle()).toHaveLength(0);
  });
});
