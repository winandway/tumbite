import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

// C-ROLES-INTERNOS: perfiles del equipo y registro de quién cambió qué.
describe('C-ROLES-INTERNOS', () => {
  it('una cuenta del equipo sin perfil sigue pudiendo todo (nadie pierde acceso)', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const r = await m.llamar(
      'PUT',
      '/datos/admin/web/ciudades/miami',
      { estado: 'pronto' },
      admin.token,
    );
    expect(r.estado).toBe(200);
  });

  it('Total asigna Soporte; Soporte no toca dinero ni el equipo, y sus cambios quedan anotados', async () => {
    const m = mundo();
    const jefe = await m.cuenta('admin', 'Soporte Jefe');
    const ayudante = await m.cuenta('admin', 'Soporte Ayuda');
    const asignar = await m.llamar(
      'PUT',
      `/datos/admin/equipo/${ayudante.id}`,
      { perfil: 'soporte' },
      jefe.token,
    );
    expect(asignar.estado).toBe(200);
    // Mirar sí.
    expect(
      (await m.llamar('GET', '/datos/admin/finanzas/cancelaciones', undefined, ayudante.token))
        .estado,
    ).toBe(200);
    // Cambiar dinero no.
    const dinero = await m.llamar(
      'POST',
      '/datos/admin/finanzas/cancelaciones',
      {
        servicio: 'food',
        pais: 'US',
        moneda: 'USD',
        regla: { antesDeRecoger: { tipo: 'liberar' }, despuesDeRecoger: { tipo: 'liberar' } },
        motivo: 'prueba',
      },
      ayudante.token,
    );
    expect(dinero.estado).toBe(403);
    expect(dinero.datos.error).toMatch(/Soporte|Support/);
    // Ni el equipo.
    expect(
      (
        await m.llamar(
          'PUT',
          `/datos/admin/equipo/${jefe.id}`,
          { perfil: 'lectura' },
          ayudante.token,
        )
      ).estado,
    ).toBe(403);
    // Nadie se cambia a sí mismo.
    expect(
      (await m.llamar('PUT', `/datos/admin/equipo/${jefe.id}`, { perfil: 'lectura' }, jefe.token))
        .estado,
    ).toBe(409);
    const acciones = await m.llamar('GET', '/datos/admin/equipo/acciones', undefined, jefe.token);
    expect(acciones.datos.acciones[0]).toMatchObject({
      usuarioId: jefe.id,
      metodo: 'PUT',
      estado: 409,
    });
    expect(
      acciones.datos.acciones.some(
        (a: { usuarioId: string; estado: number }) => a.usuarioId === jefe.id && a.estado === 200,
      ),
    ).toBe(true);
    const lista = await m.llamar('GET', '/datos/admin/equipo', undefined, jefe.token);
    expect(lista.datos.miPerfil).toBe('total');
    expect(lista.datos.equipo.find((x: { id: string }) => x.id === ayudante.id).perfil).toBe(
      'soporte',
    );
  });

  it('Solo lectura no cambia nada', async () => {
    const m = mundo();
    const jefe = await m.cuenta('admin', 'Soporte Jefe');
    const mira = await m.cuenta('admin', 'Soporte Mira');
    await m.llamar('PUT', `/datos/admin/equipo/${mira.id}`, { perfil: 'lectura' }, jefe.token);
    expect(
      (await m.llamar('PUT', '/datos/admin/web/ciudades/miami', { estado: 'activo' }, mira.token))
        .estado,
    ).toBe(403);
    expect((await m.llamar('GET', '/datos/admin/web/ciudades', undefined, mira.token)).estado).toBe(
      200,
    );
  });
});
