import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';

/**
 * C-MOTO-CIUDAD (30 oct 2026): interruptores por ciudad, como Uber en cada mercado: el código para
 * empezar (siempre, solo de noche o nunca) y la selfie con el casco puesto antes de aceptar.
 */
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };
const TARIFA = { base: 150, porKm: 60, porMinuto: 12, minimo: 400 };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function preparar(ajuste?: { pin: string; selfieCasco: boolean }) {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Paula Pasajera');
  for (const ruta of [
    '/datos/admin/servicios/moto',
    '/datos/admin/servicios/moto/zonas/US-FL-MIAMI',
  ])
    expect((await m.llamar('PUT', ruta, { estado: 'disponible' }, admin.token)).estado).toBe(200);
  await m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    { servicio: 'moto', zona: 'US-FL-MIAMI', tarifa: TARIFA, motivo: 'Tarifa de prueba' },
    admin.token,
  );
  if (ajuste)
    expect(
      (
        await m.llamar(
          'PUT',
          '/datos/admin/viajes/ajustes',
          { zona: 'US-FL-MIAMI', servicio: 'moto', ...ajuste },
          admin.token,
        )
      ).estado,
    ).toBe(200);
  const cond = await conductorDeMoto(m, ORIGEN);
  const cot = (
    await m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'moto', origen: ORIGEN, destino: DESTINO },
      cliente.token,
    )
  ).datos.cotizacion;
  const id = (
    await m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: cot.id, metodoPago: 'efectivo' },
      cliente.token,
    )
  ).datos.viaje.id as string;
  return { m, admin, cliente, cond, id };
}

describe('interruptores de Moto por ciudad (C-MOTO-CIUDAD)', () => {
  it('sin ajuste: código siempre, como hoy', async () => {
    const v = await preparar();
    expect(
      (await v.m.llamar('GET', '/datos/viajes/actual', undefined, v.cliente.token)).datos.viaje.pin,
    ).toMatch(/^\d{4}$/);
    expect(await v.cond.paso(v.id, 'aceptar')).toBe(200);
    expect(await v.cond.paso(v.id, 'llegue')).toBe(200);
    expect(await v.cond.paso(v.id, 'iniciar', {})).toBe(400);
  });

  it('con «nunca», el pasajero no ve código y el viaje empieza sin pedirlo', async () => {
    const v = await preparar({ pin: 'nunca', selfieCasco: false });
    expect(
      (await v.m.llamar('GET', '/datos/viajes/actual', undefined, v.cliente.token)).datos.viaje.pin,
    ).toBeNull();
    expect(await v.cond.paso(v.id, 'aceptar')).toBe(200);
    const actual = (
      await v.m.llamar('GET', '/datos/conductor/operaciones/actual', undefined, v.cond.token)
    ).datos.operacion;
    expect(actual.pin_requerido).toBe(0);
    expect(await v.cond.paso(v.id, 'llegue')).toBe(200);
    expect(await v.cond.paso(v.id, 'iniciar', {})).toBe(200);
  });

  it('con la selfie con casco encendida, no acepta sin una de las últimas 12 horas', async () => {
    const v = await preparar({ pin: 'siempre', selfieCasco: true });
    const r = await v.m.crudo(`/datos/conductor/operaciones/${v.id}/aceptar`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${v.cond.token}`,
        'content-type': 'application/json',
        'idempotency-key': 'aceptar-casco-1',
      },
      body: '{}',
    });
    expect(r.status).toBe(409);
    expect(((await r.json()) as { campo: string }).campo).toBe('selfie_casco');
    const foto = await v.m.crudo('/datos/conductor/selfie-casco', {
      method: 'POST',
      headers: { authorization: `Bearer ${v.cond.token}`, 'content-type': 'image/png' },
      body: PNG as BodyInit,
    });
    expect(foto.status).toBe(201);
    expect(await v.cond.paso(v.id, 'aceptar')).toBe(200);
  });

  it('solo el equipo cambia los interruptores, y queda en el registro', async () => {
    const v = await preparar();
    expect(
      (
        await v.m.llamar(
          'PUT',
          '/datos/admin/viajes/ajustes',
          { zona: 'US-FL-MIAMI', servicio: 'moto', pin: 'noche', selfieCasco: false },
          v.cliente.token,
        )
      ).estado,
    ).toBe(403);
    await v.m.llamar(
      'PUT',
      '/datos/admin/viajes/ajustes',
      { zona: 'US-FL-MIAMI', servicio: 'moto', pin: 'noche', selfieCasco: true },
      v.admin.token,
    );
    const lista = (await v.m.llamar('GET', '/datos/admin/viajes/ajustes', undefined, v.admin.token))
      .datos.ajustes;
    expect(lista).toEqual([
      expect.objectContaining({
        zona: 'US-FL-MIAMI',
        servicio: 'moto',
        pin: 'noche',
        selfieCasco: true,
      }),
    ]);
    expect(
      await v.m.DB.prepare(
        "SELECT accion FROM auditoria_admin WHERE accion = 'ajustes_viaje'",
      ).first(),
    ).toEqual({ accion: 'ajustes_viaje' });
  });
});
