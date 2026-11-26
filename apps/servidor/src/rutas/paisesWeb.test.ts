import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { paisesAbiertos } from './servicios';

/**
 * C-PAIS-ABIERTO-SIN-PRONTO (25 nov 2026) — Venezuela y todos los países. La web dice «Ya estamos en
 * …» solo para un país con al menos un servicio abierto al público; el estado sale de la base, no de
 * un texto fijo.
 */
const ciudad = (id: string, nombre: string) => ({
  servicio: 'moto',
  zona: { id, nombre, lat: 8.6219, lng: -71.651, radioKm: 15, zonaHoraria: 'America/Caracas' },
  motivo: 'Abrir Moto en la ciudad',
});

describe('C-PAIS-ABIERTO-SIN-PRONTO: países abiertos para la web', () => {
  it('sin ningún servicio abierto en Venezuela, Venezuela no sale', async () => {
    const m = mundo({}, { host: 'staging.tumbite.com' });
    const r = await m.llamar('GET', '/datos/web/paises');
    expect(r.estado).toBe(200);
    expect(r.datos.paises.VE).toBeUndefined();
  });

  it('con Moto abierta en una ciudad de Venezuela, sale Venezuela con Moto (y nada de Comida)', async () => {
    const m = mundo({}, { host: 'staging.tumbite.com' });
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const r = await m.llamar(
      'POST',
      '/datos/admin/viajes/ciudades',
      ciudad('VE-MER-UNO', 'Ciudad Uno'),
      admin.token,
    );
    expect(r.estado).toBe(201);
    const p = await m.llamar('GET', '/datos/web/paises');
    expect(p.datos.paises.VE.map((s: { id: string }) => s.id)).toEqual(['moto']);
    expect(p.datos.paises.VE[0].es).toBeTruthy();
    expect(p.datos.paises.VE[0].en).toBeTruthy();

    // Se apaga la ciudad: Venezuela vuelve a no estar abierta.
    await m.DB.prepare(
      "UPDATE servicios_zona SET estado = 'suspendido' WHERE zona_id = 'VE-MER-UNO'",
    ).run();
    expect((await m.llamar('GET', '/datos/web/paises')).datos.paises.VE).toBeUndefined();
  });

  it('Comida encendida en la ciudad pero sin ningún restaurante aprobado no cuenta (C-SERVICIO-SIN-OFERTA)', async () => {
    const m = mundo({}, { host: 'staging.tumbite.com' });
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    await m.llamar(
      'POST',
      '/datos/admin/viajes/ciudades',
      ciudad('VE-MER-CUATRO', 'Ciudad Cuatro'),
      admin.token,
    );
    await m.DB.prepare("UPDATE servicios SET estado = 'disponible' WHERE id = 'comida'").run();
    await m.DB.prepare(
      `INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('comida', 'VE-MER-CUATRO', 'disponible')
       ON CONFLICT(servicio_id, zona_id) DO UPDATE SET estado = 'disponible'`,
    ).run();
    const p = await m.llamar('GET', '/datos/web/paises');
    expect(p.datos.paises.VE.map((s: { id: string }) => s.id)).toEqual(['moto']);
  });

  it('una ciudad interna de pruebas no abre el país al público', async () => {
    const m = mundo({}, { host: 'staging.tumbite.com' });
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    await m.llamar(
      'POST',
      '/datos/admin/viajes/ciudades',
      ciudad('VE-MER-DOS', 'Ciudad Dos (pruebas)'),
      admin.token,
    );
    expect((await m.llamar('GET', '/datos/web/paises')).datos.paises.VE).toBeUndefined();
  });

  it('en producción un servicio de pasajeros cuenta solo si el país se abrió (C-MOTO-POR-PAIS)', async () => {
    const m = mundo({}, { host: 'staging.tumbite.com' });
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    await m.llamar(
      'POST',
      '/datos/admin/viajes/ciudades',
      ciudad('VE-MER-TRES', 'Ciudad Tres'),
      admin.token,
    );
    expect((await paisesAbiertos(m.DB, 'pruebas')).VE?.map((s) => s.id)).toEqual(['moto']);
    expect((await paisesAbiertos(m.DB, 'produccion')).VE).toBeUndefined();
    await m.DB.prepare('INSERT INTO config (clave, valor) VALUES (?, ?)')
      .bind(
        'pasajeros_pais:VE',
        JSON.stringify({
          servicios: ['moto'],
          solicitudMarca: '50218051',
          abiertoPor: admin.id,
          abiertoEn: '2026-11-16',
          nota: '',
        }),
      )
      .run();
    expect((await paisesAbiertos(m.DB, 'produccion')).VE?.map((s) => s.id)).toEqual(['moto']);
  });
});
