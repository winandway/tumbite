import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperRewards } from './SuperRewards';

// C-REWARDS-AJUSTES en el panel: se cargan los ajustes, se cambian y viajan en centavos.
describe('C-REWARDS-AJUSTES en el panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('carga los ajustes y manda el porcentaje, el tope en centavos y el presupuesto', async () => {
    const llamadas: { metodo: string; cuerpo?: unknown }[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      const metodo = init?.method ?? 'GET';
      llamadas.push({ metodo, cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (metodo === 'PUT') return new Response(JSON.stringify({ ok: true }), { status: 200 });
      return new Response(
        JSON.stringify({
          ajustes: {
            umbrales: { plata: 63, oro: 77, diamante: 85 },
            porcentajeMargen: 0,
            topePremioCentavos: 0,
            hitoUnidades: 100,
          },
          presupuestos: [],
        }),
        { status: 200 },
      );
    });
    render(<SuperRewards idioma="es" />);
    const porcentaje = await screen.findByLabelText('Porcentaje del margen (%)');
    await waitFor(() => expect((porcentaje as HTMLInputElement).value).toBe('0'));
    await userEvent.clear(porcentaje);
    await userEvent.type(porcentaje, '15');
    const tope = screen.getByLabelText('Tope por premio (USD)');
    await userEvent.clear(tope);
    await userEvent.type(tope, '50');
    await userEvent.type(screen.getByLabelText('Monto (USD)'), '200');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ajustes' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'PUT')?.cuerpo).toMatchObject({
        umbrales: { plata: 63, oro: 77, diamante: 85 },
        porcentajeMargen: 15,
        topePremioCentavos: 5000,
        hitoUnidades: 100,
        presupuesto: { zona: 'US-FL-MIAMI', centavos: 20000 },
      }),
    );
  });
});
