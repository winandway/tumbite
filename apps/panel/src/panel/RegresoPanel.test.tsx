import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CiudadBaseConductor } from './CiudadBaseConductor';
import { RegresoAjustes } from './RegresoAjustes';

/**
 * C-REGRESO-PASAJERO (25 nov 2026; todos los países), prueba de aceptación 11 de la ficha: el equipo
 * cambia la ciudad base del conductor desde su ficha y ajusta los números del regreso de cada país.
 * Lo escrito no se pierde si el servidor falla.
 */
function servidor(fallaPut = false) {
  const envios: { url: string; cuerpo: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (init?.method === 'PUT') {
      envios.push({ url: u, cuerpo: JSON.parse(String(init.body)) });
      if (fallaPut) return new Response(JSON.stringify({ error: 'Sin conexión' }), { status: 503 });
      return new Response(
        JSON.stringify({ ok: true, actual: { id: 'Z-NORTE', nombre: 'Ciudad Norte' } }),
      );
    }
    if (u.includes('/ciudad-base'))
      return new Response(
        JSON.stringify({
          actual: null,
          ciudades: [
            { id: 'Z-NORTE', nombre: 'Ciudad Norte' },
            { id: 'Z-SUR', nombre: 'Ciudad Sur' },
          ],
        }),
      );
    if (u.includes('/regreso/ajustes'))
      return new Response(
        JSON.stringify({
          iniciales: { kmMinimo: 25, anguloMaximo: 45, acercaMinimoKm: 5, extraRecogidaKm: 3 },
          limites: {
            kmMinimo: [5, 300],
            anguloMaximo: [10, 90],
            acercaMinimoKm: [1, 100],
            extraRecogidaKm: [0, 10],
          },
          paises: [
            {
              pais: 'US',
              kmMinimo: 25,
              anguloMaximo: 45,
              acercaMinimoKm: 5,
              extraRecogidaKm: 3,
              propios: false,
            },
          ],
        }),
      );
    return new Response(JSON.stringify({}));
  });
  return envios;
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('ciudad base del conductor (C-REGRESO-PASAJERO)', () => {
  it('se ve que no tiene, se elige una ciudad con motivo y se guarda', async () => {
    const envios = servidor();
    const alCambiar = vi.fn();
    render(<CiudadBaseConductor id="c-1" idioma="es" alCerrar={() => {}} alCambiar={alCambiar} />);
    expect(await screen.findByText(/Todavía no tiene/)).toBeInTheDocument();
    await userEvent.selectOptions(await screen.findByRole('combobox'), 'Z-NORTE');
    await userEvent.type(screen.getByPlaceholderText(/Por qué se cambia/), 'Vive allá');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar la ciudad base' }));
    await waitFor(() =>
      expect(alCambiar).toHaveBeenCalledWith(expect.stringContaining('Ciudad Norte')),
    );
    expect(envios[0]).toMatchObject({
      url: expect.stringContaining('/datos/admin/conductores/c-1/ciudad-base'),
      cuerpo: { zonaId: 'Z-NORTE', motivo: 'Vive allá' },
    });
  });

  it('si el servidor falla, lo escrito se queda y se ve el error', async () => {
    servidor(true);
    render(<CiudadBaseConductor id="c-2" idioma="es" alCerrar={() => {}} alCambiar={() => {}} />);
    await userEvent.selectOptions(await screen.findByRole('combobox'), 'Z-SUR');
    await userEvent.type(screen.getByPlaceholderText(/Por qué se cambia/), 'Se mudó');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar la ciudad base' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Por qué se cambia/)).toHaveValue('Se mudó');
  });
});

describe('números del regreso por país (C-REGRESO-PASAJERO)', () => {
  it('elegir el país trae sus números; se cambian y se guardan como números', async () => {
    const envios = servidor();
    render(<RegresoAjustes idioma="en" />);
    await userEvent.selectOptions(await screen.findByRole('combobox'), 'US');
    const extra = screen.getByLabelText(/closest driver/);
    expect(extra).toHaveValue(3);
    await userEvent.clear(extra);
    await userEvent.type(extra, '2');
    await userEvent.click(screen.getByRole('button', { name: 'Save the numbers' }));
    await waitFor(() => expect(envios).toHaveLength(1));
    expect(envios[0]?.cuerpo).toEqual({
      pais: 'US',
      kmMinimo: 25,
      anguloMaximo: 45,
      acercaMinimoKm: 5,
      extraRecogidaKm: 2,
    });
  });
});
