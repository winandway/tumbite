import { Hono } from 'hono';
import { z } from 'zod';
import { ESTADOS_FINALES_PAQUETE, perfilFlex, telefonoInternacional } from '@tumbite/compartido';
import type { Env } from '../env';
import { nuevoToken, sha256 } from '../cripto';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { actorDeEmpresa, exigirPermiso, sentenciaAuditoria } from './autorizacion';

/**
 * Divoox Flex · Fase 5 (C-FLEX-UBICACION): la ubicación EXACTA del destinatario, como Amazon (pin y
 * referencias en su app) y los programas de última milla (enlace «confirma tu ubicación» por
 * WhatsApp o SMS). Primer mercado: Venezuela, donde las direcciones escritas no bastan:
 *
 * 1. Si la empresa pone el punto (pin o coordenadas), queda confirmado por ella.
 * 2. Si el destinatario tiene cuenta en Divoox (mismo teléfono o correo), el envío se le vincula y
 *    aparece en «Mis paquetes» de su app; si tiene UNA dirección guardada con pin, se usa esa.
 * 3. Si no, la empresa le manda un enlace (/deliver/<código>) para que marque su casa en el mapa,
 *    con puntos de referencia, sin cuenta — y lo invita a bajar la app.
 *
 * En Venezuela (perfil `ubicacion: 'confirmada'`) un envío sin ubicación confirmada no entra a una
 * ruta. En EE. UU. la dirección escrita basta.
 */
export const flexUbicacion = new Hono<{ Bindings: Env; Variables: Variables }>();

/** Días que dura el enlace para confirmar la ubicación. */
export const DIAS_ENLACE_UBICACION = 7;
const ESTADOS_CERRADOS = ['cargado', 'en_transito', ...ESTADOS_FINALES_PAQUETE];

export async function paisDeEmpresa(db: D1Database, empresaId: string): Promise<string> {
  const f = await db
    .prepare('SELECT pais FROM empresas WHERE id = ?')
    .bind(empresaId)
    .first<{ pais: string }>();
  return f?.pais ?? 'US';
}

/** El estado con que nace la ubicación de un envío (puro). */
export function ubicacionInicial(
  pais: string,
  d: { lat?: number | null; lng?: number | null },
  origen: string,
): { estado: string; fuente: string; confirmada: boolean } {
  if (d.lat != null && d.lng != null)
    return {
      estado: 'confirmada',
      fuente: origen.startsWith('importacion') ? 'importacion' : 'empresa',
      confirmada: true,
    };
  return {
    estado: perfilFlex(pais).ubicacion === 'confirmada' ? 'pendiente' : 'sin_coordenadas',
    fuente: '',
    confirmada: false,
  };
}

/**
 * Vincula los envíos con su destinatario de Divoox (mismo teléfono en formato internacional, o el
 * mismo correo) y, si no tienen punto y la persona tiene UNA sola dirección con pin, usa esa.
 */
export async function vincularDestinatarios(db: D1Database, envioIds: string[], pais: string) {
  for (const id of envioIds) {
    const e = await db
      .prepare(
        'SELECT destinatario_telefono, destinatario_correo, lat, destinatario_usuario_id FROM envios WHERE id = ?',
      )
      .bind(id)
      .first<{
        destinatario_telefono: string;
        destinatario_correo: string;
        lat: number | null;
        destinatario_usuario_id: string | null;
      }>();
    if (!e || e.destinatario_usuario_id) continue;
    const tel = telefonoInternacional(e.destinatario_telefono, pais);
    const correo = e.destinatario_correo.trim().toLowerCase();
    if (!tel && !correo) continue;
    const { results } = await db
      .prepare(
        `SELECT id, telefono, correo FROM usuarios
          WHERE rol = 'cliente' AND activo = 1
            AND ((? != '' AND lower(correo) = ?) OR (? != '' AND telefono IS NOT NULL AND telefono LIKE ?))
          LIMIT 10`,
      )
      .bind(correo, correo, tel, `%${tel.slice(-7)}`)
      .all<{ id: string; telefono: string | null; correo: string }>();
    const u = results.find(
      (x) =>
        (correo && x.correo.toLowerCase() === correo) ||
        (tel && telefonoInternacional(x.telefono ?? '', pais) === tel),
    );
    if (!u) continue;
    await db
      .prepare('UPDATE envios SET destinatario_usuario_id = ? WHERE id = ?')
      .bind(u.id, id)
      .run();
    if (e.lat != null) continue;
    const { results: dirs } = await db
      .prepare(
        'SELECT direccion, lat, lng, instrucciones FROM direcciones_cliente WHERE usuario_id = ? AND lat IS NOT NULL AND lng IS NOT NULL',
      )
      .bind(u.id)
      .all<{ direccion: string; lat: number; lng: number; instrucciones: string }>();
    const unica = dirs.length === 1 ? dirs[0] : undefined;
    if (unica)
      await db
        .prepare(
          `UPDATE envios SET lat = ?, lng = ?, direccion = ?, referencias = CASE WHEN referencias = '' THEN ? ELSE referencias END,
             ubicacion_estado = 'confirmada', ubicacion_fuente = 'app_cliente', ubicacion_confirmada_en = datetime('now'),
             actualizado_en = datetime('now')
           WHERE id = ? AND lat IS NULL`,
        )
        .bind(unica.lat, unica.lng, unica.direccion, unica.instrucciones, id)
        .run();
  }
}

