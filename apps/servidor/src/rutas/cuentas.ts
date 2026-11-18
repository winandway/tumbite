import { alRegistrarseConductor } from '../camila/bienvenida';
import { regionDePeticion } from '../camila/memoria';
import {
  CAPACIDAD_OFERTAS_BUCLE,
  CANALES_CONSENTIMIENTO_SMS,
  VERSION_CONSENTIMIENTO_SMS,
  VERSION_TERMINOS,
  correoCanonico,
  entornoDeHost,
  telefonoCanonico,
} from '@tumbite/compartido';
import {
  anotarAparato,
  codigoPara,
  vincularCliente,
  vincularConductor,
} from '../programaReferidos';
import { huellaAparato } from '../regalosDivoox';
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
import { idiomaDeLaApp } from '../avisosWeb';
import {
  COOKIE_SESION,
  DIAS_SESION,
  type Ctx,
  type Variables,
  base,
  exigir,
  leerToken,
  usuarioPublico,
} from '../sesion';
import { pasaTurnstile } from '../turnstile';
import { leerAccesoInterno } from '../accesoInterno';
import { limiteIntentos } from '../seguridad';
import { enviarCorreo, esCorreoDePrueba } from '../correo';
import { correoDeConfirmacion } from '../avisos';
import { borrarCuenta } from '../borrarCuenta';
import { ErrorDatos, leerCuerpo } from '../validar';
import { guardarConsentimientoSms } from '../sms';
import { TELEFONO_DIEZ } from '../esquema';

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
  // C-AVISOS-IDIOMA: el idioma de la app en ese teléfono (si no viene, el de la cabecera x-idioma).
  idioma: z.enum(['es', 'en']).optional(),
  // C-OFERTA-SUENA-EN-BUCLE: lo que trae la app (Driver nuevo: el canal de ofertas con tono largo).
  capacidades: z
    .array(z.enum([CAPACIDAD_OFERTAS_BUCLE]))
    .max(5)
    .optional(),
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

