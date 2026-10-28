import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CampoDireccion } from './CampoDireccion';

/** C-DIRECCION-SUGERENCIAS en la web: escribir, ver direcciones reales, elegir y tener el punto. */
function Prueba({ alElegir }: { alElegir: (d: unknown) => void }) {
  const [v, setV] = useState('');
  return (
    <CampoDireccion
      valor={v}
      cambiar={setV}
      alElegir={alElegir}
      placeholder="Ingresa tu dirección o código postal"
    />
  );
}

describe('CampoDireccion', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sugiere direcciones mientras se escribe y al elegir da el punto exacto', async () => {
    const rutas: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      rutas.push(url);
      if (url.includes('/lugares/sugerencias'))
        return new Response(
          JSON.stringify({ sugerencias: [{ id: 'ChIJ1', texto: '30080 Montmorency Dr, Miami' }] }),
        );
      return new Response(
        JSON.stringify({
          punto: { lat: 25.7, lng: -80.2 },
          direccion: '30080 Montmorency Dr, Miami, FL',
        }),
      );
    });
    const alElegir = vi.fn();
    render(<Prueba alElegir={alElegir} />);
    const campo = screen.getByRole('combobox');
    await userEvent.type(campo, '30080 Montmor');
    const opcion = await screen.findByRole('option', { name: '30080 Montmorency Dr, Miami' });
    await userEvent.click(opcion);
    await waitFor(() =>
      expect(alElegir).toHaveBeenCalledWith({
        punto: { lat: 25.7, lng: -80.2 },
        direccion: '30080 Montmorency Dr, Miami, FL',
      }),
    );
    expect(campo).toHaveValue('30080 Montmorency Dr, Miami, FL');
    expect(rutas.some((r) => r.includes('q=30080+Montmor'))).toBe(true);
  });
});
