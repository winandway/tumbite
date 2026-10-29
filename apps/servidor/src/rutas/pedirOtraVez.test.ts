import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

// C-PEDIR-OTRA-VEZ en un restaurante: mismas opciones, precio de hoy, y lo quitado del menú aparte.
describe('C-PEDIR-OTRA-VEZ · restaurante', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('repite los platos con su precio de hoy y avisa el que ya no está', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      /\/(payment_intents|customers|customer_sessions)/.test(url)
        ? new Response(JSON.stringify({ id: 'pi_test_1', client_secret: 'pi_test_1_secret_x' }), {
            status: 200,
          })
        : new Response('{}', { status: 404 }),
    );
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PUBLISHABLE_KEY: 'pk_test_x' });
    const admin = await m.cuenta('admin');
    const dueno = await m.cuenta('restaurante');
    const cliente = await m.cuenta('cliente');
    const rid = (await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token))
      .datos.restaurante.id as string;
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${rid}`,
      { estado: 'aprobado' },
      admin.token,
    );
    const crear = async (nombreEs: string, precioCentavos: number) =>
      (
        await m.llamar(
          'POST',
          '/datos/mi-restaurante/platos',
          { nombreEs, precioCentavos },
          dueno.token,
        )
      ).datos.plato.id as string;
    const cubano = await crear('Cubano', 1500);
    const flan = await crear('Flan', 500);
    await m.abrir(dueno.token);
    const r = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [
          { platoId: cubano, cantidad: 2 },
          { platoId: flan, cantidad: 1 },
        ],
        propinaCentavos: 0,
        direccion: '300 Calle Prueba',
        lat: 25.775,
        lng: -80.195,
      },
      cliente.token,
    );
    expect(r.estado).toBe(201);
    await m.DB.prepare('UPDATE platos SET precio_centavos = 1600 WHERE id = ?').bind(cubano).run();
    await m.DB.prepare('UPDATE platos SET disponible = 0 WHERE id = ?').bind(flan).run();
    const rep = await m.llamar(
      'GET',
      `/datos/pedidos/${r.datos.pedidoId}/repetir`,
      undefined,
      cliente.token,
    );
    expect(rep.estado).toBe(200);
    expect(rep.datos.restaurante).toMatchObject({ id: rid, esTienda: false });
    expect(rep.datos.lineas).toEqual([
      expect.objectContaining({ platoId: cubano, cantidad: 2, precioCentavos: 1600, opciones: [] }),
    ]);
    expect(rep.datos.faltan).toEqual([{ nombreEs: 'Flan', nombreEn: expect.any(String) }]);
  });
});
