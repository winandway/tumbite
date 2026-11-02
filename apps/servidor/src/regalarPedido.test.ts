import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { avisoDeRegalo } from './rutas/pedidos';

/**
 * C-REGALAR-PEDIDO (2 nov 2026), como «Send as a gift» de DoorDash y Uber Eats: el cliente manda el
 * pedido a otra persona con su nombre, su celular y un mensaje. Se paga con el cobro normal; al
 * pagarse, quien recibe recibe un SMS con el mensaje y el enlace de seguimiento (sin dirección ni
 * dinero). El restaurante y el repartidor ven a quién entregar, nunca el celular. Todos los países.
 */
const TWILIO = {
  TWILIO_ACCOUNT_SID: 'AC_prueba',
  TWILIO_AUTH_TOKEN: 'token_prueba',
  TWILIO_FROM: '+18665550100',
  STRIPE_SECRET_KEY: 'sk_test_x',
  SITIO_URL: 'https://divoox.com',
};

describe('regalar un pedido', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function pedir(extra: Record<string, unknown>) {
    const sms: { To: string; Body: string }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (url.includes('twilio.com')) {
        sms.push(Object.fromEntries(new URLSearchParams(String(init?.body))) as never);
        return new Response('{"sid":"SM1"}', { status: 201 });
      }
      return /\/(payment_intents|customers|customer_sessions)/.test(url)
        ? new Response(JSON.stringify({ id: 'cs_1', client_secret: 'cs_1_secret_x' }), {
            status: 200,
          })
        : new Response('{}', { status: 404 });
    });
    const m = mundo(TWILIO);
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    const cliente = await m.cuenta('cliente', 'Rosa Pérez');
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
      { nombreEs: 'Pastel', precioCentavos: 1500 },
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
        ...extra,
      },
      cliente.token,
    );
    return { m, cliente, pedido, sms };
  }

  it('guarda a quién va, avisa con el seguimiento y no muestra el celular en las notas', async () => {
    const { m, cliente, pedido, sms } = await pedir({
      notas: 'Portón azul',
      paraOtro: { nombre: 'Ana', telefono: '(305) 555-0123', mensaje: '¡Feliz cumpleaños!' },
    });
    expect(pedido.estado).toBe(201);
    const id = pedido.datos.pedidoId as string;
    const visto = await m.llamar('GET', `/datos/pedidos/${id}`, undefined, cliente.token);
    expect(visto.datos.pedido.paraOtro).toEqual({
      nombre: 'Ana',
      telefono: '(305) 555-0123',
      mensaje: '¡Feliz cumpleaños!',
    });
    expect(visto.datos.pedido.notas).toBe('Portón azul · Regalo para Ana');
    expect(visto.datos.pedido.notas).not.toContain('555');

    expect(await avisoDeRegalo({ DB: m.DB, ...TWILIO } as never, m.DB, id)).toBe(true);
    expect(sms).toHaveLength(1);
    expect(sms[0]?.To).toBe('+13055550123');
    expect(sms[0]?.Body).toContain('Rosa sent you a gift');
    expect(sms[0]?.Body).toContain('“¡Feliz cumpleaños!”');
    expect(sms[0]?.Body).toMatch(/https:\/\/divoox\.com\/order-status\/[A-Za-z0-9_-]{40,}/);
    // El enlace funciona y no deja ver la dirección.
    const codigo = sms[0]!.Body.split('/order-status/')[1]!;
    const publico = await m.llamar('GET', `/datos/publico/pedido/${codigo}`);
    expect(publico.estado).toBe(200);
    expect(JSON.stringify(publico.datos)).not.toContain('Calle Prueba');
  });

  it('sin regalo no sale ningún SMS; un regalo para recoger o sin celular válido se rechaza', async () => {
    const normal = await pedir({});
    expect(
      await avisoDeRegalo(
        { DB: normal.m.DB, ...TWILIO } as never,
        normal.m.DB,
        normal.pedido.datos.pedidoId,
      ),
    ).toBe(false);
    expect(normal.sms).toHaveLength(0);
    const recoger = await pedir({
      entrega: 'recoger',
      paraOtro: { nombre: 'Ana', telefono: '3055550123' },
    });
    expect(recoger.pedido.estado).toBe(422);
    const sinCelular = await pedir({ paraOtro: { nombre: 'Ana', telefono: '12' } });
    expect(sinCelular.pedido.estado).toBe(400);
    const corto = await pedir({ paraOtro: { nombre: 'Ana', telefono: '555-0123' } });
    expect(corto.pedido.estado).toBe(422);
  });
});
