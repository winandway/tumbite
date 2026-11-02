import { describe, expect, it } from 'vitest';
import {
  MAX_BUSQUEDAS_RECIENTES,
  guardarBusquedas,
  leerBusquedas,
  llaveBusquedas,
  quitarBusqueda,
  sumarBusqueda,
} from './busquedasRecientes';
import type { Almacen } from './borrador';

function almacenEnMemoria(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  const a: Almacen = {
    leer: (k) => datos.get(k) ?? null,
    guardar: (k, v) => void datos.set(k, v),
    borrar: (k) => void datos.delete(k),
  };
  return { a, datos };
}

describe('C-BUSQUEDAS-RECIENTES', () => {
  it('la búsqueda nueva va arriba y la repetida sube sin duplicarse (sin importar acentos)', () => {
    let l = sumarBusqueda([], 'pizza');
    l = sumarBusqueda(l, 'sushi');
    l = sumarBusqueda(l, '  Pízza  ');
    expect(l).toEqual(['Pízza', 'sushi']);
  });

  it('nunca pasa de ocho y menos de dos letras no cuenta', () => {
    let l: string[] = [];
    for (let i = 0; i < 12; i++) l = sumarBusqueda(l, `plato ${i}`);
    expect(l).toHaveLength(MAX_BUSQUEDAS_RECIENTES);
    expect(l[0]).toBe('plato 11');
    expect(sumarBusqueda(l, 'a')).toBe(l);
  });

  it('se quita una sola', () => {
    expect(quitarBusqueda(['tacos', 'Café'], 'cafe')).toEqual(['tacos']);
  });

  it('cada cuenta tiene su llave y el invitado la suya', () => {
    expect(llaveBusquedas('u1')).not.toBe(llaveBusquedas('u2'));
    expect(llaveBusquedas(null)).toBe(llaveBusquedas(undefined));
    expect(llaveBusquedas(null)).toContain('invitado');
  });

  it('guarda y lee; con la lista vacía borra la llave', async () => {
    const { a, datos } = almacenEnMemoria();
    const k = llaveBusquedas('u1');
    await guardarBusquedas(a, k, ['pizza', 'sushi']);
    expect(await leerBusquedas(a, k)).toEqual(['pizza', 'sushi']);
    await guardarBusquedas(a, k, []);
    expect(datos.has(k)).toBe(false);
  });

  it('un valor roto en el teléfono no rompe la pantalla', async () => {
    const k = llaveBusquedas('u1');
    expect(await leerBusquedas(almacenEnMemoria({ [k]: '{no es json' }).a, k)).toEqual([]);
    expect(await leerBusquedas(almacenEnMemoria({ [k]: '{"a":1}' }).a, k)).toEqual([]);
    expect(await leerBusquedas(almacenEnMemoria({ [k]: '["ok", 3, "x"]' }).a, k)).toEqual(['ok']);
  });
});
