import { Hono } from 'hono';
import {
  PAGINAS,
  enIdiomaDireccion,
  esquemaEntrar,
  esquemaRegistro,
  type Rol,
  type Usuario,
} from '@tumbite/compartido';
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
import { enviarCorreo } from '../correo';
import { correoDeConfirmacion } from '../avisos';
import { ErrorDatos, leerCuerpo } from '../validar';

const esquemaSemilla = z.object({ semilla: z.string().min(1).max(200) });
const esquemaRecuperar = z.object({
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Escribe un correo válido.' })),
  idioma: z.enum(['es', 'en']).default('es'),
});
const esquemaRestablecer = z.object({
  token: z.string().min(20).max(200),
  clave: z
    .string()
    .min(8, { error: 'La contraseña debe tener al menos 8 caracteres.' })
    .max(200, { error: 'La contraseña es demasiado larga.' }),
});
const MINUTOS_RECUPERACION = 30;
const esquemaPerfil = z.object({
  nombre: z.string().trim().min(2, { error: 'Escribe tu nombre.' }).max(80),
  telefono: z.string().trim().max(30).default(''),
  fechaNacimiento: z.iso.date({ error: 'La fecha debe ser AAAA-MM-DD.' }).nullable().default(null),
  idioma: z.enum(['es', 'en']).default('es'),
});
const esquemaCambiarClave = z.object({
  actual: z.string().min(1, { error: 'Escribe tu contraseña actual.' }).max(200),
  nueva: z
    .string()
    .min(8, { error: 'La contraseña nueva debe tener al menos 8 caracteres.' })
    .max(200),
});
const esquemaCambiarCorreo = z.object({
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Escribe un correo válido.' })),
  clave: z.string().min(1, { error: 'Escribe tu contraseña para confirmar.' }).max(200),
});
const esquemaConfirmar = z.object({ token: z.string().min(20).max(200) });
const esquemaDispositivo = z.object({
  token: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/, {
    error: 'Ese token de avisos no es válido.',
  }),
  plataforma: z.enum(['ios', 'android', 'web', 'desconocida']).default('desconocida'),
});

const TEXTOS_RECUPERAR = {
  es: {
    asunto: 'Restablece tu contraseña de Divoox',
    cuerpo: (nombre: string, enlace: string) =>
      `Hola, ${nombre}.

Alguien pidió restablecer la contraseña de tu cuenta de Divoox. Si fuiste tú, toca este enlace (sirve una sola vez y vence en ${MINUTOS_RECUPERACION} minutos):

${enlace}

Si no fuiste tú, no hagas nada: tu contraseña sigue igual.`,
  },
  en: {
    asunto: 'Reset your Divoox password',
    cuerpo: (nombre: string, enlace: string) =>
      `Hi ${nombre},

Someone asked to reset the password for your Divoox account. If that was you, tap this link (it works once and expires in ${MINUTOS_RECUPERACION} minutes):

${enlace}

If it wasn't you, do nothing: your password stays the same.`,
  },
};

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
  await mandarConfirmacion(c.env, db, { id, nombre: d.nombre, correo: d.correo, idioma: d.idioma });
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

/** Enlace para confirmar el correo: vence en 2 días, un solo uso. No bloquea entrar. */
async function mandarConfirmacion(
  env: Env,
  db: D1Database,
  u: { id: string; nombre: string; correo: string; idioma: 'es' | 'en' },
) {
  const token = nuevoToken();
  await db
    .prepare(
      `INSERT INTO confirmaciones (id, usuario_id, expira_en) VALUES (?, ?, datetime('now', '+2 days'))`,
    )
    .bind(await sha256(token), u.id)
    .run();
  await correoDeConfirmacion(env, { correo: u.correo, nombre: u.nombre, idioma: u.idioma, token });
}

