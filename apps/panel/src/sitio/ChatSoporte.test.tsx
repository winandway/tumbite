import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LLAVE_VISITA_CAMILA, esVisitaCamila } from '@tumbite/compartido';
import { ChatSoporte } from './ChatSoporte';

/**
 * C-CAMILA-CHAT (17 nov 2026) — todos los países. La burbuja del chat de soporte de las páginas
 * públicas: mirar no escribe, la ficha del navegador viaja en su cabecera, los nombres de Camila y
 * del equipo salen en sus mensajes, lo escrito no se pierde si falla y se avisa cuando una persona
 * del equipo tiene la conversación.
 */
type Llamada = { metodo: string; url: string; cabeceras: Headers; cuerpo: unknown };

function servidor(responder: (l: Llamada) => Response) {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const l = {
      metodo: init?.method ?? 'GET',
      url: String(url),
      cabeceras: new Headers(init?.headers),
      cuerpo: init?.body ? JSON.parse(String(init.body)) : null,
    };
    llamadas.push(l);
    return responder(l);
  });
  return llamadas;
}
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });

const HILO = {
  verificada: false,
  equipoAtendiendo: false,
  mensajes: [
    {
      id: 'a',
      autor: 'persona',
      texto: '¿Cómo recargo mi saldo?',
      creado_en: '2026-11-17 10:00:00',
    },
    {
      id: 'b',
      autor: 'camila',
      texto: 'Por pago móvil, desde Ganancias.',
      creado_en: '2026-11-17 10:00:01',
    },
  ],
};

describe('C-CAMILA-CHAT: la burbuja de soporte de la web', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('cerrada no pide nada; abierta sin haber conversado tampoco lee el hilo (mirar no escribe)', async () => {
    const llamadas = servidor((l) => (l.url.endsWith('/cuentas/yo') ? json({}, 401) : json(HILO)));
    render(<ChatSoporte idioma="es" />);
    expect(
      screen.getByRole('button', { name: 'Habla con nuestro equipo de soporte' }),
    ).toBeTruthy();
    expect(llamadas).toHaveLength(0);
    await userEvent.click(
      screen.getByRole('button', { name: 'Habla con nuestro equipo de soporte' }),
    );
    const chat = screen.getByRole('dialog', { name: 'Soporte de Divoox' });
    expect(chat).toHaveTextContent('Soy Camila Montes, del equipo de soporte de Divoox');
    await waitFor(() => expect(llamadas.some((l) => l.url.endsWith('/cuentas/yo'))).toBe(true));
    expect(llamadas.some((l) => l.url.includes('/camila/hilo'))).toBe(false);
  });

  it('manda el mensaje con la ficha del navegador y muestra a Camila con su nombre completo', async () => {
    const llamadas = servidor((l) => {
      if (l.url.endsWith('/cuentas/yo')) return json({}, 401);
      if (l.url.endsWith('/camila/mensaje'))
        return json({ respuesta: 'Por pago móvil, desde Ganancias.', ...HILO });
      return json(HILO);
    });
    render(<ChatSoporte idioma="es" />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Habla con nuestro equipo de soporte' }),
    );
    await userEvent.type(screen.getByLabelText('Escribe tu mensaje…'), '¿Cómo recargo mi saldo?');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Por pago móvil, desde Ganancias.')).toBeTruthy();
    const envio = llamadas.find((l) => l.url.endsWith('/camila/mensaje'))!;
    expect(envio.cuerpo).toEqual({ texto: '¿Cómo recargo mi saldo?', canal: 'web' });
    const visita = envio.cabeceras.get('x-camila-visita');
    expect(esVisitaCamila(visita)).toBe(true);
    expect(localStorage.getItem(LLAVE_VISITA_CAMILA)).toBe(visita);
    expect(
      screen.getAllByText('Camila Montes, del equipo de soporte de Divoox').length,
    ).toBeGreaterThan(1);
    // Enviado, la casilla queda vacía.
    await waitFor(() =>
      expect((screen.getByLabelText('Escribe tu mensaje…') as HTMLTextAreaElement).value).toBe(''),
    );
  });

  it('si falla el envío, lo escrito se queda en la casilla', async () => {
    servidor((l) =>
      l.url.endsWith('/camila/mensaje')
        ? json({ error: 'No pudimos guardar tu mensaje.' }, 500)
        : json({}, 401),
    );
    render(<ChatSoporte idioma="es" />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Habla con nuestro equipo de soporte' }),
    );
    await userEvent.type(screen.getByLabelText('Escribe tu mensaje…'), 'Hola');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect((screen.getByLabelText('Escribe tu mensaje…') as HTMLTextAreaElement).value).toBe(
      'Hola',
    );
  });

  it('con el equipo atendiendo, lo dice y el mensaje del equipo lleva su nombre', async () => {
    localStorage.setItem('divoox.camila.converso', '1');
    servidor(() =>
      json({
        verificada: true,
        equipoAtendiendo: true,
        mensajes: [
          { id: 'x', autor: 'equipo', texto: 'Ya lo revisamos.', creado_en: '2026-11-17 11:00:00' },
        ],
      }),
    );
    render(<ChatSoporte idioma="en" />);
    await userEvent.click(screen.getByRole('button', { name: 'Talk to our support team' }));
    expect(await screen.findByTestId('chat-equipo-atiende')).toHaveTextContent(
      'A person on our team will reply to you here.',
    );
    expect(screen.getByText('Divoox Support Team')).toBeTruthy();
    // Ya unida a su correo: no se ofrece unirla otra vez.
    expect(screen.queryByTestId('chat-unir')).toBeNull();
  });

  it('une el chat al correo con el código de seis números', async () => {
    const llamadas = servidor((l) => {
      if (l.url.endsWith('/cuentas/yo')) return json({}, 401);
      if (l.url.endsWith('/verificar')) return json({ ok: true });
      if (l.url.endsWith('/verificar/confirmar')) return json({ ...HILO, verificada: true });
      return json(HILO);
    });
    render(<ChatSoporte idioma="es" />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Habla con nuestro equipo de soporte' }),
    );
    await userEvent.click(screen.getByTestId('chat-unir'));
    await userEvent.type(screen.getByLabelText('Tu correo'), 'ana@ejemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Mandar el código' }));
    await userEvent.type(await screen.findByLabelText('Código de seis números'), '12a3456');
    await userEvent.click(screen.getByRole('button', { name: 'Unir el chat' }));
    expect(await screen.findByText('Listo: este chat quedó unido a tu correo.')).toBeTruthy();
    expect(llamadas.find((l) => l.url.endsWith('/verificar/confirmar'))?.cuerpo).toEqual({
      codigo: '123456',
    });
    expect(await screen.findByText('Por pago móvil, desde Ganancias.')).toBeTruthy();
  });
});
