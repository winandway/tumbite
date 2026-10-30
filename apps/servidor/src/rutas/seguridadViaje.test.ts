import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';

/**
 * C-VIAJE-SEGURIDAD-2 (30 oct 2026), como el kit de seguridad de Uber: contactos de confianza, aviso
 * de desvío («¿Todo bien?») y límite de horas al volante. Moto, solo en el sitio de pruebas.
 */
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };
const TARIFA = { base: 150, porKm: 60, porMinuto: 12, minimo: 400 };

async function conViaje() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Paula Pasajera');
  for (const ruta of [
    '/datos/admin/servicios/moto',
    '/datos/admin/servicios/moto/zonas/US-FL-MIAMI',
  ])
    expect((await m.llamar('PUT', ruta, { estado: 'disponible' }, admin.token)).estado).toBe(200);
  expect(
    (
      await m.llamar(
        'POST',
        '/datos/admin/viajes/tarifas',
        { servicio: 'moto', zona: 'US-FL-MIAMI', tarifa: TARIFA, motivo: 'Tarifa de prueba' },
        admin.token,
      )
    ).estado,
  ).toBeLessThan(300);
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
  return { m, cliente, cond, id };
}

async function enCurso(v: Awaited<ReturnType<typeof conViaje>>) {
  expect(await v.cond.paso(v.id, 'aceptar')).toBe(200);
  expect(await v.cond.paso(v.id, 'llegue')).toBe(200);
  const pin = (await v.m.llamar('GET', '/datos/viajes/actual', undefined, v.cliente.token)).datos
    .viaje.pin;
  expect(await v.cond.paso(v.id, 'iniciar', { pin })).toBe(200);
}

describe('contactos de confianza (C-VIAJE-SEGURIDAD-2)', () => {
  it('hasta 5, sin repetir número, y se borran', async () => {
    const m = mundo();
    const c = await m.cuenta('cliente');
    for (let i = 0; i < 5; i++)
      expect(
        (
          await m.llamar(
            'POST',
            '/datos/seguridad/contactos',
            { nombre: `Contacto ${i}`, telefono: `305555010${i}` },
            c.token,
          )
        ).estado,
      ).toBe(201);
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/seguridad/contactos',
          { nombre: 'Sexto', telefono: '3055550199' },
          c.token,
        )
      ).estado,
    ).toBe(409);
    const lista = (await m.llamar('GET', '/datos/seguridad', undefined, c.token)).datos;
    expect(lista.contactos).toHaveLength(5);
    expect(lista.compartir).toBe('nunca');
    await m.llamar(
      'DELETE',
      `/datos/seguridad/contactos/${lista.contactos[0].id}`,
      undefined,
      c.token,
    );
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/seguridad/contactos',
          { nombre: 'Repetido', telefono: '(305) 555-0101' },
          c.token,
        )
      ).estado,
    ).toBe(409);
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/seguridad/contactos',
          { nombre: 'Malo', telefono: 'abcdefgh' },
          c.token,
        )
      ).estado,
    ).toBe(400);
    // Nadie más ve ni borra mis contactos.
    const otro = await m.cuenta('cliente');
    expect(
      (await m.llamar('GET', '/datos/seguridad', undefined, otro.token)).datos.contactos,
    ).toEqual([]);
  });

  it('al empezar el viaje, con «siempre», sus contactos reciben el enlace en vivo; con «nunca», no', async () => {
    const v = await conViaje();
    await v.m.llamar(
      'POST',
      '/datos/seguridad/contactos',
      { nombre: 'Mamá', telefono: '3055550123' },
      v.cliente.token,
    );
    await v.m.llamar(
      'PUT',
      '/datos/seguridad/compartir',
      { compartir: 'siempre' },
      v.cliente.token,
    );
    await enCurso(v);
    const enlaces = await v.m.DB.prepare(
      'SELECT COUNT(*) AS n FROM viajes_compartidos WHERE operacion_id = ?',
    )
      .bind(v.id)
      .first();
    expect(enlaces).toEqual({ n: 1 });
    const w = await conViaje();
    await w.m.llamar(
      'POST',
      '/datos/seguridad/contactos',
      { nombre: 'Mamá', telefono: '3055550123' },
      w.cliente.token,
    );
    await enCurso(w);
    expect(
      await w.m.DB.prepare('SELECT COUNT(*) AS n FROM viajes_compartidos WHERE operacion_id = ?')
        .bind(w.id)
        .first(),
    ).toEqual({ n: 0 });
  });
});

