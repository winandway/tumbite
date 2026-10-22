import { topesDeZona } from '../internacional/tarifas';
import { devolverParcial, leerConfigQuejas } from '../devoluciones';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Idioma } from '@tumbite/compartido';
import type { Env } from '../env';
import { nuevoId, nuevoToken } from '../cripto';
import { enviarCorreo, type Remitente } from '../correo';
import { limiteIntentos } from '../seguridad';
import { type Variables, base, exigir } from '../sesion';
import { pasaTurnstile } from '../turnstile';
import { ErrorDatos, leerCuerpo } from '../validar';
import { rutaSuperadmin } from '../superadmin';

/**
 * Tickets (como en YaDominios Cloud): cada formulario abre una conversación. La persona recibe por
 * correo su enlace secreto /t/<codigo> (largo, no se adivina, no se indexa) y ahí conversa con el
 * equipo; a Richard le llega el aviso desde no-reply con el enlace a su superadmin. Cada respuesta
 * avisa al otro lado. Candado C-TICKETS.
 */
export const tickets = new Hono<{ Bindings: Env; Variables: Variables }>();

export type TipoTicket =
  | 'espera_comensal'
  | 'espera_restaurante'
  | 'espera_repartidor'
  | 'franquicia'
  | 'queja'
  | 'soporte';

const SITIO = 'https://tumbite.com';
const enlacePublico = (codigo: string) => `${SITIO}/t/${codigo}`;

const NOMBRE_TIPO: Record<TipoTicket, Record<Idioma, string>> = {
  espera_comensal: { es: 'Lista de espera (cliente)', en: 'Waitlist (customer)' },
  espera_restaurante: { es: 'Lista de espera (restaurante)', en: 'Waitlist (restaurant)' },
  espera_repartidor: { es: 'Lista de espera (repartidor)', en: 'Waitlist (driver)' },
  franquicia: { es: 'Franquicia', en: 'Franchise' },
  queja: { es: 'Queja', en: 'Complaint' },
  soporte: { es: 'Soporte', en: 'Support' },
};
const REMITENTE_DE: Record<TipoTicket, Remitente> = {
  espera_comensal: 'hola',
  espera_restaurante: 'hola',
  espera_repartidor: 'hola',
  franquicia: 'ventas',
  queja: 'soporte',
  soporte: 'soporte',
};

export type NuevoTicket = {
  tipo: TipoTicket;
  nombre: string;
  correo: string;
  telefono?: string;
  pais?: string;
  ciudad?: string;
  idioma: Idioma;
  asunto: string;
  mensaje: string;
  datos?: Record<string, unknown>;
  usuarioId?: string | null;
  pedidoId?: string | null;
  zonaId?: string | null;
  /** Primer párrafo del correo de confirmación (p. ej. la bienvenida a la lista de espera). */
  intro?: string;
  /** Asunto del correo a la persona, si no es el del ticket. */
  asuntoCorreo?: string;
};

