import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperLineas } from './SuperLineas';

// C-LIDER-INVITADO en el panel: si el líder no tiene cuenta, se ofrece invitarlo sin perder lo escrito.
describe('C-LIDER-INVITADO en el panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('al crear una línea con un líder sin cuenta ofrece «Invitar al líder» y manda la invitación', async () => {
    const creadas: Record<string, unknown>[] = [];
    let invitados: { id: string; nombre: string; tipo: string; lider: string }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const ruta = String(url);
      const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status });
      if (init?.method === 'POST' && ruta.endsWith('/datos/admin/lineas')) {
        const cuerpo = JSON.parse(String(init.body)) as Record<string, unknown>;
        creadas.push(cuerpo);
        if (!cuerpo.invitar)
          return json(
            { error: 'Nadie en Divoox Driver tiene ese correo o celular.', campo: 'lider' },
            404,
          );
        invitados = [
          { id: 'i1', nombre: 'Línea Ejemplo', tipo: 'mototaxi', lider: '+10000000000' },
        ];
        return json(
          { linea: null, invitacion: { id: 'i1', enlace: 'https://ejemplo.com/driver' } },
          201,
        );
      }
      if (ruta.includes('/lineas-invitaciones'))
        return json({ invitaciones: invitados, enlace: 'https://ejemplo.com/driver' });
      if (ruta.includes('/lineas-solicitudes')) return json({ solicitudes: [] });
      return json({ lineas: [], zonas: [{ id: 'Z1', nombre: 'Ciudad Ejemplo' }], sinLinea: [] });
    });
    render(<SuperLineas idioma="es" />);
    const caja = await screen.findByTestId('lineas-crear');
    const campos = caja.querySelectorAll('input');
    await userEvent.type(campos[0]!, 'Línea Ejemplo');
    await userEvent.type(campos[1]!, '+10000000000');
    await userEvent.click(screen.getByRole('button', { name: 'Crear la línea' }));
    const aviso = await screen.findByTestId('lineas-invitar-lider');
    expect(aviso.textContent).toMatch(/todavía no tiene cuenta/);
    // Lo escrito sigue en pantalla mientras se decide.
    expect((campos[0] as HTMLInputElement).value).toBe('Línea Ejemplo');
    await userEvent.click(screen.getByRole('button', { name: 'Invitar al líder' }));
    await waitFor(() => expect(creadas.at(-1)?.invitar).toBe(true));
    expect(creadas.at(-1)?.nombre).toBe('Línea Ejemplo');
    expect((await screen.findByTestId('lineas-enlace-lider')).textContent).toBe(
      'https://ejemplo.com/driver',
    );
    expect(screen.getByTestId('lineas-invitados').textContent).toContain('Línea Ejemplo');
  });
});
