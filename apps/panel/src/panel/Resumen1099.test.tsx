import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Resumen1099 } from './Resumen1099';

afterEach(() => vi.unstubAllGlobals());

describe('G5: resumen del 1099-NEC en el superadmin', () => {
  it('muestra a quien pasa el umbral con su total', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            repartidores: [
              {
                id: 'r1',
                nombre: 'Rep Uno',
                correo: 'r1@ejemplo.com',
                entregas: 120,
                total: 250_000,
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    render(<Resumen1099 idioma="es" />);
    expect(await screen.findByText('Rep Uno')).toBeTruthy();
    expect(screen.getByText(/2[.,]500[.,]00/)).toBeTruthy();
    expect(screen.getByText(/emisión de los formularios está apagada/)).toBeTruthy();
  });
  it('sin nadie sobre el umbral lo dice', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ repartidores: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    render(<Resumen1099 idioma="en" />);
    expect(await screen.findByText('No one passes the threshold this year.')).toBeTruthy();
  });
});
