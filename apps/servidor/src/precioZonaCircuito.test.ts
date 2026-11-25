import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { conductorDeMoto } from './pruebas/conductorMoto';
import { conciliarViajes } from './conciliacionViajes';

/**
 * C-PRECIO-ZONA · circuito de punta a punta (24 nov 2026, devolución del revisor de calidad) — todos
 * los países. Un viaje de ida y vuelta con precio de la zona, pagado con tarjeta (Stripe simulado):
 * cotiza, pide, el conductor ve la oferta con el precio de la zona, nadie puede cambiar las paradas a
 * mitad de viaje (ni el pasajero ni el conductor saltando la vuelta), hace la parada, termina, se cobra
 * EXACTAMENTE el precio de la zona, lo cobrado llega entero al conductor y la conciliación cuadra. La
 * ficha del equipo dice el precio de la zona y el desglose guardado lo conserva.
 */
const ZONA = 'US-FL-MIAMI';
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Lugar de llegada' };
const TARIFA = { base: 150, porKm: 60, porMinuto: 12, minimo: 400 };
const SECRETO = `whsec_${crypto.randomUUID()}`;

afterEach(() => vi.unstubAllGlobals());

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
      return Response.json({ id: 'pi_zona', client_secret: 'pi_zona_secret' });
    if (String(url).endsWith('/payment_intents/pi_zona') && (init?.method ?? 'GET') === 'GET')
      return Response.json({ id: 'pi_zona', payment_method: 'pm_1' });
    return Response.json({ id: 'x', client_secret: 'cs' });
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
  const cotizar = async (extra: object = {}) =>
    m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'moto', origen: ORIGEN, destino: DESTINO, ...extra },
      cliente.token,
    );
  const calculado = Number((await cotizar()).datos.cotizacion.total);
  const ida = Math.round(calculado * 0.5);
  const vuelta = Math.round(calculado * 0.9);
  const ruta = await m.llamar(
    'POST',
    '/datos/admin/viajes/precios-zona',
    {
      zona: ZONA,
      servicio: 'moto',
      desde: null,
      hasta: { lat: DESTINO.lat, lng: DESTINO.lng, radioKm: 1, nombre: 'Plaza de llegada' },
      precio: ida,
      precioIdaVuelta: vuelta,
    },
    admin.token,
  );
  expect(ruta.estado, JSON.stringify(ruta.datos)).toBe(201);
  const cond = await conductorDeMoto(m, ORIGEN);
  const autorizar = async (id: string, monto: number) => {
    const cuerpo = JSON.stringify({
      id: `evt_${crypto.randomUUID()}`,
      type: 'payment_intent.amount_capturable_updated',
      data: { object: { id: 'pi_zona', amount_capturable: monto, metadata: { viaje_id: id } } },
    });
    return m.crudo('/datos/stripe/aviso', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': await firmar(cuerpo) },
      body: cuerpo,
    });
  };
  const ubicar = (p: { lat: number; lng: number }) =>
    m.DB.prepare(
      "UPDATE repartidores SET lat = ?, lng = ?, ubicacion_en = datetime('now') WHERE usuario_id = ?",
    )
      .bind(p.lat, p.lng, cond.id)
      .run();
  const parada = (id: string, paso: string) =>
    m.llamar('POST', `/datos/conductor/operaciones/${id}/paradas/1/${paso}`, {}, cond.token);
  return { m, admin, cliente, cond, cotizar, autorizar, ubicar, parada, stripe, vuelta };
}

