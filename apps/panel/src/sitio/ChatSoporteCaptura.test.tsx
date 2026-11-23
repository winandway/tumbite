import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usarEsperaDeEscritura } from '@tumbite/compartido';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatSoporte } from './ChatSoporte';

/**
 * C-CAMILA-REPORTE-CONVERSADO (19 nov 2026, Richard: «adjunté una captura y se envió sola, sin
 * dejarme escribir el texto que la acompaña») — todos los países. En el chat de la web, adjuntar una
 * captura la deja en el BORRADOR del mensaje: una miniatura con su equis. Se envía junto con lo que
 * la persona escriba cuando toca Enviar, y vuelve al abrir el chat si se había quedado sin enviar.
 */
type Llamada = { metodo: string; url: string; cabeceras: Headers; cuerpo: unknown };
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });
const HILO = (extra: Record<string, unknown> = {}) => ({
  adjuntoPendiente: null,
  verificada: false,
  equipoAtendiendo: false,
  permisoIa: true,
  mensajes: [
    { id: 'a', autor: 'persona', texto: 'Hola', creado_en: '2026-11-19 10:00:00' },
    {
      id: 'b',
      autor: 'camila',
      texto: 'Hola. ¿En qué te ayudo?',
      creado_en: '2026-11-19 10:01:00',
    },
  ],
  ...extra,
});

function servidor(subida: () => Response = () => json({ adjunto: 'adj-nuevo-0001' }, 201)) {
  const llamadas: Llamada[] = [];
  let hilo = HILO();
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const l = {
      metodo: init?.method ?? 'GET',
      url: String(url),
      cabeceras: new Headers(init?.headers),
      cuerpo: init?.body,
    };
    llamadas.push(l);
    if (l.url.endsWith('/camila/adjunto') && l.metodo === 'POST') return subida();
    if (l.url.includes('/camila/adjunto/') && l.metodo === 'DELETE') return json({ ok: true });
    if (l.url.includes('/camila/adjunto/'))
      return new Response(new Blob([new Uint8Array(8)], { type: 'image/png' }));
    if (l.url.endsWith('/camila/mensaje')) {
      const cuerpo = JSON.parse(String(l.cuerpo)) as { texto: string; adjunto?: string };
      hilo = HILO({
        mensajes: [
          ...HILO().mensajes,
          {
            id: 'c',
            autor: 'persona',
            texto: cuerpo.texto || '[Captura enviada]',
            creado_en: '2026-11-19 10:02:00',
            adjunto: cuerpo.adjunto ?? null,
          },
          {
            id: 'd',
            autor: 'camila',
            texto: 'Entiendo. ¿Cómo te llamas?',
            creado_en: '2026-11-19 10:02:05',
          },
        ],
      });
      return json({ respuesta: 'Entiendo. ¿Cómo te llamas?', ...hilo });
    }
    return json(hilo);
  });
  return {
    llamadas,
    conPendiente: (id: string) => {
      hilo = HILO({ adjuntoPendiente: id });
    },
  };
}
const abrir = async (idioma: 'es' | 'en' = 'es') => {
  render(<ChatSoporte idioma={idioma} />);
  await userEvent.click(screen.getByTestId('chat-soporte-burbuja'));
  await screen.findByText('Hola. ¿En qué te ayudo?');
};
const elegir = async () => {
  await userEvent.click(screen.getByTestId('chat-adjuntar'));
  return screen.findByTestId('chat-captura');
};
const imagen = (nombre = 'captura.png', tamano = 2000, tipo = 'image/png') =>
  new File([new Uint8Array(tamano)], nombre, { type: tipo });

