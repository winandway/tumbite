import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pedidos } from './Pedidos';

/**
 * BRE-R (2 y 3, revisor de calidad, 2 nov 2026): el pedido de prueba (C-PEDIDO-PRUEBA) no ofrece
 * «Reportar un problema» (soporte no lo encuentra y terminaba en «Ese pedido no existe») ni el QR
 * de recogida, que salía con el número «PRUE». Su número es el de la insignia. Todos los países.
 */
const pedido = (extra: Record<string, unknown>) => ({
  estado: 'listo',
  subtotal: 1500,
  notas: '',
  creadoEn: '2026-11-02 20:00:00',
  pagadoEn: '2026-11-02 20:00:00',
  aceptadoEn: '2026-11-02 20:01:00',
  listoEn: '2026-11-02 20:10:00',
  recogidoEn: null,
  tiempoPrepMin: 15,
  lineas: [
    { platoId: 'pl', nombreEs: 'Cubano', nombreEn: 'Cuban', cantidad: 1, precioCentavos: 1500 },
  ],
  ...extra,
});

function servidor(pedidos: unknown[]) {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(JSON.stringify({ pedidos, prepSugerida: 20, cocinaOcupada: 0 }), {
        status: 200,
      }),
  );
}

describe('pedido de prueba sin «Reportar» ni QR (BRE-R)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('el de prueba no ofrece reportar ni QR; uno real sí', async () => {
    servidor([pedido({ id: 'prueba-ab12cd34', prueba: true })]);
    const { unmount } = render(<Pedidos idioma="es" />);
    expect(await screen.findByText(/#AB12/)).toBeTruthy();
    expect(screen.queryByText('PRUE')).toBeNull();
    expect(screen.queryByRole('img', { name: /^QR/ })).toBeNull();
    const mas = screen.queryByRole('button', { name: 'Más opciones' });
    if (mas) {
      await userEvent.click(mas);
      expect(screen.queryByRole('menuitem', { name: 'Reportar un problema' })).toBeNull();
    }
    unmount();
    servidor([pedido({ id: 'real-9999' })]);
    render(<Pedidos idioma="es" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Más opciones' }));
    expect(await screen.findByRole('menuitem', { name: 'Reportar un problema' })).toBeTruthy();
    expect(await screen.findByRole('img', { name: /^QR/ })).toBeTruthy();
  });
});
