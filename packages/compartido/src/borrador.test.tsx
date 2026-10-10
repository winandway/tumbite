// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { almacenNavegador, borrarBorradoresDe, llaveBorrador, useBorrador } from './borrador';

const inicial = { nombre: '', correo: '', clave: '' };

describe('useBorrador: ningún formulario pierde lo escrito', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it('guarda solo mientras se escribe, sin la contraseña', async () => {
    const { result } = renderHook(() =>
      useBorrador({
        formulario: 'registro',
        inicial,
        almacen: almacenNavegador,
        sensibles: ['clave'],
        esperaMs: 10,
      }),
    );
    await waitFor(() => expect(result.current.recuperado).toBe(false));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    act(() => {
      result.current.cambiar('nombre', 'Ana');
      result.current.cambiar('clave', 'secreta123');
    });
    await waitFor(() => expect(localStorage.getItem(llaveBorrador('registro'))).toContain('Ana'));
    expect(localStorage.getItem(llaveBorrador('registro'))).not.toContain('secreta123');
  });

  it('si la página se cierra antes del medio segundo, guarda igual', async () => {
    const { result } = renderHook(() =>
      useBorrador({ formulario: 'rapido', inicial, almacen: almacenNavegador, esperaMs: 10_000 }),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    act(() => result.current.cambiar('nombre', 'Ana veloz'));
    expect(localStorage.getItem(llaveBorrador('rapido'))).toBeNull();
    window.dispatchEvent(new Event('pagehide'));
    expect(localStorage.getItem(llaveBorrador('rapido'))).toContain('Ana veloz');
  });

  it('al cerrar la pantalla (desmontar) guarda lo pendiente', async () => {
    const { result, unmount } = renderHook(() =>
      useBorrador({ formulario: 'desmonta', inicial, almacen: almacenNavegador, esperaMs: 10_000 }),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    act(() => result.current.cambiar('nombre', 'Leo'));
    unmount();
    expect(localStorage.getItem(llaveBorrador('desmonta'))).toContain('Leo');
  });

  it('devuelve lo escrito al volver y avisa que lo recuperó', async () => {
    localStorage.setItem(
      llaveBorrador('registro'),
      JSON.stringify({ nombre: 'Ana', correo: 'ana@correo.com' }),
    );
    const { result } = renderHook(() =>
      useBorrador({ formulario: 'registro', inicial, almacen: almacenNavegador }),
    );
    await waitFor(() => expect(result.current.recuperado).toBe(true));
    expect(result.current.valores.nombre).toBe('Ana');
    expect(result.current.valores.clave).toBe('');
  });

  it('después de guardar con éxito, el formulario vacío no reaparece como borrador', async () => {
    const { result, unmount } = renderHook(() =>
      useBorrador({ formulario: 'vacio', inicial, almacen: almacenNavegador, esperaMs: 5 }),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    act(() => result.current.cambiar('nombre', 'Plato'));
    await act(() => result.current.limpiar());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    unmount();
    expect(localStorage.getItem(llaveBorrador('vacio'))).toBeNull();
  });

  it('cada cuenta tiene su propio borrador', async () => {
    localStorage.setItem(llaveBorrador('plato', 'cuenta-a'), JSON.stringify({ nombre: 'De A' }));
    const { result } = renderHook(() =>
      useBorrador({ formulario: 'plato', cuenta: 'cuenta-b', inicial, almacen: almacenNavegador }),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(result.current.recuperado).toBe(false);
    expect(result.current.valores.nombre).toBe('');
  });

  it('se borra al guardar con éxito', async () => {
    localStorage.setItem(llaveBorrador('registro'), JSON.stringify({ nombre: 'Ana' }));
    const { result } = renderHook(() =>
      useBorrador({ formulario: 'registro', inicial, almacen: almacenNavegador }),
    );
    await waitFor(() => expect(result.current.recuperado).toBe(true));
    await act(() => result.current.limpiar());
    expect(localStorage.getItem(llaveBorrador('registro'))).toBeNull();
    expect(result.current.valores.nombre).toBe('');
  });

  it('al cerrar sesión se borran los borradores de esa cuenta y no los de otra', async () => {
    localStorage.setItem(llaveBorrador('a', 'yo'), '{}');
    localStorage.setItem(llaveBorrador('b', 'yo'), '{}');
    localStorage.setItem(llaveBorrador('a', 'otra'), '{}');
    await borrarBorradoresDe(almacenNavegador, 'yo');
    expect(localStorage.getItem(llaveBorrador('a', 'yo'))).toBeNull();
    expect(localStorage.getItem(llaveBorrador('a', 'otra'))).not.toBeNull();
  });

  it('un borrador dañado no rompe el formulario', async () => {
    localStorage.setItem(llaveBorrador('registro'), '{roto');
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() =>
      useBorrador({ formulario: 'registro', inicial, almacen: almacenNavegador }),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(result.current.valores).toEqual(inicial);
    aviso.mockRestore();
  });
});
