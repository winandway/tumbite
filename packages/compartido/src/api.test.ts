import { describe, expect, it } from 'vitest';
import { ErrorApi, crearApi } from './api';

describe('cliente del servidor', () => {
  it('una respuesta que nunca llega se corta a tiempo y se cuenta como sin conexión', async () => {
    // Candado C-PEDIDO-CON-LIMITE: en el sitio de pruebas una petición quedó sin respuesta y la
    // pantalla del panel se quedó cargando para siempre.
    const api = crearApi({
      base: '',
      idioma: () => 'es',
      tiempoMs: 30,
      fetch: (_u, init) =>
        new Promise((_ok, falla) => {
          init?.signal?.addEventListener('abort', () => falla(new Error('abortado')));
        }),
    });
    await expect(api.pedir('GET', '/datos/lento')).rejects.toMatchObject({ estado: 0 });
  });

  // C-LECTURA-REINTENTO (30 oct 2026, hallado con REA): en el sitio de pruebas una sola petición de
  // lectura se perdía y la pantalla del caso de dinero se quedaba en «…»; ahora se repite una vez.
  it('una lectura que no responde se repite sola una vez y entrega los datos', async () => {
    let llamadas = 0;
    const api = crearApi({
      base: '',
      tiempoMs: 30,
      fetch: (_u, init) => {
        llamadas++;
        if (llamadas === 1)
          return new Promise((_ok, falla) => {
            init?.signal?.addEventListener('abort', () => falla(new Error('abortado')));
          });
        return Promise.resolve(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
      },
    });
    await expect(api.pedir('GET', '/datos/caso')).resolves.toEqual({ ok: 1 });
    expect(llamadas).toBe(2);
  });

  it('un envío que no responde NO se repite (no se duplica la acción)', async () => {
    let llamadas = 0;
    const api = crearApi({
      base: '',
      tiempoMs: 30,
      fetch: (_u, init) => {
        llamadas++;
        return new Promise((_ok, falla) => {
          init?.signal?.addEventListener('abort', () => falla(new Error('abortado')));
        });
      },
    });
    await expect(api.pedir('POST', '/datos/accion', {})).rejects.toMatchObject({ estado: 0 });
    expect(llamadas).toBe(1);
  });

  it('una lectura que responde con error no se repite', async () => {
    let llamadas = 0;
    const api = crearApi({
      base: '',
      fetch: async () => {
        llamadas++;
        return new Response(JSON.stringify({ error: 'No' }), { status: 500 });
      },
    });
    await expect(api.pedir('GET', '/datos/x')).rejects.toMatchObject({ estado: 500 });
    expect(llamadas).toBe(1);
  });

  it('manda el token y devuelve los datos', async () => {
    let cabecera = '';
    const api = crearApi({
      base: 'https://x.test',
      token: () => 'abc',
      fetch: async (_url, init) => {
        cabecera = String((init?.headers as Record<string, string>).authorization);
        return new Response(JSON.stringify({ usuario: { id: '1' } }), { status: 200 });
      },
    });
    const r = await api.yo();
    expect(r.usuario.id).toBe('1');
    expect(cabecera).toBe('Bearer abc');
  });

  it('las apps (con token) no mandan la cookie del navegador; el panel (sin token) sí', async () => {
    // Candado C-SESION-APP: en la web la app y el panel comparten sitio; la cookie del panel
    // cambiaba de persona a la app del cliente.
    const vistas: (string | undefined)[] = [];
    const responder = async (_u: unknown, init?: RequestInit) => {
      vistas.push(init?.credentials);
      return new Response(JSON.stringify({ usuario: { id: '1' } }), { status: 200 });
    };
    await crearApi({ base: '', token: () => 'abc', fetch: responder }).yo();
    await crearApi({ base: '', token: () => null, fetch: responder }).yo();
    await crearApi({ base: '', fetch: responder }).yo();
    expect(vistas).toEqual(['omit', 'omit', 'include']);
  });

  it('convierte los errores del servidor en mensajes claros con su campo', async () => {
    const api = crearApi({
      base: '',
      fetch: async () =>
        new Response(JSON.stringify({ error: 'Ya existe', campo: 'correo' }), { status: 409 }),
    });
    await expect(api.entrar({ correo: 'a@b.com', clave: 'x' })).rejects.toMatchObject({
      estado: 409,
      campo: 'correo',
    });
  });

  it('sin internet avisa que lo escrito sigue ahí', async () => {
    const api = crearApi({ base: '', fetch: async () => Promise.reject(new TypeError('red')) });
    const e = await api.salir().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErrorApi);
    expect((e as ErrorApi).sinConexion).toBe(true);
    expect((e as ErrorApi).message).toContain('sigue aquí');
  });

  it('una respuesta rota no explota', async () => {
    const api = crearApi({ base: '', fetch: async () => new Response('no json', { status: 500 }) });
    await expect(api.yo()).rejects.toMatchObject({ estado: 500 });
  });
});
