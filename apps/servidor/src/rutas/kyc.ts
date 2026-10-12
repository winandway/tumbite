import { Hono } from 'hono';
import { z } from 'zod';
import { distanciaKm } from '@tumbite/compartido';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { enviarCorreo } from '../correo';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { MAX_FOTO_BYTES, tipoReal } from './fotos';
import { asegurarCodigoRepartidor } from './superadmin';

/**
 * KYC: verificación de identidad de repartidores y dueños de restaurante, hecha por Tumbite.
 * - La persona toma con la app la foto del documento (frente y reverso) y una foto de su cara.
 * - El restaurante además una foto del local con la ubicación del celular: si está lejos de la
 *   dirección registrada, el superadmin lo ve marcado (restaurantes falsos o mudados).
 * - Las fotos van a kyc/<usuario>/… y NUNCA se sirven al público: solo al admin, por su ruta.
 * - Con KYC_OBLIGATORIO=1, sin KYC aprobado el repartidor no se conecta y el restaurante no se
 *   aprueba. La revisión con IA llega después, con el tope de gasto aprobado. Candado C-KYC.
 */
export const kyc = new Hono<{ Bindings: Env; Variables: Variables }>();

export const PIEZAS = ['doc_frente', 'doc_reverso', 'selfie', 'local'] as const;
type Pieza = (typeof PIEZAS)[number];
const esPieza = (x: string): x is Pieza => (PIEZAS as readonly string[]).includes(x);
/** A más de esto, la foto del local no coincide con la dirección del restaurante. */
export const DISTANCIA_MAXIMA_M = 300;

function almacen(env: Env): R2Bucket {
  if (!env.BUCKET)
    throw new ErrorDatos(
      'El almacén no está disponible en este momento. Intenta más tarde.',
      undefined,
      503,
    );
  return env.BUCKET;
}

type FilaKyc = {
  usuario_id: string;
  estado: 'sin_enviar' | 'pendiente' | 'aprobado' | 'rechazado';
  motivo: string;
  doc_tipo: string;
  doc_frente: string | null;
  doc_reverso: string | null;
  selfie: string | null;
  local: string | null;
  local_lat: number | null;
  local_lng: number | null;
  local_distancia_m: number | null;
  enviado_en: string | null;
  revisado_en: string | null;
  proxima_revision: string | null;
};

const aKyc = (f: FilaKyc | null) => ({
  estado: f?.estado ?? 'sin_enviar',
  motivo: f?.motivo ?? '',
  docTipo: f?.doc_tipo ?? '',
  tiene: {
    doc_frente: Boolean(f?.doc_frente),
    doc_reverso: Boolean(f?.doc_reverso),
    selfie: Boolean(f?.selfie),
    local: Boolean(f?.local),
  },
  localDistanciaM: f?.local_distancia_m ?? null,
  enviado: f?.enviado_en ?? null,
  revisado: f?.revisado_en ?? null,
  proximaRevision: f?.proxima_revision ?? null,
});

/** ¿Esta cuenta tiene el KYC aprobado y vigente? */
export async function kycAprobado(db: D1Database, usuarioId: string): Promise<boolean> {
  const f = await db
    .prepare('SELECT estado, proxima_revision FROM kyc WHERE usuario_id = ?')
    .bind(usuarioId)
    .first<{ estado: string; proxima_revision: string | null }>();
  if (f?.estado !== 'aprobado') return false;
  return !f.proxima_revision || f.proxima_revision >= new Date().toISOString().slice(0, 10);
}

// ───────────────────────── La persona ─────────────────────────

kyc.get('/kyc', async (c) => {
  const u = exigir(c, 'repartidor', 'restaurante');
  const f = await base(c)
    .prepare('SELECT * FROM kyc WHERE usuario_id = ?')
    .bind(u.id)
    .first<FilaKyc>();
  return c.json({ kyc: aKyc(f), pideLocal: u.rol === 'restaurante' });
});

