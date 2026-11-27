import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MedicionesLugares } from './MedicionesLugares';

// El mapa de Google no corre en jsdom.
vi.mock('./FichaPiezas', () => ({ MapaFicha: () => <div data-testid="mapa" /> }));

const TAREAS = {
  tareas: [
    {
      id: 't1',
      titulo: 'Puntos de la vía',
      nota: '',
      estado: 'abierta',
      creadaEn: '2026-11-27 12:00:00',
      lugares: [
        { id: 'l1', nombre: 'KM 9', lat: 8.6, lng: -71.7 },
        { id: 'l2', nombre: 'Pedeca', lat: 8.63, lng: -71.66 },
      ],
      asignados: [{ id: 'c1', nombre: 'Carlos Conductor', correo: 'carlos@ejemplo.com' }],
      mediciones: [
        {
          id: 'm1',
          lugarId: 'l1',
          lugar: 'KM 9',
          conductor: 'Carlos Conductor',
          lat: 8.601,
          lng: -71.7,
          precisionM: 6,
          tomadaEn: '2026-11-27 13:00:00',
          antes: { lat: 8.6, lng: -71.7 },
          distanciaM: 140,
          conFoto: true,
          estado: 'pendiente',
          motivo: null,
        },
      ],
    },
  ],
};
const LUGARES = {
  lugares: [
    { id: 'l1', nombre: 'KM 9', otrosNombres: ['km9'], activo: true },
    { id: 'l2', nombre: 'Pedeca', otrosNombres: [], activo: true },
  ],
};

function servidor() {
  const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = String(url);
    llamadas.push({
      url: u,
      metodo: init?.method ?? 'GET',
      cuerpo: init?.body ? JSON.parse(String(init.body)) : null,
    });
    const datos = u.includes('/candidatos')
      ? {
          candidatos: [
            { id: 'c2', nombre: 'Soporte Divoox El Vigía', correo: 'soporte@ejemplo.com' },
          ],
        }
      : u.includes('/lugares-propios')
        ? LUGARES
        : u.includes('/datos/admin/mediciones?')
          ? TAREAS
          : { ok: true, tarea: { id: 't2' } };
    return new Response(JSON.stringify(datos), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  return llamadas;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

const ZONAS = [{ id: 'VE-MER-ELVIGIA', nombre: 'El Vigía' }];

describe('C-ESTOY-AQUI en el panel', () => {
  it('muestra la medición nueva con cuánto se movió y la aprueba solo al confirmar', async () => {
    const llamadas = servidor();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    render(<MedicionesLugares idioma="es" zonas={ZONAS} />);
    await userEvent.selectOptions(screen.getByTestId('medicion-ciudad'), 'VE-MER-ELVIGIA');
    const tarjeta = await screen.findByTestId('medicion-pendiente');
    expect(tarjeta.textContent).toContain('Medición nueva: KM 9, movido 140 m');
    expect(tarjeta.textContent).toContain('precisión 6 m');
    expect(within(tarjeta).getByText('Ver la foto del lugar')).toBeTruthy();
    // Sin confirmar, no se llama a aprobar.
    await userEvent.click(within(tarjeta).getByTestId('medicion-aprobar'));
    expect(llamadas.some((l) => l.url.endsWith('/aprobar'))).toBe(false);
    await userEvent.click(within(tarjeta).getByTestId('medicion-aprobar'));
    await waitFor(() =>
      expect(llamadas.some((l) => l.url.endsWith('/medicion/m1/aprobar'))).toBe(true),
    );
    expect(confirmar).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('medicion-tarea').textContent).toContain('1 de 2 lugares medidos');
  });

  it('crea una tarea con los lugares y los conductores elegidos', async () => {
    const llamadas = servidor();
    render(<MedicionesLugares idioma="es" zonas={ZONAS} />);
    await userEvent.selectOptions(screen.getByTestId('medicion-ciudad'), 'VE-MER-ELVIGIA');
    await screen.findByTestId('medicion-nueva');
    await userEvent.type(screen.getByTestId('medicion-titulo'), 'Medir Pedeca');
    await userEvent.click(within(screen.getByTestId('medicion-lugares')).getByText('Pedeca'));
    const conductores = screen.getAllByTestId('medicion-conductores').at(-1)!;
    await userEvent.click(await within(conductores).findByText('Agregar'));
    await userEvent.click(screen.getByTestId('medicion-crear'));
    await waitFor(() =>
      expect(
        llamadas.find((l) => l.metodo === 'POST' && l.url.endsWith('/datos/admin/mediciones'))
          ?.cuerpo,
      ).toEqual({
        zona: 'VE-MER-ELVIGIA',
        titulo: 'Medir Pedeca',
        nota: '',
        lugares: ['l2'],
        conductores: ['c2'],
      }),
    );
  });
});
