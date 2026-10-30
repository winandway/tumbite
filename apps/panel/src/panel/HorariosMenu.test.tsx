import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HorariosMenu } from './HorariosMenu';

// C-MENU-HORARIO (30 oct 2026): franja diaria por categoría, como los menús por horario de DoorDash.
describe('horarios del menú (C-MENU-HORARIO)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('guarda solo las categorías con franja y avisa si falta una hora', async () => {
    const cuerpos: unknown[] = [];
    vi.stubGlobal('fetch', async (_u: string, init?: RequestInit) => {
      cuerpos.push(JSON.parse(String(init?.body)));
      return new Response('{"horariosCategoria":[]}', { status: 200 });
    });
    render(
      <HorariosMenu
        categorias={['Desayuno', 'Pizzas']}
        iniciales={[{ categoria: 'Desayuno', abre: '07:00', cierra: '11:00' }]}
        idioma="es"
      />,
    );
    expect(screen.getByLabelText('Desde · Desayuno')).toHaveValue('07:00');
    fireEvent.change(screen.getByLabelText('Desde · Pizzas'), { target: { value: '12:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar horarios del menú' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Pon las dos horas');
    fireEvent.change(screen.getByLabelText('Hasta · Pizzas'), { target: { value: '23:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar horarios del menú' }));
    await waitFor(() =>
      expect(cuerpos).toEqual([
        {
          ventanas: [
            { categoria: 'Desayuno', abre: '07:00', cierra: '11:00' },
            { categoria: 'Pizzas', abre: '12:00', cierra: '23:00' },
          ],
        },
      ]),
    );
    expect(await screen.findByText('Horarios del menú guardados.')).toBeInTheDocument();
  });
});
