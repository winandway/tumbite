import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MapaCobertura } from './MapaCobertura';
import { olvidarCiudadesEnVivo } from './ciudadesEnVivo';

/**
 * C-MAPA-VERDAD (4 nov 2026, Gerencia y el auditor de tiendas): el mapa de la portada decía
 * «Miami · Live» porque la zona de Miami existe en el servidor, aunque en Miami no hay ni un
 * restaurante. Una ciudad solo dice «Live» cuando el interruptor público del superadmin la pone
 * activa; mientras tanto dice «Coming soon». Las zonas de fuera de Florida no se dibujan aquí.
 */
function servidor(ciudades: Record<string, string>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const cuerpo = url.includes('/datos/web/ciudades')
        ? { ciudades }
        : {
            zonas: [
              { id: 'US-FL-MIAMI', nombre: 'Miami', lat: 25.7617, lng: -80.1918, radioKm: 40 },
              { id: 'US-MI-NOVI', nombre: 'Novi (pruebas)', lat: 42.48, lng: -83.47, radioKm: 40 },
            ],
          };
      return Promise.resolve(new Response(JSON.stringify(cuerpo)));
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  olvidarCiudadesEnVivo();
});

describe('el mapa de cobertura dice la verdad', () => {
  it('Miami sin encender: «Coming soon», nunca «Live», y sin la zona de pruebas', async () => {
    servidor({});
    const { container } = render(<MapaCobertura idioma="en" />);
    await waitFor(() => expect(screen.getByText('Miami · Coming soon')).toBeTruthy());
    expect(container.textContent).not.toContain('Live');
    expect(container.textContent).not.toContain('Novi');
  });

  it('Miami encendida por el superadmin: «Live»', async () => {
    servidor({ miami: 'activo' });
    render(<MapaCobertura idioma="en" />);
    await waitFor(() => expect(screen.getByText('Miami · Live')).toBeTruthy());
  });
});
