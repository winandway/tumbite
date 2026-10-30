import { correosEquipo } from '../avisosEquipo';
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
import {
  checkrConfigurado,
  firmaCheckrValida,
  pedirAntecedentes,
  procesarAvisoCheckr,
} from '../antecedentes';
import { guardarDecision, motorEncendido, pedirDecision, textoMotivos } from '../verificacionAuto';

/**
 * KYC: verificación de identidad de repartidores y dueños de restaurante, hecha por Divoox.
 * - La persona toma con la app la foto del documento (frente y reverso) y una foto de su cara.
 * - El restaurante además una foto del local con la ubicación del celular: si está lejos de la
 *   dirección registrada, el superadmin lo ve marcado (restaurantes falsos o mudados).
 * - Las fotos van a kyc/<usuario>/… y NUNCA se sirven al público: solo al admin, por su ruta.
 * - Con KYC_OBLIGATORIO=1, sin KYC aprobado el repartidor no se conecta y el restaurante no se
 *   aprueba. La revisión con IA llega después, con el tope de gasto aprobado. Candado C-KYC.
 */
export const kyc = new Hono<{ Bindings: Env; Variables: Variables }>();

export const PIEZAS = ['doc_frente', 'doc_reverso', 'selfie', 'local', 'giro_1', 'giro_2'] as const;
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
  giro_1?: string | null;
  giro_2?: string | null;
  consentimiento_en?: string | null;
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
    giro_1: Boolean(f?.giro_1),
    giro_2: Boolean(f?.giro_2),
  },
  consentimiento: Boolean(f?.consentimiento_en),
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

/** Antecedentes y selfie de control del repartidor, como los ve su app. */
async function extrasRepartidor(db: D1Database, usuarioId: string) {
  const a = await db
    .prepare('SELECT estado, invitacion_url FROM antecedentes_checkr WHERE usuario_id = ?')
    .bind(usuarioId)
    .first<{ estado: string; invitacion_url: string }>();
  const d = await db
    .prepare('SELECT antecedentes FROM repartidor_datos WHERE usuario_id = ?')
    .bind(usuarioId)
    .first<{ antecedentes: string }>();
  const sc = await db
    .prepare(
      'SELECT id, pedida_en FROM selfies_control WHERE usuario_id = ? AND tomada_en IS NULL ORDER BY pedida_en DESC LIMIT 1',
    )
    .bind(usuarioId)
    .first<{ id: string; pedida_en: string }>();
  return {
    antecedentes: {
      estado: d?.antecedentes === 'aprobado' ? 'aprobado' : (a?.estado ?? 'sin_pedir'),
      url: a?.estado === 'invitado' ? a.invitacion_url : '',
    },
    selfieControl: sc
      ? { pendiente: true, pedidaEn: sc.pedida_en }
      : { pendiente: false, pedidaEn: null },
  };
}

kyc.get('/kyc', async (c) => {
  const u = exigir(c, 'repartidor', 'restaurante');
  const db = base(c);
  const f = await db.prepare('SELECT * FROM kyc WHERE usuario_id = ?').bind(u.id).first<FilaKyc>();
  return c.json({
    kyc: aKyc(f),
    pideLocal: u.rol === 'restaurante',
    // Con el motor, la app pide el consentimiento y las dos tomas girando la cabeza.
    motor: u.rol === 'repartidor' && motorEncendido(c.env),
    ...(u.rol === 'repartidor' ? await extrasRepartidor(db, u.id) : {}),
  });
});

/**
 * Antecedentes con Checkr: el repartidor pide la invitación y llena sus datos en la página de
 * Checkr. Sin Checkr configurado se dice claro; nunca se piden datos sensibles aquí.
 */
