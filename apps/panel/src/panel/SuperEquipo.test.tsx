import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperEquipo } from './SuperEquipo';

// C-ROLES-INTERNOS en el panel: Total cambia el perfil de otro, nunca el suyo.
describe('C-ROLES-INTERNOS en el panel', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('Total ve el selector de los demás y manda el cambio', async () => {
    const llamadas: { url: string; metodo: string; cuerpo?: unknown }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      llamadas.push({
        url,
        metodo: init?.method ?? 'GET',
        cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (String(url).endsWith('/acciones'))
        return new Response(JSON.stringify({ acciones: [] }), { status: 200 });
      if (init?.method === 'PUT')
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      return new Response(
        JSON.stringify({
          miPerfil: 'total',
          equipo: [
            { id: 'yo', nombre: 'Soporte Jefe', correo: 'jefe@ejemplo.com', perfil: 'total' },
            { id: 'otro', nombre: 'Soporte Ayuda', correo: 'ayuda@ejemplo.com', perfil: 'total' },
          ],
        }),
        { status: 200 },
      );
    });
    render(<SuperEquipo idioma="es" miId="yo" />);
    const selector = await screen.findByRole('combobox', { name: 'Soporte Ayuda' });
    expect(screen.queryByRole('combobox', { name: 'Soporte Jefe' })).toBeNull();
    await userEvent.selectOptions(selector, 'soporte');
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(true));
    const put = llamadas.find((l) => l.metodo === 'PUT')!;
    expect(put.url).toMatch(/\/datos\/admin\/equipo\/otro$/);
    expect(put.cuerpo).toEqual({ perfil: 'soporte' });
  });

  it('C-AVISOS-EQUIPO: marcar un tipo de aviso lo guarda; el de sistema fijo no se puede quitar', async () => {
    const llamadas: { metodo: string; cuerpo?: unknown }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      llamadas.push({
        metodo: init?.method ?? 'GET',
        cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (String(url).endsWith('/mis-avisos') && init?.method !== 'PUT')
        return new Response(
          JSON.stringify({
            avisos: [
              { tipo: 'pedidos', activo: false, fijo: false },
              { tipo: 'sistema', activo: true, fijo: true },
            ],
          }),
          { status: 200 },
        );
      if (String(url).endsWith('/acciones'))
        return new Response(JSON.stringify({ acciones: [] }), { status: 200 });
      return new Response(JSON.stringify({ ok: true, miPerfil: 'total', equipo: [] }), {
        status: 200,
      });
    });
    render(<SuperEquipo idioma="es" miId="yo" />);
    const pedidos = await screen.findByRole('checkbox', { name: /^Pedidos/ });
    expect(screen.getByRole('checkbox', { name: /^Sistema/ })).toBeDisabled();
    await userEvent.click(pedidos);
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'PUT')?.cuerpo).toEqual({
        tipo: 'pedidos',
        activo: true,
      }),
    );
  });
});
