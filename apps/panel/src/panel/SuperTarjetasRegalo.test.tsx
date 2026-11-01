import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperTarjetasRegalo } from './SuperTarjetasRegalo';

// C-TARJETAS-REGALO en el panel: arrancan apagadas y guardan los montos en centavos.
describe('C-TARJETAS-REGALO en el panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('enciende y manda mínimo y máximo en centavos', async () => {
    const puts: unknown[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        puts.push(JSON.parse(String(init.body)));
        return new Response(String(init.body), { status: 200 });
      }
      return new Response(JSON.stringify({ activas: false, minimo: 1500, maximo: 50000 }), {
        status: 200,
      });
    });
    render(<SuperTarjetasRegalo idioma="es" />);
    const minimo = await screen.findByLabelText('Monto mínimo (dólares)');
    await waitFor(() => expect((minimo as HTMLInputElement).value).toBe('15'));
    await userEvent.click(screen.getByLabelText('Tarjetas de regalo encendidas'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar tarjetas de regalo' }));
    await waitFor(() => expect(puts).toEqual([{ activas: true, minimo: 1500, maximo: 50000 }]));
  });
});
