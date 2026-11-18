import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CambiarCiudadConductor } from './CambiarCiudadConductor';

/**
 * C-CAMBIAR-CIUDAD-ADMIN (piloto, 18 nov 2026): la ficha del repartidor no tenía «Cambiar ciudad»
 * (los tres puntos solo traían «Borrar la cuenta») y un conductor del piloto quedó en Miami.
 */
const CIUDADES = {
  ciudades: [
    { id: 'US-FL-MIAMI', nombre: 'Miami', pais: 'US', activa: true },
    { id: 'VE-MER-ELVIGIA', nombre: 'El Vigía', pais: 'VE', activa: true },
    { id: 'VE-ZUL-VIEJA', nombre: 'Cerrada', pais: 'VE', activa: false },
  ],
};

describe('cambiar la ciudad de un repartidor desde su ficha', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('solo ciudades activas, motivo obligatorio, y el cambio de país se confirma aparte', async () => {
    const llamadas: { metodo: string; cuerpo: unknown }[] = [];
    let intento = 0;
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (url.includes('/admin/ciudades')) return new Response(JSON.stringify(CIUDADES));
      llamadas.push({ metodo: init?.method ?? 'GET', cuerpo: JSON.parse(String(init?.body)) });
      intento++;
      return intento === 1
        ? new Response(
            JSON.stringify({
              error: 'Es un cambio de país (de US a VE): confírmalo para seguir.',
              campo: 'cambioPais',
            }),
            { status: 409 },
          )
        : new Response(JSON.stringify({ zonaId: 'VE-MER-ELVIGIA', codigo: 'VE-ELV-000001' }));
    });
    const confirmar = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmar);
    const alCambiar = vi.fn();
    render(
      <CambiarCiudadConductor
        id="c1"
        zonaActual="Miami"
        idioma="es"
        alCerrar={() => undefined}
        alCambiar={alCambiar}
      />,
    );
    const lista = await screen.findByLabelText('Ciudad nueva');
    await waitFor(() => expect(screen.getByRole('option', { name: /El Vigía/ })).toBeTruthy());
    // Su ciudad de hoy y las cerradas no se ofrecen.
    expect(screen.queryByRole('option', { name: /Miami/ })).toBeNull();
    expect(screen.queryByRole('option', { name: /Cerrada/ })).toBeNull();
    await userEvent.selectOptions(lista, 'VE-MER-ELVIGIA');
    // Sin motivo no se manda nada.
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar ciudad' }));
    expect(llamadas).toHaveLength(0);
    await userEvent.type(screen.getByLabelText(/Motivo/), 'Vive en El Vigía, autorizado');
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar ciudad' }));
    await waitFor(() =>
      expect(alCambiar).toHaveBeenCalledWith('Listo. Su código nuevo es VE-ELV-000001.'),
    );
    expect(confirmar).toHaveBeenCalledTimes(2);
    expect(llamadas.map((l) => l.cuerpo)).toEqual([
      { zonaId: 'VE-MER-ELVIGIA', motivo: 'Vive en El Vigía, autorizado' },
      { zonaId: 'VE-MER-ELVIGIA', motivo: 'Vive en El Vigía, autorizado', cambioPais: true },
    ]);
  });

  it('está en los tres puntos de la ficha del repartidor (no en la del cliente)', () => {
    const s = readFileSync(join(import.meta.dirname, 'SuperFichas.tsx'), 'utf8');
    expect(s).toMatch(/texto: t\.cambiarCiudad, alTocar: \(\) => setCambiandoCiudad\(true\)/);
    expect(s).toMatch(/<BotonSuspender\s+id=\{r\.id\}[\s\S]{0,160}ciudad=\{r\.ciudad\}/);
    expect(s).toMatch(/<BotonSuspender id=\{c\.id\}/);
  });
});
