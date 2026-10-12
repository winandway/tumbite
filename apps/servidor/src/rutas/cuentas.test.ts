import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app';
import { crearBasePruebas } from '../pruebas/d1';

let DB: D1Database;
const SEMILLA = 'semilla-de-prueba-larga-123456';
const env = () => ({ DB, ADMIN_CORREOS: 'jefe@tumbite.com', ADMIN_SEMILLA: SEMILLA });

async function llamar(
  ruta: string,
  cuerpo?: unknown,
  token?: string,
  ip = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'cf-connecting-ip': ip,
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await app.request(
    ruta,
    {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    },
    env(),
  );
  return { res, datos: (await res.json()) as Record<string, any> };
}

const nueva = {
  nombre: 'Ana Cliente',
  correo: 'Ana@Correo.com',
  clave: 'clave-segura-1',
  rol: 'cliente',
};

describe('cuentas', () => {
  beforeEach(() => {
    DB = crearBasePruebas();
  });

  it('registra, entra, dice quién soy y sale de verdad', async () => {
    const r = await llamar('/datos/cuentas/registro', nueva);
    expect(r.res.status).toBe(201);
    expect(r.datos.usuario.correo).toBe('ana@correo.com');
    expect(r.res.headers.get('set-cookie')).toContain('HttpOnly');

    const e = await llamar('/datos/cuentas/entrar', {
      correo: 'ana@correo.com',
      clave: 'clave-segura-1',
    });
    expect(e.res.status).toBe(200);
    const token = e.datos.token as string;

    const yo = await llamar('/datos/cuentas/yo', undefined, token);
    expect(yo.datos.usuario.nombre).toBe('Ana Cliente');

    await llamar('/datos/cuentas/salir', {}, token);
    const despues = await llamar('/datos/cuentas/yo', undefined, token);
    expect(despues.res.status).toBe(401);
  });

  it('no guarda la contraseña en claro', async () => {
    await llamar('/datos/cuentas/registro', nueva);
    const fila = await DB.prepare('SELECT clave_hash FROM usuarios').first<{
      clave_hash: string;
    }>();
    expect(fila?.clave_hash).toMatch(/^pbkdf2\$/);
    expect(fila?.clave_hash).not.toContain('clave-segura-1');
  });

  it('rechaza contraseña mala con un mensaje que no revela cuál falló', async () => {
    await llamar('/datos/cuentas/registro', nueva);
    const mala = await llamar('/datos/cuentas/entrar', {
      correo: 'ana@correo.com',
      clave: 'otra-clave',
    });
    const noExiste = await llamar('/datos/cuentas/entrar', {
      correo: 'nadie@correo.com',
      clave: 'otra-clave',
    });
    expect(mala.res.status).toBe(401);
    expect(mala.datos.error).toBe(noExiste.datos.error);
  });

  it('no deja registrar el mismo correo dos veces', async () => {
    await llamar('/datos/cuentas/registro', nueva);
    const otra = await llamar('/datos/cuentas/registro', { ...nueva, correo: 'ANA@correo.com' });
    expect(otra.res.status).toBe(409);
    expect(otra.datos.campo).toBe('correo');
  });

  it('valida los datos con mensajes claros', async () => {
    const corta = await llamar('/datos/cuentas/registro', { ...nueva, clave: '123' });
    expect(corta.res.status).toBe(400);
    expect(corta.datos.campo).toBe('clave');
    const admin = await llamar('/datos/cuentas/registro', { ...nueva, rol: 'admin' });
    expect(admin.res.status).toBe(400);
  });

  it('las cuentas de @windoce.com deben llamarse «Soporte»', async () => {
    const sin = await llamar('/datos/cuentas/registro', {
      ...nueva,
      correo: 'jose@windoce.com',
      nombre: 'José',
    });
    expect(sin.res.status).toBe(400);
    expect(sin.datos.campo).toBe('nombre');
    const con = await llamar('/datos/cuentas/registro', {
      ...nueva,
      correo: 'jose@windoce.com',
      nombre: 'José (Soporte)',
    });
    expect(con.res.status).toBe(201);
  });

  it('registrarse con un correo de la lista NO da poderes de administrador', async () => {
    const r = await llamar('/datos/cuentas/registro', {
      ...nueva,
      correo: 'jefe@tumbite.com',
      nombre: 'Soporte Tumbite',
    });
    expect(r.datos.usuario.rol).toBe('cliente');
  });

  it('volverse admin exige sesión, correo en la lista y la semilla correcta', async () => {
    const jefe = await llamar('/datos/cuentas/registro', {
      ...nueva,
      correo: 'jefe@tumbite.com',
      nombre: 'Soporte Tumbite',
    });
    const mala = await llamar('/datos/cuentas/hacer-admin', { semilla: 'otra' }, jefe.datos.token);
    expect(mala.res.status).toBe(403);
    const intruso = await llamar('/datos/cuentas/registro', {
      ...nueva,
      correo: 'intruso@correo.com',
    });
    const conSemilla = await llamar(
      '/datos/cuentas/hacer-admin',
      { semilla: SEMILLA },
      intruso.datos.token,
    );
    expect(conSemilla.res.status).toBe(403);
    const ok = await llamar('/datos/cuentas/hacer-admin', { semilla: SEMILLA }, jefe.datos.token);
    expect(ok.res.status).toBe(200);
    const yo = await llamar('/datos/cuentas/yo', undefined, jefe.datos.token);
    expect(yo.datos.usuario.rol).toBe('admin');
  });

  it('frena a quien prueba contraseñas a lo bruto', async () => {
    let ultimo = 0;
    for (let i = 0; i < 12; i++) {
      const r = await llamar(
        '/datos/cuentas/entrar',
        { correo: 'x@correo.com', clave: 'nada' },
        undefined,
        '203.0.113.50',
      );
      ultimo = r.res.status;
    }
    expect(ultimo).toBe(429);
  });

  it('borrar la cuenta quita los datos personales y cierra la sesión', async () => {
    const r = await llamar('/datos/cuentas/registro', nueva);
    const token = r.datos.token as string;
    const res = await app.request(
      '/datos/cuentas/yo',
      { method: 'DELETE', headers: { authorization: `Bearer ${token}` } },
      env(),
    );
    expect(res.status).toBe(200);
    expect((await llamar('/datos/cuentas/yo', undefined, token)).res.status).toBe(401);
    const fila = await DB.prepare('SELECT correo, nombre, activo FROM usuarios').first<{
      correo: string;
      nombre: string;
      activo: number;
    }>();
    expect(fila?.correo).not.toContain('correo.com');
    expect(fila?.activo).toBe(0);
    // El correo queda libre para volver a registrarse.
    expect((await llamar('/datos/cuentas/registro', nueva)).res.status).toBe(201);
  });

  it('sin sesión, quién soy responde 401', async () => {
    const r = await llamar('/datos/cuentas/yo');
    expect(r.res.status).toBe(401);
  });
});

