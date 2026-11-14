import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperMoto } from './SuperMoto';

type Llamada = { url: string; metodo: string; cuerpo?: unknown };

const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado });

/** El servidor simulado: lo que devuelven las rutas de Moto del superadmin. */
function servidor(
  llamadas: Llamada[],
  op: {
    abierto?: boolean;
    habilitar409?: boolean;
    papeles?: unknown[];
    vehiculos?: unknown[];
    servicios?: unknown[];
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
          },
        ],
      });
    if (metodo === 'PUT' && u.endsWith('/habilitaciones/c1/moto') && op.habilitar409)
      return responder(
        { error: 'Le faltan requisitos.', requisitosFaltantes: ['licencia_moto'] },
        409,
      );
    if (metodo === 'PUT') return responder({ ok: true });
    return responder({});
  });
}

describe('C-MOTO-PANEL: la sección Moto del superadmin', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('«Usar Caracas de pruebas» rellena el formulario y manda el POST correcto', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas);
    render(<SuperMoto base="/panel/control-x" idioma="es" />);
    await userEvent.click(screen.getByRole('button', { name: 'Usar Caracas de pruebas' }));
    expect(screen.getByLabelText<HTMLInputElement>('Código de la ciudad').value).toBe(
      'VE-CCS-PRUEBAS',
    );
    // La tarifa de mercado de Venezuela, de solo lectura y en dólares.
    expect(screen.getByText('$0.50')).toBeTruthy();
    expect(screen.getByText('$1.00')).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Motivo (queda en el registro)'), 'Pruebas Moto');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir Moto en esta ciudad' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toEqual({
        servicio: 'moto',
        zona: {
          id: 'VE-CCS-PRUEBAS',
          nombre: 'Caracas (pruebas)',
          lat: 10.4806,
          lng: -66.9036,
          radioKm: 25,
          zonaHoraria: 'America/Caracas',
          moneda: 'USD',
        },
        motivo: 'Pruebas Moto',
      }),
    );
    expect(await screen.findByText(/Moto quedó abierto en VE-CCS-PRUEBAS/)).toBeTruthy();
  });

  it('C-COMIDA-CIUDAD: Comida se abre en El Vigía con el mismo paso y sus tarifas de mercado', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas);
    render(<SuperMoto base="/panel/control-x" idioma="es" />);
    await userEvent.selectOptions(screen.getByLabelText('Servicio'), 'comida');
    await userEvent.click(screen.getByRole('button', { name: 'Usar El Vigía de pruebas' }));
    expect(
      screen.getByText('Tarifas de comida que se van a cobrar (mercado de Venezuela)'),
    ).toBeTruthy();
    expect(screen.getByText('$1.50')).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Motivo (queda en el registro)'), 'Comida El Vigía');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir Comida en esta ciudad' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'POST')).toEqual({
        url: expect.stringMatching(/\/datos\/admin\/comida\/ciudades$/),
        metodo: 'POST',
        cuerpo: {
          zona: {
            id: 'VE-MER-ELVIGIA',
            nombre: 'El Vigía',
            lat: 8.6219,
            lng: -71.6506,
            radioKm: 15,
            zonaHoraria: 'America/Caracas',
            moneda: 'USD',
          },
          motivo: 'Comida El Vigía',
        },
      }),
    );
    expect(await screen.findByText(/Comida quedó abierto en VE-MER-ELVIGIA/)).toBeTruthy();
  });

  it('C-CARRO-TARIFA-VE: «Usar El Vigía» con Carro muestra la tarifa de mercado y no la manda escrita', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas);
    render(<SuperMoto base="/panel/control-x" idioma="es" />);
    await userEvent.selectOptions(screen.getByLabelText('Servicio'), 'carro');
    await userEvent.click(screen.getByRole('button', { name: 'Usar El Vigía' }));
    expect(screen.getByLabelText<HTMLInputElement>('Código de la ciudad').value).toBe(
      'VE-MER-ELVIGIA',
    );
    expect(screen.getByText('$1.50')).toBeTruthy();
    expect(screen.getByText('$3.50')).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Motivo (queda en el registro)'), 'Pruebas Carro');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir Carro en esta ciudad' }));
    await waitFor(() => {
      const cuerpo = llamadas.find((l) => l.metodo === 'POST')?.cuerpo as Record<string, unknown>;
      expect(cuerpo.servicio).toBe('carro');
      expect(cuerpo.tarifa).toBeUndefined();
    });
  });

  it('C-ABRIR-CIUDAD: abre Carro en una ciudad de cualquier país con su tarifa escrita', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas);
    render(<SuperMoto base="/panel/control-x" idioma="es" />);
    await userEvent.selectOptions(screen.getByLabelText('Servicio'), 'carro');
    await userEvent.type(screen.getByLabelText('Código de la ciudad'), 'US-MI-DETROIT');
    await userEvent.type(screen.getByLabelText('Nombre de la ciudad'), 'Detroit');
    await userEvent.type(screen.getByLabelText('Latitud del centro'), '42.3314');
    await userEvent.type(screen.getByLabelText('Longitud del centro'), '-83.0458');
    await userEvent.clear(screen.getByLabelText('Zona horaria'));
    await userEvent.type(screen.getByLabelText('Zona horaria'), 'America/Detroit');
    await userEvent.type(screen.getByLabelText('Motivo (queda en el registro)'), 'Pruebas Carro');
    const boton = screen.getByRole('button', { name: 'Abrir Carro en esta ciudad' });
    // Sin tarifa no se puede abrir: fuera de Moto en Venezuela no hay tarifa de mercado.
    expect((boton as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(screen.getByLabelText('Banderazo'), '2.50');
    await userEvent.type(screen.getByLabelText('Por kilómetro'), '1.10');
    await userEvent.type(screen.getByLabelText('Por minuto'), '0.30');
    await userEvent.type(screen.getByLabelText('Precio mínimo'), '7');
    await userEvent.click(boton);
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toMatchObject({
        servicio: 'carro',
        zona: { id: 'US-MI-DETROIT', nombre: 'Detroit', zonaHoraria: 'America/Detroit' },
        tarifa: { base: 250, porKm: 110, porMinuto: 30, minimo: 700 },
        motivo: 'Pruebas Carro',
      }),
    );
  });

  it('lo escrito al abrir una ciudad se recupera al volver a la pantalla', async () => {
    servidor([]);
    const { unmount } = render(<SuperMoto base="/panel/control-x" idioma="es" />);
    await userEvent.type(screen.getByLabelText('Nombre de la ciudad'), 'Valencia');
    await userEvent.type(screen.getByLabelText('Motivo (queda en el registro)'), 'Abrir pronto');
    await new Promise((r) => setTimeout(r, 700));
    unmount();
    render(<SuperMoto base="/panel/control-x" idioma="es" />);
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLInputElement>('Nombre de la ciudad').value).toBe('Valencia'),
    );
    expect(screen.getByLabelText<HTMLInputElement>('Motivo (queda en el registro)').value).toBe(
      'Abrir pronto',
    );
    expect(screen.getAllByText('Recuperamos lo que estabas escribiendo.').length).toBeGreaterThan(
      0,
    );
  });

  it('abrir el país exige el número de solicitud; con todo manda el PUT completo', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas);
    render(<SuperMoto base="/panel/control-x" idioma="es" />);
    const fila = await screen.findByTestId('pais-VE');
    expect(within(fila).getByText('Cerrado')).toBeTruthy();
    const abrir = within(fila).getByRole('button', { name: 'Abrir en producción' });
    await userEvent.click(
      within(fila).getByLabelText(
        'Confirmo que lo legal y el seguro de pasajeros de este país están listos',
      ),
    );
    await userEvent.type(within(fila).getByLabelText('Tu contraseña'), 'clave-segura');
    // Sin el número de la solicitud de marca no se puede enviar.
    expect((abrir as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(abrir);
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false);
    await userEvent.type(
      within(fila).getByLabelText(
        'Número de la solicitud de registro de la marca Divoox en este país',
      ),
      'SOL-2026-001',
    );
    expect((abrir as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(abrir);
    await waitFor(() => {
      const put = llamadas.find((l) => l.metodo === 'PUT');
      expect(put?.url).toMatch(/\/datos\/admin\/pasajeros-pais\/VE\/moto$/);
      expect(put?.cuerpo).toEqual({
        abierto: true,
        solicitudMarca: 'SOL-2026-001',
        confirmo: true,
        clave: 'clave-segura',
        nota: '',
      });
    });
  });

  it('la contraseña no queda guardada en el borrador del país', async () => {
    servidor([]);
    render(<SuperMoto base="/panel/control-x" idioma="es" />);
    const fila = await screen.findByTestId('pais-VE');
    await userEvent.type(within(fila).getByLabelText('Tu contraseña'), 'clave-secreta');
    await new Promise((r) => setTimeout(r, 700));
    expect(JSON.stringify({ ...localStorage })).not.toContain('clave-secreta');
  });

  it('cerrar el país vive en los tres puntos y solo pide la contraseña', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas, { abierto: true });
    render(<SuperMoto base="/panel/control-x" idioma="es" />);
    const fila = await screen.findByTestId('pais-VE');
    expect(within(fila).getByText('Abierto').className).toContain('insignia-aprobado');
    expect(within(fila).queryByRole('button', { name: 'Cerrar en producción' })).toBeNull();
    await userEvent.click(within(fila).getByRole('button', { name: 'Más opciones del país' }));
    await userEvent.click(within(fila).getByRole('menuitem', { name: 'Cerrar en producción' }));
    await userEvent.type(within(fila).getByLabelText('Tu contraseña'), 'clave-segura');
    await userEvent.click(within(fila).getByRole('button', { name: 'Confirmar el cierre' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'PUT')?.cuerpo).toMatchObject({
        abierto: false,
        clave: 'clave-segura',
      }),
    );
  });

  it('aprobar un papel manda el PUT; rechazar está en los tres puntos y exige motivo', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas);
    render(<SuperMoto base="/panel/control-x" idioma="es" />);
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
    render(<SuperMoto base="/panel/control-x" idioma="es" />);
    const fila = await screen.findByTestId('papel-doc1');
    await userEvent.click(within(fila).getByRole('button', { name: 'Ver lo que le falta' }));
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
    render(<SuperMoto base="/panel/control-x" idioma="es" />);
    expect(await screen.findByText('Motos y carros por revisar')).toBeTruthy();
    const fila = await screen.findByTestId('moto-car1');
    expect(within(fila).getByText(/Carro · 6 plazas/)).toBeTruthy();
    expect(within(fila).getByText('Revisión del vehículo (inspección)')).toBeTruthy();
    await userEvent.click(within(fila).getByRole('button', { name: 'Aprobar el carro' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.url.endsWith('/admin/vehiculos/car1'))?.cuerpo).toEqual({
        estado: 'aprobado',
      }),
    );
    await userEvent.click(within(fila).getByRole('button', { name: 'Ver lo que le falta' }));
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
    render(<SuperMoto base="/panel/control-x" idioma="es" />);
    const fila = await screen.findByTestId('papel-doc1');
    await userEvent.click(within(fila).getByRole('button', { name: 'Ver lo que le falta' }));
    const form = await screen.findByTestId('cambiar-ciudad-conductor');
    await userEvent.type(within(form).getByLabelText('Código de la nueva ciudad'), 've-mcb-centro');
    await userEvent.type(within(form).getByLabelText('Motivo del cambio'), 'Se mudó');
    await userEvent.click(within(form).getByRole('button', { name: 'Cambiar la ciudad' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.url.endsWith('/admin/conductores/c1/ciudad'))).toEqual({
        url: expect.stringContaining('/datos/admin/conductores/c1/ciudad'),
        metodo: 'PUT',
        cuerpo: { zonaId: 'VE-MCB-CENTRO', motivo: 'Se mudó' },
      }),
    );
    expect(await screen.findByText('Ciudad cambiada.')).toBeTruthy();
  });

  it('C-BS-REFERENCIA: la tasa vencida se dice así y guardar la de hoy manda el PUT', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas);
    render(<SuperMoto base="/panel/control-x" idioma="es" />);
    const caja = await screen.findByTestId('tasa-referencia');
    expect(await within(caja).findByText('Vencida: ya no se muestra')).toBeTruthy();
    await userEvent.type(
      within(caja).getByLabelText('Tasa de hoy (bolívares por dólar)'),
      '842,56',
    );
    await userEvent.click(within(caja).getByRole('button', { name: 'Guardar la tasa de hoy' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.url.endsWith('/tasas-referencia/VE'))?.cuerpo).toEqual({
        tasa: 842.56,
      }),
    );
    expect(await within(caja).findByText('Tasa guardada.')).toBeTruthy();
  });
});
