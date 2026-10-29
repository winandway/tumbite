import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Productos } from './Productos';

/** C-TIENDAS-CATALOGO en el panel: la planilla con vista previa y errores, guardar y agotar. */
describe('Productos de la tienda', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('revisa la planilla, muestra los errores por fila, guarda y agota un producto', async () => {
    const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = [];
    let guardado = false;
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const cuerpo = init?.body ? JSON.parse(String(init.body)) : null;
      llamadas.push({ url, metodo: init?.method ?? 'GET', cuerpo });
      if (url.includes('/productos/importar'))
        return new Response(
          JSON.stringify(
            cuerpo.confirmar
              ? {
                  nuevos: 1,
                  actualizados: 0,
                  errores: [],
                  totalErrores: 0,
                  guardado: (guardado = true),
                }
              : {
                  nuevos: 1,
                  actualizados: 0,
                  errores: [
                    {
                      fila: 3,
                      error: 'El código de barras 123 no es válido (revisa el último dígito).',
                    },
                  ],
                  totalErrores: 1,
                  guardado: false,
                },
          ),
        );
      if (url.includes('/disponible')) return new Response(JSON.stringify({ disponible: false }));
      return new Response(
        JSON.stringify({
          tipo: 'mercado',
          pais: 'VE',
          moneda: 'USD',
          productos: guardado
            ? [
                {
                  id: 'p1',
                  sku: 'A1',
                  codigoBarras: '',
                  nombreEs: 'Harina de maíz',
                  nombreEn: '',
                  marca: 'Marca',
                  tamano: 1,
                  unidadTamano: 'kg',
                  categoria1: 'Despensa',
                  precio: 180,
                  disponible: true,
                  existencias: 40,
                },
              ]
            : [],
          hayMas: false,
          pagina: 1,
          totales: { productos: guardado ? 1 : 0, disponibles: guardado ? 1 : 0, sinFoto: 1 },
          categorias: [],
        }),
      );
    });
    render(<Productos idioma="es" />);
    expect(await screen.findByText(/Todavía no hay productos/)).toBeInTheDocument();
    const archivo = new File(
      ['sku,name,category_1,price\nA1,Harina de maíz,Despensa,1.80\n'],
      'p.csv',
      {
        type: 'text/csv',
      },
    );
    await userEvent.upload(screen.getByLabelText('Archivo de la planilla (.csv)'), archivo);
    await userEvent.click(screen.getByRole('button', { name: 'Revisar la planilla' }));
    expect(await screen.findByText(/Fila 3: El código de barras/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar 1 productos' }));
    expect(await screen.findByText(/Listo: 1 productos nuevos/)).toBeInTheDocument();
    expect(await screen.findByText('Harina de maíz')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Agotar hoy' }));
    await waitFor(() =>
      expect(
        llamadas.some((l) => l.url.endsWith('/productos/p1/disponible') && l.metodo === 'PATCH'),
      ).toBe(true),
    );
    const imp = llamadas.filter((l) => l.url.includes('/importar'));
    expect(imp.map((l) => (l.cuerpo as { confirmar: boolean }).confirmar)).toEqual([false, true]);
  });
});