describe('C-CAMILA-REPORTE-CONVERSADO: la captura queda en el borrador del chat de la web', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('divoox.camila.converso', '1');
    usarEsperaDeEscritura(() => 0);
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:captura-local' }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    usarEsperaDeEscritura(null);
  });

  it('«Adjuntar captura» muestra los dos botones y el aviso; ya no existe «No tengo captura»', async () => {
    servidor();
    await abrir();
    const bloque = await elegir();
    expect(within(bloque).getByRole('button', { name: 'Subir desde archivos' })).toBeTruthy();
    expect(within(bloque).getByRole('button', { name: 'Tomar foto' })).toBeTruthy();
    expect(bloque).toHaveTextContent(
      'Antes de adjuntarla, tapa cualquier contraseña o número de tarjeta.',
    );
    expect(within(bloque).queryByRole('button', { name: 'No tengo captura' })).toBeNull();
    await userEvent.click(within(bloque).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByTestId('chat-captura')).toBeNull();
  });

  it('adjuntar NO envía nada: queda la miniatura con su equis y se envía junto con el texto al tocar Enviar', async () => {
    const s = servidor();
    await abrir();
    const bloque = await elegir();
    await userEvent.upload(within(bloque).getByLabelText('Subir desde archivos'), imagen());
    const lista = await screen.findByTestId('chat-captura-lista');
    expect(lista).toHaveTextContent('Captura lista. Se envía con tu mensaje.');
    expect(within(lista).getByTestId('chat-miniatura')).toHaveAttribute(
      'src',
      'blob:captura-local',
    );
    expect(within(lista).getByRole('button', { name: 'Quitar la captura' })).toBeTruthy();
    // La imagen subió al borrador, con la ficha del chat; ningún mensaje salió todavía.
    const subida = s.llamadas.find((l) => l.url.endsWith('/camila/adjunto'))!;
    expect(subida.metodo).toBe('POST');
    expect(subida.cuerpo).toBeInstanceOf(File);
    expect(subida.cabeceras.get('x-camila-visita')).toMatch(/^[A-Za-z0-9_-]{32,80}$/);
    expect(s.llamadas.some((l) => l.url.endsWith('/camila/mensaje'))).toBe(false);
    // Escribe lo que la acompaña y envía: viajan juntos.
    await userEvent.type(screen.getByLabelText('Escribe tu mensaje…'), 'no veo la tasa de cambio');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('Entiendo. ¿Cómo te llamas?');
    const m = s.llamadas.find((l) => l.url.endsWith('/camila/mensaje'))!;
    expect(JSON.parse(String(m.cuerpo))).toEqual({
      texto: 'no veo la tasa de cambio',
      canal: 'web',
      avisoIa: 'linea-2026-11-23/web',
      adjunto: 'adj-nuevo-0001',
    });
    // El borrador queda limpio y el mensaje del hilo muestra su miniatura.
    expect(screen.queryByTestId('chat-captura-lista')).toBeNull();
    expect((screen.getByLabelText('Escribe tu mensaje…') as HTMLTextAreaElement).value).toBe('');
    expect(screen.getAllByTestId('chat-miniatura').length).toBe(1);
  });

  it('se puede enviar la captura sola, y en el hilo se ve la imagen en vez de la marca de texto', async () => {
    const s = servidor();
    await abrir();
    const bloque = await elegir();
    await userEvent.upload(within(bloque).getByLabelText('Subir desde archivos'), imagen());
    await screen.findByTestId('chat-captura-lista');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('Entiendo. ¿Cómo te llamas?');
    const m = s.llamadas.find((l) => l.url.endsWith('/camila/mensaje'))!;
    expect(JSON.parse(String(m.cuerpo))).toEqual({
      texto: '',
      canal: 'web',
      avisoIa: 'linea-2026-11-23/web',
      adjunto: 'adj-nuevo-0001',
    });
    expect(screen.queryByText('[Captura enviada]')).toBeNull();
    expect(screen.getAllByTestId('chat-miniatura').length).toBe(1);
  });

  it('la equis quita la captura del borrador, aquí y en el servidor, sin tocar lo escrito', async () => {
    const s = servidor();
    await abrir();
    await userEvent.type(screen.getByLabelText('Escribe tu mensaje…'), 'algo a medias');
    const bloque = await elegir();
    await userEvent.upload(within(bloque).getByLabelText('Subir desde archivos'), imagen());
    await userEvent.click(await screen.findByTestId('chat-captura-quitar'));
    await waitFor(() => expect(screen.queryByTestId('chat-captura-lista')).toBeNull());
    const borrado = s.llamadas.find((l) => l.metodo === 'DELETE')!;
    expect(borrado.url).toMatch(/\/camila\/adjunto\/adj-nuevo-0001$/);
    expect((screen.getByLabelText('Escribe tu mensaje…') as HTMLTextAreaElement).value).toBe(
      'algo a medias',
    );
    expect(screen.getByTestId('chat-adjuntar')).toBeTruthy();
  });

  it('si el chat se cerró con una captura sin enviar, vuelve al abrirlo (la guarda el servidor)', async () => {
    const s = servidor();
    s.conPendiente('adj-de-antes-01');
    await abrir();
    const lista = await screen.findByTestId('chat-captura-lista');
    expect(lista).toHaveTextContent('Captura lista. Se envía con tu mensaje.');
    await waitFor(() =>
      expect(s.llamadas.some((l) => l.url.endsWith('/camila/adjunto/adj-de-antes-01'))).toBe(true),
    );
    await userEvent.type(screen.getByLabelText('Escribe tu mensaje…'), 'esto me salió');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('Entiendo. ¿Cómo te llamas?');
    const m = s.llamadas.find((l) => l.url.endsWith('/camila/mensaje'))!;
    expect(JSON.parse(String(m.cuerpo)).adjunto).toBe('adj-de-antes-01');
  });

  it('si falla la subida dice por qué y deja volver a intentar; una de más de 10 MB no se sube', async () => {
    let veces = 0;
    const s = servidor(() =>
      ++veces === 1
        ? json({ error: 'El almacén de fotos no está disponible en este momento.' }, 503)
        : json({ adjunto: 'adj-nuevo-0002' }, 201),
    );
    await abrir();
    const bloque = await elegir();
    await userEvent.upload(
      within(bloque).getByLabelText('Subir desde archivos'),
      imagen('grande.jpg', 11 * 1024 * 1024, 'image/jpeg'),
    );
    expect(await within(bloque).findByRole('alert')).toHaveTextContent(
      'La captura pesa demasiado. El máximo es 10 MB.',
    );
    expect(s.llamadas.some((l) => l.url.endsWith('/camila/adjunto'))).toBe(false);
    await userEvent.upload(within(bloque).getByLabelText('Subir desde archivos'), imagen());
    expect(await within(bloque).findByRole('alert')).toHaveTextContent(
      'El almacén de fotos no está disponible',
    );
    await userEvent.click(within(bloque).getByRole('button', { name: 'Volver a intentar' }));
    await screen.findByTestId('chat-captura-lista');
    expect(veces).toBe(2);
  });

  it('en inglés también', async () => {
    servidor();
    await abrir('en');
    const bloque = await elegir();
    expect(bloque).toHaveTextContent('Before attaching it, cover any password or card number.');
    await userEvent.upload(within(bloque).getByLabelText('Upload from files'), imagen());
    expect(await screen.findByTestId('chat-captura-lista')).toHaveTextContent(
      'Screenshot ready. It’s sent with your message.',
    );
    expect(screen.getByRole('button', { name: 'Remove the screenshot' })).toBeTruthy();
  });
});
