import { describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, llevarA, mundo } from './pruebas/ayuda';

/**
 * C-TRANSICIONES-PEDIDO por las rutas reales (16 oct 2026): operaciones simultáneas, reintentos
 * duplicados, cancelaciones e integridad del dinero con la protección de la base puesta.
 * Stripe siempre simulado: se cuentan las llamadas para comprobar que nada se cobra ni se
 * devuelve dos veces.
 */
type Llamada = { url: string; metodo: string };

async function escenario() {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    llamadas.push({ url: String(url), metodo: String(init?.method ?? 'GET') });
    return /\/(payment_intents|customers|customer_sessions)/.test(String(url))
      ? new Response(
          JSON.stringify({ id: 'pi_1', client_secret: 'pi_1_secret_x', status: 'succeeded' }),
          {
            status: 200,
          },
        )
      : new Response(JSON.stringify({ id: 're_1' }), { status: 200 });
  });
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  await m.llamar(
    'PATCH',
    `/datos/admin/restaurantes/${r.datos.restaurante.id}`,
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
  async function pedidoPagado() {
    const p = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: r.datos.restaurante.id,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 1 }],
        propinaCentavos: 300,
        direccion: '300 Calle Prueba',
        lat: 25.775,
        lng: -80.195,
      },
      cliente.token,
    );
    const id = p.datos.pedidoId as string;
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
    )
      .bind(id)
      .run();
    await m.DB.prepare('INSERT OR IGNORE INTO cobros (pedido_id) VALUES (?)').bind(id).run();
    return id;
  }
  const estado = async (id: string) =>
    (
      await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?')
        .bind(id)
        .first<{ estado: string }>()
    )?.estado;
  const veces = (patron: RegExp) =>
    llamadas.filter((x) => patron.test(x.url) && x.metodo === 'POST').length;
  return { m, dueno, cliente, pedidoPagado, estado, veces, llamadas };
}

