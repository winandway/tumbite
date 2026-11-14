import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MapaGoogleBajoDemanda,
  olvidarCargaGoogleMaps,
} from '@tumbite/compartido/src/mapaWebGoogle';
import { ESTILO_MAPA_DIA, ESTILO_MAPA_NOCHE } from '@tumbite/compartido/src/estiloMapaDivoox';
import {
  LLAVE_AJUSTE_TEMA_MAPA,
  cambiarAjusteTemaMapa,
  olvidarAjusteTemaMapa,
} from '@tumbite/compartido/src/temaMapa';

/**
 * C-MAPA-GOOGLE-WEB (13 nov 2026) — todos los países. La pieza única del mapa de Google en la web:
 * no carga nada hasta que la persona toca «Ver en el mapa», dibuja los puntos y devuelve el punto
 * tocado. Se prueba con una API de Google de mentira (sin red).
 */
type Clic = (e: { latLng?: { lat(): number; lng(): number } }) => void;
const registro = vi.hoisted(() => ({
  marcas: [] as Record<string, unknown>[],
  avanzadas: [] as {
    o: Record<string, unknown>;
    clic?: () => void;
    yo: { position: unknown; map: unknown };
  }[],
  mapas: 0,
  lineas: [] as Record<string, unknown>[],
  circulos: [] as Record<string, unknown>[],
  opciones: null as null | Record<string, unknown>,
  inclinacion: [] as number[],
  rumbos: [] as number[],
  idle: null as null | (() => void),
  encuadres: 0,
  centros: [] as { lat: number; lng: number }[],
  zooms: [] as number[],
  clic: null as null | ((e: { latLng?: { lat(): number; lng(): number } }) => void),
}));

