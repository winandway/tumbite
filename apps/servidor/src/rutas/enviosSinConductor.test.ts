import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';
import { serviciosPublicosEnZona } from './servicios';

/**
 * C-SERVICIO-SIN-OFERTA, lado del cliente (23 nov 2026, todos los países). En Tucaní (producción) Envíos
 * estaba abierto y con tarifa, pero ningún conductor de la zona lo tomaba (el único apto lo era solo
 * para Moto): la app de clientes ofrecía Envíos y Richard cayó en esa pantalla. Envíos se ofrece al
 * cliente solo si en la zona hay al menos un conductor que el reparto tomaría para Envíos.
 */
const MIAMI = { lat: 25.7617, lng: -80.1918 };

async function abrir(m: ReturnType<typeof mundo>, servicio: string) {
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  await m.llamar(
    'PUT',
    `/datos/admin/servicios/${servicio}`,
    { estado: 'disponible' },
    admin.token,
  );
  await m.llamar(
    'PUT',
    `/datos/admin/servicios/${servicio}/zonas/US-FL-MIAMI`,
    { estado: 'disponible' },
    admin.token,
  );
  await m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    {
      servicio,
      zona: 'US-FL-MIAMI',
      tarifa: { base: 200, porKm: 90, porMinuto: 10, minimo: 600 },
      motivo: 'Tarifa de prueba',
    },
    admin.token,
  );
}
async function enviosAbierto() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  await abrir(m, 'envios');
  return m;
}
const envios = async (m: ReturnType<typeof mundo>) =>
  (
    (await m.llamar('GET', `/datos/servicios?lat=${MIAMI.lat}&lng=${MIAMI.lng}`)).datos
      .servicios as { id: string; estado: string; accion: string }[]
  ).find((s) => s.id === 'envios');

describe('C-SERVICIO-SIN-OFERTA: Envíos al cliente solo donde alguien lo toma', () => {
  it('abierto y con tarifa, pero sin conductor para Envíos: «no disponible en tu zona»', async () => {
    const m = await enviosAbierto();
    expect(await envios(m)).toMatchObject({
      estado: 'no_disponible_zona',
      accion: 'no_disponible_zona',
    });
  });

  it('un conductor que solo toma Moto no cuenta para Envíos', async () => {
    const m = await enviosAbierto();
    await abrir(m, 'moto');
    await conductorDeMoto(m, MIAMI, 'US-FL-MIAMI', 'moto');
    expect(await envios(m)).toMatchObject({ estado: 'no_disponible_zona' });
  });

  it('con un conductor apto para Envíos en la zona (aunque esté desconectado), se ofrece', async () => {
    const m = await enviosAbierto();
    const c = await conductorDeMoto(m, MIAMI, 'US-FL-MIAMI', 'envios');
    await m.DB.prepare('UPDATE repartidores SET conectado = 0 WHERE usuario_id = ?')
      .bind(c.id)
      .run();
    expect(await envios(m)).toMatchObject({ estado: 'disponible', accion: 'abrir' });
  });

  it('el banner público tampoco anuncia Envíos sin quien lo tome', async () => {
    const m = await enviosAbierto();
    expect((await serviciosPublicosEnZona(m.DB, 'US-FL-MIAMI')).has('envios')).toBe(false);
    await conductorDeMoto(m, MIAMI, 'US-FL-MIAMI', 'envios');
    expect((await serviciosPublicosEnZona(m.DB, 'US-FL-MIAMI')).has('envios')).toBe(true);
  });
});
