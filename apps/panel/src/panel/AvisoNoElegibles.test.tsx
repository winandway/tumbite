import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AvisoNoElegibles } from './AvisoNoElegibles';

/** C-APROBADOS-NO-ELEGIBLES: la franja roja dice quién no recibe viajes y por qué; vacía, no se ve. */
describe('franja de aprobados que el reparto no toma', () => {
  afterEach(() => vi.unstubAllGlobals());
  const con = (conductores: unknown[]) =>
    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify({ conductores }), { status: 200 }),
    );

  it('lista cada conductor con su motivo en palabras y enlace a su ficha', async () => {
    con([{ conductorId: 'c1', codigo: 'XX-AAA-000001', motivo: 'sin_vehiculo_activo' }]);
    render(<AvisoNoElegibles base="/panel/super" idioma="es" />);
    expect(await screen.findByTestId('aviso-no-elegibles')).toHaveTextContent(
      'Un conductor aprobado no puede recibir viajes:XX-AAA-000001 · no tiene vehículo en uso',
    );
    expect(screen.getByRole('link', { name: 'XX-AAA-000001' })).toHaveAttribute(
      'href',
      '/panel/super/drivers/c1',
    );
  });

  it('en inglés, y sin nadie trabado no muestra nada', async () => {
    con([{ conductorId: 'c2', codigo: 'XX-AAA-000002', motivo: 'servicio_apagado' }]);
    const { unmount } = render(<AvisoNoElegibles base="/panel/super" idioma="en" />);
    expect(await screen.findByText(/they turned their service off in Driver/)).toBeInTheDocument();
    unmount();
    con([]);
    render(<AvisoNoElegibles base="/panel/super" idioma="es" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('aviso-no-elegibles')).toBeNull();
  });
});
