import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperCamila, fechaCamila } from './SuperCamila';

/**
 * C-CAMILA-BUZON (17 nov 2026) — todos los países. El buzón de Camila en el superadmin: la bandeja
 * con sus casos y el gasto del día, la conversación con su respuesta en el mismo hilo, el aprendizaje
 * que exige los cuatro textos y los ajustes con sus topes.
 */
type Llamada = { metodo: string; url: string; cuerpo: unknown };

const BANDEJA = {
  casos: [
    {
      id: 'caso-1',
      persona_id: 'per-1',
      resumen: 'Quiere saber por qué no le llegan carreras.',
      motivo: 'pide_persona',
      creado_en: '2026-11-17 14:05:00',
      nombre: 'José Conductor',
      canal_ultimo: 'app',
      humano_hasta: null,
    },
  ],
  atendiendo: [
    {
      id: 'per-2',
      nombre: 'Ana Conductora',
      canal_ultimo: 'correo',
      humano_hasta: '2026-11-18 02:00:00',
      ultimo: 'Gracias, ya lo reviso.',
      autor_ultimo: 'equipo',
    },
  ],
  hoy: { microdolares: 250_000, llamadas: 12, regalos: 2, topeMicro: 1_000_000 },
};
const HILO = {
  persona: {
    id: 'per-1',
    nombre: 'José Conductor',
    correo: 'jose@ejemplo.com',
    canal_ultimo: 'app',
    usuario_id: 'u-1',
    equipoAtendiendo: true,
  },
  mensajes: [
    {
      id: 'm1',
      canal: 'app',
      autor: 'persona',
      texto: 'No me llegan carreras',
      creado_en: '2026-11-17 14:00:00',
      autor_nombre: null,
    },
    {
      id: 'm2',
      canal: 'app',
      autor: 'camila',
      texto: 'Te paso con el equipo.',
      creado_en: '2026-11-17 14:01:00',
      autor_nombre: null,
    },
    {
      id: 'm3',
      canal: 'correo',
      autor: 'persona',
      texto: 'Les escribo por correo: sigo sin carreras.',
      creado_en: '2026-11-17 15:00:00',
      autor_nombre: null,
    },
  ],
  correo: { asunto: 'Re: Mis carreras', de: 'jose@ejemplo.com' },
  casos: [
    {
      id: 'caso-1',
      resumen: 'Quiere saber por qué no le llegan carreras.',
      motivo: 'pide_persona',
      estado: 'abierto',
      creado_en: '2026-11-17 14:05:00',
    },
  ],
};

function servidor(extra: Record<string, unknown> = {}) {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    const ruta = String(url);
    llamadas.push({ metodo, url: ruta, cuerpo: init?.body ? JSON.parse(String(init.body)) : null });
    const json = (d: unknown, status = 200) =>
      new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });
    if (extra[`${metodo} ${ruta}`]) return json(extra[`${metodo} ${ruta}`]);
    if (ruta.endsWith('/camila/bandeja')) return json(BANDEJA);
    if (ruta.includes('/camila/hilos/per-1/responder')) return json({ ok: true, enviado: true });
    if (ruta.includes('/camila/hilos/per-1/devolver')) return json({ ok: true });
    if (ruta.includes('/camila/casos/caso-1/cerrar')) return json({ ok: true });
    if (ruta.includes('/camila/hilos/per-1')) return json(HILO);
    if (ruta.includes('/camila/hilos')) return json({ hilos: [] });
    if (ruta.endsWith('/camila/aprendizaje'))
      return json({
        propuestas: [
          {
            id: 'pro-1',
            pregunta_es: '¿Cómo cambio mi moto?',
            pregunta_en: '',
            respuesta_es: '',
            respuesta_en: '',
            veces: 4,
            semana: '2026-W47',
          },
        ],
        aprobadas: [],
        sinLista: 2,
      });
    if (ruta.includes('/aprendizaje/')) return json({ ok: true });
    if (ruta.endsWith('/camila/ajustes') && metodo === 'PUT') return json({ ok: true });
    if (ruta.endsWith('/camila/ajustes'))
      return json({
        ajustes: { ia: true, topeDiarioCentavos: 100, regalosPorDia: 20 },
        limites: { topeMaximoCentavos: 500, regalosPorDiaMaximo: 50 },
        modelos: {},
        iaConectada: true,
      });
    if (ruta.endsWith('/admin/zonas')) return json({ zonas: [{ pais: 'VE' }, { pais: 'US' }] });
    return json({}, 404);
  });
  return llamadas;
}

