import { Hono } from 'hono';
import { esquemaEntrar, esquemaRegistro, type Rol, type Usuario } from '@tumbite/compartido';
import type { Env } from '../env';
import { hashClave, nuevoId, nuevoToken, sha256, verificarClave } from '../cripto';
import { z } from 'zod';
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

const esquemaSemilla = z.object({ semilla: z.string().min(1).max(200) });

let hashFalsoGuardado: Promise<string> | null = null;
function hashFalso(): Promise<string> {
  hashFalsoGuardado ??= hashClave(crypto.randomUUID());
  return hashFalsoGuardado;
}

async function igualesSeguro(a: string, b: string): Promise<boolean> {
  return (await sha256(a)) === (await sha256(b));
}

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
  // Nadie se vuelve administrador al registrarse: eso se hace aparte, con la semilla secreta.
  const rol: Rol = d.rol;
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
  // Mismo mensaje y mismo tiempo si el correo no existe o la clave está mal:
  // no se le dice a un atacante cuál de las dos falló.
  const claveOk = await verificarClave(d.clave, fila?.clave_hash ?? (await hashFalso()));
  if (!fila || !claveOk) {
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

/**
 * Convertir una cuenta en administradora. Hace falta TODO esto a la vez:
 * haber entrado, que el correo esté en ADMIN_CORREOS y conocer ADMIN_SEMILLA
 * (secreto del panel de YaDominios). Registrarse con un correo de la lista no basta.
 */
cuentas.post('/hacer-admin', async (c) => {
  const u = exigir(c);
  const { semilla } = await leerCuerpo(c, esquemaSemilla);
  const secreto = c.env.ADMIN_SEMILLA;
  if (
    !secreto ||
    secreto.length < 24 ||
    !esAdmin(u.correo, c.env.ADMIN_CORREOS) ||
    !(await igualesSeguro(semilla, secreto))
  ) {
    throw new ErrorDatos('No se pudo completar.', undefined, 403);
  }
  await base(c).prepare("UPDATE usuarios SET rol = 'admin' WHERE id = ?").bind(u.id).run();
  return c.json({ ok: true });
});

cuentas.get('/yo', (c) => c.json({ usuario: exigir(c) }));
