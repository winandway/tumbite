import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { saludViajes } from './viajesPasajero';

/**
 * C-COMISION-MONEDA (13 nov 2026) — Venezuela y todos los países. La política de comisión del
 * prepago exige la MISMA moneda que el viaje: una ciudad que cobra en otra moneda no cobraría
 * comisión y nadie se enteraría. La tarifa y el encendido se rechazan, y la salud lo marca en rojo.
 */
const TARIFA = { base: 50, porKm: 22, porMinuto: 3, minimo: 100 };

async function escenario() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  // Colombia cobra la comisión del prepago en pesos (C-PREPAGO-MERCADOS); esta ciudad, en dólares.
  await m.DB.prepare(
    "INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa) VALUES ('CO-BOG-PRUEBAS', 'Bogotá (pruebas)', 'CO', 'USD', 'America/Bogota', 4.711, -74.0721, 25, 1)",
  ).run();
  return { m, admin };
}
const tarifa = (e: Awaited<ReturnType<typeof escenario>>, zona: string) =>
  e.m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    { servicio: 'moto', zona, tarifa: TARIFA, motivo: 'Tarifa de prueba' },
    e.admin.token,
  );

describe('C-COMISION-MONEDA: sin política en la moneda de la ciudad, el viaje no se activa', () => {
  it('la tarifa en una moneda que la comisión del país no cubre se rechaza con un mensaje claro', async () => {
    const e = await escenario();
    const r = await tarifa(e, 'CO-BOG-PRUEBAS');
    expect(r.estado).toBe(409);
    expect(r.datos.campo).toBe('moneda');
    expect(r.datos.error).toContain('COP');
    // En EE. UU. no hay prepago (Stripe Connect): la tarifa en dólares entra como siempre.
    expect((await tarifa(e, 'US-FL-MIAMI')).estado).toBe(201);
  });

  it('encender Moto en esa ciudad también se rechaza', async () => {
    const e = await escenario();
    await e.m.llamar('PUT', '/datos/admin/servicios/moto', { estado: 'disponible' }, e.admin.token);
    const r = await e.m.llamar(
      'PUT',
      '/datos/admin/servicios/moto/zonas/CO-BOG-PRUEBAS',
      { estado: 'disponible' },
      e.admin.token,
    );
    expect(r.estado).toBe(409);
    expect(r.datos.campo).toBe('moneda');
  });

  it('si una tarifa así llegara a la base por otro camino, la salud de viajes se pone en rojo', async () => {
    const e = await escenario();
    expect(await saludViajes(e.m.DB)).toBe('ok');
    await e.m.DB.prepare(
      `INSERT INTO tarifas_viaje (id, servicio_id, zona_id, moneda, base, por_km, por_minuto, minimo,
         espera_gratis_s, por_minuto_espera, cancelacion_gratis_s, cargo_cancelacion, cargo_no_se_presento,
         tope_dinamico_pb, redondeo, motivo)
       VALUES ('t-trampa', 'moto', 'CO-BOG-PRUEBAS', 'USD', 50, 22, 3, 100, 300, 5, 120, 50, 50, 10000, 1, 'a mano')`,
    ).run();
    expect(await saludViajes(e.m.DB)).toBe('error');
    // Con la política en la moneda de la ciudad, vuelve a verde.
    await e.m.DB.prepare(
      `INSERT INTO politicas_financieras (id, nombre, servicio, tipo_cuenta, pais, modalidad, moneda, regla_json, vigente_desde, revision_legal_aprobada)
       VALUES ('p-co-usd', 'Moto CO USD', 'ride', 'conductor', 'CO', 'prepago', 'USD', '{"tipo":"porcentaje","pb":1000}', '2026-01-01 00:00:00', 1)`,
    ).run();
    expect(await saludViajes(e.m.DB)).toBe('ok');
  });
});
