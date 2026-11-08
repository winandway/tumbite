import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { htmlComanda, imprimirComanda } from './comanda';
import { type ConexionImpresora, olvidarImpresora, reconectarImpresora } from './impresora';

// C-COMANDA: la comanda lleva el número, los platos, las notas y nada privado.
describe('C-COMANDA', () => {
  it('imprime número, modo, platos y notas, escapando lo que escribió el cliente', () => {
    const h = htmlComanda(
      {
        id: 'abcd1234',
        entrega: 'recoger',
        notas: 'Sin cebolla <por favor>',
        lineas: [{ nombreEs: 'Cubano', nombreEn: 'Cuban', cantidad: 2 }],
      },
      'Pizzería Demo',
      'es',
      new Date('2026-10-29T17:00:00Z'),
    );
    expect(h).toContain('#ABCD');
    expect(h).toContain('RECOGE EN EL LOCAL');
    expect(h).toContain('2×');
    expect(h).toContain('Cubano');
    // LAN-3x: las indicaciones para el repartidor no van en la comanda.
    expect(h).not.toContain('Sin cebolla');
    expect(h).toContain('size:80mm');
  });
});

/**
 * C-IMPRESORA-NAVEGADOR (8 nov 2026): con impresora conectada va directo en ESC/POS; si no hay o
 * falla, se cae a la impresión del navegador con el ancho elegido. Al volver, se reconecta sola.
 */
describe('C-IMPRESORA-NAVEGADOR', () => {
  const p = { id: 'abcd1234', lineas: [{ nombreEs: 'Pizza', nombreEn: 'Pizza', cantidad: 1 }] };
  let escrito: string[];
  let abrir: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    olvidarImpresora();
    localStorage.clear();
    escrito = [];
    abrir = vi.fn(() => ({
      document: { open() {}, write: (h: string) => escrito.push(h), close() {} },
    }));
    vi.stubGlobal('open', abrir);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'usb');
    Reflect.deleteProperty(navigator, 'serial');
  });

  it('sin impresora usa la impresión del navegador con el ancho elegido', async () => {
    expect(await imprimirComanda(p, 'Pizzería Demo', 'es', { ancho: 58 })).toBe('navegador');
    expect(escrito[0]).toContain('size:58mm');
    expect(escrito[0]).toContain('Pizzería Demo');
    expect(escrito[0]).toContain('window.print()');
  });

  it('con impresora manda ESC/POS; si falla, se cae al navegador y lo dice', async () => {
    const enviados: Uint8Array[] = [];
    const buena: ConexionImpresora = {
      tipo: 'usb',
      nombre: 'X',
      enviar: async (b) => void enviados.push(b),
      cerrar: async () => undefined,
    };
    expect(await imprimirComanda(p, 'R', 'es', { ancho: 80, impresora: buena })).toBe('impresora');
    expect(Array.from(enviados[0]!.slice(-4))).toEqual([0x1d, 0x56, 0x42, 0x00]);
    expect(abrir).not.toHaveBeenCalled();
    const mala: ConexionImpresora = {
      ...buena,
      enviar: async () => {
        throw new Error('desconectada');
      },
    };
    expect(await imprimirComanda(p, 'R', 'es', { ancho: 80, impresora: mala })).toBe(
      'navegador-por-fallo',
    );
    expect(escrito[0]).toContain('size:80mm');
  });

  it('al volver se reconecta sola con la impresora ya autorizada (USB o puerto serie)', async () => {
    expect(await reconectarImpresora()).toBeNull();
    const puerto = {
      readable: null,
      writable: null as unknown,
      getInfo: () => ({}),
      async open() {
        this.writable = {
          getWriter: () => ({ write: async () => undefined, releaseLock() {} }),
        };
      },
      async close() {},
    };
    Object.defineProperty(navigator, 'serial', {
      configurable: true,
      value: { getPorts: async () => [puerto], requestPort: async () => puerto },
    });
    localStorage.setItem('divoox.impresora.tipo', 'serie');
    const c = await reconectarImpresora();
    expect(c?.tipo).toBe('serie');
    expect(puerto.writable).not.toBeNull();
  });
});
