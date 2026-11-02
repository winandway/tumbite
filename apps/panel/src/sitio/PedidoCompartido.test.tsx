import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PedidoCompartido } from './PedidoCompartido';

/**
 * C-SEGUIMIENTO-HONESTO (BRE-2, 2 nov 2026): quien abre el enlace compartido ve hace cuánto se
 * movió el repartidor, un aviso si se perdió la señal (y el mapa deja de ofrecerse como en vivo)
 * y la llegada como rango además de «a más tardar».
 */
const CODIGO = 'a'.repeat(43);

function servidor(pedido: Record<string, unknown>) {
  vi.stubGlobal('fetch', async (url: string) =>
    String(url).includes(`/datos/publico/pedido/${CODIGO}`)
      ? new Response(JSON.stringify({ pedido }), { status: 200 })
      : new Response('{}', { status: 404 }),
  );
}

const BASE = {
  estado: 'en_camino',
  terminado: false,
  restaurante: 'Restaurante',
  repartidor: 'Rafa',
  ubicacion: { lat: 25.78, lng: -80.2 },
  llegaAMasTardar: '2026-11-02T16:55:00.000Z',
  llegadaRango: { desde: '2026-11-02T16:40:00.000Z', hasta: '2026-11-02T16:50:00.000Z' },
};

describe('C-SEGUIMIENTO-HONESTO en el enlace compartido', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('con señal: «Actualizado hace 8 s», el mapa y la llegada como rango', async () => {
    servidor({ ...BASE, haceSegundos: 8, senalPerdida: false });
    render(<PedidoCompartido codigo={CODIGO} idioma="es" />);
    expect(await screen.findByText('Actualizado hace 8 s')).toBeTruthy();
    expect(screen.getByText(/Llega entre/)).toBeTruthy();
    expect(screen.getByText(/A más tardar/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Ver dónde va el repartidor/ })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sin señal: avisa y no presenta el punto como en vivo', async () => {
    servidor({ ...BASE, haceSegundos: 150, senalPerdida: true });
    render(<PedidoCompartido codigo={CODIGO} idioma="en" />);
    const aviso = await screen.findByRole('alert');
    expect(aviso.textContent).toMatch(/lost the driver.s signal/i);
    expect(screen.getByText('Updated 2 min ago')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /See where the driver is/ })).toBeNull();
    expect(screen.getByRole('link', { name: /last known location/i })).toBeTruthy();
    expect(screen.getByText(/Arrives between/)).toBeTruthy();
  });
});
