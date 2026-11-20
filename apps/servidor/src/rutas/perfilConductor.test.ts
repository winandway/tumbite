import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';

/**
 * C-PERFIL-CONDUCTOR (20 nov 2026, todos los países): «Así te ven los pasajeros». El pasajero ve el
 * perfil del conductor de SU viaje y nada privado; el conductor nuevo sale sin ceros; los sellos,
 * solo si de verdad está verificado.
 */
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };
const TARIFA = { base: 150, porKm: 60, porMinuto: 12, minimo: 400 };
const CLAVES_PUBLICAS = [
  'dato',
  'foto',
  'identidadVerificada',
  'idiomas',
  'linea',
  'nombre',
  'placa',
  'trayectoria',
  'vehiculo',
  'vehiculoVerificado',
];

async function preparar() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
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
  const cond = await conductorDeMoto(m, ORIGEN);
  // Datos privados que NUNCA pueden llegar al pasajero.
  await m.DB.prepare('UPDATE usuarios SET telefono = ? WHERE id = ?')
    .bind('+13055550000', cond.id)
    .run();
  const pedirViaje = async (token: string) => {
    const cot = (
      await m.llamar(
        'POST',
        '/datos/viajes/cotizar',
        { servicio: 'moto', origen: ORIGEN, destino: DESTINO },
        token,
      )
    ).datos.cotizacion;
    return (
      await m.llamar(
        'POST',
        '/datos/viajes',
        { cotizacionId: cot.id, metodoPago: 'efectivo' },
        token,
      )
    ).datos.viaje.id as string;
  };
  return { m, admin, cond, pedirViaje };
}

