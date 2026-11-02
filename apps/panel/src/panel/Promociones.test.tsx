import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Promociones } from './Promociones';
import { SuperPromociones } from './SuperPromociones';

// C-PROMO-RESTAURANTE (BRE-5) en el panel: el restaurante crea y termina su promoción; el
// superadmin la enciende.
const promo = {
  id: 'p1',
  tipo: 'porcentaje',
  valor: 2000,
  minimoSubtotal: 0,
  topeCentavos: 500,
  usosMax: 10,
  iniciaEn: '2026-11-02 00:00:00',
  venceEn: '2026-12-02 00:00:00',
  vigente: true,
  usos: 3,
  costoCentavos: 1500,
};

describe('C-PROMO-RESTAURANTE en el panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('apagadas: solo el aviso, sin formulario', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ disponible: false, moneda: 'USD', promociones: [] }), {
          status: 200,
        }),
    );
    render(<Promociones usuario={{ id: 'u1' }} idioma="es" />);
    expect(await screen.findByRole('status')).toHaveTextContent('muy pronto');
    expect(screen.queryByRole('button', { name: 'Crear promoción' })).toBeNull();
  });

  it('crea «gasta X y ahorra Y» en centavos, muestra la insignia y la termina', async () => {
    const enviados: { metodo: string; cuerpo: unknown }[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST' || init?.method === 'PATCH') {
        enviados.push({ metodo: init.method, cuerpo: JSON.parse(String(init.body)) });
        return new Response(
          JSON.stringify({
            promociones:
              init.method === 'PATCH'
                ? [{ ...promo, vigente: false }]
                : [
                    promo,
                    { ...promo, id: 'p2', tipo: 'gasta_ahorra', valor: 500, minimoSubtotal: 2500 },
                  ],
          }),
          { status: init.method === 'POST' ? 201 : 200 },
        );
      }
      return new Response(
        JSON.stringify({ disponible: true, moneda: 'USD', promociones: [promo] }),
        { status: 200 },
      );
    });
    render(<Promociones usuario={{ id: 'u1' }} idioma="es" />);
    expect(await screen.findByText('20 % de descuento')).toBeInTheDocument();
    expect(screen.getByText(/Te costó/)).toHaveTextContent('15');
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'gasta_ahorra');
    await userEvent.type(screen.getByLabelText('Lo que ahorra el cliente'), '5');
    await userEvent.type(screen.getByLabelText('Lo que tiene que gastar'), '25');
    await userEvent.click(screen.getByRole('button', { name: 'Crear promoción' }));
    await waitFor(() =>
      expect(enviados[0]).toMatchObject({
        metodo: 'POST',
        cuerpo: { tipo: 'gasta_ahorra', valor: 500, minimoSubtotal: 2500, topeCentavos: 0 },
      }),
    );
    expect(await screen.findByText(/^Gasta \$25/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Terminar' })[0]!);
    await waitFor(() =>
      expect(enviados[1]).toEqual({ metodo: 'PATCH', cuerpo: { activa: false } }),
    );
    expect(await screen.findByText('Promoción terminada.')).toBeInTheDocument();
  });

  it('un error del servidor se muestra y lo escrito se queda', async () => {
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? new Response(JSON.stringify({ error: 'El descuento tiene que ir del 1 al 50 %.' }), {
            status: 400,
          })
        : new Response(JSON.stringify({ disponible: true, moneda: 'USD', promociones: [] }), {
            status: 200,
          }),
    );
    render(<Promociones usuario={{ id: 'u1' }} idioma="en" />);
    const pct = await screen.findByLabelText('Discount (%)');
    await userEvent.type(pct, '80');
    await userEvent.click(screen.getByRole('button', { name: 'Create promotion' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('1 al 50');
    expect((pct as HTMLInputElement).value).toBe('80');
  });

  it('el superadmin la enciende y la apaga', async () => {
    const puts: unknown[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        puts.push(JSON.parse(String(init.body)));
        return new Response(String(init.body), { status: 200 });
      }
      return new Response(JSON.stringify({ encendidas: false }), { status: 200 });
    });
    render(<SuperPromociones idioma="es" />);
    const casilla = await screen.findByLabelText('Promociones encendidas');
    expect(casilla).not.toBeChecked();
    await userEvent.click(casilla);
    await waitFor(() => expect(puts).toEqual([{ encendidas: true }]));
    expect(await screen.findByRole('status')).toHaveTextContent('Guardado');
    expect(casilla).toBeChecked();
  });
});
