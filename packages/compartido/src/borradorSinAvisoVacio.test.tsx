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

  it('un borrador de una versión vieja (con campos que el formulario ya no tiene) no avisa', async () => {
    const llave = llaveBorrador('f-viejo', 'yo');
    localStorage.setItem(llave, JSON.stringify({ zonaId: '', motivo: '', paso: 'confirmar' }));
    const { result } = renderHook(() =>
      useBorrador({ formulario: 'f-viejo', cuenta: 'yo', inicial, almacen: almacenNavegador }),
    );
    await espera();
    expect(result.current.recuperado).toBe(false);
    expect(result.current.valores).toEqual(inicial);
  });

  it('valor inicial que llega tarde: lo que el formulario pone al cargar sus datos apaga el aviso', async () => {
    const llave = llaveBorrador('f-tarde', 'yo');
    // Lo guardado: una ciudad que, al llegar los datos, ya no se puede elegir.
    localStorage.setItem(llave, JSON.stringify({ zonaId: 'CIUDAD-CERRADA', motivo: '' }));
    const { result } = renderHook(() =>
      useBorrador({ formulario: 'f-tarde', cuenta: 'yo', inicial, almacen: almacenNavegador }),
    );
    await waitFor(() => expect(result.current.valores.zonaId).toBe('CIUDAD-CERRADA'));
    // Llegan los datos y el formulario descarta lo que ya no sirve: queda igual que sin borrador.
    act(() => result.current.setValores({ zonaId: '', motivo: '' }));
    expect(result.current.recuperado).toBe(false);
    // Y con la base del servidor que llega tarde e igual a lo recuperado, tampoco.
    const otra = llaveBorrador('f-servidor-tarde', 'yo');
    localStorage.setItem(otra, JSON.stringify({ zonaId: 'VE-1', motivo: 'Guardado' }));
    const b = renderHook(() =>
      useBorrador({
        formulario: 'f-servidor-tarde',
        cuenta: 'yo',
        inicial,
        almacen: almacenNavegador,
      }),
    );
    await waitFor(() => expect(b.result.current.valores.zonaId).toBe('VE-1'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
      b.result.current.cargarBase({ zonaId: 'VE-1', motivo: 'Guardado' });
    });
    expect(b.result.current.recuperado).toBe(false);
  });

  it('un formulario con campos que crecen (fuera de su inicial) no pierde lo escrito', async () => {
    const llave = llaveBorrador('f-dinamico', 'yo');
    const inicialDinamico: Record<string, string> = { nombre: '' };
    const a = renderHook(() =>
      useBorrador({
        formulario: 'f-dinamico',
        cuenta: 'yo',
        inicial: inicialDinamico,
        almacen: almacenNavegador,
        esperaMs: 5,
      }),
    );
    await espera();
    act(() => a.result.current.setValores({ nombre: '', extra_1: 'Pasillo de bebidas' }));
    await waitFor(() => expect(localStorage.getItem(llave)).toContain('Pasillo de bebidas'));
    a.unmount();
    const b = renderHook(() =>
      useBorrador({
        formulario: 'f-dinamico',
        cuenta: 'yo',
        inicial: inicialDinamico,
        almacen: almacenNavegador,
      }),
    );
    await waitFor(() => expect(b.result.current.recuperado).toBe(true));
    expect(b.result.current.valores.extra_1).toBe('Pasillo de bebidas');
    // Y uno de campos libres (`inicial: {}`), igual.
    const c = renderHook(() =>
      useBorrador({
        formulario: 'f-libre',
        cuenta: 'yo',
        inicial: {} as Record<string, string>,
        almacen: almacenNavegador,
        esperaMs: 5,
      }),
    );
    await espera();
    act(() => c.result.current.setValores({ tope_VE: '25' }));
    await waitFor(() =>
      expect(localStorage.getItem(llaveBorrador('f-libre', 'yo'))).toContain('tope_VE'),
    );
  });

  it('un campo que el formulario declaraba y hoy ya no declara no vuelve; los libres conservan todo', async () => {
    const llave = llaveBorrador('f-quitado', 'yo');
    // La versión anterior del formulario declaraba «apodo» y guardó su borrador.
    const antes = renderHook(() =>
      useBorrador({
        formulario: 'f-quitado',
        cuenta: 'yo',
        inicial: { zonaId: '', motivo: '', apodo: '' },
        almacen: almacenNavegador,
        esperaMs: 5,
      }),
    );
    await espera();
    act(() =>
      antes.result.current.setValores({ zonaId: 'VE-1', motivo: 'Se mudó', apodo: 'Viejo' }),
    );
    await waitFor(() => expect(localStorage.getItem(llave)).toContain('Viejo'));
    antes.unmount();
    // La versión de hoy ya no lo declara: no vuelve.
    const { result } = renderHook(() =>
      useBorrador({ formulario: 'f-quitado', cuenta: 'yo', inicial, almacen: almacenNavegador }),
    );
    await waitFor(() => expect(result.current.recuperado).toBe(true));
    expect(result.current.valores).toEqual({ zonaId: 'VE-1', motivo: 'Se mudó' });
    // Un formulario de campos libres conserva todo lo guardado.
    localStorage.setItem(
      llaveBorrador('f-libre-2', 'yo'),
      JSON.stringify({ tope_VE: '25', __campos: { declarados: [], libres: ['tope_VE'] } }),
    );
    const libre = renderHook(() =>
      useBorrador({
        formulario: 'f-libre-2',
        cuenta: 'yo',
        inicial: {} as Record<string, string>,
        almacen: almacenNavegador,
      }),
    );
    await waitFor(() => expect(libre.result.current.valores).toEqual({ tope_VE: '25' }));
  });
});

