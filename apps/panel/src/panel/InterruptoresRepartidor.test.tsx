import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InterruptoresRepartidor } from './InterruptoresRepartidor';

afterEach(() => vi.unstubAllGlobals());

describe('G3 y G4b: interruptores de repartidores en el superadmin', () => {
  it('muestra el estado y guarda el cambio de los papeles', async () => {
    const cuerpos: unknown[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') cuerpos.push(JSON.parse(String(init.body)));
      const r =
        init?.method === 'PUT'
          ? JSON.parse(String(init.body))
          : { edadPorEstado: true, papelesVehiculo: false };
      return new Response(JSON.stringify(r), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    render(<InterruptoresRepartidor idioma="es" />);
    const papeles = await screen.findByRole('checkbox', { name: /Licencia y seguro vigentes/ });
    expect((papeles as HTMLInputElement).checked).toBe(false);
    expect(
      (screen.getByRole('checkbox', { name: /Edad mínima/ }) as HTMLInputElement).checked,
    ).toBe(true);
    await userEvent.click(papeles);
    expect(await screen.findByText('Guardado.')).toBeTruthy();
    expect(cuerpos).toEqual([{ edadPorEstado: true, papelesVehiculo: true }]);
  });
});
