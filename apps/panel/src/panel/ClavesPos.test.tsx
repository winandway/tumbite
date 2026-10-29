import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClavesPos } from './ClavesPos';

// C-API-POS en el panel: crear una llave la muestra una sola vez.
describe('C-API-POS en el panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('crea la llave y la muestra para copiarla', async () => {
    let creadas = 0;
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        creadas++;
        return new Response(JSON.stringify({ id: 'k1', llave: 'dvx_pos_ABCDEF123456' }), {
          status: 201,
        });
      }
      return new Response(
        JSON.stringify({
          claves: creadas
            ? [
                {
                  id: 'k1',
                  nombre: 'Caja',
                  prefijo: 'dvx_pos_ABCD',
                  usadaEn: null,
                  revocadaEn: null,
                },
              ]
            : [],
        }),
        { status: 200 },
      );
    });
    render(<ClavesPos idioma="es" />);
    await userEvent.type(await screen.findByLabelText(/Nombre de la llave/), 'Caja');
    await userEvent.click(screen.getByRole('button', { name: 'Crear llave' }));
    expect(await screen.findByText('dvx_pos_ABCDEF123456')).toBeInTheDocument();
    expect(screen.getByText(/no se vuelve a mostrar/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Caja · dvx_pos_ABCD/)).toBeInTheDocument());
  });
});
