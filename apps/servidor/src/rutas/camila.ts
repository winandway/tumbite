import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { enviarCorreo } from '../correo';
import { nuevoId, sha256 } from '../cripto';
import { limiteIntentos } from '../seguridad';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { recibirMensaje } from '../camila/cerebro';
import { usarPersonaDelChat } from './camilaFallos';
import { enviarPorCanal } from '../camila/canales';
import { firmaDelEquipo } from '../camila/identidad';
import { recibirCorreo } from '../camila/correoEntrante';
import { anotarErrorDeCorreo, hiloDeCorreo } from '../camila/correoHilo';
import { armarListaSemanal, decidirPropuesta } from '../camila/aprendizaje';
import {
  type AjustesCamila,
  type Persona,
  NOMBRE_FIRMA_MAXIMO,
  REGALOS_POR_DIA_MAXIMO,
  anotarPais,
  guardarAjustes,
  humanoActivo,
  leerAjustes,
  limpiarNombreFirma,
  personaDeUsuario,
  personaDeVisitante,
  personaPorId,
  sentenciaMensaje,
  unirConCorreo,
} from '../camila/memoria';
import { accesoDe, filtroAlcance } from '../accesoInterno';
import { alcanceEsTotal, correoCanonico, esMarcaLineaIa } from '@tumbite/compartido';
import {
  CODIGOS_POR_CORREO_DIA,
  LARGO_MENSAJE_ANONIMO,
  MENSAJES_POR_ANONIMO,
  MENSAJES_POR_MINUTO_ANONIMO,
  MODELOS_CAMILA,
  TOPE_ANONIMOS_DIA,
  TOPE_MAXIMO_CENTAVOS,
  contarDelDia,
  gastoDeHoy,
  hoy,
  topeEnMicro,
} from '../camila/modelo';

/**
 * C-CAMILA (17 nov 2026) — todos los países. Las puertas de Camila:
 * - el chat (divoox.com sin cuenta o con cuenta, y Divoox Driver): /camila/hilo y /camila/mensaje;
 * - unir el chat anónimo con un correo: /camila/verificar (código de 6 dígitos al correo);
 * - el correo entrante llega por la puerta del gerente de correo (rutas/gerente.ts);
 * - el superadmin: /admin/camila/* (bandeja, hilos, aprendizaje y ajustes).
 */
const limiteLectura = limiteIntentos(300, 60_000);
const limiteEscritura = limiteIntentos(30, 60_000);

export const camila = new Hono<{ Bindings: Env; Variables: Variables }>();
type Ctx = Context<{ Bindings: Env; Variables: Variables }>;

// Leer el hilo (Driver lo consulta cada pocos segundos, y varios conductores comparten una red) tiene
// un límite amplio; escribir, uno corto.
camila.use('/camila/*', (c, next) =>
  (c.req.method === 'GET' ? limiteLectura : limiteEscritura)(c, next),
);
camila.use('/camila/verificar', limiteIntentos(5, 10 * 60_000));
camila.use('/camila/verificar/*', limiteIntentos(10, 10 * 60_000));

const idiomaDe = (c: Ctx): 'es' | 'en' =>
  (c.req.header('x-idioma') ?? '').startsWith('en') ? 'en' : 'es';

/** La persona del chat: la de la cuenta si hay sesión; si no, la ficha anónima del navegador. */
async function personaDelChat(c: Ctx, crear = true): Promise<Persona | null> {
  const db = base(c);
  const u = c.get('usuario');
  if (u) return personaDeUsuario(db, u.id);
  const visita = c.req.header('x-camila-visita') ?? '';
  if (!/^[A-Za-z0-9_-]{32,80}$/.test(visita))
    throw new ErrorDatos('Recarga la página para abrir el chat.', undefined, 400);
  const huella = await sha256(`camila:${visita}`);
  // Mirar no escribe: la ficha anónima nace con su primer mensaje, no al abrir el chat.
  if (!crear)
    return db
      .prepare('SELECT id FROM camila_personas WHERE visitante_hash = ?')
      .bind(huella)
      .first<{ id: string }>()
      .then((f) => (f ? personaPorId(db, f.id) : null));
  const ya = await db
    .prepare('SELECT 1 FROM camila_personas WHERE visitante_hash = ?')
    .bind(huella)
    .first();
  // C-CAMILA-ANONIMOS: tope diario de fichas anónimas nuevas (identificadores de visita inventados).
  if (!ya && !(await contarDelDia(db, 'anonimos', TOPE_ANONIMOS_DIA)))
    throw new ErrorDatos(
      'El chat está muy ocupado en este momento. Escríbenos por correo o entra con tu cuenta.',
      undefined,
      429,
    );
  return personaDeVisitante(db, huella, idiomaDe(c));
}
const personaQueEscribe = async (c: Ctx) => (await personaDelChat(c)) as Persona;
// C-CAMILA-FALLOS: la ruta de la captura usa la misma regla para saber de quién es el chat.
usarPersonaDelChat(personaDelChat);

