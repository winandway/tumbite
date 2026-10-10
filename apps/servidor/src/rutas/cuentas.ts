import { Hono } from 'hono';
import { esquemaEntrar, esquemaRegistro, type Rol, type Usuario } from '@tumbite/compartido';
import type { Env } from '../env';
import { hashClave, nuevoId, nuevoToken, sha256, verificarClave } from '../cripto';
import {
  COOKIE_SESION,
  DIAS_SESION,
  type Ctx,
  type Variables,
  base,
  exigir,
  leerToken,
} from '../sesion';
import { pasaTurnstile } from '../turnstile';
import { ErrorDatos, leerCuerpo } from '../validar';

export const cuentas = new Hono<{ Bindings: Env; Variables: Variables }>();

function esAdmin(correo: string, lista: string | undefined): boolean {
  return (lista ?? '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .includes(correo.toLowerCase());
}

async function abrirSesion(db: D1Database, usuarioId: string): Promise<string> {
  const token = nuevoToken();
  await db
    .prepare(`INSERT INTO sesiones (id, usuario_id, expira_en) VALUES (?, ?, datetime('now', ?))`)
    .bind(await sha256(token), usuarioId, `+${DIAS_SESION} days`)
    .run();
  return token;
}

function cookie(token: string, borrar = false): string {
  const edad = borrar ? 0 : DIAS_SESION * 86400;
  return `${COOKIE_SESION}=${borrar ? '' : token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${edad}`;
}

async function escudo(c: Ctx) {
  const ok = await pasaTurnstile(
    c.env.TURNSTILE_SECRET_KEY,
    c.req.header('cf-turnstile-response'),
    c.req.header('cf-connecting-ip'),
  );
  if (!ok)
    throw new ErrorDatos(
      'No pudimos confirmar que eres una persona. Recarga la página e intenta de nuevo.',
      undefined,
      403,
    );
}

cuentas.post('/registro', async (c) => {
  await escudo(c);
  const d = await leerCuerpo(c, esquemaRegistro);
  const db = base(c);
  const existe = await db.prepare('SELECT 1 FROM usuarios WHERE correo = ?').bind(d.correo).first();
  if (existe)
    throw new ErrorDatos(
      'Ya existe una cuenta con ese correo. Entra con tu contraseña.',
      'correo',
      409,
    );
  const rol: Rol = esAdmin(d.correo, c.env.ADMIN_CORREOS) ? 'admin' : d.rol;
  const id = nuevoId();
  await db
    .prepare(
      'INSERT INTO usuarios (id, correo, nombre, telefono, fecha_nacimiento, rol, idioma, clave_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      d.correo,
      d.nombre,
      d.telefono ?? null,
      d.fechaNacimiento ?? null,
      rol,
      d.idioma,
      await hashClave(d.clave),
    )
    .run();
  const token = await abrirSesion(db, id);
  const usuario: Usuario = { id, nombre: d.nombre, correo: d.correo, rol, idioma: d.idioma };
  c.header('Set-Cookie', cookie(token));
  return c.json({ token, usuario }, 201);
});

cuentas.post('/entrar', async (c) => {
  await escudo(c);
  const d = await leerCuerpo(c, esquemaEntrar);
  const db = base(c);
  const fila = await db
    .prepare(
      'SELECT id, nombre, correo, rol, idioma, clave_hash FROM usuarios WHERE correo = ? AND activo = 1',
    )
    .bind(d.correo)
    .first<Usuario & { clave_hash: string }>();
  // Mismo mensaje si el correo no existe o la clave está mal: no se le dice a un atacante cuál falló.
  if (!fila || !(await verificarClave(d.clave, fila.clave_hash))) {
    throw new ErrorDatos('El correo o la contraseña no coinciden.', undefined, 401);
  }
  const token = await abrirSesion(db, fila.id);
  const usuario: Usuario = {
    id: fila.id,
    nombre: fila.nombre,
    correo: fila.correo,
    rol: fila.rol,
    idioma: fila.idioma,
  };
  c.header('Set-Cookie', cookie(token));
  return c.json({ token, usuario });
});

cuentas.post('/salir', async (c) => {
  const token = leerToken(c);
  if (token && c.env.DB)
    await c.env.DB.prepare('DELETE FROM sesiones WHERE id = ?')
      .bind(await sha256(token))
      .run();
  c.header('Set-Cookie', cookie('', true));
  return c.json({ ok: true });
});

cuentas.get('/yo', (c) => c.json({ usuario: exigir(c) }));