kyc.post('/kyc/antecedentes/pedir', async (c) => {
  const u = exigir(c, 'repartidor');
  if (!checkrConfigurado(c.env))
    throw new ErrorDatos(
      'La verificación de antecedentes se activa muy pronto. Te avisamos en la app.',
      undefined,
      409,
    );
  const db = base(c);
  const f = await db
    .prepare('SELECT nombre, correo, telefono FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ nombre: string; correo: string; telefono: string | null }>();
  if (!f) throw new ErrorDatos('Esa cuenta no existe.', undefined, 404);
  try {
    return c.json(await pedirAntecedentes(c.env, db, { id: u.id, ...f }));
  } catch (e) {
    console.error('checkr', e);
    throw new ErrorDatos(
      'No pudimos conectar con la verificación de antecedentes. Intenta más tarde.',
      undefined,
      503,
    );
  }
});

/** Aviso de Checkr (firmado con la llave de la API). Sin firma válida no se toca nada. */
kyc.post('/checkr/aviso', async (c) => {
  const llave = c.env.CHECKR_API_KEY;
  const cuerpo = await c.req.text();
  if (!llave || !(await firmaCheckrValida(cuerpo, c.req.header('x-checkr-signature'), llave))) {
    console.error('aviso de checkr con firma inválida o sin llave');
    return c.json({ error: 'firma inválida' }, 400);
  }
  const aviso = JSON.parse(cuerpo) as { type: string; data?: { object?: Record<string, unknown> } };
  return c.json({ ok: true, ...(await procesarAvisoCheckr(c.env, base(c), aviso)) });
});

/** La selfie de control pedida al conectarse: se guarda aparte y el equipo la compara. */
kyc.post('/kyc/selfie-control', async (c) => {
  const u = exigir(c, 'repartidor');
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength === 0) throw new ErrorDatos('No llegó ninguna foto.', 'foto', 400);
  if (bytes.byteLength > MAX_FOTO_BYTES)
    throw new ErrorDatos('La foto pesa demasiado. El máximo es 3 MB.', 'foto', 413);
  const tipo = tipoReal(bytes);
  if (!tipo) throw new ErrorDatos('Sube una foto en JPG, PNG o WebP.', 'foto', 415);
  const db = base(c);
  const sc = await db
    .prepare(
      'SELECT id FROM selfies_control WHERE usuario_id = ? AND tomada_en IS NULL ORDER BY pedida_en DESC LIMIT 1',
    )
    .bind(u.id)
    .first<{ id: string }>();
  if (!sc) throw new ErrorDatos('No tienes ninguna foto de control pendiente.', undefined, 409);
  const clave = `kyc/${u.id}/control-${sc.id}`;
  await almacen(c.env).put(clave, bytes, {
    httpMetadata: { contentType: tipo, cacheControl: 'private, no-store' },
  });
  await db
    .prepare("UPDATE selfies_control SET clave = ?, tomada_en = datetime('now') WHERE id = ?")
    .bind(clave, sc.id)
    .run();
  return c.json({ ok: true, url: `/datos/kyc/selfie-control` }, 201);
});

