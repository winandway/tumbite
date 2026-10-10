import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanelApp } from './PanelApp';

const usuario = {
  id: 'u1',
  nombre: 'Rosa Dueña',
  correo: 'rosa@correo.com',
  rol: 'restaurante',
  idioma: 'es',
};

function servidor(respuestas: Record<string, () => Response>) {
  const llamadas: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    llamadas.push(url);
    const r = Object.entries(respuestas).find(([ruta]) => url.endsWith(ruta));
    return r ? r[1]() : new Response('{}', { status: 404 });
  });
  return llamadas;
}

describe('panel: entrar, ojito, borradores y salir', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('tumbite.idioma', 'es');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('la contraseña arranca oculta y el ojito la muestra', async () => {
    servidor({ '/datos/cuentas/yo': () => new Response('{"error":"x"}', { status: 401 }) });
    render(<PanelApp ruta="/panel" />);
    const clave = await screen.findByLabelText('Contraseña');
    expect(clave).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Ver la contraseña' }));
    expect(clave).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar la contraseña' })).toBeInTheDocument();
  });

  it('si el servidor falla, lo escrito se queda y se muestra el error', async () => {
    servidor({
      '/datos/cuentas/yo': () => new Response('{}', { status: 401 }),
      '/datos/cuentas/entrar': () =>
        new Response(JSON.stringify({ error: 'El correo o la contraseña no coinciden.' }), {
          status: 401,
        }),
    });
    render(<PanelApp ruta="/panel" />);
    await userEvent.type(await screen.findByLabelText('Correo'), 'rosa@correo.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-mala');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no coinciden');
    expect(screen.getByLabelText('Correo')).toHaveValue('rosa@correo.com');
  });

  it('recupera lo escrito al volver, sin la contraseña', async () => {
    servidor({ '/datos/cuentas/yo': () => new Response('{}', { status: 401 }) });
    localStorage.setItem(
      'tumbite.borrador.panel-entrar.anonimo',
      JSON.stringify({ correo: 'rosa@correo.com' }),
    );
    render(<PanelApp ruta="/panel" />);
    expect(await screen.findByText('Recuperamos lo que estabas escribiendo.')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo')).toHaveValue('rosa@correo.com');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  });

  it('con sesión muestra el menú y cerrar sesión avisa al servidor', async () => {
    const llamadas = servidor({
      '/datos/cuentas/yo': () => new Response(JSON.stringify({ usuario }), { status: 200 }),
      '/datos/cuentas/salir': () => new Response('{"ok":true}', { status: 200 }),
    });
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, href: '' },
    });
    render(<PanelApp ruta="/panel" />);
    expect(await screen.findByRole('heading', { name: 'Hola, Rosa' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Regalos y marketing' })).toBeInTheDocument();
    await userEvent.click(screen.getByText('Rosa'));
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() =>
      expect(llamadas.some((u) => u.endsWith('/datos/cuentas/salir'))).toBe(true),
    );
    await waitFor(() => expect(window.location.href).toBe('/panel'));
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });
});
