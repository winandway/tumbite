import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * C-BORRAR-DESDE-SUPERADMIN (4 nov 2026, Gerencia con autorización de Richard): soporte borra una
 * cuenta creada con un correo equivocado SIN entrar con ella, con el MISMO borrado que usa la app
 * (`borrarCuenta`, una sola pieza), escribiendo BORRAR, y queda escrito quién la borró y cuándo
 * (auditoria_admin). Nunca las cuentas de revisión de las tiendas ni una con un pedido en curso.
 * Todos los países.
 */
describe('borrar una cuenta desde el superadmin', () => {
  it('soporte la borra con la misma pieza que la app y queda en el registro', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const cli = await m.cuenta('cliente', 'Persona Equivocada');
    const r = await m.llamar(
      'POST',
      `/datos/admin/usuarios/${cli.id}/borrar`,
      { confirmar: 'BORRAR', motivo: 'Correo equivocado al crearla' },
      admin.token,
    );
    expect(r.estado).toBe(200);
    const u = await m.DB.prepare('SELECT nombre, activo, correo FROM usuarios WHERE id = ?')
      .bind(cli.id)
      .first<{ nombre: string; activo: number; correo: string }>();
    expect(u).toMatchObject({ nombre: 'Cuenta borrada', activo: 0 });
    expect(u?.correo).toMatch(/^borrada-.*@tumbite\.invalid$/);
    // Su sesión ya no sirve.
    expect((await m.llamar('GET', '/datos/cuentas/yo', undefined, cli.token)).estado).toBe(401);
    const a = await m.DB.prepare(
      "SELECT actor_id, objeto, antes_json FROM auditoria_admin WHERE accion = 'cuenta_borrada'",
    ).first<{ actor_id: string; objeto: string; antes_json: string }>();
    expect(a?.actor_id).toBe(admin.id);
    expect(a?.objeto).toBe(`usuario:${cli.id}`);
    expect(JSON.parse(a?.antes_json ?? '{}')).toMatchObject({
      rol: 'cliente',
      motivo: 'Correo equivocado al crearla',
    });
  });

  it('sin la palabra BORRAR no borra; un cliente no puede borrar a otro', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const cli = await m.cuenta('cliente');
    const otro = await m.cuenta('cliente');
    const ruta = `/datos/admin/usuarios/${cli.id}/borrar`;
    expect(
      (await m.llamar('POST', ruta, { confirmar: 'SI', motivo: 'Prueba' }, admin.token)).estado,
    ).toBe(400);
    expect(
      (await m.llamar('POST', ruta, { confirmar: 'BORRAR', motivo: 'Prueba' }, otro.token)).estado,
    ).toBe(403);
    const u = await m.DB.prepare('SELECT activo FROM usuarios WHERE id = ?')
      .bind(cli.id)
      .first<{ activo: number }>();
    expect(u?.activo).toBe(1);
  });

  it('las cuentas de revisión de las tiendas no se borran', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const r = await m.llamar('POST', '/datos/cuentas/registro', {
      nombre: 'Revisor Soporte',
      correo: 'revisor.cliente@windoce.com',
      clave: 'clave-segura-1',
      rol: 'cliente',
    });
    const id = r.datos.usuario.id as string;
    const b = await m.llamar(
      'POST',
      `/datos/admin/usuarios/${id}/borrar`,
      { confirmar: 'BORRAR', motivo: 'Prueba' },
      admin.token,
    );
    expect(b.estado).toBe(409);
  });

  it('la app y el superadmin usan la misma pieza de borrado', () => {
    const leer = (f: string) => readFileSync(join(__dirname, f), 'utf8');
    expect(leer('cuentas.ts')).toMatch(/await borrarCuenta\(/);
    expect(leer('superadmin.ts')).toMatch(/await borrarCuenta\(/);
    // La pieza única es la que tiene las instrucciones del borrado; nadie más las repite.
    expect(leer('cuentas.ts')).not.toMatch(/nombre = 'Cuenta borrada'/);
    expect(leer('superadmin.ts')).not.toMatch(/nombre = 'Cuenta borrada'/);
  });

  it('en el panel, borrar está dentro de los tres puntos de la ficha y pide escribir BORRAR', () => {
    const ficha = readFileSync(
      join(__dirname, '..', '..', '..', 'panel', 'src', 'panel', 'SuperFichas.tsx'),
      'utf8',
    );
    expect(ficha).toMatch(/<MenuTresPuntos[\s\S]*borrarCuenta/);
    expect(ficha).toMatch(/\/datos\/admin\/usuarios\/\$\{id\}\/borrar/);
    expect(ficha).toMatch(/confirmar: palabra/);
  });
});
