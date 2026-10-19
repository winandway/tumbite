import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorApi } from './api';
import { confirmarSesion } from './confirmarSesion';

/**
 * C-SESION-CON-LIMITE (hito 1 del cliente; docs/incidencias/2026-10-16-pantalla-de-carga.md): la
 * comprobación de la sesión guardada nunca deja la app colgada en la pantalla de carga.
 */
afterEach(() => vi.useRealTimers());
const usuario = { id: 'u1', nombre: 'Ana', rol: 'cliente' } as never;

describe('confirmar la sesión guardada', () => {
  it('si el servidor nunca responde, a los 8 s queda «sin confirmar» por tiempo (no se queda cargando)', async () => {
    vi.useFakeTimers();
    const r = confirmarSesion(() => new Promise(() => {}), 8000);
    await vi.advanceTimersByTimeAsync(8000);
    await expect(r).resolves.toEqual({ estado: 'sin_confirmar', motivo: 'tiempo' });
  });

  it('una respuesta lenta pero válida (3 s) confirma la sesión', async () => {
    vi.useFakeTimers();
    const r = confirmarSesion(
      () => new Promise((ok) => setTimeout(() => ok({ usuario }), 3000)),
      8000,
    );
    await vi.advanceTimersByTimeAsync(3000);
    await expect(r).resolves.toEqual({ estado: 'valida', usuario });
  });

  it('un error de red queda «sin confirmar» por red (la sesión guardada no se da por mala)', async () => {
    const r = await confirmarSesion(() => Promise.reject(new ErrorApi('Sin conexión', 0)), 8000);
    expect(r).toEqual({ estado: 'sin_confirmar', motivo: 'red' });
  });

  it('un fallo del servidor (5xx) queda «sin confirmar», no invalida la sesión', async () => {
    const r = await confirmarSesion(
      () => Promise.reject(new ErrorApi('Algo salió mal', 503)),
      8000,
    );
    expect(r).toEqual({ estado: 'sin_confirmar', motivo: 'servidor' });
  });

  it('una sesión que el servidor rechaza (401) es inválida', async () => {
    const r = await confirmarSesion(() => Promise.reject(new ErrorApi('Inicia sesión', 401)), 8000);
    expect(r).toEqual({ estado: 'invalida' });
  });

  it('un error cualquiera (no del servidor) cuenta como sin conexión', async () => {
    const r = await confirmarSesion(() => Promise.reject(new TypeError('fetch failed')), 8000);
    expect(r).toEqual({ estado: 'sin_confirmar', motivo: 'red' });
  });
});

describe('reintentos al confirmar la sesión (C-SESION-REINTENTA)', () => {
  it('un corte puntual se reintenta solo; un 401 no se reintenta; tres cortes siguen sin confirmar', async () => {
    const { confirmarSesionConReintentos } = await import('./confirmarSesion');
    const { ErrorApi } = await import('./api');
    const sinEspera = async () => undefined;
    const usuario = { id: 'u1', nombre: 'Ana', correo: 'a@ejemplo.com', rol: 'cliente' } as never;
    let n = 0;
    const unCorte = async () => {
      n++;
      if (n === 1) throw new TypeError('fetch failed');
      return { usuario };
    };
    expect((await confirmarSesionConReintentos(unCorte, [1, 1], 1000, sinEspera)).estado).toBe(
      'valida',
    );
    expect(n).toBe(2);
    let m = 0;
    const vencida = async () => {
      m++;
      throw new ErrorApi('No', 401);
    };
    expect((await confirmarSesionConReintentos(vencida, [1, 1], 1000, sinEspera)).estado).toBe(
      'invalida',
    );
    expect(m).toBe(1);
    const caido = async () => {
      throw new TypeError('fetch failed');
    };
    expect(await confirmarSesionConReintentos(caido, [1, 1], 1000, sinEspera)).toEqual({
      estado: 'sin_confirmar',
      motivo: 'red',
    });
  });
});

it('las apps confirman la sesión con reintentos (C-SESION-REINTENTA)', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const sesion = readFileSync(join(__dirname, '..', '..', 'movil', 'src', 'sesion.tsx'), 'utf8');
  expect(sesion).toContain('await confirmarSesionConReintentos(');
});
