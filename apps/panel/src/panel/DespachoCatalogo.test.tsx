import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DespachoCatalogo } from './DespachoCatalogo';

afterEach(() => vi.unstubAllGlobals());

describe('C-DESPACHO-CATALOGO: interruptor por zona en el superadmin', () => {
  it('nace apagado, lo enciende en una zona y muestra el error si el servidor no deja', async () => {
    const llamadas: { url: string; cuerpo: unknown }[] = [];
    let falla = false;
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        llamadas.push({ url, cuerpo: JSON.parse(String(init.body)) });
        if (falla)
          return new Response(JSON.stringify({ error: 'Comida no está disponible en esa zona.' }), {
            status: 409,
            headers: { 'content-type': 'application/json' },
          });
        return new Response(JSON.stringify({ zonaId: 'US-FL-MIAMI', activo: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          zonas: [
            { id: 'US-FL-MIAMI', nombre: 'Miami', activo: false },
            { id: 'US-MI-NOVI', nombre: 'Novi', activo: false },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    render(<DespachoCatalogo idioma="es" />);
    const miami = await screen.findByRole('checkbox', { name: 'Miami' });
    expect((miami as HTMLInputElement).checked).toBe(false);
    await userEvent.click(miami);
    expect(await screen.findByText('Guardado.')).toBeTruthy();
    expect((miami as HTMLInputElement).checked).toBe(true);
    expect(llamadas[0]).toEqual({
      url: '/datos/admin/despacho-catalogo/US-FL-MIAMI',
      cuerpo: { activo: true },
    });
    falla = true;
    await userEvent.click(screen.getByRole('checkbox', { name: 'Novi' }));
    expect(await screen.findByText(/no está disponible/)).toBeTruthy();
  });
});
