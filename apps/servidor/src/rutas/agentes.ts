import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
  type Agente,
  COLUMNAS_AGENTE,
  CONCEPTOS_EQUIPO,
  TOPES_AGENTE,
  accionesDeAgente,
  anotarAccion,
  anotarEnAgente,
  buscarCobro,
  buscarConductor,
  cancelarCobroEfectivo,
  ciudadAgentes,
  ciudadesAgentes,
  estadoCobroEfectivo,
  historialAgente,
  listarAgentes,
  loTieneDelante,
  pagarCobro,
  pedirCobroEfectivo,
  resumenAgente,
  vencerCobros,
  venderSaldo,
} from '../agentes';
import { enviarCorreo } from '../correo';
import { hashClave, nuevoId, nuevoToken, sha256, verificarClave } from '../cripto';
import { entornoDe } from '../entorno';
import type { Env } from '../env';
import { limiteIntentos, limiteIntentosPersistente } from '../seguridad';
import { type Variables, base, exigir } from '../sesion';
import { pasaTurnstile } from '../turnstile';
import { ErrorDatos, leerCuerpo } from '../validar';

/**
 * C-AGENTE-DIVOOX (18 nov 2026): las rutas del Agente Divoox.
 * - `/agent/*`: el panel del agente. Su sesión es PROPIA (cookie `divoox_agente`, tabla
 *   `agentes_sesiones`): no existe para el resto del sistema, así que un agente no puede abrir
 *   ninguna otra ruta. Entra con correo y contraseña, y SIEMPRE confirma con un código por correo.
 *   Sesión corta: 12 horas como mucho y 30 minutos sin usar.
 * - `/repartidor/cobro-efectivo`: el conductor pide, mira y cancela su código.
 * - `/admin/agentes*`: el equipo crea y suspende agentes, anota el fondo y concilia.
 */
export const agentes = new Hono<{ Bindings: Env; Variables: Variables }>();
type C = Context<{ Bindings: Env; Variables: Variables }>;

export const COOKIE_AGENTE = 'divoox_agente';
export const HORAS_SESION_AGENTE = 12;
export const MINUTOS_INACTIVO_AGENTE = 30;
const MINUTOS_CODIGO = 10;
const HORAS_ENLACE = 48;

const cookie = (token: string, segundos: number) =>
  `${COOKIE_AGENTE}=${token}; Path=/datos/agent; HttpOnly; Secure; SameSite=Strict; Max-Age=${segundos}`;

function tokenAgente(c: C): string | null {
  const m = (c.req.header('cookie') ?? '').match(new RegExp(`(?:^|; )${COOKIE_AGENTE}=([^;]+)`));
  return m?.[1] ?? null;
}

const ipDe = (c: C) => c.req.header('cf-connecting-ip') ?? '';
const enLocalOPruebas = (c: C) => {
  const e = entornoDe(c.req.url);
  return e === 'local' || e === 'pruebas';
};
const sitio = (c: C) => {
  const u = new URL(c.req.url);
  return u.hostname === 'localhost' || u.hostname.endsWith('.localhost')
    ? u.origin
    : `https://${u.hostname}`;
};

/** La sesión del agente: verificada, sin vencer, usada hace poco y con la cuenta activa. */
async function exigirAgente(c: C): Promise<Agente & { sesionId: string }> {
  const token = tokenAgente(c);
  const db = base(c);
  if (!token) throw new ErrorDatos('Tu sesión terminó. Vuelve a entrar.', undefined, 401);
  const sesionId = await sha256(token);
  const f = await db
    .prepare(
      `SELECT ${COLUMNAS_AGENTE}, s.vista_en < datetime('now', '-5 minutes') AS tocar
         FROM agentes_sesiones s JOIN agentes a ON a.id = s.agente_id
        WHERE s.id = ? AND s.verificada = 1 AND s.expira_en > datetime('now')
          AND s.vista_en > datetime('now', ?) AND a.estado = 'activo'`,
    )
    .bind(sesionId, `-${MINUTOS_INACTIVO_AGENTE} minutes`)
    .first<Agente & { tocar: number }>();
  if (!f) {
    c.header('Set-Cookie', cookie('', 0));
    throw new ErrorDatos('Tu sesión terminó. Vuelve a entrar.', undefined, 401);
  }
  // Una escritura cada cinco minutos como mucho (mirar el panel no escribe en cada petición).
  if (f.tocar)
    await db
      .prepare("UPDATE agentes_sesiones SET vista_en = datetime('now') WHERE id = ?")
      .bind(sesionId)
      .run();
  return { ...f, sesionId };
}

