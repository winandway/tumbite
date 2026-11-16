import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SesionArmazon } from './armazon/Armazon';
import { SuperPedido, SuperPedidos } from './SuperPedido';
import { SuperViaje } from './SuperViaje';
import { SuperConfiguracion } from './SuperConfiguracion';
import { SuperTickets } from './Superadmin';
import { Hora, ProveedorHorario } from './horario';
import { ESPERA_GUARDAR_MS } from './usePreferencias';

/**
 * C-FICHA-OPERACION, C-TIEMPOS-OPERACION, C-MONITOREO-SERVICIOS y C-HORARIO-EMPLEADO (15 nov 2026,
 * pedidos de Richard). Todos los países.
 */
type Llamada = { metodo: string; url: string; cuerpo?: unknown };
function servidor(
  responder: (url: string, metodo: string) => unknown,
  preferencias: Record<string, Record<string, string>> = {},
) {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    llamadas.push({
      metodo,
      url: String(url),
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const pantalla = /\/admin\/preferencias\/(\w+)/.exec(String(url))?.[1];
    if (pantalla) {
      const v = preferencias[pantalla];
      return new Response(
        JSON.stringify(metodo === 'GET' ? { valor: v ?? {}, guardada: Boolean(v) } : { ok: true }),
      );
    }
    const r = responder(String(url), metodo);
    return r instanceof Response ? r : new Response(JSON.stringify(r ?? {}));
  });
  return llamadas;
}
const SESION = {
  usuario: { id: 'emp-1', nombre: 'Equipo', correo: 'e@ejemplo.com', rol: 'admin' },
  idioma: 'es',
  cambiar: () => {},
  salir: () => {},
} as never;
const conSesion = (n: React.ReactNode, horario = false) => (
  <SesionArmazon.Provider value={SESION}>
    {horario ? <ProveedorHorario>{n}</ProveedorHorario> : n}
  </SesionArmazon.Provider>
);

