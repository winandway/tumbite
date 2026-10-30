import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { CONFIG_DINERO_INICIAL } from '@tumbite/compartido';
import userEvent from '@testing-library/user-event';
import { App } from '../App';

describe('calculadora pública (C-CALCULADORA)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('abre en restaurantes con lo que le queda en cada app y cambia de pestaña', async () => {
    window.history.pushState(null, '', '/es/calculator');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    const panel = within(screen.getByRole('main')).getByRole('tabpanel');
    expect(panel).toHaveTextContent(/9[.,]250/);
    expect(panel).toHaveTextContent(/8[.,]500/);
    const pestanas = within(screen.getByRole('main')).getAllByRole('tab');
    expect(pestanas).toHaveLength(4);
    await userEvent.click(pestanas[3]!);
    expect(pestanas[3]).toHaveAttribute('aria-selected', 'true');
    expect(window.location.hash).not.toBe('');
  });

  it('existe también en inglés', () => {
    window.history.pushState(null, '', '/calculator');
    render(<App />);
    expect(within(screen.getByRole('main')).getAllByRole('tab')).toHaveLength(4);
    expect(within(screen.getByRole('main')).getByRole('tabpanel')).toHaveTextContent(/9,250/);
  });

  // C-CALCULADORA-EN-VIVO: la comisión que cambia el superadmin llega a la calculadora pública.
  it('usa la comisión que tiene hoy el servidor, no la fija', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      String(url).endsWith('/datos/config-dinero')
        ? new Response(
            JSON.stringify({
              config: {
                ...CONFIG_DINERO_INICIAL,
                comisionPb: { inicial: 500, crece: 1250, elite: 1500 },
              },
            }),
            { status: 200 },
          )
        : new Response('{}', { status: 404 }),
    );
    window.history.pushState(null, '', '/calculator');
    render(<App />);
    const panel = within(screen.getByRole('main')).getByRole('tabpanel');
    // Con 5 % en vez de 7,5 %, de 10 000 dólares quedan 9 500.
    await waitFor(() => expect(panel).toHaveTextContent(/9,500/));
    expect(panel).toHaveTextContent(/Starter \(5 %\)/);
  });
});
