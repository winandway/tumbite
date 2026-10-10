import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Menu } from './Menu';

const usuario = {
  id: 'u1',
  nombre: 'Rosa',
  correo: 'rosa@ejemplo.com',
  rol: 'restaurante' as const,
  idioma: 'es' as const,
};
const plato = {
  id: 'p1',
  restauranteId: 'r1',
  nombreEs: 'Croquetas',
  nombreEn: 'Croquettes',
  descripcionEs: '',
  descripcionEn: '',
  categoria: 'Entradas',
  precioCentavos: 650,
  imagen: null,
  disponible: true,
};

describe('menú del restaurante', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('no hay botón de eliminar a la vista: vive dentro de los 3 puntos', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ restaurante: { id: 'r1' }, platos: [plato] }), {
          status: 200,
        }),
    );
    render(<Menu usuario={usuario} idioma="es" />);
    expect(await screen.findByText('Croquetas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(screen.getByRole('menuitem', { name: 'Eliminar' })).toBeInTheDocument();
  });

  it('un precio mal escrito se explica y no se pierde lo escrito', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ restaurante: { id: 'r1' }, platos: [] }), { status: 200 }),
    );
    render(<Menu usuario={usuario} idioma="es" />);
    await userEvent.click(await screen.findByRole('button', { name: '+ Agregar plato' }));
    await userEvent.type(screen.getByLabelText('Nombre en español'), 'Flan');
    await userEvent.type(screen.getByLabelText('Precio en dólares'), 'cinco');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar plato' }));
    expect(await screen.findByText('Escribe un precio como 12.50')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre en español')).toHaveValue('Flan');
  });
});
