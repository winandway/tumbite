import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

/** Auditoría final, puntos 14 y 15: direcciones guardadas y cupones reales (C-CUPONES-DIRECCIONES). */
async function escenario() {
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
  const pedir = (extra: Record<string, unknown> = {}, token = cliente.token) =>
    m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 2 }],
        propinaCentavos: 300,
        direccion: '300 Calle Prueba',
        lat: 25.775,
        lng: -80.195,
        ...extra,
      },
      token,
    );
  return { m, admin, cliente, rid, pedir };
}

describe('cupones reales (C-CUPONES-DIRECCIONES)', () => {
  it('el superadmin crea un cupón, el cliente lo valida y el pedido lo descuenta de la ganancia de Tumbite, nunca del restaurante ni del repartidor', async () => {
    const e = await escenario();
    const creado = await e.m.llamar(
      'POST',
      '/datos/admin/cupones',
      {
        codigo: 'hola5',
        tipo: 'monto',
        valor: 500,
        descripcionEs: '5 dólares de regalo',
        descripcionEn: '$5 off',
        destacado: true,
      },
      e.admin.token,
    );
    expect(creado.estado).toBe(201);
    expect(creado.datos.cupon.codigo).toBe('HOLA5');
    expect(
      (
        await e.m.llamar(
          'POST',
          '/datos/admin/cupones',
          { codigo: 'HOLA5', tipo: 'monto', valor: 100 },
          e.admin.token,
        )
      ).estado,
    ).toBe(409);
    const v = await e.m.llamar(
      'POST',
      '/datos/cupones/validar',
      { codigo: 'hola 5', restauranteId: e.rid, subtotal: 3000 },
      e.cliente.token,
    );
    expect(v.estado).toBe(200);
    expect(v.datos.descuento).toBe(500);
    const sin = await e.pedir();
    const con = await e.pedir({ cupon: 'HOLA5' });
    expect(con.estado).toBe(201);
    expect(con.datos.desglose.descuento).toBe(500);
    expect(con.datos.desglose.totalCliente).toBe(sin.datos.desglose.totalCliente - 500);
    expect(con.datos.desglose.pagoRestaurante).toBe(sin.datos.desglose.pagoRestaurante);
    expect(con.datos.desglose.pagoRepartidor).toBe(sin.datos.desglose.pagoRepartidor);
    expect(con.datos.desglose.gananciaPlataforma).toBe(sin.datos.desglose.gananciaPlataforma - 500);
    const f = await e.m.DB.prepare('SELECT cupon, descuento FROM pedidos WHERE id = ?')
      .bind(con.datos.pedidoId)
      .first<{ cupon: string; descuento: number }>();
    expect(f).toEqual({ cupon: 'HOLA5', descuento: 500 });
    // Un uso por cliente: la segunda vez no vale. El destacado sale en la ruta pública.
    expect((await e.pedir({ cupon: 'HOLA5' })).estado).toBe(409);
    const dest = await e.m.llamar('GET', '/datos/cupones/destacados', undefined, e.cliente.token);
    expect(dest.datos.cupones.map((c: { codigo: string }) => c.codigo)).toEqual(['HOLA5']);
    const lista = await e.m.llamar('GET', '/datos/admin/cupones', undefined, e.admin.token);
    expect(lista.datos.cupones[0]).toMatchObject({ codigo: 'HOLA5', usos: 1, descontado: 500 });
    await e.m.llamar('PATCH', '/datos/admin/cupones/HOLA5', { activo: false }, e.admin.token);
    expect(
      (
        await e.m.llamar(
          'POST',
          '/datos/cupones/validar',
          { codigo: 'HOLA5', restauranteId: e.rid, subtotal: 3000 },
          e.cliente.token,
        )
      ).estado,
    ).toBe(409);
  });

  it('reglas: mínimo, porcentaje, envío gratis, vencido, solo primer pedido y tope de usos', async () => {
    const e = await escenario();
    const crear = (c: Record<string, unknown>) =>
      e.m.llamar('POST', '/datos/admin/cupones', c, e.admin.token);
    await crear({ codigo: 'MIN50', tipo: 'porcentaje', valor: 1000, minimoSubtotal: 5000 });
    await crear({ codigo: 'DIEZ', tipo: 'porcentaje', valor: 1000 });
    await crear({ codigo: 'ENVIO', tipo: 'envio_gratis' });
    await crear({ codigo: 'VIEJO', tipo: 'monto', valor: 100, venceEn: '2020-01-01 00:00:00' });
    await crear({ codigo: 'PRIMERO', tipo: 'monto', valor: 100, soloPrimerPedido: true });
    await crear({ codigo: 'UNO', tipo: 'monto', valor: 100, usosMax: 1, usosPorCliente: 5 });
    const validar = (codigo: string, subtotal = 3000) =>
      e.m.llamar(
        'POST',
        '/datos/cupones/validar',
        { codigo, restauranteId: e.rid, subtotal, envio: 399 },
        e.cliente.token,
      );
    expect((await validar('MIN50')).estado).toBe(409);
    expect((await validar('MIN50', 6000)).datos.descuento).toBe(600);
    expect((await validar('DIEZ')).datos.descuento).toBe(300);
    expect((await validar('ENVIO')).datos.descuento).toBe(399);
    expect((await validar('VIEJO')).datos.error).toMatch(/venció|expired/);
    expect((await validar('PRIMERO')).estado).toBe(200);
    await e.pedir();
    await e.m.DB.prepare("UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now')").run();
    expect((await validar('PRIMERO')).datos.error).toMatch(/primer pedido|first order/);
    const otro = await e.m.cuenta('cliente', 'Otro');
    expect((await e.pedir({ cupon: 'UNO' }, otro.token)).estado).toBe(201);
    expect((await validar('UNO')).datos.error).toMatch(/agotó|run out/);
    // Envío gratis en un pedido: el descuento es el envío y el repartidor cobra igual.
    const sinC = await e.pedir();
    const conC = await e.pedir({ cupon: 'ENVIO' });
    expect(conC.datos.desglose.descuento).toBe(sinC.datos.desglose.envio);
    expect(conC.datos.desglose.pagoRepartidor).toBe(sinC.datos.desglose.pagoRepartidor);
  });
});