async function hiloPublico(db: D1Database, p: Persona) {
  const { results } = await db
    .prepare(
      `SELECT m.id, m.autor, m.texto, m.creado_en, m.reportado_en IS NOT NULL AS reportado,
         (SELECT a.id FROM camila_adjuntos a WHERE a.mensaje_id = m.id LIMIT 1) AS adjunto
         FROM camila_mensajes m WHERE m.persona_id = ?
        ORDER BY m.creado_en DESC, m.rowid DESC LIMIT 60`,
    )
    .bind(p.id)
    .all<{
      id: string;
      autor: string;
      texto: string;
      creado_en: string;
      reportado: number;
      adjunto: string | null;
    }>();
  // C-CAMILA-REPORTE-CONVERSADO: la captura que quedó en el borrador sin enviarse (vuelve al abrir).
  const pendiente = await db
    .prepare(
      'SELECT id FROM camila_adjuntos WHERE persona_id = ? AND mensaje_id IS NULL ORDER BY creado_en DESC LIMIT 1',
    )
    .bind(p.id)
    .first<{ id: string }>();
  return {
    // Quedaron de la versión anterior del chat (la captura ya no se pide aparte): siempre falsos.
    pideCaptura: false,
    capturaPuesta: false,
    adjuntoPendiente: pendiente?.id ?? null,
    verificada: Boolean(p.usuario_id || p.correo),
    equipoAtendiendo: humanoActivo(p),
    // C-PERMISO-IA-CHAT: null = todavía no contestó (la pantalla le pregunta antes del primer mensaje).
    permisoIa: p.permiso_ia == null ? null : Number(p.permiso_ia) === 1,
    mensajes: results.reverse().map((m) => ({ ...m, reportado: Number(m.reportado) === 1 })),
  };
}

camila.get('/camila/hilo', async (c) => {
  const p = await personaDelChat(c, false);
  c.header('cache-control', 'private, no-store');
  if (!p)
    return c.json({
      pideCaptura: false,
      capturaPuesta: false,
      adjuntoPendiente: null,
      verificada: false,
      equipoAtendiendo: false,
      permisoIa: null,
      mensajes: [],
    });
  return c.json(await hiloPublico(base(c), p));
});

/**
 * C-PERMISO-IA-CHAT (21 nov 2026, Apple 5.1.2(i)): la persona da o retira su permiso para que su chat
 * de ayuda se procese con la IA de un proveedor. Lo contesta antes de su primer mensaje y lo puede
 * cambiar cuando quiera (Ajustes). Una escritura, solo si cambia.
 */
export const VERSION_PERMISO_IA_CHAT = '2026-11-21';
camila.post('/camila/permiso-ia', async (c) => {
  const d = await leerCuerpo(c, z.object({ acepto: z.boolean() }));
  const p = await personaQueEscribe(c);
  const valor = d.acepto ? 1 : 0;
  if (p.permiso_ia == null || Number(p.permiso_ia) !== valor)
    await base(c)
      .prepare(
        "UPDATE camila_personas SET permiso_ia = ?, permiso_ia_en = datetime('now'), permiso_ia_version = ? WHERE id = ?",
      )
      .bind(valor, `explicito-${VERSION_PERMISO_IA_CHAT}`, p.id)
      .run();
  return c.json({ ok: true, permisoIa: d.acepto });
});