const ID = '407f2f1c-1234-4abc-9def-000000000001';
const tramo = (clave: string, resultado: string, extra: Record<string, unknown> = {}) => ({
  clave,
  realS: 600,
  previstoS: 900,
  diferenciaMin: -5,
  resultado,
  falta: [],
  ...extra,
});
const PEDIDO = {
  id: ID,
  estado: 'entregado',
  servicio: 'comida',
  total: 3400,
  propina: 400,
  moneda: 'USD',
  direccion: '45000 Grand River Ave, Novi, MI',
  notas: '',
  ciudad: 'Novi',
  zonaHoraria: 'America/Detroit',
  creadoEn: '2026-11-15 19:00:00',
  pagoStripe: 'pi_1',
  lineas: [{ nombre: 'Pizza Margherita', cantidad: 1 }],
  cliente: { id: 'c1', nombre: null },
  restaurante: {
    id: 'r1',
    nombre: 'Novi Pizza Co.',
    direccion: '43000 W 12 Mile Rd, Novi, MI',
    lugar: { lat: 42.48, lng: -83.47 },
  },
  repartidor: { id: 'd1', nombre: 'Jordan Lee', codigo: 'US-NOV-000014' },
  entregaLugar: { lat: 42.49, lng: -83.44 },
  recogida: {
    tipo: 'recogida',
    conFoto: true,
    creadaEn: '2026-11-15 19:20:00',
    confirmadaEn: '2026-11-15 19:21:00',
    confirmadaPor: { nombre: 'Novi Pizza Co.', rol: 'restaurante' },
    modo: null,
    nota: '',
    distanciaM: 18,
    lugar: { lat: 42.48, lng: -83.47 },
    borradaEn: null,
    seGuardaHasta: '2026-12-15 19:20:00',
    retenidaPorReclamo: false,
    foto: `/datos/pedidos/${ID}/evidencia/recogida`,
  },
  entrega: {
    tipo: 'entrega',
    conFoto: false,
    creadaEn: null,
    confirmadaEn: '2026-11-15 19:40:00',
    confirmadaPor: { nombre: 'Jordan Lee', rol: 'repartidor' },
    modo: 'mano',
    nota: '',
    distanciaM: 9,
    lugar: null,
    borradaEn: null,
    seGuardaHasta: null,
    retenidaPorReclamo: false,
    foto: null,
  },
  tiempos: [
    tramo('preparacion', 'cumplio'),
    tramo('ida', 'se_paso', { realS: 720, previstoS: 300, diferenciaMin: 7 }),
    tramo('espera', 'sin_dato', { realS: null, falta: ['llego_restaurante'] }),
    tramo('entrega', 'cumplio'),
    tramo('total', 'cumplio'),
  ],
  linea: [
    {
      tipo: 'estado',
      evento: 'creado',
      fecha: '2026-11-15 19:00:00',
      quien: null,
      rol: 'cliente',
      detalle: null,
      capa: 'principal',
      desdeAnteriorS: null,
    },
    {
      tipo: 'manager',
      evento: 'recordatorio_1',
      fecha: '2026-11-15 19:02:00',
      quien: null,
      rol: 'sistema',
      detalle: null,
      capa: 'manager',
      desdeAnteriorS: null,
    },
    {
      tipo: 'evidencia',
      evento: 'foto_recogida',
      fecha: '2026-11-15 19:20:00',
      quien: 'Jordan Lee',
      rol: 'repartidor',
      detalle: '18',
      capa: 'principal',
      desdeAnteriorS: 1200,
    },
    {
      tipo: 'estado',
      evento: 'entregado',
      fecha: '2026-11-15 19:40:00',
      quien: 'Jordan Lee',
      rol: 'repartidor',
      detalle: null,
      capa: 'principal',
      desdeAnteriorS: 1200,
    },
  ],
  cierre: {
    tipo: 'entregado',
    en: '2026-11-15 19:40:00',
    por: { nombre: 'Jordan Lee', rol: 'repartidor' },
  },
  cobro: {
    metodo: 'tarjeta',
    estado: 'no_aplica',
    montoRecibido: null,
    confirmadoEn: null,
    confirmadoPor: null,
  },
  tickets: [],
  excepcionUbicacion: null,
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('C-FICHA-OPERACION · ficha del pedido en el panel', () => {
  it('tiempos en verde, rojo y gris (con el dato que falta), foto borrosa hasta «Ver foto», en mano sin fallo', async () => {
    const llamadas = servidor(() => ({ pedido: PEDIDO }));
    render(conSesion(<SuperPedido base="/panel/control-x" id={ID} idioma="es" />, true));
    const tiempos = await screen.findByRole('region', { name: 'Tiempos' });
    expect(within(tiempos).getByText('Preparación').closest('li')?.className).toContain(
      'ficha-tramo-exito',
    );
    expect(
      within(tiempos).getByText('Ida del repartidor al restaurante').closest('li')?.className,
    ).toContain('ficha-tramo-problema');
    expect(within(tiempos).getByText(/Se pasó · \+7 min/)).toBeTruthy();
    expect(
      within(tiempos).getByText(/Falta: la llegada del repartidor al restaurante/),
    ).toBeTruthy();
    // La foto no se pide hasta tocar «Ver foto» (cada apertura pasa por la ruta de evidencias).
    expect(document.querySelector('img')).toBeNull();
    expect(llamadas.some((l) => l.url.includes('/evidencia/'))).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Ver foto' }));
    expect(document.querySelector('img')?.getAttribute('src')).toBe(
      `/datos/pedidos/${ID}/evidencia/recogida`,
    );
    // Entrega en mano: se dice, sin pintarlo como fallo.
    expect(screen.getByText('Sin foto: entrega en mano.')).toBeTruthy();
    expect(screen.getByText('Se guarda 30 días (hasta el 15 dic).')).toBeTruthy();
    // Cliente con la cuenta borrada.
    expect(screen.getAllByText('Cuenta eliminada').length).toBeGreaterThan(0);
    // C-FOTO-PUERTA: nada de la foto de la puerta de la casa.
    expect(document.body.innerHTML).not.toMatch(/foto-puerta|puertas\//);
    // El Manager se puede ocultar.
    expect(screen.getByText(/Manager: Recordatorio/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar lo que hizo el Manager' }));
    expect(screen.queryByText(/Manager: Recordatorio/)).toBeNull();
    expect(screen.getByText('Foto de la recogida')).toBeTruthy();
  });

  it('la foto borrada por retención lo dice con su fecha', async () => {
    servidor(() => ({
      pedido: {
        ...PEDIDO,
        recogida: {
          ...PEDIDO.recogida,
          conFoto: false,
          foto: null,
          borradaEn: '2026-12-16 04:00:00',
          seGuardaHasta: null,
        },
      },
    }));
    render(conSesion(<SuperPedido base="/panel/control-x" id={ID} idioma="en" />, true));
    expect(await screen.findByText('Photo deleted by the retention rule (Dec 15).')).toBeTruthy();
  });
});

describe('C-FICHA-OPERACION · ficha del viaje en el panel', () => {
  const VIAJE = {
    id: 'beefcafe-0000-4000-8000-000000000001',
    servicio: 'moto',
    esEnvio: false,
    estado: 'terminado',
    categoria: null,
    creadoEn: '2026-11-15 19:00:00',
    programadoPara: null,
    ciudad: 'Novi',
    zonaHoraria: 'America/Detroit',
    origen: { direccion: '26000 Novi Rd', lugar: { lat: 42.47, lng: -83.47 } },
    destino: { direccion: '12 Oaks Mall', lugar: { lat: 42.49, lng: -83.47 } },
    pasajero: { id: 'p1', nombre: 'Taylor Brooks' },
    conductor: { id: 'd1', nombre: 'Sam Rivera', codigo: 'US-NOV-000020' },
    vehiculo: { tipo: 'moto', descripcion: 'Roja Honda CB190', placa: 'ABC12D' },
    pin: { requerido: true, usado: true, intentosFallidos: 1 },
    importe: { cotizado: 1150, final: 1150, moneda: 'USD', metodo: 'tarjeta' },
    distancia: { cotizadaM: 2400, realM: 2550 },
    envio: null,
    emergencias: [
      {
        id: 'e1',
        rol: 'pasajero',
        creadoEn: '2026-11-15 19:10:00',
        atendidaEn: null,
        atendidaPor: null,
        nota: '',
      },
    ],
    tiempos: [
      tramo('asignacion', 'cumplio'),
      tramo('llegada', 'cumplio'),
      tramo('espera_pasajero', 'cumplio'),
      tramo('recorrido', 'cumplio'),
      tramo('total', 'cumplio'),
    ],
    linea: [
      {
        tipo: 'estado',
        evento: 'asignado',
        fecha: '2026-11-15 19:02:00',
        quien: 'Sam Rivera',
        rol: 'conductor',
        detalle: null,
        capa: 'principal',
        desdeAnteriorS: null,
      },
    ],
    tickets: [],
  };

  it('conductor, placa, PIN sin el número, emergencia sin atender y reclamo desde la ficha', async () => {
    const llamadas = servidor((url, metodo) =>
      metodo === 'POST' ? { id: 't-9' } : url.includes('/admin/viajes/') ? { viaje: VIAJE } : {},
    );
    render(conSesion(<SuperViaje base="/panel/control-x" id={VIAJE.id} idioma="en" />, true));
    expect(await screen.findByText('ABC12D')).toBeTruthy();
    expect(screen.getByText(/Started with the right PIN · 1 failed attempts/)).toBeTruthy();
    expect(screen.getByText('Not handled')).toBeTruthy();
    expect(screen.getByText('Rides don’t take photos of the rider.')).toBeTruthy();
    expect(screen.getByText('Sam Rivera · driver')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Open a claim' }));
    await userEvent.type(screen.getByLabelText('Subject'), 'Wait fee');
    await userEvent.type(
      screen.getByLabelText(/^What happened/),
      'The rider says the driver never arrived.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open the claim' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'POST')).toMatchObject({
        url: '/datos/admin/tickets',
        cuerpo: { enlace: VIAJE.id, asunto: 'Wait fee', prioridad: 'normal' },
      }),
    );
    expect(await screen.findByText(/Claim opened/)).toBeTruthy();
  });
});

describe('C-MONITOREO-SERVICIOS · pestañas por servicio', () => {
  it('cada pestaña pide su servicio, queda en la dirección y en los filtros guardados; los viajes abren su ficha', async () => {
    window.history.replaceState(null, '', '/panel/control-x/orders');
    const llamadas = servidor((url) =>
      url.includes('/contadores')
        ? {
            contadores: {
              todos: { vivos: 3, problemas: 1 },
              comida: { vivos: 2, problemas: 0 },
              tiendas: { vivos: 0, problemas: 0 },
              auto: { vivos: 0, problemas: 0 },
              moto: { vivos: 1, problemas: 1 },
              envios: { vivos: 0, problemas: 0 },
            },
            limitado: false,
            hayEnvios: false,
          }
        : url.includes('/admin/pedidos')
          ? {
              pedidos: url.includes('servicio=moto')
                ? [
                    {
                      id: 'beefcafe-0000-4000-8000-000000000001',
                      clave: 'x~1',
                      tipo: 'viaje',
                      servicio: 'moto',
                      estado: 'en_curso',
                      creadoEn: '2026-11-15 19:00:00',
                      total: 1150,
                      moneda: 'USD',
                      origen: 'Novi Rd',
                      destino: '12 Oaks Mall',
                      pasajero: 'Taylor Brooks',
                      conductor: 'Sam Rivera',
                      conductorCodigo: 'US-NOV-000020',
                      ciudad: 'Novi',
                      zonaHoraria: 'America/Detroit',
                      emergencia: true,
                      luz: 'rojo',
                      semaforo: { luz: 'rojo', minutos: 4, motivo: 'emergencia' },
                    },
                  ]
                : [],
            }
          : { ciudades: [] },
    );
    render(conSesion(<SuperPedidos base="/panel/control-x" idioma="es" />, true));
    const moto = await screen.findByRole('tab', { name: /Viajes en moto/ });
    await waitFor(() =>
      expect(within(moto).getByText('1', { selector: '.monitoreo-problemas' })).toBeTruthy(),
    );
    // Envíos solo aparece si hay alguno.
    expect(screen.queryByRole('tab', { name: /Envíos/ })).toBeNull();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => moto.click());
    expect(window.location.search).toBe('?servicio=moto');
    await waitFor(() =>
      expect(
        llamadas.some((l) => l.url.includes('/datos/admin/pedidos?estado=vivos&servicio=moto')),
      ).toBe(true),
    );
    const fila = await screen.findByText(/Novi Rd → 12 Oaks Mall/);
    expect(fila.closest('a')?.getAttribute('href')).toBe(
      '/panel/control-x/rides/beefcafe-0000-4000-8000-000000000001',
    );
    expect(screen.getByText('Emergencia abierta')).toBeTruthy();
    act(() => vi.advanceTimersByTime(ESPERA_GUARDAR_MS + 50));
    await waitFor(() =>
      expect(
        llamadas.find((l) => l.metodo === 'PUT' && l.url.endsWith('/preferencias/pedidos'))?.cuerpo,
      ).toMatchObject({
        valor: { servicio: 'moto' },
      }),
    );
  });

  it('la bandeja de tickets muestra el servicio y filtra por él (guardado)', async () => {
    const llamadas = servidor((url) =>
      url.includes('/admin/tickets?')
        ? {
            tickets: [
              {
                id: 't1',
                tipo: 'soporte',
                estado: 'abierto',
                nombre: 'Taylor Brooks',
                correo: 'x@example.com',
                asunto: 'Wait fee',
                ciudad: '',
                pais: '',
                actualizado: '2026-11-15 19:00:00',
                ultimo: '',
                servicio: 'moto',
              },
            ],
          }
        : {},
    );
    render(conSesion(<SuperTickets base="/panel/control-x" idioma="es" ticketId={null} />, true));
    expect(await screen.findByText('Wait fee')).toBeTruthy();
    expect(screen.getByTitle('Viajes en moto')).toBeTruthy();
    await userEvent.selectOptions(screen.getByLabelText('Servicio'), 'moto');
    await waitFor(() =>
      expect(
        llamadas.some((l) => l.url.includes('/admin/tickets?estado=abierto&servicio=moto')),
      ).toBe(true),
    );
  });
});

describe('C-HORARIO-EMPLEADO · horario de cada empleado', () => {
  it('una hora sale con el reloj y la zona del empleado y dice la zona cuando no es la suya', async () => {
    servidor(() => ({}), { horario: { formato: '24', zonaHoraria: 'America/Caracas' } });
    render(
      conSesion(
        <Hora fecha="2026-11-15 19:05:00" zona="America/Detroit" idioma="es" estilo="hora" />,
        true,
      ),
    );
    // Zona fija del empleado (Caracas): se muestra en su zona, sin sufijo, en 24 horas.
    await waitFor(() => expect(screen.getByText('15:05')).toBeTruthy());
  });

  it('en automático, la hora de la ciudad del dato con su zona al lado si no coincide', async () => {
    servidor(() => ({}), { horario: { formato: '12', zonaHoraria: 'auto' } });
    render(
      conSesion(
        <Hora fecha="2026-11-15 19:05:00" zona="Europe/Madrid" idioma="en" estilo="hora" />,
        true,
      ),
    );
    await waitFor(() => expect(screen.getByRole('time').textContent).toMatch(/^8:05 PM GMT\+1$/));
  });

  it('Configuración → Horario guarda el formato del empleado y muestra la hora de cada ciudad activa', async () => {
    const llamadas = servidor((url) =>
      url.includes('/horario/ciudades')
        ? {
            ciudades: [
              { id: 'US-MI-NOVI', nombre: 'Novi', pais: 'US', zonaHoraria: 'America/Detroit' },
              {
                id: 'VE-MER-ELVIGIA',
                nombre: 'El Vigía',
                pais: 'VE',
                zonaHoraria: 'America/Caracas',
              },
            ],
          }
        : {},
    );
    render(conSesion(<SuperConfiguracion idioma="es" />, true));
    expect(await screen.findByText('Novi')).toBeTruthy();
    expect(screen.getByText('El Vigía')).toBeTruthy();
    expect(screen.getByText(/America\/Caracas|Caracas/)).toBeTruthy();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => screen.getByLabelText('24 horas').click());
    act(() => vi.advanceTimersByTime(ESPERA_GUARDAR_MS + 50));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'PUT')).toMatchObject({
        url: '/datos/admin/preferencias/horario',
        cuerpo: { valor: { formato: '24', zonaHoraria: 'auto' } },
      }),
    );
  });

  /**
   * El candado: ninguna pantalla del superadmin vuelve a escribir fechas con `toLocaleString`,
   * `toLocaleDateString`, `toLocaleTimeString` o `Intl.DateTimeFormat` sueltos (todas pasan por la
   * pieza única con la preferencia del empleado). Visto en rojo con el SuperPedido anterior.
   */
  it('ninguna pantalla del superadmin formatea fechas por su cuenta', () => {
    const carpeta = __dirname;
    const archivos = [
      ...readdirSync(carpeta).filter(
        (f) =>
          /^(Super|Tablero|BuscadorSuper|FichaPiezas|NuevoReclamo|SolicitudCancelacion|DatoProtegido)/.test(
            f,
          ) &&
          f.endsWith('.tsx') &&
          !f.includes('.test.'),
      ),
      // C-PERMISOS-FINOS: las pantallas de «Equipo interno» viven en su carpeta.
      ...readdirSync(join(carpeta, 'equipo'))
        .filter((f) => /\.tsx?$/.test(f) && !f.includes('.test.'))
        .map((f) => join('equipo', f)),
    ];
    expect(archivos.length).toBeGreaterThan(15);
    const malos: string[] = [];
    for (const f of archivos)
      readFileSync(join(carpeta, f), 'utf8')
        .split('\n')
        .forEach((linea, i) => {
          if (
            /toLocale(Date|Time)String\(|Intl\.DateTimeFormat|new Date\([^)]*\)\.toLocaleString\(/.test(
              linea,
            )
          )
            malos.push(`${f}:${i + 1}: ${linea.trim()}`);
        });
    expect(malos, malos.join('\n')).toEqual([]);
  });
});
