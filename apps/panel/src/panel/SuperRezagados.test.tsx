import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperRezagados, type AjustesRezagados } from './SuperRezagados';
import { EnviarMensaje } from './EnviarMensaje';
import { ActividadCuenta } from './ActividadCuenta';

/**
 * C-REZAGADOS en el panel (22 nov 2026) — todos los países. «Recordatorios de registro»: zonas con sus
 * tres modos (encender pide confirmación), guardar manda el objeto completo, la lista dice en palabras
 * qué le toca a cada persona o por qué no; «Enviar mensaje» no envía sin ver antes cómo queda; la línea
 * de tiempo dice cada mensaje en palabras. Datos neutros, sin ciudades reales.
 */
type Llamada = { metodo: string; url: string; cuerpo: unknown };
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });

const PLANTILLA = (p: string) => ({
  es: {
    asunto: `Asunto ${p}`,
    texto: `Hola, {nombre}. Te falta ${p}. {enlace}`,
    sms: `SMS ${p} corto`,
  },
  en: {
    asunto: `Subject ${p}`,
    texto: `Hi {nombre}, you are missing ${p}. {enlace}`,
    sms: `SMS ${p} short`,
  },
});
const FABRICA: AjustesRezagados = {
  plazosHoras: [3, 24, 72],
  topePorPaso: 3,
  topePorPersona: 6,
  topeDiario: 40,
  horaDesde: 8,
  horaHasta: 20,
  ventanaDias: 21,
  zonas: {},
  plantillas: {},
  plantillasZona: {},
  autorizados: [],
  enlaceCorto: 'divoox.com/go',
};
const DATOS = {
  ajustes: { ...FABRICA, zonas: { 'ZZ-EJEMPLO-A': 'previa' } },
  fabrica: {
    ajustes: FABRICA,
    plantillas: Object.fromEntries(
      ['fotos', 'vehiculo', 'servicio', 'linea', 'correo'].map((p) => [p, PLANTILLA(p)]),
    ),
  },
  limites: { topeDiarioMaximo: 200, ventanaDiasMaxima: 60 },
  pasos: ['fotos', 'vehiculo', 'servicio', 'linea', 'correo'],
  zonas: [
    { id: 'ZZ-EJEMPLO-A', nombre: 'Zona de ejemplo A', pais: 'VE' },
    { id: 'ZZ-EJEMPLO-B', nombre: 'Zona de ejemplo B', pais: 'US' },
  ],
  lista: [
    {
      id: 'u-1',
      rol: 'repartidor',
      nombre: 'Marina Ejemplo',
      zona: 'ZZ-EJEMPLO-A',
      zonaNombre: 'Zona de ejemplo A',
      modo: 'previa',
      creadoEn: '2026-11-21 10:00:00',
      paso: 'fotos',
      horasQuieto: 26,
      delPaso: 1,
      toca: 2,
      motivo: null,
      canales: ['correo', 'aviso'],
    },
    {
      id: 'u-2',
      rol: 'repartidor',
      nombre: 'Tomás Ejemplo',
      zona: 'ZZ-EJEMPLO-A',
      zonaNombre: 'Zona de ejemplo A',
      modo: 'previa',
      creadoEn: '2026-11-22 08:00:00',
      paso: 'vehiculo',
      horasQuieto: 1,
      delPaso: 0,
      toca: null,
      motivo: 'aun_no',
      canales: ['correo', 'aviso'],
    },
    {
      id: 'u-3',
      rol: 'cliente',
      nombre: 'Elena Ejemplo',
      zona: 'ZZ-EJEMPLO-A',
      zonaNombre: 'Zona de ejemplo A',
      modo: 'previa',
      creadoEn: '2026-11-10 08:00:00',
      paso: 'correo',
      horasQuieto: 300,
      delPaso: 0,
      toca: null,
      motivo: 'baja',
      canales: ['correo', 'aviso'],
    },
  ],
  recientes: [
    {
      creado_en: '2026-11-22 09:00:00',
      usuario_id: 'u-1',
      nombre: 'Marina Ejemplo',
      rol: 'repartidor',
      paso: 'fotos',
      canal: 'correo',
      origen: 'auto',
      numero: 1,
      estado: 'enviado',
      detalle: '',
    },
    {
      creado_en: '2026-11-22 09:00:00',
      usuario_id: 'u-1',
      nombre: 'Marina Ejemplo',
      rol: 'repartidor',
      paso: 'fotos',
      canal: 'sms',
      origen: 'manual',
      numero: 0,
      estado: 'rebotado',
      detalle: '',
    },
  ],
  sms: { venezuela: false, general: true },
};

