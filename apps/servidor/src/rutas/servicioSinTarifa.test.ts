import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';
import { saludTarifas } from './servicios';

/**
 * C-SERVICIO-SIN-TARIFA (18 nov 2026, todos los países). El robot de Android en El Vigía (pruebas):
 * Envíos salía en el inicio como disponible, pero al cotizar decía «Este servicio todavía no tiene
 * precio en tu ciudad.». Un servicio con tarifa por ciudad no se ofrece sin tarifa activa, y la
 * salud lo avisa.
 */
const MIAMI = { lat: 25.7617, lng: -80.1918 };

async function encenderEnvios(host = 'staging.tumbite.com') {
  const m = mundo({}, { host });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  await m.llamar('PUT', '/datos/admin/servicios/envios', { estado: 'disponible' }, admin.token);
  await m.llamar(
    'PUT',
    '/datos/admin/servicios/envios/zonas/US-FL-MIAMI',
    { estado: 'disponible' },
    admin.token,
  );
  return { m, admin };
}
const estadoEnvios = async (m: ReturnType<typeof mundo>) =>
  (
    (await m.llamar('GET', `/datos/servicios?lat=${MIAMI.lat}&lng=${MIAMI.lng}`)).datos
      .servicios as { id: string; estado: string; accion: string }[]
  ).find((s) => s.id === 'envios');

describe('C-SERVICIO-SIN-TARIFA: sin tarifa en la ciudad, el servicio no se ofrece', () => {
  it('encendido sin tarifa sale «no disponible en tu zona»; con tarifa, disponible', async () => {
    const { m, admin } = await encenderEnvios();
    expect(await estadoEnvios(m)).toMatchObject({
      estado: 'no_disponible_zona',
      accion: 'no_disponible_zona',
    });
    await m.llamar(
      'POST',
      '/datos/admin/viajes/tarifas',
      {
        servicio: 'envios',
        zona: 'US-FL-MIAMI',
        tarifa: { base: 200, porKm: 90, porMinuto: 10, minimo: 600 },
        motivo: 'Tarifa de prueba',
      },
      admin.token,
    );
    // C-SERVICIO-SIN-OFERTA: además de la tarifa, alguien en la zona que lo tome.
    await conductorDeMoto(m, MIAMI, 'US-FL-MIAMI', 'envios');
    expect(await estadoEnvios(m)).toMatchObject({ estado: 'disponible', accion: 'abrir' });
  });

  it('la salud lo avisa: «pendiente» en pruebas y «error» en producción', async () => {
    const { m } = await encenderEnvios();
    expect(await saludTarifas(m.DB, 'pruebas')).toBe('pendiente');
    expect(await saludTarifas(m.DB, 'produccion')).toBe('error');
    await m.DB.prepare(
      `INSERT INTO tarifas_viaje (id, servicio_id, zona_id, moneda, base, por_km, por_minuto, minimo,
         espera_gratis_s, por_minuto_espera, cancelacion_gratis_s, cargo_cancelacion, cargo_no_se_presento,
         tope_dinamico_pb, redondeo, activa, motivo)
       VALUES ('t-envios', 'envios', 'US-FL-MIAMI', 'USD', 200, 90, 10, 600, 180, 5, 120, 50, 50, 10000, 1, 1, 'prueba')`,
    ).run();
    expect(await saludTarifas(m.DB, 'produccion')).toBe('ok');
  });

  it('un servicio en piloto sin tarifa también cuenta', async () => {
    const m = mundo({}, { host: 'staging.tumbite.com' });
    await m.DB.prepare(
      "INSERT INTO servicios_piloto (servicio_id, zona_id) VALUES ('envios', 'US-FL-MIAMI')",
    ).run();
    expect(await saludTarifas(m.DB, 'produccion')).toBe('error');
  });
});
