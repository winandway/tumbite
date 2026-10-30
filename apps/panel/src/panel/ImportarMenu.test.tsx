import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportarMenu } from './ImportarMenu';

// C-MENU-PLANILLA (30 oct 2026): subir la planilla, ver la vista previa con errores y guardar.
describe('cargar el menú desde una planilla (C-MENU-PLANILLA)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('revisa, muestra los errores por fila y guarda al confirmar', async () => {
    const cuerpos: { csv: string; confirmar: boolean }[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      const b = JSON.parse(String(init?.body)) as { csv: string; confirmar: boolean };
      cuerpos.push(b);
      return new Response(
        JSON.stringify({
          nuevos: 2,
          actualizados: 0,
          errores: b.confirmar ? [] : [{ fila: 4, error: 'El precio no es válido (ej.: 12.50).' }],
          totalErrores: b.confirmar ? 0 : 1,
          guardado: b.confirmar,
        }),
        { status: 200 },
      );
    });
    const alGuardar = vi.fn();
    render(
      <ImportarMenu
        ruta="/datos/mi-restaurante/platos/importar"
        idioma="es"
        alGuardar={alGuardar}
      />,
    );
    const archivo = new File(['name_es,price\nPizza,12\n'], 'menu.csv', { type: 'text/csv' });
    await userEvent.upload(screen.getByLabelText('Archivo de la planilla (.csv)'), archivo);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Revisar la planilla' })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Revisar la planilla' }));
    expect(
      await screen.findByText('Fila 4: El precio no es válido (ej.: 12.50).'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar 2 platos' }));
    expect(await screen.findByText('Listo: 2 platos nuevos y 0 actualizados.')).toBeInTheDocument();
    expect(cuerpos.map((c) => c.confirmar)).toEqual([false, true]);
    expect(alGuardar).toHaveBeenCalledOnce();
  });
});
