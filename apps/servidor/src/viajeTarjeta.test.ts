import { describe, expect, it, vi } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { conductorDeMoto } from './pruebas/conductorMoto';

/**
 * C-VIAJE-TARJETA (29 oct 2026): el viaje con tarjeta se autoriza al pedir, empieza a buscar
 * conductor solo con el aviso firmado de Stripe, se cobra al terminar (nunca más de lo autorizado)
 * y al cancelar se cobra solo el cargo o se anula la autorización. Lo cobrado va al conductor.
 */
const ZONA = 'US-FL-MIAMI';
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };
const TARIFA = {
  base: 150,
  porKm: 60,
  porMinuto: 12,
  minimo: 400,
  cancelacionGratisS: 120,
  cargoCancelacion: 150,
};
const SECRETO = `whsec_${crypto.randomUUID()}`;

async function firmar(cuerpo: string) {
  const t = Math.floor(Date.now() / 1000);
  const llave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRETO),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const f = await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(`${t}.${cuerpo}`));
  return `t=${t},v1=${[...new Uint8Array(f)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

async function escenario() {
  const stripe: { url: string; cuerpo: string }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    stripe.push({ url: String(url), cuerpo: decodeURIComponent(String(init?.body ?? '')) });
    if (/\/payment_intents$/.test(String(url)))
      return new Response(
        JSON.stringify(
          String(init?.body ?? '').includes('off_session=true')
            ? { id: 'pi_propina', status: 'succeeded' }
            : { id: 'pi_viaje', client_secret: 'pi_viaje_secret' },
        ),
        { status: 200 },
      );
    if (String(url).endsWith('/payment_intents/pi_viaje') && (init?.method ?? 'GET') === 'GET')
      return new Response(JSON.stringify({ id: 'pi_viaje', payment_method: 'pm_1' }), {
        status: 200,
      });
    return new Response(JSON.stringify({ id: 'x', client_secret: 'cs' }), { status: 200 });
  });
  const m = mundo(
    { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: SECRETO },
    { host: 'staging.tumbite.com' },
  );
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero Uno');
  await m.llamar('PUT', '/datos/admin/servicios/moto', { estado: 'disponible' }, admin.token);
  await m.llamar(
    'PUT',
    `/datos/admin/servicios/moto/zonas/${ZONA}`,
    { estado: 'disponible' },
    admin.token,
  );
  await m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    { servicio: 'moto', zona: ZONA, tarifa: TARIFA, motivo: 'Tarifa de prueba' },
    admin.token,
  );
  const cond = await conductorDeMoto(m, ORIGEN);
  const pedir = async () => {
    const cot = (
      await m.llamar(
        'POST',
        '/datos/viajes/cotizar',
        { servicio: 'moto', origen: ORIGEN, destino: DESTINO },
        cliente.token,
      )
    ).datos.cotizacion as { id: string; total: number };
    const r = await m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: cot.id, metodoPago: 'tarjeta' },
      cliente.token,
    );
    return { cot, r, id: r.datos.viaje.id as string };
  };
  const autorizar = async (id: string, monto: number, pi = 'pi_viaje') => {
    const cuerpo = JSON.stringify({
      id: `evt_${crypto.randomUUID()}`,
      type: 'payment_intent.amount_capturable_updated',
      data: { object: { id: pi, amount_capturable: monto, metadata: { viaje_id: id } } },
    });
    return m.crudo('/datos/stripe/aviso', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': await firmar(cuerpo) },
      body: cuerpo,
    });
  };
  const estado = async (id: string) =>
    (
      await m.DB.prepare('SELECT estado FROM viajes WHERE operacion_id = ?')
        .bind(id)
        .first<{ estado: string }>()
    )?.estado;
  return { m, cliente, cond, pedir, autorizar, estado, stripe };
}

describe('viaje con tarjeta (C-VIAJE-TARJETA)', () => {
  it('se autoriza al pedir, busca conductor solo con el aviso firmado y se cobra al terminar', async () => {
    const e = await escenario();
    const { cot, r, id } = await e.pedir();
    expect(r.estado).toBe(201);
    expect(r.datos.pago.clientSecret).toBe('pi_viaje_secret');
    expect(await e.estado(id)).toBe('pago_pendiente');
    const intento = e.stripe.find((x) => /\/payment_intents$/.test(x.url));
    expect(intento?.cuerpo).toContain('capture_method=manual');
    expect(intento?.cuerpo).toContain(`amount=${cot.total}`);
    // Un aviso por otro monto no lo destraba.
    await e.autorizar(id, cot.total - 1);
    expect(await e.estado(id)).toBe('pago_pendiente');
    await e.autorizar(id, cot.total);
    expect(await e.estado(id)).toBe('buscando');
    expect(await e.cond.paso(id, 'aceptar')).toBe(200);
    expect(await e.cond.paso(id, 'llegue')).toBe(200);
    const pin = (await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token)).datos
      .viaje.pin;
    expect(await e.cond.paso(id, 'iniciar', { pin })).toBe(200);
    expect(await e.cond.paso(id, 'terminar')).toBe(200);
    expect(await e.cond.paso(id, 'terminar')).toBe(200); // reintento: no cobra dos veces
    const capturas = e.stripe.filter((x) => x.url.endsWith('/payment_intents/pi_viaje/capture'));
    expect(capturas).toHaveLength(1);
    expect(capturas[0]?.cuerpo).toContain(`amount_to_capture=${cot.total}`);
    expect(
      await e.m.DB.prepare(
        "SELECT monto FROM movimientos WHERE usuario_id = ? AND referencia = 'viaje-tarjeta-' || ?",
      )
        .bind(e.cond.id, id)
        .first(),
    ).toEqual({ monto: cot.total });
    // C-VIAJE-PROPINA: después del viaje, propina con la tarjeta guardada, una sola vez, al conductor.
    const prop = (centavos: number) =>
      e.m.llamar('POST', `/datos/viajes/${id}/propina`, { centavos }, e.cliente.token);
    expect((await prop(300)).estado).toBe(200);
    expect((await prop(300)).estado).toBe(409);
    expect(
      await e.m.DB.prepare(
        "SELECT monto, concepto FROM movimientos WHERE usuario_id = ? AND referencia = 'propina-viaje-' || ?",
      )
        .bind(e.cond.id, id)
        .first(),
    ).toEqual({ monto: 300, concepto: 'propina' });
  });

  it('cancelar sin cargo anula la autorización; con cargo cobra solo el cargo, sin deuda', async () => {
    const e = await escenario();
    const a = await e.pedir();
    await e.autorizar(a.id, a.cot.total);
    const cancelar = (id: string) =>
      e.m.crudo(`/datos/viajes/${id}/cancelar`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${e.cliente.token}`,
          'content-type': 'application/json',
          'idempotency-key': `cancelar-${id.slice(0, 8)}-cliente`,
        },
        body: '{}',
      });
    expect(await (await cancelar(a.id)).json()).toMatchObject({ ok: true, cargo: 0 });
    expect(e.stripe.some((x) => x.url.endsWith('/payment_intents/pi_viaje/cancel'))).toBe(true);
    // Con conductor y fuera de la ventana gratis: se cobra el cargo de la autorización.
    const b = await e.pedir();
    await e.autorizar(b.id, b.cot.total);
    expect(await e.cond.paso(b.id, 'aceptar')).toBe(200);
    await e.m.DB.prepare(
      "UPDATE viajes SET asignado_en = datetime('now', '-200 seconds') WHERE operacion_id = ?",
    )
      .bind(b.id)
      .run();
    expect(await (await cancelar(b.id)).json()).toMatchObject({ ok: true, cargo: 150 });
    expect(
      e.stripe.some(
        (x) => x.url.endsWith('/capture') && x.cuerpo.includes('amount_to_capture=150'),
      ),
    ).toBe(true);
    expect(
      await e.m.DB.prepare('SELECT 1 FROM deudas_pasajero WHERE operacion_id = ?')
        .bind(b.id)
        .first(),
    ).toBeNull();
    // C-CARGO-AL-AFECTADO: el cargo cobrado es del conductor que fue a buscarlo, una sola vez.
    const mov = () =>
      e.m.DB.prepare('SELECT usuario_id, monto, concepto FROM movimientos WHERE referencia = ?')
        .bind(`cargo-viaje-${b.id}`)
        .all();
    expect((await mov()).results).toEqual([
      { usuario_id: e.cond.id, monto: 150, concepto: 'entrega' },
    ]);
    await cancelar(b.id);
    expect((await mov()).results).toHaveLength(1);
  });
});
