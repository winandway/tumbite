import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Confirmar } from './Confirmar';

describe('confirmar el correo', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('manda el token del enlace y dice que quedó confirmado', async () => {
    window.history.pushState(null, '', '/confirm-email?token=enlace-de-prueba-de-la-pantalla');
    const llamadas: string[] = [];
    vi.stubGlobal('fetch', async (_u: string, init: RequestInit) => {
      llamadas.push(String(init.body));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    render(<Confirmar idioma="es" />);
    expect(await screen.findByText('Tu correo quedó confirmado. Gracias.')).toBeInTheDocument();
    expect(llamadas[0]).toContain('enlace-de-prueba-de-la-pantalla');
  });

  it('si el enlace venció lo dice en palabras claras', async () => {
    window.history.pushState(null, '', '/confirm-email?token=enlace-de-prueba-de-la-pantalla');
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({ error: 'Este enlace ya no sirve. Entra a tu cuenta y pide otro.' }),
          {
            status: 410,
          },
        ),
    );
    render(<Confirmar idioma="es" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('ya no sirve');
  });
});
