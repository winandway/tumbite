import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperCamila } from './SuperCamila';

/**
 * C-CAMILA-FALLOS (18 nov 2026) — todos los países. «Fallos reportados» y «Preguntas de diagnóstico»
 * del buzón de Camila: el contador a la vista, cada reporte con sus respuestas y lo que Camila
 * adjuntó, lo escrito por la persona como texto (nunca HTML), la captura pedida con la sesión, el
 * «Marcar arreglado y avisar» con su confirmación, y proponer, aprobar y retirar preguntas.
 */
type Llamada = { metodo: string; url: string; cuerpo: unknown };
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });
const TIPOS = {
  pago: { es: 'Pagos y cobros', en: 'Payments' },
  mapa: { es: 'Mapa y ubicación', en: 'Map and location' },
};
const FALLO = {
  id: 'f1',
  codigo: 'F-0007',
  tipo: 'pago',
  titulo: 'la app no me deja recargar',
  estado: 'nuevo',
  reportes: 3,
  primera_vez: '2026-11-17 09:00:00',
  ultima_vez: '2026-11-18 10:00:00',
  arreglado_en: null,
  nota_arreglo: null,
};
const reporte = (id: string, persona: string, avisado = false) => ({
  id,
  personaId: persona,
  nombre: 'José Rangel',
  inicial: '<b>la app no me deja recargar</b>',
  preguntas: [
    {
      clave: 'que_hacia',
      es: '¿Qué estabas haciendo justo antes?',
      en: 'What were you doing right before?',
    },
    { clave: 'siempre', es: '¿Te pasa siempre?', en: 'Does it happen every time?' },
  ],
  respuestas: ['Toqué Ganancias y Recargar', ''],
  contexto: {
    hora: '2026-11-18T10:00:00.000Z',
    app: 'repartidor 1.9.0 (42)',
    aparato: 'Android 14',
    idioma: 'es',
    pais: 'VE',
    ciudad: 'El Vigía',
    viaje: null,
    pedido: { id: 'p-123', estado: 'entregado', creado_en: '2026-11-18 09:00:00' },
    errores: [{ metodo: 'POST', ruta: '/datos/recargas', mensaje: 'tiempo agotado' }],
  },
  captura: id === 'r1',
  avisado,
  completoEn: '2026-11-18 10:02:00',
});

function servidor() {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    const ruta = String(url);
    llamadas.push({ metodo, url: ruta, cuerpo: init?.body ? JSON.parse(String(init.body)) : null });
    if (ruta.includes('/captura/r1'))
      return new Response(
        new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }),
      );
    if (ruta.endsWith('/fallos/f1/arreglado')) return json({ ok: true, avisadas: 2 });
    if (ruta.endsWith('/fallos/f1'))
      return json({
        fallo: FALLO,
        reportes: [reporte('r1', 'per-1'), reporte('r2', 'per-2'), reporte('r3', 'per-2')],
      });
    if (ruta.includes('/camila/fallos?estado=arreglado')) return json({ fallos: [], tipos: TIPOS });
    if (ruta.includes('/camila/fallos?estado=nuevo'))
      return json({ fallos: [FALLO], tipos: TIPOS });
    if (ruta.endsWith('/camila/preguntas') && metodo === 'POST') return json({ id: 'q2' }, 201);
    if (ruta.includes('/camila/preguntas/')) return json({ ok: true });
    if (ruta.endsWith('/camila/preguntas'))
      return json({
        base: [
          {
            clave: 'que_hacia',
            es: '¿Qué estabas haciendo justo antes?',
            en: 'What were you doing right before?',
          },
          {
            clave: 'que_esperaba',
            es: '¿Qué esperabas que pasara?',
            en: 'What did you expect to happen?',
          },
          {
            clave: 'que_vio',
            es: '¿Qué viste en la pantalla?',
            en: 'What did you see on the screen?',
          },
          {
            clave: 'siempre',
            es: '¿Te pasa siempre o fue solo una vez?',
            en: 'Does it happen every time?',
          },
        ],
        preguntas: [
          {
            id: 'q1',
            tipo: 'mapa',
            pregunta_es: '¿Tenías la ubicación encendida?',
            pregunta_en: 'Was your location turned on?',
            estado: 'propuesta',
          },
        ],
        tipos: TIPOS,
      });
    return json({}, 404);
  });
  return llamadas;
}

