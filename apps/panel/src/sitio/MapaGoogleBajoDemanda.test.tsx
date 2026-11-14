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
  avanzadas: [] as { o: Record<string, unknown>; clic?: () => void }[],
  lineas: [] as Record<string, unknown>[],
  circulos: [] as Record<string, unknown>[],
  opciones: null as null | Record<string, unknown>,
  inclinacion: [] as number[],
  rumbos: [] as number[],
  idle: null as null | (() => void),
  encuadres: 0,
  clic: null as null | ((e: { latLng?: { lat(): number; lng(): number } }) => void),
}));

class MapaFalso {
  constructor(_div: unknown, o: Record<string, unknown>) {
    registro.opciones = o;
  }
  setTilt(x: number) {
    registro.inclinacion.push(x);
  }
  setHeading(x: number) {
    registro.rumbos.push(x);
  }
  setCenter() {}
  setZoom() {}
  getZoom() {
    return 15;
  }
  fitBounds() {
    registro.encuadres += 1;
  }
  addListener(evento: string, cb: Clic) {
    if (evento === 'idle') registro.idle = cb as () => void;
    else registro.clic = cb;
    return { remove() {} };
  }
}
class AvanzadaFalsa {
  map: unknown = null;
  registro: { o: Record<string, unknown>; clic?: () => void };
  constructor(o: Record<string, unknown>) {
    this.registro = { o };
    registro.avanzadas.push(this.registro);
  }
  addListener(evento: string, cb: () => void) {
    if (evento === 'gmp-click') this.registro.clic = cb;
    return { remove() {} };
  }
}
class FiguraFalsa {
  constructor(
    private lista: Record<string, unknown>[],
    o: Record<string, unknown>,
  ) {
    lista.push(o);
  }
  setMap() {}
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
  Polyline: class extends FiguraFalsa {
    constructor(o: Record<string, unknown>) {
      super(registro.lineas, o);
    }
  },
  Circle: class extends FiguraFalsa {
    constructor(o: Record<string, unknown>) {
      super(registro.circulos, o);
    }
  },
};
const API_VECTORIAL = { ...API, marker: { AdvancedMarkerElement: AvanzadaFalsa } };

const PUNTOS = [
  { id: 'a', lat: 10.5, lng: -66.9, color: '#101010', etiqueta: 'Restaurante' },
  { id: 'b', lat: 10.51, lng: -66.91, color: '#F20D20', etiqueta: 'Casa' },
];

describe('MapaGoogleBajoDemanda', () => {
  beforeEach(() => {
    registro.marcas = [];
    registro.avanzadas = [];
    registro.lineas = [];
    registro.circulos = [];
    registro.opciones = null;
    registro.inclinacion = [];
    registro.rumbos = [];
    registro.idle = null;
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

  it('con Map ID: mapa vectorial con marcas avanzadas (círculo de color) que responden al toque', async () => {
    (window as { google?: unknown }).google = { maps: API_VECTORIAL };
    const alTocarPunto = vi.fn();
    render(
      <MapaGoogleBajoDemanda
        llave="AIzaSyEjemploDeLlaveDeNavegador_0123"
        mapId="a1b2c3d4e5f6"
        idioma="es"
        centro={{ lat: 10.5, lng: -66.9 }}
        puntos={[{ ...PUNTOS[0]!, texto: '3', alTocar: alTocarPunto }, PUNTOS[1]!]}
        etiqueta="Mapa"
        abierto
      />,
    );
    await waitFor(() => expect(registro.avanzadas).toHaveLength(2));
    expect(registro.marcas).toHaveLength(0);
    expect(registro.opciones).toMatchObject({
      mapId: 'a1b2c3d4e5f6',
      renderingType: 'VECTOR',
      tilt: 0,
    });
    const contenido = registro.avanzadas[0]!.o.content as HTMLElement;
    expect(contenido.style.background).toBe('rgb(16, 16, 16)');
    expect(contenido.textContent).toBe('3');
    registro.avanzadas[0]!.clic?.();
    expect(alTocarPunto).toHaveBeenCalled();
  });

  it('en viaje: se abre solo, se inclina a 45° con el rumbo y dibuja la línea y el área', async () => {
    (window as { google?: unknown }).google = { maps: API_VECTORIAL };
    const vista = (puntos: typeof PUNTOS) => (
      <MapaGoogleBajoDemanda
        llave="AIzaSyEjemploDeLlaveDeNavegador_0123"
        mapId="a1b2c3d4e5f6"
        idioma="en"
        centro={{ lat: 10.5, lng: -66.9 }}
        inclinado
        rumbo={135}
        etiqueta="Trip map"
        abierto
        puntos={puntos}
      />
    );
    const { rerender } = render(
      <MapaGoogleBajoDemanda
        llave="AIzaSyEjemploDeLlaveDeNavegador_0123"
        mapId="a1b2c3d4e5f6"
        idioma="en"
        centro={{ lat: 10.5, lng: -66.9 }}
        puntos={PUNTOS}
        lineas={[{ id: 'orden', puntos: PUNTOS, color: '#8E9198', punteada: true }]}
        circulos={[{ id: 'area', centro: PUNTOS[1]!, metros: 80, color: '#4AA5DC' }]}
        inclinado
        rumbo={135}
        etiqueta="Trip map"
        abierto
      />,
    );
    expect(screen.queryByRole('button', { name: 'See on the map' })).toBeNull();
    await waitFor(() => expect(registro.lineas).toHaveLength(1));
    expect(registro.circulos).toHaveLength(1);
    expect(registro.circulos[0]).toMatchObject({ radius: 80, center: PUNTOS[1] });
    expect(registro.lineas[0]!.path).toEqual(PUNTOS.map((p) => ({ lat: p.lat, lng: p.lng })));
    expect(registro.opciones).toMatchObject({ tilt: 45, heading: 135 });
    // fitBounds deja el mapa plano: al quedar quieto se vuelve a inclinar.
    expect(registro.encuadres).toBe(1);
    registro.idle?.();
    expect(registro.inclinacion.at(-1)).toBe(45);
    expect(registro.rumbos.at(-1)).toBe(135);
    // El repartidor se mueve: la marca se mueve, pero no se vuelve a encuadrar (no aplana el mapa).
    rerender(vista([PUNTOS[0]!, { ...PUNTOS[1]!, lat: 10.52 }]));
    await waitFor(() => expect(registro.avanzadas.length).toBeGreaterThan(2));
    expect(registro.encuadres).toBe(1);
  });
});
