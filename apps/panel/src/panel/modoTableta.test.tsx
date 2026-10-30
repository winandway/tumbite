import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useModoTableta } from './modoTableta';

describe('modo tableta del restaurante (C-MODO-TABLETA)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.classList.remove('modo-tableta');
  });

  it('pide pantalla completa y pantalla siempre encendida, esconde el menú y lo suelta al salir', async () => {
    const soltar = vi.fn(async () => undefined);
    const pedirCandado = vi.fn(async () => ({ release: soltar }));
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: pedirCandado },
      configurable: true,
    });
    const completa = vi.fn(async () => undefined);
    document.documentElement.requestFullscreen = completa;
    const { result } = renderHook(() => useModoTableta());
    await act(() => result.current.entrar());
    expect(result.current.activo).toBe(true);
    expect(document.body.classList.contains('modo-tableta')).toBe(true);
    expect(completa).toHaveBeenCalled();
    expect(pedirCandado).toHaveBeenCalledWith('screen');
    // Al volver a la pestaña se pide de nuevo (el navegador lo suelta al ocultarla).
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(pedirCandado).toHaveBeenCalledTimes(2);
    await act(() => result.current.salir());
    expect(result.current.activo).toBe(false);
    expect(document.body.classList.contains('modo-tableta')).toBe(false);
    expect(soltar).toHaveBeenCalled();
  });

  it('sin soporte del navegador, el modo igual entra (sin candado)', async () => {
    Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true });
    const { result } = renderHook(() => useModoTableta());
    await act(() => result.current.entrar());
    expect(result.current.activo).toBe(true);
  });
});
