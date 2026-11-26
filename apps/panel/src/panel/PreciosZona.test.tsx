import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreciosZona, type RutaPrecio, leerPunto } from './PreciosZona';
import { SesionArmazon } from './armazon/Armazon';
import { SuperViajes } from './SuperViajes';

/**
 * C-TABULADOR-VIGIA y C-RECARGO-NOCHE (25 nov 2026) — Venezuela. El panel de precios de la zona agrupa
 * por vía, dice lo que paga el pasajero, lo de Divoox y lo que le queda al conductor (de día y de
 * noche, con lo que manda el servidor), marca las de punto aproximado y deja corregirlas; la tarifa de
 * la ciudad guarda la tarifa nocturna y el umbral en 0.
 */
const casco = { lat: 8.6219, lng: -71.6506, radioKm: 4, nombre: 'El Vigía (casco urbano)' };
const ruta = (x: Partial<RutaPrecio> & { id: string; nombre: string; precio: number }) =>
  ({
    zona: 'VE-MER-ELVIGIA',
    servicio: 'moto',
    moneda: 'USD',
    desde: casco,
    hasta: { lat: 8.6, lng: -71.7, radioKm: 0.45, nombre: x.nombre },
    precioIdaVuelta: null,
    activa: true,
    ...x,
  }) as RutaPrecio;

const RUTAS: RutaPrecio[] = [
  ruta({
    id: 'r1',
    nombre: 'KM 9',
    precio: 300,
    grupo: 'Vía Táchira',
    revisar: false,
    reparto: {
      pasajero: 300,
      comision: 30,
      conductor: 270,
      noche: { pasajero: 390, comision: 39, conductor: 351 },
    },
  }),
  ruta({ id: 'r2', nombre: 'KM 12', precio: 400, grupo: 'Vía Táchira', revisar: true }),
  ruta({ id: 'r3', nombre: 'Mérida', precio: 3000, grupo: 'Vía Mérida', revisar: false }),
  ruta({ id: 'r4', nombre: 'Plaza de llegada', precio: 500, grupo: null, zona: 'US-FL-MIAMI' }),
];

function servidor() {
  const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = String(url);
    llamadas.push({
      url: u,
      metodo: init?.method ?? 'GET',
      cuerpo: init?.body ? JSON.parse(String(init.body)) : null,
    });
    if (u.includes('/datos/admin/viajes/precios-zona'))
      return new Response(JSON.stringify({ rutas: RUTAS }));
    if (u.includes('/datos/admin/viajes/tarifas')) return new Response('{}', { status: 201 });
    if (u.includes('/datos/admin/panico/sin-atender'))
      return new Response(JSON.stringify({ cantidad: 0, ultimo: null, zonasSinResponsable: [] }));
    if (u.includes('/datos/admin/viajes/ajustes'))
      return new Response(JSON.stringify({ ajustes: [] }));
    if (u.includes('/datos/admin/viajes'))
      return new Response(JSON.stringify({ emergencias: [], viajes: [], tarifas: [] }));
    return new Response(JSON.stringify({}));
  });
  return llamadas;
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('C-TABULADOR-VIGIA: Precios de la zona en el panel', () => {
  it('agrupa por vía, con cuántas hay y cuántas por revisar', async () => {
    servidor();
    render(<PreciosZona idioma="es" monedaDe={() => 'USD'} />);
    const grupos = await screen.findAllByTestId('precio-zona-grupo');
    expect(grupos.map((g) => g.querySelector('h3')?.textContent)).toEqual([
      'Vía Táchira · 2 rutas · 1 por revisar',
      'Vía Mérida · 1 ruta',
      'Sin vía · 1 ruta',
    ]);
  });

  it('cada ruta dice lo que paga el pasajero, lo de Divoox y lo que le queda al conductor, de día y de noche', async () => {
    servidor();
    render(<PreciosZona idioma="es" monedaDe={() => 'USD'} />);
    const reparto = await screen.findByTestId('precio-zona-reparto');
    expect(reparto).toHaveTextContent(
      'Pasajero paga 3.00 · Divoox 0.30 · Le queda al conductor 2.70 · De noche: pasajero paga 3.90, le queda al conductor 3.51',
    );
  });

  it('las de punto aproximado dicen «Revisar punto en el mapa», con el enlace, y se pueden marcar como revisadas', async () => {
    const llamadas = servidor();
    render(<PreciosZona idioma="es" monedaDe={() => 'USD'} />);
    const marca = await screen.findByTestId('precio-zona-revisar');
    expect(marca).toHaveTextContent('Revisar punto en el mapa');
    const enlace = within(marca).getByRole('link', { name: 'Ver en el mapa' });
    expect(enlace).toHaveAttribute('href', expect.stringContaining('query=8.6,-71.7'));
    expect(enlace).toHaveAttribute('target', '_blank');
    expect(screen.getAllByTestId('precio-zona-revisar')).toHaveLength(1);
    const linea = marca.closest('li') as HTMLElement;
    await userEvent.click(within(linea).getByRole('button', { name: 'Opciones de la ruta' }));
    await userEvent.click(within(linea).getByRole('menuitem', { name: 'Marcar como revisado' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'PUT')?.cuerpo).toMatchObject({
        revisado: true,
        grupo: 'Vía Táchira',
        precio: 400,
      }),
    );
  });

  it('busca por lugar (sin acentos) y filtra las que hay que revisar', async () => {
    servidor();
    render(<PreciosZona idioma="es" monedaDe={() => 'USD'} />);
    await screen.findAllByTestId('precio-zona-grupo');
    await userEvent.type(screen.getByTestId('precio-zona-buscar'), 'merida');
    expect(screen.getAllByTestId('precio-zona-linea')).toHaveLength(1);
    expect(screen.getByTestId('precio-zona-linea')).toHaveTextContent('Mérida');
    await userEvent.clear(screen.getByTestId('precio-zona-buscar'));
    await userEvent.click(screen.getByTestId('precio-zona-solo-revisar'));
    expect(screen.getAllByTestId('precio-zona-linea')).toHaveLength(1);
    expect(screen.getByTestId('precio-zona-linea')).toHaveTextContent('KM 12');
  });

  it('al editar, el punto exacto y la vía se pueden corregir y viajan al servidor', async () => {
    const llamadas = servidor();
    render(<PreciosZona idioma="es" monedaDe={() => 'USD'} />);
    const linea = (await screen.findByText(/KM 12/)).closest('li') as HTMLElement;
    await userEvent.click(within(linea).getByRole('button', { name: 'Opciones de la ruta' }));
    await userEvent.click(within(linea).getByRole('menuitem', { name: 'Editar' }));
    const punto = screen.getByTestId('precio-zona-punto-hasta');
    expect(punto).toHaveValue('8.6, -71.7');
    await userEvent.clear(punto);
    await userEvent.type(punto, '8.5881, -71.7349');
    expect(screen.getByTestId('precio-zona-via')).toHaveValue('Vía Táchira');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'PUT')?.cuerpo).toMatchObject({
        hasta: { lat: 8.5881, lng: -71.7349, nombre: 'KM 12' },
        grupo: 'Vía Táchira',
      }),
    );
  });

  it('lee el punto pegado del mapa y rechaza lo que no es un punto', () => {
    expect(leerPunto('8.6219, -71.6506')).toEqual({ lat: 8.6219, lng: -71.6506 });
    expect(leerPunto(' 8.6 -71.7 ')).toEqual({ lat: 8.6, lng: -71.7 });
    expect(leerPunto('El Vigía')).toBeNull();
    expect(leerPunto('95, 10')).toBeNull();
  });
});

