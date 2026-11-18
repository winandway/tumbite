import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatSoporte } from './ChatSoporte';

/**
 * C-CAMILA-FALLOS (18 nov 2026) — todos los países. Cuando Camila pide la captura de un reporte de
 * fallo, el chat de la web muestra su bloque: «Subir desde archivos» y «Tomar foto» (regla de la
 * cámara), el aviso de tapar contraseñas y tarjetas, «No tengo captura», el estado de la subida y,
 * si falla, el motivo y «Volver a intentar».
 */
type Llamada = { metodo: string; url: string; cabeceras: Headers; cuerpo: unknown };
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });
const HILO = (pideCaptura: boolean) => ({
  pideCaptura,
  verificada: false,
  equipoAtendiendo: false,
  mensajes: [
    { id: 'a', autor: 'persona', texto: 'No me deja pagar', creado_en: '2026-11-18 10:00:00' },
    {
      id: 'b',
      autor: 'camila',
      texto: pideCaptura
        ? 'Última cosa: ¿me mandas una captura?'
        : 'Gracias. Quedó reportado con el número F-0001.',
      creado_en: '2026-11-18 10:01:00',
    },
  ],
});

function servidor(captura: () => Response) {
  const llamadas: Llamada[] = [];
  let pide = true;
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const l = {
      metodo: init?.method ?? 'GET',
      url: String(url),
      cabeceras: new Headers(init?.headers),
      cuerpo: init?.body,
    };
    llamadas.push(l);
    if (l.url.endsWith('/camila/fallos/captura')) {
      const r = captura();
      if (r.ok) pide = false;
      return r;
    }
    if (l.url.endsWith('/camila/mensaje')) {
      pide = false;
      return json({ respuesta: 'listo', ...HILO(false) });
    }
    return json(HILO(pide));
  });
  return llamadas;
}
const abrir = async (idioma: 'es' | 'en' = 'es') => {
  render(<ChatSoporte idioma={idioma} />);
  await userEvent.click(screen.getByTestId('chat-soporte-burbuja'));
  return screen.findByTestId('chat-captura');
};
const imagen = (nombre = 'captura.png', tamano = 2000, tipo = 'image/png') =>
  new File([new Uint8Array(tamano)], nombre, { type: tipo });

describe('C-CAMILA-FALLOS: el bloque de la captura en la web', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('divoox.camila.converso', '1');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('muestra los dos botones, el aviso y «No tengo captura»', async () => {
    servidor(() => json({ ok: true }, 201));
    const bloque = await abrir();
    expect(within(bloque).getByRole('button', { name: 'Subir desde archivos' })).toBeTruthy();
    expect(within(bloque).getByRole('button', { name: 'Tomar foto' })).toBeTruthy();
    expect(bloque).toHaveTextContent(
      'Antes de mandarla, tapa cualquier contraseña o número de tarjeta.',
    );
    expect(within(bloque).getByRole('button', { name: 'No tengo captura' })).toBeTruthy();
  });

  it('sube la imagen cruda con la ficha del chat y vuelve a pedir el hilo', async () => {
    const llamadas = servidor(() => json({ ok: true, respuesta: 'Gracias' }, 201));
    const bloque = await abrir();
    await userEvent.upload(within(bloque).getByLabelText('Subir desde archivos'), imagen());
    await waitFor(() => expect(screen.queryByTestId('chat-captura')).toBeNull());
    const subida = llamadas.find((l) => l.url.endsWith('/camila/fallos/captura'))!;
    expect(subida.metodo).toBe('POST');
    expect(subida.cuerpo).toBeInstanceOf(File);
    expect(subida.cabeceras.get('x-camila-visita')).toMatch(/^[A-Za-z0-9_-]{32,80}$/);
    expect(await screen.findByText(/F-0001/)).toBeTruthy();
  });

  it('si falla la subida dice por qué y deja volver a intentar', async () => {
    let veces = 0;
    servidor(() =>
      ++veces === 1
        ? json({ error: 'El almacén de fotos no está disponible en este momento.' }, 503)
        : json({ ok: true }, 201),
    );
    const bloque = await abrir();
    await userEvent.upload(within(bloque).getByLabelText('Subir desde archivos'), imagen());
    expect(await within(bloque).findByRole('alert')).toHaveTextContent(
      'El almacén de fotos no está disponible',
    );
    await userEvent.click(within(bloque).getByRole('button', { name: 'Volver a intentar' }));
    await waitFor(() => expect(screen.queryByTestId('chat-captura')).toBeNull());
    expect(veces).toBe(2);
  });

  it('una imagen de más de 10 MB no se sube y se dice en palabras', async () => {
    const llamadas = servidor(() => json({ ok: true }, 201));
    const bloque = await abrir();
    await userEvent.upload(
      within(bloque).getByLabelText('Subir desde archivos'),
      imagen('grande.jpg', 11 * 1024 * 1024, 'image/jpeg'),
    );
    expect(await within(bloque).findByRole('alert')).toHaveTextContent(
      'La captura pesa demasiado. El máximo es 10 MB.',
    );
    expect(llamadas.some((l) => l.url.endsWith('/camila/fallos/captura'))).toBe(false);
  });

  it('«No tengo captura» manda «sin captura» (en inglés «no screenshot») sin borrar lo escrito', async () => {
    const llamadas = servidor(() => json({ ok: true }, 201));
    const bloque = await abrir('en');
    await userEvent.type(screen.getByLabelText('Write your message…'), 'algo a medias');
    await userEvent.click(
      within(bloque).getByRole('button', { name: 'I don’t have a screenshot' }),
    );
    await waitFor(() => expect(screen.queryByTestId('chat-captura')).toBeNull());
    const m = llamadas.find((l) => l.url.endsWith('/camila/mensaje'))!;
    expect(JSON.parse(String(m.cuerpo))).toEqual({ texto: 'no screenshot', canal: 'web' });
    expect((screen.getByLabelText('Write your message…') as HTMLTextAreaElement).value).toBe(
      'algo a medias',
    );
  });
});