describe('C-CAMILA-BUZON: el buzón de Camila', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/panel/control-x/camila');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('la bandeja muestra el gasto del día contra el tope, los casos con su resumen y lo que atiende el equipo', async () => {
    servidor();
    render(<SuperCamila idioma="es" />);
    const gasto = await screen.findByTestId('camila-gasto');
    // 250 000 millonésimas = 0,25 dólares de un tope de 1 dólar.
    expect(gasto).toHaveTextContent(/0,25.*de.*1,00/);
    expect(gasto).toHaveTextContent('12 consultas');
    expect(screen.getByText('Quiere saber por qué no le llegan carreras.')).toBeTruthy();
    expect(screen.getByText('Pidió una persona')).toBeTruthy();
    expect(screen.getByText(/Gracias, ya lo reviso/)).toBeTruthy();
  });

  it('abre la conversación desde un caso, responde en el mismo hilo, la devuelve y cierra el caso', async () => {
    const llamadas = servidor();
    render(<SuperCamila idioma="es" />);
    await userEvent.click(await screen.findByText('Quiere saber por qué no le llegan carreras.'));
    // La conversación queda en la dirección (recargar vuelve al mismo hilo).
    expect(window.location.search).toContain('view=conversacion');
    expect(window.location.search).toContain('person=per-1');
    const hilo = await screen.findByTestId('camila-hilo');
    expect(within(hilo).getByText('No me llegan carreras')).toBeTruthy();
    expect(within(hilo).getByText('Te paso con el equipo.')).toBeTruthy();
    // C-CAMILA-CORREO-HILO: el correo va dentro de la misma conversación, marcado como correo, y
    // arriba se ve el asunto del hilo donde sale la respuesta.
    expect(within(hilo).getByTestId('camila-asunto').textContent).toBe(
      'Hilo de correo: Re: Mis carreras',
    );
    const marcas = within(hilo).getAllByTestId('camila-marca-correo');
    expect(marcas).toHaveLength(1);
    expect(marcas[0]!.closest('li')?.textContent).toContain('Les escribo por correo');
    await userEvent.type(
      within(hilo).getByLabelText('Responder en el mismo hilo'),
      'Ya activamos tu cuenta.',
    );
    await userEvent.click(within(hilo).getByRole('button', { name: 'Enviar respuesta' }));
    await screen.findByText('Respuesta enviada.');
    expect(llamadas.find((l) => l.url.endsWith('/responder'))?.cuerpo).toEqual({
      texto: 'Ya activamos tu cuenta.',
    });
    // Enviado, la casilla queda vacía (el borrador se borra).
    await waitFor(() =>
      expect(
        (within(hilo).getByLabelText('Responder en el mismo hilo') as HTMLTextAreaElement).value,
      ).toBe(''),
    );
    await userEvent.click(within(hilo).getByRole('button', { name: 'Devolver a Camila' }));
    await screen.findByText('Camila vuelve a responder esta conversación.');
    await userEvent.click(within(hilo).getByRole('button', { name: 'Cerrar el caso' }));
    await screen.findByText('Caso cerrado.');
    expect(llamadas.some((l) => l.url.endsWith('/casos/caso-1/cerrar'))).toBe(true);
  });

  it('el aprendizaje no deja aprobar sin los cuatro textos y manda los cuatro al aprobar', async () => {
    const llamadas = servidor();
    window.history.replaceState(null, '', '/panel/control-x/camila?view=aprendizaje');
    render(<SuperCamila idioma="es" />);
    const tarjeta = await screen.findByTestId('camila-propuesta-pro-1');
    expect(within(tarjeta).getByText('Se preguntó 4 veces')).toBeTruthy();
    expect(
      screen.getByText('2 preguntas sin respuesta todavía no están en la lista.'),
    ).toBeTruthy();
    await userEvent.click(within(tarjeta).getByRole('button', { name: 'Aprobar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Llena las cuatro casillas');
    expect(llamadas.some((l) => l.url.endsWith('/aprobar'))).toBe(false);
    await userEvent.type(
      within(tarjeta).getByLabelText('Pregunta en inglés'),
      'How do I change my motorcycle?',
    );
    await userEvent.type(
      within(tarjeta).getByLabelText('Respuesta en español'),
      'En Perfil, Mi vehículo.',
    );
    await userEvent.type(
      within(tarjeta).getByLabelText('Respuesta en inglés'),
      'In Profile, My vehicle.',
    );
    await userEvent.click(within(tarjeta).getByRole('button', { name: 'Aprobar' }));
    await screen.findByText('Aprobada: Camila ya la usa.');
    expect(llamadas.find((l) => l.url.endsWith('/pro-1/aprobar'))?.cuerpo).toEqual({
      preguntaEs: '¿Cómo cambio mi moto?',
      preguntaEn: 'How do I change my motorcycle?',
      respuestaEs: 'En Perfil, Mi vehículo.',
      respuestaEn: 'In Profile, My vehicle.',
    });
  });

  it('los ajustes guardan en centavos y respetan el tope; no hay interruptor de aviso de asistente virtual (C-CAMILA-SIN-AVISO)', async () => {
    const llamadas = servidor();
    window.history.replaceState(null, '', '/panel/control-x/camila?view=ajustes');
    render(<SuperCamila idioma="es" />);
    const form = await screen.findByTestId('camila-ajustes');
    const tope = within(form).getByLabelText('Tope diario de IA (dólares)');
    await waitFor(() => expect((tope as HTMLInputElement).value).toBe('1'));
    expect(within(form).queryByRole('switch', { name: 'Estados Unidos' })).toBeNull();
    expect(form.textContent).not.toMatch(/asistente virtual/i);
    await userEvent.clear(tope);
    await userEvent.type(tope, '9');
    await userEvent.click(within(form).getByRole('button', { name: 'Guardar los ajustes' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('El tope diario va de 0 a');
    await userEvent.clear(tope);
    await userEvent.type(tope, '2.5');
    await userEvent.click(within(form).getByRole('button', { name: 'Guardar los ajustes' }));
    await within(form).findByText('Ajustes guardados.');
    expect(llamadas.find((l) => l.metodo === 'PUT')?.cuerpo).toEqual({
      ia: true,
      topeDiarioCentavos: 250,
      regalosPorDia: 20,
    });
  });

  it('en inglés también', async () => {
    servidor();
    render(<SuperCamila idioma="en" />);
    expect(await screen.findByText('Asked for a person')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Inbox' })).toHaveAttribute('aria-selected', 'true');
    expect(fechaCamila('', 'en')).toBe('');
    expect(fechaCamila('no es fecha', 'en')).toBe('no es fecha');
  });
});
