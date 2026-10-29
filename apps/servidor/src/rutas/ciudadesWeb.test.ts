import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

// C-CIUDADES-WEB (F17): el estado público de cada ciudad lo decide el superadmin, no el código.
describe('C-CIUDADES-WEB', () => {
  it('sin cambios, la web no recibe ninguna ciudad activa', async () => {
    const m = mundo();
    const r = await m.llamar('GET', '/datos/web/ciudades');
    expect(r.estado).toBe(200);
    expect(r.datos.ciudades).toEqual({});
  });

  it('el superadmin enciende Miami y la web lo ve; un cliente no puede', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const cliente = await m.cuenta('cliente');
    expect(
      (
        await m.llamar(
          'PUT',
          '/datos/admin/web/ciudades/miami',
          { estado: 'activo' },
          cliente.token,
        )
      ).estado,
    ).toBe(403);
    const r = await m.llamar(
      'PUT',
      '/datos/admin/web/ciudades/miami',
      { estado: 'activo' },
      admin.token,
    );
    expect(r.estado).toBe(200);
    expect((await m.llamar('GET', '/datos/web/ciudades')).datos.ciudades).toEqual({
      miami: 'activo',
    });
    await m.llamar('PUT', '/datos/admin/web/ciudades/miami', { estado: 'pronto' }, admin.token);
    expect((await m.llamar('GET', '/datos/web/ciudades')).datos.ciudades).toEqual({
      miami: 'pronto',
    });
  });

  it('rechaza una ciudad con un nombre raro', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const r = await m.llamar(
      'PUT',
      '/datos/admin/web/ciudades/MIAMI%20X',
      { estado: 'activo' },
      admin.token,
    );
    expect(r.estado).toBeGreaterThanOrEqual(400);
    expect(r.estado).toBeLessThan(500);
  });
});
