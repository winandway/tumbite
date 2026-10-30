import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pedidos } from './Pedidos';

// C-ACEPTAR-SOLO (30 oct 2026): el interruptor de aceptación automática en la pantalla de pedidos.
describe('aceptar pedidos automáticamente (C-ACEPTAR-SOLO)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('muestra cómo está y lo cambia en el servidor', async () => {
    const cambios: unknown[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH' && url.includes('/mi-restaurante/aceptar-solo')) {
        cambios.push(JSON.parse(String(init.body)));
        return new Response('{"ok":true}', { status: 200 });
      }
      if (url.endsWith('/datos/mi-restaurante'))
        return new Response(JSON.stringify({ restaurante: { id: 'r1', aceptarSolo: false } }), {
          status: 200,
        });
      return new Response(JSON.stringify({ pedidos: [], prepSugerida: 20, cocinaOcupada: 0 }), {
        status: 200,
      });
    });
    render(<Pedidos idioma="es" />);
    const sw = await screen.findByRole('checkbox', { name: 'Aceptar pedidos automáticamente' });
    expect(sw).not.toBeChecked();
    await userEvent.click(sw);
    await waitFor(() => expect(cambios).toEqual([{ activo: true }]));
    expect(sw).toBeChecked();
  });
});
