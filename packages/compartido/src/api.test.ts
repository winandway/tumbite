import { describe, expect, it } from 'vitest';
import { ErrorApi, crearApi } from './api';

describe('cliente del servidor', () => {
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
