import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperPiloto } from './SuperPiloto';

// C-PILOTO en el panel: agregar por correo, quitar desde los tres puntos y no perder lo escrito.
describe('C-PILOTO en el panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  const servidor = (llamadas: { url: string; metodo: string; cuerpo?: unknown }[], falla = false) =>
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const metodo = init?.method ?? 'GET';
      llamadas.push({
        url,
        metodo,
        cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (metodo === 'POST')
        return falla
          ? new Response(JSON.stringify({ error: 'No hay ninguna cuenta con ese correo.' }), {
              status: 404,
            })
          : new Response(JSON.stringify({ ok: true, nuevo: true }), { status: 200 });
      if (metodo === 'DELETE') return new Response(JSON.stringify({ ok: true }), { status: 200 });
      return new Response(
        JSON.stringify({
          participantes: [
            {
              usuarioId: 'u1',
              nombre: 'Repartidor Uno',
              correo: 'uno@ejemplo.com',
              rol: 'repartidor',
              nota: '',
              creadoEn: '2026-10-30 12:00:00',
            },
          ],
          eventos: [],
        }),
        { status: 200 },
      );
    });

  it('agrega por correo y la nota viaja con él', async () => {
    const llamadas: { url: string; metodo: string; cuerpo?: unknown }[] = [];
    servidor(llamadas);
    render(<SuperPiloto idioma="es" />);
    await screen.findByText('Repartidor Uno');
    await userEvent.type(screen.getByLabelText('Correo de la cuenta'), 'dos@ejemplo.com');
    await userEvent.type(screen.getByLabelText('Nota (opcional)'), 'WhatsApp');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar al piloto' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toEqual({
        correo: 'dos@ejemplo.com',
        nota: 'WhatsApp',
      }),
    );
    expect(await screen.findByText('Agregado al piloto.')).toBeTruthy();
  });

  it('si falla, lo escrito se queda; y al volver a la pantalla se recupera', async () => {
    const llamadas: { url: string; metodo: string; cuerpo?: unknown }[] = [];
    servidor(llamadas, true);
    const { unmount } = render(<SuperPiloto idioma="es" />);
    await userEvent.type(screen.getByLabelText('Correo de la cuenta'), 'tres@ejemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar al piloto' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Correo de la cuenta').value).toBe(
      'tres@ejemplo.com',
    );
    await new Promise((r) => setTimeout(r, 700));
    unmount();
    render(<SuperPiloto idioma="es" />);
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLInputElement>('Correo de la cuenta').value).toBe(
        'tres@ejemplo.com',
      ),
    );
  });

  it('quitar está escondido en los tres puntos y pide confirmación', async () => {
    const llamadas: { url: string; metodo: string; cuerpo?: unknown }[] = [];
    servidor(llamadas);
    vi.stubGlobal('confirm', () => true);
    render(<SuperPiloto idioma="es" />);
    await screen.findByText('Repartidor Uno');
    expect(screen.queryByRole('button', { name: 'Quitar del piloto' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Quitar del piloto' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'DELETE')).toBe(true));
    expect(llamadas.find((l) => l.metodo === 'DELETE')?.url).toMatch(/\/datos\/admin\/piloto\/u1$/);
  });
});
