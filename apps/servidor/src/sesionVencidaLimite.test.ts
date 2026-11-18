import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';

/**
 * C-SESION-TERMINADA (18 nov 2026, defensa en el servidor): un Driver de la versión vieja con la
 * sesión vencida preguntaba sin pausa. Tras varios 401 seguidos desde la misma IP con una llave que
 * no sirve, las rutas del conductor responden 429 (sin tocar la base ni la ruta). Quien tiene sesión
 * buena, aunque comparta IP, nunca se frena.
 */
const IP = '10.77.1.9';
const pedir = (m: ReturnType<typeof mundo>, token: string) =>
  m.crudo('/datos/repartidor/estado', {
    headers: { authorization: `Bearer ${token}`, 'cf-connecting-ip': IP },
  });

describe('las llaves vencidas no martillan las rutas del conductor', () => {
  it('tras 20 respuestas 401 seguidas desde la misma IP, 429 con Retry-After', async () => {
    const m = mundo();
    const estados: number[] = [];
    for (let i = 0; i < 25; i++) estados.push((await pedir(m, 'llave-vencida')).status);
    expect(estados.slice(0, 20).every((e) => e === 401)).toBe(true);
    expect(estados.slice(20).every((e) => e === 429)).toBe(true);
    const r = await pedir(m, 'llave-vencida');
    expect(r.headers.get('retry-after')).toBeTruthy();
  });
  it('quien tiene sesión buena desde la misma IP sigue entrando', async () => {
    const m = mundo();
    const rep = await m.cuenta('repartidor');
    for (let i = 0; i < 25; i++) await pedir(m, 'llave-vencida');
    expect((await pedir(m, rep.token)).status).toBe(200);
  });
});