camila.post('/camila/mensaje', async (c) => {
  const d = await leerCuerpo(
    c,
    z
      .object({
        texto: z.string().trim().max(2000).default(''),
        canal: z.enum(['web', 'app']).default('web'),
        // C-CHAT-WEB-SIN-MURO: la marca de la línea informativa (solo la web, sin muro).
        avisoIa: z.string().max(40).optional(),
        // C-CAMILA-REPORTE-CONVERSADO: la captura del borrador viaja con el mensaje.
        adjunto: z
          .string()
          .regex(/^[A-Za-z0-9_-]{8,64}$/)
          .optional(),
      })
      .refine((d) => d.texto.length > 0 || Boolean(d.adjunto), { error: 'Escribe tu mensaje.' }),
  );
  const db = base(c);
  // C-CAMILA-AVISO: una ficha sin país toma el de la petición (para saber si la ley pide el aviso).
  let p = await anotarPais(db, await personaQueEscribe(c), c.req.header('cf-ipcountry'));
  // El idioma sigue al de la pantalla (si alguien cambia de idioma, Camila también).
  const idioma = idiomaDe(c);
  if (p.idioma !== idioma) {
    await db.prepare('UPDATE camila_personas SET idioma = ? WHERE id = ?').bind(idioma, p.id).run();
    p = { ...p, idioma };
  }
  // C-CAMILA-ANONIMOS: una ficha anónima tiene un máximo de mensajes; después, que una su correo.
  if (!p.usuario_id && !p.correo && p.mensajes >= MENSAJES_POR_ANONIMO)
    throw new ErrorDatos(
      'Para seguir la conversación, une este chat a tu correo o entra con tu cuenta.',
      'verificar',
      429,
    );
  const anonima = !p.usuario_id && !p.correo;
  if (anonima) {
    // C-CAMILA-VISITANTE: un visitante sin cuenta no manda más de unos pocos mensajes por minuto.
    const reciente = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM camila_mensajes WHERE persona_id = ? AND autor = 'persona' AND creado_en > datetime('now', '-60 seconds')",
      )
      .bind(p.id)
      .first<{ n: number }>();
    if (Number(reciente?.n ?? 0) >= MENSAJES_POR_MINUTO_ANONIMO)
      throw new ErrorDatos('Vas muy rápido. Espera un momento y vuelve a escribir.', 'limite', 429);
  }
  // La captura tiene que ser de esta persona y estar todavía en su borrador (sin enviar).
  const adjunto = d.adjunto
    ? await db
        .prepare(
          'SELECT id, clave, tipo FROM camila_adjuntos WHERE id = ? AND persona_id = ? AND mensaje_id IS NULL',
        )
        .bind(d.adjunto, p.id)
        .first<{ id: string; clave: string; tipo: string }>()
    : null;
  if (d.adjunto && !adjunto)
    throw new ErrorDatos('Esa captura ya no está disponible. Adjúntala otra vez.', 'adjunto', 409);
  if (!d.texto && !adjunto) throw new ErrorDatos('Escribe tu mensaje.', undefined, 400);
  // C-CHAT-WEB-SIN-MURO (23 nov 2026): en el chat de la web no hay muro; la línea debajo de
  // la casilla informa y su marca viaja con el mensaje. Si la persona nunca contestó (ni sí ni no), se
  // guarda UNA vez cuándo y con qué versión se le informó. Un «no» (prefiero una persona) no se toca.
  // Android e iPhone no valen (el patrón solo acepta la web) y las apps ya publicadas tampoco: siguen como hoy.
  if (p.permiso_ia == null && esMarcaLineaIa(d.avisoIa)) {
    await db
      .prepare(
        "UPDATE camila_personas SET permiso_ia = 1, permiso_ia_en = datetime('now'), permiso_ia_version = ? WHERE id = ? AND permiso_ia IS NULL",
      )
      .bind(d.avisoIa, p.id)
      .run();
    p = { ...p, permiso_ia: 1 };
  }
  const r = await recibirMensaje(
    c.env,
    db,
    p,
    d.canal,
    anonima ? d.texto.slice(0, LARGO_MENSAJE_ANONIMO) : d.texto,
    {
      // Lo que Camila adjunta sola a un reporte de fallo: la app y su versión, y el aparato.
      peticion: { app: c.req.header('x-tumbite-app'), aparato: c.req.header('user-agent') },
      ...(adjunto ? { adjunto } : {}),
    },
  );
  const fresca = (await personaPorId(db, p.id)) ?? p;
  return c.json({ respuesta: r.respuesta, ...(await hiloPublico(db, fresca)) });
});

