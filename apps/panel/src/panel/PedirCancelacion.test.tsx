import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PedirCancelacion } from './PedirCancelacion';

/** C-CANCELAR-LISTO (todos los países): pedir a soporte la cancelación de un pedido listo. */
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('pedir la cancelación de un pedido listo', () => {
  it('elige el motivo, ve quién asume la comida y lo envía a soporte', async () => {
    const llamadas: { url: string; cuerpo: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        llamadas.push({ url, cuerpo: JSON.parse(String(init?.body ?? '{}')) });
        return new Response(JSON.stringify({ solicitud: { id: 's1' } }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    const alEnviar = vi.fn();
    render(
      <PedirCancelacion
        pedidoId="abcd1234efgh"
        idioma="es"
        alCerrar={() => {}}
        alEnviar={alEnviar}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'cliente_pidio');
    expect(screen.getByTestId('quien-paga').textContent).toContain(
      'el restaurante cobra la comida',
    );
    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'agotado');
    expect(screen.getByTestId('quien-paga').textContent).toContain('el restaurante no cobra');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar a soporte' }));
    await waitFor(() => expect(screen.getByTestId('cancelacion-enviada')).toBeTruthy());
    expect(llamadas[0]?.url).toContain('/datos/restaurante/pedidos/abcd1234efgh/pedir-cancelacion');
    expect(llamadas[0]?.cuerpo).toMatchObject({ motivo: 'agotado' });
    expect(alEnviar).toHaveBeenCalled();
  });

  it('si el servidor falla, lo escrito se queda en pantalla', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Elige el motivo de la cancelación.' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );
    render(
      <PedirCancelacion
        pedidoId="abcd1234efgh"
        idioma="es"
        alCerrar={() => {}}
        alEnviar={() => {}}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText('Lo lee nuestro equipo de soporte'), 'Algo');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar a soporte' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByDisplayValue('Algo')).toBeTruthy();
  });
});
