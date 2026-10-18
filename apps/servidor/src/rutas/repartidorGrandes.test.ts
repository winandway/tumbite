import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, llevarA, mundo } from '../pruebas/ayuda';
import { usarTransporteAvisos } from '../notificaciones';

/**
 * La app del repartidor «como los grandes» (18 oct 2026): oferta completa, calificaciones,
 * ganancias con desglose, avisos reales, pausa, «llegué» y «no está listo». Candado
 * C-REPARTIDOR-GRANDES. Ficha: docs/investigaciones-rea/2026-10-18-repartidor.md.
 */
type Push = { to: string; title: string; body: string };
function expoFalso() {
  const mandados: Push[] = [];
  usarTransporteAvisos(async (_url, init) => {
    const lote = JSON.parse(String(init.body)) as Push[];
    mandados.push(...lote);
    return new Response(JSON.stringify({ data: lote.map(() => ({ status: 'ok' })) }), {
      status: 200,
    });
  });
  return mandados;
}

async function escenario() {
  vi.stubGlobal('fetch', async (url: string) =>
    /\/(payment_intents|customers|customer_sessions)/.test(url)
      ? new Response(JSON.stringify({ id: 'cs_1', client_secret: 'cs_1_secret_x' }), {
          status: 200,
        })
      : new Response(JSON.stringify({ id: 're_1' }), { status: 200 }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x' });
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
  async function pedidoPagado(cantidad = 2) {
    const p = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [{ platoId: plato.datos.plato.id, cantidad }],
        propinaCentavos: 400,
        direccion: '200 Calle Prueba',
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
    return p.datos.pedidoId as string;
  }
  async function repartidor(nombre: string, lat = 25.771, lng = -80.191) {
    const d = await m.cuenta('repartidor', nombre);
    await m.llamar('POST', '/datos/repartidor/conectar', { conectado: true, lat, lng }, d.token);
    return d;
  }
  /** El restaurante acepta: ahí empieza a ofrecerse. */
  const aceptar = (id: string) =>
    m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
  const ofertasDe = async (token: string) =>
    (await m.llamar('GET', '/datos/repartidor/ofertas', undefined, token)).datos.ofertas as {
      id: string;
      distanciaKm: number;
      distanciaAlLocalKm: number;
      distanciaTotalKm: number;
      minutosEstimados: number;
      articulos: number;
      segundos: number;
    }[];
  return { m, dueno, admin, cliente, rid, pedidoPagado, repartidor, aceptar, ofertasDe };
}

afterEach(() => {
  usarTransporteAvisos(null);
  vi.unstubAllGlobals();
});

describe('la oferta completa (como en DoorDash y Uber)', () => {
  it('trae distancia al local, distancia total, minutos estimados y cuántos artículos', async () => {
    const e = await escenario();
    const rep = await e.repartidor('Rep Uno');
    const id = await e.pedidoPagado(3);
    await e.aceptar(id);
    const [o] = await e.ofertasDe(rep.token);
    expect(o).toBeDefined();
    expect(o!.id).toBe(id);
    expect(o!.distanciaAlLocalKm).toBeGreaterThan(0);
    expect(o!.distanciaAlLocalKm).toBeLessThan(1);
    expect(o!.distanciaTotalKm).toBeGreaterThan(o!.distanciaAlLocalKm);
    expect(o!.minutosEstimados).toBeGreaterThan(0);
    expect(o!.articulos).toBe(3);
    expect(o!.segundos).toBe(45);
  });
});

describe('calificaciones visibles para el repartidor', () => {
  it('cuenta aceptación, finalización, puntualidad, estrellas y entregas', async () => {
    const e = await escenario();
    const { m, cliente } = e;
    const rep = await e.repartidor('Rep Dos');
    // Primera oferta: la rechaza.
    const id1 = await e.pedidoPagado();
    await e.aceptar(id1);
    const [o1] = await e.ofertasDe(rep.token);
    await m.llamar('POST', `/datos/repartidor/ofertas/${o1!.id}/rechazar`, {}, rep.token);
    // Segunda: la acepta, la entrega (por la base, como en las demás pruebas) y el cliente califica.
    const id2 = await e.pedidoPagado();
    await e.aceptar(id2);
    // Tras rechazar, el pedido 1 se sigue ofreciendo: lo apartamos para que no estorbe.
    await m.DB.prepare("UPDATE pedidos SET estado = 'cancelado' WHERE id = ?").bind(id1).run();
    const ofertas = await e.ofertasDe(rep.token);
    const o2 = ofertas.find((o) => o.id === id2);
    expect(o2).toBeDefined();
    expect(
      (await m.llamar('POST', `/datos/repartidor/ofertas/${id2}/aceptar`, {}, rep.token)).estado,
    ).toBe(200);
    await llevarA(m.DB, id2, 'entregado', "entregado_en = datetime('now')");
    await m.llamar(
      'POST',
      `/datos/pedidos/${id2}/calificar`,
      { estrellasRestaurante: 5, estrellasRepartidor: 4 },
      cliente.token,
    );
    const r = await m.llamar('GET', '/datos/repartidor/calificaciones', undefined, rep.token);
    expect(r.estado).toBe(200);
    expect(r.datos).toMatchObject({
      clientes: { promedio: 4, cuantas: 1, minimo: 4.2 },
      aceptacion: { porcentaje: 50, de: 2 },
      finalizacion: { porcentaje: 100, de: 1, minimo: 90 },
      puntualidad: { porcentaje: 100, de: 1 },
      entregas30Dias: 1,
      entregasTotales: 1,
    });
  });
  it('pide sesión de repartidor', async () => {
    const e = await escenario();
    expect(
      (await e.m.llamar('GET', '/datos/repartidor/calificaciones', undefined, e.cliente.token))
        .estado,
    ).toBe(403);
  });
});

describe('ganancias con desglose por pedido', () => {
  it('separa base, bono, propina y propina posterior, y suma los totales', async () => {
    const e = await escenario();
    const { m } = e;
    const rep = await e.repartidor('Rep Tres');
    const id = await e.pedidoPagado();
    await e.aceptar(id);
    await e.ofertasDe(rep.token);
    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await llevarA(m.DB, id, 'entregado', "entregado_en = datetime('now')");
    // Lo que escribe el servidor al entregar (operacion.ts): entrega y propina.
    const p = await m.DB.prepare(
      'SELECT envio, complemento, propina, pago_repartidor FROM pedidos WHERE id = ?',
    )
      .bind(id)
      .first<{ envio: number; complemento: number; propina: number; pago_repartidor: number }>();
    await m.DB.batch([
      m.DB.prepare(
        "INSERT INTO movimientos (id, usuario_id, pedido_id, monto, concepto) VALUES ('m1', ?, ?, ?, 'entrega')",
      ).bind(rep.id, id, p!.pago_repartidor),
      m.DB.prepare(
        "INSERT INTO movimientos (id, usuario_id, pedido_id, monto, concepto) VALUES ('m2', ?, ?, ?, 'propina')",
      ).bind(rep.id, id, p!.propina),
      // Propina dada después de entregar: hoy entra como «ajuste» con esta referencia.
      m.DB.prepare(
        "INSERT INTO movimientos (id, usuario_id, pedido_id, monto, concepto, referencia) VALUES ('m3', ?, NULL, 200, 'ajuste', ?)",
      ).bind(rep.id, `propina-extra-${id}`),
    ]);
    const r = await m.llamar('GET', '/datos/repartidor/ganancias', undefined, rep.token);
    expect(r.estado).toBe(200);
    expect(r.datos.pedidos).toHaveLength(1);
    expect(r.datos.pedidos[0]).toMatchObject({
      pedidoId: id,
      restaurante: 'Sabor Prueba',
      base: p!.envio + p!.complemento,
      bono: 0,
      propina: 400,
      propinaPosterior: 200,
      total: p!.pago_repartidor + 200,
    });
    expect(r.datos.totales).toMatchObject({
      entregas: 1,
      base: p!.envio + p!.complemento,
      propinas: 600,
      total: p!.pago_repartidor + 200,
    });
  });
});

describe('avisos reales del repartidor', () => {
  it('cancelación del restaurante y cambio de dirección le llegan por push y en la campana', async () => {
    const e = await escenario();
    const { m, dueno, cliente } = e;
    const push = expoFalso();
    const rep = await e.repartidor('Rep Cuatro');
    await m.llamar(
      'POST',
      '/datos/cuentas/dispositivo',
      { token: 'ExponentPushToken[rep-cuatro]', plataforma: 'ios' },
      rep.token,
    );
    const id = await e.pedidoPagado();
    await e.aceptar(id);
    await e.ofertasDe(rep.token);
    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    // El cliente cambia la dirección antes de la recogida.
    const cambio = await m.llamar(
      'PATCH',
      `/datos/pedidos/${id}/direccion`,
      { direccion: '500 Calle Nueva, Miami', lat: 25.79, lng: -80.21, aceptarTotal: true },
      cliente.token,
    );
    expect(cambio.estado).toBe(200);
    expect(push.some((x) => x.to.includes('rep-cuatro') && /direcci|address/i.test(x.title))).toBe(
      true,
    );
    // El restaurante rechaza el pedido ya asignado.
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/rechazar`, {}, dueno.token);
    expect(push.some((x) => x.to.includes('rep-cuatro') && /cancel/i.test(x.title))).toBe(true);
    const avisos = await m.llamar('GET', '/datos/repartidor/avisos', undefined, rep.token);
    expect(avisos.estado).toBe(200);
    const tipos = avisos.datos.avisos.map((a: { tipo: string }) => a.tipo);
    expect(tipos).toContain('direccion_cambiada');
    expect(tipos).toContain('cancelado_por_restaurante');
  });
  it('el idioma de los push sigue al de la app', async () => {
    const e = await escenario();
    const rep = await e.repartidor('Rep Cinco');
    const r = await e.m.llamar('PUT', '/datos/cuentas/idioma', { idioma: 'en' }, rep.token);
    expect(r.estado).toBe(200);
    const f = await e.m.DB.prepare('SELECT idioma FROM usuarios WHERE id = ?')
      .bind(rep.id)
      .first<{ idioma: string }>();
    expect(f?.idioma).toBe('en');
    expect(
      (await e.m.llamar('PUT', '/datos/cuentas/idioma', { idioma: 'fr' }, rep.token)).estado,
    ).toBe(400);
  });
});

describe('pausa, «llegué» y «no está listo»', () => {
  it('en pausa sigue conectado pero no recibe ofertas', async () => {
    const e = await escenario();
    const { m } = e;
    const rep = await e.repartidor('Rep Seis');
    expect(
      (await m.llamar('POST', '/datos/repartidor/pausar', { pausado: true }, rep.token)).estado,
    ).toBe(200);
    const estado = await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(estado.datos).toMatchObject({ conectado: true, pausado: true });
    const id = await e.pedidoPagado();
    await e.aceptar(id);
    expect(await e.ofertasDe(rep.token)).toHaveLength(0);
    await m.llamar('POST', '/datos/repartidor/pausar', { pausado: false }, rep.token);
    expect(await e.ofertasDe(rep.token)).toHaveLength(1);
  });
  it('conectarse fuera de cobertura lo dice', async () => {
    const e = await escenario();
    const d = await e.m.cuenta('repartidor', 'Rep Lejos');
    const r = await e.m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 48.85, lng: 2.35 },
      d.token,
    );
    expect(r.datos).toMatchObject({ conectado: true, cobertura: 'fuera' });
  });
  it('«llegué» marca la llegada solo a 200 m del local, y «no está listo» queda en la bitácora', async () => {
    const e = await escenario();
    const { m, dueno } = e;
    const push = expoFalso();
    await m.llamar(
      'POST',
      '/datos/cuentas/dispositivo',
      { token: 'ExponentPushToken[dueno-seis]', plataforma: 'android' },
      dueno.token,
    );
    const rep = await e.repartidor('Rep Siete', 25.8, -80.3);
    const id = await e.pedidoPagado();
    await e.aceptar(id);
    await e.ofertasDe(rep.token);
    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    const lejos = await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/llegue`,
      { lat: 25.8, lng: -80.3 },
      rep.token,
    );
    expect(lejos.datos).toMatchObject({ llegue: false });
    expect(lejos.datos.metros).toBeGreaterThan(200);
    const cerca = await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/llegue`,
      { lat: RESTAURANTE_BASE.lat, lng: RESTAURANTE_BASE.lng },
      rep.token,
    );
    expect(cerca.datos).toMatchObject({ llegue: true });
    const hito = await m.DB.prepare(
      "SELECT 1 AS si FROM hitos_pedido WHERE pedido_id = ? AND hito = 'llego_restaurante'",
    )
      .bind(id)
      .first();
    expect(hito).toBeTruthy();
    const nl = await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/no-esta-listo`,
      {},
      rep.token,
    );
    expect(nl.estado).toBe(200);
    const ev = await m.DB.prepare(
      "SELECT 1 AS si FROM bitacora_pedidos WHERE pedido_id = ? AND evento = 'no_esta_listo'",
    )
      .bind(id)
      .first();
    expect(ev).toBeTruthy();
    expect(push.some((x) => x.to.includes('dueno-seis'))).toBe(true);
  });
});