/**
 * C-CAMILA-REPORTAR (18 nov 2026, política de contenido generado por IA de Google Play): la persona
 * reporta una respuesta de Camila desde el mismo chat, sin salir de la app. El reporte queda marcado
 * en el mensaje y como caso en la bandeja del equipo. Solo las respuestas de Camila de su propio hilo,
 * y una sola vez cada una.
 */
camila.post('/camila/mensajes/:id/reportar', async (c) => {
  const db = base(c);
  const p = await personaDelChat(c, false);
  if (!p) throw new ErrorDatos('No encontramos esa respuesta.', undefined, 404);
  const id = c.req.param('id');
  const m = await db
    .prepare(
      "SELECT texto, reportado_en FROM camila_mensajes WHERE id = ? AND persona_id = ? AND autor = 'camila'",
    )
    .bind(id, p.id)
    .first<{ texto: string; reportado_en: string | null }>();
  if (!m) throw new ErrorDatos('No encontramos esa respuesta.', undefined, 404);
  // La marca y el caso van en UN lote: o quedan los dos o ninguno. El caso nace solo si la respuesta
  // todavía no estaba reportada (la misma condición en las dos sentencias; el caso va primero).
  if (!m.reportado_en)
    await db.batch([
      db
        .prepare(
          `INSERT INTO camila_casos (id, persona_id, resumen, motivo)
           SELECT ?1, persona_id, ?2, 'respuesta_reportada' FROM camila_mensajes
            WHERE id = ?3 AND persona_id = ?4 AND autor = 'camila' AND reportado_en IS NULL`,
        )
        .bind(
          nuevoId(),
          `Respuesta reportada: ${m.texto.replace(/\s+/g, ' ').slice(0, 130)}`,
          id,
          p.id,
        ),
      db
        .prepare(
          `UPDATE camila_mensajes SET reportado_en = datetime('now')
            WHERE id = ? AND persona_id = ? AND autor = 'camila' AND reportado_en IS NULL`,
        )
        .bind(id, p.id),
    ]);
  return c.json({ ok: true });
});