function servidor() {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    const ruta = String(url);
    const cuerpo = init?.body ? JSON.parse(String(init.body)) : null;
    llamadas.push({ metodo, url: ruta, cuerpo });
    if (ruta.endsWith('/admin/camila/recordatorios') && metodo === 'PUT')
      return json({ ajustes: cuerpo });
    if (ruta.endsWith('/admin/camila/recordatorios')) return json(DATOS);
    if (ruta.includes('/recordatorios/u-1/mensaje')) {
      if ((cuerpo as { soloVista?: boolean }).soloVista)
        return json({
          vista: {
            asunto: 'Te falta un paso',
            texto: 'Hola, Marina. Te faltan tus fotos.',
            sms: 'Divoox: Marina, te faltan tus fotos.',
            aviso: { titulo: 'Te faltan tus fotos', cuerpo: 'Toca «Tus papeles».' },
            idioma: 'es',
          },
        });
      return json({
        resultados: [
          { canal: 'correo', estado: 'enviado', detalle: '' },
          { canal: 'sms', estado: 'sin_destino', detalle: 'sin_consentimiento' },
        ],
      });
    }
    return json({}, 404);
  });
  return llamadas;
}

describe('C-REZAGADOS · «Recordatorios de registro»', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('muestra las zonas con su modo y el aviso del SMS; cambiar un modo guarda el objeto completo', async () => {
    const llamadas = servidor();
    render(<SuperRezagados base="/panel/control-x" idioma="es" />);
    const zonas = await screen.findByTestId('rez-zonas');
    expect(screen.getByTestId('rez-sms-ve').textContent).toContain(
      'El SMS a Venezuela todavía no está activo',
    );
    const a = within(zonas).getByTestId('rez-zona-ZZ-EJEMPLO-A');
    expect(
      within(a).getByRole('radio', { name: 'Vista previa' }).getAttribute('aria-checked'),
    ).toBe('true');
    const b = within(zonas).getByTestId('rez-zona-ZZ-EJEMPLO-B');
    await userEvent.click(within(b).getByRole('radio', { name: 'Vista previa' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Guardar los cambios' })[0]!);
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(true));
    const put = llamadas.find((l) => l.metodo === 'PUT');
    expect(put?.url).toContain('/datos/admin/camila/recordatorios');
    expect(put?.cuerpo).toEqual({
      ...FABRICA,
      zonas: { 'ZZ-EJEMPLO-A': 'previa', 'ZZ-EJEMPLO-B': 'previa' },
    });
    expect(await screen.findByText('Cambios guardados.')).toBeTruthy();
  });

  it('encender una zona pide confirmación; cancelar no cambia nada', async () => {
    servidor();
    render(<SuperRezagados base="/panel/control-x" idioma="es" />);
    const b = within(await screen.findByTestId('rez-zonas')).getByTestId('rez-zona-ZZ-EJEMPLO-B');
    await userEvent.click(within(b).getByRole('radio', { name: 'Encendido' }));
    const dialogo = screen.getByTestId('rez-confirmar-encender');
    expect(dialogo.textContent).toContain(
      'Camila empezará a escribirle a personas reales de esta zona',
    );
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(within(b).getByRole('radio', { name: 'Apagado' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    await userEvent.click(within(b).getByRole('radio', { name: 'Encendido' }));
    await userEvent.click(
      within(screen.getByTestId('rez-confirmar-encender')).getByRole('button', {
        name: 'Sí, encender',
      }),
    );
    expect(within(b).getByRole('radio', { name: 'Encendido' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('la lista dice en palabras qué le toca a cada persona o por qué no, y los envíos con su color', async () => {
    servidor();
    render(<SuperRezagados base="/panel/control-x" idioma="es" />);
    const lista = await screen.findByTestId('rez-lista');
    const textos = within(lista)
      .getAllByTestId('rez-que-pasa')
      .map((c) => c.textContent);
    expect(textos[0]).toBe(
      'Le toca el 2.º recordatorio, por correo y aviso en la app (vista previa: no se envía)',
    );
    expect(textos[1]).toBe('Todavía no: le toca cuando lleve 3 h quieta.');
    expect(textos[2]).toBe('No le toca: pidió no recibir más recordatorios.');
    expect(within(lista).getByRole('link', { name: 'Marina Ejemplo' }).getAttribute('href')).toBe(
      '/panel/control-x/drivers/u-1',
    );
    const estados = within(screen.getByTestId('rez-recientes')).getAllByTestId('rez-estado');
    expect(estados.map((e) => e.getAttribute('data-tono'))).toEqual(['hecho', 'problema']);
    expect(estados[1]?.textContent).toContain('rebotó');
  });

  it('una plantilla cambiada se guarda con sus dos idiomas y «Restablecer» vuelve a la de fábrica', async () => {
    const llamadas = servidor();
    render(<SuperRezagados base="/panel/control-x" idioma="es" />);
    const caja = await screen.findByTestId('rez-plantillas');
    const es = within(caja).getByTestId('rez-plantilla-es');
    const asunto = within(es).getByLabelText('Asunto del correo');
    await userEvent.clear(asunto);
    await userEvent.type(asunto, 'Tus fotos te esperan');
    expect(within(caja).getByTestId('rez-plantilla-estado').textContent).toBe(
      'La cambió el equipo.',
    );
    await userEvent.click(screen.getAllByRole('button', { name: 'Guardar los cambios' })[1]!);
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(true));
    const put = llamadas.find((l) => l.metodo === 'PUT')?.cuerpo as AjustesRezagados;
    expect(put.plantillas.fotos?.es.asunto).toBe('Tus fotos te esperan');
    expect(put.plantillas.fotos?.en).toEqual(PLANTILLA('fotos').en);
    await userEvent.click(within(caja).getByRole('button', { name: 'Restablecer la de fábrica' }));
    expect(within(es).getByLabelText<HTMLInputElement>('Asunto del correo').value).toBe(
      'Asunto fotos',
    );
  });

  it('lo escrito no se pierde al volver a abrir la pantalla', async () => {
    servidor();
    const { unmount } = render(<SuperRezagados base="/panel/control-x" idioma="es" />);
    const ritmo = await screen.findByTestId('rez-ritmo');
    const tope = within(ritmo).getByLabelText(/Correos y SMS al día/);
    await userEvent.clear(tope);
    await userEvent.type(tope, '25');
    await new Promise((r) => setTimeout(r, 700));
    unmount();
    render(<SuperRezagados base="/panel/control-x" idioma="es" />);
    const otra = await screen.findByTestId('rez-ritmo');
    await waitFor(() =>
      expect(within(otra).getByLabelText<HTMLInputElement>(/Correos y SMS al día/).value).toBe(
        '25',
      ),
    );
    expect(screen.getByText('Recuperamos lo que estabas escribiendo.')).toBeTruthy();
  });
});

describe('C-REZAGADOS · autorizados y dirección corta del SMS', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('guardar manda los autorizados y la dirección corta (sin ellos el servidor responde 400)', async () => {
    const original = DATOS.ajustes;
    DATOS.ajustes = { ...original, autorizados: ['u-9'], enlaceCorto: 'divoox.com/v' };
    try {
      const llamadas = servidor();
      render(<SuperRezagados base="/panel/control-x" idioma="es" />);
      const ritmo = await screen.findByTestId('rez-ritmo');
      const corto = within(ritmo).getByLabelText(/^Dirección corta del SMS/);
      await userEvent.clear(corto);
      await userEvent.type(corto, 'divoox.com/video');
      await userEvent.click(screen.getAllByRole('button', { name: 'Guardar los cambios' })[0]!);
      await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(true));
      const put = llamadas.find((l) => l.metodo === 'PUT')?.cuerpo as AjustesRezagados;
      expect(put.autorizados).toEqual(['u-9']);
      expect(put.enlaceCorto).toBe('divoox.com/video');
    } finally {
      DATOS.ajustes = original;
    }
  });

  it('el contador del SMS cuenta con un nombre de 14 letras y la dirección corta puestos', async () => {
    servidor();
    render(<SuperRezagados base="/panel/control-x" idioma="es" />);
    const caja = await screen.findByTestId('rez-plantillas');
    const sms = within(within(caja).getByTestId('rez-plantilla-es')).getByLabelText(/^SMS/);
    await userEvent.clear(sms);
    await userEvent.type(sms, 'Divoox: {{nombre}, sigue: {{enlace_corto}');
    // «Divoox: » 8 + 14 + «, sigue: » 9 + «divoox.com/go» 13 = 44.
    expect(within(caja).getByTestId('rez-sms-largo-es').textContent).toMatch(/^44 de 160/);
  });

  it('autorizar a una persona de una zona en vista previa pide confirmación y guarda su id', async () => {
    const llamadas = servidor();
    render(<SuperRezagados base="/panel/control-x" idioma="es" />);
    const lista = await screen.findByTestId('rez-lista');
    const fila = within(lista).getAllByTestId('rez-fila')[0]!;
    await userEvent.click(within(fila).getByLabelText('Autorizar'));
    const dialogo = screen.getByTestId('rez-confirmar-autorizar');
    expect(dialogo.textContent).toContain(
      'Camila le escribirá a esta persona real en la próxima vuelta, aunque su zona siga en vista previa',
    );
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false);
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Sí, autorizar' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(true));
    const put = llamadas.find((l) => l.metodo === 'PUT')?.cuerpo as AjustesRezagados;
    expect(put.autorizados).toEqual(['u-1']);
    expect(put.enlaceCorto).toBe('divoox.com/go');
    expect(put.zonas).toEqual({ 'ZZ-EJEMPLO-A': 'previa' });
    await waitFor(() =>
      expect(within(fila).getByTestId('rez-autorizada').textContent).toBe(
        'Autorizada: se le escribe',
      ),
    );
    expect(within(fila).getByTestId('rez-que-pasa').textContent).toBe(
      'Le toca el 2.º recordatorio, por correo y aviso en la app',
    );
  });
});

describe('C-REZAGADOS · «Enviar mensaje» desde la ficha', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('no deja enviar sin ver antes cómo queda, manda lo elegido y dice el resultado en palabras', async () => {
    const llamadas = servidor();
    const alEnviar = vi.fn();
    render(
      <EnviarMensaje
        id="u-1"
        rol="repartidor"
        idioma="es"
        alCerrar={() => {}}
        alEnviar={alEnviar}
      />,
    );
    const enviar = screen.getByRole('button', { name: 'Enviar' });
    expect((enviar as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('enviar-mensaje-motivo').textContent).toContain(
      'Primero toca «Ver cómo queda»',
    );
    await userEvent.click(screen.getByLabelText(/^SMS/));
    await userEvent.click(screen.getByRole('button', { name: 'Ver cómo queda' }));
    const vista = await screen.findByTestId('enviar-mensaje-vista');
    expect(vista.textContent).toContain('Hola, Marina. Te faltan tus fotos.');
    expect(llamadas.at(-1)?.cuerpo).toEqual({
      canales: ['correo', 'sms', 'aviso'],
      plantilla: 'fotos',
      soloVista: true,
    });
    // Cambiar el mensaje después de verlo obliga a verlo otra vez.
    await userEvent.click(screen.getByLabelText('Aviso en la app'));
    expect((screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ver cómo queda' }));
    await screen.findByTestId('enviar-mensaje-vista');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    const resultado = await screen.findByTestId('enviar-mensaje-resultado');
    expect(llamadas.at(-1)?.cuerpo).toEqual({ canales: ['correo', 'sms'], plantilla: 'fotos' });
    expect(resultado.textContent).toContain('Correo: enviado');
    expect(resultado.textContent).toContain(
      'SMS: no salió, esta persona no marcó la casilla de SMS',
    );
    expect(alEnviar).toHaveBeenCalledTimes(1);
  });
});

describe('C-REZAGADOS · la línea de tiempo dice cada mensaje en palabras', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mensaje automático y manual, con su estado y su color', async () => {
    vi.stubGlobal('fetch', async () =>
      json({
        actividad: {
          alta: { fecha: '2026-11-22 10:00:00', conOrigen: false },
          esPrueba: false,
          dondeQuedo: { ultimo: 'cuenta', sigue: null, hechos: ['cuenta'], falta: [] },
          linea: [
            {
              fecha: '2026-11-22 12:00:00',
              tipo: 'mensaje',
              evento: 'mensaje:sms',
              detalle: 'libre|manual|rebotado|',
              quien: 'Soporte Ejemplo',
              enlace: null,
            },
            {
              fecha: '2026-11-22 11:00:00',
              tipo: 'mensaje',
              evento: 'mensaje:correo',
              detalle: 'fotos|auto|enviado|',
              quien: null,
              enlace: null,
            },
          ],
        },
      }),
    );
    render(<ActividadCuenta ruta="/datos/admin/repartidores/u-1/actividad" idioma="es" />);
    const caja = await screen.findByTestId('actividad');
    const filas = [...caja.querySelectorAll('.ficha-linea li')].map((li) => li.textContent);
    expect(filas[0]).toContain('El equipo le envió un SMS');
    expect(filas[0]).toContain('rebotó');
    expect(filas[0]).toContain('por Soporte Ejemplo');
    expect(filas[1]).toContain('Camila le envió un correo: recordatorio de sus fotos');
    expect(filas[1]).toContain('enviado');
    const tonos = screen.getAllByTestId('mensaje-estado').map((e) => e.getAttribute('data-tono'));
    expect(tonos).toEqual(['problema', 'hecho']);
  });
});
