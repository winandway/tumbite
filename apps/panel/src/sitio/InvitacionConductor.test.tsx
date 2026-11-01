import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InvitacionConductor } from './InvitacionConductor';

// C-FLEX-INVITAR-CONDUCTOR: la página del enlace dice quién invita y cómo entrar a Divoox Driver.
describe('página de la invitación del conductor', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('muestra la empresa, los pasos y las tiendas', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ empresa: 'Paquetes Sur', nombre: 'Rita', vigente: true })),
    );
    render(<InvitacionConductor token={'a'.repeat(43)} idioma="es" />);
    expect(
      await screen.findByRole('heading', {
        name: 'Paquetes Sur te invitó a repartir con Divoox Driver',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/MISMO celular o correo/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Descargar en Google Play' })).toHaveAttribute(
      'href',
      expect.stringContaining('com.windoce.tumbite.driver'),
    );
  });
  it('vencida, lo dice', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ empresa: 'Paquetes Sur', nombre: 'Rita', vigente: false })),
    );
    render(<InvitacionConductor token={'a'.repeat(43)} idioma="es" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('ya no está vigente');
  });
});
