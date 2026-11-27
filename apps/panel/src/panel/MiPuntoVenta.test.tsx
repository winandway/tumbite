import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MiPuntoVenta } from './MiPuntoVenta';
import { ResponsableZona } from './ResponsableZona';

/**
 * C-PUNTO-VENTA-PANEL y C-PANICO-ZONA (16 nov 2026, piloto de El Vigía y Tucaní): el equipo emite
 * desde el panel el código de recarga del conductor, y carga el responsable de cada zona.
 */
afterEach(() => vi.unstubAllGlobals());

describe('C-PUNTO-VENTA-PANEL', () => {
  it('emite un código en dólares (centavos al servidor) y lo muestra grande', async () => {
    const cuerpos: unknown[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/datos/punto-venta/codigos')) {
        cuerpos.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ codigo: 'ABCD-EFGH-JKLM', monto: 500 }), {
          status: 201,
        });
      }
      return new Response(
        JSON.stringify({
          punto: { id: 'p', nombre: 'Equipo', pais: 'VE', moneda: 'USD' },
          fondo: 1000,
          codigos: [{ id: 'c1', monto: 300, estado: 'emitido', creadoEn: '2026-11-16 18:00' }],
        }),
        { status: 200 },
      );
    });
    render(<MiPuntoVenta idioma="es" />);
    expect(await screen.findByText('10.00 USD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anular' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Monto de la recarga/), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Emitir código' }));
    expect(await screen.findByText('ABCD-EFGH-JKLM')).toBeInTheDocument();
    expect(cuerpos).toEqual([{ monto: 500 }]);
  });

  it('una cuenta que no es de un punto no ve nada', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify({ error: 'no' }), { status: 403 }),
    );
    const { container } = render(<MiPuntoVenta idioma="es" />);
    await waitFor(() => expect(container.innerHTML).toBe(''));
  });
});

describe('C-PANICO-ZONA en el panel', () => {
  it('guarda el responsable de la zona con su celular', async () => {
    const cuerpos: unknown[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      cuerpos.push(JSON.parse(String(init?.body ?? '{}')));
      return new Response('{"ok":true}', { status: 200 });
    });
    const alGuardar = vi.fn(async () => undefined);
    render(
      <ResponsableZona
        zona={{ id: 'VE-MER-TUCANI' }}
        cuenta="u"
        idioma="es"
        alGuardar={alGuardar}
      />,
    );
    expect(screen.getByText(/nadie/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nombre'), 'Responsable');
    await userEvent.type(screen.getByLabelText(/Celular/), '+58 412 0000000');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar responsable' }));
    await waitFor(() => expect(alGuardar).toHaveBeenCalled());
    expect(cuerpos.at(-1)).toEqual({
      responsableNombre: 'Responsable',
      responsableTelefono: '+584120000000',
    });
  });
});
