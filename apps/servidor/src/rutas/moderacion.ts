import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { correosEquipo } from '../avisosEquipo';
import { enviarCorreo } from '../correo';
import { notificar, type Idioma } from '../notificaciones';
import { accesoDe, alcanceObjetoSql, exigirPermiso, objetoFueraDeAlcance } from '../accesoInterno';
import { limiteIntentos } from '../seguridad';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';

/**
 * C-MODERACION (16 nov 2026, todos los países). Regla 1.2 de Apple para apps con chat y contenido de
 * personas, como Uber, DoorDash y Rappi:
 * - «Reportar» en cada mensaje del chat (pedido y viaje), en cada reseña y en cada respuesta del
 *   restaurante, con motivo (ofensivo, acoso, spam, otro) y una nota opcional.
 * - «Bloquear» a la otra persona del pedido o del viaje: no se le vuelve a ofrecer su pedido ni su
 *   viaje, quien bloqueó deja de ver sus mensajes y de recibir los avisos de sus mensajes.
 * - El filtro de palabras (`filtroPalabras.ts`) deja aquí lo que marcó, sin que nadie lo reporte.
 * - El equipo lo ve en la bandeja «Reportes» del superadmin y actúa: ocultar, volver a publicar,
 *   avisar a quien lo escribió, suspender la cuenta o descartar.
 * Quien fue reportado o bloqueado NUNCA sabe quién fue: ninguna respuesta fuera del equipo lo dice,
 * y el aviso de «avisar» habla de las normas, no del reporte.
 */
export const moderacion = new Hono<{ Bindings: Env; Variables: Variables }>();

export const TIPOS_CONTENIDO = [
  'mensaje_pedido',
  'mensaje_viaje',
  'resena',
  'respuesta_resena',
] as const;
export type TipoContenido = (typeof TIPOS_CONTENIDO)[number];
export const MOTIVOS_REPORTE = ['ofensivo', 'acoso', 'spam', 'otro'] as const;
export const ACCIONES_REPORTE = [
  'ocultar',
  'publicar',
  'avisar',
  'suspender',
  'descartar',
] as const;

/** Reportes por persona y por minuto (nadie llena la bandeja apretando el botón). */
export const REPORTES_POR_MINUTO = 10;

// ───────────────────────────── Piezas que usan las demás rutas ─────────────────────────────

/** El filtro tapó o retuvo algo: queda en la bandeja para que el equipo lo revise (una vez). */
export async function marcarPorFiltro(
  db: D1Database,
  r: {
    tipo: TipoContenido;
    ref: string;
    objeto: 'pedido' | 'viaje';
    objetoId: string;
    autorId: string | null;
    texto: string;
  },
) {
  await db
    .prepare(
      `INSERT OR IGNORE INTO reportes_contenido (id, tipo, ref, objeto, objeto_id, autor_id, reporta_id, motivo, texto)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 'filtro', ?)`,
    )
    .bind(nuevoId(), r.tipo, r.ref, r.objeto, r.objetoId, r.autorId, r.texto.slice(0, 1000))
    .run();
}

/** ¿`quien` bloqueó a `a`? (una lectura por la llave primaria). */
export async function bloqueo(db: D1Database, quien: string, a: string): Promise<boolean> {
  return Boolean(
    await db
      .prepare('SELECT 1 FROM bloqueos_usuario WHERE usuario_id = ? AND bloqueado_id = ?')
      .bind(quien, a)
      .first(),
  );
}

/**
 * Las parejas bloqueadas (en cualquier sentido) de estas personas: para que el despacho no le
 * ofrezca a un repartidor o conductor el pedido o el viaje de quien lo bloqueó (o a quien él
 * bloqueó). Una sola consulta por vuelta, por los dos índices.
 */