async function abrirSesion(
  db: D1Database,
  usuarioId: string,
  permisosJson: string | null = null,
): Promise<string> {
  const token = nuevoToken();
  // C-PERMISOS-FINOS: una cuenta del equipo entra con sus permisos ya calculados (en la misma fila).
  await db
    .prepare(
      `INSERT INTO sesiones (id, usuario_id, expira_en, permisos_json) VALUES (?, ?, datetime('now', ?), ?)`,
    )
    .bind(await sha256(token), usuarioId, `+${DIAS_SESION} days`, permisosJson)
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
  // C-IDENTIDAD-UNICA: el mismo correo o teléfono escrito de otra forma cuenta como el mismo, y los de
  // cuentas cerradas por mala conducta no vuelven a entrar.
  const correoUnico = correoCanonico(d.correo);
  const telUnico = telefonoCanonico(d.telefono);
  const bloqueado = await db
    .prepare(
      "SELECT 1 FROM bloqueos_identidad WHERE (tipo = 'correo' AND valor = ?) OR (tipo = 'telefono' AND valor = ?)",
    )
    .bind(correoUnico, telUnico ?? '-')
    .first();
  if (bloqueado)
    throw new ErrorDatos(
      'No podemos crear esta cuenta. Si crees que es un error, escríbenos a soporte.',
      undefined,
      403,
    );
  const existe = await db
    .prepare('SELECT correo FROM usuarios WHERE correo = ? OR correo_canonico = ?')
    .bind(d.correo, correoUnico)
    .first<{ correo: string }>();
  if (existe)
    throw new ErrorDatos(
      // C-CORREO-VARIANTE (4 nov 2026, Richard): «go+cliente6@…» choca con «go+cliente1@…» porque
      // es el mismo buzón; el mensaje lo dice, en vez de hacer pensar que falla la contraseña.
      existe.correo.toLowerCase() === d.correo.toLowerCase()
        ? 'Ya existe una cuenta con ese correo. Entra con tu contraseña.'
        : 'Ya hay una cuenta con este mismo correo escrito de otra forma (por ejemplo, con un «+» o con puntos). Entra con esa cuenta o usa otro correo.',
      'correo',
      409,
    );
  // El mismo teléfono no abre dos cuentas del mismo tipo (un repartidor puede pedir como cliente).
  if (telUnico) {
    // C-LECTURAS-POR-PETICION: dos búsquedas por índice en vez de un OR que recorría todas las
    // cuentas del mismo rol (el teléfono único, y el escrito a mano de las cuentas viejas).
    const conTel = await db
      .prepare(
        `SELECT 1 FROM usuarios WHERE telefono_canonico = ?2 AND rol = ?1
         UNION ALL
         SELECT 1 FROM usuarios WHERE ${TELEFONO_DIEZ} = substr(?2, -10)
           AND telefono_canonico IS NULL AND telefono IS NOT NULL AND telefono != '' AND rol = ?1
         LIMIT 1`,
      )
      .bind(d.rol, telUnico)
      .first();
    if (conTel)
      throw new ErrorDatos(
        'Ese teléfono ya tiene una cuenta. Entra con ella o escríbenos a soporte.',
        'telefono',
        409,
      );
  }
  // Nadie se vuelve administrador al registrarse: eso se hace aparte, con la semilla secreta.
  const rol: Rol = d.rol;
  // C-REFERIDOS-SIN-TRAMPA: un código de invitación que no existe o que es de otro tipo de cuenta se
  // dice ANTES de crear la cuenta, en su casilla; la persona lo corrige o lo borra y sigue.
  if (d.invitacion && (rol === 'repartidor' || rol === 'cliente'))
    await codigoPara(db, rol, d.invitacion, 'invitacion');
  const id = nuevoId();
  await db
    .prepare(
      'INSERT INTO usuarios (id, correo, nombre, telefono, fecha_nacimiento, rol, idioma, clave_hash, correo_canonico, telefono_canonico) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
      correoUnico,
      telUnico,
    )
    .run();
  // C-TERMINOS-ACTUALIZADOS: al crear la cuenta acepta los términos vigentes (casilla del registro).
  await db
    .prepare('INSERT OR IGNORE INTO terminos_aceptados (usuario_id, version) VALUES (?, ?)')
    .bind(id, VERSION_TERMINOS)
    .run();
  // C-SMS-CONSENTIMIENTO: solo si marcó la casilla de SMS (aparte de los términos y sin marcar).
  if (d.smsConsentimiento) await guardarConsentimientoSms(db, id, true, d.canal ?? 'web');
  const token = await abrirSesion(db, id);
  // C-REFERIDOS-EQUIPOS: la huella del aparato (antifraude) y el código con el que lo invitaron. El
  // código ya se comprobó arriba; lo que falle aquí no frena el registro, pero queda en el registro de errores.
  await anotarAparato(db, id, await huellaAparato(c.req.header('x-aparato'))).catch((e: unknown) =>
    console.error('registro: aparato', e),
  );
  if (d.invitacion)
    await (
      rol === 'repartidor'
        ? vincularConductor(db, id, d.invitacion)
        : rol === 'cliente'
          ? vincularCliente(db, id, d.invitacion, null)
          : Promise.resolve(null)
    ).catch((e: unknown) => {
      console.error('registro: invitación', e instanceof ErrorDatos ? e.message : e);
    });
  await mandarConfirmacion(c.env, db, { id, nombre: d.nombre, correo: d.correo, idioma: d.idioma });
  // C-CAMILA-BIENVENIDA: Camila le da la bienvenida al conductor y, si vino con el código de un
  // líder, le avisa al líder con el contador. Nunca frena el registro.
  if (rol === 'repartidor')
    await alRegistrarseConductor(
      c.env,
      db,
      { id, nombre: d.nombre, idioma: d.idioma },
      c.req.header('cf-ipcountry'),
      regionDePeticion(c),
    );
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
  // C-PERMISOS-FINOS: una cuenta del equipo suspendida, retirada o vencida no entra (lo dice claro).
  const acceso = fila.rol === 'admin' ? await leerAccesoInterno(db, c.env, fila) : null;
  if (acceso && acceso.estado !== 'activo')
    throw new ErrorDatos(
      'Tu acceso al equipo de Divoox está suspendido o vencido. Habla con quien gestiona el equipo.',
      undefined,
      403,
    );
  if (acceso)
    await db
      .prepare(
        `INSERT INTO equipo_cuentas (usuario_id, ultima_entrada_en) VALUES (?, datetime('now'))
         ON CONFLICT(usuario_id) DO UPDATE SET ultima_entrada_en = excluded.ultima_entrada_en`,
      )
      .bind(fila.id)
      .run();
  // C-REPARTIDOR-UN-TELEFONO (8 nov 2026, Richard): un repartidor trabaja en UN solo teléfono, como
  // en Uber y DoorDash. Entrar en otro cierra la sesión del anterior: si no, los dos reciben las
  // mismas ofertas. Restaurantes y empresas sí pueden tener varias pantallas abiertas.
  if (fila.rol === 'repartidor')
    await db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(fila.id).run();
  const token = await abrirSesion(db, fila.id, acceso ? JSON.stringify(acceso) : null);
  await anotarAparato(db, fila.id, await huellaAparato(c.req.header('x-aparato'))).catch(
    (e: unknown) => console.error('entrar: aparato', e),
  );
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
  // C-AVISOS-IDIOMA (16 nov 2026): el teléfono guarda el idioma de su app (el elegido en el selector
  // o, si no eligió, el del teléfono). Las apps ya publicadas lo mandan en la cabecera x-idioma de
  // cada petición: con eso los avisos salen bien sin esperar una versión nueva.
  const idioma = idiomaDeLaApp(d.idioma, c.req.header('x-idioma'));
  const r = await db
    .prepare(
      `INSERT INTO dispositivos (token, usuario_id, plataforma, idioma, capacidades) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(token) DO UPDATE SET usuario_id = excluded.usuario_id, plataforma = excluded.plataforma, activo = 1, visto_en = datetime('now'),
         idioma = COALESCE(excluded.idioma, dispositivos.idioma),
         capacidades = COALESCE(excluded.capacidades, dispositivos.capacidades)
       WHERE dispositivos.usuario_id = excluded.usuario_id OR dispositivos.activo = 0`,
    )
    .bind(
      d.token,
      u.id,
      d.plataforma,
      idioma,
      d.capacidades?.length ? d.capacidades.join(',') : null,
    )
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos(
      'Este teléfono sigue con otra cuenta. Cierra sesión allí primero.',
      undefined,
      409,
    );
  // El idioma de la app también es el de la cuenta (correos y SMS). No escribe si ya es ese.
  if (idioma)
    await db
      .prepare('UPDATE usuarios SET idioma = ?1 WHERE id = ?2 AND idioma IS NOT ?1')
      .bind(idioma, u.id)
      .run();
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
      "SELECT c.usuario_id, u.rol FROM confirmaciones c JOIN usuarios u ON u.id = c.usuario_id WHERE c.id = ? AND c.usada_en IS NULL AND c.expira_en > datetime('now')",
    )
    .bind(id)
    .first<{ usuario_id: string; rol: Rol }>();
  if (!r)
    throw new ErrorDatos('Este enlace ya no sirve. Entra a tu cuenta y pide otro.', undefined, 410);
  await db.batch([
    db
      .prepare("UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = ?")
      .bind(r.usuario_id),
    db.prepare("UPDATE confirmaciones SET usada_en = datetime('now') WHERE id = ?").bind(id),
  ]);
  // C-CORREO-OBLIGATORIO: con el rol, la página del enlace ofrece volver a la app del cliente.
  return c.json({ ok: true, rol: r.rol });
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
/**
 * C-PASE-WEB (LG1): la app pide un pase de un solo uso (2 minutos) para abrir una página del panel
 * dentro de la misma app (registro y panel de la empresa de logística) sin volver a escribir la clave.
 * Solo se guarda el hash del código; al usarlo se borra y se abre una sesión nueva en esa vista web.
 */
