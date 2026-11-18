import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { EL_VIGIA, abrirComida, escenarioVe } from './pruebas/comidaVe';

/**
 * C-ZONA-CONDUCTOR-NUEVO (robot, 18 nov 2026): la fila de repartidor nacía con Miami (el valor por
 * defecto de la tabla) aunque la cuenta ya dijera su ciudad, y así veía los servicios de Miami.
 */
describe('la fila del conductor nace con la ciudad de su cuenta', () => {
  it('al crearse por primera vez (por ejemplo, al elegir vehículo), toma la zona de la cuenta', async () => {
    const m = mundo();
    const c = await m.cuenta('repartidor', 'Conductor Vigía');
    await m.DB.prepare("UPDATE usuarios SET zona_id = 'VE-MER-ELVIGIA' WHERE id = ?")
      .bind(c.id)
      .run();
    const r = await m.llamar(
      'PUT',
      '/datos/conductor/vehiculo-activo',
      { vehiculoId: null },
      c.token,
    );
    expect(r.estado).toBe(200);
    const f = await m.DB.prepare('SELECT zona_id FROM repartidores WHERE usuario_id = ?')
      .bind(c.id)
      .first<{ zona_id: string }>();
    expect(f?.zona_id).toBe('VE-MER-ELVIGIA');
  });
  it('sin ciudad en la cuenta, la de siempre (se corrige con su primera ubicación)', async () => {
    const m = mundo();
    const c = await m.cuenta('repartidor', 'Conductor Sin Ciudad');
    await m.llamar('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: null }, c.token);
    const f = await m.DB.prepare('SELECT zona_id FROM repartidores WHERE usuario_id = ?')
      .bind(c.id)
      .first<{ zona_id: string }>();
    expect(f?.zona_id).toBe('US-FL-MIAMI');
  });

  it('al abrir Driver en El Vigía sin haberse conectado, su ubicación fija su ciudad una vez', async () => {
    const e = await escenarioVe();
    expect((await abrirComida(e)).estado).toBe(201);
    const c = await e.m.cuenta('repartidor', 'Conductor Nuevo Vigía');
    const r = await e.m.llamar(
      'POST',
      '/datos/conductor/zona-por-ubicacion',
      { lat: EL_VIGIA.lat, lng: EL_VIGIA.lng },
      c.token,
    );
    expect(r.datos).toMatchObject({ zonaId: EL_VIGIA.id, cambio: true });
    const f = await e.m.DB.prepare(
      'SELECT u.zona_id AS uz, r.zona_id AS rz FROM usuarios u JOIN repartidores r ON r.usuario_id = u.id WHERE u.id = ?',
    )
      .bind(c.id)
      .first<{ uz: string; rz: string }>();
    expect(f).toEqual({ uz: EL_VIGIA.id, rz: EL_VIGIA.id });
    // Fuera de toda zona no cambia nada; y con una ciudad ya elegida, tampoco.
    const fuera = await e.m.llamar(
      'POST',
      '/datos/conductor/zona-por-ubicacion',
      { lat: 40.7, lng: -74 },
      c.token,
    );
    expect(fuera.datos.cambio).toBe(false);
    await e.m.DB.prepare(
      "UPDATE repartidores SET ciudad_elegida_en = datetime('now') WHERE usuario_id = ?",
    )
      .bind(c.id)
      .run();
    const otra = await e.m.llamar(
      'POST',
      '/datos/conductor/zona-por-ubicacion',
      { lat: 25.77, lng: -80.19 },
      c.token,
    );
    expect(otra.datos).toMatchObject({ zonaId: EL_VIGIA.id, cambio: false });
  });
});
