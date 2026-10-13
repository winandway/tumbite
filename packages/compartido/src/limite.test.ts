import { describe, expect, it, vi } from 'vitest';
import { conLimite } from './limite';

describe('conLimite: nada se queda esperando para siempre', () => {
  it('devuelve el valor si llega a tiempo', async () => {
    await expect(conLimite(Promise.resolve(5), 100, 0)).resolves.toBe(5);
  });
  it('si no contesta nunca, sigue con el valor de reemplazo', async () => {
    vi.useFakeTimers();
    const r = conLimite(new Promise<number>(() => {}), 8000, -1);
    vi.advanceTimersByTime(8000);
    await expect(r).resolves.toBe(-1);
    vi.useRealTimers();
  });
  it('si falla, también sigue con el valor de reemplazo', async () => {
    await expect(conLimite(Promise.reject(new Error('x')), 100, 7)).resolves.toBe(7);
  });
});
