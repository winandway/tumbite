import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cierreUnico, crearSondeo, reanudarSondeos } from './sondeo';

/**
 * C-SESION-TERMINADA (revisor, 18 nov): pruebas de COMPORTAMIENTO del sondeo con relojes de mentira:
 * espera creciente, vuelta a la normalidad con el primer éxito, reanudación inmediata al volver la
 * app o la red, y tope corto para lo crítico.
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const cuantas = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.length;

describe('el motor del sondeo', () => {
  it('pregunta cada 5 s mientras sale bien', async () => {
    const fn = vi.fn(async () => true);
    const s = crearSondeo({ fn, cadaMs: 5_000 });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(cuantas(fn)).toBe(13);
    s.detener();
  });
  it('si falla, espera cada vez más: en un minuto con 401, pocas llamadas', async () => {
    const fn = vi.fn(async () => false);
    const s = crearSondeo({ fn, cadaMs: 5_000 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(cuantas(fn)).toBeLessThanOrEqual(4);
    s.detener();
  });
  it('con el primer éxito vuelve a su intervalo', async () => {
    let ok = false;
    const fn = vi.fn(async () => ok);
    const s = crearSondeo({ fn, cadaMs: 5_000 });
    await vi.advanceTimersByTimeAsync(40_000);
    expect(s.fallos()).toBeGreaterThan(0);
    ok = true;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(s.fallos()).toBe(0);
    const antes = cuantas(fn);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(cuantas(fn)).toBe(antes + 1);
    s.detener();
  });
  it('lo crítico nunca espera más de 20 s', async () => {
    const fn = vi.fn(async () => false);
    const s = crearSondeo({ fn, cadaMs: 5_000, topeMs: 20_000 });
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    const antes = cuantas(fn);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(cuantas(fn)).toBe(antes + 1);
    s.detener();
  });
  it('al volver la app o la red, los que fallaban preguntan YA', async () => {
    let ok = false;
    const fn = vi.fn(async () => ok);
    const s = crearSondeo({ fn, cadaMs: 5_000 });
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(s.fallos()).toBeGreaterThan(3);
    ok = true;
    const antes = cuantas(fn);
    reanudarSondeos();
    await vi.advanceTimersByTimeAsync(0);
    expect(cuantas(fn)).toBe(antes + 1);
    expect(s.fallos()).toBe(0);
    s.detener();
  });
  it('detenido, no pregunta más', async () => {
    const fn = vi.fn(async () => true);
    const s = crearSondeo({ fn, cadaMs: 5_000 });
    await vi.advanceTimersByTimeAsync(0);
    s.detener();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(cuantas(fn)).toBe(1);
  });
});

describe('varios 401 a la vez cierran la sesión una sola vez', () => {
  it('cinco respuestas con la misma llave: un cierre; con otra llave, otro', async () => {
    const cerrar = vi.fn();
    const al401 = cierreUnico(cerrar);
    await Promise.all([1, 2, 3, 4, 5].map(async () => al401('llave-a')));
    expect(cerrar).toHaveBeenCalledTimes(1);
    al401('llave-b');
    expect(cerrar).toHaveBeenCalledTimes(2);
  });
});

describe('al volver la red solo despiertan los que fallaron por la red (revisor, 18 nov)', () => {
  it('uno que falla por otra causa (500) sigue con su espera; uno sin red pregunta ya', async () => {
    const { avisarRed } = await import('./sondeo');
    const otraCausa = vi.fn(async () => false);
    const sinRed = vi.fn(async () => false);
    avisarRed(true);
    const a = crearSondeo({ fn: otraCausa, cadaMs: 60_000 });
    await vi.advanceTimersByTimeAsync(0);
    avisarRed(false);
    const b = crearSondeo({ fn: sinRed, cadaMs: 60_000 });
    await vi.advanceTimersByTimeAsync(0);
    const antesA = cuantas(otraCausa);
    const antesB = cuantas(sinRed);
    avisarRed(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(cuantas(sinRed)).toBe(antesB + 1);
    expect(cuantas(otraCausa)).toBe(antesA);
    a.detener();
    b.detener();
  });
  it('avisa en la consola cuando una vuelta falla', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const s = crearSondeo({
      fn: async () => {
        throw new Error('caída');
      },
      cadaMs: 5_000,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
    s.detener();
  });
});