/** El teléfono registra su token de avisos. Si ya estaba, se reactiva y se anota la visita. */
cuentas.post('/dispositivo', async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(c, esquemaDispositivo);
  const db = base(c);
  // Un token solo cambia de dueño si el dueño anterior ya cerró sesión (activo = 0):
  // nadie se queda con los avisos de otro registrando su token.
  const r = await db
    .prepare(
      `INSERT INTO dispositivos (token, usuario_id, plataforma) VALUES (?, ?, ?)
       ON CONFLICT(token) DO UPDATE SET usuario_id = excluded.usuario_id, plataforma = excluded.plataforma, activo = 1, visto_en = datetime('now')
       WHERE dispositivos.usuario_id = excluded.usuario_id OR dispositivos.activo = 0`,
    )
    .bind(d.token, u.id, d.plataforma)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos(
      'Este teléfono sigue con otra cuenta. Cierra sesión allí primero.',
      undefined,
      409,
    );
  return c.json({ ok: true });
});

cuentas.delete('/dispositivo', async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(c, esquemaDispositivo);
  await base(c)
    .prepare('UPDATE dispositivos SET activo = 0 WHERE token = ? AND usuario_id = ?')
    .bind(d.token, u.id)
    .run();
  return c.json({ ok: true });
});

cuentas.post('/confirmar', async (c) => {
  const d = await leerCuerpo(c, esquemaConfirmar);
  const db = base(c);
  const id = await sha256(d.token);
  const r = await db
    .prepare(
      "SELECT usuario_id FROM confirmaciones WHERE id = ? AND usada_en IS NULL AND expira_en > datetime('now')",
    )
    .bind(id)
    .first<{ usuario_id: string }>();
  if (!r)
    throw new ErrorDatos('Este enlace ya no sirve. Entra a tu cuenta y pide otro.', undefined, 410);
  await db.batch([
    db
      .prepare("UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = ?")
      .bind(r.usuario_id),
    db.prepare("UPDATE confirmaciones SET usada_en = datetime('now') WHERE id = ?").bind(id),
  ]);
  return c.json({ ok: true });
});

