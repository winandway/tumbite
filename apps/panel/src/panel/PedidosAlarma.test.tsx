import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pedidos } from './Pedidos';

/**
 * C-ALARMA-SIEMPRE (8 nov 2026, Richard): el primer pedido de prueba (E140) no sonó porque la
 * alarma solo se armaba al tocar «Activar sonido». Ahora suena sola con un pedido nuevo; si el
 * navegador la bloquea, sale un aviso grande y cualquier toque la destraba. Todos los países.
 */
const nuevo = {
  id: 'e140e994-0000',
  estado: 'pagado',
  subtotal: 800,
  notas: '',
  creadoEn: '2026-11-08 21:42:17',
  pagadoEn: '2026-11-08 21:42:27',
  aceptadoEn: null,
  listoEn: null,
  recogidoEn: null,
  tiempoPrepMin: 20,
  lineas: [
    { platoId: 'pl', nombreEs: 'Pizza', nombreEn: 'Pizza', cantidad: 1, precioCentavos: 800 },
  ],
};

function preparar(bloquear: boolean) {
  const play = vi.fn(() =>
    bloquear ? Promise.reject(new Error('NotAllowed')) : Promise.resolve(),
  );
  class AudioFalso {
    loop = false;
    play = play;
    pause = vi.fn();
  }
  vi.stubGlobal('Audio', AudioFalso);
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(
        JSON.stringify({ pedidos: [nuevo], prepSugerida: 20, cocinaOcupada: 0, restaurante: {} }),
        {
          status: 200,
        },
      ),
  );
  return play;
}

describe('C-ALARMA-SIEMPRE', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('un pedido nuevo hace sonar la alarma sin tocar ningún botón', async () => {
    const play = preparar(false);
    render(<Pedidos idioma="es" />);
    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(screen.queryByTestId('alarma-bloqueada')).toBeNull();
  });

  it('si el navegador la bloquea, avisa en grande y un toque la destraba', async () => {
    const play = preparar(true);
    render(<Pedidos idioma="es" />);
    const aviso = await screen.findByTestId('alarma-bloqueada');
    expect(aviso.textContent).toMatch(/silenció la alarma/);
    play.mockImplementation(() => Promise.resolve());
    await userEvent.click(aviso);
    await waitFor(() => expect(screen.queryByTestId('alarma-bloqueada')).toBeNull());
  });
});
