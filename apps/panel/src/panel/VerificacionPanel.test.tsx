import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VerificacionPanel } from './VerificacionPanel';

/**
 * NXT-4w (C-FOTOS-HEIC-LIMPIAS): la verificación de identidad del panel solo acepta JPEG, PNG y
 * WebP, y si el navegador no puede abrir la foto (un HEIC del iPhone en Chrome o Firefox) sale el
 * aviso en el idioma de la persona, nunca el texto técnico del navegador.
 */
afterEach(() => vi.unstubAllGlobals());

function preparar() {
  const subidas: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      subidas.push(String(url));
      return new Response(JSON.stringify({ url: '/x' }), { status: 201 });
    }
    return new Response(
      JSON.stringify({
        kyc: { estado: 'sin_enviar', motivo: '', tiene: {}, proximaRevision: null },
      }),
    );
  });
  vi.stubGlobal('createImageBitmap', async () => {
    throw new DOMException('The source image could not be decoded.', 'InvalidStateError');
  });
  return subidas;
}

describe('verificación de identidad del panel: fotos que el navegador no abre (NXT-4w)', () => {
  it.each([
    ['es', 'Documento (frente)', /HEIC.*Más compatible/],
    ['en', 'Document (front)', /HEIC.*Most Compatible/],
  ] as const)('%s: solo JPEG, PNG o WebP y el aviso claro', async (idioma, etiqueta, aviso) => {
    const subidas = preparar();
    render(<VerificacionPanel idioma={idioma} />);
    const entrada = await screen.findByLabelText(etiqueta);
    expect(entrada).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    // Un archivo que el navegador no sabe abrir (se salta el filtro, como al arrastrarlo).
    fireEvent.change(entrada, {
      target: {
        files: [
          new File([new Uint8Array([0, 0, 0, 0x18])], 'IMG_0001.jpg', { type: 'image/jpeg' }),
        ],
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(aviso);
    expect(screen.queryByText(/could not be decoded|InvalidStateError/)).toBeNull();
    // Un .heic ni se intenta abrir.
    fireEvent.change(entrada, {
      target: { files: [new File([new Uint8Array([1])], 'IMG_0002.HEIC', { type: 'image/heic' })] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(aviso);
    expect(subidas).toHaveLength(0);
  });
});
