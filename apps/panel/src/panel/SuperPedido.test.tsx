import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SuperPedido } from './SuperPedido';

const ID = '11111111-2222-3333-4444-555555555555';

describe('bitácora del pedido en el superadmin (C-MANAGER-1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('muestra los datos, enlaza a las fichas y cuenta lo que hizo el Manager', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            pedido: {
              id: ID,
              estado: 'cancelado',
              total: 3400,
              propina: 400,
              direccion: '200 Calle Prueba',
              notas: 'Sin cebolla',
              ciudad: 'Miami',
              pagoStripe: 'pi_1',
              lineas: [{ nombre: 'Cubano', cantidad: 2 }],
              cliente: { id: 'c1', nombre: 'Ana Cliente' },
              restaurante: { id: 'r1', nombre: 'La Esquina' },
              repartidor: null,
              bitacora: [
                {
                  evento: 'creado',
                  fecha: '2026-10-12 20:00:00',
                  quien: 'Ana Cliente',
                  tipo: 'estado',
                },
                {
                  evento: 'recordatorio_1',
                  fecha: '2026-10-12 20:04:00',
                  quien: '4 min',
                  tipo: 'manager',
                },
                { evento: 'cancelado', fecha: '2026-10-12 20:11:00', quien: null, tipo: 'estado' },
                {
                  evento: 'cancelado_sin_respuesta',
                  fecha: '2026-10-12 20:11:00',
                  quien: '11 min',
                  tipo: 'manager',
                },
              ],
            },
          }),
          { status: 200 },
        ),
    );
    render(<SuperPedido base="/panel/control-x" id={ID} idioma="es" />);
    expect(await screen.findByText('#111111')).toBeTruthy();
    expect(screen.getAllByText('Ana Cliente')[0]?.closest('a')?.getAttribute('href')).toBe(
      '/panel/control-x/clientes/c1',
    );
    expect(screen.getByText('Sin repartidor')).toBeTruthy();
    expect(screen.getByText(/Recordatorio al restaurante/)).toBeTruthy();
    expect(screen.getByText(/Cancelado solo: el restaurante no respondió/)).toBeTruthy();
    expect(screen.getByText('2 × Cubano')).toBeTruthy();
  });

  it('si el pedido no existe, lo dice', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify({ error: 'Ese pedido no existe.' }), { status: 404 }),
    );
    render(<SuperPedido base="/panel/control-x" id={ID} idioma="en" />);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
