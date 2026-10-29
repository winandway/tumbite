import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { correosEquipo } from './avisosEquipo';

// C-AVISOS-EQUIPO: cada quien elige sus avisos, pero el canario nunca se apaga y nunca queda nadie.
describe('C-AVISOS-EQUIPO', () => {
  it('sumarse, salirse, el canario fijo y nunca sin destinatarios', async () => {
    const m = mundo({ ADMIN_CORREOS: 'dueno@ejemplo.com' });
    const dueno = await m.cuenta('admin', 'Soporte Dueño');
    const ayuda = await m.cuenta('admin', 'Soporte Ayuda');
    for (const [id, correo] of [
      [dueno.id, 'dueno@ejemplo.com'],
      [ayuda.id, 'ayuda@ejemplo.com'],
    ] as const)
      await m.DB.prepare('UPDATE usuarios SET correo = ? WHERE id = ?').bind(correo, id).run();
    const env = { DB: m.DB, ADMIN_CORREOS: 'dueno@ejemplo.com' } as never;
    expect(await correosEquipo(env, 'pedidos')).toEqual(['dueno@ejemplo.com']);
    // Ayuda se suma a pedidos.
    expect(
      (
        await m.llamar(
          'PUT',
          '/datos/admin/mis-avisos',
          { tipo: 'pedidos', activo: true },
          ayuda.token,
        )
      ).estado,
    ).toBe(200);
    expect((await correosEquipo(env, 'pedidos')).sort()).toEqual([
      'ayuda@ejemplo.com',
      'dueno@ejemplo.com',
    ]);
    // El dueño se sale de pedidos: le llega a Ayuda.
    await m.llamar(
      'PUT',
      '/datos/admin/mis-avisos',
      { tipo: 'pedidos', activo: false },
      dueno.token,
    );
    expect(await correosEquipo(env, 'pedidos')).toEqual(['ayuda@ejemplo.com']);
    // El dueño se sale del canario: igual le llega.
    await m.llamar(
      'PUT',
      '/datos/admin/mis-avisos',
      { tipo: 'sistema', activo: false },
      dueno.token,
    );
    expect(await correosEquipo(env, 'sistema')).toEqual(['dueno@ejemplo.com']);
    // Si todos se salen de dinero, vuelve a la lista fija.
    await m.llamar(
      'PUT',
      '/datos/admin/mis-avisos',
      { tipo: 'dinero', activo: false },
      dueno.token,
    );
    expect(await correosEquipo(env, 'dinero')).toEqual(['dueno@ejemplo.com']);
    const mios = await m.llamar('GET', '/datos/admin/mis-avisos', undefined, dueno.token);
    expect(mios.datos.avisos).toEqual(
      expect.arrayContaining([
        { tipo: 'pedidos', activo: false, fijo: false },
        { tipo: 'sistema', activo: false, fijo: true },
      ]),
    );
  });
});