/** Sube una pieza (foto) del KYC. Solo imágenes de verdad, máximo 3 MB. Va a la carpeta privada. */
kyc.post('/kyc/foto/:pieza', async (c) => {
  const u = exigir(c, 'repartidor', 'restaurante');
  const pieza = c.req.param('pieza');
  if (!esPieza(pieza) || (pieza === 'local' && u.rol !== 'restaurante'))
    throw new ErrorDatos('Esa foto no corresponde.', 'foto', 400);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength === 0) throw new ErrorDatos('No llegó ninguna foto.', 'foto', 400);
  if (bytes.byteLength > MAX_FOTO_BYTES)
    throw new ErrorDatos('La foto pesa demasiado. El máximo es 3 MB.', 'foto', 413);
  const tipo = tipoReal(bytes);
  if (!tipo) throw new ErrorDatos('Sube una foto en JPG, PNG o WebP.', 'foto', 415);
  const db = base(c);
  const estado = await db
    .prepare('SELECT estado FROM kyc WHERE usuario_id = ?')
    .bind(u.id)
    .first<{ estado: string }>();
  if (estado?.estado === 'aprobado')
    throw new ErrorDatos('Tu verificación ya está aprobada.', undefined, 409);
  const clave = `kyc/${u.id}/${pieza}-${nuevoId()}`;
  await almacen(c.env).put(clave, bytes, {
    httpMetadata: { contentType: tipo, cacheControl: 'private, no-store' },
  });
  // Coordenadas del celular al tomar la foto del local (para comparar con la dirección).
  const lat = Number(c.req.query('lat'));
  const lng = Number(c.req.query('lng'));
  const conUbicacion = pieza === 'local' && Number.isFinite(lat) && Number.isFinite(lng);
  await db.prepare('INSERT OR IGNORE INTO kyc (usuario_id) VALUES (?)').bind(u.id).run();
  if (u.rol === 'repartidor') {
    // El repartidor ya tiene su ID antes de que el equipo lo revise.
    await db.prepare('INSERT OR IGNORE INTO repartidores (usuario_id) VALUES (?)').bind(u.id).run();
    await asegurarCodigoRepartidor(db, u.id);
  }
  await db
    .prepare(
      `UPDATE kyc SET ${pieza} = ?, local_lat = CASE WHEN ? THEN ? ELSE local_lat END,
       local_lng = CASE WHEN ? THEN ? ELSE local_lng END WHERE usuario_id = ?`,
    )
    .bind(
      clave,
      conUbicacion ? 1 : 0,
      conUbicacion ? lat : null,
      conUbicacion ? 1 : 0,
      conUbicacion ? lng : null,
      u.id,
    )
    .run();
  return c.json({ ok: true }, 201);
});

const esquemaEnvio = z.object({ docTipo: z.enum(['licencia', 'pasaporte', 'identificacion']) });

kyc.post('/kyc/enviar', async (c) => {
  const u = exigir(c, 'repartidor', 'restaurante');
  const { docTipo } = await leerCuerpo(c, esquemaEnvio);
  const db = base(c);
  const f = await db.prepare('SELECT * FROM kyc WHERE usuario_id = ?').bind(u.id).first<FilaKyc>();
  const faltan: string[] = [];
  if (!f?.doc_frente) faltan.push('doc_frente');
  if (docTipo !== 'pasaporte' && !f?.doc_reverso) faltan.push('doc_reverso');
  if (!f?.selfie) faltan.push('selfie');
  if (u.rol === 'restaurante' && !f?.local) faltan.push('local');
  if (faltan.length)
    throw new ErrorDatos('Faltan fotos por tomar antes de enviar.', faltan[0], 422);
  let distancia: number | null = null;
  if (u.rol === 'restaurante' && f?.local_lat != null && f.local_lng != null) {
    const r = await db
      .prepare('SELECT lat, lng FROM restaurantes WHERE dueno_id = ?')
      .bind(u.id)
      .first<{ lat: number | null; lng: number | null }>();
    if (r?.lat != null && r.lng != null)
      distancia = Math.round(
        distanciaKm({ lat: f.local_lat, lng: f.local_lng }, { lat: r.lat, lng: r.lng }) * 1000,
      );
  }
  await db
    .prepare(
      "UPDATE kyc SET estado = 'pendiente', motivo = '', doc_tipo = ?, local_distancia_m = ?, enviado_en = datetime('now') WHERE usuario_id = ?",
    )
    .bind(docTipo, distancia, u.id)
    .run();
  return c.json({ ok: true, distanciaM: distancia });
});

// ───────────────────────── Superadmin ─────────────────────────

kyc.get('/admin/kyc', async (c) => {
  exigir(c, 'admin');
  const estado = c.req.query('estado') || 'pendiente';
  const despues = c.req.query('despues') ?? '';
  const { results } = await base(c)
    .prepare(
      `SELECT k.usuario_id AS id, k.estado, k.doc_tipo AS docTipo, k.enviado_en AS enviado, k.local_distancia_m AS distancia,
        k.proxima_revision AS proxima, u.nombre, u.correo, u.rol, d.codigo, r.nombre AS restaurante
       FROM kyc k JOIN usuarios u ON u.id = k.usuario_id
       LEFT JOIN repartidores d ON d.usuario_id = k.usuario_id LEFT JOIN restaurantes r ON r.dueno_id = k.usuario_id
       WHERE k.estado = ? ${despues ? 'AND k.enviado_en > ?' : ''} ORDER BY k.enviado_en LIMIT 51`,
    )
    .bind(estado, ...(despues ? [despues] : []))
    .all<Record<string, unknown>>();
  const pagina = results.slice(0, 50);
  const { results: totales } = await base(c)
    .prepare('SELECT estado, COUNT(*) AS n FROM kyc GROUP BY estado')
    .all<{ estado: string; n: number }>();
  return c.json({
    solicitudes: pagina.map((x) => ({
      ...x,
      lejos: x.distancia != null && Number(x.distancia) > DISTANCIA_MAXIMA_M,
    })),
    siguiente: results.length > 50 ? String(pagina.at(-1)?.enviado ?? '') : null,
    totales: Object.fromEntries(totales.map((t) => [t.estado, Number(t.n)])),
  });
});

