import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InvitacionLider } from './InvitacionLider';

// C-INVITAR-LIDER-UN-PASO: la página del enlace personal dice la línea, la ciudad y el correo, y
// «Crear mi cuenta» abre Driver con la invitación.
describe('InvitacionLider', () => {
  afterEach(() => vi.unstubAllGlobals());
  const TOKEN = 'EJEMPLO01EJEMPLO01EJEMPLO01EJEMP';

  it('muestra la línea, la ciudad y el correo; «Crear mi cuenta» lleva su invitación', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            invitacion: {
              linea: 'Línea Ejemplo',
              ciudad: 'Ciudad de ejemplo',
              correo: 'lider@ejemplo.com',
            },
          }),
          { status: 200 },
        ),
    );
    render(<InvitacionLider idioma="es" token={TOKEN} />);
    expect(
      await screen.findByText(/líder de la línea «Línea Ejemplo» en Ciudad de ejemplo/),
    ).toBeTruthy();
    expect(screen.getByTestId('invitacion-lider-correo').textContent).toBe('lider@ejemplo.com');
    expect(screen.getByTestId('invitacion-lider-crear').getAttribute('href')).toBe(
      `/driver/?invitacion=${TOKEN}`,
    );
  });

  it('un enlace usado o anulado lo dice claro', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }));
    render(<InvitacionLider idioma="en" token={TOKEN} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
