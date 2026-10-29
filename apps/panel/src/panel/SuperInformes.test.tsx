import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperInformes } from './SuperInformes';

// C-INFORMES en el panel: tabla por ciudad y moneda, y el enlace al CSV con el mismo rango.
describe('C-INFORMES en el panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('muestra el informe y ofrece el CSV del mismo rango', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            filas: [
              {
                zona: 'US-FL-MIAMI',
                ciudad: 'Miami',
                moneda: 'USD',
                pedidos: 2,
                entregados: 1,
                cancelados: 1,
                ventas: 2000,
                cobrado: 2798,
                propinas: 200,
                plataforma: 300,
              },
            ],
          }),
          { status: 200 },
        ),
    );
    render(<SuperInformes idioma="es" />);
    await userEvent.click(screen.getByRole('button', { name: 'Ver informe' }));
    expect(await screen.findByText('Miami')).toBeInTheDocument();
    expect(screen.getByText('$3.00')).toBeInTheDocument();
    const csv = screen.getByRole('link', { name: 'Descargar CSV' });
    expect(csv.getAttribute('href')).toMatch(
      /\/datos\/admin\/informes\?desde=\d{4}-\d{2}-\d{2}&hasta=\d{4}-\d{2}-\d{2}&formato=csv$/,
    );
  });
});
