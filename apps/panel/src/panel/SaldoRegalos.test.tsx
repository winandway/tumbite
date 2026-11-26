import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SaldoCargaMasiva } from './SaldoCargaMasiva';
import { SaldoRegalosAutomaticos } from './SaldoRegalosAutomaticos';

/**
 * C-SALDO-BIENVENIDA y C-SALDO-MASIVO en el panel (26 nov 2026): la regla de bienvenida se lee en
 * palabras con su presupuesto (gastado / disponible), la carga masiva no se confirma sin escribir el
 * total de la vista previa, y lo escrito en los dos formularios no se pierde al cerrar la pantalla.
 */
const ZONAS = [{ id: 'Z1', nombre: 'Ciudad Ejemplo', pais: 'VE' }];
const REGLA = {
  id: 'bienvenida:Z1',
  tipo: 'bienvenida',
  zonaId: 'Z1',
  ciudad: 'Ciudad Ejemplo',
  monto: 300,
  vigenciaDias: 30,
  encendida: true,
  presupuesto: 30_000,
  topeDiario: 3_000,
  cadaViajes: null,
  topePersonaMes: null,
  gastado: 900,
  disponible: 29_100,
  usadoEnViajes: 300,
  vencido: 0,
  personas: 3,
};

type Pedido = { metodo: string; ruta: string; cuerpo: unknown };
function servidor(respuestas: (p: Pedido) => unknown) {
  const pedidos: Pedido[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const p = {
      metodo: init?.method ?? 'GET',
      ruta: String(url).replace(/^https?:\/\/[^/]+/, ''),
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    pedidos.push(p);
    return new Response(JSON.stringify(respuestas(p)), { status: 200 });
  });
  return pedidos;
}

describe('C-SALDO-BIENVENIDA: la regla en Configuración', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('dice la regla en palabras, con lo gastado y lo disponible, y lo escrito no se pierde', async () => {
    servidor(() => ({ reglas: [REGLA], zonas: ZONAS }));
    const { unmount } = render(<SaldoRegalosAutomaticos idioma="es" />);
    const fila = await screen.findByTestId('regla-bienvenida-Z1');
    expect(fila.textContent).toContain(
      'Ciudad Ejemplo: $3.00 de Saldo Divoox a cada cliente nuevo',
    );
    expect(fila.textContent).toContain('Disponible $291.00');
    expect(fila.textContent).toContain('Encendida');
    await userEvent.type(screen.getByTestId('regla-monto'), '2');
    await userEvent.selectOptions(screen.getByTestId('regla-ciudad'), 'Z1');
    // Se cierra la pantalla y se vuelve: lo escrito sigue ahí.
    // Espera a que el borrador quede guardado (con un respiro), sin un tiempo fijo.
    await waitFor(
      () =>
        expect(
          Object.keys(localStorage).some((k) => {
            const v = localStorage.getItem(k) ?? '';
            return v.includes('"monto":"2"') && v.includes('"zonaId":"Z1"');
          }),
        ).toBe(true),
      { timeout: 5_000 },
    );
    unmount();
    render(<SaldoRegalosAutomaticos idioma="es" />);
    await screen.findByTestId('regla-bienvenida-Z1');
    await waitFor(() =>
      expect((screen.getByTestId('regla-monto') as HTMLInputElement).value).toBe('2'),
    );
    expect((screen.getByTestId('regla-ciudad') as HTMLSelectElement).value).toBe('Z1');
  });
});

describe('C-SALDO-MASIVO: la carga masiva', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('no confirma sin escribir el total de la vista previa; con el total, manda filtros, monto y motivo', async () => {
    const pedidos = servidor((p) => {
      if (p.ruta.endsWith('/reglas')) return { reglas: [], zonas: ZONAS };
      if (p.ruta.endsWith('/vista-previa'))
        return {
          clientes: 2,
          masDeLaCuenta: false,
          total: 600,
          lista: [
            {
              id: 'a',
              nombre: 'Cliente Uno',
              registrado: '2026-11-20 10:00:00',
              viajes: 0,
              celularVerificado: true,
            },
            {
              id: 'b',
              nombre: 'Cliente Dos',
              registrado: '2026-11-21 10:00:00',
              viajes: 1,
              celularVerificado: true,
            },
          ],
          siguiente: null,
        };
      if (p.metodo === 'POST' && p.ruta.endsWith('/masiva')) return { carga: { id: 'c1' } };
      return {
        cargas: [],
        topes: { porCliente: 500, porCarga: 50_000, porDiaPersona: 50_000, porDiaGlobal: 100_000 },
        maximos: {
          porCliente: 2_000,
          porCarga: 500_000,
          porDiaPersona: 500_000,
          porDiaGlobal: 1_000_000,
        },
      };
    });
    render(<SaldoCargaMasiva idioma="es" />);
    await userEvent.type(await screen.findByTestId('masiva-monto'), '3');
    await userEvent.type(screen.getByTestId('masiva-motivo'), 'Lanzamiento en la ciudad');
    await userEvent.click(screen.getByTestId('masiva-ver-previa'));
    expect((await screen.findByTestId('masiva-previa-clientes')).textContent).toBe('2');
    expect(screen.getByTestId('masiva-previa-total').textContent).toBe('$6.00');
    const boton = screen.getByTestId('masiva-confirmar-boton') as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    await userEvent.type(screen.getByTestId('masiva-total-escrito'), '5');
    expect(boton.disabled).toBe(true);
    await userEvent.clear(screen.getByTestId('masiva-total-escrito'));
    await userEvent.type(screen.getByTestId('masiva-total-escrito'), '6');
    expect(boton.disabled).toBe(false);
    await userEvent.click(boton);
    await waitFor(() =>
      expect(pedidos.some((p) => p.metodo === 'POST' && p.ruta.endsWith('/masiva'))).toBe(true),
    );
    const envio = pedidos.find((p) => p.metodo === 'POST' && p.ruta.endsWith('/masiva'));
    expect(envio?.cuerpo).toMatchObject({
      monto: 300,
      totalEscrito: 600,
      vigenciaDias: 30,
      motivo: 'Lanzamiento en la ciudad',
      filtros: { celularVerificado: true },
    });
  });
});
