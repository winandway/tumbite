import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TableroRestaurante } from './TableroRestaurante';

// C-RENDIMIENTO-REST: el tablero del restaurante muestra horas, días y clientes.
describe('C-RENDIMIENTO-REST en el panel', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('dibuja pedidos por hora y por día, y clientes nuevos, que repiten y cancelados', async () => {
    const porHora = Array.from({ length: 24 }, (_, h) => ({
      pedidos: h === 12 ? 3 : 0,
      ventas: 0,
    }));
    const porDia = Array.from({ length: 7 }, (_, d) => ({ pedidos: d === 4 ? 3 : 0, ventas: 0 }));
    const periodo = { pedidos: 3, ventas: 3000, neto: 2500, ticketPromedio: 1000 };
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            tablero: {
              moneda: 'USD',
              semana: periodo,
              mes: periodo,
              topPlatos: [],
              minutosCocina: null,
              minutosPrometidos: null,
              calificacion: null,
              calificaciones: 0,
              pedidosAhora: 0,
              porHora,
              porDia,
              clientes: { nuevos: 2, recurrentes: 1, nuevosQueVolvieron: 1 },
              canceladosMes: 1,
            },
          }),
          { status: 200 },
        ),
    );
    render(<TableroRestaurante nombre="Prueba" idioma="es" />);
    expect(await screen.findByText('Pedidos por hora (últimos 30 días)')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '12: 3' })).toBeInTheDocument();
    expect(screen.getByText('Pedidos por día (últimos 30 días)')).toBeInTheDocument();
    expect(screen.getByText('Nuevos').nextSibling?.textContent).toBe('2');
    expect(screen.getByText('Repiten').nextSibling?.textContent).toBe('2');
    expect(screen.getByText('Cancelados').nextSibling?.textContent).toBe('1');
  });
});