/** Unir el chat anónimo a un correo: se manda un código de 6 dígitos a ese correo. */
camila.post('/camila/verificar', async (c) => {
  const d = await leerCuerpo(
    c,
    z.object({ correo: z.email({ error: 'Escribe un correo válido.' }).max(120) }),
  );
  const p = await personaQueEscribe(c);
  if (p.usuario_id) return c.json({ ok: true, yaVerificada: true });
  // Límite por dirección de destino y por día, en su propia cuenta (no depende de la ficha que lo
  // pide ni de que después cambie de correo): como mucho CODIGOS_POR_CORREO_DIA al día por dirección,
  // y un código cada 2 minutos por ficha. Responde igual, sin decir si se mandó.
  const destino = correoCanonico(d.correo);
  const mio = await base(c)
    .prepare(
      "SELECT vence_en > datetime('now', '+13 minutes') AS reciente FROM camila_codigos WHERE persona_id = ?",
    )
    .bind(p.id)
    .first<{ reciente: number }>();
  if (Number(mio?.reciente ?? 0) === 1) return c.json({ ok: true });
  const cupo = await base(c)
    .prepare(
      `INSERT INTO camila_codigos_dia (correo, dia, enviados) VALUES (?1, ?2, 1)
       ON CONFLICT(correo, dia) DO UPDATE SET enviados = enviados + 1 WHERE camila_codigos_dia.enviados < ?3`,
    )
    .bind(destino, hoy(), CODIGOS_POR_CORREO_DIA)
    .run();
  if (!cupo.meta.changes) return c.json({ ok: true });
  const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(
    6,
    '0',
  );
  const db = base(c);
  await db
    .prepare(
      `INSERT INTO camila_codigos (persona_id, correo, codigo_hash, intentos, vence_en) VALUES (?, ?, ?, 0, datetime('now', '+15 minutes'))
       ON CONFLICT(persona_id) DO UPDATE SET correo = excluded.correo, codigo_hash = excluded.codigo_hash, intentos = 0, vence_en = excluded.vence_en`,
    )
    .bind(p.id, d.correo, await sha256(`${p.id}:${codigo}`))
    .run();
  const en = idiomaDe(c) === 'en';
  const envio = await enviarCorreo(c.env, {
    de: 'soporte',
    para: d.correo,
    idioma: en ? 'en' : 'es',
    asunto: en ? `Your Divoox code: ${codigo}` : `Tu código de Divoox: ${codigo}`,
    texto: en
      ? `Your code to continue the chat with Divoox Support is ${codigo}. It is valid for 15 minutes. If you did not ask for it, ignore this email.`
      : `Tu código para seguir el chat con el soporte de Divoox es ${codigo}. Vale por 15 minutos. Si no lo pediste, ignora este correo.`,
  });
  // Si el correo no salió, el cupo del día de esa dirección se devuelve: un fallo nuestro no le quita
  // intentos a la persona.
  if (!envio.ok)
    await db
      .prepare(
        'UPDATE camila_codigos_dia SET enviados = enviados - 1 WHERE correo = ? AND dia = ? AND enviados > 0',
      )
      .bind(destino, hoy())
      .run();
  return c.json({ ok: true });
});

camila.post('/camila/verificar/confirmar', async (c) => {
  const d = await leerCuerpo(
    c,
    z.object({ codigo: z.string().regex(/^\d{6}$/, { error: 'El código tiene 6 números.' }) }),
  );
  const db = base(c);
  const p = await personaQueEscribe(c);
  const f = await db
    .prepare(
      "UPDATE camila_codigos SET intentos = intentos + 1 WHERE persona_id = ? AND vence_en > datetime('now') AND intentos < 5 RETURNING correo, codigo_hash",
    )
    .bind(p.id)
    .first<{ correo: string; codigo_hash: string }>();
  if (!f || f.codigo_hash !== (await sha256(`${p.id}:${d.codigo}`)))
    throw new ErrorDatos('Ese código no es correcto o ya venció. Pide uno nuevo.', 'codigo', 422);
  await db.prepare('DELETE FROM camila_codigos WHERE persona_id = ?').bind(p.id).run();
  const unida = await unirConCorreo(db, p, f.correo);
  return c.json(await hiloPublico(db, unida));
});

/**
 * C-CAMILA-CORREO-HILO: el correo entrante. Lo trae el Worker «divoox-correo» (Cloudflare Email
 * Routing) o el gerente de correo, los dos con el secreto del gerente. La respuesta dice si Camila lo
 * tomó; si no (correo automático, tope, remitente sin autenticar), quien lo trae lo desvía al equipo.
 */
const cabecera = z.string().max(2000);
export async function correoEntrante(c: Ctx) {
  const d = await leerCuerpo(
    c,
    z.object({
      de: z.email().max(160),
      nombre: z.string().trim().max(80).default(''),
      asunto: z.string().trim().max(300).default(''),
      texto: z.string().max(20_000).default(''),
      para: z.string().max(200).optional(),
      messageId: cabecera.optional(),
      referencias: z.string().max(6000).optional(),
      autenticado: z.boolean().optional(),
      cabeceras: z.record(z.string().max(60), cabecera).optional(),
      adjuntos: z
        .array(
          z.object({
            nombre: z.string().max(200).optional(),
            tipo: z.string().max(100).optional(),
            base64: z.string().max(14_000_000),
          }),
        )
        .max(5)
        .optional(),
    }),
  );
  const db = base(c);
  try {
    return c.json(await recibirCorreo(c.env, db, d));
  } catch (e) {
    // Nunca en silencio: queda para el canario, y quien lo trae lo desvía al buzón del equipo.
    await anotarErrorDeCorreo(db, e).catch(() => undefined);
    throw e;
  }
}

