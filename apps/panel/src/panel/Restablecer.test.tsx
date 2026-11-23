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
    window.history.pushState(null, '', '/reset-password?token=enlace-de-prueba-de-la-pantalla');
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

  it('C-RECUPERAR-POR-CELULAR: con el código que llegó al celular se crea la contraseña nueva', async () => {
    const llamadas: { url: string; cuerpo: string }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      llamadas.push({ url: String(url), cuerpo: String(init.body) });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    render(<Olvide idioma="es" />);
    await userEvent.type(screen.getByLabelText('Correo'), 'rosa@ejemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Mandarme el enlace' }));
    // El mismo mensaje para todos y, debajo, el camino del código (no revela qué cuenta lo tiene).
    expect(await screen.findByText('¿Te llegó un código al celular?')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Código de 6 números'), '12a3456');
    expect(screen.getByLabelText('Código de 6 números')).toHaveValue('123456');
    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'nueva-clave-99');
    await userEvent.type(screen.getByLabelText('Repite la contraseña'), 'nueva-clave-99');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByTestId('restablecer-codigo-listo')).toHaveTextContent(
      'Contraseña cambiada',
    );
    const ultima = llamadas.at(-1)!;
    expect(ultima.url).toContain('/datos/cuentas/restablecer');
    expect(JSON.parse(ultima.cuerpo)).toEqual({
      correo: 'rosa@ejemplo.com',
      codigo: '123456',
      clave: 'nueva-clave-99',
    });
  });

  it('sin token en el enlace lo dice y manda a pedir uno nuevo', () => {
    window.history.pushState(null, '', '/reset-password');
    render(<Restablecer idioma="es" />);
    expect(screen.getByRole('alert')).toHaveTextContent('incompleto');
  });
});
