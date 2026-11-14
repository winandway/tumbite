import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';
import { textoParaConductor } from './viajesHistorial';

/**
 * C-VIAJES-HISTORIAL (13 nov 2026) — todos los países. «Mis viajes» del pasajero y del conductor, el
 * recibo y la ayuda con el viaje adjunto (objeto olvidado como Uber, sin mostrar teléfonos).
 */
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };

async function escenario() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Paula Pasajera');
  for (const r of [
    '/datos/admin/servicios/carro',
    '/datos/admin/servicios/carro/zonas/US-FL-MIAMI',
  ])
    await m.llamar('PUT', r, { estado: 'disponible' }, admin.token);
  await m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    {
      servicio: 'carro',
      zona: 'US-FL-MIAMI',
      tarifa: { base: 300, porKm: 120, porMinuto: 25, minimo: 800 },
      motivo: 'Tarifa de prueba',
    },
    admin.token,
  );
  const cond = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
  return { m, cliente, cond };
}
type E = Awaited<ReturnType<typeof escenario>>;

async function viajeTerminado(e: E) {
  const cot = (
    await e.m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'carro', origen: ORIGEN, destino: DESTINO },
      e.cliente.token,
    )
  ).datos.cotizacion as { id: string; total: number };
  const id = (
    await e.m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: cot.id, metodoPago: 'efectivo' },
      e.cliente.token,
    )
  ).datos.viaje.id as string;
  await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token);
  expect(await e.cond.paso(id, 'aceptar')).toBe(200);
  expect(await e.cond.paso(id, 'llegue')).toBe(200);
  const pin = (await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token)).datos
    .viaje.pin;
  expect(await e.cond.paso(id, 'iniciar', { pin })).toBe(200);
  expect(await e.cond.paso(id, 'terminar')).toBe(200);
  return { id, total: cot.total };
}

describe('C-VIAJES-HISTORIAL: Mis viajes y el recibo', () => {
  it('el pasajero y el conductor ven el viaje en su lista y su recibo con desglose, pago y vehículo', async () => {
    const e = await escenario();
    const v = await viajeTerminado(e);
    const lista = await e.m.llamar('GET', '/datos/viajes/historial', undefined, e.cliente.token);
    expect(lista.estado).toBe(200);
    expect(lista.datos.viajes[0]).toMatchObject({
      id: v.id,
      servicio: 'carro',
      estado: 'terminado',
      total: v.total,
      metodoPago: 'efectivo',
    });
    expect(lista.datos.siguiente).toBeNull();
    const rec = await e.m.llamar('GET', `/datos/viajes/${v.id}/recibo`, undefined, e.cliente.token);
    expect(rec.estado).toBe(200);
    expect(rec.datos.recibo.total).toBe(v.total);
    expect(rec.datos.recibo.desglose.total).toBe(v.total);
    expect(rec.datos.recibo.distanciaM).toBeGreaterThan(0);
    expect(rec.datos.recibo.duracionS).toBeGreaterThanOrEqual(0);
    expect(rec.datos.recibo.conductor.nombre).toBe('Conductor');
    expect(rec.datos.recibo.conductor.vehiculo).toMatchObject({ marca: 'Toyota', plazas: 4 });
    // Nadie ve el teléfono del otro.
    expect(JSON.stringify(rec.datos)).not.toMatch(/telefono/);
    const suya = await e.m.llamar(
      'GET',
      '/datos/conductor/viajes/historial',
      undefined,
      e.cond.token,
    );
    expect(suya.datos.viajes[0].id).toBe(v.id);
    const recC = await e.m.llamar(
      'GET',
      `/datos/conductor/viajes/${v.id}/recibo`,
      undefined,
      e.cond.token,
    );
    expect(recC.datos.recibo.total).toBe(v.total);
    // Otro pasajero no ve ese recibo.
    const otro = await e.m.cuenta('cliente', 'Otro Pasajero');
    expect(
      (await e.m.llamar('GET', `/datos/viajes/${v.id}/recibo`, undefined, otro.token)).estado,
    ).toBe(404);
  });

  it('la lista va por páginas de 20 con el cursor de la fecha', async () => {
    const e = await escenario();
    const v = await viajeTerminado(e);
    // Viajes viejos del mismo pasajero (fechas distintas), hechos directo en la base.
    for (let i = 1; i <= 21; i++) {
      const id = `viejo-${i}`;
      await e.m.DB.prepare(
        `INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, zona_id, estado_general, creado_en)
         VALUES (?, 'carro', 'viaje_pasajero', ?, 'US-FL-MIAMI', 'cancelada', datetime('now', ?))`,
      )
        .bind(id, e.cliente.id, `-${i} days`)
        .run();
      await e.m.DB.prepare(
        `INSERT INTO viajes (operacion_id, estado, ultimo_actor, ultima_clave, pin_recogida, metodo_pago, origen_lat, origen_lng,
           origen_direccion, destino_lat, destino_lng, destino_direccion)
         SELECT ?, 'cancelado', 'cliente', 'k-' || ?, '0000', 'efectivo', origen_lat, origen_lng, origen_direccion,
                destino_lat, destino_lng, destino_direccion FROM viajes WHERE operacion_id = ?`,
      )
        .bind(id, id, v.id)
        .run();
    }
    const p1 = await e.m.llamar('GET', '/datos/viajes/historial', undefined, e.cliente.token);
    expect(p1.datos.viajes).toHaveLength(20);
    expect(p1.datos.siguiente).toBeTruthy();
    const p2 = await e.m.llamar(
      'GET',
      `/datos/viajes/historial?antes=${encodeURIComponent(p1.datos.siguiente)}`,
      undefined,
      e.cliente.token,
    );
    expect(p2.datos.viajes).toHaveLength(2);
    expect(p2.datos.siguiente).toBeNull();
  });
});