export async function parejasBloqueadas(
  db: D1Database,
  personas: string[],
): Promise<Map<string, Set<string>>> {
  const r = new Map<string, Set<string>>();
  const unicas = [...new Set(personas.filter(Boolean))].slice(0, 90);
  if (!unicas.length) return r;
  const marcas = unicas.map(() => '?').join(',');
  const { results } = await db
    .prepare(
      `SELECT usuario_id, bloqueado_id FROM bloqueos_usuario WHERE usuario_id IN (${marcas})
       UNION SELECT usuario_id, bloqueado_id FROM bloqueos_usuario WHERE bloqueado_id IN (${marcas})`,
    )
    .bind(...unicas, ...unicas)
    .all<{ usuario_id: string; bloqueado_id: string }>();
  const sumar = (a: string, b: string) => r.set(a, (r.get(a) ?? new Set()).add(b));
  for (const f of results) {
    sumar(f.usuario_id, f.bloqueado_id);
    sumar(f.bloqueado_id, f.usuario_id);
  }
  return r;
}

/** Condición SQL: el mensaje no es de alguien que `?` bloqueó ni está oculto por el equipo. */
export function sqlMensajeVisible(tipo: 'mensaje_pedido' | 'mensaje_viaje', alias = 'm') {
  return ` AND ${alias}.de_usuario_id NOT IN (SELECT bloqueado_id FROM bloqueos_usuario WHERE usuario_id = ?)
    AND NOT EXISTS (SELECT 1 FROM contenido_oculto o WHERE o.tipo = '${tipo}' AND o.ref = CAST(${alias}.id AS TEXT))`;
}

// ───────────────────────────── Reportar ─────────────────────────────

type Contenido = {
  ref: string;
  objeto: 'pedido' | 'viaje';
  objetoId: string;
  autorId: string | null;
  texto: string;
};

const NO_EXISTE = () => new ErrorDatos('Eso ya no está disponible.', undefined, 404);

/** Qué se reporta, comprobando que quien reporta puede verlo y que no es suyo. */
async function contenidoReportable(
  db: D1Database,
  tipo: TipoContenido,
  ref: string,
  u: { id: string },
): Promise<Contenido> {
  if (!/^\d{1,15}$/.test(ref)) throw NO_EXISTE();
  if (tipo === 'mensaje_pedido') {
    const m = await db
      .prepare(
        `SELECT m.pedido_id, m.de_usuario_id, m.texto, m.foto_clave, p.cliente_id, p.repartidor_id
           FROM mensajes_pedido m JOIN pedidos p ON p.id = m.pedido_id WHERE m.id = ?`,
      )
      .bind(Number(ref))
      .first<{
        pedido_id: string;
        de_usuario_id: string;
        texto: string;
        foto_clave: string | null;
        cliente_id: string;
        repartidor_id: string | null;
      }>();
    if (!m || ![m.cliente_id, m.repartidor_id].includes(u.id) || m.de_usuario_id === u.id)
      throw NO_EXISTE();
    return {
      ref,
      objeto: 'pedido',
      objetoId: m.pedido_id,
      autorId: m.de_usuario_id,
      texto: m.foto_clave ? '[foto]' : m.texto,
    };
  }
  if (tipo === 'mensaje_viaje') {
    const m = await db
      .prepare(
        `SELECT m.operacion_id, m.de_usuario_id, m.texto, o.cliente_id, o.conductor_id
           FROM mensajes_viaje m JOIN operaciones o ON o.id = m.operacion_id WHERE m.id = ?`,
      )
      .bind(Number(ref))
      .first<{
        operacion_id: string;
        de_usuario_id: string;
        texto: string;
        cliente_id: string;
        conductor_id: string | null;
      }>();
    if (!m || ![m.cliente_id, m.conductor_id].includes(u.id) || m.de_usuario_id === u.id)
      throw NO_EXISTE();
    return {
      ref,
      objeto: 'viaje',
      objetoId: m.operacion_id,
      autorId: m.de_usuario_id,
      texto: m.texto,
    };
  }
  // Reseña o respuesta del restaurante: la reseña es pública, la reporta quien la ve.
  const r = await db
    .prepare(
      `SELECT c.pedido_id, c.comentario, c.respuesta, p.cliente_id, t.dueno_id
         FROM calificaciones c JOIN pedidos p ON p.id = c.pedido_id JOIN restaurantes t ON t.id = p.restaurante_id
        WHERE c.rowid = ?`,
    )
    .bind(Number(ref))
    .first<{
      pedido_id: string;
      comentario: string;
      respuesta: string | null;
      cliente_id: string;
      dueno_id: string;
    }>();
  if (!r) throw NO_EXISTE();
  if (tipo === 'resena') {
    if (!r.comentario.trim() || r.cliente_id === u.id) throw NO_EXISTE();
    return {
      ref: r.pedido_id,
      objeto: 'pedido',
      objetoId: r.pedido_id,
      autorId: r.cliente_id,
      texto: r.comentario,
    };
  }
  if (!r.respuesta || r.dueno_id === u.id) throw NO_EXISTE();
  return {
    ref: r.pedido_id,
    objeto: 'pedido',
    objetoId: r.pedido_id,
    autorId: r.dueno_id,
    texto: r.respuesta,
  };
}

