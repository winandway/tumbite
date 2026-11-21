import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperClientes } from './SuperFichas';

/**
 * C-CUENTA-PRUEBA en el panel (21 nov 2026): el filtro «Cuentas» va junto al de ciudad, arranca en
 * «Reales», se recuerda, y las cuentas de prueba llevan la etiqueta visible «Prueba».
 */
describe('C-CUENTA-PRUEBA en el panel', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState(null, '', '/panel/control-x/customers');
  });
  afterEach(() => vi.unstubAllGlobals());

  function servidor() {
    const pedidas: string[] = [];
    let guardado: Record<string, string> | null = null;
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const ruta = String(url);
      pedidas.push(ruta);
      const json = (d: unknown) => new Response(JSON.stringify(d), { status: 200 });
      // Las preferencias guardadas del empleado, como el servidor de verdad.
      if (ruta.includes('/datos/admin/preferencias/')) {
        if (init?.method === 'PUT')
          guardado = (JSON.parse(String(init.body)) as { valor: Record<string, string> }).valor;
        return json({ valor: guardado ?? {}, guardada: Boolean(guardado) });
      }
      if (ruta.includes('/datos/admin/clientes')) {
        const prueba = ruta.includes('cuentas=prueba');
        return json({
          clientes: [
            prueba
              ? {
                  id: 'c2',
                  nombre: 'Soporte Prueba Pasajero',
                  correo: 'p@ejemplo.com',
                  telefono: '',
                  alta: '2026-11-21',
                  esPrueba: true,
                }
              : {
                  id: 'c1',
                  nombre: 'Cliente Real',
                  correo: 'r@ejemplo.com',
                  telefono: '',
                  alta: '2026-11-21',
                  esPrueba: false,
                },
          ],
          siguiente: null,
        });
      }
      if (ruta.includes('/datos/admin/ciudades')) return json({ ciudades: [] });
      return json({});
    });
    return pedidas;
  }

  it('arranca en «Reales», cambia a «De prueba» con la etiqueta y lo recuerda al volver', async () => {
    const pedidas = servidor();
    const { unmount } = render(<SuperClientes base="/panel/control-x" idioma="es" />);
    expect(await screen.findByText('Cliente Real')).toBeInTheDocument();
    expect(pedidas.find((u) => u.includes('/datos/admin/clientes'))).toContain('cuentas=reales');
    expect(screen.queryByTestId('etiqueta-prueba')).toBeNull();
    await userEvent.selectOptions(screen.getByTestId('filtro-cuentas'), 'prueba');
    expect(await screen.findByText('Soporte Prueba Pasajero')).toBeInTheDocument();
    expect(screen.getByTestId('etiqueta-prueba').textContent).toBe('Prueba');
    // Se espera el guardado (1,5 s después del último cambio) antes de salir.
    await waitFor(() =>
      expect(pedidas.some((u) => u.includes('/preferencias/clientes'))).toBe(true),
    );
    await new Promise((r) => setTimeout(r, 1_700));
    unmount();
    pedidas.length = 0;
    render(<SuperClientes base="/panel/control-x" idioma="es" />);
    await waitFor(() =>
      expect(pedidas.find((u) => u.includes('/datos/admin/clientes'))).toContain('cuentas=prueba'),
    );
    expect((screen.getByTestId('filtro-cuentas') as HTMLSelectElement).value).toBe('prueba');
  });
});
