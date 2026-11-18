// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rutaSugerencias, useSugerenciasDireccion } from './lugares';

describe('C-DIRECCION-SUGERENCIAS: toda casilla de dirección sugiere direcciones reales', () => {
  afterEach(() => cleanup());

  it('la consulta lleva lo escrito, la sesión, el país y la cercanía', () => {
    expect(
      rutaSugerencias(' Chacao ', 'abc12345', { pais: 'VE', cerca: { lat: 10.5, lng: -66.9 } }),
    ).toBe('/datos/lugares/sugerencias?q=Chacao&sesion=abc12345&pais=VE&lat=10.5&lng=-66.9');
    expect(rutaSugerencias('Miami', 'abc12345')).toBe(
      '/datos/lugares/sugerencias?q=Miami&sesion=abc12345',
    );
  });

  it('pide sugerencias desde 3 letras, y al elegir trae el punto exacto', async () => {
    const pedir = vi.fn(async (_m: string, ruta: string) =>
      ruta.includes('/sugerencias')
        ? { sugerencias: [{ id: 'ChIJ1', texto: '30080 Montmorency Dr, Miami' }] }
        : { punto: { lat: 25.7, lng: -80.2 }, direccion: '30080 Montmorency Dr, Miami, FL' },
    );
    const { result } = renderHook(() =>
      useSugerenciasDireccion({ pedir: pedir as never, pais: null }),
    );
    act(() => result.current.buscar('30'));
    await new Promise((r) => setTimeout(r, 350));
    expect(pedir).not.toHaveBeenCalled();
    act(() => result.current.buscar('30080 Montmor'));
    await waitFor(() => expect(result.current.sugerencias).toHaveLength(1));
    let elegida: Awaited<ReturnType<typeof result.current.elegir>> = null;
    await act(async () => {
      elegida = await result.current.elegir('ChIJ1');
    });
    expect(elegida).toEqual({
      punto: { lat: 25.7, lng: -80.2 },
      direccion: '30080 Montmorency Dr, Miami, FL',
    });
    expect(result.current.sugerencias).toEqual([]);
  });

  it('C-SIN-PLUS-CODE: resultados y destino elegido sin plus codes (también con un servidor viejo)', async () => {
    const pedir = vi.fn(async (_m: string, ruta: string) =>
      ruta.includes('/sugerencias')
        ? {
            sugerencias: [
              {
                id: 'ChIJ2',
                texto: 'Terminal de Pasajeros de El Vigía, J85P+QQ2, El Vigía',
                principal: 'Terminal de Pasajeros de El Vigía',
                secundario: 'J85P+QQ2, El Vigía',
              },
            ],
          }
        : {
            punto: { lat: 8.62, lng: -71.65 },
            direccion: 'J85P+QQ2 Terminal de Pasajeros, El Vigía 5145, Mérida',
          },
    );
    const { result } = renderHook(() =>
      useSugerenciasDireccion({ pedir: pedir as never, pais: null }),
    );
    act(() => result.current.buscar('Terminal'));
    await waitFor(() => expect(result.current.sugerencias).toHaveLength(1));
    expect(result.current.sugerencias[0]).toMatchObject({
      texto: 'Terminal de Pasajeros de El Vigía, El Vigía',
      secundario: 'El Vigía',
    });
    let elegida: Awaited<ReturnType<typeof result.current.elegir>> = null;
    await act(async () => {
      elegida = await result.current.elegir('ChIJ2');
    });
    expect(elegida).toEqual({
      punto: { lat: 8.62, lng: -71.65 },
      direccion: 'Terminal de Pasajeros, El Vigía 5145, Mérida',
    });
  });
});
