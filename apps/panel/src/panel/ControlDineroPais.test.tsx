import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ControlDinero } from './ControlDinero';

/**
 * C-AJUSTES-PAIS-PROPIO (20 nov 2026) — todos los países. Al cambiar de pestaña de país en Ajustes,
 * las casillas del país anterior seguían en pantalla mientras llegaba el nuevo, y el bloque «Plazo de
 * papeles» se quedaba con ellas para siempre: guardar ahí escribía los valores de un país en otro.
 */
const politica = (dias: number) => ({
  dias,
  paraEmpezar: [],
  exentos: [],
  asistente: dias > 0,
  aprobacionAutomatica: false,
});
const config = (moneda: string, dias: number) => ({
  moneda,
  decimales: 2,
  comisionPb: null,
  cargoFijo: 0,
  topeEfectivoDiario: null,
  tarifas: null,
  topes: null,
  plazoPapeles: politica(dias),
});

function servidor() {
  const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = [];
  let soltarVenezuela = () => {};
  const esperaVenezuela = new Promise<void>((listo) => {
    soltarVenezuela = listo;
  });
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    llamadas.push({ url, metodo, cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    let r: unknown = {};
    if (url.includes('/admin/retiros'))
      r = { activos: false, apagadosPorVariable: false, porEstado: [] };
    if (url.includes('/admin/liquidaciones'))
      r = { revision: [], atrasadas: [], absorbidoSinCobro: [] };
    if (url.includes('/admin/abonos-fallidos')) r = { abonos: [] };
    if (url.includes('/admin/conciliacion')) r = { conciliaciones: [] };
    if (url.includes('/admin/puntos-venta')) r = { puntos: [] };
    if (url.includes('/admin/paises/US')) r = { config: config('USD', 0) };
    if (url.includes('/admin/paises/VE')) {
      if (metodo === 'GET') await esperaVenezuela;
      r = { config: config('VES', 30) };
    }
    return new Response(JSON.stringify(r), { status: 200 });
  });
  return { llamadas, soltarVenezuela: () => soltarVenezuela() };
}

describe('C-AJUSTES-PAIS-PROPIO: cada país enseña y guarda solo lo suyo', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('al cambiar de país no queda en pantalla nada del anterior, y se guarda lo del país elegido', async () => {
    const s = servidor();
    render(<ControlDinero idioma="es" />);
    const dias = await screen.findByTestId('politica-dias');
    expect(dias).toHaveValue('0');

    await userEvent.click(screen.getByRole('tab', { name: 'VE' }));
    // Venezuela todavía no llegó: las casillas de Estados Unidos no pueden seguir ahí.
    expect(screen.queryByTestId('politica-dias')).not.toBeInTheDocument();

    s.soltarVenezuela();
    await waitFor(() => expect(screen.getByTestId('politica-dias')).toHaveValue('30'));

    await userEvent.click(screen.getByTestId('politica-guardar'));
    await waitFor(() => {
      const guardado = s.llamadas.find((l) => l.metodo === 'PUT');
      expect(guardado?.url).toContain('/admin/paises/VE');
      expect(guardado?.cuerpo).toMatchObject({ plazoPapeles: { dias: 30 } });
    });
  });
});
