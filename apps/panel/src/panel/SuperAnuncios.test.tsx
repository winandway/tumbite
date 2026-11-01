import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperAnuncios } from './SuperAnuncios';

// C-ANUNCIOS en el panel: arranca en cero (apagado) y guarda el precio en centavos.
describe('C-ANUNCIOS en el panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('carga el precio y manda centavos y cupos', async () => {
    const puts: unknown[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        puts.push(JSON.parse(String(init.body)));
        return new Response(String(init.body), { status: 200 });
      }
      return new Response(JSON.stringify({ centavosPorPedido: 0, maxEnLista: 2 }), {
        status: 200,
      });
    });
    render(<SuperAnuncios idioma="es" />);
    const monto = await screen.findByLabelText('Por pedido del anuncio (dólares)');
    await waitFor(() => expect((monto as HTMLInputElement).value).toBe('0'));
    await userEvent.clear(monto);
    await userEvent.type(monto, '3');
    const presupuesto = screen.getByLabelText('Patrocinados arriba de la lista');
    await userEvent.clear(presupuesto);
    await userEvent.type(presupuesto, '1');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar anuncios' }));
    await waitFor(() => expect(puts).toEqual([{ centavosPorPedido: 300, maxEnLista: 1 }]));
    expect(await screen.findByRole('status')).toHaveTextContent('Guardado');
  });
});
