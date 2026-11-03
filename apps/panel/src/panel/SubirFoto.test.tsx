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

  it('NXT-4z: si el navegador no puede abrir la foto (un HEIC del iPhone), sale el aviso en su idioma, no el error técnico', async () => {
    const llamadas: unknown[] = [];
    vi.stubGlobal('fetch', async () => {
      llamadas.push(1);
      return new Response(JSON.stringify({ url: URL_FOTO }), { status: 201 });
    });
    vi.stubGlobal('createImageBitmap', async () => {
      throw new DOMException('The source image could not be decoded.', 'InvalidStateError');
    });
    render(<Prueba />);
    await userEvent.upload(
      screen.getByLabelText('Foto del plato'),
      new File([new Uint8Array([0, 0, 0, 0x18])], 'IMG_0001.jpg', { type: 'image/jpeg' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/HEIC.*Más compatible/);
    expect(screen.queryByText(/could not be decoded/)).toBeNull();
    expect(llamadas).toHaveLength(0);
  });

  it('NXT-4z: un archivo .heic ni se intenta abrir; el aviso también existe en inglés', async () => {
    const { mensajeDeFoto, FotoIlegible, reducirFoto } = await import('./SubirFoto');
    await expect(
      reducirFoto(new File([new Uint8Array([1])], 'IMG_0002.HEIC', { type: '' })),
    ).rejects.toBeInstanceOf(FotoIlegible);
    expect(mensajeDeFoto(new FotoIlegible(), 'en')).toMatch(/Most Compatible/);
    expect(mensajeDeFoto(new Error('x'), 'es')).toBe('No se pudo subir la foto.');
  });

  it('NXT-7: convierte en el navegador a WebP en tres tamaños y sube la completa, la tarjeta y la miniatura', async () => {
    const rutas: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      rutas.push(String(url));
      return new Response(JSON.stringify({ url: URL_FOTO }), { status: 201 });
    });
    vi.stubGlobal('createImageBitmap', async () => ({ width: 4032, height: 3024 }));
    const anchos: number[] = [];
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => ({ drawImage: () => undefined }) as never);
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      ok: BlobCallback,
      tipo?: string,
    ) {
      anchos.push(this.width);
      ok(new Blob([new Uint8Array(10)], { type: tipo }));
    });
    try {
      render(<Prueba />);
      await userEvent.upload(
        screen.getByLabelText('Foto del plato'),
        new File([new Uint8Array([0xff, 0xd8, 0xff])], 'plato.jpg', { type: 'image/jpeg' }),
      );
      expect(await screen.findByRole('img', { name: 'Foto del plato' })).toHaveAttribute(
        'src',
        URL_FOTO,
      );
      await vi.waitFor(() => expect(rutas).toHaveLength(3));
      expect(rutas[0]).toMatch(/\/datos\/mi-restaurante\/fotos$/);
      expect(rutas[1]).toMatch(/\/datos\/mi-restaurante\/fotos\?de=abc&tam=tarjeta$/);
      expect(rutas[2]).toMatch(/\/datos\/mi-restaurante\/fotos\?de=abc&tam=miniatura$/);
      expect(anchos).toEqual([1400, 640, 200]);
    } finally {
      getContext.mockRestore();
      toBlob.mockRestore();
    }
  });
});
