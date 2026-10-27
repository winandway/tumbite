import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { CUENTAS_REVISOR } from './superadmin';

/** C-REVISORES: el botón del superadmin deja las tres cuentas del revisor listas de un clic. */
describe('cuentas del revisor de las tiendas (C-REVISORES)', () => {
  it('solo el superadmin; crea las tres cuentas y con la contraseña devuelta se entra', async () => {
    const m = mundo({ KYC_OBLIGATORIO: '1' });
    const cli = await m.cuenta('cliente');
    expect((await m.llamar('POST', '/datos/admin/revisores', {}, cli.token)).estado).toBe(403);
    const admin = await m.cuenta('admin');
    const r = await m.llamar('POST', '/datos/admin/revisores', {}, admin.token);
    expect(r.estado).toBe(200);
    expect(r.datos.cuentas.map((x: { correo: string }) => x.correo)).toEqual(
      CUENTAS_REVISOR.map((x) => x.correo),
    );
    for (const cuenta of r.datos.cuentas as { rol: string; correo: string; clave: string }[]) {
      expect(cuenta.clave).toMatch(/^[a-zA-Z0-9]{20}$/);
      const e = await m.llamar('POST', '/datos/cuentas/entrar', {
        correo: cuenta.correo,
        clave: cuenta.clave,
      });
      expect(e.estado).toBe(200);
      expect(e.datos.usuario.rol).toBe(cuenta.rol);
      expect(e.datos.usuario.nombre).toMatch(/Soporte/);
    }
  });

  it('el repartidor revisor se conecta con KYC obligatorio y el restaurante queda aprobado y cerrado', async () => {
    const m = mundo({ KYC_OBLIGATORIO: '1' });
    const admin = await m.cuenta('admin');
    const r = await m.llamar('POST', '/datos/admin/revisores', {}, admin.token);
    const driver = r.datos.cuentas.find((x: { rol: string }) => x.rol === 'repartidor');
    const e = await m.llamar('POST', '/datos/cuentas/entrar', {
      correo: driver.correo,
      clave: driver.clave,
    });
    const con = await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.77, lng: -80.19 },
      e.datos.token,
    );
    expect(con.estado).toBe(200);
    expect(
      await m.DB.prepare('SELECT 1 FROM revisores WHERE correo = ?').bind(driver.correo).first(),
    ).toBeTruthy();
    const rest = await m.DB.prepare(
      "SELECT r.estado, r.abierto FROM restaurantes r JOIN usuarios u ON u.id = r.dueno_id WHERE u.correo = 'revisor.restaurante@windoce.com'",
    ).first<{ estado: string; abierto: number }>();
    expect(rest).toEqual({ estado: 'aprobado', abierto: 0 });
    // Apretar el botón otra vez renueva la contraseña sin duplicar nada.
    const r2 = await m.llamar('POST', '/datos/admin/revisores', {}, admin.token);
    expect(r2.estado).toBe(200);
    expect(r2.datos.cuentas[1].clave).not.toBe(driver.clave);
    const n = await m.DB.prepare(
      "SELECT count(*) AS n FROM usuarios WHERE correo LIKE 'revisor.%@windoce.com'",
    ).first<{ n: number }>();
    expect(n?.n).toBe(3);
  });
});
