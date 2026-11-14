import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MapaGoogleBajoDemanda,
  olvidarCargaGoogleMaps,
} from '@tumbite/compartido/src/mapaWebGoogle';

/**
 * C-MAPA-GOOGLE-WEB (13 nov 2026) — todos los países. La pieza única del mapa de Google en la web:
 * no carga nada hasta que la persona toca «Ver en el mapa», dibuja los puntos y devuelve el punto
 * tocado. Se prueba con una API de Google de mentira (sin red).
 */
type Clic = (e: { latLng?: { lat(): number; lng(): number } }) => void;
const registro = vi.hoisted(() => ({
  marcas: [] as Record<string, unknown>[],
  encuadres: 0,
  clic: null as null | ((e: { latLng?: { lat(): number; lng(): number } }) => void),
}));

class MapaFalso {
  setCenter() {}
  setZoom() {}
  getZoom() {
    return 15;
  }
  fitBounds() {
    registro.encuadres += 1;
  }
  addListener(_evento: string, cb: Clic) {
    registro.clic = cb;
    return { remove() {} };
  }
}
class MarcaFalsa {
  constructor(o: Record<string, unknown>) {
    registro.marcas.push(o);
  }
  setMap() {}
  addListener() {
    return { remove() {} };
  }
}
const API = {
  Map: MapaFalso,
  Marker: MarcaFalsa,
  LatLngBounds: class {
    extend() {}
  },
  SymbolPath: { CIRCLE: 0 },
};

const PUNTOS = [
  { id: 'a', lat: 10.5, lng: -66.9, color: '#101010', etiqueta: 'Restaurante' },
  { id: 'b', lat: 10.51, lng: -66.91, color: '#F20D20', etiqueta: 'Casa' },
];

describe('MapaGoogleBajoDemanda', () => {
  beforeEach(() => {
    registro.marcas = [];
    registro.encuadres = 0;
    registro.clic = null;
    olvidarCargaGoogleMaps();
  });
  afterEach(() => {
    delete (window as { google?: unknown }).google;
  });

  it('no abre el mapa hasta tocar «See on the map»; luego dibuja los puntos y encuadra', async () => {
    (window as { google?: unknown }).google = { maps: API };
    const alTocar = vi.fn();
    render(
      <MapaGoogleBajoDemanda
        llave="AIzaSyEjemploDeLlaveDeNavegador_0123"
        idioma="en"
        centro={{ lat: 10.5, lng: -66.9 }}
        puntos={PUNTOS}
        etiqueta="Delivery map"
        alTocarMapa={alTocar}
      />,
    );
    expect(screen.queryByTestId('mapa-google')).toBeNull();
    expect(registro.marcas).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'See on the map' }));
    await waitFor(() => expect(registro.marcas).toHaveLength(2));
    expect(registro.encuadres).toBe(1);
    expect(screen.getByRole('application', { name: 'Delivery map' })).toBeInTheDocument();
    registro.clic?.({ latLng: { lat: () => 1, lng: () => 2 } });
    expect(alTocar).toHaveBeenCalledWith({ lat: 1, lng: 2 });
  });

  it('si Google no carga, lo dice en palabras', async () => {
    render(
      <MapaGoogleBajoDemanda
        llave="AIzaSyEjemploDeLlaveDeNavegador_0123"
        idioma="es"
        centro={{ lat: 10.5, lng: -66.9 }}
        puntos={PUNTOS.slice(0, 1)}
        etiqueta="Mapa"
        abierto
      />,
    );
    const script = await waitFor(() => {
      const s = [...document.querySelectorAll('script')].find((x) =>
        x.src.startsWith('https://maps.googleapis.com/'),
      );
      expect(s).toBeDefined();
      return s!;
    });
    script.dispatchEvent(new Event('error'));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos abrir el mapa.');
    script.remove();
  });
});
