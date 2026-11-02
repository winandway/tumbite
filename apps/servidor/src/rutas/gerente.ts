import { Hono } from 'hono';
import { z } from 'zod';
import { enviarCorreo } from '../correo';
import { nuevoId, sha256 } from '../cripto';
import type { Env } from '../env';
import { guardarError } from '../errores';
import { notificar } from '../notificaciones';
import { adjuntosDe } from '../adjuntosTicket';
import { limiteIntentos } from '../seguridad';
import { type Variables, base } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { numeroDeTicket } from './tickets';

/**
 * C-GERENTE-TICKETS (1 nov 2026, pedido de Richard por la sesión de su correo): la puerta con la
 * que el gerente de correo lee los tickets de ayuda abiertos de las tres apps y los contesta.
 * Solo estas dos rutas, con «Authorization: Bearer <GERENTE_SECRETO>» (variable del panel, nunca
 * en el código), comparación en tiempo constante y límite de intentos. Sin la variable, la puerta
 * no existe para nadie. No entrega datos de pago ni direcciones: nombre, idioma, asunto y chat.
 */
export const gerente = new Hono<{ Bindings: Env; Variables: Variables }>();

/** Tiempo constante: se comparan los hashes, sin cortar en el primer carácter distinto. */
async function secretoValido(env: Env, cabecera: string | undefined) {
  const esperado = env.GERENTE_SECRETO;
  if (!esperado || !cabecera?.startsWith('Bearer ')) return false;
  const [a, b] = await Promise.all([sha256(cabecera.slice(7)), sha256(esperado)]);
  let diferencia = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++)
    diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferencia === 0;
}

gerente.use('/gerente/*', limiteIntentos(30, 60_000), async (c, next) => {
  if (!(await secretoValido(c.env, c.req.header('authorization'))))
    return c.json({ error: 'No autorizado.' }, 401);
  await next();
});

/** La app de donde vino el ticket, por el papel de la cuenta (sin cuenta: la app Divoox). */
const APP_POR_ROL = new Map([
  ['repartidor', 'divoox.driver'],
  ['restaurante', 'divoox.restaurantes'],
]);

gerente.get('/gerente/tickets', async (c) => {
  const db = base(c);
  const abiertos = c.req.query('estado') !== 'todos';
  const { results } = await db
    .prepare(
      `SELECT t.id, t.nombre, t.idioma, t.asunto, t.estado, t.creado_en, t.datos_json, t.ciudad, u.rol
         FROM tickets t LEFT JOIN usuarios u ON u.id = t.usuario_id
        WHERE t.tipo IN ('soporte', 'queja') ${abiertos ? "AND t.estado = 'abierto'" : ''}
        ORDER BY t.actualizado_en DESC LIMIT 100`,
    )
    .all<{
      id: string;
      nombre: string;
      idioma: string;
      asunto: string;
      estado: string;
      creado_en: string;
      datos_json: string | null;
      ciudad: string | null;
      rol: string | null;
    }>();
  const mensajes = results.length
    ? (
        await db
          .prepare(
            `SELECT id, ticket_id, autor, texto, creado_en FROM ticket_mensajes
              WHERE ticket_id IN (SELECT value FROM json_each(?)) ORDER BY creado_en`,
          )
          .bind(JSON.stringify(results.map((t) => t.id)))
          .all<{ id: string; ticket_id: string; autor: string; texto: string; creado_en: string }>()
      ).results
    : [];
  // C-CASOS-CAPTURAS: las capturas de cada mensaje, con su enlace firmado de 8 días.
  const adjuntos = await adjuntosDe(
    c.env,
    db,
    results.map((t) => t.id),
  );
  const iso = (f: string) => `${f.replace(' ', 'T')}Z`;
  return c.json({
    tickets: results.map((t) => {
      // C-CONTACTO: los casos que llegan por el formulario público traen su origen y el «Soy…».
      const datos = ((): Record<string, unknown> => {
        try {
          return JSON.parse(t.datos_json ?? '{}') as Record<string, unknown>;
        } catch {
          return {};
        }
      })();
      return {
        id: t.id,
        origen: datos.origen === 'contacto' ? 'contacto' : 'app',
        ...(datos.origen === 'contacto'
          ? {
              soy: String(datos.soy ?? 'otro'),
              numero_usuario: datos.numeroUsuario ? String(datos.numeroUsuario) : null,
              ciudad: t.ciudad || null,
            }
          : {}),
        numero: numeroDeTicket(t.id),
        app: APP_POR_ROL.get(t.rol ?? '') ?? 'divoox',
        cliente_nombre: t.nombre,
        idioma: t.idioma === 'en' ? 'en' : 'es',
        asunto: t.asunto,
        estado: t.estado,
        creado: iso(t.creado_en),
        mensajes: mensajes
          .filter((m) => m.ticket_id === t.id)
          .map((m) => ({
            de: m.autor === 'equipo' ? 'soporte' : 'cliente',
            fecha: iso(m.creado_en),
            texto: m.texto,
            adjuntos: (adjuntos.get(m.id) ?? []).map((a) => ({
              nombre: a.nombre,
              tipo: a.tipo,
              url: a.url,
            })),
          })),
      };
    }),
  });
});