function adminsDe(env: Env): string[] {
  return (env.ADMIN_CORREOS ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

async function enlaceAdmin(env: Env, ticketId: string): Promise<string> {
  const ruta = await rutaSuperadmin(env);
  return ruta ? `${SITIO}/panel/${ruta}/tickets/${ticketId}` : `${SITIO}/panel`;
}

/** Crea el ticket con su primer mensaje y avisa a los dos lados. Nunca deja el envío a medias. */
export async function crearTicket(
  env: Env,
  db: D1Database,
  t: NuevoTicket,
): Promise<{ id: string; codigo: string }> {
  const id = nuevoId();
  const codigo = nuevoToken();
  await db.batch([
    db
      .prepare(
        `INSERT INTO tickets (id, codigo, tipo, nombre, correo, telefono, pais, ciudad, idioma, asunto, datos_json, usuario_id, pedido_id, zona_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        id,
        codigo,
        t.tipo,
        t.nombre,
        t.correo,
        t.telefono ?? '',
        t.pais ?? '',
        t.ciudad ?? '',
        t.idioma,
        t.asunto,
        JSON.stringify(t.datos ?? {}),
        t.usuarioId ?? null,
        t.pedidoId ?? null,
        t.zonaId ?? null,
      ),
    db
      .prepare(
        "INSERT INTO ticket_mensajes (id, ticket_id, autor, texto) VALUES (?, ?, 'persona', ?)",
      )
      .bind(nuevoId(), id, t.mensaje),
  ]);

  const en = t.idioma === 'en';
  const enlace = enlacePublico(codigo);
  const confirmacion = [
    en ? `Hi ${t.nombre},` : `Hola, ${t.nombre}.`,
    '',
    t.intro ??
      (en
        ? 'We received your message and we’ll reply soon.'
        : 'Recibimos tu mensaje y te respondemos pronto.'),
    '',
    en
      ? 'Your conversation with our team lives here (keep this link, it’s private):'
      : 'Tu conversación con nuestro equipo está aquí (guarda este enlace, es privado):',
    enlace,
    '',
    en
      ? 'We’ll email you every time we reply.'
      : 'Te avisamos por correo cada vez que te respondamos.',
  ].join('\n');
  await enviarCorreo(env, {
    de: REMITENTE_DE[t.tipo],
    para: t.correo,
    asunto: t.asuntoCorreo ?? `${t.asunto} · Divoox`,
    texto: confirmacion,
  });

  const admin = await enlaceAdmin(env, id);
  const resumen = [
    `${NOMBRE_TIPO[t.tipo].es}: ${t.asunto}`,
    '',
    `De: ${t.nombre} <${t.correo}>${t.telefono ? ` · ${t.telefono}` : ''}`,
    t.pais || t.ciudad ? `Lugar: ${[t.ciudad, t.pais].filter(Boolean).join(', ')}` : '',
    '',
    t.mensaje,
    '',
    `Responder en el superadmin: ${admin}`,
  ]
    .filter((x, i, xs) => x !== '' || xs[i - 1] !== '')
    .join('\n');
  for (const para of adminsDe(env))
    await enviarCorreo(env, {
      de: 'avisos',
      para,
      asunto: `Nuevo ticket · ${NOMBRE_TIPO[t.tipo].es} · ${t.nombre}`,
      texto: resumen,
    });
  return { id, codigo };
}

type FilaTicket = {
  id: string;
  codigo: string;
  tipo: TipoTicket;
  estado: string;
  nombre: string;
  correo: string;
  telefono: string;
  pais: string;
  ciudad: string;
  idioma: Idioma;
  asunto: string;
  datos_json: string;
  pedido_id: string | null;
  zona_id: string | null;
  creado_en: string;
  actualizado_en: string;
};

async function mensajesDe(db: D1Database, ticketId: string) {
  const { results } = await db
    .prepare(
      'SELECT autor, texto, creado_en AS fecha FROM ticket_mensajes WHERE ticket_id = ? ORDER BY creado_en, rowid',
    )
    .bind(ticketId)
    .all<{ autor: 'persona' | 'equipo'; texto: string; fecha: string }>();
  return results;
}

const esquemaMensaje = z.object({ texto: z.string().trim().min(1).max(5000) });
const codigoValido = (c: string) => /^[A-Za-z0-9_-]{40,60}$/.test(c);

// ───────────────────────── La persona, con su enlace ─────────────────────────

tickets.get('/tickets/:codigo', limiteIntentos(60, 60_000), async (c) => {
  const codigo = c.req.param('codigo');
  if (!codigoValido(codigo)) throw new ErrorDatos('Esta conversación no existe.', undefined, 404);
  const t = await base(c)
    .prepare('SELECT * FROM tickets WHERE codigo = ?')
    .bind(codigo)
    .first<FilaTicket>();
  if (!t) throw new ErrorDatos('Esta conversación no existe.', undefined, 404);
  c.header('X-Robots-Tag', 'noindex, nofollow');
  c.header('Cache-Control', 'no-store');
  return c.json({
    ticket: {
      tipo: t.tipo,
      estado: t.estado,
      nombre: t.nombre,
      asunto: t.asunto,
      creado: t.creado_en,
      mensajes: await mensajesDe(base(c), t.id),
    },
  });
});

tickets.post('/tickets/:codigo/mensajes', limiteIntentos(20, 60_000), async (c) => {
  const codigo = c.req.param('codigo');
  if (!codigoValido(codigo)) throw new ErrorDatos('Esta conversación no existe.', undefined, 404);
  const db = base(c);
  const t = await db
    .prepare('SELECT * FROM tickets WHERE codigo = ?')
    .bind(codigo)
    .first<FilaTicket>();
  if (!t) throw new ErrorDatos('Esta conversación no existe.', undefined, 404);
  const { texto } = await leerCuerpo(c, esquemaMensaje);
  await db.batch([
    db
      .prepare(
        "INSERT INTO ticket_mensajes (id, ticket_id, autor, texto) VALUES (?, ?, 'persona', ?)",
      )
      .bind(nuevoId(), t.id, texto),
    db
      .prepare(
        "UPDATE tickets SET estado = 'abierto', actualizado_en = datetime('now') WHERE id = ?",
      )
      .bind(t.id),
  ]);
  const admin = await enlaceAdmin(c.env, t.id);
  for (const para of adminsDe(c.env))
    await enviarCorreo(c.env, {
      de: 'avisos',
      para,
      asunto: `Respuesta en ticket · ${t.nombre} · ${t.asunto}`,
      texto: `${t.nombre} escribió:\n\n${texto}\n\nResponder en el superadmin: ${admin}`,
    });
  return c.json({ ok: true, mensajes: await mensajesDe(db, t.id) }, 201);
});

// ───────────────────────── Formulario de franquicias ─────────────────────────

const esquemaFranquicia = z.object({
  nombre: z.string().trim().min(2).max(120),
  correo: z.string().trim().email().max(200),
  telefono: z.string().trim().min(6).max(40),
  pais: z.string().trim().min(2).max(80),
  ciudad: z.string().trim().min(2).max(120),
  empresa: z.string().trim().max(160).default(''),
  capital: z.enum(['menos-50k', '50k-150k', '150k-500k', 'mas-500k']),
  experiencia: z.string().trim().max(1000).default(''),
  cuando: z.enum(['ya', '3-meses', '6-meses', 'mas-adelante']),
  mensaje: z.string().trim().max(3000).default(''),
  idioma: z.enum(['es', 'en']).default('es'),
});

const CAPITAL: Record<string, string> = {
  'menos-50k': 'Menos de 50 000 USD',
  '50k-150k': '50 000 a 150 000 USD',
  '150k-500k': '150 000 a 500 000 USD',
  'mas-500k': 'Más de 500 000 USD',
};
const CUANDO: Record<string, string> = {
  ya: 'Lo antes posible',
  '3-meses': 'En los próximos 3 meses',
  '6-meses': 'En los próximos 6 meses',
  'mas-adelante': 'Más adelante',
};

tickets.post('/franquicias', limiteIntentos(5, 60_000), async (c) => {
  const humano = await pasaTurnstile(
    c.env.TURNSTILE_SECRET_KEY,
    c.req.header('cf-turnstile-response'),
    c.req.header('cf-connecting-ip'),
  );
  if (!humano)
    throw new ErrorDatos(
      'No pudimos confirmar que eres una persona. Recarga la página e intenta de nuevo.',
      undefined,
      403,
    );
  const d = await leerCuerpo(c, esquemaFranquicia);
  const mensaje = [
    `Empresa: ${d.empresa || '—'}`,
    `Capital disponible: ${CAPITAL[d.capital] ?? d.capital}`,
    `Cuándo quiere arrancar: ${CUANDO[d.cuando] ?? d.cuando}`,
    `Experiencia: ${d.experiencia || '—'}`,
    '',
    d.mensaje || '(sin mensaje)',
  ].join('\n');
  const t = await crearTicket(c.env, base(c), {
    tipo: 'franquicia',
    nombre: d.nombre,
    correo: d.correo,
    telefono: d.telefono,
    pais: d.pais,
    ciudad: d.ciudad,
    idioma: d.idioma,
    asunto:
      d.idioma === 'en'
        ? `Franchise in ${d.ciudad}, ${d.pais}`
        : `Franquicia en ${d.ciudad}, ${d.pais}`,
    mensaje,
    datos: { empresa: d.empresa, capital: d.capital, cuando: d.cuando },
    intro:
      d.idioma === 'en'
        ? `Thanks for your interest in bringing Divoox to ${d.ciudad}. Our team will review your city and get back to you with the numbers.`
        : `Gracias por querer llevar Divoox a ${d.ciudad}. Nuestro equipo va a estudiar tu ciudad y te responde con los números.`,
  });
  return c.json({ ok: true, enlace: `/t/${t.codigo}` }, 201);
});

// ───────────────────────── Quejas y soporte (con sesión) ─────────────────────────

export const MOTIVOS_QUEJA = [
  'articulo_faltante',
  'pedido_incorrecto',
  'frio_o_danado',
  'tarde',
  'repartidor',
  'otro',
] as const;
const esquemaQueja = z.object({
  tipo: z.enum(['queja', 'soporte']).default('queja'),
  pedidoId: z.string().uuid().nullish(),
  texto: z.string().trim().min(5).max(5000),
  /** Queja guiada (auditoría final, punto 16): el motivo y, si falta algo, qué platos. */
  motivo: z.enum(MOTIVOS_QUEJA).default('otro'),
  platoIds: z.array(z.string().min(1)).max(50).default([]),
});

tickets.post('/quejas', limiteIntentos(10, 60_000), async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(c, esquemaQueja);
  const db = base(c);
  let zonaId: string | null = null;
  let propuesta = 0;
  let reembolso: { monto: number } | null = null;
  if (d.pedidoId) {
    const p = await db
      .prepare(
        `SELECT p.zona_id, p.cliente_id, p.estado, p.lineas_json FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
         WHERE p.id = ? AND (p.cliente_id = ? OR p.repartidor_id = ? OR r.dueno_id = ?)`,
      )
      .bind(d.pedidoId, u.id, u.id, u.id)
      .first<{ zona_id: string; cliente_id: string; estado: string; lineas_json: string }>();
    if (!p) throw new ErrorDatos('Ese pedido no existe.', 'pedidoId', 404);
    zonaId = p.zona_id;
    // Queja guiada: con «artículo faltante» se calcula lo que valen esos platos; si el reembolso
    // automático está encendido (Richard) y cabe en el tope, se devuelve ya; si no, va al ticket.
    if (d.motivo === 'articulo_faltante' && d.platoIds.length && p.cliente_id === u.id) {
      const lineas = JSON.parse(p.lineas_json) as {
        platoId: string;
        precioCentavos: number;
        cantidad: number;
      }[];
      const elegidos = new Set(d.platoIds);
      propuesta = lineas
        .filter((l) => elegidos.has(l.platoId))
        .reduce((s, l) => s + l.precioCentavos * l.cantidad, 0);
      const cfg = await leerConfigQuejas(db);
      // C-TOPES-PAIS: el tope del país del pedido (EE. UU.: el que fija soporte, como siempre).
      const { topes } = await topesDeZona(db, p.zona_id);
      if (
        propuesta > 0 &&
        cfg.reembolsoAuto &&
        propuesta <= (topes?.quejaReembolsoMax ?? 0) &&
        p.estado === 'entregado'
      ) {
        try {
          await devolverParcial(c.env, db, {
            pedidoId: d.pedidoId,
            monto: propuesta,
            motivo: `queja automática: artículo faltante (${d.platoIds.length})`,
            cargarA: 'tumbite',
            actorId: null,
          });
          reembolso = { monto: propuesta };
        } catch (e) {
          console.error('queja guiada: no se pudo devolver solo, queda en el ticket', e);
        }
      }
    }
  }
  const papel = {
    cliente: 'cliente',
    repartidor: 'repartidor',
    restaurante: 'restaurante',
    admin: 'admin',
  }[u.rol];
  const t = await crearTicket(c.env, db, {
    tipo: d.tipo,
    nombre: u.nombre,
    correo: u.correo,
    idioma: u.idioma,
    asunto:
      (u.idioma === 'en'
        ? d.tipo === 'queja'
          ? 'Problem report'
          : 'Help request'
        : d.tipo === 'queja'
          ? 'Reporte de un problema'
          : 'Pedido de ayuda') + (d.pedidoId ? ` · #${d.pedidoId.slice(0, 4).toUpperCase()}` : ''),
    mensaje: d.texto,
    datos: {
      papel,
      motivo: d.motivo,
      platoIds: d.platoIds,
      propuesta,
      reembolsoAutomatico: reembolso?.monto ?? 0,
    },
    usuarioId: u.id,
    pedidoId: d.pedidoId ?? null,
    zonaId,
  });
  return c.json(
    { ok: true, enlace: `/t/${t.codigo}`, propuesta, reembolso: reembolso?.monto ?? 0 },
    201,
  );
});

// ───────────────────────── El equipo (superadmin) ─────────────────────────

/** La dirección privada del superadmin: solo se la decimos a una cuenta admin. */
tickets.get('/admin/ruta', async (c) => {
  exigir(c, 'admin');
  return c.json({ ruta: await rutaSuperadmin(c.env) });
});

tickets.get('/admin/tickets', async (c) => {
  exigir(c, 'admin');
  const estado = c.req.query('estado');
  const tipo = c.req.query('tipo');
  const filtros: string[] = [];
  const valores: string[] = [];
  if (estado) {
    filtros.push('estado = ?');
    valores.push(estado);
  }
  if (tipo) {
    filtros.push('tipo = ?');
    valores.push(tipo);
  }
  const { results } = await base(c)
    .prepare(
      `SELECT id, tipo, estado, nombre, correo, telefono, pais, ciudad, asunto, zona_id AS zonaId, pedido_id AS pedidoId,
       creado_en AS creado, actualizado_en AS actualizado,
       (SELECT texto FROM ticket_mensajes m WHERE m.ticket_id = tickets.id ORDER BY creado_en DESC, rowid DESC LIMIT 1) AS ultimo
       FROM tickets ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}
       ORDER BY (estado = 'abierto') DESC, actualizado_en DESC LIMIT 300`,
    )
    .bind(...valores)
    .all();
  const { results: totales } = await base(c)
    .prepare('SELECT estado, COUNT(*) AS n FROM tickets GROUP BY estado')
    .all<{ estado: string; n: number }>();
  return c.json({
    tickets: results,
    totales: Object.fromEntries(totales.map((t) => [t.estado, Number(t.n)])),
  });
});

tickets.get('/admin/tickets/:id', async (c) => {
  exigir(c, 'admin');
  const t = await base(c)
    .prepare('SELECT * FROM tickets WHERE id = ?')
    .bind(c.req.param('id'))
    .first<FilaTicket>();
  if (!t) throw new ErrorDatos('Ese ticket no existe.', undefined, 404);
  return c.json({
    ticket: {
      id: t.id,
      tipo: t.tipo,
      estado: t.estado,
      nombre: t.nombre,
      correo: t.correo,
      telefono: t.telefono,
      pais: t.pais,
      ciudad: t.ciudad,
      idioma: t.idioma,
      asunto: t.asunto,
      datos: JSON.parse(t.datos_json) as Record<string, unknown>,
      pedidoId: t.pedido_id,
      zonaId: t.zona_id,
      creado: t.creado_en,
      enlace: `/t/${t.codigo}`,
      mensajes: await mensajesDe(base(c), t.id),
    },
  });
});

tickets.post('/admin/tickets/:id/mensajes', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const t = await db
    .prepare('SELECT * FROM tickets WHERE id = ?')
    .bind(c.req.param('id'))
    .first<FilaTicket>();
  if (!t) throw new ErrorDatos('Ese ticket no existe.', undefined, 404);
  const { texto } = await leerCuerpo(c, esquemaMensaje);
  await db.batch([
    db
      .prepare(
        "INSERT INTO ticket_mensajes (id, ticket_id, autor, texto) VALUES (?, ?, 'equipo', ?)",
      )
      .bind(nuevoId(), t.id, texto),
    db
      .prepare(
        "UPDATE tickets SET estado = 'respondido', actualizado_en = datetime('now') WHERE id = ?",
      )
      .bind(t.id),
  ]);
  const en = t.idioma === 'en';
  await enviarCorreo(c.env, {
    de: REMITENTE_DE[t.tipo],
    para: t.correo,
    asunto: en ? `New reply · ${t.asunto}` : `Nueva respuesta · ${t.asunto}`,
    texto: [
      en ? `Hi ${t.nombre},` : `Hola, ${t.nombre}.`,
      '',
      en ? 'Our team replied:' : 'Nuestro equipo te respondió:',
      '',
      texto,
      '',
      en ? 'Reply here:' : 'Responde aquí:',
      enlacePublico(t.codigo),
    ].join('\n'),
  });
  return c.json({ ok: true, mensajes: await mensajesDe(db, t.id) }, 201);
});

const esquemaEstado = z.object({ estado: z.enum(['abierto', 'respondido', 'cerrado']) });

tickets.patch('/admin/tickets/:id', async (c) => {
  exigir(c, 'admin');
  const { estado } = await leerCuerpo(c, esquemaEstado);
  const r = await base(c)
    .prepare("UPDATE tickets SET estado = ?, actualizado_en = datetime('now') WHERE id = ?")
    .bind(estado, c.req.param('id'))
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ese ticket no existe.', undefined, 404);
  return c.json({ ok: true });
});
