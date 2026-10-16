import { describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * Los cinco fallos que encontró la lectura del código el 16 oct 2026 (docs/COMPARACION-TUMBITE-DOORDASH-REA.md).
 * Cada prueba reproduce el fallo tal como lo vería un cliente o un repartidor; primero en ROJO,
 * después queda como candado (C-FALLOS-CRITICOS). Stripe siempre simulado: nunca dinero real.
 */
const SECRETO_AVISO = `whsec_${crypto.randomUUID()}`;

async function avisoFirmado(cuerpo: string) {
  const t = Math.floor(Date.now() / 1000);
  const llave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRETO_AVISO),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const f = await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(`${t}.${cuerpo}`));
  const v1 = [...new Uint8Array(f)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `t=${t},v1=${v1}`;
}

type Llamada = { url: string; metodo: string };

async function escenario(respuestaStripe?: (url: string, init?: RequestInit) => Response | null) {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    llamadas.push({ url: String(url), metodo: String(init?.method ?? 'GET') });
    const propia = respuestaStripe?.(String(url), init);
    if (propia) return propia;
    return /\/(payment_intents|customers|customer_sessions)/.test(String(url))
      ? new Response(JSON.stringify({ id: 'pi_sesion', client_secret: 'pi_sesion_secret_x' }), {
          status: 200,
        })
      : new Response(JSON.stringify({ id: 're_1' }), { status: 200 });
  });
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: SECRETO_AVISO });
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
  async function pedir() {
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
    return { id: p.datos.pedidoId as string, total: p.datos.desglose.totalCliente as number };
  }
  /** La autorización de la tarjeta llega por el aviso firmado de Stripe (como en producción). */
  async function autorizar(id: string, total: number, eventoId = `evt_${crypto.randomUUID()}`) {
    const cuerpo = JSON.stringify({
      id: eventoId,
      type: 'payment_intent.amount_capturable_updated',
      data: { object: { id: 'pi_sesion', amount_capturable: total, metadata: { pedido_id: id } } },
    });
    return m.crudo('/datos/stripe/aviso', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': await avisoFirmado(cuerpo),
      },
      body: cuerpo,
    });
  }
  async function pedidoPagado() {
    const p = await pedir();
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
    )
      .bind(p.id)
      .run();
    return p.id;
  }
  async function repartidor(nombre: string, lat: number, lng: number) {
    const d = await m.cuenta('repartidor', nombre);
    await m.llamar('POST', '/datos/repartidor/conectar', { conectado: true, lat, lng }, d.token);
    return d;
  }
  const estadoDe = async (id: string) =>
    (
      await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?')
        .bind(id)
        .first<{ estado: string }>()
    )?.estado;
  return { m, dueno, cliente, pedir, autorizar, pedidoPagado, repartidor, estadoDe, llamadas };
}

describe('fallo 1 · un aviso de Stripe que falla a medias se puede reintentar', () => {
  it('si el servidor falla después de recibir el aviso, el reintento de Stripe SÍ aplica el pago', async () => {
    const { m, pedir, autorizar, estadoDe } = await escenario();
    const p = await pedir();
    expect(await estadoDe(p.id)).toBe('pago_pendiente');
    // La base falla UNA vez justo al pasar el pedido a «pagado» (como un corte de D1 a medias).
    const prepareOriginal = m.DB.prepare.bind(m.DB);
    let fallos = 0;
    m.DB.prepare = ((sql: string) => {
      if (fallos === 0 && /UPDATE pedidos SET estado = 'pagado'/.test(sql)) {
        fallos++;
        throw new Error('D1: conexión cortada a medias (simulada)');
      }
      return prepareOriginal(sql);
    }) as typeof m.DB.prepare;
    const evento = `evt_${crypto.randomUUID()}`;
    const primero = await autorizar(p.id, p.total, evento);
    expect(primero.status).toBeGreaterThanOrEqual(500);
    expect(await estadoDe(p.id)).toBe('pago_pendiente');
    // Stripe reintenta el MISMO aviso (mismo id de evento): esta vez la base funciona.
    const segundo = await autorizar(p.id, p.total, evento);
    expect(segundo.status).toBe(200);
    expect(await estadoDe(p.id)).toBe('pagado');
  });
});

