import { describe, expect, it, vi } from 'vitest';
import { crearApi } from './api';
import { ESPERA_MAXIMA_SONDEO_MS, esperaSondeo } from './sondeo';

/**
 * C-SESION-TERMINADA (18 nov 2026, ANR de Driver en el emulador): con la sesión vencida (401) y el
 * conductor conectado, la app seguía con todos sus sondeos, la ubicación de fondo y la pantalla
 * «Conectado a 2 servicios» con «Tu sesión terminó», hasta que Android la dio por colgada.
 * La API avisa UNA vez que la sesión terminó; los sondeos que fallan esperan cada vez más.
 */
const respuesta = (estado: number) =>
  new Response(
    JSON.stringify(
      estado === 200 ? { ok: true } : { error: 'Tu sesión terminó. Vuelve a entrar.' },
    ),
    {
      status: estado,
      headers: { 'content-type': 'application/json' },
    },
  );

describe('la API avisa cuando la sesión terminó', () => {
  it('un 401 con sesión avisa (y sigue lanzando el error de siempre)', async () => {
    const aviso = vi.fn();
    const api = crearApi({
      base: 'http://x',
      token: () => 'pase-vencido',
      alSesionTerminada: aviso,
      fetch: async () => respuesta(401),
    });
    await expect(api.pedir('GET', '/datos/repartidor/estado')).rejects.toMatchObject({
      estado: 401,
    });
    expect(aviso).toHaveBeenCalledTimes(1);
  });
  it('sin sesión (entrar con la clave equivocada) no avisa', async () => {
    const aviso = vi.fn();
    const api = crearApi({
      base: 'http://x',
      token: () => null,
      alSesionTerminada: aviso,
      fetch: async () => respuesta(401),
    });
    await expect(api.pedir('POST', '/datos/cuentas/entrar', {})).rejects.toBeTruthy();
    expect(aviso).not.toHaveBeenCalled();
  });
  it('un 401 que no es de sesión (contraseña mal escrita en un servidor viejo, llave de API) no avisa', async () => {
    const aviso = vi.fn();
    const api = crearApi({
      base: 'http://x',
      token: () => 't',
      alSesionTerminada: aviso,
      fetch: async () =>
        new Response(
          JSON.stringify({ error: 'La contraseña actual no es correcta.', campo: 'actual' }),
          {
            status: 401,
          },
        ),
    });
    await expect(api.pedir('POST', '/datos/cuentas/clave', {})).rejects.toBeTruthy();
    expect(aviso).not.toHaveBeenCalled();
  });
  it('con la marca nueva del servidor (código o cabecera) avisa', async () => {
    const aviso = vi.fn();
    const api = crearApi({
      base: 'http://x',
      token: () => 't',
      alSesionTerminada: aviso,
      fetch: async () =>
        new Response(JSON.stringify({ error: 'Session ended.', codigo: 'sesion_terminada' }), {
          status: 401,
          headers: { 'x-sesion': 'terminada' },
        }),
    });
    await expect(api.pedir('GET', '/datos/x')).rejects.toBeTruthy();
    expect(aviso).toHaveBeenCalledTimes(1);
  });
  it('otros errores no avisan', async () => {
    const aviso = vi.fn();
    const api = crearApi({
      base: 'http://x',
      token: () => 't',
      alSesionTerminada: aviso,
      fetch: async () => respuesta(500),
    });
    await expect(api.pedir('GET', '/datos/x')).rejects.toBeTruthy();
    expect(aviso).not.toHaveBeenCalled();
  });
});

describe('un sondeo que falla espera cada vez más', () => {
  it('sin fallos, su intervalo; con fallos, el doble cada vez, hasta el tope', () => {
    expect(esperaSondeo(5_000, 0)).toBe(5_000);
    expect(esperaSondeo(5_000, 1)).toBe(10_000);
    expect(esperaSondeo(5_000, 2)).toBe(20_000);
    expect(esperaSondeo(5_000, 50)).toBe(ESPERA_MAXIMA_SONDEO_MS);
    expect(esperaSondeo(300_000, 3)).toBe(300_000);
  });
  it('en un minuto respondiendo 401, un sondeo de 5 s llama pocas veces (no 12 ni sin pausa)', () => {
    let t = 0;
    let llamadas = 0;
    let fallos = 0;
    while (t < 60_000) {
      llamadas++;
      fallos++;
      t += esperaSondeo(5_000, fallos);
    }
    expect(llamadas).toBeLessThanOrEqual(4);
  });
});