moderacion.post('/reportes', limiteIntentos(30, 60_000), async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(
    c,
    z.object({
      tipo: z.enum(TIPOS_CONTENIDO),
      id: z.union([z.string(), z.number()]).transform(String),
      motivo: z.enum(MOTIVOS_REPORTE),
      nota: z.string().trim().max(500).default(''),
    }),
  );
  const db = base(c);
  const recientes = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM reportes_contenido WHERE reporta_id = ? AND creado_en > datetime('now', '-60 seconds')",
    )
    .bind(u.id)
    .first<{ n: number }>();
  if (Number(recientes?.n ?? 0) >= REPORTES_POR_MINUTO)
    throw new ErrorDatos('Recibimos muchos reportes seguidos. Espera un momento.', undefined, 429);
  const x = await contenidoReportable(db, d.tipo, d.id, u);
  const r = await db
    .prepare(
      `INSERT OR IGNORE INTO reportes_contenido (id, tipo, ref, objeto, objeto_id, autor_id, reporta_id, motivo, nota, texto)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      nuevoId(),
      d.tipo,
      x.ref,
      x.objeto,
      x.objetoId,
      x.autorId,
      u.id,
      d.motivo,
      d.nota,
      x.texto.slice(0, 1000),
    )
    .run();
  // El equipo se entera en el momento (respuesta a tiempo, como pide Apple). Una vez por reporte.
  if (r.meta.changes) {
    const avisos = (await correosEquipo(c.env, 'pedidos')).map((para) =>
      enviarCorreo(c.env, {
        de: 'avisos',
        para,
        asunto: `Reporte nuevo: ${d.motivo} (${d.tipo})`,
        texto: `Llegó un reporte (${d.motivo}) sobre ${d.tipo === 'resena' ? 'una reseña' : d.tipo === 'respuesta_resena' ? 'una respuesta de restaurante' : 'un mensaje del chat'}. Revísalo en el superadmin → Reportes.`,
        idioma: 'es',
      }),
    );
    await Promise.allSettled(avisos);
  }
  return c.json({ ok: true }, 201);
});

// ───────────────────────────── Bloquear ─────────────────────────────

/** La otra persona del pedido o del viaje (nunca se devuelve su id a la app). */
async function otraPersona(
  db: D1Database,
  u: { id: string },
  d: { pedidoId?: string; viajeId?: string },
): Promise<string> {
  const f = d.pedidoId
    ? await db
        .prepare('SELECT cliente_id AS a, repartidor_id AS b FROM pedidos WHERE id = ?')
        .bind(d.pedidoId)
        .first<{ a: string; b: string | null }>()
    : await db
        .prepare('SELECT cliente_id AS a, conductor_id AS b FROM operaciones WHERE id = ?')
        .bind(d.viajeId ?? '')
        .first<{ a: string; b: string | null }>();
  if (!f || (f.a !== u.id && f.b !== u.id))
    throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  const otro = f.a === u.id ? f.b : f.a;
  if (!otro)
    throw new ErrorDatos('Todavía no hay nadie asignado a quien bloquear.', undefined, 409);
  return otro;
}

moderacion.post('/bloqueos', limiteIntentos(30, 60_000), async (c) => {
  const u = exigir(c, 'cliente', 'repartidor');
  const d = await leerCuerpo(
    c,
    z
      .object({
        pedidoId: z.string().min(1).max(80).optional(),
        viajeId: z.string().min(1).max(80).optional(),
      })
      .refine((x) => Boolean(x.pedidoId) !== Boolean(x.viajeId), {
        error: 'Indica el pedido o el viaje.',
      }),
  );
  const db = base(c);
  const otro = await otraPersona(db, u, d);
  await db
    .prepare('INSERT OR IGNORE INTO bloqueos_usuario (usuario_id, bloqueado_id) VALUES (?, ?)')
    .bind(u.id, otro)
    .run();
  return c.json({ ok: true }, 201);
});

/** Las personas que bloqueé (solo el nombre de pila), para poder desbloquear. */
moderacion.get('/bloqueos', async (c) => {
  const u = exigir(c);
  const { results } = await base(c)
    .prepare(
      `SELECT b.rowid AS id, x.nombre, b.creado_en FROM bloqueos_usuario b JOIN usuarios x ON x.id = b.bloqueado_id
        WHERE b.usuario_id = ? ORDER BY b.creado_en DESC LIMIT 100`,
    )
    .bind(u.id)
    .all<{ id: number; nombre: string; creado_en: string }>();
  return c.json({
    bloqueos: results.map((f) => ({
      id: Number(f.id),
      nombre: String(f.nombre ?? '').split(' ')[0] ?? '',
      desde: f.creado_en,
    })),
  });
});

moderacion.delete('/bloqueos/:id', async (c) => {
  const u = exigir(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) throw new ErrorDatos('Ese bloqueo no existe.', undefined, 404);
  const r = await base(c)
    .prepare('DELETE FROM bloqueos_usuario WHERE rowid = ? AND usuario_id = ?')
    .bind(id, u.id)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ese bloqueo no existe.', undefined, 404);
  return c.json({ ok: true });
});

// ───────────────────────────── Bandeja del equipo ─────────────────────────────

/** El aviso de «avisar»: recuerda las normas, sin decir quién reportó ni qué reporte fue. */
export const AVISO_NORMAS = (i: Idioma) =>
  i === 'en'
    ? {
        titulo: 'A reminder about our community guidelines',
        cuerpo:
          'Something you wrote on Divoox doesn’t follow our guidelines. Please keep messages and reviews respectful. Repeated issues can lead to account suspension.',
      }
    : {
        titulo: 'Un recordatorio sobre nuestras normas',
        cuerpo:
          'Algo que escribiste en Divoox no sigue nuestras normas. Mantén los mensajes y las reseñas con respeto. Si se repite, la cuenta puede quedar suspendida.',
      };

/** Lo de la ciudad y el servicio de quien mira (C-PERMISOS-FINOS), puesto en la consulta. */
function alcanceReportes(acceso: ReturnType<typeof accesoDe>) {
  const p = alcanceObjetoSql(acceso, 'pedido', 'r.objeto_id');
  const v = alcanceObjetoSql(acceso, 'viaje', 'r.objeto_id');
  return {
    sql: ` AND ((r.objeto = 'pedido'${p.sql}) OR (r.objeto = 'viaje'${v.sql}))`,
    valores: [...p.valores, ...v.valores],
  };
}

moderacion.get('/admin/reportes', async (c) => {
  exigir(c, 'admin');
  const estado = c.req.query('estado') === 'resuelto' ? 'resuelto' : 'abierto';
  const alcance = alcanceReportes(accesoDe(c));
  const { results } = await base(c)
    .prepare(
      `SELECT r.id, r.tipo, r.ref, r.objeto, r.objeto_id, r.motivo, r.nota, r.texto, r.estado, r.accion, r.creado_en, r.resuelto_en,
              r.autor_id, a.nombre AS autor_nombre, a.rol AS autor_rol, a.activo AS autor_activo,
              q.nombre AS reporta_nombre, q.rol AS reporta_rol,
              EXISTS (SELECT 1 FROM contenido_oculto o WHERE o.tipo = r.tipo AND o.ref = r.ref) AS oculto,
              (SELECT COUNT(*) FROM reportes_contenido z WHERE z.tipo = r.tipo AND z.ref = r.ref) AS veces
         FROM reportes_contenido r
         LEFT JOIN usuarios a ON a.id = r.autor_id
         LEFT JOIN usuarios q ON q.id = r.reporta_id
        WHERE r.estado = ?${alcance.sql}
        ORDER BY r.creado_en DESC LIMIT 100`,
    )
    .bind(estado, ...alcance.valores)
    .all<Record<string, unknown>>();
  return c.json({
    reportes: results.map((f) => ({
      id: String(f.id),
      tipo: String(f.tipo),
      objeto: String(f.objeto),
      objetoId: String(f.objeto_id),
      motivo: String(f.motivo),
      nota: String(f.nota ?? ''),
      texto: String(f.texto ?? ''),
      estado: String(f.estado),
      accion: f.accion ? String(f.accion) : null,
      creadoEn: String(f.creado_en),
      resueltoEn: f.resuelto_en ? String(f.resuelto_en) : null,
      oculto: Number(f.oculto) === 1,
      veces: Number(f.veces ?? 1),
      autor: f.autor_id
        ? {
            id: String(f.autor_id),
            nombre: String(f.autor_nombre ?? ''),
            rol: String(f.autor_rol ?? ''),
            activo: Number(f.autor_activo) === 1,
          }
        : null,
      // El equipo ve el papel y el nombre de pila de quien reportó; nadie más lo ve.
      reporta: f.reporta_nombre
        ? { nombre: String(f.reporta_nombre).split(' ')[0], rol: String(f.reporta_rol ?? '') }
        : null,
    })),
  });
});

moderacion.post('/admin/reportes/:id/accion', async (c) => {
  const admin = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({ accion: z.enum(ACCIONES_REPORTE), nota: z.string().trim().max(300).default('') }),
  );
  const db = base(c);
  const r = await db
    .prepare(
      'SELECT id, tipo, ref, objeto, objeto_id, autor_id FROM reportes_contenido WHERE id = ?',
    )
    .bind(c.req.param('id'))
    .first<{
      id: string;
      tipo: TipoContenido;
      ref: string;
      objeto: 'pedido' | 'viaje';
      objeto_id: string;
      autor_id: string | null;
    }>();
  // Fuera de su ciudad o servicio responde igual que si no existiera (C-PERMISOS-FINOS).
  if (!r || (await objetoFueraDeAlcance(db, accesoDe(c), r.objeto, r.objeto_id)))
    throw new ErrorDatos('Ese reporte no existe.', undefined, 404);
  const ocultar = db
    .prepare('INSERT OR REPLACE INTO contenido_oculto (tipo, ref, motivo, por) VALUES (?, ?, ?, ?)')
    .bind(r.tipo, r.ref, d.nota || d.accion, admin.id);
  const pasos: D1PreparedStatement[] = [];
  if (d.accion === 'ocultar') pasos.push(ocultar);
  if (d.accion === 'publicar')
    pasos.push(
      db.prepare('DELETE FROM contenido_oculto WHERE tipo = ? AND ref = ?').bind(r.tipo, r.ref),
    );
  if (d.accion === 'suspender') {
    exigirPermiso(c, 'clientes.suspender');
    if (!r.autor_id) throw new ErrorDatos('Este contenido no tiene autor.', undefined, 409);
    const a = await db
      .prepare(
        "SELECT id FROM usuarios WHERE id = ? AND rol IN ('cliente','repartidor','restaurante')",
      )
      .bind(r.autor_id)
      .first<{ id: string }>();
    if (!a) throw new ErrorDatos('Esa cuenta no se puede suspender desde aquí.', undefined, 409);
    pasos.push(
      ocultar,
      db.prepare('UPDATE usuarios SET activo = 0 WHERE id = ?').bind(a.id),
      db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(a.id),
      db.prepare('UPDATE repartidores SET conectado = 0 WHERE usuario_id = ?').bind(a.id),
    );
  }
  // Se cierran juntos todos los reportes sobre ese mismo contenido.
  pasos.push(
    db
      .prepare(
        `UPDATE reportes_contenido SET estado = 'resuelto', accion = ?, resuelto_por = ?, resuelto_en = datetime('now')
          WHERE tipo = ? AND ref = ? AND estado = 'abierto'`,
      )
      .bind(d.accion, admin.id, r.tipo, r.ref),
  );
  await db.batch(pasos);
  if (d.accion === 'suspender') console.warn('cuenta suspendida desde Reportes', r.autor_id);
  if (d.accion === 'avisar' && r.autor_id)
    await notificar(c.env, db, r.autor_id, (i) => ({
      ...AVISO_NORMAS(i),
      datos: { tipo: 'normas' },
    })).catch((e: unknown) => console.error('reportes: aviso de normas', e));
  return c.json({ ok: true });
});
