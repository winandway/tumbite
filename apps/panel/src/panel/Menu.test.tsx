import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Menu } from './Menu';

const usuario = {
  id: 'u1',
  nombre: 'Rosa',
  correo: 'rosa@ejemplo.com',
  rol: 'restaurante' as const,
  idioma: 'es' as const,
};
const plato = {
  id: 'p1',
  restauranteId: 'r1',
  nombreEs: 'Croquetas',
  nombreEn: 'Croquettes',
  descripcionEs: '',
  descripcionEn: '',
  categoria: 'Entradas',
  precioCentavos: 650,
  imagen: null,
  disponible: true,
};

describe('menú del restaurante', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('no hay botón de eliminar a la vista: vive dentro de los 3 puntos', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ restaurante: { id: 'r1' }, platos: [plato] }), {
          status: 200,
        }),
    );
    render(<Menu usuario={usuario} idioma="es" />);
    expect(await screen.findByText('Croquetas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(screen.getByRole('menuitem', { name: 'Eliminar' })).toBeInTheDocument();
  });

  it('un precio mal escrito se explica y no se pierde lo escrito', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ restaurante: { id: 'r1' }, platos: [] }), { status: 200 }),
    );
    render(<Menu usuario={usuario} idioma="es" />);
    await userEvent.click(await screen.findByRole('button', { name: '+ Agregar plato' }));
    await userEvent.type(screen.getByLabelText('Nombre en español'), 'Flan');
    await userEvent.type(screen.getByLabelText('Precio en dólares'), 'cinco');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar plato' }));
    expect(await screen.findByText('Escribe un precio como 12.50')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre en español')).toHaveValue('Flan');
  });

  // C-AGOTADO-HOY: como DoorDash Merchant, «Agotado por hoy» vuelve solo a medianoche.
  it('«Agotado por hoy» manda hasta=hoy y el plato dice «Agotado hasta mañana»', async () => {
    const enviados: unknown[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH' && url.includes('/disponible')) {
        enviados.push(JSON.parse(String(init.body)));
        return new Response(
          JSON.stringify({ disponible: false, agotadoHasta: '2026-10-31 04:00:00' }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ restaurante: { id: 'r1' }, platos: [plato] }), {
        status: 200,
      });
    });
    render(<Menu usuario={usuario} idioma="es" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Más opciones' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Agotado por hoy' }));
    expect(await screen.findByText('Agotado hasta mañana')).toBeInTheDocument();
    expect(enviados).toEqual([{ disponible: false, hasta: 'hoy' }]);
  });

  // C-OPCIONES-ANIDADAS (30 oct 2026): copiar las opciones de otro plato y que una opción abra otro grupo.
  it('copia las opciones de otro plato y guarda que «Refresco» abre «Tamaño»', async () => {
    const combo = {
      ...plato,
      id: 'p2',
      nombreEs: 'Combo',
      nombreEn: 'Combo',
      grupos: [
        {
          id: 'g1',
          nombreEs: 'Bebida',
          nombreEn: 'Drink',
          minimo: 1,
          maximo: 1,
          opciones: [
            {
              id: 'o1',
              nombreEs: 'Refresco',
              nombreEn: 'Soda',
              precioCentavos: 0,
              disponible: true,
            },
          ],
        },
        {
          id: 'g2',
          nombreEs: 'Tamaño',
          nombreEn: 'Size',
          minimo: 1,
          maximo: 1,
          opciones: [
            {
              id: 'o2',
              nombreEs: 'Grande',
              nombreEn: 'Large',
              precioCentavos: 100,
              disponible: true,
            },
          ],
        },
      ],
    };
    const enviados: { url: string; cuerpo: unknown }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        enviados.push({ url, cuerpo: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify({ plato: { ...plato, grupos: [] } }), { status: 200 });
      }
      return new Response(JSON.stringify({ restaurante: { id: 'r1' }, platos: [plato, combo] }), {
        status: 200,
      });
    });
    render(<Menu usuario={usuario} idioma="es" />);
    const tres = await screen.findAllByRole('button', { name: 'Más opciones' });
    await userEvent.click(tres[0]!);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));
    await userEvent.selectOptions(
      screen.getByLabelText('Copiar las opciones de otro plato'),
      'Combo',
    );
    expect(screen.getAllByLabelText('Nombre del grupo (español)')).toHaveLength(2);
    await userEvent.selectOptions(
      screen.getAllByLabelText('Al elegirla, pide también')[0]!,
      'Tamaño',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Guardar plato' }));
    const opciones = await vi.waitFor(() => {
      const x = enviados.find((e) => e.url.endsWith('/opciones'));
      if (!x) throw new Error('sin opciones');
      return x.cuerpo as { grupos: { opciones: { abreGrupo: number | null }[] }[] };
    });
    expect(opciones.grupos[0]!.opciones[0]!.abreGrupo).toBe(1);
    expect(opciones.grupos[1]!.opciones[0]!.abreGrupo).toBeNull();
  });
});
