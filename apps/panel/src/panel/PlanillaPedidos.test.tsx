import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanillaPedidos } from './PlanillaPedidos';

// C-PLANILLA-PEDIDOS: el enlace descarga la planilla del rango elegido, en los dos idiomas.
describe('C-PLANILLA-PEDIDOS en el panel', () => {
  beforeEach(() => localStorage.clear());

  it('el enlace lleva el rango que escribió el restaurante', async () => {
    render(<PlanillaPedidos idioma="es" />);
    const desde = screen.getByLabelText('Desde (AAAA-MM-DD)');
    await userEvent.clear(desde);
    await userEvent.type(desde, '2026-10-01');
    const hasta = screen.getByLabelText('Hasta (AAAA-MM-DD)');
    await userEvent.clear(hasta);
    await userEvent.type(hasta, '2026-10-31');
    expect(screen.getByRole('link', { name: 'Descargar planilla' })).toHaveAttribute(
      'href',
      '/datos/mi-restaurante/pedidos/planilla?desde=2026-10-01&hasta=2026-10-31',
    );
  });

  it('en inglés', () => {
    render(<PlanillaPedidos idioma="en" />);
    expect(screen.getByRole('link', { name: 'Download spreadsheet' })).toBeInTheDocument();
  });
});