describe('C-RECARGO-NOCHE: la tarifa de la ciudad en el panel', () => {
  const SESION = {
    usuario: { id: 'emp-1', nombre: 'Equipo', correo: 'e@ejemplo.com', rol: 'admin' },
    idioma: 'es',
    cambiar: () => {},
    salir: () => {},
  } as never;

  it('guarda la tarifa nocturna en por ciento, sus horas y el umbral en 0', async () => {
    const llamadas = servidor();
    render(
      <SesionArmazon.Provider value={SESION}>
        <SuperViajes base="/panel/super" idioma="es" />
      </SesionArmazon.Provider>,
    );
    const form = (await screen.findByTestId('tarifa-recargo-noche')).closest('form') as HTMLElement;
    const f = within(form);
    await userEvent.type(
      f.getByLabelText('Código de la ciudad (por ejemplo US-FL-MIAMI)'),
      'VE-MER-ELVIGIA',
    );
    await userEvent.type(f.getByLabelText('Por kilómetro'), '0,33');
    await userEvent.type(f.getByLabelText('Precio mínimo'), '1');
    await userEvent.type(screen.getByTestId('tarifa-umbral-zona'), '0');
    await userEvent.type(screen.getByTestId('tarifa-recargo-noche'), '30');
    await userEvent.type(screen.getByTestId('tarifa-noche-desde'), '21');
    await userEvent.type(screen.getByTestId('tarifa-noche-hasta'), '6');
    await userEvent.type(f.getByLabelText('Motivo del cambio'), 'Tabulador de la calle');
    await userEvent.click(f.getByRole('button', { name: 'Guardar tarifa' }));
    await waitFor(() => {
      const t = llamadas.find((l) => l.metodo === 'POST' && l.url.includes('/tarifas'))?.cuerpo as {
        tarifa: Record<string, number>;
      };
      expect(t?.tarifa).toMatchObject({
        porKm: 33,
        minimo: 100,
        umbralPrecioZonaPb: 0,
        recargoNochePb: 3000,
        nocheDesdeH: 21,
        nocheHastaH: 6,
      });
    });
  });
});
