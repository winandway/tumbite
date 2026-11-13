import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperCiudad } from './SuperCiudad';

// C-CIUDAD-PRUEBAS en el panel: la ciudad de pruebas en vivo solo mira (GET) y «Parar» pide parar.
vi.mock('leaflet', () => ({}));

const VIVO = {
  sesion: {
    id: 'ciudad-1',
    estado: 'corriendo',
    inicio: '2026-11-13 10:00:00',
    fin: null,
    meta: { pedidos: 20, minutos: 15 },
    fallos: [
      {
        cuando: '2026-11-13T10:05:00Z',
        comportamiento: 'doble toque',
        mensaje: 'Pedido 4 · doble toque: respondió 409',
      },
    ],
  },
  porEstado: { en_camino: 2, entregado: 3, cancelado: 1 },
  clientesComprando: 2,
  restaurantesVendiendo: 1,
  ventas: { entregados: 3, total: 6420, moneda: 'USD', cancelados: 1 },
  pedidos: [
    {
      id: 'p1',
      estado: 'entregado',
      total: 2140,
      moneda: 'USD',
      restaurante: 'Cocina de la ciudad 1 (simulado)',
      creadoEn: '2026-11-13 10:02:00',
    },
  ],
  restaurantes: [],
  repartidores: [
    {
      id: 'r1',
      nombre: 'Repartidor Simulado',
      conectado: true,
      ocupado: true,
      lat: null,
      lng: null,
      ubicacionEn: '2026-11-13 10:04:30',
    },
    {
      id: 'r2',
      nombre: 'Otro Simulado',
      conectado: false,
      ocupado: false,
      lat: null,
      lng: null,
      ubicacionEn: null,
    },
  ],
};

describe('C-CIUDAD-PRUEBAS en el panel', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('muestra la sesión en vivo, con sus cifras, repartidores y fallos; mirar solo hace GET', async () => {
    const metodos: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      metodos.push(`${init?.method ?? 'GET'} ${url}`);
      if ((init?.method ?? 'GET') === 'POST')
        return new Response(JSON.stringify({ ok: true, pedida: true }), { status: 200 });
      return new Response(JSON.stringify(VIVO), { status: 200 });
    });
    render(<SuperCiudad idioma="es" />);
    expect(await screen.findByText(/Sesión ciudad-1/)).toBeTruthy();
    const cifras = screen.getByRole('list', { name: 'Ciudad de pruebas' });
    expect(within(cifras).getByText('Clientes comprando').nextSibling?.textContent).toBe('2');
    expect(within(cifras).getByText('Repartidores conectados').nextSibling?.textContent).toBe(
      '1 / 2',
    );
    expect(within(cifras).getByText('Ventas entregadas').nextSibling?.textContent).toBe('$64.20');
    expect(screen.getByText('Con pedido')).toBeTruthy();
    expect(screen.getByText('Desconectado')).toBeTruthy();
    expect(screen.getByText(/respondió 409/)).toBeTruthy();
    expect(metodos.every((m) => m.startsWith('GET /datos/admin/ciudad-pruebas'))).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Parar la sesión' }));
    await waitFor(() => expect(metodos).toContain('POST /datos/admin/ciudad-pruebas/parar'));
    expect(await screen.findByText(/la sesión termina los pedidos en curso/)).toBeTruthy();
  });

  it('sin sesiones, dice cómo se arranca (en inglés también)', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify({ sesion: null }), { status: 200 }),
    );
    render(<SuperCiudad idioma="en" />);
    expect(await screen.findByText('There’s no test city session yet.')).toBeTruthy();
    expect(screen.getByText(/Run workflow/)).toBeTruthy();
  });
});
