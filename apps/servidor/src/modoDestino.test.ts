import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * C-MODO-DESTINO (BRE-6, 2 nov 2026), como «Driver Destinations» de Uber: el repartidor pone su
 * destino y, hasta dos veces al día, solo recibe ofertas cuya entrega lo acerca. Se apaga al
 * llegar o a mano. Todos los países.
 */
afterEach(() => vi.unstubAllGlobals());

const CASA = { direccion: '900 Calle del Norte, Miami, FL', lat: 25.9, lng: -80.2 };
const AQUI = { lat: 25.771, lng: -80.191 };

async function escena() {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(JSON.stringify({ id: 'pi_x', client_secret: 'pi_x_s' }), { status: 200 }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
  const plato = await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Cubano', precioCentavos: 1500 },
    dueno.token,
  );
  await m.abrir(dueno.token);
  const rep = await m.cuenta('repartidor', 'Dora Destino');
  await m.llamar('POST', '/datos/repartidor/conectar', { conectado: true, ...AQUI }, rep.token);
  /** Un pedido pagado y aceptado que se entrega en ese punto. */
  async function pedidoHacia(lat: number, lng: number) {
    const p = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 1 }],
        propinaCentavos: 300,
        direccion: '300 Calle Prueba',
        lat,
        lng,
      },
      cliente.token,
    );
    const id = p.datos.pedidoId as string;
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
    )
      .bind(id)
      .run();
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
    return id;
  }
  const ofertas = async () =>
    (await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token)).datos.ofertas as {
      pedidoId?: string;
      id?: string;
    }[];
  const destino = (metodo: 'GET' | 'PUT' | 'DELETE', cuerpo?: unknown, token = rep.token) =>
    m.llamar(metodo, '/datos/repartidor/destino', cuerpo, token);
  return { m, rep, cliente, pedidoHacia, ofertas, destino };
}

const idDe = (o: { pedidoId?: string; id?: string }) => o.pedidoId ?? o.id;

describe('modo destino del repartidor (C-MODO-DESTINO)', () => {
  it('apagado recibe todo; encendido solo lo que lo acerca a su destino', async () => {
    const e = await escena();
    expect((await e.destino('GET')).datos).toMatchObject({ activo: false, usosRestantes: 2 });
    const sur = await e.pedidoHacia(25.74, -80.2);
    // Con el modo encendido, el pedido que va al sur no le llega.
    const on = await e.destino('PUT', CASA);
    expect(on.estado).toBe(200);
    expect(on.datos).toMatchObject({ activo: true, usosRestantes: 1, direccion: CASA.direccion });
    expect((await e.ofertas()).map(idDe)).not.toContain(sur);
    // El que va hacia su casa, sí.
    const norte = await e.pedidoHacia(25.8, -80.2);
    expect((await e.ofertas()).map(idDe)).toContain(norte);
  });

  it('dos veces al día; la tercera no; apagar a mano no devuelve el uso', async () => {
    const e = await escena();
    expect((await e.destino('PUT', CASA)).estado).toBe(200);
    expect((await e.destino('DELETE')).datos).toMatchObject({ activo: false, usosRestantes: 1 });
    expect((await e.destino('PUT', CASA)).datos.usosRestantes).toBe(0);
    await e.destino('DELETE');
    const tercera = await e.destino('PUT', CASA);
    expect(tercera.estado).toBe(409);
    expect(tercera.datos.error).toMatch(/dos veces|twice/);
    // Ayer no cuenta.
    await e.m.DB.prepare("UPDATE usos_modo_destino SET dia = '2020-01-01'").run();
    expect((await e.destino('PUT', CASA)).estado).toBe(200);
  });

  it('se apaga solo al llegar', async () => {
    const e = await escena();
    await e.destino('PUT', CASA);
    await e.m.envejecerGps('x');
    await e.m.ubicar(e.rep.token, { lat: 25.85, lng: -80.2 });
    expect((await e.destino('GET')).datos.activo).toBe(true);
    await e.m.DB.prepare(
      "UPDATE ubicaciones_recientes SET creado_en = datetime(creado_en, '-600 seconds')",
    ).run();
    await e.m.ubicar(e.rep.token, { lat: 25.9015, lng: -80.2 });
    expect((await e.destino('GET')).datos).toMatchObject({ activo: false, motivo: 'llegada' });
  });

  it('pide una dirección con coordenadas y solo lo usa un repartidor', async () => {
    const e = await escena();
    expect((await e.destino('PUT', { direccion: 'Casa', lat: 200, lng: 0 })).estado).toBe(400);
    expect((await e.destino('PUT', CASA, e.cliente.token)).estado).toBe(403);
  });

  it('la app de Driver usa la casilla de direcciones con sugerencias', () => {
    const raiz = join(__dirname, '..', '..', '..');
    const app = readFileSync(join(raiz, 'apps/repartidor/src/piezas/ModoDestino.tsx'), 'utf8');
    expect(app).toContain('CampoDireccion');
    expect(app).toContain('/datos/repartidor/destino');
    expect(readFileSync(join(raiz, 'apps/repartidor/src/Inicio.tsx'), 'utf8')).toContain(
      '<ModoDestino',
    );
  });
});
