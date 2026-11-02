import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormContacto } from './FormContacto';

// C-CONTACTO: el formulario público sugiere el correo bien escrito, abre el caso y avisa.
describe('C-CONTACTO: formulario de contacto', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('sugiere gmail.com, manda los datos y dice que el enlace llega al correo', async () => {
    const envios: unknown[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (String(url).includes('/datos/contacto')) {
        envios.push(JSON.parse(String(init?.body)));
        return new Response('{"ok":true}', { status: 201 });
      }
      return new Response('{}', { status: 200 });
    });
    render(<FormContacto idioma="es" />);
    await userEvent.type(screen.getByLabelText('Tu nombre'), 'Lucía');
    await userEvent.type(screen.getByLabelText('Tu correo'), 'lucia@gmial.com');
    await userEvent.click(screen.getByRole('button', { name: 'Sí, usar ese' }));
    expect((screen.getByLabelText('Tu correo') as HTMLInputElement).value).toBe('lucia@gmail.com');
    await userEvent.selectOptions(screen.getByLabelText('Soy…'), 'restaurante');
    await userEvent.type(screen.getByLabelText('¿En qué te ayudamos?'), 'Quiero sumar mi local.');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    await waitFor(() =>
      expect(envios).toEqual([
        {
          nombre: 'Lucía',
          correo: 'lucia@gmail.com',
          soy: 'restaurante',
          numeroUsuario: '',
          ciudad: '',
          mensaje: 'Quiero sumar mi local.',
          idioma: 'es',
        },
      ]),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('enlace de tu conversación');
  });

  it('sin nombre, correo válido y mensaje no envía nada', async () => {
    const envios: unknown[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      if (String(url).includes('/datos/contacto')) envios.push(url);
      return new Response('{}', { status: 200 });
    });
    render(<FormContacto idioma="en" />);
    await userEvent.type(screen.getByLabelText('Your email'), 'no-es-correo');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('valid email');
    expect(envios).toEqual([]);
  });
});