// ------------------------------------------------------------------ superadmin

/**
 * C-PERMISOS-FINOS: quien trabaja una ciudad solo ve (y responde) las conversaciones de personas de
 * su ciudad; las que todavía no tienen ciudad (anónimas o solo por correo) las ve el alcance total.
 */
const alcance = (c: Ctx, columna = 'p.zona_id', usuario = 'p.usuario_id') =>
  filtroAlcance(accesoDe(c), {
    zona: columna,
    // Quien trabaja solo unos servicios ve a los conductores que tienen alguno de ellos.
    servicioEn: (lista) =>
      `EXISTS (SELECT 1 FROM habilitaciones h WHERE h.conductor_id = ${usuario} AND h.servicio_id IN ${lista})`,
  });

async function personaEnAlcance(c: Ctx, id: string) {
  const a = alcance(c);
  const p = await base(c)
    .prepare(`SELECT p.id FROM camila_personas p WHERE p.id = ?${a.sql}`)
    .bind(id, ...a.valores)
    .first<{ id: string }>();
  const persona = p ? await personaPorId(base(c), p.id) : null;
  if (!persona) throw new ErrorDatos('No encontramos esa conversación.', undefined, 404);
  return persona;
}

/** Los ajustes y lo que Camila aprende son de toda la empresa: solo con alcance total. */
function exigirAlcanceTotal(c: Ctx) {
  const a = accesoDe(c);
  if (a && !alcanceEsTotal(a.alcance))
    throw new ErrorDatos(
      'Esto es de toda la empresa: lo cambia alguien con alcance total.',
      'permiso',
      403,
    );
}

camila.get('/admin/camila/bandeja', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const [casos, esperando, ajustes, gasto] = await Promise.all([
    db
      .prepare(
        `SELECT k.id, k.persona_id, k.resumen, k.motivo, k.creado_en, p.nombre, p.canal_ultimo, p.humano_hasta
           FROM camila_casos k JOIN camila_personas p ON p.id = k.persona_id
          WHERE k.estado = 'abierto'${alcance(c).sql} ORDER BY k.creado_en DESC LIMIT 100`,
      )
      .bind(...alcance(c).valores)
      .all(),
    db
      .prepare(
        `SELECT p.id, p.nombre, p.canal_ultimo, p.humano_hasta, p.actualizado_en,
           (SELECT texto FROM camila_mensajes m WHERE m.persona_id = p.id ORDER BY creado_en DESC, rowid DESC LIMIT 1) AS ultimo,
           (SELECT autor FROM camila_mensajes m WHERE m.persona_id = p.id ORDER BY creado_en DESC, rowid DESC LIMIT 1) AS autor_ultimo
           FROM camila_personas p WHERE p.humano_hasta > datetime('now')${alcance(c).sql} ORDER BY p.actualizado_en DESC LIMIT 100`,
      )
      .bind(...alcance(c).valores)
      .all(),
    leerAjustes(db),
    gastoDeHoy(db),
  ]);
  return c.json({
    casos: casos.results,
    atendiendo: esperando.results,
    hoy: { ...gasto, topeMicro: topeEnMicro(ajustes.topeDiarioCentavos) },
  });
});

camila.get('/admin/camila/hilos', async (c) => {
  exigir(c, 'admin');
  const q = (c.req.query('q') ?? '').trim().slice(0, 60);
  const { results } = await base(c)
    .prepare(
      `SELECT p.id, p.nombre, p.correo, p.canal_ultimo, p.mensajes, p.humano_hasta, p.actualizado_en, p.usuario_id
         FROM camila_personas p
        WHERE p.mensajes > 0 AND (? = '' OR p.nombre LIKE '%' || ? || '%' OR p.correo LIKE '%' || ? || '%')${alcance(c).sql}
        ORDER BY p.actualizado_en DESC LIMIT 60`,
    )
    .bind(q, q, q, ...alcance(c).valores)
    .all();
  return c.json({ hilos: results });
});