describe('«¿Todo bien?» si el viaje se sale de la ruta (C-VIAJE-SEGURIDAD-2)', () => {
  it('lejos de la ruta pregunta una vez; «estoy bien» lo cierra y «ayuda» es una emergencia', async () => {
    const v = await conViaje();
    await enCurso(v);
    const actual = async () =>
      (await v.m.llamar('GET', '/datos/viajes/actual', undefined, v.cliente.token)).datos;
    expect((await actual()).alerta).toBeNull();
    // El conductor se va ~9 km al norte de la ruta.
    await v.m.DB.prepare(
      "UPDATE repartidores SET lat = 25.86, lng = -80.2, ubicacion_en = datetime('now') WHERE usuario_id = ?",
    )
      .bind(v.cond.id)
      .run();
    const a = (await actual()).alerta;
    expect(a).toMatchObject({ tipo: 'desvio' });
    expect(
      (
        await v.m.llamar(
          'POST',
          `/datos/viajes/${v.id}/alerta`,
          { respuesta: 'bien' },
          v.cliente.token,
        )
      ).estado,
    ).toBe(200);
    expect((await actual()).alerta).toBeNull(); // no vuelve a preguntar en el mismo viaje
    // Otro pasajero no responde por mí.
    const otro = await v.m.cuenta('cliente');
    expect(
      (await v.m.llamar('POST', `/datos/viajes/${v.id}/alerta`, { respuesta: 'ayuda' }, otro.token))
        .estado,
    ).toBe(404);

    const w = await conViaje();
    await enCurso(w);
    await w.m.DB.prepare(
      "UPDATE repartidores SET lat = 25.86, lng = -80.2, ubicacion_en = datetime('now') WHERE usuario_id = ?",
    )
      .bind(w.cond.id)
      .run();
    await w.m.llamar('GET', '/datos/viajes/actual', undefined, w.cliente.token);
    const r = await w.m.llamar(
      'POST',
      `/datos/viajes/${w.id}/alerta`,
      { respuesta: 'ayuda' },
      w.cliente.token,
    );
    expect(r.datos.numero).toBe('911');
    expect(
      await w.m.DB.prepare('SELECT rol FROM emergencias_viaje WHERE operacion_id = ?')
        .bind(w.id)
        .first(),
    ).toEqual({ rol: 'pasajero' });
  });
});

describe('límite de horas al volante (C-VIAJE-SEGURIDAD-2)', () => {
  it('con 12 horas manejando en 24 no acepta viajes', async () => {
    const v = await conViaje();
    // Dos viajes viejos de 6 horas cada uno, el último terminado hace una hora.
    for (const [ini, fin] of [
      ['-14 hours', '-8 hours'],
      ['-7 hours', '-1 hours'],
    ]) {
      const op = crypto.randomUUID();
      await v.m.DB.prepare(
        `INSERT INTO operaciones (id, tipo_operacion, servicio_id, cliente_id, conductor_id, zona_id, estado_general, creado_en)
         VALUES (?, 'viaje_pasajero', 'moto', ?, ?, 'US-FL-MIAMI', 'terminada', datetime('now', ?))`,
      )
        .bind(op, v.cliente.id, v.cond.id, ini)
        .run();
      await v.m.DB.prepare(
        `INSERT INTO viajes (operacion_id, estado, ultimo_actor, ultima_clave, origen_lat, origen_lng, origen_direccion,
           destino_lat, destino_lng, destino_direccion, pin_recogida, asignado_en, terminado_en)
         VALUES (?, 'terminado', 'conductor', ?, 25.76, -80.19, 'a', 25.79, -80.13, 'b', '1234', datetime('now', ?), datetime('now', ?))`,
      )
        .bind(op, `k-${op}`, ini, fin)
        .run();
    }
    expect(await v.cond.paso(v.id, 'aceptar')).toBe(409);
  });
});
