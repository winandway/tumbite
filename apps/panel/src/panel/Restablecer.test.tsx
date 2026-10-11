import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Olvide, Restablecer } from './Restablecer';

describe('recuperar la contraseña', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('pide el enlace y dice lo mismo exista o no el correo', async () => {
    const llamadas: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      llamadas.push(String(init.body));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    render(<Olvide idioma="es" />);
    await userEvent.type(screen.getByLabelText('Correo'), 'rosa@ejemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Mandarme el enlace' }));
    expect(await screen.findByRole('status')).toHaveTextContent('ya te llegó el enlace');
    expect(llamadas[0]).toContain('rosa@ejemplo.com');
  });

  it('las dos contraseñas deben coincidir y el token viaja al servidor', async () => {
    window.history.pushState(null, '', '/restablecer?token=enlace-de-prueba-de-la-pantalla');
    const llamadas: string[] = [];
    vi.stubGlobal('fetch', async (_u: string, init: RequestInit) => {
      llamadas.push(String(init.body));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    render(<Restablecer idioma="es" />);
    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'nueva-clave-99');
    await userEvent.type(screen.getByLabelText('Repite la contraseña'), 'otra');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(screen.getByRole('alert')).toHaveTextContent('no son iguales');
    expect(llamadas).toHaveLength(0);
    await userEvent.clear(screen.getByLabelText('Repite la contraseña'));
    await userEvent.type(screen.getByLabelText('Repite la contraseña'), 'nueva-clave-99');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Contraseña cambiada');
    expect(llamadas[0]).toContain('enlace-de-prueba-de-la-pantalla');
  });

  it('sin token en el enlace lo dice y manda a pedir uno nuevo', () => {
    window.history.pushState(null, '', '/restablecer');
    render(<Restablecer idioma="es" />);
    expect(screen.getByRole('alert')).toHaveTextContent('incompleto');
  });
});
