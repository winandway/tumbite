import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

/** LAN-3y: el restaurante recibe el nombre corto del cliente para la comanda, nunca el completo. */
afterEach(() => vi.unstubAllGlobals());

describe('LAN-3y · nombre corto del cliente para la comanda', () => {
  it('GET /restaurante/pedidos trae «Ana G.», no «García López»', async () => {
    vi.stubGlobal('fetch', async () =>
      Response.json({ id: 'pi_1', client_secret: 'x', status: 'requires_capture' }),
    );
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    const cliente = await m.cuenta('cliente', 'Ana García López');
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
      { nombreEs: 'Cubano', precioCentavos: 1500 },
      dueno.token,
    );
    await m.abrir(dueno.token);
    const p = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 1 }],
        propinaCentavos: 0,
        direccion: '300 Calle Prueba',
        lat: 25.78,
        lng: -80.2,
      },
      cliente.token,
    );
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
    )
      .bind(p.datos.pedidoId)
      .run();
    const l = await m.llamar('GET', '/datos/restaurante/pedidos', undefined, dueno.token);
    const pedido = (l.datos.pedidos as { id: string; clienteCorto?: string }[]).find(
      (x) => x.id === p.datos.pedidoId,
    )!;
    expect(pedido.clienteCorto).toBe('Ana G.');
    expect(JSON.stringify(l.datos)).not.toMatch(/García|López/);
  });
});
