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

  it('C-CIUDAD-JUEGO: enciende robot por robot, late mientras está abierta, muestra jugadores, pantalla grande y apaga', async () => {
    const metodos: string[] = [];
    let listos = 0;
    let encendida = false;
    const juego = () => ({
      sesion: {
        id: 'juego-1',
        estado: encendida ? 'corriendo' : 'terminada',
        inicio: '2026-11-13 10:00:00',
        fin: null,
        meta: {},
        fallos: [],
      },
      porEstado: { en_camino: 1 },
      clientesComprando: 1,
      restaurantesVendiendo: 1,
      ventas: { entregados: 1, total: 2650, moneda: 'USD', cancelados: 0 },
      pedidos: [],
      restaurantes: [],
      repartidores: [],
      juego: {
        encendida,
        segundosSinLatido: 2,
        quieta: false,
        filas: { sesion: 140, tope: 3000 },
        minutosMax: 60,
        robots: { listos, total: 7 },
        motivoFin: encendida ? null : 'la apagó el superadmin',
      },
      enCurso: [
        {
          id: 'p2',
          estado: 'en_camino',
          lat: null,
          lng: null,
          restauranteId: 'r1',
          repartidorId: 'm1',
          cliente: 'Mateo',
        },
      ],
      jugadores: [
        {
          nombre: 'Mateo Jugador',
          gastado: 2650,
          moneda: 'USD',
          fallos: [],
          pedidos: [
            {
              id: 'p1',
              estado: 'entregado',
              total: 2650,
              moneda: 'USD',
              metodoPago: 'efectivo',
              restaurante: 'Pizzería del Robot',
              platos: ['2 × Pizza de queso'],
              creadoEn: '2026-11-13 10:02:00',
              minutos: 6,
            },
          ],
        },
      ],
      erroresServidor: [],
    });
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const m = init?.method ?? 'GET';
      metodos.push(`${m} ${url}`);
      if (url.endsWith('/encender')) {
        encendida = true;
        listos = Math.min(7, listos + 1);
        return new Response(JSON.stringify({ sesion: 'juego-1', listos, total: 7 }), {
          status: 200,
        });
      }
      if (url.endsWith('/latido'))
        return new Response(JSON.stringify({ estado: 'corriendo' }), { status: 200 });
      if (url.endsWith('/apagar')) {
        encendida = false;
        return new Response(JSON.stringify({ estado: 'terminada' }), { status: 200 });
      }
      return new Response(JSON.stringify(listos ? juego() : { sesion: null }), { status: 200 });
    });
    render(<SuperCiudad idioma="es" />);
    // Mirar sin encender: solo GET, y se explica cómo se juega.
    expect(await screen.findByText('Cómo se juega')).toBeTruthy();
    expect(screen.getByText(/Efectivo al recibir/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Encender la ciudad' }));
    await waitFor(() => expect(metodos.filter((m) => m.endsWith('/encender'))).toHaveLength(7));
    expect(await screen.findByText('Encendida')).toBeTruthy();
    expect(screen.getByText(/140 de 3,000 filas/)).toBeTruthy();
    // El jugador con lo que compró.
    const jugadores = await screen.findByTestId('ciudad-jugadores');
    expect(within(jugadores).getByText('Mateo Jugador')).toBeTruthy();
    expect(within(jugadores).getByText(/2 × Pizza de queso/)).toBeTruthy();
    expect(within(jugadores).getByText(/Gastó \$26\.50/)).toBeTruthy();
    // C-CIUDAD-REPORTE: el reporte se arma en el navegador; no pide nada al servidor.
    const blobs: Blob[] = [];
    const crear = vi.fn((b: Blob) => {
      blobs.push(b);
      return 'blob:reporte';
    });
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: crear, revokeObjectURL: vi.fn() }));
    const antes = metodos.length;
    await userEvent.click(screen.getByTestId('ciudad-descargar-reporte'));
    expect(crear).toHaveBeenCalledTimes(1);
    expect(await blobs[0]!.text()).toContain('Mateo Jugador,pedido,2026-11-13 10:02:00');
    expect(
      metodos.slice(antes).filter((x) => !x.endsWith('/latido') && !x.startsWith('GET')),
    ).toEqual([]);
    // Con la ciudad encendida y la pantalla abierta, late (los robots avanzan).
    await waitFor(() => expect(metodos).toContain('POST /datos/admin/ciudad-pruebas/latido'), {
      timeout: 7_000,
    });
    // Pantalla grande: el mapa y los pedidos en curso en letras grandes.
    await userEvent.click(screen.getByRole('button', { name: 'Pantalla grande' }));
    expect(screen.getByTestId('super-ciudad').className).toContain('ciudad-tv');
    expect(screen.getByText('Pedidos en curso')).toBeTruthy();
    expect(screen.getByText(/Mateo ·/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Salir de la pantalla grande' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apagar la ciudad' }));
    await waitFor(() => expect(metodos).toContain('POST /datos/admin/ciudad-pruebas/apagar'));
    expect(await screen.findByText(/la apagó el superadmin/)).toBeTruthy();
  }, 15_000);

  it('C-CIUDAD-CIERRE: mientras termina las entregas lo dice y el botón pasa a «Apagar ya»', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.endsWith('/latido'))
        return new Response(JSON.stringify({ estado: 'corriendo' }), { status: 200 });
      return new Response(
        JSON.stringify({
          sesion: {
            id: 'juego-2',
            estado: 'corriendo',
            inicio: '2026-11-13 10:00:00',
            fin: null,
            meta: {},
            fallos: [],
          },
          porEstado: {},
          ventas: { entregados: 0, total: 0, moneda: 'USD', cancelados: 0 },
          pedidos: [],
          restaurantes: [],
          repartidores: [],
          juego: {
            encendida: true,
            segundosSinLatido: 1,
            quieta: false,
            filas: { sesion: 10, tope: 3000 },
            minutosMax: 60,
            robots: { listos: 7, total: 7 },
            motivoFin: null,
            cerrando: true,
          },
          enCurso: [],
          jugadores: [],
          erroresServidor: [],
        }),
        { status: 200 },
      );
    });
    render(<SuperCiudad idioma="es" />);
    expect(await screen.findByTestId('ciudad-cerrando')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Apagar ya' })).toBeTruthy();
  });
});
