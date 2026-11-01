import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperGanarPorTiempo } from './SuperGanarPorTiempo';

// C-GANAR-POR-TIEMPO en el panel: arranca en cero (apagado) y guarda en centavos.
describe('C-GANAR-POR-TIEMPO en el panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('carga la tarifa y manda hora y milla en centavos', async () => {
    const puts: unknown[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        puts.push(JSON.parse(String(init.body)));
        return new Response(String(init.body), { status: 200 });
      }
      return new Response(JSON.stringify({ centavosHora: 0, centavosMilla: 0 }), {
        status: 200,
      });
    });
    render(<SuperGanarPorTiempo idioma="es" />);
    const monto = await screen.findByLabelText('Por hora activa (dólares)');
    await waitFor(() => expect((monto as HTMLInputElement).value).toBe('0'));
    await userEvent.clear(monto);
    await userEvent.type(monto, '25');
    const presupuesto = screen.getByLabelText('Por milla (dólares)');
    await userEvent.clear(presupuesto);
    await userEvent.type(presupuesto, '0.5');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ganar por tiempo' }));
    await waitFor(() => expect(puts).toEqual([{ centavosHora: 2500, centavosMilla: 50 }]));
    expect(await screen.findByRole('status')).toHaveTextContent('Guardado');
  });
});
