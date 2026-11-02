import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperReferidos } from './SuperReferidos';

// C-REFERIDOS en el panel: nace apagado y en cero, y guarda los montos en centavos.
describe('C-REFERIDOS en el panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('enciende y manda los dos créditos en centavos', async () => {
    const puts: unknown[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        puts.push(JSON.parse(String(init.body)));
        return new Response(String(init.body), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          activos: false,
          paraAmigo: 0,
          paraQuienInvita: 0,
          invitados: 3,
          premiados: 1,
        }),
        { status: 200 },
      );
    });
    render(<SuperReferidos idioma="es" />);
    const amigo = await screen.findByLabelText('Crédito para el amigo (dólares)');
    await waitFor(() => expect((amigo as HTMLInputElement).value).toBe('0'));
    expect(screen.getByText('Amigos invitados: 3 · con su primer pedido: 1')).toBeTruthy();
    await userEvent.clear(amigo);
    await userEvent.type(amigo, '5');
    const invita = screen.getByLabelText('Crédito para quien invita (dólares)');
    await userEvent.clear(invita);
    await userEvent.type(invita, '7.5');
    await userEvent.click(screen.getByLabelText('Invitaciones encendidas'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar invitaciones' }));
    await waitFor(() =>
      expect(puts).toEqual([{ activos: true, paraAmigo: 500, paraQuienInvita: 750 }]),
    );
  });
});
