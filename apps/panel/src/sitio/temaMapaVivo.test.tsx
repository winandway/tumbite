import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  FILTRO_LEAFLET_NOCHE,
  cambiarAjusteTemaMapa,
  olvidarAjusteTemaMapa,
  seguirTemaEnLeaflet,
  useTemaMapa,
} from '@tumbite/compartido/src/temaMapa';

/**
 * C-MAPA-DIA-NOCHE (14 nov 2026) — todos los países. El mapa cambia SOLO al anochecer, con la
 * pantalla abierta, y no deja relojes corriendo cuando el mapa se cierra.
 */
const NOVI = { lat: 42.48, lng: -83.47 };

describe('el tema del mapa, vivo', () => {
  beforeEach(() => {
    window.localStorage.clear();
    olvidarAjusteTemaMapa();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('con la pantalla abierta, pasa de día a noche cuando se pone el sol, y al cerrarla no queda ningún reloj', () => {
    // Novi, 14 de noviembre, 4:50 p. m. (21:50 UTC): el sol se pone hacia las 5:11.
    vi.setSystemTime(new Date('2026-11-14T21:50:00Z'));
    const { result, unmount } = renderHook(() => useTemaMapa(NOVI, false));
    expect(result.current).toBe('dia');
    act(() => {
      vi.advanceTimersByTime(40 * 60_000);
    });
    expect(result.current).toBe('noche');
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('el mapa de respaldo (Leaflet) oscurece los mosaicos de noche, sigue el ajuste y suelta el reloj al quitarse', async () => {
    vi.setSystemTime(new Date('2026-11-14T17:00:00Z')); // mediodía en Novi
    const capa = document.createElement('div');
    const dejar = seguirTemaEnLeaflet({ getPane: () => capa }, NOVI);
    expect(capa.style.filter).toBe('');
    await act(() => cambiarAjusteTemaMapa('oscuro'));
    expect(capa.style.filter).toBe(FILTRO_LEAFLET_NOCHE);
    await act(() => cambiarAjusteTemaMapa('auto'));
    expect(capa.style.filter).toBe('');
    // Cae la noche con el mapa abierto.
    vi.setSystemTime(new Date('2026-11-15T01:00:00Z'));
    vi.advanceTimersByTime(60_000);
    expect(capa.style.filter).toBe(FILTRO_LEAFLET_NOCHE);
    dejar(); // lo que Leaflet llama en «unload»
    expect(vi.getTimerCount()).toBe(0);
    await act(() => cambiarAjusteTemaMapa('claro'));
    expect(capa.style.filter).toBe(FILTRO_LEAFLET_NOCHE);
  });

  it('si la persona toca el ajuste mientras el teléfono todavía lee el guardado, manda lo que eligió', async () => {
    vi.useRealTimers();
    const { cargarAjusteTemaMapa, ajusteTemaMapa } =
      await import('@tumbite/compartido/src/temaMapa');
    let soltar: (v: string) => void = () => {};
    const lento = {
      leer: () => new Promise<string>((r) => (soltar = r)),
      guardar: async () => {},
      borrar: async () => {},
    };
    const carga = cargarAjusteTemaMapa(lento);
    await cambiarAjusteTemaMapa('claro', lento);
    soltar('oscuro');
    await carga;
    expect(ajusteTemaMapa()).toBe('claro');
  });
});
