import { describe, expect, it, vi } from 'vitest';
import { ubicacionParaConectar } from './ubicacionParaConectar';

/**
 * C-UBICACION-AL-CONECTAR (robot de Android, 18 nov 2026): con los permisos ya dados, «Buscando tu
 * ubicación…» duró unos 3 minutos en el primer arranque. Conectar no espera al GPS si ya hay una
 * lectura reciente, y nunca espera más del tope: después usa la última conocida.
 */
const punto = { coords: { latitude: 8.62, longitude: -71.65 } };
const nunca = () => new Promise<null>(() => undefined);

describe('ubicacionParaConectar', () => {
  it('con una lectura de hace menos de un minuto, conecta al instante sin leer el GPS', async () => {
    const leer = vi.fn(nunca);
    const r = await ubicacionParaConectar({
      reciente: { ...punto, recibidaEn: 1_000_000 - 20_000 },
      ahora: 1_000_000,
      leer,
      ultimaConocida: nunca,
    });
    expect(r).toEqual({ lat: 8.62, lng: -71.65 });
    expect(leer).not.toHaveBeenCalled();
  });

  it('si el GPS no contesta, a los 10 s usa la última conocida (nunca minutos)', async () => {
    vi.useFakeTimers();
    try {
      const p = ubicacionParaConectar({
        reciente: null,
        ahora: Date.now(),
        leer: nunca,
        ultimaConocida: async () => punto,
      });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await p).toEqual({ lat: 8.62, lng: -71.65 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('si la última conocida también se cuelga, se rinde a los 13 s y lo dice (null)', async () => {
    vi.useFakeTimers();
    try {
      const p = ubicacionParaConectar({
        reciente: null,
        ahora: Date.now(),
        leer: nunca,
        ultimaConocida: nunca,
      });
      await vi.advanceTimersByTimeAsync(13_000);
      expect(await p).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('una lectura vieja no sirve: se lee el GPS', async () => {
    const r = await ubicacionParaConectar({
      reciente: { coords: { latitude: 1, longitude: 1 }, recibidaEn: 0 },
      ahora: 10 * 60_000,
      leer: async () => punto,
      ultimaConocida: nunca,
    });
    expect(r).toEqual({ lat: 8.62, lng: -71.65 });
  });
});