class MapaFalso {
  constructor(_div: unknown, o: Record<string, unknown>) {
    registro.opciones = o;
    registro.mapas += 1;
  }
  setTilt(x: number) {
    registro.inclinacion.push(x);
  }
  setHeading(x: number) {
    registro.rumbos.push(x);
  }
  setCenter(p: { lat: number; lng: number }) {
    registro.centros.push(p);
  }
  setZoom(z: number) {
    registro.zooms.push(z);
  }
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
  position: unknown = null;
  registro: {
    o: Record<string, unknown>;
    clic?: () => void;
    yo: { position: unknown; map: unknown };
  };
  constructor(o: Record<string, unknown>) {
    this.position = o.position;
    this.map = o.map;
    this.registro = { o, yo: this };
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
    registro.mapas = 0;
    registro.lineas = [];
    registro.circulos = [];
    registro.opciones = null;
    registro.inclinacion = [];
    registro.rumbos = [];
    registro.idle = null;
    registro.encuadres = 0;
    registro.centros = [];
    registro.zooms = [];
    registro.clic = null;
    olvidarCargaGoogleMaps();
    window.localStorage.clear();
    olvidarAjusteTemaMapa();
  });
  afterEach(() => {
    delete (window as { google?: unknown }).google;
    vi.restoreAllMocks();
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
    const lineas = [{ id: 'orden', puntos: PUNTOS, color: '#8E9198', punteada: true }];
    const circulos = [{ id: 'area', centro: PUNTOS[1]!, metros: 80, color: '#4AA5DC' }];
    const vista = (puntos: typeof PUNTOS, rumbo = 135) => (
      <MapaGoogleBajoDemanda
        llave="AIzaSyEjemploDeLlaveDeNavegador_0123"
        mapId="a1b2c3d4e5f6"
        idioma="en"
        centro={{ lat: 10.5, lng: -66.9 }}
        inclinado
        rumbo={rumbo}
        etiqueta="Trip map"
        abierto
        puntos={puntos}
        lineas={lineas}
        circulos={circulos}
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
    // El repartidor se mueve: SOLO su marca se mueve (no se rehace nada) y no se vuelve a
    // encuadrar (no aplana el mapa); el rumbo se corrige.
    rerender(vista([PUNTOS[0]!, { ...PUNTOS[1]!, lat: 10.52 }], 140));
    await waitFor(() =>
      expect(registro.avanzadas[1]!.yo.position).toEqual({ lat: 10.52, lng: -66.91 }),
    );
    expect(registro.avanzadas).toHaveLength(2);
    expect(registro.lineas).toHaveLength(1);
    expect(registro.circulos).toHaveLength(1);
    expect(registro.encuadres).toBe(1);
    expect(registro.rumbos.at(-1)).toBe(140);
  });

  it('en viaje: si cambia el destino (aparece la casa), vuelve a encuadrar una sola vez', async () => {
    (window as { google?: unknown }).google = { maps: API_VECTORIAL };
    const vista = (puntos: typeof PUNTOS) => (
      <MapaGoogleBajoDemanda
        llave="AIzaSyEjemploDeLlaveDeNavegador_0123"
        mapId="a1b2c3d4e5f6"
        idioma="es"
        centro={{ lat: 10.5, lng: -66.9 }}
        inclinado
        etiqueta="Mapa"
        abierto
        puntos={puntos}
      />
    );
    const { rerender } = render(vista(PUNTOS));
    await waitFor(() => expect(registro.encuadres).toBe(1));
    const casa = { id: 'c', lat: 10.53, lng: -66.95, color: '#F20D20', etiqueta: 'Casa' };
    rerender(vista([...PUNTOS, casa]));
    await waitFor(() => expect(registro.encuadres).toBe(2));
    rerender(vista([...PUNTOS, { ...casa, lat: 10.531 }]));
    await new Promise((r) => setTimeout(r, 10));
    expect(registro.encuadres).toBe(2);
  });

  it('C-MAPA-LLEGADA: cerca de la casa se centra en ella, de cerca, sin aplanar ni volver a encuadrar', async () => {
    (window as { google?: unknown }).google = { maps: API_VECTORIAL };
    const casa = { ...PUNTOS[1]!, id: 'casa' };
    const vista = (
      yo: { lat: number; lng: number },
      llegada: { centro: { lat: number; lng: number }; zoom: number } | null,
    ) => (
      <MapaGoogleBajoDemanda
        llave="AIzaSyEjemploDeLlaveDeNavegador_0123"
        mapId="a1b2c3d4e5f6"
        idioma="es"
        centro={{ lat: 10.5, lng: -66.9 }}
        inclinado
        rumbo={90}
        etiqueta="Mapa"
        abierto
        llegada={llegada}
        puntos={[
          { ...casa, texto: llegada ? '41000' : undefined },
          { id: 'yo', ...yo, color: '#F20D20' },
        ]}
      />
    );
    const { rerender } = render(vista({ lat: 10.5, lng: -66.9 }, null));
    await waitFor(() => expect(registro.encuadres).toBe(1));
    registro.idle?.();
    // Llega a menos de 200 m: se centra en la casa con zoom de calle y la marca muestra el número.
    rerender(
      vista({ lat: 10.5095, lng: -66.91 }, { centro: { lat: 10.51, lng: -66.91 }, zoom: 18 }),
    );
    await waitFor(() => expect(registro.zooms.at(-1)).toBe(18));
    expect(registro.centros.at(-1)).toEqual({ lat: 10.51, lng: -66.91 });
    expect(registro.encuadres).toBe(1);
    expect((registro.avanzadas.at(-2)!.o.content as HTMLElement).textContent).toBe('41000');
    registro.idle?.();
    expect(registro.inclinacion.at(-1)).toBe(45);
    // Otra lectura de GPS estando cerca: no se mueve la cámara otra vez ni se encuadra.
    const antes = registro.zooms.length;
    rerender(
      vista({ lat: 10.5097, lng: -66.91 }, { centro: { lat: 10.51, lng: -66.91 }, zoom: 18 }),
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(registro.zooms).toHaveLength(antes);
    expect(registro.encuadres).toBe(1);
  });

  it('C-MAPA-LLEGADA: al llegar se ven la casa y el repartidor juntos; la cámara se mueve por escalones, no en cada lectura de GPS', async () => {
    (window as { google?: unknown }).google = { maps: API_VECTORIAL };
    const casa = { ...PUNTOS[1]!, id: 'casa' };
    type Llegada = { centro: { lat: number; lng: number }; zoom: number; clave: string };
    const vista = (yo: { lat: number; lng: number }, llegada: Llegada | null) => (
      <MapaGoogleBajoDemanda
        llave="AIzaSyEjemploDeLlaveDeNavegador_0123"
        mapId="a1b2c3d4e5f6"
        idioma="es"
        centro={{ lat: 10.5, lng: -66.9 }}
        inclinado
        rumbo={90}
        etiqueta="Mapa"
        abierto
        llegada={llegada}
        puntos={[casa, { id: 'yo', ...yo, color: '#F20D20', isotipo: true }]}
      />
    );
    const { rerender } = render(vista({ lat: 10.5, lng: -66.9 }, null));
    await waitFor(() => expect(registro.encuadres).toBe(1));
    // Entra al radio: el centro es el punto medio entre la casa y el repartidor, con zoom 16.
    rerender(
      vista(
        { lat: 10.5084, lng: -66.91 },
        { centro: { lat: 10.5092, lng: -66.91 }, zoom: 16, clave: 'casa,16' },
      ),
    );
    await waitFor(() => expect(registro.zooms.at(-1)).toBe(16));
    expect(registro.centros.at(-1)).toEqual({ lat: 10.5092, lng: -66.91 });
    // Otra lectura en el mismo escalón (el punto medio cambió un poco): la cámara NO se mueve.
    const antes = registro.centros.length;
    rerender(
      vista(
        { lat: 10.5086, lng: -66.91 },
        { centro: { lat: 10.5093, lng: -66.91 }, zoom: 16, clave: 'casa,16' },
      ),
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(registro.centros).toHaveLength(antes);
    expect(registro.avanzadas.at(-1)!.yo.position).toEqual({ lat: 10.5086, lng: -66.91 });
    // Más cerca: escalón nuevo, la cámara se mueve UNA vez, con el zoom de calle como tope.
    rerender(
      vista(
        { lat: 10.5097, lng: -66.91 },
        { centro: { lat: 10.50985, lng: -66.91 }, zoom: 18, clave: 'casa,18' },
      ),
    );
    await waitFor(() => expect(registro.zooms.at(-1)).toBe(18));
    expect(registro.centros).toHaveLength(antes + 1);
    expect(registro.encuadres).toBe(1);
  });

  it('C-MAPA-ISOTIPO: la marca del repartidor es el isotipo de Divoox (con y sin Map ID); el local y la casa siguen siendo círculos', async () => {
    (window as { google?: unknown }).google = { maps: API_VECTORIAL };
    const puntos = [
      PUNTOS[0]!,
      { id: 'yo', lat: 10.505, lng: -66.905, color: '#F20D20', isotipo: true, etiqueta: 'Ana' },
    ];
    const { unmount } = render(
      <MapaGoogleBajoDemanda
        llave="AIzaSyEjemploDeLlaveDeNavegador_0123"
        mapId="a1b2c3d4e5f6"
        idioma="es"
        centro={{ lat: 10.5, lng: -66.9 }}
        puntos={puntos}
        etiqueta="Mapa"
        abierto
      />,
    );
    await waitFor(() => expect(registro.avanzadas).toHaveLength(2));
    const local = registro.avanzadas[0]!.o.content as HTMLElement;
    const yo = registro.avanzadas[1]!.o.content as HTMLElement;
    expect(local.querySelector('img')).toBeNull();
    const imagen = yo.querySelector('img');
    expect(imagen?.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(decodeURIComponent(imagen!.getAttribute('src')!)).toContain('Divoox isotipo');
    expect(yo.dataset.marca).toBe('isotipo');
    unmount();
    olvidarCargaGoogleMaps();
    (window as { google?: unknown }).google = { maps: API };
    render(
      <MapaGoogleBajoDemanda
        llave="AIzaSyEjemploDeLlaveDeNavegador_0123"
        idioma="es"
        centro={{ lat: 10.5, lng: -66.9 }}
        puntos={puntos}
        etiqueta="Mapa"
        abierto
      />,
    );
    await waitFor(() => expect(registro.marcas).toHaveLength(2));
    expect((registro.marcas[1]!.icon as { url?: string }).url).toMatch(/^data:image\/svg\+xml/);
    expect((registro.marcas[0]!.icon as { url?: string }).url).toBeUndefined();
  });

  it('C-MAPA-DIA-NOCHE: de día el estilo claro y con el ajuste en oscuro el de noche (con Map ID, el esquema de color de Google); al cambiar el ajuste el mapa se rehace', async () => {
    (window as { google?: unknown }).google = { maps: API };
    await cambiarAjusteTemaMapa('claro');
    const { unmount } = render(
      <MapaGoogleBajoDemanda
        llave="AIzaSyEjemploDeLlaveDeNavegador_0123"
        idioma="es"
        centro={{ lat: 10.5, lng: -66.9 }}
        puntos={PUNTOS}
        etiqueta="Mapa"
        abierto
      />,
    );
    await waitFor(() => expect(registro.mapas).toBe(1));
    expect(registro.opciones!.styles).toBe(ESTILO_MAPA_DIA);
    await act(() => cambiarAjusteTemaMapa('oscuro'));
    await waitFor(() => expect(registro.mapas).toBe(2));
    expect(registro.opciones!.styles).toBe(ESTILO_MAPA_NOCHE);
    await waitFor(() => expect(registro.marcas).toHaveLength(4));
    unmount();
    olvidarCargaGoogleMaps();
    (window as { google?: unknown }).google = { maps: API_VECTORIAL };
    render(
      <MapaGoogleBajoDemanda
        llave="AIzaSyEjemploDeLlaveDeNavegador_0123"
        mapId="a1b2c3d4e5f6"
        idioma="es"
        centro={{ lat: 10.5, lng: -66.9 }}
        puntos={PUNTOS}
        etiqueta="Mapa"
        abierto
      />,
    );
    await waitFor(() => expect(registro.mapas).toBe(3));
    expect(registro.opciones).toMatchObject({ colorScheme: 'DARK', mapId: 'a1b2c3d4e5f6' });
    expect(registro.opciones!.styles).toBeUndefined();
    await act(() => cambiarAjusteTemaMapa('claro'));
    await waitFor(() => expect(registro.mapas).toBe(4));
    expect(registro.opciones).toMatchObject({ colorScheme: 'LIGHT' });
  });

  it('C-MAPA-DIA-NOCHE: con `conAjuste` el mapa trae el ajuste de tres posiciones y se guarda en el navegador', async () => {
    (window as { google?: unknown }).google = { maps: API };
    render(
      <MapaGoogleBajoDemanda
        llave="AIzaSyEjemploDeLlaveDeNavegador_0123"
        idioma="es"
        centro={{ lat: 10.5, lng: -66.9 }}
        puntos={PUNTOS}
        etiqueta="Mapa"
        abierto
        conAjuste
      />,
    );
    await waitFor(() => expect(registro.mapas).toBe(1));
    const grupo = screen.getByRole('radiogroup', { name: 'Colores del mapa' });
    expect(grupo).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Automático' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Oscuro' }));
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeChecked();
    expect(window.localStorage.getItem(LLAVE_AJUSTE_TEMA_MAPA)).toBe('oscuro');
    await waitFor(() => expect(registro.opciones!.styles).toBe(ESTILO_MAPA_NOCHE));
  });

  it('C-MAPA-ABRE-DONDE-ESTAS: sin puntos, si llega la ubicación de la persona el mapa se mueve ahí', async () => {
    (window as { google?: unknown }).google = { maps: API };
    const vista = (centro: { lat: number; lng: number }, zoom: number) => (
      <MapaGoogleBajoDemanda
        llave="AIzaSyEjemploDeLlaveDeNavegador_0123"
        idioma="es"
        centro={centro}
        zoom={zoom}
        puntos={[]}
        etiqueta="Mapa"
        abierto
      />
    );
    const { rerender } = render(vista({ lat: 42.52, lng: -83.47 }, 13));
    await waitFor(() => expect(registro.mapas).toBe(1));
    expect(registro.opciones).toMatchObject({ center: { lat: 42.52, lng: -83.47 }, zoom: 13 });
    rerender(vista({ lat: 42.48, lng: -83.475 }, 16));
    await waitFor(() => expect(registro.centros.at(-1)).toEqual({ lat: 42.48, lng: -83.475 }));
    expect(registro.zooms.at(-1)).toBe(16);
  });

  it('se cierra y se vuelve a abrir (segundo pedido en la misma pantalla): el mapa se crea de nuevo', async () => {
    (window as { google?: unknown }).google = { maps: API_VECTORIAL };
    const vista = (abierto: boolean) => (
      <MapaGoogleBajoDemanda
        llave="AIzaSyEjemploDeLlaveDeNavegador_0123"
        mapId="a1b2c3d4e5f6"
        idioma="es"
        centro={{ lat: 10.5, lng: -66.9 }}
        inclinado={abierto}
        etiqueta="Mapa"
        abierto={abierto}
        puntos={PUNTOS}
      />
    );
    const { rerender } = render(vista(true));
    await waitFor(() => expect(registro.avanzadas).toHaveLength(2));
    rerender(vista(false));
    expect(screen.queryByTestId('mapa-google')).toBeNull();
    rerender(vista(true));
    await waitFor(() => expect(registro.mapas).toBe(2));
    await waitFor(() => expect(registro.avanzadas).toHaveLength(4));
    expect(registro.avanzadas[2]!.yo.map).not.toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('si Google rechaza la llave, lo dice en palabras y deja rastro en la consola', async () => {
    (window as { google?: unknown }).google = { maps: API };
    const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <MapaGoogleBajoDemanda
        llave="AIzaSyEjemploDeLlaveDeNavegador_0123"
        idioma="es"
        centro={{ lat: 10.5, lng: -66.9 }}
        puntos={PUNTOS}
        etiqueta="Mapa"
        abierto
      />,
    );
    await waitFor(() => expect(registro.marcas).toHaveLength(2));
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure?.();
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos abrir el mapa.');
    expect(consola).toHaveBeenCalled();
  });
});