kyc.get('/admin/kyc/:id', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const f = await db.prepare('SELECT * FROM kyc WHERE usuario_id = ?').bind(id).first<FilaKyc>();
  const u = await db
    .prepare(
      'SELECT u.nombre, u.correo, u.telefono, u.fecha_nacimiento, u.rol, r.nombre AS restaurante, r.direccion FROM usuarios u LEFT JOIN restaurantes r ON r.dueno_id = u.id WHERE u.id = ?',
    )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!u) throw new ErrorDatos('Esa cuenta no existe.', undefined, 404);
  return c.json({
    persona: u,
    kyc: {
      ...aKyc(f),
      lejos: f?.local_distancia_m != null && f.local_distancia_m > DISTANCIA_MAXIMA_M,
    },
  });
});

/** La foto, solo para el admin: nunca pasa por la carpeta pública ni por el caché. */
kyc.get('/admin/kyc/:id/foto/:pieza', async (c) => {
  exigir(c, 'admin');
  const pieza = c.req.param('pieza');
  if (!esPieza(pieza)) throw new ErrorDatos('Esa foto no existe.', undefined, 404);
  const f = await base(c)
    .prepare(`SELECT ${pieza} AS clave FROM kyc WHERE usuario_id = ?`)
    .bind(c.req.param('id'))
    .first<{ clave: string | null }>();
  if (!f?.clave) throw new ErrorDatos('Esa foto no existe.', undefined, 404);
  const obj = await almacen(c.env).get(f.clave);
  if (!obj) throw new ErrorDatos('Esa foto no existe.', undefined, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-robots-tag', 'noindex');
  return new Response(obj.body, { headers });
});

const esquemaRevision = z.object({
  estado: z.enum(['aprobado', 'rechazado']),
  motivo: z.string().trim().max(500).default(''),
});

kyc.patch('/admin/kyc/:id', async (c) => {
  const admin = exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaRevision);
  if (d.estado === 'rechazado' && !d.motivo)
    throw new ErrorDatos('Escribe el motivo: le llega a la persona para que lo corrija.', 'motivo');
  const db = base(c);
  const id = c.req.param('id');
  const u = await db
    .prepare('SELECT nombre, correo, idioma, rol FROM usuarios WHERE id = ?')
    .bind(id)
    .first<{ nombre: string; correo: string; idioma: 'es' | 'en'; rol: string }>();
  if (!u) throw new ErrorDatos('Esa cuenta no existe.', undefined, 404);
  // Los restaurantes se vuelven a verificar cada año (¿sigue el local ahí?).
  const proxima =
    d.estado === 'aprobado' && u.rol === 'restaurante'
      ? new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10)
      : null;
  const r = await db
    .prepare(
      "UPDATE kyc SET estado = ?, motivo = ?, revisado_en = datetime('now'), revisado_por = ?, proxima_revision = ? WHERE usuario_id = ? AND estado = 'pendiente'",
    )
    .bind(d.estado, d.motivo, admin.id, proxima, id)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Esa verificación no está pendiente.', undefined, 409);
  const en = u.idioma === 'en';
  await enviarCorreo(c.env, {
    de: 'soporte',
    para: u.correo,
    asunto:
      d.estado === 'aprobado'
        ? en
          ? 'Your identity is verified'
          : 'Tu identidad quedó verificada'
        : en
          ? 'We need new photos to verify you'
          : 'Necesitamos fotos nuevas para verificarte',
    texto:
      d.estado === 'aprobado'
        ? en
          ? `Hi ${u.nombre},\n\nYour verification was approved. Welcome to Tumbite!`
          : `Hola, ${u.nombre}.\n\nTu verificación quedó aprobada. ¡Bienvenido a Tumbite!`
        : en
          ? `Hi ${u.nombre},\n\nWe couldn’t approve your verification: ${d.motivo}\n\nPlease take the photos again in the app.`
          : `Hola, ${u.nombre}.\n\nNo pudimos aprobar tu verificación: ${d.motivo}\n\nVuelve a tomar las fotos en la app.`,
  });
  return c.json({ ok: true });
});
