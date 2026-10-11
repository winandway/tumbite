import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { SubirFoto } from './SubirFoto';

const URL_FOTO = '/media/fotos/r1/abc.webp';

function Prueba() {
  const [valor, setValor] = useState('');
  return <SubirFoto etiqueta="Foto del plato" valor={valor} cambiar={setValor} idioma="es" />;
}

describe('subir foto', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sube la foto, la muestra y el quitar vive dentro de los 3 puntos', async () => {
    const llamadas: RequestInit[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      llamadas.push(init);
      return new Response(JSON.stringify({ url: URL_FOTO }), { status: 201 });
    });
    render(<Prueba />);
    expect(screen.queryByRole('button', { name: 'Quitar foto' })).toBeNull();
    const archivo = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'plato.jpg', {
      type: 'image/jpeg',
    });
    await userEvent.upload(screen.getByLabelText('Foto del plato'), archivo);
    expect(await screen.findByRole('img', { name: 'Foto del plato' })).toHaveAttribute(
      'src',
      URL_FOTO,
    );
    expect(llamadas[0]?.method).toBe('POST');
    expect(screen.getByRole('button', { name: 'Cambiar foto' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Opciones de la foto' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Quitar foto' }));
    expect(screen.queryByRole('img', { name: 'Foto del plato' })).toBeNull();
  });

  it('si el servidor la rechaza, lo dice en palabras claras', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ error: 'La foto pesa demasiado. El máximo es 3 MB.' }), {
          status: 413,
        }),
    );
    render(<Prueba />);
    await userEvent.upload(
      screen.getByLabelText('Foto del plato'),
      new File([new Uint8Array([1])], 'x.png', { type: 'image/png' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('pesa demasiado');
  });
});