describe('C-VIAJES-AYUDA: ayuda con el viaje adjunto y objeto olvidado', () => {
  it('«Olvidé algo» abre un ticket con el viaje, avisa al conductor y repetir no duplica', async () => {
    const e = await escenario();
    const v = await viajeTerminado(e);
    const pedir = () =>
      e.m.llamar(
        'POST',
        `/datos/viajes/${v.id}/ayuda`,
        { motivo: 'objeto_olvidado', detalle: 'Dejé una sombrilla azul en el asiento de atrás' },
        e.cliente.token,
      );
    const r = await pedir();
    expect(r.estado).toBe(201);
    const ticket = await e.m.DB.prepare(
      'SELECT tipo, usuario_id, datos_json FROM tickets WHERE id = ?',
    )
      .bind(r.datos.ticketId)
      .first<{ tipo: string; usuario_id: string; datos_json: string }>();
    expect(ticket?.tipo).toBe('soporte');
    expect(ticket?.usuario_id).toBe(e.cliente.id);
    expect(JSON.parse(ticket?.datos_json ?? '{}')).toMatchObject({
      viaje: v.id,
      motivo: 'objeto_olvidado',
    });
    const otra = await pedir();
    expect(otra.estado).toBe(200);
    expect(otra.datos).toEqual({ ticketId: r.datos.ticketId, repetido: true });
    // El conductor lo ve en su historial (sin datos de contacto del pasajero).
    const suya = await e.m.llamar(
      'GET',
      '/datos/conductor/viajes/historial',
      undefined,
      e.cond.token,
    );
    expect(suya.datos.objetosOlvidados).toEqual([
      expect.objectContaining({ viajeId: v.id, detalle: expect.stringContaining('sombrilla') }),
    ]);
    // El recibo del pasajero dice que ya hay un caso abierto.
    const rec = await e.m.llamar('GET', `/datos/viajes/${v.id}/recibo`, undefined, e.cliente.token);
    expect(rec.datos.ayuda).toEqual([{ motivo: 'objeto_olvidado', ticketId: r.datos.ticketId }]);
  });

  it('C-OLVIDE-ALGO-UNA-VEZ: dos toques a la vez dejan UN ticket; el conductor ve un texto corto sin teléfonos ni enlaces', async () => {
    const e = await escenario();
    const v = await viajeTerminado(e);
    const largo = `Mi celular +1 (305) 555-0199, escríbeme a ana@correo.com o mira www.ejemplo.com/x ${'y'.repeat(200)}`;
    const pedir = () =>
      e.m.llamar(
        'POST',
        `/datos/viajes/${v.id}/ayuda`,
        { motivo: 'objeto_olvidado', detalle: largo },
        e.cliente.token,
      );
    const [a, b] = await Promise.all([pedir(), pedir()]);
    expect(a.datos.ticketId).toBe(b.datos.ticketId);
    const n = await e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM tickets WHERE usuario_id = ? AND datos_json LIKE '%objeto_olvidado%'",
    )
      .bind(e.cliente.id)
      .first<{ n: number }>();
    expect(n?.n).toBe(1);
    const suya = await e.m.llamar(
      'GET',
      '/datos/conductor/viajes/historial',
      undefined,
      e.cond.token,
    );
    const detalle = String(suya.datos.objetosOlvidados[0]?.detalle ?? '');
    expect(detalle.length).toBeLessThanOrEqual(140);
    expect(detalle).not.toMatch(/555|0199|@|www\.|ejemplo\.com/);
    expect(textoParaConductor('Dejé una sombrilla azul')).toBe('Dejé una sombrilla azul');
  });

  it('solo el pasajero de ese viaje y dentro de 30 días', async () => {
    const e = await escenario();
    const v = await viajeTerminado(e);
    const otro = await e.m.cuenta('cliente', 'Otro Pasajero');
    const cuerpo = { motivo: 'cobro', detalle: 'Me cobraron de más' };
    expect(
      (await e.m.llamar('POST', `/datos/viajes/${v.id}/ayuda`, cuerpo, otro.token)).estado,
    ).toBe(404);
    await e.m.DB.prepare(
      "UPDATE operaciones SET creado_en = datetime('now', '-40 days') WHERE id = ?",
    )
      .bind(v.id)
      .run();
    expect(
      (await e.m.llamar('POST', `/datos/viajes/${v.id}/ayuda`, cuerpo, e.cliente.token)).estado,
    ).toBe(409);
  });
});
