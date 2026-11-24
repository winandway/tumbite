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
    esPrueba?: boolean;
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
    expect(await screen.findByText(/Se abrió Moto en VE-CCS-PRUEBAS/)).toBeTruthy();
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
    // C-COMIDA-VE-QUIEN-PAGA: ni líneas en cero ni «0 %»; el modelo dicho en una frase.
    expect(screen.queryByText('Cargo de servicio')).toBeNull();
    expect(screen.queryByText(/Pedido pequeño/)).toBeNull();
    expect(screen.queryByText(/\b0 %/)).toBeNull();
    expect(screen.getByTestId('comida-modelo').textContent).toContain(
      'El cliente paga solo la comida',
    );
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
    expect(await screen.findByText(/Se abrió Comida en VE-MER-ELVIGIA/)).toBeTruthy();
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

  it('abrir el país es un botón y una sola confirmación en línea: sin número de marca ni contraseña', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas);
    render(<SuperMoto base="/panel/control-x" idioma="es" />);
    const fila = await screen.findByTestId('pais-VE');
    expect(within(fila).getByText('Cerrado')).toBeTruthy();
    // Nada que escribir: ni el número de la marca ni la contraseña.
    expect(within(fila).queryByLabelText(/contraseña/i)).toBeNull();
    expect(within(fila).queryByLabelText(/solicitud de registro/i)).toBeNull();
    expect(within(fila).queryAllByRole('textbox')).toHaveLength(0);
    await userEvent.click(within(fila).getByRole('button', { name: 'Abrir en producción' }));
    // Todavía no se mandó nada: primero la confirmación, en la misma tarjeta (sin ventana).
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false);
    expect(within(fila).getByText(/¿Abrir Moto en VE en producción\?/)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(within(fila).getByRole('button', { name: 'Sí, abrir' }));
    await waitFor(() => {
      const put = llamadas.find((l) => l.metodo === 'PUT');
      expect(put?.url).toMatch(/\/datos\/admin\/pasajeros-pais\/VE\/moto$/);
      expect(put?.cuerpo).toEqual({ abierto: true, confirmo: true, nota: '' });
    });
  });

  it('cancelar la confirmación no manda nada y vuelve el botón', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas);
    render(<SuperMoto base="/panel/control-x" idioma="es" />);
    const fila = await screen.findByTestId('pais-VE');
    await userEvent.click(within(fila).getByRole('button', { name: 'Abrir en producción' }));
    await userEvent.click(within(fila).getByRole('button', { name: 'Cancelar' }));
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false);
    expect(within(fila).getByRole('button', { name: 'Abrir en producción' })).toBeTruthy();
  });

  it('cerrar el país vive en los tres puntos y pide una sola confirmación, sin contraseña', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas, { abierto: true });
    render(<SuperMoto base="/panel/control-x" idioma="es" />);
    const fila = await screen.findByTestId('pais-VE');
    expect(within(fila).getByText('Abierto').className).toContain('insignia-hecho');
    expect(within(fila).queryByRole('button', { name: 'Cerrar en producción' })).toBeNull();
    await userEvent.click(within(fila).getByRole('button', { name: 'Más opciones del país' }));
    await userEvent.click(within(fila).getByRole('menuitem', { name: 'Cerrar en producción' }));
    expect(within(fila).queryByLabelText(/contraseña/i)).toBeNull();
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false);
    await userEvent.click(within(fila).getByRole('button', { name: 'Confirmar el cierre' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'PUT')?.cuerpo).toEqual({
        abierto: false,
        confirmo: false,
        nota: '',
      }),
    );
  });

  it('C-VERIFICACION-UNICA: Moto ya no revisa papeles ni vehículos; deja el enlace a Verificaciones', async () => {
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
          documentos: [{ id: 'd1', tipo: 'registro', estado: 'pendiente', venceEn: null }],
        },
      ],
    });
    render(<SuperMoto base="/panel/control-x" idioma="es" />);
    const caja = await screen.findByTestId('revision-se-mudo');
    expect(
      within(caja).getByRole('link', { name: 'Ir a Verificaciones' }).getAttribute('href'),
    ).toBe('/panel/control-x/verifications');
    await screen.findByText('Abrir un servicio de viajes en una ciudad');
    expect(screen.queryByTestId('moto-m1')).toBeNull();
    expect(screen.queryByTestId('papel-doc1')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Aprobar/ })).toBeNull();
    expect(llamadas.some((l) => l.url.includes('/admin/vehiculos?'))).toBe(false);
    expect(llamadas.some((l) => l.url.includes('/admin/papeles-conductor?'))).toBe(false);
  });

  it('C-TASA-MODOS: muestra la tasa en uso y su fuente aunque nadie la haya escrito, y guarda el modo', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas);
    render(<SuperMoto base="/panel/control-x" idioma="es" />);
    const caja = await screen.findByTestId('tasa-referencia');
    expect(await within(caja).findByText(/911,6243/)).toBeTruthy();
    expect(within(caja).getByText(/Oficial BCV, automática/)).toBeTruthy();
    expect(
      (within(caja).getByLabelText(/Oficial BCV automática/) as HTMLInputElement).checked,
    ).toBe(true);
    // Flotante: la vista previa calcula el resultado sobre la oficial.
    await userEvent.click(within(caja).getByLabelText(/Flotante/));
    await userEvent.type(within(caja).getByLabelText('Ajuste sobre la oficial (%)'), '5');
    expect(within(caja).getByText(/957,2055/)).toBeTruthy();
    await userEvent.click(within(caja).getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.url.endsWith('/tasas-referencia/VE/modo'))?.cuerpo).toEqual({
        modo: 'flotante',
        ajustePct: 5,
      }),
    );
    expect(await within(caja).findByText('Guardado.')).toBeTruthy();
  });

  it('C-TASA-MODOS: la fija exige su tasa y un ajuste fuera del tope no se manda', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas);
    render(<SuperMoto base="/panel/control-x" idioma="es" />);
    const caja = await screen.findByTestId('tasa-referencia');
    await within(caja).findByText(/911,6243/);
    await userEvent.click(within(caja).getByLabelText(/Flotante/));
    await userEvent.type(within(caja).getByLabelText('Ajuste sobre la oficial (%)'), '45');
    await userEvent.click(within(caja).getByRole('button', { name: 'Guardar' }));
    expect(await within(caja).findByText(/entre -30 % y 30 %/)).toBeTruthy();
    await userEvent.click(within(caja).getByLabelText(/^Fija/));
    await userEvent.type(within(caja).getByLabelText('Tasa fija (bolívares por dólar)'), '950,5');
    await userEvent.click(within(caja).getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(
        llamadas.filter((l) => l.url.endsWith('/tasas-referencia/VE/modo')).at(-1)?.cuerpo,
      ).toEqual({
        modo: 'fija',
        tasaFija: 950.5,
      }),
    );
  });

  // C-CUENTA-PRUEBA: el botón de aprobar antecedentes sale solo en una cuenta de prueba.
});
