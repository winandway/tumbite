import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperPlus } from './SuperPlus';

// C-PLUS en el panel: arranca en cero (apagado) y guarda cuota y mínimo en centavos.
describe('C-PLUS en el panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('manda la cuota y el mínimo en centavos y el porcentaje entero', async () => {
    const puts: unknown[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        puts.push(JSON.parse(String(init.body)));
        return new Response(String(init.body), { status: 200 });
      }
      return new Response(
        JSON.stringify({ centavosMes: 0, minimoSubtotal: 1200, servicioDescuentoPct: 50 }),
        { status: 200 },
      );
    });
    render(<SuperPlus idioma="es" />);
    const cuota = await screen.findByLabelText('Cuota mensual (dólares)');
    await waitFor(() => expect((cuota as HTMLInputElement).value).toBe('0'));
    await userEvent.clear(cuota);
    await userEvent.type(cuota, '9.99');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar Divoox Plus' }));
    await waitFor(() =>
      expect(puts).toEqual([{ centavosMes: 999, minimoSubtotal: 1200, servicioDescuentoPct: 50 }]),
    );
  });
});
