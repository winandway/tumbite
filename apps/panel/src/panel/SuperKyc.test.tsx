import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperKyc } from './SuperKyc';
import { ConfiguracionVerificaciones } from './ConfiguracionVerificaciones';
import { compararDatos, nombresCoinciden } from './kycComparar';
import { isValidElement, type ReactElement } from 'react';
import { seccionAdmin } from './PanelApp';

/**
 * C-VERIFICACIONES-BANDEJA (22 nov 2026, Gerencia) — todos los países. La pantalla de
 * Verificaciones: la lista arriba, las pestañas, el buscador, la miniatura que se abre en grande, la
 * comprobación de cada foto, la Configuración aparte y el rechazo con motivo obligatorio. Cada prueba
 * se vio en rojo contra la pantalla vieja o rompiendo su pieza (anotado en CANDADOS.md).
 */
const BASE = '/panel/control-x';
const ID = '407f2f1c-1234-4abc-9def-000000000001';

type Llamada = { url: string; metodo: string; cuerpo: unknown };

function servidor(manejar: (url: string, init?: RequestInit) => unknown) {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    let cuerpo: unknown;
    try {
      cuerpo = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    } catch {
      cuerpo = undefined;
    }
    llamadas.push({ url, metodo: init?.method ?? 'GET', cuerpo });
    const r = manejar(url, init) ?? {};
    return new Response(JSON.stringify(r), { status: 200 });
  });
  return llamadas;
}

