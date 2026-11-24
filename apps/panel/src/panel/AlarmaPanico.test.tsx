import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AlarmaPanico, debeSonar } from './AlarmaPanico';

/**
 * C-PANICO-PANEL (24 nov 2026) — todos los países. Un pánico sin atender pone el panel del equipo en
 * rojo y hace sonar la sirena propia aunque la pestaña esté detrás; «Silenciar» calla hasta el
 * próximo pánico nuevo.
 */
afterEach(() => vi.unstubAllGlobals());

describe('C-PANICO-PANEL', () => {
  it('suena solo con un pánico abierto que no se silenció', () => {
    expect(debeSonar(null, null)).toBe(false);
    expect(debeSonar({ cantidad: 0, ultimo: null }, null)).toBe(false);
    expect(debeSonar({ cantidad: 1, ultimo: 't1' }, null)).toBe(true);
    expect(debeSonar({ cantidad: 1, ultimo: 't1' }, 't1')).toBe(false);
    expect(debeSonar({ cantidad: 2, ultimo: 't2' }, 't1')).toBe(true);
  });

  it('franja roja con el enlace a atender, sirena en bucle y «Silenciar» la calla', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ cantidad: 1, ultimo: '2026-11-24 10:00:00' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const sonando: boolean[] = [];
    class AudioFalso {
      loop = false;
      play() {
        sonando.push(true);
        return Promise.resolve();
      }
      pause() {
        sonando.push(false);
      }
    }
    vi.stubGlobal('Audio', AudioFalso);
    render(<AlarmaPanico idioma="es" base="/equipo" />);
    const franja = await screen.findByTestId('alarma-panico');
    expect(franja).toHaveTextContent('PÁNICO sin atender');
    expect(screen.getByRole('link', { name: 'Ver y atender' })).toHaveAttribute(
      'href',
      '/equipo/rides',
    );
    await waitFor(() => expect(sonando).toContain(true));
    await userEvent.click(screen.getByRole('button', { name: 'Silenciar' }));
    expect(sonando.at(-1)).toBe(false);
    expect(screen.getByTestId('alarma-panico')).toBeInTheDocument();
  });
});
