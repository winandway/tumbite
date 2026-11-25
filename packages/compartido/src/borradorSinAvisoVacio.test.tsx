// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { almacenNavegador, borradorSinCambios, llaveBorrador, useBorrador } from './borrador';

/**
 * C-BORRADOR-SIN-AVISO-VACIO (Richard, 25 nov 2026: en «Cambiar ciudad» salía «Recuperamos lo que
 * estabas escribiendo» sin haber escrito nada) — TODOS los formularios, en la pieza única. Un borrador
 * vacío o igual a lo que ya estaba no se avisa ni se queda guardado.
 */
const inicial = { zonaId: '', motivo: '' };
const espera = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });

describe('C-BORRADOR-SIN-AVISO-VACIO', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it('la pieza pura: vacío, solo espacios o igual a lo guardado no es borrador', () => {
    expect(borradorSinCambios({ zonaId: '', motivo: '' }, inicial)).toBe(true);
    expect(borradorSinCambios({ zonaId: '', motivo: '   ' }, inicial)).toBe(true);
    expect(borradorSinCambios({ motivo: '' }, inicial)).toBe(true);
    expect(borradorSinCambios({ zonaId: 'VE-1', motivo: '' }, inicial)).toBe(false);
    expect(borradorSinCambios({ clave: 'x' }, { clave: '' }, ['clave'])).toBe(true);
    expect(borradorSinCambios({ dias: [1, 2] }, { dias: [1, 2] })).toBe(true);
  });

  it('un borrador guardado vacío no avisa «Recuperamos…» y se borra', async () => {
    const llave = llaveBorrador('ciudad-conductor-c1', 'superadmin');
    localStorage.setItem(llave, JSON.stringify({ zonaId: '', motivo: '' }));
    const { result } = renderHook(() =>
      useBorrador({
        formulario: 'ciudad-conductor-c1',
        cuenta: 'superadmin',
        inicial,
        almacen: almacenNavegador,
        esperaMs: 5,
      }),
    );
    await espera();
    expect(result.current.recuperado).toBe(false);
    expect(localStorage.getItem(llave)).toBeNull();
  });

  it('solo espacios tampoco avisa; lo escrito de verdad sí se recupera', async () => {
    const vacio = llaveBorrador('f-espacios', 'yo');
    localStorage.setItem(vacio, JSON.stringify({ zonaId: '', motivo: '   ' }));
    const a = renderHook(() =>
      useBorrador({ formulario: 'f-espacios', cuenta: 'yo', inicial, almacen: almacenNavegador }),
    );
    await espera();
    expect(a.result.current.recuperado).toBe(false);
    const lleno = llaveBorrador('f-lleno', 'yo');
    localStorage.setItem(lleno, JSON.stringify({ zonaId: '', motivo: 'Se mudó de ciudad' }));
    const b = renderHook(() =>
      useBorrador({ formulario: 'f-lleno', cuenta: 'yo', inicial, almacen: almacenNavegador }),
    );
    await waitFor(() => expect(b.result.current.recuperado).toBe(true));
    expect(b.result.current.valores.motivo).toBe('Se mudó de ciudad');
  });

  it('lo recuperado igual a lo que vino del servidor deja de avisar', async () => {
    const llave = llaveBorrador('f-servidor', 'yo');
    localStorage.setItem(llave, JSON.stringify({ zonaId: 'VE-1', motivo: 'Guardado' }));
    const { result } = renderHook(() =>
      useBorrador({ formulario: 'f-servidor', cuenta: 'yo', inicial, almacen: almacenNavegador }),
    );
    await waitFor(() => expect(result.current.recuperado).toBe(true));
    act(() => result.current.cargarBase({ zonaId: 'VE-1', motivo: 'Guardado' }));
    expect(result.current.recuperado).toBe(false);
    expect(localStorage.getItem(llave)).toBeNull();
  });
});
