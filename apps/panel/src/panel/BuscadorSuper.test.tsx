import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuscadorSuper } from './BuscadorSuper';

/**
 * C-BUSCADOR-SERIO (15 nov 2026, pedido de Richard). Todos los países. El buscador de arriba del
 * superadmin: pausa entre teclas, cancela la petición anterior, agrupa, resalta, se maneja con el
 * teclado y abre la ficha.
 */
const BASE = '/panel/control-x';
const ID = '407f2f00-0000-4000-8000-000000000001';

const respuesta = (q: string) => ({
  q,
  avisoMonto: false,
  salto: null,
  grupos: [
    {
      tipo: 'pedidos',
      resultados: [
        {
          id: ID,
          titulo: '#407F2F',
          detalle: 'Prueba en vivo · Ángela Ruiz',
          estado: 'entregado',
          ciudad: 'Novi',
          enlace: `/orders/${ID}`,
          coincide: '407f',
          fecha: '2026-11-14 18:30:00',
          monto: 2800,
          moneda: 'USD',
        },
      ],
    },
    {
      tipo: 'clientes',
      resultados: [
        {
          id: 'c-ana',
          titulo: 'Ángela Ruiz',
          detalle: '+1 ••• ••• 4821 · a•••@ejemplo.com',
          estado: null,
          ciudad: 'Miami',
          enlace: '/customers/c-ana',
          coincide: '407f',
        },
      ],
    },
  ],
});

type Llamada = { url: string; senal?: AbortSignal | null };
function servidor(responder: (q: string) => Promise<Response> | Response) {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    llamadas.push({ url: String(url), senal: init?.signal });
    const q = new URL(String(url), 'http://x').searchParams.get('q') ?? '';
    return Promise.resolve(responder(q));
  });
  return llamadas;
}

describe('C-BUSCADOR-SERIO · buscador de arriba del superadmin', () => {
  beforeEach(() => window.history.pushState(null, '', BASE));
  afterEach(() => vi.unstubAllGlobals());

  it('espera la pausa entre teclas: escribir «407f» de corrido hace UNA sola búsqueda', async () => {
    const llamadas = servidor((q) => new Response(JSON.stringify(respuesta(q))));
    render(<BuscadorSuper base={BASE} idioma="es" />);
    await userEvent.type(screen.getByRole('combobox'), '407f');
    expect(await screen.findByText(/^Novi · /)).toBeTruthy();
    const buscadas = llamadas.filter((l) => l.url.includes('/admin/buscar'));
    expect(buscadas.map((l) => l.url)).toEqual(['/datos/admin/buscar?q=407f']);
  });

  it('cancela la petición anterior cuando se sigue escribiendo', async () => {
    const pendientes: ((r: Response) => void)[] = [];
    const llamadas = servidor((q) =>
      q === '40'
        ? new Promise<Response>((ok) => pendientes.push(ok))
        : new Response(JSON.stringify(respuesta(q))),
    );
    render(<BuscadorSuper base={BASE} idioma="es" />);
    const casilla = screen.getByRole('combobox');
    await userEvent.type(casilla, '40');
    await waitFor(() => expect(llamadas).toHaveLength(1));
    await userEvent.type(casilla, '7f');
    await waitFor(() => expect(llamadas).toHaveLength(2));
    expect(llamadas[0]?.senal?.aborted).toBe(true);
    expect(llamadas[1]?.senal?.aborted).toBe(false);
    // La respuesta vieja que llega tarde no pisa la nueva.
    pendientes[0]?.(new Response(JSON.stringify({ ...respuesta('40'), grupos: [] })));
    expect(await screen.findByText('Pedidos')).toBeTruthy();
  });

  it('agrupa por tipo, resalta lo que coincidió, enmascara el teléfono y muestra el estado en verde', async () => {
    servidor((q) => new Response(JSON.stringify(respuesta(q))));
    render(<BuscadorSuper base={BASE} idioma="es" />);
    await userEvent.type(screen.getByRole('combobox'), '407f');
    const lista = await screen.findByRole('listbox');
    expect(within(lista).getByText('Pedidos')).toBeTruthy();
    expect(within(lista).getByText('Clientes')).toBeTruthy();
    const marca = lista.querySelector('mark');
    expect(marca?.textContent).toBe('407F');
    expect(within(lista).getByText(/\+1 ••• ••• 4821/)).toBeTruthy();
    expect(lista.textContent).not.toMatch(/305/);
    expect(within(lista).getByText('Entregado').className).toContain('bs-exito');
  });

  it('flechas, Enter abre la ficha y Escape cierra', async () => {
    servidor((q) => new Response(JSON.stringify(respuesta(q))));
    render(<BuscadorSuper base={BASE} idioma="es" />);
    const casilla = screen.getByRole('combobox');
    await userEvent.type(casilla, '407f');
    await screen.findByRole('listbox');
    const opciones = screen.getAllByRole('option');
    expect(opciones[0]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Enter}');
    expect(window.location.pathname).toBe(`${BASE}/customers/c-ana`);
    expect(screen.queryByRole('listbox')).toBeNull();
    await userEvent.type(casilla, '407f');
    await screen.findByRole('listbox');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('un id entero salta directo con Enter', async () => {
    servidor((q) => new Response(JSON.stringify({ ...respuesta(q), salto: `/orders/${ID}` })));
    render(<BuscadorSuper base={BASE} idioma="es" />);
    await userEvent.type(screen.getByRole('combobox'), ID);
    expect(await screen.findByText('Enter abre la ficha')).toBeTruthy();
    await userEvent.keyboard('{Enter}');
    expect(window.location.pathname).toBe(`${BASE}/orders/${ID}`);
  });

  it('«/» y Ctrl+K llevan al buscador; «/» dentro de otra casilla no', async () => {
    servidor((q) => new Response(JSON.stringify(respuesta(q))));
    render(
      <>
        <input aria-label="otra" />
        <BuscadorSuper base={BASE} idioma="en" />
      </>,
    );
    const casilla = screen.getByRole('combobox', { name: 'Search the admin' });
    fireEvent.keyDown(document.body, { key: '/' });
    expect(document.activeElement).toBe(casilla);
    casilla.blur();
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(document.activeElement).toBe(casilla);
    const otra = screen.getByLabelText('otra');
    otra.focus();
    fireEvent.keyDown(otra, { key: '/' });
    expect(document.activeElement).toBe(otra);
  });

  it('las secciones del menú también aparecen («Ir a»)', async () => {
    servidor(
      (q) => new Response(JSON.stringify({ q, grupos: [], salto: null, avisoMonto: false })),
    );
    render(
      <BuscadorSuper
        base={BASE}
        idioma="es"
        grupos={[
          {
            titulo: 'Operación',
            items: [{ clave: 'orders', texto: 'Pedidos en curso', a: `${BASE}/orders` }],
          },
        ]}
      />,
    );
    await userEvent.type(screen.getByRole('combobox'), 'pedidos');
    expect(await screen.findByText('Ir a')).toBeTruthy();
    await userEvent.keyboard('{Enter}');
    expect(window.location.pathname).toBe(`${BASE}/orders`);
  });
});
