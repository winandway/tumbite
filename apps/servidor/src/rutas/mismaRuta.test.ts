import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * C-MISMA-RUTA (15 nov 2026) — todos los países. «Mis viajes» trae los puntos exactos del viaje
 * (recogida, paradas y destino) sin escribir nada, y «Pedir la misma ruta» vuelve a cotizar en el
 * servidor con esos puntos: el viaje nuevo nace con el mismo trayecto y el precio de AHORA.
 */
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const PARADA = { lat: 25.775, lng: -80.16, direccion: 'Parada intermedia' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };

const cambios = async (db: D1Database) =>
  Number((await db.prepare('SELECT total_changes() AS n').first<{ n: number }>())?.n ?? 0);

async function escenario() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Paula Pasajera');
  for (const r of [
    '/datos/admin/servicios/carro',
    '/datos/admin/servicios/carro/zonas/US-FL-MIAMI',
  ])
    await m.llamar('PUT', r, { estado: 'disponible' }, admin.token);
  const tarifa = (base: number) =>
    m.llamar(
      'POST',
      '/datos/admin/viajes/tarifas',
      {
        servicio: 'carro',
        zona: 'US-FL-MIAMI',
        tarifa: { base, porKm: 120, porMinuto: 25, minimo: 800 },
        motivo: 'Tarifa de prueba',
      },
      admin.token,
    );
  await tarifa(300);
  return { m, admin, cliente, tarifa };
}

describe('C-MISMA-RUTA: Mis viajes y pedir la misma ruta', () => {
  it('el historial trae los puntos y las paradas en orden, y mirarlo no escribe', async () => {
    const e = await escenario();
    const cot = (
      await e.m.llamar(
        'POST',
        '/datos/viajes/cotizar',
        { servicio: 'carro', origen: ORIGEN, paradas: [PARADA], destino: DESTINO },
        e.cliente.token,
      )
    ).datos.cotizacion as { id: string };
    const id = (
      await e.m.llamar(
        'POST',
        '/datos/viajes',
        { cotizacionId: cot.id, metodoPago: 'efectivo' },
        e.cliente.token,
      )
    ).datos.viaje.id as string;
    const antes = await cambios(e.m.DB);
    const lista = await e.m.llamar('GET', '/datos/viajes/historial', undefined, e.cliente.token);
    expect(await cambios(e.m.DB), 'mirar Mis viajes no escribe').toBe(antes);
    expect(lista.estado).toBe(200);
    expect(lista.datos.viajes[0]).toMatchObject({
      id,
      origen: ORIGEN.direccion,
      destino: DESTINO.direccion,
      metodoPago: 'efectivo',
      puntos: {
        origen: { lat: ORIGEN.lat, lng: ORIGEN.lng },
        destino: { lat: DESTINO.lat, lng: DESTINO.lng },
        paradas: [PARADA],
      },
    });
  });

  it('repetir cotiza de nuevo con los mismos puntos y el viaje nuevo sale con el precio de ahora', async () => {
    const e = await escenario();
    const { cuerpoCotizarMismaRuta, pedidoMismaRuta } =
      await import('../../../cliente/src/viajes/mismaRuta');
    const primera = (
      await e.m.llamar(
        'POST',
        '/datos/viajes/cotizar',
        { servicio: 'carro', origen: ORIGEN, paradas: [PARADA], destino: DESTINO },
        e.cliente.token,
      )
    ).datos.cotizacion as { id: string; total: number };
    const viejo = (
      await e.m.llamar(
        'POST',
        '/datos/viajes',
        { cotizacionId: primera.id, metodoPago: 'efectivo' },
        e.cliente.token,
      )
    ).datos.viaje.id as string;
    expect(
      (
        await e.m.llamar('POST', `/datos/viajes/${viejo}/cancelar`, {}, e.cliente.token, {
          'idempotency-key': 'cancelar-misma-ruta-1',
        })
      ).estado,
    ).toBe(200);
    // La ciudad sube la tarifa: el precio viejo ya no vale.
    await e.tarifa(900);
    const lista = await e.m.llamar('GET', '/datos/viajes/historial', undefined, e.cliente.token);
    const fila = lista.datos.viajes[0];
    expect(fila.total).toBe(primera.total);
    const cuerpo = cuerpoCotizarMismaRuta(fila);
    expect(cuerpo).not.toBeNull();
    const cot = await e.m.llamar('POST', '/datos/viajes/cotizar', cuerpo, e.cliente.token);
    expect(cot.estado).toBe(201);
    expect(cot.datos.cotizacion.total).toBeGreaterThan(primera.total);
    const pedido = pedidoMismaRuta(fila, cot.datos.cotizacion);
    expect(pedido?.cuerpo).toEqual({
      cotizacionId: cot.datos.cotizacion.id,
      metodoPago: 'efectivo',
    });
    const r = await e.m.llamar('POST', '/datos/viajes', pedido?.cuerpo, e.cliente.token);
    expect(r.estado).toBe(201);
    const nuevo = r.datos.viaje.id as string;
    expect(nuevo).not.toBe(viejo);
    const otra = await e.m.llamar('GET', '/datos/viajes/historial', undefined, e.cliente.token);
    expect(otra.datos.viajes[0]).toMatchObject({
      id: nuevo,
      total: cot.datos.cotizacion.total,
      puntos: fila.puntos,
      origen: fila.origen,
      destino: fila.destino,
    });
  });
});