camila.get('/admin/camila/hilos/:persona', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const p = await personaEnAlcance(c, c.req.param('persona'));
  const [mensajes, casos] = await Promise.all([
    db
      .prepare(
        `SELECT m.id, m.canal, m.autor, m.texto, m.creado_en, replace(u.nombre, 'Tumbite', 'Divoox') AS autor_nombre,
           (SELECT a.id FROM camila_adjuntos a WHERE a.mensaje_id = m.id LIMIT 1) AS adjunto FROM camila_mensajes m
           LEFT JOIN usuarios u ON u.id = m.autor_id WHERE m.persona_id = ? ORDER BY m.creado_en, m.rowid LIMIT 300`,
      )
      .bind(p.id)
      .all(),
    db
      .prepare(
        'SELECT id, resumen, motivo, estado, creado_en FROM camila_casos WHERE persona_id = ? ORDER BY creado_en DESC LIMIT 20',
      )
      .bind(p.id)
      .all(),
  ]);
  // C-CAMILA-CORREO-HILO: el asunto del último correo de la persona (el hilo donde sale la respuesta).
  const correo = await hiloDeCorreo(db, p.id);
  return c.json({
    persona: { ...p, equipoAtendiendo: humanoActivo(p) },
    mensajes: mensajes.results,
    casos: casos.results,
    correo: correo ? { asunto: correo.asunto, de: correo.para } : null,
  });
});

/**
 * Una persona del equipo responde en el mismo hilo. Toma la conversación por 12 horas (Camila no
 * contesta mientras tanto) y el mensaje sale por el canal por donde escribió la persona.
 */
camila.post('/admin/camila/hilos/:persona/responder', async (c) => {
  const yo = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({ texto: z.string().trim().min(1, { error: 'Escribe la respuesta.' }).max(3000) }),
  );
  const db = base(c);
  const p = await personaEnAlcance(c, c.req.param('persona'));
  await db.batch([
    sentenciaMensaje(db, {
      personaId: p.id,
      canal: p.canal_ultimo,
      autor: 'equipo',
      texto: d.texto,
      autorId: yo.id,
    }),
    db
      .prepare(
        "UPDATE camila_personas SET humano_hasta = datetime('now', '+12 hours'), humano_id = ?, actualizado_en = datetime('now') WHERE id = ?",
      )
      .bind(yo.id, p.id),
  ]);
  const en = p.idioma === 'en';
  // C-FIRMA-EQUIPO: lo que escribe una persona del equipo firma con el nombre de atención de los ajustes.
  const firma = firmaDelEquipo((await leerAjustes(db)).nombreFirmaEquipo, en ? 'en' : 'es');
  // C-CAMILA-CORREO-HILO: por correo sale en el mismo hilo de la persona, firmado por quien responde.
  const porCorreo = p.canal_ultimo === 'correo';
  const salida = await enviarPorCanal(
    c.env,
    db,
    p,
    p.canal_ultimo,
    porCorreo ? d.texto : `${d.texto}\n\n${firma}`,
    { aviso: true, ...(porCorreo ? { firma } : {}) },
  );
  return c.json({ ok: true, enviado: salida.enviado, motivo: salida.motivo ?? null });
});

/** El equipo le devuelve la conversación a Camila. */
camila.post('/admin/camila/hilos/:persona/devolver', async (c) => {
  exigir(c, 'admin');
  const p = await personaEnAlcance(c, c.req.param('persona'));
  await base(c)
    .prepare('UPDATE camila_personas SET humano_hasta = NULL, humano_id = NULL WHERE id = ?')
    .bind(p.id)
    .run();
  return c.json({ ok: true });
});

camila.post('/admin/camila/casos/:id/cerrar', async (c) => {
  const yo = exigir(c, 'admin');
  const r = await base(c)
    .prepare(
      "UPDATE camila_casos SET estado = 'cerrado', cerrado_en = datetime('now'), cerrado_por = ? WHERE id = ? AND estado = 'abierto'",
    )
    .bind(yo.id, c.req.param('id'))
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ese caso ya estaba cerrado.', undefined, 404);
  return c.json({ ok: true });
});

