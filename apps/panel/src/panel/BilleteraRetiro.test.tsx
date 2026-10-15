import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Billetera } from './Billetera';

/** Fase 0: un retiro que Stripe todavía confirma se muestra «En proceso», nunca «retirado». */
const usuario = {
  id: 'u1',
  nombre: 'Rosa',
  correo: 'rosa@ejemplo.com',
  rol: 'restaurante' as const,
  idioma: 'es' as const,
};

function servidor(retiro: { estado: string }, extra: Record<string, unknown> = {}) {
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/datos/billetera/retirar') && init?.method === 'POST')
      return new Response(JSON.stringify({ ok: true, saldo: 0, retiro: { id: 'r1', ...retiro } }), {
        status: 200,
      });
    if (u.includes('/datos/billetera'))
      return new Response(
        JSON.stringify({
          saldo: 1000,
          movimientos: [],
          cuentaConectada: true,
          pagosActivos: true,
          retirosActivos: true,
          retirosEnProceso: [],
          ...extra,
        }),
        { status: 200 },
      );
    return new Response(JSON.stringify({}), { status: 200 });
  });
}

describe('billetera del restaurante: retiros (Fase 0)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('si el retiro queda en proceso, dice «Retiro en proceso», no «Listo»', async () => {
    servidor({ estado: 'en_proceso' });
    render(<Billetera usuario={usuario} idioma="es" />);
    await userEvent.type(await screen.findByPlaceholderText('0.00'), '10');
    await userEvent.click(screen.getByRole('button', { name: /Retirar/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/Retiro en proceso/);
    expect(screen.getByRole('status')).not.toHaveTextContent(/Listo/);
  });

  it('si Stripe ya confirmó, dice que va en camino al banco', async () => {
    servidor({ estado: 'enviado' });
    render(<Billetera usuario={usuario} idioma="es" />);
    await userEvent.type(await screen.findByPlaceholderText('0.00'), '10');
    await userEvent.click(screen.getByRole('button', { name: /Retirar/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/va en camino a tu banco/);
  });

  it('muestra los retiros en proceso y, con los retiros en pausa, no ofrece retirar', async () => {
    servidor(
      { estado: 'enviado' },
      {
        retirosActivos: false,
        retirosEnProceso: [{ id: 'x', monto: 500, estado: 'reintentar', fecha: '2026-10-15' }],
      },
    );
    render(<Billetera usuario={usuario} idioma="es" />);
    expect(await screen.findByText(/Retiros en proceso/)).toBeInTheDocument();
    expect(screen.getByText(/En proceso/)).toBeInTheDocument();
    expect(screen.getByText(/en pausa/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('0.00')).not.toBeInTheDocument();
  });
});
