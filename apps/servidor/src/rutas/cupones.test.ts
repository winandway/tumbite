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
  it('el superadmin crea un cupón, el cliente lo valida y el pedido lo descuenta de la ganancia de Divoox, nunca del restaurante ni del repartidor', async () => {
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

  it('BRE-7b: un pedido para recoger lleva PIN aunque el cliente lo haya apagado (el local siempre comprueba)', async () => {
    const e = await escenario();
    const r = await e.pedir({ entrega: 'recoger', pin: false });
    expect(r.estado).toBe(201);
    const f = await e.m.DB.prepare('SELECT pin FROM pines_entrega WHERE pedido_id = ?')
      .bind(r.datos.pedidoId as string)
      .first<{ pin: string }>();
    expect(f?.pin).toMatch(/^\d{4}$/);
    // En mano, apagarlo sigue valiendo (es decisión del cliente, como en DoorDash).
    const mano = await e.pedir({ entrega: 'mano', pin: false });
    expect(
      await e.m.DB.prepare('SELECT 1 FROM pines_entrega WHERE pedido_id = ?')
        .bind(mano.datos.pedidoId as string)
        .first(),
    ).toBeNull();
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

describe('pedido sin pagar que queda atrás (C-PENDIENTE-ABANDONADO)', () => {
  /** Stripe de mentira: cada pedido su propio cobro; se anotan las anulaciones. */
  function stripeFalso() {
    const anulados: string[] = [];
    let n = 0;
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const u = String(url);
      const anular = /\/payment_intents\/(pi_\d+)\/cancel/.exec(u);
      if (anular) {
        anulados.push(anular[1]!);
        return new Response(JSON.stringify({ id: anular[1], status: 'canceled' }), { status: 200 });
      }
      const leer = /\/payment_intents\/(pi_\d+)$/.exec(u);
      if (leer && (init?.method ?? 'GET') === 'GET')
        return new Response(
          JSON.stringify({
            id: leer[1],
            status: 'requires_payment_method',
            client_secret: `${leer[1]}_s`,
          }),
          { status: 200 },
        );
      if (u.includes('/payment_intents')) {
        n++;
        return new Response(JSON.stringify({ id: `pi_${n}`, client_secret: `pi_${n}_s` }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ id: 'x' }), { status: 200 });
    });
    return anulados;
  }

  it('al pedir de nuevo, el pedido viejo sin pagar se cierra, su cobro se anula y el cupón vuelve', async () => {
    const e = await escenario();
    await e.m.llamar(
      'POST',
      '/datos/admin/cupones',
      { codigo: 'UNAVEZ', tipo: 'monto', valor: 200, usosPorCliente: 1 },
      e.admin.token,
    );
    const anulados = stripeFalso();
    const viejo = await e.pedir({ cupon: 'UNAVEZ' });
    expect(viejo.estado).toBe(201);
    // Cambia la dirección y vuelve a pedir con el mismo cupón: el viejo no lo retiene.
    const nuevo = await e.pedir({ cupon: 'UNAVEZ', direccion: '400 Calle Nueva' });
    expect(nuevo.estado).toBe(201);
    expect(nuevo.datos.desglose.descuento).toBe(200);
    const estadoViejo = await e.m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?')
      .bind(viejo.datos.pedidoId)
      .first<{ estado: string }>();
    expect(estadoViejo?.estado).toBe('cancelado');
    expect(anulados).toEqual(['pi_1']);
    // No aparece en el historial del cliente (nunca se pagó).
    const mis = await e.m.llamar('GET', '/datos/mis-pedidos', undefined, e.cliente.token);
    expect(mis.datos.pedidos.map((p: { id: string }) => p.id)).not.toContain(viejo.datos.pedidoId);
  });

  it('el cupón de un pedido cancelado vuelve a valer', async () => {
    const e = await escenario();
    await e.m.llamar(
      'POST',
      '/datos/admin/cupones',
      { codigo: 'OTRAVEZ', tipo: 'monto', valor: 200, usosPorCliente: 1 },
      e.admin.token,
    );
    stripeFalso();
    const p = await e.pedir({ cupon: 'OTRAVEZ' });
    expect(
      (await e.m.llamar('POST', `/datos/pedidos/${p.datos.pedidoId}/cancelar`, {}, e.cliente.token))
        .estado,
    ).toBe(200);
    const v = await e.m.llamar(
      'POST',
      '/datos/cupones/validar',
      { codigo: 'OTRAVEZ', restauranteId: e.rid, subtotal: 3000, envio: 399 },
      e.cliente.token,
    );
    expect(v.estado).toBe(200);
  });

  it('el carrito olvida el cobro viejo al crear el pedido de nuevo (su cobro queda anulado)', () => {
    const cart = readFileSync(
      join(__dirname, '..', '..', '..', 'cliente', 'src', 'app', 'cart.tsx'),
      'utf8',
    );
    const i = cart.indexOf('setPagando(true);');
    expect(i).toBeGreaterThan(0);
    expect(cart.slice(i, i + 200)).toContain('setCobro(null);');
  });

  it('si Stripe dice que el cobro viejo ya se autorizó, no se toca', async () => {
    const e = await escenario();
    const anulados = stripeFalso();
    const viejo = await e.pedir();
    const original = globalThis.fetch;
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) =>
      /\/payment_intents\/pi_1$/.test(String(url))
        ? new Response(JSON.stringify({ id: 'pi_1', status: 'requires_capture' }), { status: 200 })
        : original(url, init),
    );
    expect((await e.pedir({ direccion: '400 Calle Nueva' })).estado).toBe(201);
    const estadoViejo = await e.m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?')
      .bind(viejo.datos.pedidoId)
      .first<{ estado: string }>();
    expect(estadoViejo?.estado).toBe('pago_pendiente');
    expect(anulados).toEqual([]);
  });

  // Revisión del 13 nov 2026.
  it('un pedido sin cobro de Stripe se respeta 2 minutos (puede estar creándose) y después se cierra', async () => {
    const e = await escenario();
    stripeFalso();
    const viejo = await e.pedir();
    const id = viejo.datos.pedidoId as string;
    await e.m.DB.prepare('UPDATE pedidos SET stripe_sesion = NULL WHERE id = ?').bind(id).run();
    const estado = async () =>
      (
        await e.m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?')
          .bind(id)
          .first<{ estado: string }>()
      )?.estado;
    expect((await e.pedir({ direccion: '401 Calle Nueva' })).estado).toBe(201);
    expect(await estado()).toBe('pago_pendiente');
    await e.m.DB.prepare(
      "UPDATE pedidos SET creado_en = datetime('now', '-3 minutes') WHERE id = ?",
    )
      .bind(id)
      .run();
    expect((await e.pedir({ direccion: '402 Calle Nueva' })).estado).toBe(201);
    expect(await estado()).toBe('cancelado');
  });

  it('dos «Continuar al pago» casi a la vez con los mismos datos: el segundo reutiliza el cobro del primero y no lo anula', async () => {
    const e = await escenario();
    const anulados = stripeFalso();
    const primero = await e.pedir();
    const segundo = await e.pedir();
    expect(primero.estado).toBe(201);
    expect(segundo.estado).toBe(201);
    expect(segundo.datos.pedidoId).toBe(primero.datos.pedidoId);
    expect(segundo.datos.clientSecret).toBe(primero.datos.clientSecret);
    expect(segundo.datos.desglose.totalCliente).toBe(primero.datos.desglose.totalCliente);
    expect(anulados).toEqual([]);
    const { n } = (await e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM pedidos WHERE estado = 'pago_pendiente'",
    ).first<{ n: number }>())!;
    expect(n).toBe(1);
    // Con un cupón de un solo uso pasa lo mismo: el uso del primero no bloquea al segundo.
    await e.m.llamar(
      'POST',
      '/datos/admin/cupones',
      { codigo: 'CARRERA', tipo: 'monto', valor: 200, usosPorCliente: 1 },
      e.admin.token,
    );
    const a = await e.pedir({ cupon: 'CARRERA' });
    const b = await e.pedir({ cupon: 'CARRERA' });
    expect(b.estado).toBe(201);
    expect(b.datos.pedidoId).toBe(a.datos.pedidoId);
    expect(anulados).toEqual(['pi_1']);
  });

  // Revisión del 13 nov 2026 (2): el saldo de regalo apartado por el pendiente vigente no cambia el
  // total del segundo intento, y nunca quedan dos pendientes vivos para el mismo carrito.
  const darSaldo = (e: Awaited<ReturnType<typeof escenario>>, centavos: number, ref: string) =>
    e.m.DB.prepare(
      "INSERT INTO creditos_regalo (id, usuario_id, centavos, motivo, referencia) VALUES (?1, ?2, ?3, 'prueba', ?1)",
    )
      .bind(ref, e.cliente.id, centavos)
      .run();
  const pendientes = async (e: Awaited<ReturnType<typeof escenario>>) =>
    (await e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM pedidos WHERE estado = 'pago_pendiente'",
    ).first<{ n: number }>())!.n;

  for (const conTotal of [false, true])
    it(`con saldo de regalo, el segundo «Continuar al pago» reutiliza el mismo cobro (${conTotal ? 'con' : 'sin'} totalEsperado)`, async () => {
      const e = await escenario();
      const anulados = stripeFalso();
      await darSaldo(e, 500, 'r1');
      const primero = await e.pedir({ usarSaldoRegalo: true });
      expect(primero.estado).toBe(201);
      expect(primero.datos.desglose.descuento).toBe(500);
      const total = primero.datos.desglose.totalCliente as number;
      for (let i = 0; i < 3; i++) {
        const otra = await e.pedir({
          usarSaldoRegalo: true,
          ...(conTotal ? { totalEsperado: total } : {}),
        });
        expect(otra.estado).toBe(201);
        expect(otra.datos.pedidoId).toBe(primero.datos.pedidoId);
        expect(otra.datos.clientSecret).toBe(primero.datos.clientSecret);
      }
      expect(anulados).toEqual([]);
      expect(await pendientes(e)).toBe(1);
    });

  for (const conTotal of [false, true])
    it(`con saldo de regalo y cupón de un solo uso, si el total cambia se cancela el pendiente antes de crear el nuevo (${conTotal ? 'con' : 'sin'} totalEsperado)`, async () => {
      const e = await escenario();
      await e.m.llamar(
        'POST',
        '/datos/admin/cupones',
        { codigo: 'SOLOUNO', tipo: 'monto', valor: 200, usosPorCliente: 1 },
        e.admin.token,
      );
      const anulados = stripeFalso();
      await darSaldo(e, 500, 'r1');
      const cuerpo = { usarSaldoRegalo: true, cupon: 'SOLOUNO' };
      const primero = await e.pedir(cuerpo);
      expect(primero.estado).toBe(201);
      const total = primero.datos.desglose.totalCliente as number;
      // Mismo carrito: mismo cobro.
      const igual = await e.pedir({ ...cuerpo, ...(conTotal ? { totalEsperado: total } : {}) });
      expect(igual.datos.pedidoId).toBe(primero.datos.pedidoId);
      // Entra más saldo: el total baja. El pendiente se cancela primero (libera saldo y cupón).
      await darSaldo(e, 300, 'r2');
      const nuevo = await e.pedir({
        ...cuerpo,
        ...(conTotal ? { totalEsperado: total - 300 } : {}),
      });
      expect(nuevo.estado).toBe(201);
      expect(nuevo.datos.pedidoId).not.toBe(primero.datos.pedidoId);
      expect(nuevo.datos.desglose.totalCliente).toBe(total - 300);
      expect(nuevo.datos.desglose.descuento).toBe(200 + 800);
      expect(anulados).toEqual(['pi_1']);
      expect(await pendientes(e)).toBe(1);
      const usos = await e.m.DB.prepare(
        "SELECT COUNT(*) AS n FROM usos_cupon u JOIN pedidos p ON p.id = u.pedido_id WHERE u.codigo = 'SOLOUNO' AND p.estado <> 'cancelado'",
      ).first<{ n: number }>();
      expect(usos?.n).toBe(1);
    });

  it('el listado de cupones del equipo no cuenta los usos de pedidos cancelados', async () => {
    const e = await escenario();
    await e.m.llamar(
      'POST',
      '/datos/admin/cupones',
      { codigo: 'LISTADO', tipo: 'monto', valor: 200, usosPorCliente: 1 },
      e.admin.token,
    );
    stripeFalso();
    const p = await e.pedir({ cupon: 'LISTADO' });
    await e.m.llamar('POST', `/datos/pedidos/${p.datos.pedidoId}/cancelar`, {}, e.cliente.token);
    const l = await e.m.llamar('GET', '/datos/admin/cupones', undefined, e.admin.token);
    const c = (l.datos.cupones as { codigo: string; usos: number; descontado: number }[]).find(
      (x) => x.codigo === 'LISTADO',
    );
    expect(c?.usos).toBe(0);
    expect(c?.descontado).toBe(0);
  });

  it('si la comida ya lista se cancela a cargo del cliente, el cupón de un solo uso no vuelve', async () => {
    const e = await escenario();
    await e.m.llamar(
      'POST',
      '/datos/admin/cupones',
      { codigo: 'CULPA', tipo: 'monto', valor: 200, usosPorCliente: 1 },
      e.admin.token,
    );
    stripeFalso();
    const p = await e.pedir({ cupon: 'CULPA' });
    const id = p.datos.pedidoId as string;
    await e.m.DB.prepare("UPDATE pedidos SET estado = 'cancelado' WHERE id = ?").bind(id).run();
    await e.m.DB.prepare(
      "INSERT INTO solicitudes_cancelacion (id, pedido_id, restaurante_id, motivo, paga_comida, estado) VALUES ('s1', ?, ?, 'cliente_no_responde', 'cliente', 'aprobada')",
    )
      .bind(id, e.rid)
      .run();
    const validar = () =>
      e.m.llamar(
        'POST',
        '/datos/cupones/validar',
        { codigo: 'CULPA', restauranteId: e.rid, subtotal: 3000, envio: 399 },
        e.cliente.token,
      );
    expect((await validar()).estado).toBe(409);
    // Si la comida la asume el restaurante (no fue culpa del cliente), el cupón vuelve.
    await e.m.DB.prepare("UPDATE solicitudes_cancelacion SET paga_comida = 'restaurante'").run();
    expect((await validar()).estado).toBe(200);
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
