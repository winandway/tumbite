import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanillaPedidos } from './PlanillaPedidos';

// C-PLANILLA-PEDIDOS: el enlace descarga la planilla del rango elegido, en los dos idiomas.
describe('C-PLANILLA-PEDIDOS en el panel', () => {
  beforeEach(() => localStorage.clear());

  it('el enlace lleva el rango que escribió el restaurante', async () => {
    render(<PlanillaPedidos idioma="es" />);
    const desde = screen.getByLabelText('Desde');
    await userEvent.clear(desde);
    // C-FECHA-MODERNA: solo números; la región de la prueba es Estados Unidos (mes/día/año).
    await userEvent.type(desde, '10012026');
    const hasta = screen.getByLabelText('Hasta');
    await userEvent.clear(hasta);
    await userEvent.type(hasta, '10312026');
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
