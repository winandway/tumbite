import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SesionArmazon } from './armazon/Armazon';
import { SuperViajes } from './SuperViajes';

/**
 * C-PANICO-ZONA-A-LA-VISTA (25 nov 2026) — todos los países. Viajes · Emergencias muestra, por su
 * nombre, las zonas activas sin responsable de pánico con teléfono: su pánico cae al equipo central.
 */
function servidor(zonas: { id: string; nombre: string }[]) {
  vi.stubGlobal('fetch', async (url: string) => {
    const u = String(url);
    if (u.includes('/datos/admin/panico/sin-atender'))
      return new Response(
        JSON.stringify({ cantidad: 0, ultimo: null, zonasSinResponsable: zonas }),
      );
    if (u.includes('/datos/admin/viajes/ajustes'))
      return new Response(JSON.stringify({ ajustes: [] }));
    if (u.includes('/datos/admin/viajes'))
      return new Response(JSON.stringify({ emergencias: [], viajes: [], tarifas: [] }));
    return new Response(JSON.stringify({}));
  });
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
      <SuperViajes base="/panel/super" idioma="es" />
    </SesionArmazon.Provider>,
  );

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('zonas sin responsable de pánico a la vista', () => {
  it('muestra la tarjeta roja con el nombre de cada zona', async () => {
    servidor([
      { id: 'Z-1', nombre: 'Zona Norte' },
      { id: 'Z-2', nombre: 'Zona Sur' },
    ]);
    pintar();
    const tarjeta = await screen.findByTestId('zonas-sin-responsable-panico');
    expect(within(tarjeta).getByText('Zona Norte')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Zona Sur')).toBeInTheDocument();
    expect(tarjeta).toHaveTextContent('equipo central');
  });
  it('sin zonas pendientes, no hay tarjeta', async () => {
    servidor([]);
    pintar();
    await screen.findByText('No hay emergencias abiertas.');
    expect(screen.queryByTestId('zonas-sin-responsable-panico')).toBeNull();
  });
});
