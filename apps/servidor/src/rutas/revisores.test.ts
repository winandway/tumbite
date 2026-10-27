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
    // Repetir conserva la contraseña entregada a Google.
    const r2 = await m.llamar('POST', '/datos/admin/revisores', {}, admin.token);
    expect(r2.estado).toBe(200);
    expect(r2.datos.cuentas[1].clave).toBeNull();
    expect(
      (
        await m.llamar('POST', '/datos/cuentas/entrar', {
          correo: driver.correo,
          clave: driver.clave,
        })
      ).estado,
    ).toBe(200);
    const n = await m.DB.prepare(
      "SELECT count(*) AS n FROM usuarios WHERE correo LIKE 'revisor.%@windoce.com'",
    ).first<{ n: number }>();
    expect(n?.n).toBe(3);
  });
  it('renueva solo la clave elegida, exige confirmación y revoca su sesión anterior', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const r = await m.llamar('POST', '/datos/admin/revisores', {}, admin.token);
    const driver = r.datos.cuentas[1];
    const entrada = await m.llamar('POST', '/datos/cuentas/entrar', {
      correo: driver.correo,
      clave: driver.clave,
    });
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/admin/revisores/repartidor/clave',
          { confirmar: true },
          entrada.datos.token,
        )
      ).estado,
    ).toBe(403);
    expect(
      (await m.llamar('POST', '/datos/admin/revisores/repartidor/clave', {}, admin.token)).estado,
    ).toBe(400);
    const nueva = await m.llamar(
      'POST',
      '/datos/admin/revisores/repartidor/clave',
      { confirmar: true },
      admin.token,
    );
    expect(nueva.estado).toBe(200);
    expect(nueva.res.headers.get('cache-control')).toBe('no-store');
    expect(
      (
        await m.llamar('POST', '/datos/cuentas/entrar', {
          correo: driver.correo,
          clave: driver.clave,
        })
      ).estado,
    ).toBe(401);
    expect(
      (
        await m.llamar('POST', '/datos/cuentas/entrar', {
          correo: driver.correo,
          clave: nueva.datos.clave,
        })
      ).estado,
    ).toBe(200);
    const session = await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.77, lng: -80.19 },
      entrada.datos.token,
    );
    expect(session.estado).toBe(401);
    const cliente = r.datos.cuentas[0];
    expect(
      (
        await m.llamar('POST', '/datos/cuentas/entrar', {
          correo: cliente.correo,
          clave: cliente.clave,
        })
      ).estado,
    ).toBe(200);
  });

  it('dos creaciones concurrentes no cambian las claves del ganador', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const rs = await Promise.all(
      [1, 2].map(() => m.llamar('POST', '/datos/admin/revisores', {}, admin.token)),
    );
    expect(rs.every((r) => [200, 409].includes(r.estado))).toBe(true);
    const ganador = rs.find((r) => r.estado === 200 && r.datos.cuentas[0].clave);
    expect(ganador).toBeTruthy();
    for (const c of ganador!.datos.cuentas) {
      expect(
        (await m.llamar('POST', '/datos/cuentas/entrar', { correo: c.correo, clave: c.clave }))
          .estado,
      ).toBe(200);
    }
  });

  it('un fallo al crear el restaurante revierte las tres cuentas', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    await m.DB.exec(
      "CREATE TRIGGER fallo_revisor BEFORE INSERT ON restaurantes BEGIN SELECT RAISE(ABORT, 'fallo controlado'); END",
    );
    expect((await m.llamar('POST', '/datos/admin/revisores', {}, admin.token)).estado).toBe(500);
    const n = await m.DB.prepare(
      "SELECT count(*) AS n FROM usuarios WHERE correo LIKE 'revisor.%@windoce.com'",
    ).first<{ n: number }>();
    expect(n?.n).toBe(0);
  });
  it('no toma control de una cuenta que no fue creada como revisor', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    await m.llamar('POST', '/datos/cuentas/registro', {
      nombre: 'Soporte',
      correo: CUENTAS_REVISOR[0].correo,
      clave: 'Otra-clave-segura-1',
      rol: 'cliente',
    });
    expect((await m.llamar('POST', '/datos/admin/revisores', {}, admin.token)).estado).toBe(409);
    expect(
      (
        await m.llamar('POST', '/datos/cuentas/entrar', {
          correo: CUENTAS_REVISOR[0].correo,
          clave: 'Otra-clave-segura-1',
        })
      ).estado,
    ).toBe(200);
  });
});