let hashFalsoGuardado: Promise<string> | null = null;
const hashFalso = () => (hashFalsoGuardado ??= hashClave(crypto.randomUUID()));

const esquemaClave = z
  .string()
  .min(10, { error: 'La contraseña debe tener al menos 10 caracteres.' })
  .max(200);

// ───────────────────────────── Entrar (dos pasos) y salir ─────────────────────────────

agentes.use('/agent/login', limiteIntentosPersistente(8, 60_000));
agentes.use('/agent/verify', limiteIntentosPersistente(10, 60_000));
agentes.use('/agent/password', limiteIntentosPersistente(8, 60_000));
agentes.use('/agent/password/forgot', limiteIntentosPersistente(4, 60_000));

/**
 * Escudo anti-robots (C-TURNSTILE-LISTO): antes de mirar la contraseña o el correo. Sin
 * TURNSTILE_SECRET_KEY no pide nada (apagado); con ella, sin pase bueno no se sigue.
 */
async function escudoAgente(c: Context<{ Bindings: Env; Variables: Variables }>) {
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

agentes.post('/agent/login', async (c) => {
  await escudoAgente(c);
  const d = await leerCuerpo(
    c,
    z.object({ correo: z.string().trim().toLowerCase().max(200), clave: z.string().max(200) }),
  );
  const db = base(c);
  const a = await db
    .prepare('SELECT id, nombre, correo, idioma, estado, clave_hash FROM agentes WHERE correo = ?')
    .bind(d.correo)
    .first<{
      id: string;
      nombre: string;
      correo: string;
      idioma: string;
      estado: string;
      clave_hash: string | null;
    }>();
  // Mismo mensaje y mismo tiempo si el correo no existe, la clave está mal o la cuenta no tiene clave.
  const claveOk = await verificarClave(d.clave, a?.clave_hash ?? (await hashFalso()));
  if (!a || !a.clave_hash || !claveOk) {
    if (a) await anotarAccion(db, a.id, 'entrada_fallida', '', '', ipDe(c));
    throw new ErrorDatos('El correo o la contraseña no coinciden.', undefined, 401);
  }
  if (a.estado !== 'activo')
    throw new ErrorDatos('Tu cuenta de agente está suspendida. Habla con Divoox.', undefined, 403);
  const token = nuevoToken();
  const codigo = String(100_000 + ((crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % 900_000));
  await db
    .prepare(
      `INSERT INTO agentes_sesiones (id, agente_id, verificada, codigo_hash, codigo_expira_en, expira_en)
       VALUES (?, ?, 0, ?, datetime('now', ?), datetime('now', ?))`,
    )
    .bind(
      await sha256(token),
      a.id,
      await sha256(codigo),
      `+${MINUTOS_CODIGO} minutes`,
      `+${MINUTOS_CODIGO} minutes`,
    )
    .run();
  const en = a.idioma !== 'es';
  const envio = await enviarCorreo(c.env, {
    de: 'avisos',
    para: a.correo,
    idioma: en ? 'en' : 'es',
    asunto: en ? `Your Divoox Agent code: ${codigo}` : `Tu código de Agente Divoox: ${codigo}`,
    texto: en
      ? `Hi ${a.nombre.split(' ')[0] ?? ''},\n\nYour code to sign in to the Divoox Agent panel is ${codigo}. It works once and expires in ${MINUTOS_CODIGO} minutes.\n\nIf you didn’t try to sign in, change your password and tell Divoox right away.`
      : `Hola, ${a.nombre.split(' ')[0] ?? ''}.\n\nTu código para entrar al panel de Agente Divoox es ${codigo}. Sirve una vez y vence en ${MINUTOS_CODIGO} minutos.\n\nSi no intentaste entrar, cambia tu contraseña y avísale a Divoox enseguida.`,
  });
  if (!envio.ok && !enLocalOPruebas(c))
    throw new ErrorDatos(
      'No pudimos mandar el código. Intenta de nuevo en un minuto.',
      undefined,
      503,
    );
  c.header('Set-Cookie', cookie(token, MINUTOS_CODIGO * 60));
  // En local y en el sitio de pruebas el código vuelve en la respuesta (los correos de prueba no salen).
  return c.json({ paso: 'codigo', ...(enLocalOPruebas(c) ? { codigoPrueba: codigo } : {}) });
});

agentes.post('/agent/verify', async (c) => {
  const { codigo } = await leerCuerpo(
    c,
    z.object({
      codigo: z
        .string()
        .trim()
        .regex(/^\d{6}$/, { error: 'Escribe los 6 números del código.' }),
    }),
  );
  const db = base(c);
  const token = tokenAgente(c);
  const sesionId = token ? await sha256(token) : '';
  // El intento se cuenta en la MISMA sentencia que lo lee (dos peticiones a la vez no pasan de 5).
  const s = await db
    .prepare(
      `UPDATE agentes_sesiones SET codigo_intentos = codigo_intentos + 1
        WHERE id = ? AND verificada = 0 AND codigo_hash IS NOT NULL AND codigo_intentos < 5
          AND codigo_expira_en > datetime('now')
          AND EXISTS (SELECT 1 FROM agentes a WHERE a.id = agentes_sesiones.agente_id AND a.estado = 'activo')
        RETURNING agente_id, codigo_hash`,
    )
    .bind(sesionId)
    .first<{ agente_id: string; codigo_hash: string }>();
  if (!s) {
    // Vencido, gastado (5 intentos) o inexistente: la sesión a medias se borra.
    await db
      .prepare('DELETE FROM agentes_sesiones WHERE id = ? AND verificada = 0')
      .bind(sesionId)
      .run();
    throw new ErrorDatos(
      'Ese código ya no sirve. Vuelve a entrar para recibir uno nuevo.',
      'codigo',
      410,
    );
  }
  if (s.codigo_hash !== (await sha256(codigo))) {
    await anotarAccion(db, s.agente_id, 'codigo_entrada_fallido', '', '', ipDe(c));
    throw new ErrorDatos('El código no coincide.', 'codigo', 403);
  }
  await db.batch([
    // Una sola sesión a la vez: entrar en otro aparato cierra la anterior.
    db
      .prepare('DELETE FROM agentes_sesiones WHERE agente_id = ? AND id <> ?')
      .bind(s.agente_id, sesionId),
    db
      .prepare(
        `UPDATE agentes_sesiones SET verificada = 1, codigo_hash = NULL, codigo_expira_en = NULL,
                vista_en = datetime('now'), expira_en = datetime('now', ?) WHERE id = ?`,
      )
      .bind(`+${HORAS_SESION_AGENTE} hours`, sesionId),
  ]);
  await anotarAccion(db, s.agente_id, 'entrada', '', '', ipDe(c));
  c.header('Set-Cookie', cookie(token ?? '', HORAS_SESION_AGENTE * 3600));
  return c.json({ ok: true });
});

agentes.post('/agent/logout', async (c) => {
  const token = tokenAgente(c);
  if (token && c.env.DB) {
    const id = await sha256(token);
    const s = await c.env.DB.prepare(
      'DELETE FROM agentes_sesiones WHERE id = ? RETURNING agente_id',
    )
      .bind(id)
      .first<{ agente_id: string }>();
    if (s) await anotarAccion(c.env.DB, s.agente_id, 'salida', '', '', ipDe(c));
  }
  c.header('Set-Cookie', cookie('', 0));
  return c.json({ ok: true });
});

/** Crea el enlace de un solo uso para poner la contraseña y lo manda por correo. */
async function mandarEnlaceClave(
  c: C,
  a: { id: string; nombre: string; correo: string; idioma: string },
) {
  const token = nuevoToken();
  await base(c)
    .prepare(
      "INSERT INTO agentes_enlaces (id, agente_id, expira_en) VALUES (?, ?, datetime('now', ?))",
    )
    .bind(await sha256(token), a.id, `+${HORAS_ENLACE} hours`)
    .run();
  const en = a.idioma !== 'es';
  const enlace = `${sitio(c)}${en ? '' : '/es'}/agent/password?token=${token}`;
  const envio = await enviarCorreo(c.env, {
    de: 'avisos',
    para: a.correo,
    idioma: en ? 'en' : 'es',
    asunto: en ? 'Set your Divoox Agent password' : 'Crea tu contraseña de Agente Divoox',
    texto: en
      ? `Hi ${a.nombre.split(' ')[0] ?? ''},\n\nTap this link to set the password for your Divoox Agent panel (it works once and expires in ${HORAS_ENLACE} hours):\n\n${enlace}\n\nIf you weren’t expecting this, do nothing.`
      : `Hola, ${a.nombre.split(' ')[0] ?? ''}.\n\nToca este enlace para crear la contraseña de tu panel de Agente Divoox (sirve una vez y vence en ${HORAS_ENLACE} horas):\n\n${enlace}\n\nSi no esperabas este correo, no hagas nada.`,
  });
  return { enviado: envio.ok, ...(enLocalOPruebas(c) ? { enlacePrueba: enlace } : {}) };
}

agentes.post('/agent/password/forgot', async (c) => {
  // C-TURNSTILE-LISTO: recuperar la clave también pasa por el escudo (antes no lo pedía).
  await escudoAgente(c);
  const { correo } = await leerCuerpo(
    c,
    z.object({ correo: z.string().trim().toLowerCase().max(200) }),
  );
  const a = await base(c)
    .prepare(
      "SELECT id, nombre, correo, idioma FROM agentes WHERE correo = ? AND estado = 'activo'",
    )
    .bind(correo)
    .first<{ id: string; nombre: string; correo: string; idioma: string }>();
  // Siempre la misma respuesta: no se dice si el correo es de un agente.
  const r = a ? await mandarEnlaceClave(c, a) : null;
  return c.json({
    ok: true,
    ...(r && 'enlacePrueba' in r ? { enlacePrueba: r.enlacePrueba } : {}),
  });
});

agentes.post('/agent/password', async (c) => {
  const d = await leerCuerpo(
    c,
    z.object({ token: z.string().min(20).max(200), clave: esquemaClave }),
  );
  const db = base(c);
  const id = await sha256(d.token);
  const e = await db
    .prepare(
      "UPDATE agentes_enlaces SET usado_en = datetime('now') WHERE id = ? AND usado_en IS NULL AND expira_en > datetime('now') RETURNING agente_id",
    )
    .bind(id)
    .first<{ agente_id: string }>();
  if (!e) throw new ErrorDatos('Ese enlace ya se usó o se venció. Pide uno nuevo.', 'token', 410);
  await db.batch([
    db
      .prepare('UPDATE agentes SET clave_hash = ? WHERE id = ?')
      .bind(await hashClave(d.clave), e.agente_id),
    // Cambiar la contraseña cierra todas las sesiones abiertas.
    db.prepare('DELETE FROM agentes_sesiones WHERE agente_id = ?').bind(e.agente_id),
  ]);
  await anotarAccion(db, e.agente_id, 'clave_creada', '', '', ipDe(c));
  return c.json({ ok: true });
});

// ───────────────────────────── El panel del agente ─────────────────────────────

agentes.get('/agent/me', async (c) => {
  const a = await exigirAgente(c);
  return c.json({ agente: await resumenAgente(base(c), a) });
});

agentes.put('/agent/language', async (c) => {
  const a = await exigirAgente(c);
  const { idioma } = await leerCuerpo(c, z.object({ idioma: z.enum(['es', 'en']) }));
  await base(c).prepare('UPDATE agentes SET idioma = ? WHERE id = ?').bind(idioma, a.id).run();
  return c.json({ ok: true });
});

agentes.post('/agent/payouts/lookup', limiteIntentos(20, 60_000), async (c) => {
  const a = await exigirAgente(c);
  const { codigo } = await leerCuerpo(c, z.object({ codigo: z.string().trim().min(1).max(40) }));
  return c.json({ cobro: await buscarCobro(base(c), a, codigo, ipDe(c)) });
});

agentes.post('/agent/payouts/:id/pay', limiteIntentos(20, 60_000), async (c) => {
  const a = await exigirAgente(c);
  const { codigo } = await leerCuerpo(c, z.object({ codigo: z.string().trim().min(1).max(40) }));
  const recibo = await pagarCobro(c.env, base(c), a, {
    cobroId: c.req.param('id'),
    codigo,
    ip: ipDe(c),
  });
  return c.json({ recibo });
});

agentes.post('/agent/drivers/find', limiteIntentos(12, 60_000), async (c) => {
  const a = await exigirAgente(c);
  const d = await leerCuerpo(
    c,
    z
      .object({
        telefono: z.string().trim().max(30).optional(),
        codigo: z.string().trim().max(20).optional(),
      })
      .refine((x) => Boolean(x.telefono || x.codigo), {
        error: 'Escribe el teléfono o el código del conductor.',
      }),
  );
  return c.json({ conductor: await buscarConductor(base(c), a, { ...d, ip: ipDe(c) }) });
});

agentes.post('/agent/sales', limiteIntentos(20, 60_000), async (c) => {
  const a = await exigirAgente(c);
  const d = await leerCuerpo(
    c,
    z.object({
      conductorId: z.string().min(1).max(64),
      monto: z.number().int().min(1).max(TOPES_AGENTE.ventaMaxima),
      idem: z.string().regex(/^[a-zA-Z0-9-]{8,40}$/),
    }),
  );
  return c.json({ recibo: await venderSaldo(c.env, base(c), a, { ...d, ip: ipDe(c) }) }, 201);
});

agentes.get('/agent/history', async (c) => {
  const a = await exigirAgente(c);
  return c.json({ historial: await historialAgente(base(c), a.id) });
});

/**
 * La foto del conductor que el agente tiene delante (la de su verificación). Solo si acaba de ver su
 * código o de buscarlo; nunca se guarda en el navegador.
 */
agentes.get('/agent/photo/:objeto', limiteIntentos(40, 60_000), async (c) => {
  const a = await exigirAgente(c);
  const db = base(c);
  const objeto = c.req.param('objeto');
  if (!(await loTieneDelante(db, a.id, objeto)))
    throw new ErrorDatos('Eso ya no está disponible.', undefined, 404);
  const f = await db
    .prepare(
      `SELECT k.selfie FROM kyc k
        WHERE k.usuario_id = COALESCE((SELECT conductor_id FROM cobros_efectivo WHERE id = ?1 AND zona_id = ?2), ?1)
          AND EXISTS (SELECT 1 FROM repartidores r WHERE r.usuario_id = k.usuario_id AND r.zona_id = ?2)`,
    )
    .bind(objeto, a.zona_id)
    .first<{ selfie: string | null }>();
  const archivo = f?.selfie && c.env.BUCKET ? await c.env.BUCKET.get(f.selfie) : null;
  if (!archivo) throw new ErrorDatos('Eso ya no está disponible.', undefined, 404);
  return new Response(archivo.body, {
    headers: {
      'content-type': archivo.httpMetadata?.contentType ?? 'image/jpeg',
      'cache-control': 'private, no-store',
    },
  });
});

// ───────────────────────────── El conductor ─────────────────────────────

agentes.get('/repartidor/cobro-efectivo', async (c) => {
  const u = exigir(c, 'repartidor');
  return c.json(await estadoCobroEfectivo(base(c), u.id));
});

// Muchos conductores pueden compartir la misma red (la del operador): el límite es holgado; lo
// que protege el dinero son las condiciones de la sentencia, no este freno.
agentes.post('/repartidor/cobro-efectivo', limiteIntentos(30, 60_000), async (c) => {
  const u = exigir(c, 'repartidor');
  const { monto } = await leerCuerpo(
    c,
    z.object({ monto: z.number().int().min(1).max(TOPES_AGENTE.pagoMaximo) }),
  );
  return c.json({ cobro: await pedirCobroEfectivo(base(c), u.id, monto) }, 201);
});

agentes.delete('/repartidor/cobro-efectivo', async (c) => {
  const u = exigir(c, 'repartidor');
  await cancelarCobroEfectivo(base(c), u.id);
  return c.json({ ok: true });
});

// ───────────────────────────── El equipo: Dinero → Agentes ─────────────────────────────

const auditar = (
  db: D1Database,
  actorId: string,
  accion: string,
  objeto: string,
  despues: unknown,
) =>
  db
    .prepare(
      'INSERT INTO auditoria_admin (actor_id, accion, objeto, despues_json) VALUES (?, ?, ?, ?)',
    )
    .bind(actorId, accion, objeto, JSON.stringify(despues));

const topes = {
  topePago: z.number().int().min(100).max(TOPES_AGENTE.pagoMaximo),
  topeDia: z.number().int().min(100).max(TOPES_AGENTE.diaMaximo),
  topeVenta: z.number().int().min(100).max(TOPES_AGENTE.ventaMaxima),
  topeDeuda: z.number().int().min(100).max(TOPES_AGENTE.deudaMaxima),
  avisoFondo: z.number().int().min(0).max(TOPES_AGENTE.anotacionMaxima),
};
const datosAgente = {
  nombre: z.string().trim().min(3).max(80),
  telefono: z.string().trim().max(30).default(''),
  idioma: z.enum(['es', 'en']).default('es'),
  zonaId: z.string().min(1).max(64),
  direccion: z.string().trim().max(160).default(''),
  horario: z.string().trim().max(120).default(''),
};

agentes.get('/admin/agentes', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  await vencerCobros(db);
  return c.json({
    agentes: await listarAgentes(db),
    ciudades: await ciudadesAgentes(db),
    topes: TOPES_AGENTE,
  });
});

agentes.post('/admin/agentes', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      ...datosAgente,
      correo: z.email({ error: 'Escribe un correo válido.' }).trim().toLowerCase().max(200),
      topePago: topes.topePago.default(10_000),
      topeDia: topes.topeDia.default(50_000),
      topeVenta: topes.topeVenta.default(10_000),
      topeDeuda: topes.topeDeuda.default(50_000),
      avisoFondo: topes.avisoFondo.default(5_000),
    }),
  );
  const db = base(c);
  await ciudadAgentes(db, d.zonaId);
  const id = nuevoId();
  const r = await db
    .prepare(
      `INSERT OR IGNORE INTO agentes (id, nombre, correo, telefono, idioma, zona_id, direccion, horario, tope_pago, tope_dia, tope_venta, tope_deuda, aviso_fondo, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      d.nombre,
      d.correo,
      d.telefono || null,
      d.idioma,
      d.zonaId,
      d.direccion,
      d.horario,
      d.topePago,
      d.topeDia,
      d.topeVenta,
      d.topeDeuda,
      d.avisoFondo,
      u.id,
    )
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ya hay un agente con ese correo.', 'correo', 409);
  await auditar(db, u.id, 'agente.crear', `agente:${id}`, { ...d }).run();
  const enlace = await mandarEnlaceClave(c, {
    id,
    nombre: d.nombre,
    correo: d.correo,
    idioma: d.idioma,
  });
  return c.json({ agente: (await listarAgentes(db, id))[0], enlace }, 201);
});

agentes.get('/admin/agentes/:id', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const agente = (await listarAgentes(db, c.req.param('id')))[0];
  if (!agente) throw new ErrorDatos('Ese agente no existe.', undefined, 404);
  return c.json({
    agente,
    historial: await historialAgente(db, agente.id, false),
    acciones: await accionesDeAgente(db, agente.id),
  });
});

agentes.patch('/admin/agentes/:id', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z
      .object({
        ...datosAgente,
        ...topes,
        estado: z.enum(['activo', 'suspendido']),
        desbloquearPagos: z.boolean(),
      })
      .partial(),
  );
  const db = base(c);
  const id = c.req.param('id');
  const antes = (await listarAgentes(db, id))[0];
  if (!antes) throw new ErrorDatos('Ese agente no existe.', undefined, 404);
  if (d.zonaId) await ciudadAgentes(db, d.zonaId);
  const cambios: [string, unknown][] = [];
  const poner = (columna: string, valor: unknown) => {
    if (valor !== undefined) cambios.push([columna, valor]);
  };
  poner('nombre', d.nombre);
  poner('telefono', d.telefono === undefined ? undefined : d.telefono || null);
  poner('idioma', d.idioma);
  poner('zona_id', d.zonaId);
  poner('direccion', d.direccion);
  poner('horario', d.horario);
  poner('tope_pago', d.topePago);
  poner('tope_dia', d.topeDia);
  poner('tope_venta', d.topeVenta);
  poner('tope_deuda', d.topeDeuda);
  poner('aviso_fondo', d.avisoFondo);
  poner('estado', d.estado);
  const sentencias: D1PreparedStatement[] = [];
  if (cambios.length)
    sentencias.push(
      db
        .prepare(`UPDATE agentes SET ${cambios.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`)
        .bind(...cambios.map(([, v]) => v), id),
    );
  if (d.desbloquearPagos)
    sentencias.push(
      db
        .prepare('UPDATE agentes SET bloqueado_en = NULL, codigos_fallidos = 0 WHERE id = ?')
        .bind(id),
    );
  // Suspender cierra sus sesiones en el mismo lote: el panel deja de servirle al instante.
  if (d.estado === 'suspendido')
    sentencias.push(db.prepare('DELETE FROM agentes_sesiones WHERE agente_id = ?').bind(id));
  if (!sentencias.length) throw new ErrorDatos('No hay nada que cambiar.', undefined, 422);
  sentencias.push(
    db
      .prepare(
        'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(u.id, 'agente.cambiar', `agente:${id}`, JSON.stringify(antes), JSON.stringify(d)),
  );
  await db.batch(sentencias);
  return c.json({ agente: (await listarAgentes(db, id))[0] });
});

/** Mandarle de nuevo el enlace para crear su contraseña (cierra el acceso con la anterior al usarlo). */
agentes.post('/admin/agentes/:id/enlace', async (c) => {
  const u = exigir(c, 'admin');
  const db = base(c);
  const a = await db
    .prepare('SELECT id, nombre, correo, idioma FROM agentes WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ id: string; nombre: string; correo: string; idioma: string }>();
  if (!a) throw new ErrorDatos('Ese agente no existe.', undefined, 404);
  await auditar(db, u.id, 'agente.enlace', `agente:${a.id}`, {}).run();
  return c.json({ enlace: await mandarEnlaceClave(c, a) });
});

/** Anotar el fondo, una devolución, una entrega de lo vendido o una compensación. */
agentes.post('/admin/agentes/:id/libro', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      concepto: z.enum(CONCEPTOS_EQUIPO),
      monto: z.number().int().min(1).max(TOPES_AGENTE.anotacionMaxima),
      comprobante: z.string().trim().min(3).max(60),
      motivo: z.string().trim().max(120).default(''),
    }),
  );
  const db = base(c);
  const id = c.req.param('id');
  const saldos = await anotarEnAgente(db, { agenteId: id, ...d, autorId: u.id });
  await auditar(db, u.id, `agente.libro.${d.concepto}`, `agente:${id}`, { ...d, ...saldos }).run();
  return c.json({ agente: (await listarAgentes(db, id))[0] });
});

/** El interruptor por ciudad: encendido, en qué se paga, el mínimo y el tope diario por conductor. */
agentes.put('/admin/agentes-ciudad/:zona', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      activo: z.boolean(),
      pagaEn: z.enum(['USD', 'VES']),
      minimo: z.number().int().min(100).max(TOPES_AGENTE.minimoMaximo),
      topeConductorDia: z.number().int().min(100).max(TOPES_AGENTE.conductorDiaMaximo),
    }),
  );
  const db = base(c);
  const zona = c.req.param('zona');
  const antes = await ciudadAgentes(db, zona);
  if (d.pagaEn === 'VES' && antes.pais !== 'VE')
    throw new ErrorDatos('Solo las ciudades de Venezuela pagan en bolívares.', 'pagaEn', 422);
  if (d.pagaEn === 'USD' && d.minimo % 100 !== 0)
    throw new ErrorDatos('En dólares el mínimo tiene que ser un número entero.', 'minimo', 422);
  await db.batch([
    db
      .prepare(
        `INSERT INTO agentes_ciudad (zona_id, activo, paga_en, minimo, tope_conductor_dia, actualizado_por) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(zona_id) DO UPDATE SET activo = excluded.activo, paga_en = excluded.paga_en, minimo = excluded.minimo,
           tope_conductor_dia = excluded.tope_conductor_dia, actualizado_por = excluded.actualizado_por, actualizado_en = datetime('now')`,
      )
      .bind(zona, d.activo ? 1 : 0, d.pagaEn, d.minimo, d.topeConductorDia, u.id),
    db
      .prepare(
        'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(u.id, 'agente.ciudad', `zona:${zona}`, JSON.stringify(antes), JSON.stringify(d)),
  ]);
  return c.json({ ciudades: await ciudadesAgentes(db) });
});