cuentas.post('/pase-web', async (c) => {
  const u = exigir(c);
  const codigo = nuevoToken();
  const db = base(c);
  await db.batch([
    db.prepare("DELETE FROM pases_web WHERE vence_en < datetime('now')"),
    db
      .prepare(
        "INSERT INTO pases_web (codigo_hash, usuario_id, vence_en) VALUES (?, ?, datetime('now', '+2 minutes'))",
      )
      .bind(await sha256(codigo), u.id),
  ]);
  return c.json({ codigo });
});

/** Solo se puede ir al panel o a la web propia, nunca a otro sitio. */
const DESTINO_PASE = new Set(['/panel', '/panel/business', '/es/panel', '/es/panel/business']);

cuentas.get('/pase-web/:codigo', async (c) => {
  const db = base(c);
  const f = await db
    .prepare(
      "DELETE FROM pases_web WHERE codigo_hash = ? AND vence_en > datetime('now') RETURNING usuario_id",
    )
    .bind(await sha256(c.req.param('codigo')))
    .first<{ usuario_id: string }>();
  const ir = c.req.query('ir') ?? '/panel';
  const destino = DESTINO_PASE.has(ir) ? ir : '/panel';
  if (f) c.header('Set-Cookie', cookie(await abrirSesion(db, f.usuario_id)));
  return c.redirect(destino, 302);
});