/** ¿Todavía se puede cambiar el punto? (no si ya salió o terminó). */
async function envioAbierto(db: D1Database, envioId: string): Promise<boolean> {
  const f = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM paquetes WHERE envio_id = ? AND estado IN (${ESTADOS_CERRADOS.map(() => '?').join(',')})`,
    )
    .bind(envioId, ...ESTADOS_CERRADOS)
    .first<{ n: number }>();
  return Number(f?.n) === 0;
}

const puntoConfirmado = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  direccion: z.string().trim().min(3).max(300).optional(),
  referencias: z.string().trim().max(300).default(''),
});

async function confirmarPunto(
  db: D1Database,
  envioId: string,
  pais: string,
  d: z.infer<typeof puntoConfirmado>,
  fuente: 'enlace_destinatario' | 'app_cliente',
) {
  if (perfilFlex(pais).referenciasObligatorias && d.referencias.length < 5)
    throw new ErrorDatos(
      'Escribe un punto de referencia (por ejemplo: «casa azul frente a la panadería»).',
      'referencias',
      422,
    );
  if (!(await envioAbierto(db, envioId)))
    throw new ErrorDatos(
      'Este paquete ya va en camino: ya no se cambia la ubicación.',
      undefined,
      409,
    );
  await db
    .prepare(
      `UPDATE envios SET lat = ?, lng = ?, direccion = COALESCE(?, direccion), referencias = ?,
         ubicacion_estado = 'confirmada', ubicacion_fuente = ?, ubicacion_confirmada_en = datetime('now'),
         actualizado_en = datetime('now')
       WHERE id = ?`,
    )
    .bind(d.lat, d.lng, d.direccion ?? null, d.referencias, fuente, envioId)
    .run();
}

// ───────────────────────────── Empresa: pedir la ubicación ─────────────────────────────

/**
 * Crea (o renueva) el enlace para que el destinatario marque su ubicación, y el mensaje listo para
 * mandarlo por WhatsApp. Solo se guarda la huella del código.
 */
flexUbicacion.post('/empresas/:id/envios/:envioId/enlace-ubicacion', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.crear');
  const db = base(c);
  const envioId = c.req.param('envioId');
  const e = await db
    .prepare(
      'SELECT e.destinatario_nombre, e.destinatario_telefono, m.nombre AS empresa, m.pais FROM envios e JOIN empresas m ON m.id = e.empresa_id WHERE e.id = ? AND e.empresa_id = ?',
    )
    .bind(envioId, actor.empresaId)
    .first<{
      destinatario_nombre: string;
      destinatario_telefono: string;
      empresa: string;
      pais: string;
    }>();
  if (!e) throw new ErrorDatos('Ese envío no existe.', undefined, 404);
  if (!(await envioAbierto(db, envioId)))
    throw new ErrorDatos(
      'Este paquete ya va en camino: ya no se cambia la ubicación.',
      undefined,
      409,
    );
  const codigo = nuevoToken();
  await db.batch([
    db
      .prepare(
        `UPDATE envios SET enlace_ubicacion_huella = ?, enlace_ubicacion_vence = datetime('now', ?),
           ubicacion_estado = CASE WHEN ubicacion_estado = 'confirmada' THEN 'confirmada' ELSE 'pendiente' END
         WHERE id = ?`,
      )
      .bind(await sha256(codigo), `+${DIAS_ENLACE_UBICACION} days`, envioId),
    sentenciaAuditoria(db, actor, 'envio.enlace_ubicacion', envioId, {}),
  ]);
  const sitio = (c.env.SITIO_URL ?? new URL(c.req.url).origin).replace(/\/$/, '');
  const url = `${sitio}/deliver/${codigo}`;
  const nombre = e.destinatario_nombre.split(' ')[0] ?? '';
  const mensaje =
    e.pais === 'US'
      ? `Hi ${nombre}, ${e.empresa} is sending you a package with Divoox. Please mark the exact delivery location here: ${url}`
      : `Hola ${nombre}, ${e.empresa} te envía un paquete con Divoox. Marca aquí la ubicación exacta donde lo recibes: ${url}`;
  const tel = telefonoInternacional(e.destinatario_telefono, e.pais);
  return c.json({
    url,
    mensaje,
    whatsapp: tel ? `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}` : null,
    venceEnDias: DIAS_ENLACE_UBICACION,
  });
});

// ───────────────────────────── Destinatario: enlace público ─────────────────────────────

async function envioDelEnlace(db: D1Database, codigo: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(codigo))
    throw new ErrorDatos('Este enlace no existe o venció.', undefined, 404);
  const e = await db
    .prepare(
      `SELECT e.id, e.destinatario_nombre, e.direccion, e.referencias, e.lat, e.lng, e.ubicacion_estado,
              m.nombre AS empresa, m.pais
         FROM envios e JOIN empresas m ON m.id = e.empresa_id
        WHERE e.enlace_ubicacion_huella = ? AND e.enlace_ubicacion_vence > datetime('now')`,
    )
    .bind(await sha256(codigo))
    .first<{
      id: string;
      destinatario_nombre: string;
      direccion: string;
      referencias: string;
      lat: number | null;
      lng: number | null;
      ubicacion_estado: string;
      empresa: string;
      pais: string;
    }>();
  if (!e) throw new ErrorDatos('Este enlace no existe o venció.', undefined, 404);
  return e;
}

/** Lo que ve el destinatario: quién le envía y la dirección que escribió la empresa. Nada más. */
flexUbicacion.get('/publico/ubicacion/:codigo', async (c) => {
  const e = await envioDelEnlace(base(c), c.req.param('codigo'));
  const p = perfilFlex(e.pais);
  return c.json({
    envio: {
      empresa: e.empresa,
      destinatario: e.destinatario_nombre.split(' ')[0] ?? '',
      direccion: e.direccion,
      referencias: e.referencias,
      punto: e.lat != null && e.lng != null ? { lat: e.lat, lng: e.lng } : null,
      confirmada: e.ubicacion_estado === 'confirmada',
      pais: p.pais,
      referenciasObligatorias: p.referenciasObligatorias,
      centroMapa: p.centroMapa,
      abierto: await envioAbierto(base(c), e.id),
    },
  });
});

flexUbicacion.post('/publico/ubicacion/:codigo', async (c) => {
  const db = base(c);
  const e = await envioDelEnlace(db, c.req.param('codigo'));
  const d = await leerCuerpo(c, puntoConfirmado);
  await confirmarPunto(db, e.id, e.pais, d, 'enlace_destinatario');
  return c.json({ ok: true });
});

// ───────────────────────────── Destinatario: su app de Divoox ─────────────────────────────

/** «Mis paquetes»: lo que las empresas me envían por Flex (vinculado por teléfono o correo). */
flexUbicacion.get('/mis-paquetes', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  // Por si el envío llegó antes de que la persona tuviera cuenta: se vincula al consultar.
  const yo = await db
    .prepare('SELECT telefono, correo FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ telefono: string | null; correo: string }>();
  if (yo) {
    const { results: sueltos } = await db
      .prepare(
        `SELECT e.id, m.pais FROM envios e JOIN empresas m ON m.id = e.empresa_id
          WHERE e.destinatario_usuario_id IS NULL AND e.creado_en > datetime('now', '-60 days')
            AND (lower(e.destinatario_correo) = lower(?) OR (? != '' AND e.destinatario_telefono LIKE ?))
          LIMIT 50`,
      )
      .bind(
        yo.correo,
        (yo.telefono ?? '').replace(/\D/g, ''),
        `%${(yo.telefono ?? '').replace(/\D/g, '').slice(-7) || 'x'}`,
      )
      .all<{ id: string; pais: string }>();
    for (const s of sueltos) await vincularDestinatarios(db, [s.id], s.pais);
  }
  // Si ya guardó UNA casa con pin, los envíos suyos que esperan ubicación (y no han salido) la toman.
  const { results: casas } = await db
    .prepare(
      'SELECT direccion, lat, lng, instrucciones FROM direcciones_cliente WHERE usuario_id = ? AND lat IS NOT NULL AND lng IS NOT NULL',
    )
    .bind(u.id)
    .all<{ direccion: string; lat: number; lng: number; instrucciones: string }>();
  const casa = casas.length === 1 ? casas[0] : undefined;
  if (casa)
    await db
      .prepare(
        `UPDATE envios SET lat = ?, lng = ?, direccion = ?, referencias = CASE WHEN referencias = '' THEN ? ELSE referencias END,
           ubicacion_estado = 'confirmada', ubicacion_fuente = 'app_cliente', ubicacion_confirmada_en = datetime('now'),
           actualizado_en = datetime('now')
         WHERE destinatario_usuario_id = ? AND lat IS NULL AND ubicacion_estado != 'confirmada'
           AND NOT EXISTS (SELECT 1 FROM paquetes p WHERE p.envio_id = envios.id
                            AND p.estado IN (${ESTADOS_CERRADOS.map(() => '?').join(',')}))`,
      )
      .bind(casa.lat, casa.lng, casa.direccion, casa.instrucciones, u.id, ...ESTADOS_CERRADOS)
      .run();
  const { results } = await db
    .prepare(
      `SELECT e.id, e.direccion, e.referencias, e.lat, e.lng, e.ubicacion_estado, e.creado_en, e.estado,
              m.nombre AS empresa, m.pais,
              (SELECT p.codigo_seguimiento FROM paquetes p WHERE p.envio_id = e.id ORDER BY p.creado_en LIMIT 1) AS codigo,
              (SELECT COUNT(*) FROM paquetes p WHERE p.envio_id = e.id AND p.estado IN (${ESTADOS_CERRADOS.map(() => '?').join(',')})) AS cerrados
         FROM envios e JOIN empresas m ON m.id = e.empresa_id
        WHERE e.destinatario_usuario_id = ?
        ORDER BY e.creado_en DESC LIMIT 50`,
    )
    .bind(...ESTADOS_CERRADOS, u.id)
    .all<Record<string, unknown>>();
  return c.json({
    paquetes: results.map((f) => ({
      envioId: f.id,
      empresa: f.empresa,
      codigo: f.codigo,
      estado: f.estado,
      direccion: f.direccion,
      referencias: f.referencias,
      punto: f.lat != null && f.lng != null ? { lat: f.lat, lng: f.lng } : null,
      ubicacion: f.ubicacion_estado,
      puedeCambiar: Number(f.cerrados) === 0,
      referenciasObligatorias: perfilFlex(String(f.pais)).referenciasObligatorias,
      creadoEn: f.creado_en,
    })),
  });
});

flexUbicacion.post('/mis-paquetes/:envioId/ubicacion', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const e = await db
    .prepare(
      'SELECT e.id, m.pais FROM envios e JOIN empresas m ON m.id = e.empresa_id WHERE e.id = ? AND e.destinatario_usuario_id = ?',
    )
    .bind(c.req.param('envioId'), u.id)
    .first<{ id: string; pais: string }>();
  if (!e) throw new ErrorDatos('Ese paquete no existe.', undefined, 404);
  const d = await leerCuerpo(c, puntoConfirmado);
  await confirmarPunto(db, e.id, e.pais, d, 'app_cliente');
  return c.json({ ok: true });
});