camila.get('/admin/camila/aprendizaje', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const [propuestas, aprobadas] = await Promise.all([
    db
      .prepare(
        "SELECT * FROM camila_conocimiento WHERE estado = 'propuesta' ORDER BY veces DESC, creado_en DESC LIMIT 100",
      )
      .all(),
    db
      .prepare(
        "SELECT * FROM camila_conocimiento WHERE estado = 'aprobada' ORDER BY decidido_en DESC LIMIT 200",
      )
      .all(),
  ]);
  const pendientes = await db
    .prepare('SELECT COUNT(*) AS n FROM camila_sin_respuesta WHERE propuesta_id IS NULL')
    .first<{ n: number }>();
  return c.json({
    propuestas: propuestas.results,
    aprobadas: aprobadas.results,
    sinLista: Number(pendientes?.n ?? 0),
  });
});

camila.post('/admin/camila/aprendizaje/armar', async (c) => {
  exigir(c, 'admin');
  exigirAlcanceTotal(c);
  return c.json({ creadas: await armarListaSemanal(base(c)) });
});

camila.post('/admin/camila/aprendizaje/:id/aprobar', async (c) => {
  const yo = exigir(c, 'admin');
  exigirAlcanceTotal(c);
  const d = await leerCuerpo(
    c,
    z.object({
      preguntaEs: z.string().trim().min(3, { error: 'Escribe la pregunta en español.' }).max(300),
      preguntaEn: z.string().trim().min(3, { error: 'Escribe la pregunta en inglés.' }).max(300),
      respuestaEs: z
        .string()
        .trim()
        .min(3, { error: 'Escribe la respuesta en español.' })
        .max(2000),
      respuestaEn: z.string().trim().min(3, { error: 'Escribe la respuesta en inglés.' }).max(2000),
    }),
  );
  await decidirPropuesta(base(c), c.req.param('id'), { decision: 'aprobar', ...d, autorId: yo.id });
  return c.json({ ok: true });
});

camila.post('/admin/camila/aprendizaje/:id/rechazar', async (c) => {
  const yo = exigir(c, 'admin');
  exigirAlcanceTotal(c);
  await decidirPropuesta(base(c), c.req.param('id'), { decision: 'rechazar', autorId: yo.id });
  return c.json({ ok: true });
});

camila.get('/admin/camila/ajustes', async (c) => {
  exigir(c, 'admin');
  return c.json({
    ajustes: await leerAjustes(base(c)),
    limites: {
      topeMaximoCentavos: TOPE_MAXIMO_CENTAVOS,
      regalosPorDiaMaximo: REGALOS_POR_DIA_MAXIMO,
    },
    modelos: { normal: MODELOS_CAMILA.normal.id, dificil: MODELOS_CAMILA.dificil.id },
    iaConectada: Boolean(c.env.GEMINI_API_KEY),
  });
});

camila.put('/admin/camila/ajustes', async (c) => {
  exigir(c, 'admin');
  exigirAlcanceTotal(c);
  const antes = await leerAjustes(base(c));
  const cuerpo = await leerCuerpo(
    c,
    z.object({
      ia: z.boolean(),
      topeDiarioCentavos: z.number().int().min(0).max(TOPE_MAXIMO_CENTAVOS, {
        error: 'El tope diario no puede pasar de 5 dólares.',
      }),
      regalosPorDia: z.number().int().min(0).max(REGALOS_POR_DIA_MAXIMO),
      // C-FIRMA-EQUIPO: el nombre de atención del equipo; sin mandarlo se queda el que estaba.
      nombreFirmaEquipo: z
        .string()
        .max(NOMBRE_FIRMA_MAXIMO, { error: 'El nombre de firma va hasta 40 letras.' })
        .refine((x) => x.trim() === '' || limpiarNombreFirma(x) !== '', {
          error: 'El nombre de firma lleva solo letras y espacios.',
        })
        .optional(),
    }),
  );
  const d: AjustesCamila = {
    ...cuerpo,
    nombreFirmaEquipo:
      cuerpo.nombreFirmaEquipo === undefined
        ? antes.nombreFirmaEquipo
        : limpiarNombreFirma(cuerpo.nombreFirmaEquipo),
  };
  await guardarAjustes(base(c), d);
  return c.json({ ajustes: d });
});
