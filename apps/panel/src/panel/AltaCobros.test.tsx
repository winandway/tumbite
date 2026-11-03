import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Billetera } from './Billetera';

vi.mock('@stripe/connect-js', () => ({ loadConnectAndInitialize: () => ({ fingido: true }) }));
vi.mock('@stripe/react-connect-js', () => ({
  ConnectComponentsProvider: ({ children }: { children: React.ReactNode }) => children,
  ConnectAccountOnboarding: () => <div data-testid="formulario-stripe" />,
}));

/**
 * C-ALTA-COBROS-DENTRO (SIG-5): «Conectar mi cuenta bancaria» abre el formulario de Stripe dentro
 * de Divoox; si no se puede (sin llave publicable), cae a la página de Stripe de siempre. EE. UU.
 */
const usuario = {
  id: 'u1',
  nombre: 'Rita',
  correo: 'rita@ejemplo.com',
  rol: 'repartidor' as const,
  idioma: 'es' as const,
};

function servidor(sesion: { estado: number; cuerpo: unknown }) {
  const llamadas: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    const u = String(url);
    llamadas.push(u);
    if (u.includes('/datos/billetera/sesion'))
      return new Response(JSON.stringify(sesion.cuerpo), { status: sesion.estado });
    if (u.includes('/datos/billetera/conectar'))
      return new Response(JSON.stringify({ url: 'https://connect.stripe.com/setup/x' }), {
        status: 200,
      });
    if (u.includes('/datos/billetera'))
      return new Response(
        JSON.stringify({
          saldo: 0,
          movimientos: [],
          cuentaConectada: false,
          pagosActivos: false,
          retirosActivos: true,
          retirosEnProceso: [],
        }),
        { status: 200 },
      );
    return new Response('{}', { status: 200 });
  });
  return llamadas;
}

describe('C-ALTA-COBROS-DENTRO: alta de cobros en el panel', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('pide la sesión del formulario de Stripe dentro de Divoox antes que la página de Stripe', async () => {
    const llamadas = servidor({ estado: 200, cuerpo: { clientSecret: 's', clavePublica: 'pk' } });
    render(<Billetera usuario={usuario} idioma="es" />);
    await userEvent.click(await screen.findByRole('button', { name: /Conectar mi cuenta/i }));
    await screen.findByTestId('formulario-stripe');
    expect(llamadas.some((u) => u.includes('/datos/billetera/sesion'))).toBe(true);
    expect(llamadas.some((u) => u.includes('/datos/billetera/conectar'))).toBe(false);
  });

  it('sin el formulario (422) cae a la página segura de Stripe y lo dice', async () => {
    const llamadas = servidor({ estado: 422, cuerpo: { error: 'no' } });
    const ir = vi.fn();
    vi.stubGlobal('location', {
      ...window.location,
      set href(v: string) {
        ir(v);
      },
    });
    render(<Billetera usuario={usuario} idioma="es" />);
    await userEvent.click(await screen.findByRole('button', { name: /Conectar mi cuenta/i }));
    expect(await screen.findByTestId('alta-cobros-aviso')).toHaveTextContent(
      /página segura de Stripe/,
    );
    await vi.waitFor(() =>
      expect(llamadas.some((u) => u.includes('/datos/billetera/conectar'))).toBe(true),
    );
  });
});