/** Sube una pieza (foto) del KYC. Solo imágenes de verdad, máximo 3 MB. Va a la carpeta privada. */
kyc.post('/kyc/foto/:pieza', async (c) => {
  const u = exigir(c, 'repartidor', 'restaurante');
  const pieza = c.req.param('pieza');
  if (
    !esPieza(pieza) ||
    (pieza === 'local' && u.rol !== 'restaurante') ||
    (pieza.startsWith('giro_') && u.rol !== 'repartidor')
  )
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

/**
 * Consentimiento escrito antes de la selfie (datos biométricos): sin él, el motor no mira la cara y la
 * verificación la hace el equipo. Queda la fecha. El texto lo aprueba el abogado (PENDIENTES 👤).
 */
kyc.post('/kyc/consentimiento', async (c) => {
  const u = exigir(c, 'repartidor');
  await leerCuerpo(c, z.object({ acepto: z.literal(true) }));
  const db = base(c);
  await db.prepare('INSERT OR IGNORE INTO kyc (usuario_id) VALUES (?)').bind(u.id).run();
  await db
    .prepare("UPDATE kyc SET consentimiento_en = datetime('now') WHERE usuario_id = ?")
    .bind(u.id)
    .run();
  return c.json({ ok: true });
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
      .prepare(
        'SELECT lat, lng FROM restaurantes WHERE (dueno_id = ?1 OR id IN (SELECT restaurante_id FROM miembros_restaurante WHERE usuario_id = ?1))',
      )
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
  // C-KYC-AUTO: con el motor, el consentimiento y las dos tomas, la decisión sale al instante.
  if (
    u.rol === 'repartidor' &&
    f?.consentimiento_en &&
    f.giro_1 &&
    f.giro_2 &&
    f.doc_frente &&
    f.selfie &&
    motorEncendido(c.env)
  ) {
    const d = await pedirDecision(c.env, db, u.id, {
      docTipo,
      frente: f.doc_frente,
      reverso: f.doc_reverso,
      selfie: f.selfie,
      giros: [f.giro_1, f.giro_2],
    });
    if (d) {
      await guardarDecision(db, u.id, d);
      const idioma = u.idioma === 'en' ? 'en' : 'es';
      if (d.decision !== 'revision') {
        await db
          .prepare(
            "UPDATE kyc SET estado = ?, motivo = ?, revisado_en = datetime('now'), revisado_por = 'motor' WHERE usuario_id = ? AND estado = 'pendiente'",
          )
          .bind(
            d.decision === 'verificado' ? 'aprobado' : 'rechazado',
            d.decision === 'verificado' ? '' : textoMotivos(d.motivos, idioma),
            u.id,
          )
          .run();
        return c.json({ ok: true, distanciaM: distancia, decision: d.decision });
      }
    }
  }
  // Punto 27: el equipo se entera en el momento (antes nadie avisaba y la bandeja se miraba a mano).
  for (const para of await correosEquipo(c.env, 'verificaciones'))
    await enviarCorreo(c.env, {
      de: 'avisos',
      para,
      asunto: `Verificación enviada: ${u.nombre} (${u.rol})`,
      texto: `${u.nombre} (${u.correo}, ${u.rol}) envió su verificación de identidad${distancia != null ? ` · local a ${distancia} m de la dirección registrada` : ''}. Revísala en el superadmin → Verificaciones.`,
    }).catch((e: unknown) => console.error('kyc: correo al equipo', e));
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
  const { results: controles } = await db
    .prepare(
      'SELECT id, pedida_en, tomada_en, revisada_en, resultado, clave FROM selfies_control WHERE usuario_id = ? ORDER BY pedida_en DESC LIMIT 10',
    )
    .bind(id)
    .all<Record<string, unknown>>();
  const { results: auto } = await db
    .prepare(
      'SELECT decision, motivos_json, similitud, parecidas_json, creada_en FROM verificaciones_auto WHERE usuario_id = ? ORDER BY creada_en DESC LIMIT 5',
    )
    .bind(id)
    .all<{
      decision: string;
      motivos_json: string;
      similitud: number | null;
      parecidas_json: string;
      creada_en: string;
    }>();
  return c.json({
    persona: u,
    kyc: {
      ...aKyc(f),
      lejos: f?.local_distancia_m != null && f.local_distancia_m > DISTANCIA_MAXIMA_M,
    },
    // C-KYC-AUTO: lo que decidió el motor y por qué (las caras parecidas, con la cuenta cerrada).
    motor: auto.map((a) => ({
      decision: a.decision,
      motivos: JSON.parse(a.motivos_json) as string[],
      similitud: a.similitud,
      parecidas: JSON.parse(a.parecidas_json) as { id: string; similitud: number }[],
      en: a.creada_en,
    })),
    ...(u.rol === 'repartidor' ? await extrasRepartidor(db, id) : {}),
    selfiesControl: controles.map((x) => ({
      id: String(x.id),
      pedidaEn: String(x.pedida_en),
      tomadaEn: (x.tomada_en as string | null) ?? null,
      revisadaEn: (x.revisada_en as string | null) ?? null,
      resultado: String(x.resultado ?? ''),
      conFoto: Boolean(x.clave),
    })),
  });
});

/** Una selfie de control, solo para el admin. */
kyc.get('/admin/kyc/:id/control/:cid', async (c) => {
  exigir(c, 'admin');
  const f = await base(c)
    .prepare('SELECT clave FROM selfies_control WHERE id = ? AND usuario_id = ?')
    .bind(c.req.param('cid'), c.req.param('id'))
    .first<{ clave: string }>();
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

/** El equipo dice si la selfie de control coincide con la del registro. */
kyc.patch('/admin/kyc/:id/control/:cid', async (c) => {
  exigir(c, 'admin');
  const { resultado } = await leerCuerpo(
    c,
    z.object({ resultado: z.enum(['coincide', 'no_coincide']) }),
  );
  const r = await base(c)
    .prepare(
      "UPDATE selfies_control SET resultado = ?, revisada_en = datetime('now') WHERE id = ? AND usuario_id = ? AND tomada_en IS NOT NULL",
    )
    .bind(resultado, c.req.param('cid'), c.req.param('id'))
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Esa foto de control no existe o no se tomó.', undefined, 409);
  return c.json({ ok: true });
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

/**
 * C-FOTO-VERIFICADA (29 oct 2026), como Uber: la selfie aprobada contra el documento es la foto de perfil
 * del repartidor. La ven él mismo, el cliente de un pedido que lleva y el equipo; nadie más.
 */
async function servirFoto(c: Parameters<typeof base>[0], usuarioId: string) {
  const f = await base(c)
    .prepare("SELECT selfie FROM kyc WHERE usuario_id = ? AND estado = 'aprobado'")
    .bind(usuarioId)
    .first<{ selfie: string | null }>();
  const obj = f?.selfie ? await almacen(c.env).get(f.selfie) : null;
  if (!obj) return c.text('No encontrado', 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(obj.body, { headers });
}

kyc.get('/kyc/mi-foto', async (c) => servirFoto(c, exigir(c, 'repartidor').id));

kyc.get('/pedidos/:id/repartidor/foto', async (c) => {
  const u = exigir(c);
  const p = await base(c)
    .prepare(
      "SELECT cliente_id, repartidor_id FROM pedidos WHERE id = ? AND repartidor_id IS NOT NULL AND estado IN ('aceptado', 'listo', 'en_camino', 'entregado')",
    )
    .bind(c.req.param('id'))
    .first<{ cliente_id: string; repartidor_id: string }>();
  if (!p || (p.cliente_id !== u.id && u.rol !== 'admin')) return c.text('No encontrado', 404);
  return servirFoto(c, p.repartidor_id);
});

/**
 * La foto verificada no se cambia desde la app. Si hace falta una nueva (cambió mucho, la foto quedó
 * mal), soporte la libera con motivo: la verificación vuelve a empezar y queda en el registro.
 */
kyc.post('/admin/kyc/:id/liberar-foto', async (c) => {
  const admin = exigir(c, 'admin');
  const { motivo } = await leerCuerpo(
    c,
    z.object({ motivo: z.string().trim().min(5, { error: 'Escribe el motivo.' }).max(300) }),
  );
  const db = base(c);
  const id = c.req.param('id');
  const r = await db
    .prepare(
      "UPDATE kyc SET selfie = NULL, estado = 'sin_enviar', motivo = ?, revisado_en = datetime('now'), revisado_por = ? WHERE usuario_id = ? AND selfie IS NOT NULL",
    )
    .bind(`Soporte pidió una foto nueva: ${motivo}`, admin.id, id)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Esa cuenta no tiene foto que liberar.', undefined, 404);
  await db
    .prepare(
      'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(admin.id, 'liberar_foto', `kyc:${id}`, null, JSON.stringify({ motivo }))
    .run();
  return c.json({ ok: true });
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
          ? `Hi ${u.nombre},\n\nYour verification was approved. Welcome to Divoox!`
          : `Hola, ${u.nombre}.\n\nTu verificación quedó aprobada. ¡Bienvenido a Divoox!`
        : en
          ? `Hi ${u.nombre},\n\nWe couldn’t approve your verification: ${d.motivo}\n\nPlease take the photos again in the app.`
          : `Hola, ${u.nombre}.\n\nNo pudimos aprobar tu verificación: ${d.motivo}\n\nVuelve a tomar las fotos en la app.`,
  });
  return c.json({ ok: true });
});
