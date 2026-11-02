import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * C-ALERGIAS (2 nov 2026), como «Allergy requests» de Uber Eats: el cliente escribe sus alergias en
 * una casilla aparte de las indicaciones; el pedido las guarda y las devuelve para que el
 * restaurante las vea resaltadas y en el ticket. Todos los países.
 */
describe('pedido de alergias', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function pedir(extra: Record<string, unknown>) {
    vi.stubGlobal('fetch', async (url: string) =>
      /\/(payment_intents|customers|customer_sessions)/.test(url)
        ? new Response(JSON.stringify({ id: 'cs_1', client_secret: 'cs_1_secret_x' }), {
            status: 200,
          })
        : new Response('{}', { status: 404 }),
    );
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_prueba' });
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    const cliente = await m.cuenta('cliente');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const rid = r.datos.restaurante.id as string;
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${rid}`,
      { estado: 'aprobado' },
      admin.token,
    );
    const plato = await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Pad thai', precioCentavos: 1500 },
      dueno.token,
    );
    await m.abrir(dueno.token);
    const pedido = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 1 }],
        propinaCentavos: 200,
        direccion: '200 Calle Prueba, Miami',
        notas: 'Tocar el timbre',
        ...extra,
      },
      cliente.token,
    );
    return { m, cliente, pedido };
  }

  it('se guarda aparte de las notas y vuelve en el pedido', async () => {
    const { m, cliente, pedido } = await pedir({ alergias: '  Maní   y  mariscos ' });
    expect(pedido.estado).toBe(201);
    const id = pedido.datos.pedidoId as string;
    const fila = await m.DB.prepare('SELECT notas, alergias FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ notas: string; alergias: string }>();
    expect(fila).toEqual({ notas: 'Tocar el timbre', alergias: 'Maní y mariscos' });
    const visto = await m.llamar('GET', `/datos/pedidos/${id}`, undefined, cliente.token);
    expect(visto.datos.pedido.alergias).toBe('Maní y mariscos');
  });

  it('sin alergias queda vacío y una demasiado larga se rechaza', async () => {
    const sin = await pedir({});
    const fila = await sin.m.DB.prepare('SELECT alergias FROM pedidos WHERE id = ?')
      .bind(sin.pedido.datos.pedidoId)
      .first<{ alergias: string }>();
    expect(fila?.alergias).toBe('');
    const larga = await pedir({ alergias: 'x'.repeat(201) });
    expect(larga.pedido.estado).toBe(400);
  });
});
