import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';

/**
 * C-CARRO-PRUEBAS (30 oct 2026): Divoox Carro sobre el motor de Moto, solo en el sitio de pruebas.
 * Ficha: docs/investigaciones-rea/2026-10-30-carro.md.
 */
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };
const TARIFA = { base: 300, porKm: 120, porMinuto: 25, minimo: 800 };

async function encender(host: string) {
  const m = mundo({}, { host });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Paula Pasajera');
  const s = await m.llamar(
    'PUT',
    '/datos/admin/servicios/carro',
    { estado: 'disponible' },
    admin.token,
  );
  const z = await m.llamar(
    'PUT',
    '/datos/admin/servicios/carro/zonas/US-FL-MIAMI',
    { estado: 'disponible' },
    admin.token,
  );
  return { m, admin, cliente, estados: [s.estado, z.estado] };
}

describe('Divoox Carro (C-CARRO-PRUEBAS)', () => {
  it('en producción no se enciende', async () => {
    const { estados } = await encender('divoox.com');
    expect(estados[0]).not.toBe(200);
  });

  it('en pruebas, un viaje en carro va de punta a punta y solo se ofrece a quien tiene carro', async () => {
    const { m, admin, cliente, estados } = await encender('staging.tumbite.com');
    expect(estados).toEqual([200, 200]);
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/admin/viajes/tarifas',
          { servicio: 'carro', zona: 'US-FL-MIAMI', tarifa: TARIFA, motivo: 'Tarifa de prueba' },
          admin.token,
        )
      ).estado,
    ).toBeLessThan(300);
    // Un conductor de moto conectado al lado: no debe recibir el viaje en carro.
    const moto = await conductorDeMoto(m, ORIGEN);
    const carro = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
    const cot = (
      await m.llamar(
        'POST',
        '/datos/viajes/cotizar',
        { servicio: 'carro', origen: ORIGEN, destino: DESTINO },
        cliente.token,
      )
    ).datos.cotizacion;
    expect(cot.total).toBeGreaterThanOrEqual(800);
    const id = (
      await m.llamar(
        'POST',
        '/datos/viajes',
        { cotizacionId: cot.id, metodoPago: 'efectivo' },
        cliente.token,
      )
    ).datos.viaje.id as string;
    await m.llamar('GET', '/datos/viajes/actual', undefined, cliente.token);
    expect(await moto.paso(id, 'aceptar')).toBe(409);
    expect(await carro.paso(id, 'aceptar')).toBe(200);
    const viaje = (await m.llamar('GET', '/datos/viajes/actual', undefined, cliente.token)).datos
      .viaje;
    expect(viaje.servicio).toBe('carro');
    expect(viaje.conductor.vehiculo.marca).toBe('Toyota');
    expect(await carro.paso(id, 'llegue')).toBe(200);
    expect(await carro.paso(id, 'iniciar', { pin: viaje.pin })).toBe(200);
    const fin = await m.crudo(`/datos/conductor/operaciones/${id}/terminar`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${carro.token}`,
        'content-type': 'application/json',
        'idempotency-key': 'terminar-carro-1',
      },
      body: '{}',
    });
    expect(fin.status).toBe(200);
    expect(((await fin.json()) as { totalFinal: number }).totalFinal).toBe(cot.total);
  });
});
