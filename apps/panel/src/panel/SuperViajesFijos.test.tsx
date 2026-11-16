import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SesionArmazon } from './armazon/Armazon';
import { SuperViajesFijos } from './SuperViajesFijos';

/** C-VIAJES-FIJOS (16 nov 2026): la pestaña «Viajes fijos» del monitoreo de viajes. */
type Llamada = { metodo: string; url: string; cuerpo?: unknown };

const RUTINA = {
  id: 'r1',
  nombre: 'Escuela',
  servicio: 'moto',
  categoria: 'estandar',
  origen: { direccion: 'Avenida Bolívar, El Vigía', lat: 8.6, lng: -71.6 },
  destino: { direccion: 'Calle 5, El Vigía', lat: 8.61, lng: -71.61 },
  dias: [1, 2, 3, 4, 5],
  horaIda: '07:00',
  horaVuelta: '12:30',
  metodoPago: 'efectivo',
  zonaHoraria: 'America/Caracas',
  estado: 'activa',
  pausadaHasta: null,
  conductor: { id: 'c1', nombre: 'José' },
  menor: { nombre: 'Ana', pin: null },
  paquete: null,
  proximas: [],
  salidas: [
    {
      fecha: '2026-11-17',
      sentido: 'ida',
      hora: '2026-11-17T11:00:00.000Z',
      estado: 'saltada',
      conductorNoPuede: false,
      reserva: null,
      viaje: null,
    },
  ],
  cliente: 'Laura',
  clienteId: 'u1',
  ciudad: 'El Vigía',
  creadoEn: '2026-11-16 10:00:00',
};

function servidor(guardado: Record<string, string> | null = null) {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    const u = String(url);
    llamadas.push({
      metodo,
      url: u,
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (u.includes('/admin/preferencias/'))
      return new Response(
        JSON.stringify(
          metodo === 'GET' ? { valor: guardado ?? {}, guardada: Boolean(guardado) } : { ok: true },
        ),
      );
    if (u.includes('/datos/admin/ciudades'))
      return new Response(
        JSON.stringify({
          ciudades: [{ id: 'VE-MER-ELVIGIA', nombre: 'El Vigía', repartidores: 3, clientes: 9 }],
        }),
      );
    if (u.includes('/datos/admin/viajes-fijos'))
      return new Response(
        JSON.stringify({
          resumen: {
            parejasConfianza: 7,
            conductoresConfianza: 4,
            salidas7d: { creada: 20, saltada: 3, fallida: 1 },
            noPuede7d: 2,
          },
          rutinas: [RUTINA],
        }),
      );
    return new Response(JSON.stringify({}));
  });
  return llamadas;
}

const SESION = {
  usuario: { id: 'emp-1', nombre: 'Equipo', correo: 'e@ejemplo.com', rol: 'admin' },
  idioma: 'es',
  cambiar: () => {},
  salir: () => {},
} as never;

const pintar = () =>
  render(
    <SesionArmazon.Provider value={SESION}>
      <SuperViajesFijos base="/panel/super" idioma="es" />
    </SesionArmazon.Provider>,
  );

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Viajes fijos en el monitoreo', () => {
  it('muestra el resumen en tarjetas y la tabla con lo que importa', async () => {
    servidor();
    pintar();
    const resumen = await screen.findByRole('list', { name: 'Resumen de viajes fijos' });
    expect(within(resumen).getByText('7')).toBeInTheDocument();
    expect(within(resumen).getByText('20')).toBeInTheDocument();
    const tabla = await screen.findByRole('table');
    const fila = within(tabla).getByText('Laura').closest('tr') as HTMLElement;
    expect(within(fila).getByText('El Vigía')).toBeInTheDocument();
    expect(within(fila).getByText('Moto')).toBeInTheDocument();
    expect(within(fila).getByText(/De lunes a viernes/)).toBeInTheDocument();
    expect(within(fila).getByText('José')).toBeInTheDocument();
    expect(within(fila).getByText('Sí')).toBeInTheDocument();
    expect(within(fila).getByText('Activo')).toBeInTheDocument();
    expect(within(fila).getByText(/Saltada/)).toBeInTheDocument();
    // Nunca el PIN del menor.
    expect(document.body.textContent).not.toMatch(/\b\d{4}\b.*PIN/);
  });

  it('filtra por ciudad, estado y solo menores, y guarda los filtros', async () => {
    const llamadas = servidor();
    pintar();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('tab', { name: 'En pausa' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Solo con menores' }));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Ciudad' }),
      'VE-MER-ELVIGIA',
    );
    await waitFor(() =>
      expect(
        llamadas.some(
          (l) =>
            l.url.includes('/datos/admin/viajes-fijos?') &&
            l.url.includes('estado=pausada') &&
            l.url.includes('menores=1') &&
            l.url.includes('zona=VE-MER-ELVIGIA'),
        ),
      ).toBe(true),
    );
    await waitFor(
      () =>
        expect(
          llamadas.some(
            (l) => l.metodo === 'PUT' && l.url.includes('/admin/preferencias/viajes-fijos'),
          ),
        ).toBe(true),
      { timeout: 4000 },
    );
  });

  it('abre con los filtros que dejó la vez pasada', async () => {
    const llamadas = servidor({ estado: 'activa', menores: '1' });
    pintar();
    await waitFor(() =>
      expect(
        llamadas.some(
          (l) =>
            l.url.includes('/datos/admin/viajes-fijos?') &&
            l.url.includes('estado=activa') &&
            l.url.includes('menores=1'),
        ),
      ).toBe(true),
    );
  });
});
