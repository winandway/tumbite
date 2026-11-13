import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { mundo } from '../pruebas/ayuda';

/**
 * C-MOTO-VENEZUELA (13 nov 2026) — Venezuela. Moto lista para probar en Caracas (ciudad de pruebas):
 * la ciudad se abre con UN paso del panel, la tarifa sale del mercado (dólares) y la comisión del
 * prepago cubre la moneda del viaje.
 */
const ORIGEN = { lat: 10.4806, lng: -66.9036, direccion: 'Plaza Venezuela' };

async function escenario(host = 'staging.tumbite.com') {
  const m = mundo({}, { host });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero Caracas');
  return { m, admin, cliente };
}
type E = Awaited<ReturnType<typeof escenario>>;

const abrirCaracas = (e: E) =>
  e.m.llamar(
    'POST',
    '/datos/admin/viajes/ciudades',
    {
      servicio: 'moto',
      zona: {
        id: CCS.id,
        nombre: CCS.nombre,
        lat: CCS.lat,
        lng: CCS.lng,
        radioKm: CCS.radioKm,
        zonaHoraria: CCS.zonaHoraria,
      },
      motivo: 'Ciudad de pruebas de Moto en Venezuela',
    },
    e.admin.token,
  );

const cotizar = (e: E, destino: { lat: number; lng: number }) =>
  e.m.llamar(
    'POST',
    '/datos/viajes/cotizar',
    { servicio: 'moto', origen: ORIGEN, destino: { ...destino, direccion: 'Destino' } },
    e.cliente.token,
  );

describe('C-MOTO-VENEZUELA: Caracas se abre con un paso del panel', () => {
  it('abre la ciudad en dólares, con la tarifa de mercado y Moto encendida; Comida queda próximamente', async () => {
    const e = await escenario();
    const r = await abrirCaracas(e);
    expect(r.estado).toBe(201);
    expect(r.datos.zona).toEqual({ id: CCS.id, pais: 'VE', moneda: 'USD' });
    expect(r.datos.tarifa.moneda).toBe('USD');
    expect(r.datos.tarifa.minimo).toBe(100);
    expect(r.datos.estado).toBe('disponible');
    const comida = await e.m.DB.prepare(
      "SELECT estado FROM servicios_zona WHERE servicio_id = 'comida' AND zona_id = ?",
    )
      .bind(CCS.id)
      .first<{ estado: string }>();
    expect(comida?.estado).toBe('proximamente');
    // Repetirlo no duplica la ciudad ni deja dos tarifas activas.
    expect((await abrirCaracas(e)).estado).toBe(201);
    const activas = await e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM tarifas_viaje WHERE zona_id = ? AND servicio_id = 'moto' AND activa = 1",
    )
      .bind(CCS.id)
      .first<{ n: number }>();
    expect(activas?.n).toBe(1);
  });

  it('cotiza como el mercado de Caracas: el mínimo en un viaje corto y unos 3 dólares en 9 km', async () => {
    const e = await escenario();
    await abrirCaracas(e);
    const corto = await cotizar(e, { lat: 10.4886, lng: -66.9036 }); // ~0,9 km en línea recta
    expect(corto.estado).toBe(201);
    expect(corto.datos.cotizacion.moneda).toBe('USD');
    expect(corto.datos.cotizacion.total).toBe(100);
    const largo = await cotizar(e, { lat: 10.4806, lng: -66.8406 }); // ~6,9 km en línea recta
    expect(largo.estado).toBe(201);
    expect(largo.datos.cotizacion.total).toBeGreaterThan(250);
    expect(largo.datos.cotizacion.total).toBeLessThan(400);
  });

  it('la comisión del 10 % rige en dólares para Moto en Venezuela', async () => {
    const e = await escenario();
    const { comisionConductor } = await import('../finanzas/conductor');
    const c = await comisionConductor(e.m.DB, {
      servicio: 'ride',
      pais: 'VE',
      moneda: 'USD',
      valor: 300,
    });
    expect(c?.monto).toBe(30);
  });

  it('en producción abrir la ciudad no enciende Moto (la compuerta del país está cerrada)', async () => {
    const e = await escenario('divoox.com');
    const r = await abrirCaracas(e);
    expect(r.estado).toBe(409);
    // Y no dejó nada a medias: ni la ciudad ni la tarifa.
    expect(
      await e.m.DB.prepare('SELECT 1 FROM zonas WHERE id = ?').bind(CCS.id).first(),
    ).toBeNull();
  });
});
