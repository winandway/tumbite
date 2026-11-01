import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Anuncios } from './Anuncios';

// C-ANUNCIOS en el panel del restaurante: apagado dice «muy pronto»; encendido guarda en centavos.
describe('C-ANUNCIOS en el panel del restaurante', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('apagado: no hay formulario, solo el aviso', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            disponible: false,
            moneda: 'USD',
            centavosPorPedido: 0,
            campana: null,
            dias: [],
          }),
          { status: 200 },
        ),
    );
    render(<Anuncios usuario={{ id: 'u1' }} idioma="es" />);
    expect(await screen.findByRole('status')).toHaveTextContent('muy pronto');
    expect(screen.queryByRole('button', { name: 'Guardar anuncio' })).toBeNull();
  });

  it('encendido: manda el presupuesto en centavos y muestra lo gastado', async () => {
    const puts: unknown[] = [];
    const resumen = {
      disponible: true,
      moneda: 'USD',
      centavosPorPedido: 300,
      campana: { activa: true, presupuestoSemanalCentavos: 5000, gastoSemanaCentavos: 600 },
      dias: [{ dia: '2026-11-01', impresiones: 40, toques: 6, pedidos: 2, gasto: 600 }],
    };
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') puts.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify(resumen), { status: 200 });
    });
    render(<Anuncios usuario={{ id: 'u1' }} idioma="es" />);
    const presupuesto = await screen.findByLabelText('Presupuesto semanal');
    await waitFor(() => expect((presupuesto as HTMLInputElement).value).toBe('50'));
    expect(screen.getByText('Gastado en los últimos 7 días', { exact: false })).toBeInTheDocument();
    await userEvent.clear(presupuesto);
    await userEvent.type(presupuesto, '80');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar anuncio' }));
    await waitFor(() => expect(puts).toEqual([{ activa: true, presupuestoSemanalCentavos: 8000 }]));
  });
});