describe('C-PRECIO-ZONA · un viaje de ida y vuelta con precio de la zona, de punta a punta', () => {
  it('se cobra el precio de la zona, llega entero al conductor, la conciliación cuadra y no admite cambios de paradas', async () => {
    const e = await escenario();
    const cot = (await e.cotizar({ idaVuelta: true })).datos.cotizacion as {
      id: string;
      total: number;
      precioZona: boolean;
      idaVuelta: boolean;
    };
    expect(cot.precioZona).toBe(true);
    expect(cot.idaVuelta).toBe(true);
    expect(cot.total).toBe(e.vuelta);
    const r = await e.m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: cot.id, metodoPago: 'tarjeta' },
      e.cliente.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    const id = r.datos.viaje.id as string;
    expect(e.stripe.find((x) => /\/payment_intents$/.test(x.url))?.cuerpo).toContain(
      `amount=${e.vuelta}`,
    );
    await e.autorizar(id, e.vuelta);

    // La oferta del conductor dice el precio de la zona y que es de ida y vuelta.
    const ofertas = await e.m.llamar(
      'GET',
      '/datos/conductor/operaciones/ofertas',
      undefined,
      e.cond.token,
    );
    const oferta = (
      ofertas.datos.ofertas as { operacionId: string; precioZona: boolean; idaVuelta: boolean }[]
    ).find((o) => o.operacionId === id);
    expect(oferta?.precioZona).toBe(true);
    expect(oferta?.idaVuelta).toBe(true);

    expect(await e.cond.paso(id, 'aceptar')).toBe(200);
    expect(await e.cond.paso(id, 'llegue')).toBe(200);
    const pin = (await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token)).datos
      .viaje.pin;
    expect(await e.cond.paso(id, 'iniciar', { pin })).toBe(200);

    // Nadie cambia las paradas: ni el pasajero agrega una, ni el conductor salta la vuelta.
    const otra = await e.m.llamar(
      'POST',
      `/datos/viajes/${id}/paradas`,
      {
        paradas: [
          { lat: 25.77, lng: -80.16, direccion: 'Otra parada' },
          { lat: DESTINO.lat, lng: DESTINO.lng, direccion: DESTINO.direccion },
        ],
        confirmar: true,
      },
      e.cliente.token,
    );
    expect(otra.estado).toBe(409);
    expect(otra.datos.error).toMatch(/precio de la zona|local fixed price/);
    const saltar = await e.parada(id, 'saltar');
    expect(saltar.estado).toBe(409);

    // La vuelta: llega a la parada, sigue y termina en la recogida.
    await e.ubicar(DESTINO);
    expect((await e.parada(id, 'llegue')).estado).toBe(200);
    expect((await e.parada(id, 'seguir')).estado).toBe(200);
    await e.ubicar(ORIGEN);
    expect(await e.cond.paso(id, 'terminar')).toBe(200);

    // Se cobró exactamente el precio de la zona y llegó entero al conductor.
    const capturas = e.stripe.filter((x) => x.url.endsWith('/payment_intents/pi_zona/capture'));
    expect(capturas).toHaveLength(1);
    expect(capturas[0]?.cuerpo).toContain(`amount_to_capture=${e.vuelta}`);
    const v = await e.m.DB.prepare(
      `SELECT v.total_final_centavos AS final, q.total, q.desglose_json
         FROM viajes v JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id WHERE v.operacion_id = ?`,
    )
      .bind(id)
      .first<{ final: number; total: number; desglose_json: string }>();
    expect(v?.final).toBe(e.vuelta);
    expect(v?.total).toBe(e.vuelta);
    const desglose = JSON.parse(String(v?.desglose_json)) as Record<string, unknown>;
    expect(desglose.precioZona).toBe(e.vuelta);
    expect(desglose.idaVuelta).toBe(1);
    expect(
      await e.m.DB.prepare(
        "SELECT monto FROM movimientos WHERE usuario_id = ? AND referencia = 'viaje-tarjeta-' || ?",
      )
        .bind(e.cond.id, id)
        .first(),
    ).toEqual({ monto: e.vuelta });
    const hoy = new Date().toISOString().slice(0, 10);
    const conc = await conciliarViajes(e.m.DB, hoy);
    expect(conc.cuadra, JSON.stringify(conc.detalle)).toBe(true);
    expect(conc.capturado).toBe(e.vuelta);

    // La ficha del equipo dice el precio de la zona (y lo que habría salido por distancia).
    const ficha = await e.m.llamar('GET', `/datos/admin/viajes/${id}`, undefined, e.admin.token);
    expect(ficha.estado).toBe(200);
    const importe = (ficha.datos.viaje ?? ficha.datos).importe as {
      precioZona?: number;
      calculado?: number;
    };
    expect(importe.precioZona).toBe(e.vuelta);
    expect(importe.calculado).toBeGreaterThan(e.vuelta);
  });
});