describe('C-CAMILA-FALLOS: «Fallos reportados» y «Preguntas de diagnóstico»', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/panel/control-x/camila?view=fallos');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('la lista agrupa por fallo con el contador, el tipo en palabras y las fechas', async () => {
    servidor();
    render(<SuperCamila idioma="es" />);
    const lista = await screen.findByTestId('camila-lista-fallos');
    expect(lista).toHaveTextContent('F-0007');
    expect(lista).toHaveTextContent('Pagos y cobros');
    expect(lista).toHaveTextContent('3 reportes');
    expect(within(lista).getByLabelText('3 reportes')).toHaveTextContent('3');
    expect(lista).toHaveTextContent('Primera vez');
    await userEvent.click(screen.getByRole('button', { name: 'Arreglados' }));
    expect(await screen.findByText('Todavía no hay fallos marcados como arreglados.')).toBeTruthy();
  });

  it('el fallo abierto muestra cada reporte con sus respuestas, lo adjunto y la captura privada', async () => {
    servidor();
    render(<SuperCamila idioma="es" />);
    await userEvent.click(await screen.findByText('F-0007'));
    expect(window.location.search).toContain('person=f1');
    const r1 = await screen.findByTestId('camila-reporte-r1');
    // Lo que escribió la persona es texto: se ve tal cual, nunca se vuelve HTML.
    expect(r1).toHaveTextContent('<b>la app no me deja recargar</b>');
    expect(r1.querySelector('b')).toBeNull();
    expect(r1).toHaveTextContent('Toqué Ganancias y Recargar');
    expect(r1).toHaveTextContent('Sin respuesta');
    const tabla = within(r1).getByRole('table', { name: 'Lo que Camila adjuntó sola' });
    expect(tabla).toHaveTextContent('repartidor 1.9.0 (42)');
    expect(tabla).toHaveTextContent('Venezuela');
    expect(tabla).toHaveTextContent('El Vigía');
    expect(tabla).toHaveTextContent('p-123 · entregado');
    expect(tabla).toHaveTextContent('POST · /datos/recargas · tiempo agotado');
    expect(
      within(screen.getByTestId('camila-reporte-r2')).getByText('No mandó captura.'),
    ).toBeTruthy();
    await userEvent.click(within(r1).getByRole('button', { name: 'Ver la captura' }));
    const img = await within(r1).findByTestId('camila-captura');
    expect(img.getAttribute('src')).toMatch(/^data:.*;base64,/);
  });

  it('«Marcar arreglado y avisar» confirma a cuántas personas les escribe Camila y manda la nota', async () => {
    const llamadas = servidor();
    window.history.replaceState(null, '', '/panel/control-x/camila?view=fallos&person=f1');
    render(<SuperCamila idioma="es" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar arreglado y avisar' }));
    const confirmar = screen.getByTestId('camila-confirmar-arreglo');
    // Tres reportes de dos personas: Camila le escribe a dos.
    expect(confirmar).toHaveTextContent('Camila le va a escribir a 2 personas');
    expect(llamadas.some((l) => l.url.endsWith('/arreglado'))).toBe(false);
    await userEvent.type(within(confirmar).getByRole('textbox'), 'Ya puedes recargar.');
    await userEvent.click(
      within(confirmar).getByRole('button', { name: 'Sí, marcar arreglado y avisar' }),
    );
    expect(
      await screen.findByText('Marcado como arreglado. Camila avisó a 2 personas.'),
    ).toBeTruthy();
    expect(llamadas.find((l) => l.url.endsWith('/arreglado'))?.cuerpo).toEqual({
      nota: 'Ya puedes recargar.',
    });
  });

  it('las preguntas: las cuatro de base, proponer una en los dos idiomas, aprobar y retirar', async () => {
    const llamadas = servidor();
    window.history.replaceState(null, '', '/panel/control-x/camila?view=preguntas');
    render(<SuperCamila idioma="es" />);
    const zona = await screen.findByTestId('camila-preguntas');
    expect(zona.querySelectorAll('.camila-base li')).toHaveLength(4);
    await userEvent.click(within(zona).getByRole('button', { name: 'Proponer la pregunta' }));
    expect(await within(zona).findByRole('alert')).toHaveTextContent(
      'Escribe la pregunta en español y en inglés',
    );
    await userEvent.selectOptions(within(zona).getByLabelText('Tipo de fallo'), 'pago');
    await userEvent.type(
      within(zona).getByLabelText('Pregunta en español'),
      '¿Con qué banco recargaste?',
    );
    await userEvent.type(
      within(zona).getByLabelText('Pregunta en inglés'),
      'Which bank did you top up with?',
    );
    await userEvent.click(within(zona).getByRole('button', { name: 'Proponer la pregunta' }));
    await within(zona).findByText('Propuesta guardada. Queda esperando que alguien la apruebe.');
    expect(
      llamadas.find((l) => l.metodo === 'POST' && l.url.endsWith('/camila/preguntas'))?.cuerpo,
    ).toEqual({
      tipo: 'pago',
      preguntaEs: '¿Con qué banco recargaste?',
      preguntaEn: 'Which bank did you top up with?',
    });
    const lista = await within(zona).findByTestId('camila-lista-preguntas');
    expect(lista).toHaveTextContent('Mapa y ubicación');
    expect(lista).toHaveTextContent('Propuesta');
    await userEvent.click(within(lista).getByRole('button', { name: 'Aprobar' }));
    await within(zona).findByText('Aprobada: Camila ya la usa.');
    expect(llamadas.some((l) => l.url.endsWith('/preguntas/q1/aprobar'))).toBe(true);
    await userEvent.click(within(lista).getByRole('button', { name: 'Retirar' }));
    await within(zona).findByText('Retirada: Camila ya no la usa.');
    expect(llamadas.some((l) => l.url.endsWith('/preguntas/q1/retirar'))).toBe(true);
  });

  it('en inglés también', async () => {
    servidor();
    render(<SuperCamila idioma="en" />);
    expect(await screen.findByRole('tab', { name: 'Reported issues' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByText('Payments')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('3 reports')).toBeTruthy());
  });
});