describe('fallo 2 · cancelar antes del aviso de pago libera la autorización', () => {
  it('el cliente cancela en «pago pendiente»: se anula el PaymentIntent y, si el aviso llega tarde, no revive el pedido', async () => {
    const { m, cliente, pedir, autorizar, estadoDe, llamadas } = await escenario();
    const p = await pedir();
    const r = await m.llamar('POST', `/datos/pedidos/${p.id}/cancelar`, {}, cliente.token);
    expect(r.estado).toBe(200);
    expect(await estadoDe(p.id)).toBe('cancelado');
    // La autorización que se creó al pedir (pi_sesion) tiene que anularse en Stripe.
    expect(
      llamadas.some(
        (x) => x.url.endsWith('/payment_intents/pi_sesion/cancel') && x.metodo === 'POST',
      ),
    ).toBe(true);
    // El aviso de autorización que llega después no puede dejar un pedido cancelado como pagado.
    await autorizar(p.id, p.total);
    expect(await estadoDe(p.id)).toBe('cancelado');
    const cobro = await m.DB.prepare('SELECT cancelado_en FROM cobros WHERE pedido_id = ?')
      .bind(p.id)
      .first<{ cancelado_en: string | null }>();
    expect(cobro == null || cobro.cancelado_en != null).toBe(true);
  });
});

describe('fallo 3 · la propina posterior solo se anota si Stripe la cobró', () => {
  it('con el cobro en «requires_action» no hay movimiento para el repartidor ni propina registrada', async () => {
    const { m, dueno, cliente, pedidoPagado, repartidor } = await escenario();
    const rep = await repartidor('Pro Pina', 25.771, -80.191);
    const id = await pedidoPagado();
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
    await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    await m.recoger(id, rep.token, dueno.token);
    expect((await m.entregar(id, rep.token)).estado).toBe(200);
    await m.DB.prepare("UPDATE usuarios SET stripe_cliente = 'cus_1' WHERE id = ?")
      .bind(cliente.id)
      .run();
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (String(url).includes('/payment_intents/') && (init?.method ?? 'GET') === 'GET')
        return new Response(JSON.stringify({ id: 'pi_1', payment_method: 'pm_guardada' }), {
          status: 200,
        });
      // El banco pide autenticación: el cobro NO se hizo.
      return new Response(JSON.stringify({ id: 'pi_propina', status: 'requires_action' }), {
        status: 200,
      });
    });
    const r = await m.llamar(
      'POST',
      `/datos/pedidos/${id}/propina`,
      { centavos: 200 },
      cliente.token,
    );
    expect(r.estado).not.toBe(200);
    const saldo = await m.DB.prepare(
      "SELECT COALESCE(SUM(monto), 0) AS s FROM movimientos WHERE usuario_id = ? AND pedido_id = ? AND referencia = 'propina-extra'",
    )
      .bind(rep.id, id)
      .first<{ s: number }>();
    expect(saldo?.s).toBe(0);
    const registrada = await m.DB.prepare(
      'SELECT COUNT(*) AS n FROM propinas_extra WHERE pedido_id = ?',
    )
      .bind(id)
      .first<{ n: number }>();
    expect(registrada?.n).toBe(0);
  });
});

