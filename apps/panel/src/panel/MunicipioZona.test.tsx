import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SesionArmazon } from './armazon/Armazon';
import { AdminZonas } from './AdminZonas';

/**
 * C-ZONA-MUNICIPIO (24 nov 2026): en Zonas del superadmin se elige y se guarda el municipio al crear
 * o editar, con la lista sugerida del país (El Vigía y Tucaní en Mérida), se ve en la lista y se filtra.
 */
type Llamada = { metodo: string; url: string; cuerpo?: Record<string, unknown> };
const ZONAS = [
  {
    id: 'VE-MER-ELVIGIA',
    nombre: 'El Vigía',
    pais: 'VE',
    lat: 8.6,
    lng: -71.6,
    radioKm: 10,
    activa: true,
    restaurantes: 0,
    repartidores: 0,
    enEspera: 0,
    fotoPuertaObligatoria: false,
    municipio: {
      pcode: 'VE1401',
      nombre: 'Alberto Adriani',
      entidad: { pcode: 'VE14', nombre: 'Mérida' },
    },
    municipioNombre: 'Alberto Adriani',
    municipioClave: 'alberto-adriani',
  },
  {
    id: 'US-MI-NOVI',
    nombre: 'Ciudad de ejemplo',
    pais: 'US',
    lat: 42.48,
    lng: -83.47,
    radioKm: 20,
    activa: false,
    restaurantes: 0,
    repartidores: 0,
    enEspera: 0,
    fotoPuertaObligatoria: false,
    municipio: null,
    municipioNombre: 'Oakland County',
    municipioClave: 'oakland-county',
  },
];

function servidor() {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    llamadas.push({
      metodo,
      url: String(url),
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const u = String(url);
    if (u.includes('/admin/preferencias/'))
      return new Response(JSON.stringify({ valor: {}, guardada: false }));
    if (u.endsWith('/datos/admin/zonas') && metodo === 'GET')
      return new Response(JSON.stringify({ zonas: ZONAS }));
    return new Response(JSON.stringify({ ok: true, ciudades: [], areas: [] }));
  });
  return llamadas;
}

const USUARIO = { id: 'emp-1', nombre: 'Soporte', correo: 'e@ejemplo.com', rol: 'admin' } as never;
const SESION = { usuario: USUARIO, idioma: 'es', cambiar: () => {}, salir: () => {} } as never;

function pintar() {
  return render(
    <SesionArmazon.Provider value={SESION}>
      <AdminZonas usuario={USUARIO} idioma="es" />
    </SesionArmazon.Provider>,
  );
}

describe('C-ZONA-MUNICIPIO · casilla de municipio en Zonas', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('cada zona muestra su municipio y el filtro deja solo las de ese municipio', async () => {
    servidor();
    pintar();
    expect(await screen.findByTestId('zona-municipio-VE-MER-ELVIGIA')).toHaveTextContent(
      'Municipio: Alberto Adriani, Mérida (VE1401)',
    );
    expect(screen.getByTestId('zona-municipio-US-MI-NOVI')).toHaveTextContent('Oakland County');
    await userEvent.selectOptions(screen.getByTestId('filtro-municipio'), 'oakland-county');
    await waitFor(() => expect(screen.queryByTestId('zona-municipio-VE-MER-ELVIGIA')).toBeNull());
    expect(screen.getByTestId('zona-municipio-US-MI-NOVI')).toBeInTheDocument();
  });

  it('la zona nueva sugiere El Vigía y Tucaní en Venezuela y manda el municipio al guardar', async () => {
    const llamadas = servidor();
    pintar();
    await screen.findByTestId('zona-municipio-VE-MER-ELVIGIA');
    const form = screen.getByRole('heading', { name: 'Nueva zona' }).closest('form') as HTMLElement;
    const [codigo] = within(form).getAllByRole('textbox');
    await userEvent.type(codigo as HTMLElement, 'VE-MER-TUCANI');
    await waitFor(() => {
      const opciones = [...document.querySelectorAll('#municipios-nueva option')].map(
        (o) => (o as HTMLOptionElement).value,
      );
      expect(opciones).toContain('Alberto Adriani (El Vigía), Mérida');
      expect(opciones).toContain('Caracciolo Parra Olmedo (Tucaní), Mérida');
    });
    await userEvent.type(screen.getByTestId('municipio-nueva'), 'Tucaní');
    await userEvent.click(within(form).getByRole('button', { name: 'Guardar zona' }));
    await waitFor(() => {
      const put = llamadas.find((l) => l.metodo === 'PUT' && l.url.endsWith('/datos/admin/zonas'));
      expect(put?.cuerpo?.municipio).toBe('Tucaní');
    });
  });

  it('una zona que ya existe cambia su municipio (escrito a mano vale)', async () => {
    const llamadas = servidor();
    pintar();
    const caja = await screen.findByTestId('municipio-zona-US-MI-NOVI');
    const campo = within(caja).getByTestId('municipio-US-MI-NOVI');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Wayne County');
    await userEvent.click(within(caja).getByRole('button', { name: 'Guardar municipio' }));
    await waitFor(() => {
      const p = llamadas.find(
        (l) => l.metodo === 'PATCH' && l.url.endsWith('/datos/admin/zonas/US-MI-NOVI'),
      );
      expect(p?.cuerpo).toEqual({ municipio: 'Wayne County' });
    });
  });
});
