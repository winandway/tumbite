import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';

/**
 * C-ENVIOS (30 oct 2026), como Uber Courier: envíos de persona a persona sobre el motor de viajes.
 * Ficha: docs/investigaciones-rea/2026-10-30-envios.md.
 */
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Dirección de entrega' };
const TARIFA = { base: 200, porKm: 90, porMinuto: 10, minimo: 600, valorMaximo: 10_000 };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PAQUETE = {
  descripcion: 'Una caja con documentos',
  valorDeclarado: 5_000,
  destinatario: { nombre: 'Lucía Destino', telefono: '3055550177' },
  sinProhibidos: true,
};

async function encender(host = 'staging.tumbite.com') {
  const m = mundo({}, { host });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Paula Remitente');
  const s = await m.llamar(
    'PUT',
    '/datos/admin/servicios/envios',
    { estado: 'disponible' },
    admin.token,
  );
  await m.llamar(
    'PUT',
    '/datos/admin/servicios/envios/zonas/US-FL-MIAMI',
    { estado: 'disponible' },
    admin.token,
  );
  await m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    { servicio: 'envios', zona: 'US-FL-MIAMI', tarifa: TARIFA, motivo: 'Tarifa de prueba' },
    admin.token,
  );
  return { m, cliente, estado: s.estado };
}

async function pedir(
  e: Awaited<ReturnType<typeof encender>>,
  paquete: object | undefined = PAQUETE,
) {
  const cot = (
    await e.m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'envios', origen: ORIGEN, destino: DESTINO },
      e.cliente.token,
    )
  ).datos.cotizacion;
  return e.m.llamar(
    'POST',
    '/datos/viajes',
    { cotizacionId: cot.id, metodoPago: 'efectivo', ...(paquete ? { paquete } : {}) },
    e.cliente.token,
  );
}

describe('Divoox Envíos (C-ENVIOS)', () => {
  it('en producción no se enciende', async () => {
    expect((await encender('divoox.com')).estado).not.toBe(200);
  });

  it('pide qué se envía y quién lo recibe, con el valor dentro del tope', async () => {
    const e = await encender();
    expect((await pedir(e, null)).estado).toBe(422);
    expect((await pedir(e, { ...PAQUETE, valorDeclarado: 50_000 })).estado).toBe(422);
    expect((await pedir(e, { ...PAQUETE, sinProhibidos: false })).estado).toBe(400);
  });

  it('de punta a punta: foto al recoger y PIN de quien recibe para entregar', async () => {
    const e = await encender();
    const cond = await conductorDeMoto(e.m, ORIGEN, 'US-FL-MIAMI', 'envios');
    const r = await pedir(e);
    expect(r.estado).toBe(201);
    const id = r.datos.viaje.id as string;
    const actual = (
      await e.m.llamar('GET', '/datos/viajes/actual?servicio=envios', undefined, e.cliente.token)
    ).datos;
    expect(actual.viaje.pin).toBeNull(); // no hay código al recoger
    expect(actual.paquete).toMatchObject({
      descripcion: 'Una caja con documentos',
      destinatario: 'Lucía Destino',
    });
    const pin = actual.paquete.pinEntrega as string;
    expect(pin).toMatch(/^\d{4}$/);
    // Un viaje en curso del mismo cliente no se mezcla con el envío.
    expect(
      (await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token)).datos.viaje,
    ).toBeNull();
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    expect(await cond.paso(id, 'llegue')).toBe(200);
    // Sin foto del paquete no sale.
    expect(await cond.paso(id, 'iniciar', {})).toBe(409);
    const foto = await e.m.crudo(`/datos/conductor/operaciones/${id}/foto-paquete`, {
      method: 'POST',
      headers: { authorization: `Bearer ${cond.token}`, 'content-type': 'image/png' },
      body: PNG as BodyInit,
    });
    expect(foto.status).toBe(201);
    expect(await cond.paso(id, 'iniciar', {})).toBe(200);
    // Con el PIN equivocado no se entrega; con el de quien recibe, sí.
    expect(await cond.paso(id, 'terminar', { pinEntrega: pin === '0000' ? '1111' : '0000' })).toBe(
      409,
    );
    expect(await cond.paso(id, 'terminar', { pinEntrega: pin })).toBe(200);
    const fin = (await e.m.llamar('GET', `/datos/viajes/${id}`, undefined, e.cliente.token)).datos;
    expect(fin.viaje.estado).toBe('terminado');
    expect(fin.paquete).toMatchObject({ recogido: true, entregado: true, pinEntrega: null });
  });
});
