import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Pedidos } from './Pedidos';

// C-LISTO-SIN-AJUSTE (11 nov 2026): mientras el cliente decide sobre un plato agotado, el panel no
// ofrece «¡Listo!» y dice por qué. Si se marcaba listo, el cliente ya no podía responder.
describe('«Listo» espera la respuesta del cliente sobre el plato que falta (C-LISTO-SIN-AJUSTE)', () => {
  afterEach(() => vi.unstubAllGlobals());

  function conPedido(estadoAjuste: 'pendiente' | 'quitado') {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            pedidos: [
              {
                id: 'p-1',
                estado: 'aceptado',
                subtotal: 1500,
                notas: '',
                creadoEn: '2026-11-11 20:00:00',
                pagadoEn: '2026-11-11 20:00:00',
                aceptadoEn: '2026-11-11 20:01:00',
                listoEn: null,
                recogidoEn: null,
                tiempoPrepMin: 15,
                ajuste: {
                  platoId: 'jugo',
                  nombreEs: 'Jugo',
                  nombreEn: 'Juice',
                  estado: estadoAjuste,
                  devolucion: 500,
                  creadoEn: '2026-11-11 20:02:00',
                },
                lineas: [
                  {
                    platoId: 'arroz',
                    nombreEs: 'Arroz',
                    nombreEn: 'Rice',
                    cantidad: 1,
                    precioCentavos: 1000,
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
    );
    render(<Pedidos idioma="es" />);
  }

  it('con el ajuste pendiente no hay botón «¡Listo!» y se ve la espera', async () => {
    conPedido('pendiente');
    expect(await screen.findByText(/Esperando su respuesta/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '¡Listo!' })).toBeNull();
  });

  it('resuelto el ajuste, vuelve el botón «¡Listo!»', async () => {
    conPedido('quitado');
    expect(await screen.findByRole('button', { name: '¡Listo!' })).toBeTruthy();
  });
});