describe('direcciones guardadas (C-CUPONES-DIRECCIONES)', () => {
  it('guardar, listar por uso, actualizar la misma, borrar y el tope de diez', async () => {
    const e = await escenario();
    const guardar = (d: Record<string, unknown>) =>
      e.m.llamar('POST', '/datos/mis-direcciones', d, e.cliente.token);
    const casa = await guardar({
      etiqueta: 'Casa',
      direccion: '100 Calle Luna',
      lat: 25.77,
      lng: -80.19,
      instrucciones: 'Portón azul',
      entrega: 'mano',
    });
    expect(casa.estado).toBe(201);
    expect(casa.datos.direccion).toMatchObject({
      etiqueta: 'Casa',
      instrucciones: 'Portón azul',
      entrega: 'mano',
    });
    const misma = await guardar({
      etiqueta: 'Casa 2',
      direccion: '100 calle luna',
      lat: 25.77,
      lng: -80.19,
    });
    expect(misma.estado).toBe(200);
    expect(misma.datos.direccion.id).toBe(casa.datos.direccion.id);
    for (let i = 0; i < 9; i++)
      expect((await guardar({ etiqueta: `T${i}`, direccion: `${200 + i} Calle Sol` })).estado).toBe(
        201,
      );
    expect((await guardar({ etiqueta: 'Extra', direccion: '999 Calle Extra' })).estado).toBe(409);
    const lista = await e.m.llamar('GET', '/datos/mis-direcciones', undefined, e.cliente.token);
    expect(lista.datos.direcciones).toHaveLength(10);
    expect(
      (
        await e.m.llamar(
          'DELETE',
          `/datos/mis-direcciones/${casa.datos.direccion.id}`,
          undefined,
          e.cliente.token,
        )
      ).estado,
    ).toBe(200);
    expect(
      (await e.m.llamar('GET', '/datos/mis-direcciones', undefined, e.cliente.token)).datos
        .direcciones,
    ).toHaveLength(9);
    expect((await guardar({ direccion: 'x' })).estado).toBe(400);
  });

  it('la app del cliente tiene las direcciones guardadas y el cupón en el carrito; el panel tiene los cupones; el inicio muestra promociones reales', () => {
    const raiz = join(__dirname, '..', '..', '..', '..');
    const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');
    const cart = leer('apps/cliente/src/app/cart.tsx');
    expect(cart).toContain("'/datos/mis-direcciones'");
    expect(cart).toContain("'/datos/cupones/validar'");
    expect(cart).toContain('cupon: cupon?.codigo');
    expect(leer('apps/panel/src/panel/ControlDinero.tsx')).toContain("'/datos/admin/cupones'");
    expect(leer('apps/cliente/src/Inicio.tsx')).toContain("'/datos/cupones/destacados'");
    expect(leer('apps/cliente/src/inicio/Ofertas.tsx')).toContain('testID="promos-reales"');
  });
});