const esquemaRespuesta = z.object({
  texto: z.string().trim().min(1).max(4000),
  plantilla: z
    .string()
    .regex(/^P\d{1,2}$/)
    .optional(),
  cerrar: z.boolean().default(false),
});

gerente.post('/gerente/tickets/:id/responder', async (c) => {
  const d = await leerCuerpo(c, esquemaRespuesta);
  const db = base(c);
  const t = await db
    .prepare(
      'SELECT id, nombre, correo, idioma, asunto, codigo, usuario_id FROM tickets WHERE id = ?',
    )
    .bind(c.req.param('id'))
    .first<{
      id: string;
      nombre: string;
      correo: string;
      idioma: string;
      asunto: string;
      codigo: string;
      usuario_id: string | null;
    }>();
  if (!t) throw new ErrorDatos('Ese ticket no existe.', undefined, 404);
  await db.batch([
    db
      .prepare(
        "INSERT INTO ticket_mensajes (id, ticket_id, autor, texto) VALUES (?, ?, 'equipo', ?)",
      )
      .bind(nuevoId(), t.id, d.texto),
    db
      .prepare("UPDATE tickets SET estado = ?, actualizado_en = datetime('now') WHERE id = ?")
      .bind(d.cerrar ? 'cerrado' : 'respondido', t.id),
  ]);
  const en = t.idioma === 'en';
  const numero = numeroDeTicket(t.id);
  const sitio = (c.env.SITIO_URL ?? 'https://divoox.com').replace(/\/$/, '');
  const ruta = new URL(c.req.url).pathname;
  // El aviso al celular (si la persona tiene la app con avisos encendidos).
  let aviso: 'ok' | 'error' | 'sin_app' = 'sin_app';
  if (t.usuario_id) {
    try {
      const r = await notificar(c.env, db, t.usuario_id, {
        titulo: en ? `We replied to your case ${numero}` : `Te respondimos tu caso ${numero}`,
        cuerpo: d.texto.slice(0, 140),
        datos: { tipo: 'ticket', codigo: t.codigo },
      });
      aviso = r.enviados > 0 ? 'ok' : 'sin_app';
    } catch (e) {
      aviso = 'error';
      await guardarError(db, 'POST', ruta, e);
    }
  }
  // El correo, siempre. Nunca en silencio: si falla, se dice y queda para el canario.
  const correo = await enviarCorreo(c.env, {
    de: 'soporte',
    para: t.correo,
    asunto: en ? `We replied to your case ${numero}` : `Te respondimos tu caso ${numero}`,
    texto: [
      en ? `Hi ${t.nombre},` : `Hola, ${t.nombre}.`,
      '',
      d.texto,
      '',
      en ? 'Reply here:' : 'Responde aquí:',
      `${sitio}/t/${t.codigo}`,
    ].join('\n'),
  }).catch((e: unknown) => ({ ok: false as const, motivo: String(e), rebotado: false }));
  if (!correo.ok)
    await guardarError(db, 'POST', ruta, new Error(`gerente: correo del ticket: ${correo.motivo}`));
  return c.json({
    ok: true,
    numero,
    plantilla: d.plantilla ?? null,
    aviso,
    correo: correo.ok ? 'ok' : 'error',
  });
});
