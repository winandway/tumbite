import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pedidos } from './Pedidos';

// C-TIENDAS-PESO-REAL (SIG-3, 2 nov 2026): la tienda escribe el peso real al preparar.
const linea = (extra: Record<string, unknown> = {}) => ({
  platoId: 'guineo',
  nombreEs: 'Guineos',
  nombreEn: 'Bananas',
  cantidad: 3,
  precioCentavos: 140,
  pesable: true,
  unidadPeso: 'kg',
  pesoEstimado: 2,
  ...extra,
});

function servidor(lineas: unknown[], estado = 'aceptado') {
  const enviados: { url: string; cuerpo: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      enviados.push({ url, cuerpo: JSON.parse(String(init.body)) });
      return new Response('{"ok":true}', { status: 200 });
    }
    return new Response(
      JSON.stringify({
        pedidos: [
          {
            id: 'p-1',
            estado,
            subtotal: 420,
            notas: '',
            creadoEn: '2026-11-02 20:00:00',
            pagadoEn: '2026-11-02 20:00:00',
            aceptadoEn: '2026-11-02 20:01:00',
            listoEn: null,
            recogidoEn: null,
            tiempoPrepMin: 15,
            lineas,
          },
        ],
      }),
      { status: 200 },
    );
  });
  return enviados;
}

describe('peso real de lo que se vende por peso (C-TIENDAS-PESO-REAL)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('escribe el peso real y lo manda al servidor', async () => {
    const enviados = servidor([linea()]);
    render(<Pedidos idioma="es" />);
    expect(await screen.findByText(/Pésalo y escribe el peso real/)).toBeTruthy();
    const guardar = screen.getByRole('button', { name: 'Guardar peso' });
    expect((guardar as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(screen.getByLabelText('Peso real (kg)'), '6.5');
    await userEvent.click(guardar);
    await waitFor(() =>
      expect(enviados).toContainEqual({
        url: expect.stringContaining('/datos/restaurante/pedidos/p-1/pesos'),
        cuerpo: { pesos: [{ platoId: 'guineo', linea: 0, peso: 6.5 }] },
      }),
    );
  });

  it('ya pesado muestra estimado → real, y listo ya no deja cambiarlo (en inglés)', async () => {
    servidor([linea({ pesoReal: 6.5 })], 'listo');
    render(<Pedidos idioma="en" />);
    expect(await screen.findByText(/Estimated weight 6 kg → actual weight 6\.5 kg/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save weight' })).toBeNull();
  });
});
