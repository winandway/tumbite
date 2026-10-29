import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CiudadesWeb } from './CiudadesWeb';

// C-CIUDADES-WEB: el superadmin anuncia una ciudad en la web, siempre con confirmación.
describe('C-CIUDADES-WEB en el superadmin', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('anunciar Miami pide confirmar y manda el cambio', async () => {
    const llamadas: { url: string; metodo: string; cuerpo?: unknown }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      llamadas.push({
        url,
        metodo: init?.method ?? 'GET',
        cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return new Response(
        JSON.stringify(init?.method === 'PUT' ? { ok: true } : { ciudades: [] }),
        {
          status: 200,
        },
      );
    });
    render(<CiudadesWeb idioma="es" />);
    const botones = await screen.findAllByRole('button', { name: 'Anunciar en la web' });
    await userEvent.click(botones[0]!);
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false);
    expect(screen.getByText('¿Anunciar Miami al público ahora?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sí, cambiar' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(true));
    const put = llamadas.find((l) => l.metodo === 'PUT')!;
    expect(put.url).toMatch(/\/datos\/admin\/web\/ciudades\/miami$/);
    expect(put.cuerpo).toEqual({ estado: 'activo' });
  });
});