cuentas.delete('/yo', async (c) => {
  const u = exigir(c);
  const db = base(c);
  await borrarCuenta(c.env, db, u);
  c.header('Set-Cookie', cookie('', true));
  return c.json({ ok: true });
});

cuentas.get('/yo', (c) => c.json({ usuario: usuarioPublico(exigir(c)) }));

// ---------- Configuración de la cuenta ----------

cuentas.get('/perfil', async (c) => {
  const u = exigir(c);
  const f = await base(c)
    .prepare(
      'SELECT nombre, correo, telefono, fecha_nacimiento, idioma, correo_confirmado_en, sms_consentido_en FROM usuarios WHERE id = ?',
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
      smsConsentimiento: Boolean(f?.sms_consentido_en),
      debeConfirmarCorreo: debeConfirmarCorreo(
        c.req.url,
        String(f?.correo ?? ''),
        Boolean(f?.correo_confirmado_en),
      ),
    },
  });
});

/**
 * C-CORREO-OBLIGATORIO (4 nov 2026, Richard): la app del cliente no deja entrar sin el correo
 * confirmado. Fuera de producción, las cuentas de dominios que no existen (las del recorrido, que no
 * pueden recibir el enlace) no pasan por la puerta, salvo las «verificar.…», que la prueban.
 */
function debeConfirmarCorreo(url: string, correo: string, confirmado: boolean): boolean {
  if (confirmado) return false;
  if (entornoDeHost(new URL(url).host) === 'produccion') return true;
  return !esCorreoDePrueba(correo) || correo.toLowerCase().startsWith('verificar.');
}

cuentas.patch('/yo', async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(c, esquemaPerfil);
  if (u.correo.endsWith('@windoce.com') && !/soporte/i.test(d.nombre))
    throw new ErrorDatos(
      'Las cuentas de nuestro equipo deben llevar «Soporte» en el nombre.',
      'nombre',
    );
  // C-SMS-CONSENTIMIENTO: el permiso de SMS se dio para un número; si el número cambia, el permiso
  // no pasa al nuevo (la persona vuelve a marcar la casilla si quiere).
  await base(c)
    .prepare(
      `UPDATE usuarios SET nombre = ?1, fecha_nacimiento = ?3, idioma = ?4,
        sms_consentido_en = CASE WHEN COALESCE(telefono, '') = COALESCE(?2, '') THEN sms_consentido_en ELSE NULL END,
        telefono = ?2 WHERE id = ?5`,
    )
    .bind(d.nombre, d.telefono || null, d.fechaNacimiento, d.idioma, u.id)
    .run();
  // C-AVISOS-IDIOMA: el idioma elegido en la cuenta también vale para sus avisos (si cambió).
  if (d.idioma !== u.idioma) {
    const db = base(c);
    await db.batch([
      db
        .prepare('UPDATE dispositivos SET idioma = ?1 WHERE usuario_id = ?2 AND idioma IS NOT ?1')
        .bind(d.idioma, u.id),
      db
        .prepare(
          'UPDATE suscripciones_web SET idioma = ?1 WHERE usuario_id = ?2 AND idioma IS NOT ?1',
        )
        .bind(d.idioma, u.id),
    ]);
  }
  return c.json({ usuario: { ...usuarioPublico(u), nombre: d.nombre, idioma: d.idioma } });
});

/**
 * C-SMS-CONSENTIMIENTO: aceptar o retirar los SMS desde la cuenta (la misma casilla, sin marcar
 * por defecto). Retirar borra la fecha: desde ese momento el servidor no manda SMS a esa persona,
 * salvo el código que pida ella misma en ese momento.
 */