describe('transiciones del pedido por las rutas reales (C-TRANSICIONES-PEDIDO)', () => {
  it('concurrencia · el restaurante acepta y rechaza a la vez: un solo ganador, y el dinero se devuelve solo si ganó el rechazo', async () => {
    const { m, dueno, pedidoPagado, estado, veces } = await escenario();
    for (let vuelta = 0; vuelta < 5; vuelta++) {
      const id = await pedidoPagado();
      const anulacionesAntes = veces(/\/payment_intents\/[^/]+\/cancel$/);
      const [aceptar, rechazar] = await Promise.all([
        m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 10 }, dueno.token),
        m.llamar('POST', `/datos/restaurante/pedidos/${id}/rechazar`, {}, dueno.token),
      ]);
      const final = await estado(id);
      const anulaciones = veces(/\/payment_intents\/[^/]+\/cancel$/) - anulacionesAntes;
      // Ambas pueden ganar en orden (aceptar y después rechazar es legal: aceptado → cancelado),
      // pero el estado final es uno solo y coherente con el dinero.
      expect(['aceptado', 'cancelado']).toContain(final);
      if (final === 'cancelado') {
        expect(rechazar.estado).toBe(200);
        expect(anulaciones).toBe(1);
      } else {
        expect(aceptar.estado).toBe(200);
        expect(anulaciones).toBe(0);
      }
    }
  });

  it('concurrencia · el cliente cancela mientras el restaurante acepta: nunca queda aceptado con la autorización anulada', async () => {
    const { m, dueno, cliente, pedidoPagado, estado, veces } = await escenario();
    for (let vuelta = 0; vuelta < 5; vuelta++) {
      const id = await pedidoPagado();
      const antes = veces(/\/payment_intents\/[^/]+\/cancel$/);
      await Promise.all([
        m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 10 }, dueno.token),
        m.llamar('POST', `/datos/pedidos/${id}/cancelar`, {}, cliente.token),
      ]);
      const final = await estado(id);
      const anulaciones = veces(/\/payment_intents\/[^/]+\/cancel$/) - antes;
      if (final === 'aceptado') expect(anulaciones).toBe(0);
      else {
        expect(final).toBe('cancelado');
        expect(anulaciones).toBe(1);
      }
    }
  });

  it('reintentos duplicados · aceptar, listo y rechazar dos veces: el segundo no cambia nada ni toca el dinero', async () => {
    const { m, dueno, pedidoPagado, estado, veces } = await escenario();
    const id = await pedidoPagado();
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/restaurante/pedidos/${id}/aceptar`,
          { minutos: 10 },
          dueno.token,
        )
      ).estado,
    ).toBe(200);
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/restaurante/pedidos/${id}/aceptar`,
          { minutos: 10 },
          dueno.token,
        )
      ).estado,
    ).toBe(409);
    expect(await estado(id)).toBe('aceptado');
    expect(
      (await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token)).estado,
    ).toBe(200);
    expect(
      (await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token)).estado,
    ).toBe(409);
    // Ya listo: rechazar no se puede (ni dos veces), y no se anula ni devuelve nada.
    const antes = veces(/\/(payment_intents\/[^/]+\/cancel|refunds)$/);
    expect(
      (await m.llamar('POST', `/datos/restaurante/pedidos/${id}/rechazar`, {}, dueno.token)).estado,
    ).toBe(409);
    expect(
      (await m.llamar('POST', `/datos/restaurante/pedidos/${id}/rechazar`, {}, dueno.token)).estado,
    ).toBe(409);
    expect(veces(/\/(payment_intents\/[^/]+\/cancel|refunds)$/)).toBe(antes);
    expect(await estado(id)).toBe('listo');
    const historial = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM historial_estados WHERE pedido_id = ? AND estado IN ('aceptado','listo')",
    )
      .bind(id)
      .first<{ n: number }>();
    expect(historial?.n).toBe(2);
  });

  // 18 oct 2026: «listo → cancelado» pasó a permitida para soporte (el superadmin ofrecía cancelar un
  // pedido listo y la base lo rechazaba con un error interno; y en cobro directo hace falta para
  // registrar la comida ya comprada). «Entregado» sigue cerrado para siempre.
  it('cancelaciones · desde «entregado» la base lo rechaza aunque alguien lo intente a mano (desde «listo» y «en camino» solo soporte y el cobro directo)', async () => {
    const { m, pedidoPagado, estado } = await escenario();
    for (const desde of ['entregado'] as const) {
      const id = await pedidoPagado();
      await llevarA(m.DB, id, desde);
      await expect(
        m.DB.prepare(
          "UPDATE pedidos SET estado = 'cancelado', cancelado_en = datetime('now') WHERE id = ?",
        )
          .bind(id)
          .run(),
      ).rejects.toThrow(/transicion_de_pedido_no_permitida/);
      expect(await estado(id)).toBe(desde);
    }
  });

  it('dinero · un salto indebido dentro de un lote deshace TODO el lote: ningún movimiento de billetera sin su cambio de estado', async () => {
    const { m, pedidoPagado, estado } = await escenario();
    const id = await pedidoPagado(); // «pagado»: saltar a «entregado» está prohibido
    const repartidor = await m.cuenta('repartidor');
    await expect(
      m.DB.batch([
        m.DB.prepare(
          "INSERT INTO movimientos (id, usuario_id, pedido_id, monto, concepto) VALUES (?, ?, ?, 500, 'entrega')",
        ).bind(`mov-${id}`, repartidor.id, id),
        m.DB.prepare(
          "UPDATE pedidos SET estado = 'entregado', entregado_en = datetime('now') WHERE id = ?",
        ).bind(id),
      ]),
    ).rejects.toThrow(/transicion_de_pedido_no_permitida/);
    const movs = await m.DB.prepare('SELECT COUNT(*) AS n FROM movimientos WHERE pedido_id = ?')
      .bind(id)
      .first<{ n: number }>();
    expect(movs?.n).toBe(0);
    expect(await estado(id)).toBe('pagado');
  });

  it('compatibilidad · pedidos que ya existen en cualquier estado se leen igual y siguen su camino legal', async () => {
    const { m, cliente, pedidoPagado, estado } = await escenario();
    // Un registro viejo en cada estado (como los que hay en producción), creado con INSERT:
    // el disparador no mira los INSERT, solo los cambios de estado.
    const base = await pedidoPagado();
    const fila = await m.DB.prepare('SELECT * FROM pedidos WHERE id = ?')
      .bind(base)
      .first<Record<string, unknown>>();
    const columnas = Object.keys(fila!).filter((k) => k !== 'id' && k !== 'estado');
    for (const viejo of [
      'pago_pendiente',
      'pagado',
      'aceptado',
      'listo',
      'en_camino',
      'entregado',
      'cancelado',
    ]) {
      const id = `viejo-${viejo}`;
      await m.DB.prepare(
        `INSERT INTO pedidos (id, estado, ${columnas.join(', ')}) VALUES (?, ?, ${columnas.map(() => '?').join(', ')})`,
      )
        .bind(id, viejo, ...columnas.map((k) => fila![k]))
        .run();
      expect(await estado(id)).toBe(viejo);
      const r = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
      expect(r.estado).toBe(200);
    }
    await llevarA(m.DB, 'viejo-pago_pendiente', 'entregado');
    expect(await estado('viejo-pago_pendiente')).toBe('entregado');
  });

  it('dinero · dos entregas simultáneas del mismo pedido: una sola entrega, una sola captura y la billetera una sola vez', async () => {
    const { m, dueno, pedidoPagado, estado, veces } = await escenario();
    const id = await pedidoPagado();
    const rep = await m.cuenta('repartidor');
    await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.771, lng: -80.191 },
      rep.token,
    );
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
    await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    await m.recoger(id, rep.token, dueno.token);
    const capturasAntes = veces(/\/payment_intents\/[^/]+\/capture$/);
    const [a, b] = await Promise.all([m.entregar(id, rep.token), m.entregar(id, rep.token)]);
    expect([a.estado, b.estado].sort()).toEqual([200, 409]);
    expect(await estado(id)).toBe('entregado');
    expect(veces(/\/payment_intents\/[^/]+\/capture$/) - capturasAntes).toBe(1);
    const movs = await m.DB.prepare(
      'SELECT concepto, COUNT(*) AS n FROM movimientos WHERE pedido_id = ? GROUP BY concepto',
    )
      .bind(id)
      .all<{ concepto: string; n: number }>();
    for (const x of movs.results) expect(x.n, `movimiento «${x.concepto}» repetido`).toBe(1);
    expect(movs.results.length).toBeGreaterThan(0);
  });
});
