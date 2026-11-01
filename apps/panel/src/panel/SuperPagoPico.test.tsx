import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperPagoPico } from './SuperPagoPico';

// C-PAGO-PICO en el panel: arranca en cero (apagado) y guarda en centavos.
describe('C-PAGO-PICO en el panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('carga el pago pico y manda monto y presupuesto en centavos', async () => {
    const puts: unknown[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        puts.push(JSON.parse(String(init.body)));
        return new Response(String(init.body), { status: 200 });
      }
      return new Response(JSON.stringify({ centavos: 0, presupuestoDiaCentavos: 0 }), {
        status: 200,
      });
    });
    render(<SuperPagoPico idioma="es" />);
    const monto = await screen.findByLabelText('Monto por pedido (dólares)');
    await waitFor(() => expect((monto as HTMLInputElement).value).toBe('0'));
    await userEvent.clear(monto);
    await userEvent.type(monto, '2');
    const presupuesto = screen.getByLabelText('Presupuesto por día (dólares)');
    await userEvent.clear(presupuesto);
    await userEvent.type(presupuesto, '100');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar el pago pico' }));
    await waitFor(() => expect(puts).toEqual([{ centavos: 200, presupuestoDiaCentavos: 10000 }]));
    expect(await screen.findByRole('status')).toHaveTextContent('Guardado');
  });
});
