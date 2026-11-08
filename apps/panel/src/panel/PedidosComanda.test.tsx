import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pedidos } from './Pedidos';
import { olvidarImpresora } from './impresora';

/**
 * C-COMANDA-COMPLETA y C-IMPRESORA-NAVEGADOR (8 nov 2026), en la pantalla Pedidos del panel:
 * la comanda lleva el nombre real del restaurante (antes salía vacío), el ancho 58/80 mm se guarda
 * por restaurante y, con la impresora conectada por USB, el ticket va directo en ESC/POS sin el
 * cuadro de impresión del navegador. Todos los países.
 */
const pedido = {
  id: 'abcd1234',
  estado: 'aceptado',
  subtotal: 1500,
  notas: '',
  creadoEn: '2026-11-08 20:00:00',
  pagadoEn: '2026-11-08 20:00:00',
  aceptadoEn: '2026-11-08 20:01:00',
  listoEn: null,
  recogidoEn: null,
  tiempoPrepMin: 15,
  clienteCorto: 'Ana G.',
  lineas: [
    {
      platoId: 'pl',
      nombreEs: 'Pizza',
      nombreEn: 'Pizza',
      cantidad: 1,
      opciones: [{ id: 'o', nombreEs: 'Sin cebolla', nombreEn: 'No onion', precioCentavos: 0 }],
    },
  ],
};

function servidor() {
  vi.stubGlobal('fetch', async (url: string) => {
    if (url.endsWith('/datos/mi-restaurante'))
      return new Response(
        JSON.stringify({ restaurante: { id: 'r1', nombre: 'Pizzería Demo', aceptarSolo: false } }),
        { status: 200 },
      );
    return new Response(JSON.stringify({ pedidos: [pedido], prepSugerida: 20, cocinaOcupada: 0 }), {
      status: 200,
    });
  });
}

function ventanaFalsa() {
  const escrito: string[] = [];
  const abrir = vi.fn(() => ({
    document: { open() {}, write: (h: string) => escrito.push(h), close() {} },
  }));
  vi.stubGlobal('open', abrir);
  return { abrir, escrito };
}

describe('la comanda del panel (C-COMANDA-COMPLETA · C-IMPRESORA-NAVEGADOR)', () => {
  beforeEach(() => {
    localStorage.clear();
    olvidarImpresora();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'usb');
  });

  it('imprime con el nombre del restaurante y el ancho elegido, guardado por restaurante', async () => {
    servidor();
    const { escrito } = ventanaFalsa();
    render(<Pedidos idioma="es" />);
    const imprimir = await screen.findByRole('button', { name: 'Imprimir comanda' });
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Ancho del papel' })).toBeEnabled(),
    );
    await userEvent.click(imprimir);
    expect(escrito[0]).toContain('Pizzería Demo');
    expect(escrito[0]).toContain('size:80mm');
    expect(escrito[0]).toContain('SIN CEBOLLA');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Ancho del papel' }), '58');
    expect(localStorage.getItem('divoox.anchoComanda.r1')).toBe('58');
    await userEvent.click(imprimir);
    expect(escrito[1]).toContain('size:58mm');
  });

  it('sin WebUSB ni Web Serial no ofrece conectar y explica que usa la impresión del navegador', async () => {
    servidor();
    render(<Pedidos idioma="es" />);
    await screen.findByRole('button', { name: 'Imprimir comanda' });
    expect(screen.queryByRole('button', { name: /Conectar impresora/ })).toBeNull();
    expect(screen.getByText(/impresión del navegador/)).toBeTruthy();
  });

  it('con la impresora USB conectada manda el ticket ESC/POS y no abre la ventana', async () => {
    servidor();
    const { abrir } = ventanaFalsa();
    const enviados: Uint8Array[] = [];
    const dispositivo = {
      productName: 'Impresora de tickets',
      opened: false,
      configuration: null as unknown,
      async open() {
        this.opened = true;
      },
      async selectConfiguration() {
        this.configuration = {
          interfaces: [
            {
              interfaceNumber: 0,
              alternates: [{ endpoints: [{ direction: 'out', type: 'bulk', endpointNumber: 1 }] }],
            },
          ],
        };
      },
      async claimInterface() {},
      async close() {},
      async transferOut(_n: number, datos: Uint8Array) {
        enviados.push(datos);
        return { status: 'ok' };
      },
    };
    Object.defineProperty(navigator, 'usb', {
      configurable: true,
      value: { requestDevice: async () => dispositivo, getDevices: async () => [] },
    });
    render(<Pedidos idioma="es" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Conectar impresora (USB)' }));
    expect(await screen.findByText(/Impresora conectada/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Imprimir comanda' }));
    await waitFor(() => expect(enviados.length).toBe(1));
    expect(Array.from(enviados[0]!.slice(0, 2))).toEqual([0x1b, 0x40]);
    expect(abrir).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Imprimir prueba' }));
    await waitFor(() => expect(enviados.length).toBe(2));
  });
});
