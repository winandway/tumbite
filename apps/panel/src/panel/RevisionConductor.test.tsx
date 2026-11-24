import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RevisionConductor } from './RevisionConductor';

type Llamada = { url: string; metodo: string; cuerpo?: unknown };

const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado });

const paso = (clave: string, estado: string, quien = 'conductor', opcional = false) => ({
  clave,
  estado,
  quien,
  opcional,
});
/** La barra de un conductor con la moto por aprobar (el caso real de Tucaní). */
const BARRA_PENDIENTE = {
  pasos: [
    paso('telefono', 'hecho'),
    paso('cara', 'hecho'),
    paso('identidad', 'hecho', 'equipo'),
    paso('vehiculo', 'hecho'),
    paso('vehiculo_aprobado', 'pendiente', 'equipo'),
    paso('vehiculo_activo', 'pendiente', 'sistema'),
    paso('conectado', 'pendiente'),
    paso('pago_movil', 'pendiente', 'conductor', true),
  ],
  listo: false,
  recibiendo: false,
  servicios: [],
  siguiente: paso('vehiculo_aprobado', 'pendiente', 'equipo'),
  hechos: 4,
  total: 7,
  vehiculo: { id: 'm1', tipo: 'moto', estado: 'en_revision' },
};
const BARRA_LISTA = {
  ...BARRA_PENDIENTE,
  pasos: BARRA_PENDIENTE.pasos.map((p) =>
    p.clave === 'conectado' || p.clave === 'pago_movil' ? p : { ...p, estado: 'hecho' },
  ),
  listo: true,
  servicios: ['moto'],
  siguiente: paso('conectado', 'pendiente'),
  hechos: 6,
  total: 7,
};

/** El servidor simulado: lo que devuelven las rutas de Moto del superadmin. */
function servidor(
  llamadas: Llamada[],
  op: {
    abierto?: boolean;
    habilitar409?: boolean;
    papeles?: unknown[];
    vehiculos?: unknown[];
    servicios?: unknown[];
    esPrueba?: boolean;
    activacion?: unknown;
  } = {},
) {
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    const u = String(url);
    llamadas.push({
      url: u,
      metodo,
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (u.endsWith('/datos/admin/conductores/c1/activacion'))
      return responder(op.activacion ?? BARRA_PENDIENTE);
    if (u.includes('/ciudades-destino'))
      return responder({
        actual: { zonaId: 'VE-MER-ELVIGIA', pais: 'VE' },
        ciudades: [{ id: 'VE-MCB-CENTRO', nombre: 'Maracaibo', pais: 'VE' }],
      });
    if (metodo === 'POST' && u.endsWith('/datos/admin/comida/ciudades'))
      return responder(
        { zona: { id: 'VE-MER-ELVIGIA', pais: 'VE', moneda: 'USD' }, estado: 'disponible' },
        201,
      );
    if (metodo === 'POST' && u.endsWith('/datos/admin/viajes/ciudades'))
      return responder(
        {
          zona: { id: 'VE-CCS-PRUEBAS', pais: 'VE', moneda: 'USD' },
          tarifa: {},
          estado: 'disponible',
        },
        201,
      );
    if (u.endsWith('/datos/admin/pasajeros-pais'))
      return responder({
        paises: [
          {
            servicio: 'moto',
            pais: 'VE',
            abierto: op.abierto ?? false,
            solicitudMarca: op.abierto ? 'SOL-1234' : null,
            abiertoEn: op.abierto ? '2026-11-13 10:00:00' : null,
          },
        ],
      });
    if (u.includes('/datos/admin/papeles-conductor?'))
      return responder({
        documentos: op.papeles ?? [
          {
            id: 'doc1',
            conductorId: 'c1',
            conductor: 'Conductor Uno',
            tipo: 'licencia_moto',
            estado: 'pendiente',
            motivo: '',
            venceEn: null,
            creadoEn: '2026-11-12 09:00:00',
            pais: 'VE',
          },
        ],
      });
    if (u.endsWith('/datos/admin/conductores/c1/pasajeros'))
      return responder({
        nombre: 'Conductor Uno',
        esPrueba: op.esPrueba === true,
        fechaNacimiento: '1990-01-01',
        ciudad: { id: 'VE-CCS-PRUEBAS', nombre: 'Caracas (pruebas)', pais: 'VE' },
        perfil: {},
        identidad: 'pendiente',
        documentos: [],
        vehiculoActivo: { id: 'v1', tipo: 'moto', estado: 'aprobado' },
        servicios: op.servicios ?? [
          {
            servicioId: 'moto',
            habilitacion: null,
            requisitosFaltantes: ['identidad', 'casco_pasajero'],
            puedeActivar: false,
            motivo: '',
          },
        ],
      });
    if (u.includes('/datos/admin/vehiculos?')) return responder({ vehiculos: op.vehiculos ?? [] });
    if (metodo === 'GET' && u.endsWith('/datos/admin/tasas-referencia'))
      return responder({
        horasVigencia: 48,
        tasas: [
          {
            pais: 'VE',
            moneda: 'VES',
            tasa: 36.5,
            fecha: '2026-11-11',
            puestaEn: '2026-11-11 10:00:00',
            puestaPor: 'Soporte Divoox',
            vigente: false,
            enUso: { tasa: 911.6243, fecha: '2026-11-13', fuente: 'bcv' },
            oficial: { tasa: 911.6243, fecha: '2026-11-13', fuente: 'bcv' },
            modo: {
              modo: 'oficial',
              ajustePct: null,
              tasaFija: null,
              cambiadoEn: null,
              cambiadoPor: null,
            },
          },
        ],
        ajusteMaximoPct: 30,
      });
    if (metodo === 'PUT' && u.endsWith('/datos/admin/tasas-referencia/VE/modo'))
      return responder({ pais: 'VE', modo: 'flotante', enUso: null });
    if (metodo === 'PUT' && u.endsWith('/habilitaciones/c1/moto') && op.habilitar409)
      return responder(
        { error: 'Le faltan requisitos.', requisitosFaltantes: ['licencia_moto'] },
        409,
      );
    if (metodo === 'PUT') return responder({ ok: true });
    return responder({});
  });
}

