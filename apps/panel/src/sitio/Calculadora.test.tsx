import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
});