cuentas.put('/sms', async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(
    c,
    z.object({ acepta: z.boolean(), canal: z.enum(CANALES_CONSENTIMIENTO_SMS).default('web') }),
  );
  await guardarConsentimientoSms(base(c), u.id, d.acepta, d.canal);
  return c.json({ smsConsentimiento: d.acepta, version: VERSION_CONSENTIMIENTO_SMS });
});

/** El idioma de los avisos sigue al de la app (C-REPARTIDOR-GRANDES): antes se quedaba el del registro. */
cuentas.put('/idioma', async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(c, z.object({ idioma: z.enum(['es', 'en']) }));
  const db = base(c);
  // C-AVISOS-IDIOMA: la persona eligió idioma: sus teléfonos y navegadores también lo toman (los
  // avisos le llegan en ese idioma en todos). No escribe lo que ya está en ese idioma.
  await db.batch([
    db
      .prepare('UPDATE usuarios SET idioma = ?1 WHERE id = ?2 AND idioma IS NOT ?1')
      .bind(d.idioma, u.id),
    db
      .prepare('UPDATE dispositivos SET idioma = ?1 WHERE usuario_id = ?2 AND idioma IS NOT ?1')
      .bind(d.idioma, u.id),
    db
      .prepare(
        'UPDATE suscripciones_web SET idioma = ?1 WHERE usuario_id = ?2 AND idioma IS NOT ?1',
      )
      .bind(d.idioma, u.id),
  ]);
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
    // C-SESION-TERMINADA: 403, no 401 (la sesión es buena; 401 hace que la app salga).
    throw new ErrorDatos('La contraseña actual no es correcta.', 'actual', 403);
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
    throw new ErrorDatos('La contraseña no es correcta.', 'clave', 403);
  if (d.correo === u.correo.toLowerCase()) return c.json({ usuario: usuarioPublico(u) });
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
  return c.json({ usuario: { ...usuarioPublico(u), correo: d.correo } });
});

/**
 * C-PUENTE-PANEL (2 nov 2026, Richard: «que no tenga que salir afuera para nada»): las pantallas del
 * panel web que la app abre (Configuración, Ganancias…) se abren DENTRO de la app con la sesión ya
 * iniciada. La app pide un código de un solo uso (vence en 60 segundos, solo queda su hash); el visor
 * de la app abre /datos/cuentas/puente/<código>, que deja la cookie de sesión y lleva a la página.
 * Solo a direcciones del propio sitio: nunca redirige afuera.
 */
const destinoPuente = z
  .string()
  .trim()
  .max(300)
  .regex(/^\/(?!\/)[A-Za-z0-9/_\-?=&.%]*$/);

cuentas.post('/puente', limiteIntentos(20, 60_000), async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(c, z.object({ a: destinoPuente }));
  const db = base(c);
  const codigo = nuevoToken();
  await db
    .prepare(
      "INSERT INTO puentes_sesion (id, usuario_id, expira_en) VALUES (?, ?, datetime('now', '+60 seconds'))",
    )
    .bind(await sha256(codigo), u.id)
    .run();
  const origen = new URL(c.req.url).origin;
  return c.json({ url: `${origen}/datos/cuentas/puente/${codigo}?a=${encodeURIComponent(d.a)}` });
});

cuentas.get('/puente/:codigo', limiteIntentos(30, 60_000), async (c) => {
  const a = destinoPuente.safeParse(c.req.query('a') ?? '/');
  const destino = a.success ? a.data : '/';
  const db = base(c);
  const fila = await db
    .prepare(
      "UPDATE puentes_sesion SET usado = 1 WHERE id = ? AND usado = 0 AND expira_en > datetime('now') RETURNING usuario_id",
    )
    .bind(await sha256(c.req.param('codigo')))
    .first<{ usuario_id: string }>();
  // Código usado, vencido o inventado: se llega a la página igual y el panel pide entrar.
  if (!fila) return c.redirect(destino, 302);
  const token = await abrirSesion(db, fila.usuario_id);
  c.header('Set-Cookie', cookie(token));
  c.header('Cache-Control', 'no-store');
  return c.redirect(destino, 302);
});
