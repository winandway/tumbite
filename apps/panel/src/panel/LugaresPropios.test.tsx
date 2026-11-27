import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LugaresPropios } from './LugaresPropios';

// El mapa real no corre en jsdom: se simula con un botón que marca un punto.
vi.mock('../sitio/ElegirPunto', () => ({
  ElegirPunto: ({ cambiar }: { cambiar: (p: { lat: number; lng: number }) => void }) => (
    <button type="button" onClick={() => cambiar({ lat: 8.62, lng: -71.65 })}>
      marcar punto
    </button>
  ),
}));

const RESPUESTA = {
  ciudad: { id: 'VE-MER-ELVIGIA', nombre: 'El Vigía' },
  lugares: [
    {
      id: 'l1',
      zona: 'VE-MER-ELVIGIA',
      nombre: 'KM 9',
      otrosNombres: ['km9', 'Kilómetro 9'],
      lat: 8.6,
      lng: -71.7,
      rutaId: 'r1',
      activo: true,
    },
    {
      id: 'l2',
      zona: 'VE-MER-ELVIGIA',
      nombre: 'Terminal',
      otrosNombres: [],
      lat: 8.61,
      lng: -71.66,
      rutaId: null,
      activo: true,
    },
  ],
  rutas: [
    {
      id: 'r1',
      servicio: 'moto',
      nombre: 'KM 9',
      precio: 300,
      moneda: 'USD',
      grupo: 'Vía Táchira',
      revisar: false,
    },
  ],
};

function servidor() {
  const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    llamadas.push({
      url: String(url),
      metodo: init?.method ?? 'GET',
      cuerpo: init?.body ? JSON.parse(String(init.body)) : null,
    });
    if (init?.method === 'POST' && String(url).endsWith('/lugares-propios'))
      return new Response(JSON.stringify({ lugar: {} }), { status: 201 });
    return new Response(JSON.stringify(RESPUESTA));
  });
  return llamadas;
}

const ZONAS = [{ id: 'VE-MER-ELVIGIA', nombre: 'El Vigía' }];

async function abrir() {
  const llamadas = servidor();
  render(<LugaresPropios idioma="es" zonas={ZONAS} />);
  await userEvent.selectOptions(screen.getByTestId('lugar-propio-ciudad'), 'VE-MER-ELVIGIA');
  await screen.findAllByTestId('lugar-propio-linea');
  return llamadas;
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Lugares propios de tu ciudad', () => {
  it('carga la lista con otros nombres, precio atado y «Sin precio fijo»', async () => {
    const llamadas = await abrir();
    expect(llamadas[0]?.url).toContain('/datos/admin/lugares-propios?zona=VE-MER-ELVIGIA');
    const lineas = screen.getAllByTestId('lugar-propio-linea') as [HTMLElement, HTMLElement];
    expect(lineas).toHaveLength(2);
    expect(lineas[0]).toHaveTextContent('km9, Kilómetro 9');
    expect(lineas[0]).toHaveTextContent('KM 9 · $3.00');
    expect(lineas[1]).toHaveTextContent('Sin precio fijo');
    expect(within(lineas[0]).getByRole('link', { name: 'Ver en el mapa' })).toHaveAttribute(
      'href',
      expect.stringContaining('query=8.6,-71.7'),
    );
  });

  it('el buscador encuentra «KM 9» por su otro nombre «km9», sin acentos', async () => {
    await abrir();
    await userEvent.type(screen.getByTestId('lugar-propio-buscar'), 'KILOMETRO');
    const lineas = screen.getAllByTestId('lugar-propio-linea');
    expect(lineas).toHaveLength(1);
    expect(lineas[0]).toHaveTextContent('KM 9');
    await userEvent.clear(screen.getByTestId('lugar-propio-buscar'));
    await userEvent.type(screen.getByTestId('lugar-propio-buscar'), 'km9');
    expect(screen.getAllByTestId('lugar-propio-linea')).toHaveLength(1);
  });

  it('el menú ofrece Editar y Apagar (nunca borrar)', async () => {
    await abrir();
    const linea = screen.getAllByTestId('lugar-propio-linea')[0] as HTMLElement;
    await userEvent.click(within(linea).getByRole('button', { name: 'Opciones del lugar' }));
    expect(within(linea).getByRole('menuitem', { name: 'Editar' })).toBeInTheDocument();
    expect(within(linea).getByRole('menuitem', { name: 'Apagar' })).toBeInTheDocument();
    expect(within(linea).queryByRole('menuitem', { name: /borrar|eliminar/i })).toBeNull();
  });

  it('guardar manda otrosNombres como arreglo limpio, sin vacíos ni repetidos', async () => {
    const llamadas = await abrir();
    await userEvent.type(screen.getByTestId('lugar-propio-nombre'), 'Puente Nuevo');
    await userEvent.type(
      screen.getByTestId('lugar-propio-otros'),
      'puente, , PUENTE,  el puente ,',
    );
    await userEvent.click(screen.getByRole('button', { name: 'marcar punto' }));
    await userEvent.selectOptions(screen.getByTestId('lugar-propio-ruta'), 'r1');
    await userEvent.click(screen.getByTestId('lugar-propio-guardar'));
    await waitFor(() => expect(llamadas.find((l) => l.metodo === 'POST')).toBeTruthy());
    expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toEqual({
      zona: 'VE-MER-ELVIGIA',
      nombre: 'Puente Nuevo',
      otrosNombres: ['puente', 'el puente'],
      lat: 8.62,
      lng: -71.65,
      rutaId: 'r1',
    });
  });
});
