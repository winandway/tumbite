import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Olvide, Restablecer } from './Restablecer';

describe('recuperar la contraseña', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  // C-RECUPERAR-WHATSAPP (27 nov 2026, Richard por Gerencia): celular o correo, WhatsApp primero,
  // nunca se dice si la cuenta existe, «Crear cuenta» siempre a mano.
  it('arranca con el celular y «Por WhatsApp» (recomendado) y pide el código sin revelar la cuenta', async () => {
    const llamadas: { url: string; cuerpo: unknown }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (String(url).includes('/recuperar'))
        llamadas.push({ url: String(url), cuerpo: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    render(<Olvide idioma="es" />);
    const canales = screen.getAllByRole('radio');
    expect(canales.map((r) => (r as HTMLInputElement).value)).toEqual(['whatsapp', 'correo']);
    expect(canales[0]).toBeChecked();
    expect(screen.getByText('Recomendado')).toBeInTheDocument();
    expect(screen.getByTestId('accion-crear').textContent).toBe('Crear cuenta');
    await userEvent.selectOptions(screen.getByTestId('pais-telefono'), 'VE');
    await userEvent.type(screen.getByLabelText('Celular'), '04141234567');
    await userEvent.click(screen.getByRole('button', { name: 'Mandarme el código' }));
    expect(await screen.findByTestId('olvide-aviso')).toHaveTextContent(
      'Si la cuenta existe, te enviamos un código por WhatsApp',
    );
    expect(llamadas[0]).toEqual({
      url: '/datos/cuentas/recuperar/codigo',
      cuerpo: { identificador: '04141234567', paisTelefono: 'VE', idioma: 'es', canal: 'whatsapp' },
    });
    // Nunca queda trabada: el SMS y el correo, a un toque. «Crear cuenta» sigue a mano.
    await userEvent.click(screen.getByRole('button', { name: 'Mándamelo por SMS' }));
    expect(llamadas[1]?.cuerpo).toMatchObject({ canal: 'sms' });
    expect(await screen.findByTestId('olvide-aviso')).toHaveTextContent('por SMS');
    expect(screen.getByRole('button', { name: 'Mándamelo por correo' })).toBeInTheDocument();
    expect(screen.getByTestId('accion-crear')).toBeInTheDocument();
  });

  it('con el código bueno crea la contraseña nueva (con el ojito) y no guarda ni el código ni la clave', async () => {
    const llamadas: { url: string; cuerpo: Record<string, unknown> }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/datos/publico')) return new Response('{}');
      llamadas.push({ url: u, cuerpo: JSON.parse(String(init?.body)) });
      if (u.endsWith('/verificar'))
        return new Response(
          JSON.stringify({
            ok: true,
            cuentas: [
              {
                pase: 'pase-de-prueba-largo',
                rol: 'cliente',
                nombre: 'Rosa',
                correo: 'r•••@ejemplo.com',
              },
            ],
          }),
        );
      return new Response(JSON.stringify({ ok: true }));
    });
    render(<Olvide idioma="es" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Con mi correo' }));
    await userEvent.type(screen.getByLabelText('Correo'), 'rosa@ejemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Mandarme el código' }));
    await userEvent.type(await screen.findByLabelText('Código de 6 números'), '12a3456');
    expect(screen.getByLabelText('Código de 6 números')).toHaveValue('123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verificar el código' }));
    const clave = await screen.findByLabelText('Contraseña nueva');
    expect(clave).toHaveAttribute('type', 'password');
    expect(screen.getAllByRole('button', { name: 'Ver la contraseña' })).toHaveLength(2);
    await userEvent.type(clave, 'nueva-clave-99');
    await userEvent.type(screen.getByLabelText('Repite la contraseña'), 'nueva-clave-99');
    for (const [k, valor] of Object.entries(localStorage)) {
      expect(`${k}=${valor}`).not.toContain('123456');
      expect(`${k}=${valor}`).not.toContain('nueva-clave-99');
    }
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByTestId('recuperar-listo')).toHaveTextContent('Contraseña cambiada');
    expect(llamadas.at(-2)).toEqual({
      url: '/datos/cuentas/recuperar/verificar',
      cuerpo: { identificador: 'rosa@ejemplo.com', idioma: 'es', codigo: '123456' },
    });
    expect(llamadas.at(-1)).toEqual({
      url: '/datos/cuentas/restablecer',
      cuerpo: { token: 'pase-de-prueba-largo', clave: 'nueva-clave-99' },
    });
  });

  it('si el celular abre varias cuentas, la persona elige cuál', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      String(url).endsWith('/verificar')
        ? new Response(
            JSON.stringify({
              ok: true,
              cuentas: [
                { pase: 'pase-uno-de-prueba', rol: 'cliente', nombre: 'Rosa', correo: null },
                { pase: 'pase-dos-de-prueba', rol: 'repartidor', nombre: 'Rosa', correo: null },
              ],
            }),
          )
        : new Response(JSON.stringify({ ok: true })),
    );
    render(<Olvide idioma="es" />);
    await userEvent.type(screen.getByLabelText('Celular'), '+13055550123');
    await userEvent.click(screen.getByRole('button', { name: 'Mandarme el código' }));
    await userEvent.type(await screen.findByLabelText('Código de 6 números'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verificar el código' }));
    expect(await screen.findByTestId('olvide-cuentas')).toHaveTextContent('Cuenta de Driver');
    await userEvent.click(screen.getByRole('button', { name: /Cuenta de Driver/ }));
    expect(await screen.findByLabelText('Contraseña nueva')).toBeInTheDocument();
  });

  it('el código malo se dice y lo escrito se queda (el dato se recupera al volver)', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      String(url).endsWith('/verificar')
        ? new Response(
            JSON.stringify({
              error: 'El código no coincide o ya venció. Revísalo o pide uno nuevo.',
            }),
            { status: 409 },
          )
        : new Response(JSON.stringify({ ok: true })),
    );
    const { unmount } = render(<Olvide idioma="es" />);
    await userEvent.type(screen.getByLabelText('Celular'), '+13055550123');
    await userEvent.click(screen.getByRole('button', { name: 'Mandarme el código' }));
    await userEvent.type(await screen.findByLabelText('Código de 6 números'), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Verificar el código' }));
    expect(await screen.findByText(/no coincide o ya venció/)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 700));
    unmount();
    render(<Olvide idioma="es" />);
    // Vuelve al paso del código con el mismo dato; el código no se guardó.
    expect(await screen.findByLabelText('Código de 6 números')).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'Escribir otro celular o correo' }));
    expect(screen.getByLabelText('Celular')).toHaveValue('+13055550123');
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

  it('sin token en el enlace lo dice y manda a pedir uno nuevo', () => {
    window.history.pushState(null, '', '/reset-password');
    render(<Restablecer idioma="es" />);
    expect(screen.getByRole('alert')).toHaveTextContent('incompleto');
  });
});
