import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RetiroEnPunto } from './RetiroEnPunto';

/** C-FLEX-RETIRO en el panel: entregar en el mostrador manda el código, la cédula y el cobro. */
describe('RetiroEnPunto', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('en Venezuela pide la cédula y el cobro, y manda la entrega con Idempotency-Key', async () => {
    const llamadas: { url: string; cuerpo: unknown; clave: string | null }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const h = new Headers(init?.headers);
      llamadas.push({
        url,
        cuerpo: init?.body ? JSON.parse(String(init.body)) : null,
        clave: h.get('idempotency-key'),
      });
      return new Response(JSON.stringify({ entregado: true }));
    });
    const alCambiar = vi.fn();
    render(
      <RetiroEnPunto
        envio={{
          id: 'e1',
          estado: 'en_proceso',
          retiroVence: '2099-01-01',
          cobro: { monto: 2500, moneda: 'USD', estado: 'pendiente' },
        }}
        empresaId="emp1"
        pais="VE"
        idioma="es"
        alCambiar={alCambiar}
      />,
    );
    expect(screen.getByText(/Disponible para retirar hasta el 2099-01-01/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Número de seguimiento que trae'), 'DVXABC123');
    await userEvent.type(screen.getByLabelText('Cédula de quien retira'), 'V-12345678');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar la entrega' }));
    await waitFor(() => expect(alCambiar).toHaveBeenCalled());
    const r = llamadas.find((l) => l.url.endsWith('/retiro/entregar'))!;
    expect(r.clave).toBeTruthy();
    expect(r.cuerpo).toMatchObject({
      codigo: 'DVXABC123',
      documento: 'V-12345678',
      tercero: null,
      cobro: { metodo: 'efectivo_usd', monto: 2500, moneda: 'USD' },
    });
  });
});
