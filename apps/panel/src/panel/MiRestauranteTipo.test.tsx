import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MiRestaurante } from './MiRestaurante';

/**
 * C-MERCHANT-TIPO / C-MERCHANT-PALABRAS (27 nov 2026) · todos los países. En el alta del comercio
 * (Divoox Merchant abre este formulario), el tipo de negocio se elige: ninguno viene marcado, sin
 * elegir no se crea, y las palabras siguen al tipo (un mercado nunca ve «restaurante»).
 */
const usuario = {
  id: 'u-tipo',
  nombre: 'Ana',
  correo: 'ana@ejemplo.com',
  rol: 'restaurante' as const,
  idioma: 'es' as const,
};
const existente = {
  id: 'r1',
  nombre: 'Sabor',
  descripcionEs: '',
  descripcionEn: '',
  categoria: 'Cubana',
  telefono: '',
  direccion: '100 Calle',
  lat: null,
  lng: null,
  imagen: null,
  plan: 'inicial',
  estado: 'pendiente',
  abierto: false,
  tiempoPrepMin: 20,
  regalosPb: 300,
};

let llamadas: { url: string; metodo: string; cuerpo: unknown }[] = [];
function servidor(restaurante: unknown) {
  llamadas = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    const cuerpo = init?.body ? JSON.parse(String(init.body)) : undefined;
    llamadas.push({ url, metodo, cuerpo });
    const datos = metodo === 'PUT' ? { restaurante: { ...existente, ...cuerpo } } : { restaurante };
    return new Response(JSON.stringify(datos), {
      status: metodo === 'PUT' ? 201 : 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('C-MERCHANT-TIPO · el alta del comercio', () => {
  it('ningún tipo viene marcado y sin elegirlo no se crea el comercio', async () => {
    servidor(null);
    render(<MiRestaurante usuario={usuario} idioma="es" />);
    const radios = await screen.findAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('value'))).toEqual([
      'restaurante',
      'mercado',
      'farmacia',
      'licores',
      'ferreteria',
      'tienda',
      'otro',
    ]);
    expect(radios.some((r) => (r as HTMLInputElement).checked)).toBe(false);
    await userEvent.type(screen.getByLabelText('Nombre del comercio'), 'Mercado Central');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Elige el tipo de negocio.');
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false);
  });

  it('un mercado se crea como mercado y ve palabras de comercio, no de restaurante', async () => {
    servidor(null);
    render(<MiRestaurante usuario={usuario} idioma="es" />);
    await userEvent.click(await screen.findByRole('radio', { name: 'Mercado' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mi comercio');
    expect(screen.getByLabelText('Nombre del comercio')).toBeInTheDocument();
    expect(screen.queryByText(/Tipo de comida|Nombre del restaurante/)).toBeNull();
    await userEvent.type(screen.getByLabelText('Nombre del comercio'), 'Mercado Central');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByRole('status');
    expect(llamadas.find((l) => l.metodo === 'PUT')?.cuerpo).toMatchObject({
      tipoComercio: 'mercado',
    });
  });

  it('el restaurante de siempre queda marcado como Restaurante y conserva sus palabras', async () => {
    servidor(existente);
    render(<MiRestaurante usuario={usuario} idioma="es" />);
    expect(await screen.findByRole('radio', { name: 'Restaurante' })).toBeChecked();
    expect(screen.getByLabelText('Nombre del restaurante')).toHaveValue('Sabor');
    expect(screen.getByLabelText('Tipo de comida')).toBeInTheDocument();
  });
});

describe('C-MERCHANT-PALABRAS · el menú del panel', () => {
  it('el restaurante ve Menú; la tienda ve Catálogo y «Mi comercio», nunca los dos', async () => {
    const { gruposRestaurante } = await import('./armazon/menus');
    const { TEXTOS_PANEL } = await import('./textos');
    const items = (tipo?: string) =>
      gruposRestaurante(TEXTOS_PANEL.es, 'es', '/panel', false, tipo).flatMap((g) => g.items);
    const rest = items('restaurante');
    expect(rest.map((i) => i.clave)).toContain('menu');
    expect(rest.map((i) => i.clave)).not.toContain('products');
    const tienda = items('farmacia');
    expect(tienda.map((i) => i.clave)).not.toContain('menu');
    expect(tienda.find((i) => i.clave === 'products')?.texto).toBe('Catálogo');
    expect(tienda.find((i) => i.clave === 'restaurant')?.texto).toBe('Mi comercio');
  });
});