const haceHoras = (h: number) =>
  new Date(Date.now() - h * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');

const fila = (x: Record<string, unknown> = {}) => ({
  id: ID,
  estado: 'pendiente',
  nombre: 'Persona Uno',
  correo: 'persona.uno@ejemplo.com',
  telefono: '',
  rol: 'repartidor',
  codigo: 'US-ZZN-000012',
  restaurante: null,
  enviado: haceHoras(3),
  revisado: null,
  motivo: '',
  lejos: false,
  zonaId: 'US-ZZ-NORTE',
  zona: 'Ciudad Norte',
  esPrueba: false,
  miniatura: 'selfie',
  comprobaciones: [
    { pieza: 'doc_frente', tono: 'hecho', motivo: 'cuadra' },
    { pieza: 'doc_reverso', tono: 'pendiente', motivo: 'ilegible' },
    { pieza: 'selfie', tono: 'apagado', motivo: 'a_mano' },
  ],
  cara: { resultado: 'dudoso', tono: 'pendiente' },
  ...x,
});

function bandeja(filas: unknown[] = [fila()], totales: Record<string, number> = { pendiente: 1 }) {
  return servidor((url) => {
    if (url.startsWith('/datos/admin/kyc?'))
      return { solicitudes: filas, siguiente: null, totales };
    if (url.includes('/horario/ciudades'))
      return { ciudades: [{ id: 'US-ZZ-NORTE', nombre: 'Ciudad Norte', pais: 'US' }] };
    if (url.includes('/preferencias/')) return { valor: {}, guardada: false };
    return {};
  });
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('C-VERIFICACIONES-BANDEJA · la bandeja', () => {
  it('lo primero es la lista de personas; las reglas ya no están en la pantalla principal', async () => {
    const llamadas = bandeja();
    render(<SuperKyc base={BASE} idioma="es" id={null} />);
    const lista = await screen.findByTestId('kyc-lista');
    expect(within(lista).getByText('Persona Uno')).toBeInTheDocument();
    expect(within(lista).getByText('US-ZZN-000012')).toBeInTheDocument();
    expect(within(lista).getByText('Ciudad Norte')).toBeInTheDocument();
    // Las reglas, el reparto y el gasto de la comprobación viven en Configuración.
    expect(screen.queryByText('Reglas para repartidores')).toBeNull();
    expect(screen.queryByText('Reparto de Comida por habilitaciones')).toBeNull();
    expect(screen.queryByTestId('tablero-ia')).toBeNull();
    expect(
      llamadas.some((l) =>
        /interruptores-repartidor|despacho-catalogo|verificacion-ia\/tablero/.test(l.url),
      ),
    ).toBe(false);
    expect(screen.getByRole('link', { name: /Configuración/ })).toHaveAttribute(
      'href',
      `${BASE}/verifications/settings`,
    );
    // Siempre decide una persona: se dice en una línea discreta.
    expect(screen.getByText(/siempre decide una persona/)).toBeInTheDocument();
    // La fila lleva a la revisión y a la ficha completa del conductor.
    expect(within(lista).getByRole('link', { name: 'Revisar' })).toHaveAttribute(
      'href',
      `${BASE}/verifications/${ID}`,
    );
    expect(within(lista).getByRole('link', { name: 'Ficha completa' })).toHaveAttribute(
      'href',
      `${BASE}/drivers/${ID}`,
    );
  });

  it('cada foto dice lo que vio la comprobación: verde si cuadra, ámbar con el motivo, gris a mano', async () => {
    bandeja();
    render(<SuperKyc base={BASE} idioma="es" id={null} />);
    const frente = await screen.findByTestId('comprobacion-doc_frente');
    expect(frente).toHaveTextContent('Documento (frente): todo cuadra');
    expect(frente).toHaveAttribute('data-tono', 'hecho');
    const reverso = screen.getByTestId('comprobacion-doc_reverso');
    expect(reverso).toHaveTextContent('no se lee bien');
    expect(reverso).toHaveAttribute('data-tono', 'pendiente');
    expect(screen.getByTestId('comprobacion-selfie')).toHaveAttribute('data-tono', 'apagado');
    expect(screen.getByTestId('comprobacion-cara')).toHaveTextContent('Cara y documento: dudoso');
  });

  it('la espera va en ámbar y pasa a rojo después de 24 horas', async () => {
    bandeja([fila(), fila({ id: 'otra', nombre: 'Persona Dos', enviado: haceHoras(30) })]);
    render(<SuperKyc base={BASE} idioma="es" id={null} />);
    await screen.findByText('Persona Dos');
    const esperas = screen.getAllByTestId('kyc-espera');
    expect(esperas[0]).toHaveAttribute('data-tono', 'pendiente');
    expect(esperas[1]).toHaveAttribute('data-tono', 'problema');
  });

  it('la miniatura abre la foto en grande y se cierra con Escape o tocando fuera', async () => {
    bandeja();
    render(<SuperKyc base={BASE} idioma="es" id={null} />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Ver la foto de Persona Uno en grande' }),
    );
    const capa = screen.getByTestId('foto-grande');
    expect(within(capa).getByRole('img')).toHaveAttribute(
      'src',
      `/datos/admin/kyc/${ID}/foto/selfie`,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('foto-grande')).toBeNull();
    await userEvent.click(
      screen.getByRole('button', { name: 'Ver la foto de Persona Uno en grande' }),
    );
    await userEvent.click(screen.getByTestId('foto-grande'));
    expect(screen.queryByTestId('foto-grande')).toBeNull();
  });

  it('las pestañas piden su estado y muestran cuántas hay', async () => {
    const llamadas = bandeja([fila()], { pendiente: 1, aprobado: 4, rechazado: 2 });
    render(<SuperKyc base={BASE} idioma="es" id={null} />);
    expect(await screen.findByRole('tab', { name: 'Aprobadas (4)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pendientes (1)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Rechazadas (2)' }));
    await waitFor(() =>
      expect(llamadas.some((l) => l.url.includes('/datos/admin/kyc?estado=rechazado'))).toBe(true),
    );
    expect(screen.getByRole('tab', { name: 'Rechazadas (2)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('el buscador sugiere desde la primera letra y dice si lo buscado está en otra pestaña', async () => {
    const llamadas = servidor((url) => {
      if (url.startsWith('/datos/admin/kyc?'))
        return url.includes('q=')
          ? { solicitudes: [], siguiente: null, totales: { aprobado: 1 } }
          : { solicitudes: [fila()], siguiente: null, totales: { pendiente: 1 } };
      return {};
    });
    render(<SuperKyc base={BASE} idioma="es" id={null} />);
    await screen.findByText('Persona Uno');
    await userEvent.type(screen.getByRole('searchbox'), 'm');
    await waitFor(() =>
      expect(llamadas.some((l) => /\/datos\/admin\/kyc\?.*q=m(&|$)/.test(l.url))).toBe(true),
    );
    expect(await screen.findByText('Hay 1 en Aprobadas.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver Aprobadas' }));
    await waitFor(() =>
      expect(llamadas.some((l) => /estado=aprobado.*q=m/.test(l.url))).toBe(true),
    );
  });

  it('los filtros de zona y cuentas se piden al servidor y se recuerdan', async () => {
    const llamadas = bandeja();
    const { unmount } = render(<SuperKyc base={BASE} idioma="es" id={null} />);
    await screen.findByText('Persona Uno');
    await screen.findByRole('option', { name: 'Ciudad Norte (US)' });
    await userEvent.selectOptions(screen.getByTestId('filtro-zona'), 'US-ZZ-NORTE');
    await userEvent.selectOptions(screen.getByTestId('filtro-cuentas'), 'prueba');
    await waitFor(() =>
      expect(
        llamadas.some(
          (l) => l.url.includes('cuentas=prueba') && l.url.includes('zona=US-ZZ-NORTE'),
        ),
      ).toBe(true),
    );
    unmount();
    llamadas.length = 0;
    render(<SuperKyc base={BASE} idioma="es" id={null} />);
    await screen.findByText('Persona Uno');
    expect(llamadas.find((l) => l.url.startsWith('/datos/admin/kyc?'))?.url).toMatch(
      /cuentas=prueba.*zona=US-ZZ-NORTE|zona=US-ZZ-NORTE.*cuentas=prueba/,
    );
  });
});

/**
 * C-VERIFICACIONES-SIN-ENVIAR (22 nov 2026) — todos los países. Quien se registró y todavía no mandó
 * sus fotos tiene su pestaña con contador; su fila dice hace cuánto se registró y qué le falta, y
 * lleva a su ficha completa (no hay fotos que revisar).
 */
describe('C-VERIFICACION-UNICA · un pendiente por conductor', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('dice qué espera de cada uno; solo lo que está en verde se elige y se aprueba junto, con confirmación', async () => {
    const llamadas = bandeja(
      [
        fila({ id: 'a', nombre: 'Ana Verde', porDecidir: ['identidad'], enVerde: true }),
        fila({
          id: 'b',
          nombre: 'Beto Moto',
          estado: 'aprobado',
          porDecidir: ['vehiculo'],
          enVerde: false,
        }),
      ],
      { pendiente: 2 },
    );
    vi.stubGlobal('confirm', () => true);
    render(<SuperKyc base={BASE} idioma="es" id={null} />);
    const filas = await screen.findAllByTestId('kyc-fila');
    expect(within(filas[1]!).getByText('Por decidir: Vehículo')).toBeInTheDocument();
    // En «Pendientes», quien solo espera su moto dice cuánto lleva esperando, no «aprobada».
    expect(within(filas[1]!).getByTestId('kyc-espera')).toBeInTheDocument();
    expect(within(filas[1]!).queryByRole('checkbox')).toBeNull();
    const boton = screen.getByTestId('aprobar-verdes');
    expect(boton).toBeDisabled();
    await userEvent.click(within(filas[0]!).getByRole('checkbox', { name: /Ana Verde/ }));
    expect(boton).toHaveTextContent('Aprobar 1 identidad en verde');
    await userEvent.click(boton);
    await waitFor(() =>
      expect(llamadas.filter((l) => l.metodo === 'PATCH').map((l) => [l.url, l.cuerpo])).toEqual([
        ['/datos/admin/kyc/a', { estado: 'aprobado', motivo: '' }],
      ]),
    );
    expect(await screen.findByText('Aprobaste 1 identidad.')).toBeInTheDocument();
  });

  it('«Más cerca de activarse» pide ese orden al servidor y se recuerda', async () => {
    const llamadas = bandeja();
    render(<SuperKyc base={BASE} idioma="es" id={null} />);
    await screen.findAllByTestId('kyc-fila');
    await userEvent.selectOptions(screen.getByTestId('orden-bandeja'), 'cerca');
    await waitFor(() =>
      expect(
        llamadas.some(
          (l) => l.url.startsWith('/datos/admin/kyc?') && l.url.includes('orden=cerca'),
        ),
      ).toBe(true),
    );
  });
});

describe('C-VERIFICACIONES-SIN-ENVIAR · la pestaña', () => {
  const sinEnviar = (x: Record<string, unknown> = {}) =>
    fila({
      estado: 'sin_enviar',
      enviado: '',
      miniatura: null,
      comprobaciones: [],
      cara: null,
      creado: haceHoras(30),
      correoConfirmado: false,
      fotosSubidas: 0,
      ...x,
    });

  it('la pestaña «Sin enviar» sale con su contador y pide su estado; con 100 dice «99+»', async () => {
    const llamadas = bandeja([fila()], { pendiente: 1, sin_enviar: 100 });
    render(<SuperKyc base={BASE} idioma="es" id={null} />);
    const pestana = await screen.findByRole('tab', { name: 'Sin enviar (99+)' });
    await userEvent.click(pestana);
    await waitFor(() =>
      expect(llamadas.some((l) => l.url.includes('estado=sin_enviar'))).toBe(true),
    );
  });

  it('la fila dice hace cuánto se registró y qué le falta, y lleva a su ficha', async () => {
    servidor((url) => {
      if (url.startsWith('/datos/admin/kyc?'))
        return {
          solicitudes: [
            sinEnviar(),
            sinEnviar({
              id: 'otra-cuenta',
              nombre: 'Persona Dos',
              creado: haceHoras(2),
              correoConfirmado: true,
              fotosSubidas: 2,
            }),
          ],
          siguiente: null,
          totales: { sin_enviar: 2 },
        };
      if (url.includes('/preferencias/'))
        return { valor: { estado: 'sin_enviar' }, guardada: true };
      return {};
    });
    render(<SuperKyc base={BASE} idioma="es" id={null} />);
    const filas = await screen.findAllByTestId('kyc-fila');
    expect(filas).toHaveLength(2);
    const una = within(filas[0]!);
    expect(una.getByTestId('kyc-registro')).toHaveTextContent('Se registró hace 1 día');
    expect(una.getByText('No ha enviado sus fotos')).toBeInTheDocument();
    expect(una.getByText('Correo sin confirmar')).toBeInTheDocument();
    expect(una.getByRole('link', { name: 'Persona Uno' })).toHaveAttribute(
      'href',
      `${BASE}/drivers/${ID}`,
    );
    expect(una.getByRole('link', { name: 'Ficha completa' })).toHaveAttribute(
      'href',
      `${BASE}/drivers/${ID}`,
    );
    // No hay fotos que revisar: no ofrece «Revisar».
    expect(una.queryByRole('link', { name: 'Revisar' })).toBeNull();
    const dos = within(filas[1]!);
    expect(dos.getByTestId('kyc-registro')).toHaveTextContent('Se registró hace 2 h');
    expect(dos.getByText('Subió 2 fotos y no las ha enviado')).toBeInTheDocument();
    expect(dos.queryByText('Correo sin confirmar')).toBeNull();
  });

  it('C-LLEGA-SOLO-A-REVISION y C-MINIATURA-SIEMPRE: dice qué le falta, la cara subida se ve y sin foto salen las iniciales', async () => {
    servidor((url) => {
      if (url.startsWith('/datos/admin/kyc?'))
        return {
          solicitudes: [
            sinEnviar({ miniatura: 'selfie', falta: ['consentimiento'] }),
            sinEnviar({
              id: 'otra-cuenta',
              nombre: 'María José Pérez',
              miniatura: null,
              falta: ['doc_frente', 'cara'],
            }),
          ],
          siguiente: null,
          totales: { sin_enviar: 2 },
        };
      if (url.includes('/preferencias/'))
        return { valor: { estado: 'sin_enviar' }, guardada: true };
      return {};
    });
    render(<SuperKyc base={BASE} idioma="es" id={null} />);
    const filas = await screen.findAllByTestId('kyc-fila');
    const una = within(filas[0]!);
    expect(una.getByText('Falta aceptar el consentimiento')).toBeInTheDocument();
    expect(filas[0]!.querySelector('img')).toHaveAttribute(
      'src',
      `/datos/admin/kyc/${ID}/foto/selfie`,
    );
    const dos = within(filas[1]!);
    expect(dos.getByText('Falta el documento por delante')).toBeInTheDocument();
    expect(dos.getByText('Falta la foto de la cara')).toBeInTheDocument();
    expect(dos.getByTestId('kyc-iniciales')).toHaveTextContent('MP');
  });

  it('en inglés', async () => {
    bandeja([fila()], { pendiente: 1, sin_enviar: 3 });
    render(<SuperKyc base={BASE} idioma="en" id={null} />);
    expect(await screen.findByRole('tab', { name: 'Not submitted (3)' })).toBeInTheDocument();
  });
});

describe('C-VERIFICACIONES-BANDEJA · Configuración de verificaciones', () => {
  it('tiene su propia dirección, que no se confunde con la ficha de una persona', () => {
    const admin = { id: 'a1', nombre: 'Equipo', correo: 'e@ejemplo.com', rol: 'admin' } as never;
    const e = seccionAdmin('/verifications/settings', BASE, admin, 'es');
    expect(isValidElement(e)).toBe(true);
    expect((e as ReactElement).type).toBe(ConfiguracionVerificaciones);
  });

  it('las reglas, el reparto y el gasto de la comprobación están aquí, con su vuelta', async () => {
    servidor((url) => {
      if (url.includes('interruptores-repartidor'))
        return { edadPorEstado: true, papelesVehiculo: false };
      if (url.includes('despacho-catalogo'))
        return { zonas: [{ id: 'US-ZZ-NORTE', nombre: 'Ciudad Norte', activo: true }] };
      if (url.includes('verificacion-ia/tablero'))
        return {
          acierto: [],
          hoy: { microdolares: 120000, llamadas: 3, fallos: 0, topeMicrodolares: 5000000 },
        };
      return {};
    });
    render(<ConfiguracionVerificaciones base={BASE} idioma="es" />);
    expect(await screen.findByText('Reglas para repartidores')).toBeInTheDocument();
    expect(await screen.findByText('Reparto de Comida por habilitaciones')).toBeInTheDocument();
    expect(await screen.findByTestId('tablero-ia')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Verificaciones' })).toHaveAttribute(
      'href',
      `${BASE}/verifications`,
    );
  });
});

describe('C-VERIFICACIONES-BANDEJA · la ficha de una persona', () => {
  const detalle = (estado = 'pendiente') => ({
    persona: {
      nombre: 'Persona Uno',
      correo: 'persona.uno@ejemplo.com',
      telefono: '',
      fecha_nacimiento: '1990-01-01',
      rol: 'repartidor',
      idioma: 'es',
      restaurante: null,
      direccion: null,
      es_prueba: 0,
      codigo: 'US-ZZN-000012',
      zona_id: 'US-ZZ-NORTE',
      zona: 'Ciudad Norte',
    },
    kyc: {
      estado,
      docTipo: 'identificacion',
      tiene: { doc_frente: true, doc_reverso: true, selfie: true, local: false },
      localDistanciaM: null,
      lejos: false,
      enviado: haceHoras(2),
    },
    comprobaciones: [
      { pieza: 'doc_frente', tono: 'hecho', motivo: 'cuadra' },
      { pieza: 'doc_reverso', tono: 'pendiente', motivo: 'ilegible' },
    ],
    lecturas: [
      { paso: 'doc_frente', lectura: { nombre: 'OTRA PERSONA', numero: 'X-0000', pais: 'US' } },
    ],
    declarado: null,
  });

  function ficha() {
    return servidor((url, init) => {
      if (init?.method === 'PATCH') return { ok: true };
      if (url === `/datos/admin/kyc/${ID}`) return detalle();
      // C-VERIFICACION-UNICA: la barra de activación que va en la misma ficha.
      if (url.endsWith('/activacion'))
        return {
          pasos: [],
          listo: false,
          recibiendo: false,
          servicios: [],
          siguiente: null,
          hechos: 0,
          total: 0,
        };
      return {};
    });
  }

  it('fotos grandes lado a lado, cada una con su comprobación, y se abren en grande', async () => {
    ficha();
    render(<SuperKyc base={BASE} idioma="es" id={ID} />);
    const fotos = await screen.findByTestId('kyc-fotos');
    expect(
      within(fotos)
        .getAllByRole('img')
        .map((i) => i.getAttribute('alt')),
    ).toEqual(['Documento (frente)', 'Documento (reverso)', 'Cara']);
    expect(screen.getByTestId('ficha-comprobacion-doc_reverso')).toHaveTextContent(
      'no se lee bien',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ver Cara en grande' }));
    expect(screen.getByTestId('foto-grande')).toBeInTheDocument();
  });

  it('la tabla marca en ámbar lo que no coincide entre lo leído y lo escrito', async () => {
    ficha();
    render(<SuperKyc base={BASE} idioma="es" id={ID} />);
    const tabla = await screen.findByTestId('kyc-comparar');
    const nombre = within(tabla).getByRole('row', { name: /Nombre/ });
    expect(nombre).toHaveAttribute('data-estado', 'no_coincide');
    expect(nombre).toHaveClass('kyc-no-coincide');
    expect(within(nombre).getByText('OTRA PERSONA')).toBeInTheDocument();
    expect(within(tabla).getByRole('row', { name: /País del documento/ })).toHaveAttribute(
      'data-estado',
      'coincide',
    );
  });

  it('rechazar exige motivo: sin motivo no sale nada; con un motivo frecuente sí', async () => {
    const llamadas = ficha();
    render(<SuperKyc base={BASE} idioma="es" id={ID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar con este motivo' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Escribe o elige el motivo/);
    expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false);
    await userEvent.click(
      screen.getByRole('button', { name: 'El documento está vencido. Envía uno vigente.' }),
    );
    expect(screen.getByRole('textbox', { name: /Motivo del rechazo/ })).toHaveValue(
      'El documento está vencido. Envía uno vigente.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar con este motivo' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'PATCH')?.cuerpo).toEqual({
        estado: 'rechazado',
        motivo: 'El documento está vencido. Envía uno vigente.',
      }),
    );
  });

  it('un solo botón principal: Aprobar; aprobar no manda motivo', async () => {
    const llamadas = ficha();
    render(<SuperKyc base={BASE} idioma="es" id={ID} />);
    const decision = await screen.findByTestId('kyc-decision');
    const principales = within(decision)
      .getAllByRole('button')
      .filter((b) => b.className.split(/\s+/).join(' ') === 'boton');
    expect(principales.map((b) => b.textContent)).toEqual(['Aprobar']);
    await userEvent.click(within(decision).getByRole('button', { name: 'Aprobar' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'PATCH')?.cuerpo).toEqual({
        estado: 'aprobado',
        motivo: '',
      }),
    );
  });

  it('el motivo a medio escribir no se pierde al volver', async () => {
    ficha();
    const { unmount } = render(<SuperKyc base={BASE} idioma="es" id={ID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    await userEvent.type(screen.getByRole('textbox', { name: /Motivo del rechazo/ }), 'Falta algo');
    await new Promise((r) => setTimeout(r, 700));
    unmount();
    render(<SuperKyc base={BASE} idioma="es" id={ID} />);
    expect(await screen.findByRole('textbox', { name: /Motivo del rechazo/ })).toHaveValue(
      'Falta algo',
    );
  });
});

describe('C-VERIFICACIONES-BANDEJA · lo leído frente a lo escrito (puro)', () => {
  it('el nombre coincide sin acentos, mayúsculas ni orden', () => {
    expect(nombresCoinciden('PEREZ, JOSE', 'José Pérez')).toBe(true);
    expect(nombresCoinciden('JOSE PEREZ GOMEZ', 'José Pérez')).toBe(true);
    expect(nombresCoinciden('ANA RUIZ', 'José Pérez')).toBe(false);
    expect(nombresCoinciden('', 'José')).toBe(false);
  });

  it('marca lo que no coincide, lo vencido y lo que no tiene con qué compararse', () => {
    const filas = compararDatos({
      lecturas: [
        { paso: 'doc_frente', lectura: { nombre: 'JOSE PEREZ', vence: '2020-01-01', pais: 've' } },
        { paso: 'licencia_frente', lectura: { numero: 'L-111', vence: '2031-05-05' } },
      ],
      nombre: 'José Pérez',
      pais: 'US',
      declarado: { licenciaNumero: 'l111', licenciaVence: '2030-01-01' },
      hoy: '2026-11-22',
    });
    const estado = new Map(filas.map((f) => [f.clave, f.estado]));
    expect(estado.get('nombre')).toBe('coincide');
    expect(estado.get('venceDocumento')).toBe('vencido');
    expect(estado.get('paisDocumento')).toBe('no_coincide');
    expect(estado.get('licenciaNumero')).toBe('coincide');
    expect(estado.get('licenciaVence')).toBe('no_coincide');
    expect(estado.has('seguroPoliza')).toBe(false);
  });
});