/**
 * C-BORRADOR-ELECCION-SOLA (Gerencia, 26 nov 2026: en «Cambiar ciudad» seguía el aviso con solo una
 * ciudad elegida en la lista y el motivo vacío, guardado ya con la versión nueva) — todos los países.
 * Una elección de una lista, sola, no es «lo que estabas escribiendo»: no se guarda ni se avisa. Si
 * además hay algo escrito, la elección vuelve junto con el texto.
 */
describe('C-BORRADOR-ELECCION-SOLA', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());
  const op = (formulario: string) => ({
    formulario,
    cuenta: 'superadmin',
    inicial,
    almacen: almacenNavegador,
    noBastan: ['zonaId' as const],
    esperaMs: 5,
  });

  it('un borrador ya guardado con solo la ciudad elegida se borra y no avisa', async () => {
    const llave = llaveBorrador('ciudad-e1', 'superadmin');
    localStorage.setItem(
      llave,
      JSON.stringify({
        zonaId: 'VE-1',
        motivo: '',
        __campos: { declarados: ['zonaId', 'motivo'], libres: [] },
      }),
    );
    const { result } = renderHook(() => useBorrador(op('ciudad-e1')));
    await espera();
    expect(result.current.recuperado).toBe(false);
    expect(result.current.valores.zonaId).toBe('');
    expect(localStorage.getItem(llave)).toBeNull();
  });

  it('elegir una ciudad sin escribir nada no deja borrador', async () => {
    const llave = llaveBorrador('ciudad-e2', 'superadmin');
    const { result } = renderHook(() => useBorrador(op('ciudad-e2')));
    await espera();
    act(() => result.current.cambiar('zonaId', 'VE-1'));
    await espera();
    expect(localStorage.getItem(llave)).toBeNull();
  });

  it('con el motivo escrito, la ciudad elegida vuelve junto con el texto', async () => {
    const llave = llaveBorrador('ciudad-e3', 'superadmin');
    localStorage.setItem(llave, JSON.stringify({ zonaId: 'VE-1', motivo: 'Se mudó' }));
    const { result } = renderHook(() => useBorrador(op('ciudad-e3')));
    await waitFor(() => expect(result.current.recuperado).toBe(true));
    expect(result.current.valores).toMatchObject({ zonaId: 'VE-1', motivo: 'Se mudó' });
  });
});
