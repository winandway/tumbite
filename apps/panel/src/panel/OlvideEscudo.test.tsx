import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Olvide } from './Restablecer';

/**
 * C-TURNSTILE-LISTO (24 nov 2026): «Olvidé mi contraseña» (la misma página para la web y las tres apps)
 * pinta el escudo cuando el sitio tiene su clave pública y manda el pase al pedir el enlace. Sin clave,
 * no pinta nada y funciona como hoy.
 */
function servidor(sitio: string) {
  const cabeceras: (string | null)[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (String(url).includes('/datos/publico'))
      return new Response(JSON.stringify({ turnstileSitio: sitio }));
    if (String(url).includes('/recuperar'))
      cabeceras.push(new Headers(init?.headers).get('cf-turnstile-response'));
    return new Response(JSON.stringify({ ok: true }));
  });
  return cabeceras;
}

describe('C-TURNSTILE-LISTO · el escudo en «Olvidé mi contraseña»', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    delete (window as { tumbitePase?: string }).tumbitePase;
  });

  it('con la clave del sitio pinta el escudo y manda el pase', async () => {
    const cabeceras = servidor('0x4AAAAAAAsitio-de-prueba');
    render(<Olvide idioma="es" />);
    expect(await screen.findByTestId('turnstile')).toBeInTheDocument();
    (window as { tumbitePase?: string }).tumbitePase = 'pase-de-prueba';
    await userEvent.type(screen.getByLabelText('Correo'), 'rosa@ejemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Mandarme el enlace' }));
    await waitFor(() => expect(cabeceras).toEqual(['pase-de-prueba']));
  });

  it('sin la clave no pinta nada y pide el enlace igual que hoy', async () => {
    const cabeceras = servidor('');
    render(<Olvide idioma="es" />);
    await userEvent.type(screen.getByLabelText('Correo'), 'rosa@ejemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Mandarme el enlace' }));
    expect(await screen.findByRole('status')).toHaveTextContent('te mandamos el enlace');
    expect(screen.queryByTestId('turnstile')).toBeNull();
    expect(cabeceras).toEqual([null]);
  });
});
