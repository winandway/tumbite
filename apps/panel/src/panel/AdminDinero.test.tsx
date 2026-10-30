import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CONFIG_DINERO_INICIAL } from '@tumbite/compartido';
import { AdminDinero } from './AdminDinero';

describe('historial de dinero en el superadmin (C-HISTORIAL-DINERO)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('muestra quién cambió qué y cuándo', async () => {
    vi.stubGlobal(
      'fetch',
      async (url: string) =>
        new Response(
          JSON.stringify(
            String(url).includes('/historial')
              ? {
                  cambios: [
                    {
                      id: 1,
                      donde: 'US',
                      quien: 'Soporte Finanzas',
                      cuando: '2026-10-29 21:00:00',
                      campos: ['envioBase'],
                    },
                  ],
                }
              : { config: CONFIG_DINERO_INICIAL },
          ),
          { status: 200 },
        ),
    );
    render(
      <AdminDinero
        usuario={
          { id: 'a1', nombre: 'Soporte', correo: 'soporte@ejemplo.com', rol: 'admin' } as never
        }
        idioma="es"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Soporte Finanzas')).toBeInTheDocument();
      expect(screen.getByText('envioBase')).toBeInTheDocument();
      expect(screen.getByText('2026-10-29 21:00')).toBeInTheDocument();
    });
  });
});