describe('C-PERFIL-CONDUCTOR · perfil del conductor', () => {
  it('el conductor nuevo sale sin trayectoria (nunca ceros) y edita idiomas y dato', async () => {
    const { m, cond } = await preparar();
    const antes = await m.llamar('GET', '/datos/repartidor/perfil', undefined, cond.token);
    expect(antes.estado).toBe(200);
    expect(antes.datos.perfil.trayectoria).toBeNull();
    expect(antes.datos.perfil.nombre).toBe('Conductor');
    expect(antes.datos.perfil.vehiculoVerificado).toBe(true);
    expect(antes.datos.perfil.identidadVerificada).toBe(false);
    expect(antes.datos.perfil.idiomas).toEqual([]);

    const r = await m.llamar(
      'PUT',
      '/datos/repartidor/perfil',
      { idiomas: ['pt', 'es', 'pt'], dato: '  Me gusta   la música.  ' },
      cond.token,
    );
    expect(r.estado).toBe(200);
    expect(r.datos.perfil.idiomas).toEqual(['es', 'pt']);
    expect(r.datos.perfil.dato).toBe('Me gusta la música.');
  });

  it('el dato con palabras ofensivas o demasiado largo no se guarda', async () => {
    const { m, cond } = await preparar();
    const malo = await m.llamar(
      'PUT',
      '/datos/repartidor/perfil',
      { idiomas: ['es'], dato: 'what the fuck' },
      cond.token,
    );
    expect(malo.estado).toBe(422);
    expect(malo.datos.campo).toBe('dato');
    const largo = await m.llamar(
      'PUT',
      '/datos/repartidor/perfil',
      { idiomas: ['es'], dato: 'a'.repeat(121) },
      cond.token,
    );
    expect(largo.estado).toBe(422);
    const raro = await m.llamar(
      'PUT',
      '/datos/repartidor/perfil',
      { idiomas: ['xx'], dato: '' },
      cond.token,
    );
    expect(raro.estado).toBe(400);
    const sigue = await m.llamar('GET', '/datos/repartidor/perfil', undefined, cond.token);
    expect(sigue.datos.perfil.dato).toBeNull();
  });

  it('el pasajero ve el perfil del conductor de SU viaje, sin nada privado', async () => {
    const { m, cond, pedirViaje } = await preparar();
    await m.llamar(
      'PUT',
      '/datos/repartidor/perfil',
      { idiomas: ['es', 'en'], dato: 'Me gusta la música.' },
      cond.token,
    );
    const pasajero = await m.cuenta('cliente', 'Paula Pasajera');
    const id = await pedirViaje(pasajero.token);
    // Mientras se busca conductor no hay perfil que mostrar.
    expect(
      (await m.llamar('GET', `/datos/viajes/${id}/conductor/perfil`, undefined, pasajero.token))
        .estado,
    ).toBe(404);
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    const r = await m.llamar(
      'GET',
      `/datos/viajes/${id}/conductor/perfil`,
      undefined,
      pasajero.token,
    );
    expect(r.estado).toBe(200);
    const p = r.datos.perfil;
    expect(Object.keys(p).sort()).toEqual(CLAVES_PUBLICAS);
    expect(p.nombre).toBe('Conductor');
    expect(p.idiomas).toEqual(['es', 'en']);
    expect(p.dato).toBe('Me gusta la música.');
    expect(p.trayectoria).toBeNull();
    expect(p.placa).toMatch(/^M/);
    const todo = JSON.stringify(r.datos);
    // Ni apellido, ni teléfono, ni correo, ni documento, ni identificadores internos.
    expect(todo).not.toContain('Moto');
    expect(todo).not.toContain('3055550000');
    expect(todo).not.toContain('@');
    expect(todo).not.toContain(cond.id);
    expect(todo).not.toMatch(/doc_|selfie|correo|telefono/);
  });

  it('el pasajero de OTRO viaje no puede leer el perfil (404)', async () => {
    const { m, cond, pedirViaje } = await preparar();
    const duena = await m.cuenta('cliente', 'Paula Pasajera');
    const id = await pedirViaje(duena.token);
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    const otro = await m.cuenta('cliente', 'Otro Pasajero');
    const r = await m.llamar('GET', `/datos/viajes/${id}/conductor/perfil`, undefined, otro.token);
    expect(r.estado).toBe(404);
    expect(JSON.stringify(r.datos)).not.toContain('Conductor');
    // Un conductor tampoco entra por la ruta del pasajero.
    expect(
      (await m.llamar('GET', `/datos/viajes/${id}/conductor/perfil`, undefined, cond.token)).estado,
    ).toBe(403);
  });

  it('con trayectoria y verificado: cifras y sellos de verdad', async () => {
    const { m, cond, pedirViaje } = await preparar();
    const pasajero = await m.cuenta('cliente', 'Paula Pasajera');
    // Cinco viajes de verdad, cada uno con su calificación (el mínimo para mostrar el promedio).
    for (let i = 0; i < 5; i++) {
      const id = await pedirViaje(pasajero.token);
      expect(await cond.paso(id, 'aceptar')).toBe(200);
      expect(await cond.paso(id, 'llegue')).toBe(200);
      const pin = (await m.llamar('GET', '/datos/viajes/actual', undefined, pasajero.token)).datos
        .viaje.pin;
      expect(await cond.paso(id, 'iniciar', { pin })).toBe(200);
      expect(await cond.paso(id, 'terminar')).toBe(200);
      expect(
        (
          await m.llamar(
            'POST',
            `/datos/viajes/${id}/calificar`,
            { estrellas: i === 0 ? 4 : 5, comentario: '' },
            pasajero.token,
          )
        ).estado,
      ).toBe(200);
    }
    const id = await pedirViaje(pasajero.token);
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    const leer = async () =>
      (await m.llamar('GET', `/datos/viajes/${id}/conductor/perfil`, undefined, pasajero.token))
        .datos.perfil;
    const sinVerificar = await leer();
    expect(sinVerificar.trayectoria).toMatchObject({ viajes: 5, calificacion: 4.8 });
    // Sin la identidad aprobada, el sello no sale aunque todo lo demás esté.
    expect(sinVerificar.identidadVerificada).toBe(false);
    expect(sinVerificar.vehiculoVerificado).toBe(true);
    await m.DB.prepare(
      "INSERT INTO kyc (usuario_id, estado) VALUES (?, 'aprobado') ON CONFLICT(usuario_id) DO UPDATE SET estado = 'aprobado'",
    )
      .bind(cond.id)
      .run();
    expect((await leer()).identidadVerificada).toBe(true);
  });
});
