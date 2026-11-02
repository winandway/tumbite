import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { conductorDeMoto } from './pruebas/conductorMoto';
import { repartirOperaciones } from './operaciones';

/**
 * BRE-R2 (2 nov 2026), arreglos que pidió el revisor de calidad para BRE-6 (C-MODO-DESTINO):
 * - el modo destino vale para todos los servicios: un viaje o envío que lo aleja de su destino no
 *   se le ofrece (antes solo se filtraba comida);
 * - el uso del día se cuenta después de guardar el destino: si guardar falla, no se gasta.
 * Todos los países.
 */
const ZONA = 'US-FL-MIAMI';
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };

async function escena() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
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
    {
      servicio: 'moto',
      zona: ZONA,
      tarifa: { base: 150, porKm: 60, porMinuto: 12, minimo: 400 },
      motivo: 'Tarifa de prueba',
    },
    admin.token,
  );
  const pedirViaje = async () => {
    const c = (
      await m.llamar(
        'POST',
        '/datos/viajes/cotizar',
        { servicio: 'moto', origen: ORIGEN, destino: DESTINO },
        cliente.token,
      )
    ).datos.cotizacion;
    const r = await m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: c.id, metodoPago: 'efectivo' },
      cliente.token,
    );
    return r.datos.viaje.id as string;
  };
  const ofrecida = (operacion: string, conductor: string) =>
    m.DB.prepare(
      "SELECT 1 AS si FROM ofertas_operacion WHERE operacion_id = ? AND conductor_id = ? AND estado = 'ofrecida'",
    )
      .bind(operacion, conductor)
      .first();
  return { m, pedirViaje, ofrecida };
}

describe('BRE-R2: modo destino en todos los servicios (C-MODO-DESTINO)', () => {
  it('un viaje que lo aleja de su destino no se le ofrece; uno que lo acerca, sí', async () => {
    const e = await escena();
    const cond = await conductorDeMoto(e.m, ORIGEN);
    // Su casa queda al sur, lejos del destino del viaje (que va al noreste).
    const sur = await e.m.llamar(
      'PUT',
      '/datos/repartidor/destino',
      { direccion: 'Casa al sur', lat: 25.6, lng: -80.35 },
      cond.token,
    );
    expect(sur.estado).toBe(200);
    const viaje = await e.pedirViaje();
    await repartirOperaciones(undefined, e.m.DB);
    expect(await e.ofrecida(viaje, cond.id)).toBeNull();
    // Cambia su destino a uno junto al del viaje: ahora sí se le ofrece.
    await e.m.llamar(
      'PUT',
      '/datos/repartidor/destino',
      { direccion: 'Casa al noreste', lat: 25.795, lng: -80.128 },
      cond.token,
    );
    await repartirOperaciones(undefined, e.m.DB);
    expect(await e.ofrecida(viaje, cond.id)).not.toBeNull();
  });

  it('si guardar el destino falla, no se gasta uno de los dos usos del día', async () => {
    const e = await escena();
    const cond = await conductorDeMoto(e.m, ORIGEN);
    await e.m.DB.prepare(
      "CREATE TRIGGER falla_destino BEFORE INSERT ON modo_destino BEGIN SELECT RAISE(ABORT, 'disco lleno'); END",
    ).run();
    const r = await e.m.llamar(
      'PUT',
      '/datos/repartidor/destino',
      { direccion: 'Casa', lat: 25.9, lng: -80.2 },
      cond.token,
    );
    expect(r.estado).toBeGreaterThanOrEqual(500);
    const usos = await e.m.DB.prepare(
      'SELECT COALESCE(SUM(usos), 0) AS n FROM usos_modo_destino WHERE repartidor_id = ?',
    )
      .bind(cond.id)
      .first<{ n: number }>();
    expect(usos?.n).toBe(0);
  });
});