describe('C-VERIFICACION-UNICA: todo lo de un conductor se decide en una sola pieza', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('C-BARRA-ACTIVACION: la barra dice qué falta y a quién le toca; lo del equipo lleva su botón', async () => {
    servidor([]);
    render(<RevisionConductor id="c1" base="/panel/control-x" idioma="es" />);
    const barra = await screen.findByTestId('barra-activacion');
    expect(within(barra).getByTestId('barra-frase').textContent).toBe(
      'Todavía no: falta vehículo aprobado (le toca al equipo).',
    );
    const moto = within(barra).getByTestId('paso-vehiculo_aprobado');
    expect(within(moto).getByText('Le toca al equipo')).toBeTruthy();
    expect(within(moto).getByRole('link', { name: 'Hacerlo aquí' }).getAttribute('href')).toBe(
      '#revision-vehiculo',
    );
    // Lo hecho en verde; lo pendiente en gris; nada en rojo si no hay un problema.
    expect(screen.getByTestId('paso-cara').querySelector('[data-tono="hecho"]')).toBeTruthy();
    expect(moto.querySelector('[data-tono="apagado"]')).toBeTruthy();
    expect(barra.querySelector('[data-tono="problema"]')).toBeNull();
    expect(within(barra).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('4');
  });

  it('C-BARRA-ACTIVACION: lista para recibir, lo dice sin ambigüedad (y avisa que sin pago móvil es solo efectivo)', async () => {
    servidor([], { activacion: BARRA_LISTA });
    render(<RevisionConductor id="c1" base="/panel/control-x" idioma="es" />);
    expect((await screen.findByTestId('barra-frase')).textContent).toBe(
      'Ya puede recibir carreras de Moto. Solo le falta abrir Driver y conectarse.',
    );
    expect(
      screen.getByText('Sin pago móvil, por ahora solo le llegan carreras en efectivo.'),
    ).toBeTruthy();
  });

  it('«Aprobar todo lo que está en verde» aprueba sus papeles, los del vehículo y el vehículo, con confirmación', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas, {
      vehiculos: [
        {
          id: 'm1',
          conductor: 'Conductor Uno',
          conductor_id: 'c1',
          tipo: 'moto',
          marca: 'Motos Divoox',
          modelo: 'M150',
          anio: 2023,
          color: 'Negro',
          placa: 'AB123CD',
          placa_estado: 'VE',
          estado: 'en_revision',
          documentos: [
            { id: 'dR', tipo: 'registro', estado: 'pendiente', venceEn: null },
            { id: 'dF', tipo: 'foto_frente', estado: 'aprobado', venceEn: null },
          ],
        },
      ],
    });
    vi.stubGlobal('confirm', () => true);
    const identidad = vi.fn(async () => undefined);
    render(
      <RevisionConductor
        id="c1"
        base="/panel/control-x"
        idioma="es"
        identidad={{ enVerde: true, aprobar: identidad }}
      />,
    );
    await screen.findByTestId('moto-m1');
    await screen.findByTestId('papel-doc1');
    await userEvent.click(screen.getByTestId('aprobar-todo'));
    await waitFor(() => expect(screen.getByText('Aprobaste 4 cosas.')).toBeTruthy());
    expect(identidad).toHaveBeenCalledTimes(1);
    expect(
      llamadas
        .filter((l) => l.metodo === 'PUT')
        .map((l) => l.url.replace(/.*\/datos\/admin\//, '')),
    ).toEqual(['papeles-conductor/doc1', 'vehiculos/m1/documentos/dR', 'vehiculos/m1']);
    // Las listas piden solo lo de ESTE conductor.
    expect(
      llamadas.some((l) => l.url.includes('/admin/vehiculos?estado=en_revision&conductor=c1')),
    ).toBe(true);
  });

  it('sin la identidad en verde, «Aprobar todo» no la toca', async () => {
    servidor([], { papeles: [] });
    vi.stubGlobal('confirm', () => true);
    const identidad = vi.fn(async () => undefined);
    render(
      <RevisionConductor
        id="c1"
        base="/panel/control-x"
        idioma="es"
        identidad={{ enVerde: false, aprobar: identidad }}
      />,
    );
    await screen.findByText('No tiene papeles esperando revisión.');
    expect((screen.getByTestId('aprobar-todo') as HTMLButtonElement).disabled).toBe(true);
    expect(identidad).not.toHaveBeenCalled();
  });

  it('aprobar un papel manda el PUT; rechazar está en los tres puntos y exige motivo', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas);
    render(<RevisionConductor id="c1" base="/panel/control-x" idioma="es" />);
    const fila = await screen.findByTestId('papel-doc1');
    expect(within(fila).getByText('Licencia de moto')).toBeTruthy();
    expect(within(fila).getByRole('link', { name: 'Ver el archivo' }).getAttribute('href')).toBe(
      '/datos/admin/papeles-conductor/doc1/archivo',
    );
    await userEvent.click(within(fila).getByRole('button', { name: 'Aprobar' }));
    await waitFor(() => {
      const put = llamadas.find((l) => l.metodo === 'PUT');
      expect(put?.url).toMatch(/\/datos\/admin\/papeles-conductor\/doc1$/);
      expect(put?.cuerpo).toEqual({ estado: 'aprobado' });
    });

    // Rechazar no está a la vista: vive en los tres puntos.
    const fila2 = await screen.findByTestId('papel-doc1');
    expect(within(fila2).queryByRole('button', { name: 'Rechazar' })).toBeNull();
    await userEvent.click(within(fila2).getByRole('button', { name: 'Más opciones del papel' }));
    await userEvent.click(within(fila2).getByRole('menuitem', { name: 'Rechazar' }));
    const confirmar = within(fila2).getByRole('button', { name: 'Confirmar el rechazo' });
    expect((confirmar as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(
      within(fila2).getByLabelText('Motivo del rechazo (la persona lo ve para corregir)'),
      'La foto se ve borrosa',
    );
    await userEvent.click(confirmar);
    await waitFor(() =>
      expect(llamadas.filter((l) => l.metodo === 'PUT').at(-1)?.cuerpo).toEqual({
        estado: 'rechazado',
        motivo: 'La foto se ve borrosa',
      }),
    );
  });

  it('el conductor muestra lo que le falta en palabras y el 409 de habilitar se explica', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas, { habilitar409: true });
    render(<RevisionConductor id="c1" base="/panel/control-x" idioma="es" />);
    await screen.findByTestId('papel-doc1');
    const detalle = await screen.findByTestId('detalle-conductor');
    expect(await within(detalle).findByText('Identidad verificada')).toBeTruthy();
    expect(within(detalle).getByText('Casco para el pasajero')).toBeTruthy();
    expect(
      within(detalle).getByRole('link', { name: 'Ir a Verificaciones' }).getAttribute('href'),
    ).toBe('/panel/control-x/verifications');
    await userEvent.click(
      within(detalle).getByRole('button', { name: 'Aprobar el casco del pasajero' }),
    );
    await waitFor(() =>
      expect(llamadas.find((l) => l.url.endsWith('/casco_pasajero'))?.cuerpo).toEqual({
        estado: 'aprobado',
        vehiculoId: 'v1',
      }),
    );
    await userEvent.click(within(detalle).getByRole('button', { name: 'Habilitar para Moto' }));
    const alerta = await within(detalle).findByRole('alert');
    expect(within(alerta).getByText('Licencia de moto')).toBeTruthy();
  });

  it('C-CARRO-PANEL: la cola muestra carros con sus papeles e inspección y se habilita para Carro', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas, {
      vehiculos: [
        {
          id: 'car1',
          conductor: 'Taxista Uno',
          conductor_id: 'c1',
          tipo: 'carro',
          marca: 'Toyota',
          modelo: 'Corolla',
          anio: 2018,
          color: 'Gris',
          placa: 'AB123CD',
          placa_estado: 'VE',
          plazas: 6,
          estado: 'en_revision',
          documentos: [{ id: 'dI', tipo: 'inspeccion', estado: 'pendiente', venceEn: null }],
        },
      ],
      servicios: [
        {
          servicioId: 'carro',
          habilitacion: null,
          requisitosFaltantes: ['licencia', 'inspeccion_vehiculo'],
          puedeActivar: false,
          motivo: '',
        },
      ],
    });
    render(<RevisionConductor id="c1" base="/panel/control-x" idioma="es" />);
    expect(await screen.findByText('Vehículo por revisar')).toBeTruthy();
    const fila = await screen.findByTestId('moto-car1');
    expect(within(fila).getByText(/Carro · 6 plazas/)).toBeTruthy();
    expect(within(fila).getByText('Revisión del vehículo (inspección)')).toBeTruthy();
    await userEvent.click(within(fila).getByRole('button', { name: 'Aprobar el carro' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.url.endsWith('/admin/vehiculos/car1'))?.cuerpo).toEqual({
        estado: 'aprobado',
      }),
    );
    const detalle = await screen.findByTestId('detalle-conductor');
    expect(await within(detalle).findByText('Licencia de conducir')).toBeTruthy();
    expect(within(detalle).getByText('Revisión del vehículo')).toBeTruthy();
    await userEvent.click(within(detalle).getByRole('button', { name: 'Habilitar para Carro' }));
    await waitFor(() =>
      expect(
        llamadas.find((l) => l.metodo === 'PUT' && l.url.endsWith('/habilitaciones/c1/carro')),
      ).toBeTruthy(),
    );
  });

  it('C-CIUDAD-CONDUCTOR: el equipo cambia la ciudad del conductor con motivo', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas);
    render(<RevisionConductor id="c1" base="/panel/control-x" idioma="es" />);
    await screen.findByTestId('papel-doc1');
    // C-CAMBIAR-CIUDAD-ADMIN: la misma pieza que la ficha del repartidor (lista del servidor).
    const form = await screen.findByTestId('cambiar-ciudad-repartidor');
    await waitFor(() =>
      expect(within(form).getByRole('option', { name: /Maracaibo/ })).toBeTruthy(),
    );
    await userEvent.selectOptions(within(form).getByLabelText('Ciudad nueva'), 'VE-MCB-CENTRO');
    await userEvent.type(within(form).getByLabelText(/Motivo/), 'Se mudó');
    await userEvent.click(within(form).getByRole('button', { name: 'Revisar el cambio' }));
    await userEvent.click(within(form).getByRole('button', { name: 'Sí, cambiar la ciudad' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.url.endsWith('/admin/conductores/c1/ciudad'))).toEqual({
        url: expect.stringContaining('/datos/admin/conductores/c1/ciudad'),
        metodo: 'PUT',
        cuerpo: { zonaId: 'VE-MCB-CENTRO', motivo: 'Se mudó' },
      }),
    );
    expect(await screen.findByText(/Listo\. Su código nuevo es/)).toBeTruthy();
  });

  it('solo en una cuenta de prueba sale «Aprobar antecedentes (cuenta de prueba)» y aprueba los dos', async () => {
    for (const esPrueba of [false, true]) {
      const llamadas: Llamada[] = [];
      servidor(llamadas, { esPrueba });
      const { unmount } = render(<RevisionConductor id="c1" base="/panel/control-x" idioma="es" />);
      await screen.findByTestId('papel-doc1');
      const detalle = await screen.findByTestId('detalle-conductor');
      await within(detalle).findByText('Identidad verificada');
      const boton = within(detalle).queryByTestId('aprobar-antecedentes-prueba');
      if (!esPrueba) {
        expect(boton).toBeNull();
        unmount();
        continue;
      }
      expect(within(detalle).getByTestId('etiqueta-prueba').textContent).toBe('Prueba');
      await userEvent.click(boton!);
      await waitFor(() =>
        expect(
          llamadas
            .filter((l) => l.metodo === 'PUT')
            .map((l) => l.url.replace(/.*cumplimientos\/c1\//, '')),
        ).toEqual(['antecedentes_pasajeros', 'historial_manejo']),
      );
      unmount();
    }
  });
});