/** Vuelve a mandar el enlace de confirmación a la cuenta que está entrando. */
cuentas.post('/confirmar/reenviar', async (c) => {
  const u = exigir(c);
  const db = base(c);
  const f = await db
    .prepare('SELECT correo_confirmado_en FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ correo_confirmado_en: string | null }>();
  if (f?.correo_confirmado_en) return c.json({ ok: true, yaConfirmado: true });
  await mandarConfirmacion(c.env, db, u);
  return c.json({ ok: true, yaConfirmado: false });
});

/**
 * Recuperar contraseña. Responde SIEMPRE igual (exista o no el correo), para no revelar
 * qué correos tienen cuenta. El enlace sirve una vez y vence a los 30 minutos.
 */
cuentas.post('/recuperar', async (c) => {
  await escudo(c);
  const d = await leerCuerpo(c, esquemaRecuperar);
  const db = base(c);
  const fila = await db
    .prepare('SELECT id, nombre, idioma FROM usuarios WHERE correo = ? AND activo = 1')
    .bind(d.correo)
    .first<{ id: string; nombre: string; idioma: 'es' | 'en' }>();
  if (fila) {
    const token = nuevoToken();
    await db
      .prepare(
        `INSERT INTO recuperaciones (id, usuario_id, expira_en) VALUES (?, ?, datetime('now', ?))`,
      )
      .bind(await sha256(token), fila.id, `+${MINUTOS_RECUPERACION} minutes`)
      .run();
    const base_ = (c.env.SITIO_URL ?? 'https://divoox.com').replace(/\/$/, '');
    const lengua = d.idioma ?? fila.idioma;
    const t = lengua === 'en' ? TEXTOS_RECUPERAR.en : TEXTOS_RECUPERAR.es;
    await enviarCorreo(c.env, {
      de: 'avisos',
      para: d.correo,
      asunto: t.asunto,
      texto: t.cuerpo(
        fila.nombre,
        `${base_}${enIdiomaDireccion(PAGINAS.resetPassword, lengua)}?token=${token}`,
      ),
    });
  }
  return c.json({ ok: true });
});

cuentas.post('/restablecer', async (c) => {
  const d = await leerCuerpo(c, esquemaRestablecer);
  const db = base(c);
  const id = await sha256(d.token);
  const r = await db
    .prepare(
      "SELECT usuario_id FROM recuperaciones WHERE id = ? AND usada_en IS NULL AND expira_en > datetime('now')",
    )
    .bind(id)
    .first<{ usuario_id: string }>();
  if (!r)
    throw new ErrorDatos(
      'Este enlace ya no sirve. Pide uno nuevo desde «Olvidé mi contraseña».',
      undefined,
      410,
    );
  await db.batch([
    db
      .prepare('UPDATE usuarios SET clave_hash = ? WHERE id = ?')
      .bind(await hashClave(d.clave), r.usuario_id),
    db.prepare("UPDATE recuperaciones SET usada_en = datetime('now') WHERE id = ?").bind(id),
    // Se cierran todas las sesiones viejas: si alguien tenía la cuenta abierta, queda fuera.
    db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(r.usuario_id),
  ]);
  return c.json({ ok: true });
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

/**
 * Borrar la cuenta (Apple lo exige dentro de la app). Los datos personales se borran;
 * los pedidos se quedan sin nombre, porque la contabilidad y los impuestos los necesitan.
 */
cuentas.delete('/yo', async (c) => {
  const u = exigir(c);
  const db = base(c);
  const activo = await db
    .prepare(
      "SELECT 1 FROM pedidos WHERE (cliente_id = ? OR repartidor_id = ?) AND estado IN ('pagado','aceptado','listo','en_camino')",
    )
    .bind(u.id, u.id)
    .first();
  if (activo)
    throw new ErrorDatos(
      'Tienes un pedido en curso. Espera a que termine para borrar tu cuenta.',
      undefined,
      409,
    );
  await db.batch([
    db
      .prepare(
        "UPDATE usuarios SET correo = ?, nombre = 'Cuenta borrada', telefono = NULL, fecha_nacimiento = NULL, clave_hash = 'borrada', activo = 0 WHERE id = ?",
      )
      .bind(`borrada-${u.id}@tumbite.invalid`, u.id),
    db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(u.id),
    db
      .prepare('UPDATE repartidores SET conectado = 0, lat = NULL, lng = NULL WHERE usuario_id = ?')
      .bind(u.id),
    // Lo que prometen la política de privacidad y la página /delete-account: se quitan direcciones,
    // indicaciones y ubicación de sus pedidos y el texto de sus calificaciones. Los importes se
    // guardan (impuestos y contabilidad). Candado C-BORRADO-COMPLETO.
    db
      .prepare(
        "UPDATE pedidos SET direccion = 'Dirección borrada', notas = '', lat = NULL, lng = NULL WHERE cliente_id = ?",
      )
      .bind(u.id),
    db
      .prepare(
        "UPDATE calificaciones SET comentario = '' WHERE pedido_id IN (SELECT id FROM pedidos WHERE cliente_id = ?)",
      )
      .bind(u.id),
    db.prepare('DELETE FROM dispositivos WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM confirmaciones WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM recuperaciones WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM lista_espera WHERE correo = ?').bind(u.correo),
    // Verificación de identidad y datos del vehículo, licencia y seguro: se borran con la cuenta.
    db.prepare('DELETE FROM kyc WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM repartidor_datos WHERE usuario_id = ?').bind(u.id),
    // C-BORRADO-VEHICULO (20 oct 2026): los documentos del vehículo (registro, seguro, fotos de la
    // placa) también son datos personales: se quita el archivo y queda la fila sin él.
    db
      .prepare(
        "UPDATE vehiculo_documentos SET clave = '' WHERE vehiculo_id IN (SELECT id FROM vehiculos WHERE conductor_id = ?)",
      )
      .bind(u.id),
  ]);
  // Y las fotos del documento, la cara y el local, del almacén privado.
  if (c.env.BUCKET) {
    for (const prefix of [`kyc/${u.id}/`, `vehiculos/${u.id}/`]) {
      let cursor: string | undefined;
      do {
        const lista = await c.env.BUCKET.list({ prefix, cursor });
        if (lista.objects.length) await c.env.BUCKET.delete(lista.objects.map((o) => o.key));
        cursor = lista.truncated ? lista.cursor : undefined;
      } while (cursor);
    }
  }
  c.header('Set-Cookie', cookie('', true));
  return c.json({ ok: true });
});

cuentas.get('/yo', (c) => c.json({ usuario: exigir(c) }));

// ---------- Configuración de la cuenta ----------

cuentas.get('/perfil', async (c) => {
  const u = exigir(c);
  const f = await base(c)
    .prepare(
      'SELECT nombre, correo, telefono, fecha_nacimiento, idioma, correo_confirmado_en FROM usuarios WHERE id = ?',
    )
    .bind(u.id)
    .first<Record<string, unknown>>();
  return c.json({
    perfil: {
      nombre: String(f?.nombre ?? ''),
      correo: String(f?.correo ?? ''),
      telefono: String(f?.telefono ?? ''),
      fechaNacimiento: (f?.fecha_nacimiento as string | null) ?? null,
      idioma: f?.idioma === 'en' ? 'en' : 'es',
      correoConfirmado: Boolean(f?.correo_confirmado_en),
    },
  });
});

cuentas.patch('/yo', async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(c, esquemaPerfil);
  if (u.correo.endsWith('@windoce.com') && !/soporte/i.test(d.nombre))
    throw new ErrorDatos(
      'Las cuentas de nuestro equipo deben llevar «Soporte» en el nombre.',
      'nombre',
    );
  await base(c)
    .prepare(
      'UPDATE usuarios SET nombre = ?, telefono = ?, fecha_nacimiento = ?, idioma = ? WHERE id = ?',
    )
    .bind(d.nombre, d.telefono || null, d.fechaNacimiento, d.idioma, u.id)
    .run();
  return c.json({ usuario: { ...u, nombre: d.nombre, idioma: d.idioma } });
});

/** El idioma de los avisos sigue al de la app (C-REPARTIDOR-GRANDES): antes se quedaba el del registro. */
cuentas.put('/idioma', async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(c, z.object({ idioma: z.enum(['es', 'en']) }));
  await base(c).prepare('UPDATE usuarios SET idioma = ? WHERE id = ?').bind(d.idioma, u.id).run();
  return c.json({ idioma: d.idioma });
});

/** Cambiar la contraseña sabiendo la actual. Cierra las demás sesiones; la de ahora sigue. */
cuentas.post('/clave', async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(c, esquemaCambiarClave);
  const db = base(c);
  const f = await db
    .prepare('SELECT clave_hash FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ clave_hash: string }>();
  if (!f || !(await verificarClave(d.actual, f.clave_hash)))
    throw new ErrorDatos('La contraseña actual no es correcta.', 'actual', 401);
  const token = leerToken(c);
  await db.batch([
    db
      .prepare('UPDATE usuarios SET clave_hash = ? WHERE id = ?')
      .bind(await hashClave(d.nueva), u.id),
    db
      .prepare('DELETE FROM sesiones WHERE usuario_id = ? AND id != ?')
      .bind(u.id, token ? await sha256(token) : ''),
  ]);
  return c.json({ ok: true });
});

/** Cambiar el correo con la contraseña. El correo nuevo queda sin confirmar y se le manda el enlace. */
cuentas.post('/correo', async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(c, esquemaCambiarCorreo);
  const db = base(c);
  const f = await db
    .prepare('SELECT clave_hash FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ clave_hash: string }>();
  if (!f || !(await verificarClave(d.clave, f.clave_hash)))
    throw new ErrorDatos('La contraseña no es correcta.', 'clave', 401);
  if (d.correo === u.correo.toLowerCase()) return c.json({ usuario: u });
  const existe = await db.prepare('SELECT 1 FROM usuarios WHERE correo = ?').bind(d.correo).first();
  if (existe) throw new ErrorDatos('Ya existe una cuenta con ese correo.', 'correo', 409);
  await db
    .prepare('UPDATE usuarios SET correo = ?, correo_confirmado_en = NULL WHERE id = ?')
    .bind(d.correo, u.id)
    .run();
  await mandarConfirmacion(c.env, db, {
    id: u.id,
    nombre: u.nombre,
    correo: d.correo,
    idioma: u.idioma,
  });
  return c.json({ usuario: { ...u, correo: d.correo } });
});
