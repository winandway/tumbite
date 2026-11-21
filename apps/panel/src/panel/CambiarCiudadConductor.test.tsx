import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CambiarCiudadConductor } from './CambiarCiudadConductor';

/**
 * C-CAMBIAR-CIUDAD-ADMIN (piloto, 18 nov 2026): la ficha del repartidor no tenía «Cambiar ciudad»
 * (los tres puntos solo traían «Borrar la cuenta») y un conductor del piloto quedó en Miami.
 * Revisor: la lista sale del servidor, la confirmación va en el mismo formulario (sin ventanas del
 * navegador) y el cambio de país se decide por los datos, no leyendo el texto de un error.
 */
const DESTINOS = {
  actual: { zonaId: 'US-FL-MIAMI', pais: 'US' },
  ciudades: [
    { id: 'US-MI-NOVI', nombre: 'Novi', pais: 'US' },
    { id: 'VE-MER-ELVIGIA', nombre: 'El Vigía', pais: 'VE' },
  ],
};

function servidor() {
  const puts: unknown[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url.includes('/ciudades-destino')) return new Response(JSON.stringify(DESTINOS));
    puts.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ zonaId: 'VE-MER-ELVIGIA', codigo: 'VE-ELV-000001' }));
  });
  return puts;
}

describe('cambiar la ciudad de un repartidor desde su ficha', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('cambio de país: se revisa, se marca la casilla y se manda cambioPais; nunca window.confirm', async () => {
    const puts = servidor();
    const confirmar = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmar);
    const alCambiar = vi.fn();
    render(
      <CambiarCiudadConductor
        id="c1"
        idioma="es"
        alCerrar={() => undefined}
        alCambiar={alCambiar}
      />,
    );
    const lista = await screen.findByLabelText('Ciudad nueva');
    await waitFor(() => expect(screen.getByRole('option', { name: /El Vigía/ })).toBeTruthy());
    await userEvent.selectOptions(lista, 'VE-MER-ELVIGIA');
    // Sin motivo no avanza.
    await userEvent.click(screen.getByRole('button', { name: 'Revisar el cambio' }));
    expect(screen.queryByTestId('cambiar-ciudad-confirmar')).toBeNull();
    await userEvent.type(screen.getByLabelText(/Motivo/), 'Vive en El Vigía, autorizado');
    await userEvent.click(screen.getByRole('button', { name: 'Revisar el cambio' }));
    expect(screen.getByTestId('cambiar-ciudad-confirmar')).toHaveTextContent('de US a VE');
    const si = screen.getByRole('button', { name: 'Sí, cambiar la ciudad' });
    expect(si).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Confirmo el cambio de país'));
    await userEvent.click(si);
    await waitFor(() =>
      expect(alCambiar).toHaveBeenCalledWith('Listo. Su código nuevo es VE-ELV-000001.'),
    );
    expect(puts).toEqual([
      { zonaId: 'VE-MER-ELVIGIA', motivo: 'Vive en El Vigía, autorizado', cambioPais: true },
    ]);
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('mismo país: sin casilla ni cambioPais; «Volver» deja claro que no se cambió nada', async () => {
    const puts = servidor();
    render(
      <CambiarCiudadConductor id="c2" idioma="en" alCerrar={() => undefined} alCambiar={vi.fn()} />,
    );
    const lista = await screen.findByLabelText('New city');
    await waitFor(() => expect(screen.getByRole('option', { name: /Novi/ })).toBeTruthy());
    await userEvent.selectOptions(lista, 'US-MI-NOVI');
    await userEvent.type(screen.getByLabelText(/Reason/), 'Moved to Novi, approved');
    await userEvent.click(screen.getByRole('button', { name: 'Review the change' }));
    expect(screen.queryByLabelText('I confirm the country change')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('status')).toHaveTextContent('Nothing was changed.');
    expect(puts).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Review the change' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, change the city' }));
    await waitFor(() =>
      expect(puts).toEqual([{ zonaId: 'US-MI-NOVI', motivo: 'Moved to Novi, approved' }]),
    );
  });

  it('está en los tres puntos de la ficha del repartidor (no en la del cliente) y en la de Moto', () => {
    const s = readFileSync(join(import.meta.dirname, 'SuperFichas.tsx'), 'utf8');
    expect(s).toMatch(/texto: t\.cambiarCiudad, alTocar: \(\) => setCambiandoCiudad\(true\)/);
    expect(s).toMatch(/<BotonSuspender\s+id=\{r\.id\}[\s\S]{0,160}ciudad=\{r\.ciudad\}/);
    // La del cliente existe y no lleva ciudad (el cambio de ciudad es solo del repartidor).
    expect(s).toMatch(/<BotonSuspender\s+id=\{c\.id\}(?![^>]*ciudad=)/);
    const moto = readFileSync(join(import.meta.dirname, 'SuperMoto.tsx'), 'utf8');
    expect(moto).toMatch(/<CambiarCiudadConductor/);
    expect(moto).not.toMatch(/window\.confirm\(x\.message\)/);
  });
});
