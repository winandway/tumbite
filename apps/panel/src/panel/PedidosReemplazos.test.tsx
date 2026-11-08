import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pedidos } from './Pedidos';

// C-TIENDAS-REEMPLAZOS (29 oct 2026): la tienda marca lo que falta y propone hasta tres reemplazos.
describe('reemplazos al marcar un producto que falta (C-TIENDAS-REEMPLAZOS)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('busca en su catálogo, elige reemplazos y los manda con el aviso', async () => {
    const enviados: { url: string; cuerpo: unknown }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        enviados.push({ url, cuerpo: JSON.parse(String(init.body)) });
        return new Response('{"ok":true}', { status: 200 });
      }
      if (url.includes('/mi-restaurante/productos'))
        return new Response(
          JSON.stringify({
            productos: [
              { id: 'agua', nombreEs: 'Agua', nombreEn: 'Water', disponible: true },
              { id: 'soda', nombreEs: 'Soda agotada', nombreEn: 'Soda', disponible: false },
            ],
          }),
          { status: 200 },
        );
      return new Response(
        JSON.stringify({
          pedidos: [
            {
              id: 'p-1',
              estado: 'pagado',
              subtotal: 350,
              notas: '',
              creadoEn: '2026-10-29 20:00:00',
              pagadoEn: '2026-10-29 20:00:00',
              aceptadoEn: null,
              listoEn: null,
              recogidoEn: null,
              tiempoPrepMin: 15,
              lineas: [
                {
                  platoId: 'jugo',
                  nombreEs: 'Jugo',
                  nombreEn: 'Juice',
                  cantidad: 1,
                  precioCentavos: 350,
                  sustitucion: 'contactar',
                },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    });
    render(<Pedidos idioma="es" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Más opciones' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Falta un producto' }));
    // C-COMANDA-COMPLETA: arriba también está «Ancho del papel»; el de lo que falta es el otro.
    const falta = screen
      .getAllByRole('combobox')
      .find((s) => s.getAttribute('aria-label') !== 'Ancho del papel');
    await userEvent.selectOptions(falta!, 'jugo');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar un producto' }), 'agua');
    const agua = await screen.findByRole('checkbox', { name: 'Agua' });
    // Lo agotado no se ofrece.
    expect(screen.queryByRole('checkbox', { name: 'Soda agotada' })).toBeNull();
    await userEvent.click(agua);
    await userEvent.click(screen.getByRole('button', { name: 'Avisar al cliente' }));
    await waitFor(() =>
      expect(enviados).toContainEqual({
        url: expect.stringContaining('/datos/restaurante/pedidos/p-1/falta'),
        cuerpo: { platoId: 'jugo', propuestas: ['agua'] },
      }),
    );
  });
});
