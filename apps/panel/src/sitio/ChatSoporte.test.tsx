import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  LLAVE_VISITA_CAMILA,
  esVisitaCamila,
  esperaDeEscrituraMs,
  usarEsperaDeEscritura,
} from '@tumbite/compartido';
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
  beforeEach(() => {
    localStorage.clear();
    usarEsperaDeEscritura(() => 0);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    usarEsperaDeEscritura(null);
  });

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
    // El encabezado dice quién es; el saludo es corto, no se presenta ni ofrece una persona.
    expect(chat).toHaveTextContent('Camila Campos, del equipo de soporte de Divoox');
    expect(chat).toHaveTextContent('Hola. ¿En qué te ayudo?');
    expect(chat).not.toHaveTextContent('Soy Camila');
    expect(chat).not.toHaveTextContent('hablar con una persona');
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
    // La etiqueta larga va UNA vez (el encabezado); cada mensaje lleva solo «Camila».
    expect(screen.getAllByText('Camila Campos, del equipo de soporte de Divoox')).toHaveLength(1);
    expect(screen.getAllByText('Camila').length).toBeGreaterThan(0);
    // Con conversación, el saludo fijo ya no aparece.
    expect(screen.queryByText('Hola. ¿En qué te ayudo?')).toBeNull();
    // Enviado, la casilla queda vacía.
    await waitFor(() =>
      expect((screen.getByLabelText('Escribe tu mensaje…') as HTMLTextAreaElement).value).toBe(''),
    );
  });

  it('C-CAMILA-REPORTAR: cada respuesta de Camila trae «Reportar respuesta» y queda marcada', async () => {
    const hilo = {
      verificada: false,
      equipoAtendiendo: false,
      mensajes: [
        { id: 'm1', autor: 'persona', texto: 'hola', creado_en: '2026-11-18 01:00:00' },
        {
          id: 'm2',
          autor: 'camila',
          texto: 'Hola, te ayudo.',
          creado_en: '2026-11-18 01:00:01',
          reportado: false,
        },
      ],
    };
    const llamadas = servidor((l) => {
      if (l.url.endsWith('/cuentas/yo')) return json({}, 401);
      if (l.url.endsWith('/camila/mensaje')) return json({ respuesta: 'Hola, te ayudo.', ...hilo });
      if (l.url.endsWith('/reportar')) return json({ ok: true });
      return json(hilo);
    });
    render(<ChatSoporte idioma="es" />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Habla con nuestro equipo de soporte' }),
    );
    await userEvent.type(screen.getByLabelText('Escribe tu mensaje…'), 'hola');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    // Solo la respuesta de Camila del hilo lleva el botón (ni el saludo fijo ni lo que escribió la persona).
    const botones = await screen.findAllByRole('button', { name: 'Reportar respuesta' });
    expect(botones).toHaveLength(1);
    await userEvent.click(botones[0]!);
    expect(await screen.findByText('Respuesta reportada. El equipo la va a revisar.')).toBeTruthy();
    expect(llamadas.some((l) => l.url.endsWith('/datos/camila/mensajes/m2/reportar'))).toBe(true);
    expect(screen.queryByRole('button', { name: 'Reportar respuesta' })).toBeNull();
  });

  it('C-CAMILA-TONO: mientras llega la respuesta se ve «Camila está escribiendo» con sus tres puntitos, y espera de 2 a 4 segundos', async () => {
    usarEsperaDeEscritura(null);
    expect(esperaDeEscrituraMs('Sí.')).toBeGreaterThanOrEqual(2000);
    expect(esperaDeEscrituraMs('x'.repeat(2000))).toBe(4000);
    usarEsperaDeEscritura(null);
    expect(esperaDeEscrituraMs('Hola')).toBeGreaterThanOrEqual(2000);
    expect(esperaDeEscrituraMs('Hola')).toBeLessThanOrEqual(4000);
    usarEsperaDeEscritura(() => 150);
    servidor((l) => {
      if (l.url.endsWith('/cuentas/yo')) return json({}, 401);
      if (l.url.endsWith('/camila/mensaje')) return json({ respuesta: 'Claro.', ...HILO });
      return json(HILO);
    });
    render(<ChatSoporte idioma="es" />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Habla con nuestro equipo de soporte' }),
    );
    await userEvent.type(screen.getByLabelText('Escribe tu mensaje…'), 'hola');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    const escribiendo = await screen.findByTestId('chat-escribiendo');
    expect(escribiendo).toHaveTextContent('Camila está escribiendo');
    expect(escribiendo.querySelectorAll('.chat-soporte-puntos i')).toHaveLength(3);
    await waitFor(() => expect(screen.queryByTestId('chat-escribiendo')).toBeNull());
  });

  it('lo que la persona escribe mientras Camila «escribe» no se borra al llegar la respuesta', async () => {
    usarEsperaDeEscritura(() => 400);
    servidor((l) => {
      if (l.url.endsWith('/cuentas/yo')) return json({}, 401);
      if (l.url.endsWith('/camila/mensaje')) return json({ respuesta: 'Claro.', ...HILO });
      return json(HILO);
    });
    render(<ChatSoporte idioma="es" />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Habla con nuestro equipo de soporte' }),
    );
    const casilla = screen.getByLabelText('Escribe tu mensaje…') as HTMLTextAreaElement;
    await userEvent.type(casilla, 'hola');
    await userEvent.click(screen.getByRole('button', { name: /Enviar/ }));
    await screen.findByTestId('chat-escribiendo');
    await waitFor(() => expect(casilla.value).toBe(''));
    await userEvent.type(casilla, 'y otra cosa');
    await waitFor(() => expect(screen.queryByTestId('chat-escribiendo')).toBeNull());
    expect(casilla.value).toBe('y otra cosa');
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

  it('durante la espera de «Camila está escribiendo» el botón dice «Un momento…»', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const fuente = readFileSync(join(__dirname, 'ChatSoporte.tsx'), 'utf8');
    expect(fuente).toContain('{respondiendo ? t.unMomento : enviando ? t.enviando : t.enviar}');
    expect(fuente.indexOf('setRespondiendo(true);')).toBeLessThan(
      fuente.indexOf('await esperar(r.respuesta);'),
    );
  });
});
