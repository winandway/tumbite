import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PanelApp } from './PanelApp';

/**
 * C-PANEL-SIN-RECHAZO-SUELTO (16 nov 2026, todos los países): si la red falla al leer la ruta del
 * superadmin, el panel no deja un error sin atrapar (hacía caer la verificación del principal de
 * forma intermitente: «Unhandled Rejection … Sin conexión»).
 */
describe('C-PANEL-SIN-RECHAZO-SUELTO', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sin red en /datos/admin/ruta, el superadmin se dibuja igual y no queda ningún rechazo suelto', async () => {
    const sueltos: unknown[] = [];
    const anotar = (e: PromiseRejectionEvent) => sueltos.push(e.reason);
    const anotarNode = (r: unknown) => sueltos.push(r);
    window.addEventListener('unhandledrejection', anotar);
    process.on('unhandledRejection', anotarNode);
    vi.stubGlobal('fetch', async (url: string) => {
      const u = String(url);
      if (u.endsWith('/datos/cuentas/yo'))
        return new Response(
          JSON.stringify({
            usuario: {
              id: 'a1',
              nombre: 'Soporte',
              correo: 's@ejemplo.com',
              rol: 'admin',
              idioma: 'es',
            },
          }),
          { status: 200 },
        );
      if (u.includes('/datos/admin/ruta')) throw new TypeError('fetch failed');
      return new Response('{}', { status: 404 });
    });
    render(<PanelApp ruta="/panel/control-abc/moto" />);
    await screen.findByTestId('armazon');
    await new Promise((r) => setTimeout(r, 50));
    await waitFor(() => expect(sueltos).toEqual([]));
    window.removeEventListener('unhandledrejection', anotar);
    process.off('unhandledRejection', anotarNode);
  });
});
