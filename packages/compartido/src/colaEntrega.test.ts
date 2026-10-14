import { describe, expect, it } from 'vitest';
import { ErrorApi } from './api';
import { crearCola, esFalloDeRed } from './colaEntrega';

const memoria = () => {
  let v: string | null = null;
  return { leer: async () => v, escribir: async (x: string) => void (v = x) };
};

describe('cola sin señal del repartidor (C-COLA-SIN-RED)', () => {
  it('guarda la entrega sin red y la manda sola cuando vuelve', async () => {
    const cola = crearCola(memoria());
    await cola.agregar({ ruta: '/datos/x/entregado?lat=1&lng=2', tipo: 'foto', cuerpo: 'data:x' });
    expect(await cola.listar()).toHaveLength(1);
    let red = false;
    const enviar = async () => {
      if (!red) throw new ErrorApi('Sin conexión', 0);
    };
    expect((await cola.reintentar(enviar)).enviados).toHaveLength(0);
    expect(await cola.listar()).toHaveLength(1); // sigue guardada
    red = true;
    expect((await cola.reintentar(enviar)).enviados).toHaveLength(1);
    expect(await cola.listar()).toHaveLength(0);
  });
  it('lo que el servidor rechaza sale de la cola con su motivo', async () => {
    const cola = crearCola(memoria());
    await cola.agregar({ ruta: '/a', tipo: 'json', cuerpo: '{}' });
    const r = await cola.reintentar(async () => {
      throw new ErrorApi('Todavía no llegas', 409);
    });
    expect(r.rechazados[0]?.error).toBe('Todavía no llegas');
    expect(await cola.listar()).toHaveLength(0);
  });
  it('distingue «sin red» de un rechazo', () => {
    expect(esFalloDeRed(new ErrorApi('x', 0))).toBe(true);
    expect(esFalloDeRed(new ErrorApi('x', 409))).toBe(false);
    expect(esFalloDeRed(new Error('x'))).toBe(false);
  });
  it('un almacén roto no tumba la app', async () => {
    const cola = crearCola({ leer: async () => '{no es json', escribir: async () => undefined });
    expect(await cola.listar()).toEqual([]);
  });
});