describe('configuración de la cuenta', () => {
  it('edita el perfil, cambia la clave sabiendo la actual y cambia el correo con la clave', async () => {
    const { mundo } = await import('../pruebas/ayuda');
    const m = mundo({ YAD_TOKEN: 'x'.repeat(40) });
    const { usarTransporteCorreo } = await import('../correo');
    const enviados: { to: { address: string }[] }[] = [];
    usarTransporteCorreo(async (_u, init) => {
      enviados.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ success: true, rebotados: [] }));
    });
    const u = await m.cuenta('cliente', 'Rosa');
    const perfil = await m.llamar('GET', '/datos/cuentas/perfil', undefined, u.token);
    expect(perfil.datos.perfil.nombre).toBe('Rosa');

    const ed = await m.llamar(
      'PATCH',
      '/datos/cuentas/yo',
      { nombre: 'Rosa María', telefono: '3055550100', fechaNacimiento: '1990-05-20', idioma: 'en' },
      u.token,
    );
    expect(ed.datos.usuario.nombre).toBe('Rosa María');
    expect(
      (await m.llamar('GET', '/datos/cuentas/perfil', undefined, u.token)).datos.perfil
        .fechaNacimiento,
    ).toBe('1990-05-20');

    expect(
      (
        await m.llamar(
          'POST',
          '/datos/cuentas/clave',
          { actual: 'mala', nueva: 'nueva-clave-99' },
          u.token,
        )
      ).estado,
    ).toBe(401);
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/cuentas/clave',
          { actual: 'clave-segura-1', nueva: 'nueva-clave-99' },
          u.token,
        )
      ).estado,
    ).toBe(200);
    // La sesión actual sigue viva.
    expect((await m.llamar('GET', '/datos/cuentas/yo', undefined, u.token)).estado).toBe(200);

    const antes = enviados.length;
    const correo = await m.llamar(
      'POST',
      '/datos/cuentas/correo',
      { correo: 'rosa.nueva@ejemplo.com', clave: 'nueva-clave-99' },
      u.token,
    );
    expect(correo.datos.usuario.correo).toBe('rosa.nueva@ejemplo.com');
    expect(enviados.length).toBe(antes + 1);
    expect(enviados.at(-1)?.to[0]?.address).toBe('rosa.nueva@ejemplo.com');
    expect(
      (await m.llamar('GET', '/datos/cuentas/perfil', undefined, u.token)).datos.perfil
        .correoConfirmado,
    ).toBe(false);
    usarTransporteCorreo(null);
  });
});