async function dosAgrupados(e: Awaited<ReturnType<typeof escenario>>) {
  const { m, dueno, pedidoPagado, repartidor } = e;
  const rep = await repartidor('Gru Po', 25.771, -80.191);
  const a = await pedidoPagado();
  await m.llamar('POST', `/datos/restaurante/pedidos/${a}/aceptar`, { minutos: 5 }, dueno.token);
  await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
  expect(
    (await m.llamar('POST', `/datos/repartidor/ofertas/${a}/aceptar`, {}, rep.token)).estado,
  ).toBe(200);
  const b = await pedidoPagado();
  await m.DB.prepare('UPDATE pedidos SET lat = 25.7827, lng = -80.2 WHERE id = ?').bind(b).run();
  await m.llamar('POST', `/datos/restaurante/pedidos/${b}/aceptar`, { minutos: 5 }, dueno.token);
  await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
  expect(
    (await m.llamar('POST', `/datos/repartidor/ofertas/${b}/aceptar`, {}, rep.token)).estado,
  ).toBe(200);
  return { rep, a, b };
}

describe('fallo 4 · con pedidos agrupados, el pedido «activo» es siempre el mismo', () => {
  it('el activo es el primero que se aceptó, aunque la base devuelva las filas en otro orden', async () => {
    const e = await escenario();
    const { m } = e;
    const { rep, a, b } = await dosAgrupados(e);
    // Se reescribe la fila de «a» (como hace cualquier UPDATE con cambio de tamaño de fila en
    // SQLite/D1): su posición física cambia y «LIMIT 1» sin ORDER BY puede devolver «b».
    // (Solo en la prueba se apagan las llaves foráneas para mover la fila sin tocar a sus hijas.)
    const fila = await m.DB.prepare('SELECT * FROM pedidos WHERE id = ?')
      .bind(a)
      .first<Record<string, unknown>>();
    await m.DB.exec('PRAGMA foreign_keys = OFF');
    await m.DB.prepare('DELETE FROM pedidos WHERE id = ?').bind(a).run();
    const columnas = Object.keys(fila!);
    await m.DB.prepare(
      `INSERT INTO pedidos (${columnas.join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`,
    )
      .bind(...columnas.map((k) => fila![k]))
      .run();
    await m.DB.exec('PRAGMA foreign_keys = ON');
    for (let i = 0; i < 5; i++) {
      const estado = (await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token))
        .datos;
      expect(estado.activo.id).toBe(a);
      expect(estado.agrupados.map((x: { id: string }) => x.id)).toEqual([b]);
    }
  });
});

describe('fallo 5 · soltar un pedido lo saca del grupo', () => {
  it('al soltar el segundo pedido, deja de estar agrupado y otro repartidor lo recibe solo', async () => {
    const e = await escenario();
    const { m, dueno, repartidor } = e;
    const { rep, a, b } = await dosAgrupados(e);
    const r = await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${b}/soltar`,
      { motivo: 'Se me pinchó una llanta' },
      rep.token,
    );
    expect(r.estado).toBe(200);
    const enGrupo = await m.DB.prepare(
      'SELECT COUNT(*) AS n FROM grupos_pedido WHERE pedido_id = ?',
    )
      .bind(b)
      .first<{ n: number }>();
    expect(enGrupo?.n).toBe(0);
    // El primero sigue con el repartidor, pero ya sin «agrupados».
    const estado = (await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token)).datos;
    expect(estado.activo.id).toBe(a);
    expect(estado.agrupados).toEqual([]);
    // Otro repartidor lo toma: nace limpio, sin grupo heredado.
    const otro = await repartidor('Se Gundo', 25.772, -80.192);
    await m.llamar('POST', `/datos/restaurante/pedidos/${b}/listo`, {}, dueno.token);
    await m.llamar('GET', '/datos/repartidor/ofertas', undefined, otro.token);
    expect(
      (await m.llamar('POST', `/datos/repartidor/ofertas/${b}/aceptar`, {}, otro.token)).estado,
    ).toBe(200);
    const deOtro = (await m.llamar('GET', '/datos/repartidor/estado', undefined, otro.token)).datos;
    expect(deOtro.activo.id).toBe(b);
    expect(deOtro.agrupados).toEqual([]);
  });
});
