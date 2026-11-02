import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Resenas } from './Resenas';

// C-RESENAS-SUGERIDAS: tocar una sugerencia llena la respuesta, que se puede editar.
describe('C-RESENAS-SUGERIDAS en el panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('una reseña mala ofrece disculparse con el nombre del cliente', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            promedio: 2,
            total: 1,
            respondidas: 0,
            resenas: [
              {
                pedidoId: 'p1',
                cliente: 'Ana López',
                estrellas: 2,
                estrellasRepartidor: null,
                culpaRestaurante: false,
                comentario: 'Llegó frío',
                respuesta: null,
                respondidaEn: null,
                creadoEn: '2026-10-29 10:00:00',
              },
            ],
          }),
          { status: 200 },
        ),
    );
    render(<Resenas idioma="es" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Responder' }));
    await userEvent.click(
      screen.getByRole('button', {
        name: /^Lamentamos que tu pedido no fuera lo que esperabas, Ana/,
      }),
    );
    expect(screen.getByRole('textbox', { name: 'Tu respuesta' })).toHaveValue(
      'Lamentamos que tu pedido no fuera lo que esperabas, Ana. Gracias por decírnoslo: ya lo estamos revisando con la cocina.',
    );
  });

  it('C-GUSTO-PLATOS: muestra cómo les va a los platos, en los dos idiomas', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            promedio: 4.5,
            total: 6,
            respondidas: 0,
            resenas: [],
            platos: [
              { platoId: 'a', nombreEs: 'Ensalada', nombreEn: 'Salad', porcentaje: 40, votos: 5 },
              { platoId: 'b', nombreEs: 'Pizza', nombreEn: 'Pizza', porcentaje: 92, votos: 40 },
            ],
          }),
          { status: 200 },
        ),
    );
    const { unmount } = render(<Resenas idioma="es" />);
    expect(await screen.findByText('Tus platos según los clientes')).toBeInTheDocument();
    expect(screen.getByText('le gustó al 40 % · 5 votos')).toBeInTheDocument();
    unmount();
    render(<Resenas idioma="en" />);
    expect(await screen.findByText('Salad')).toBeInTheDocument();
    expect(screen.getByText('liked by 92% · 40 votes')).toBeInTheDocument();
  });
});
