import { Hono } from 'hono';
import { z } from 'zod';
import {
  DOCUMENTOS_CONDUCTOR,
  DOCUMENTOS_VEHICULO_PASAJEROS,
  perfilPasajeros,
  requisitosQueCumple,
} from '@tumbite/compartido';
import { nuevoId } from '../cripto';
import type { Env } from '../env';
import { guardarFoto } from '../fotoLimpia';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { MAX_DOC_BYTES, estadoDelConductor } from './servicios';
import { paisDelConductor } from '../paisConductor';

/**
 * C-PAPELES-CONDUCTOR (13 nov 2026) — Venezuela y todos los países. Los papeles del CONDUCTOR (no de
 * la moto) que pide su país para llevar pasajeros, según el perfil del país (`perfilPasajeros`):
 *
 * - En Venezuela no hay proveedor automático de antecedentes: el conductor sube su licencia de moto
 *   y su certificado de antecedentes penales, y una persona del equipo los aprueba o los rechaza con
 *   motivo. Al aprobarlos se cumplen los requisitos que el perfil dice (licencia e historial de
 *   manejo; antecedentes para pasajeros). En EE. UU. los antecedentes siguen siendo de Checkr: un
 *   papel aprobado allí no cumple ningún requisito de antecedentes.
 * - La ciudad del conductor sale de su ubicación al conectarse; antes de conectarse la elige él.
 * - Los archivos son privados: solo el panel los abre, por su ruta.
 */
export const conductorPapeles = new Hono<{ Bindings: Env; Variables: Variables }>();

function tipoDeArchivo(b: Uint8Array): [string, string] | null {
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return ['image/jpeg', 'jpg'];
  if (b[0] === 0x89 && ascii(1, 3) === 'PNG') return ['image/png', 'png'];
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return ['image/webp', 'webp'];
  if (ascii(0, 5) === '%PDF-') return ['application/pdf', 'pdf'];
  return null;
}

conductorPapeles.get('/conductor/papeles', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const donde = await paisDelConductor(db, u.id);
  const perfil = perfilPasajeros(donde.pais);
  const eleccion = await eleccionCiudad(db, u.id);
  // C-CIUDAD-CONDUCTOR: ya elegida, solo se muestran las de su país.
  const soloPais = eleccion?.ciudad_elegida_en ? eleccion.pais : null;
  const [{ results: docs }, { results: ciudades }] = await Promise.all([
    db
      .prepare(
        `SELECT id, tipo, estado, motivo, vence_en AS venceEn, creado_en AS creadoEn FROM conductor_documentos
          WHERE conductor_id = ? AND estado != 'reemplazado' ORDER BY creado_en DESC`,
      )
      .bind(u.id)
      .all<{ tipo: string }>(),
    db
      .prepare(
        'SELECT id, nombre, pais FROM zonas WHERE activa = 1 AND (?1 IS NULL OR pais = ?1) ORDER BY pais, nombre LIMIT 100',
      )
      .bind(soloPais)
      .all<{ id: string; nombre: string; pais: string }>(),
  ]);
  return c.json({
    ciudad: { id: donde.zona_id, nombre: donde.nombre, pais: donde.pais },
    ciudades,
    cambioCiudad: {
      elegida: Boolean(eleccion?.ciudad_elegida_en),
      puedeCambiar: !eleccion?.ciudad_elegida_en || eleccion.puede === 1,
      soloPais,
      horas: HORAS_ENTRE_CAMBIOS_CIUDAD,
    },
    perfil: {
      pais: perfil.pais,
      antecedentes: perfil.antecedentes,
      edadMinima: perfil.edadMinima,
      placaNacional: perfil.placaNacional,
      documentos: perfil.documentosConductor,
      // C-CARRO-PAPELES-PAIS: lo que pide su país para cada servicio de pasajeros.
      documentosPorServicio: { moto: perfil.documentosConductor, carro: perfil.documentosCarro },
      documentosVehiculo: DOCUMENTOS_VEHICULO_PASAJEROS,
    },
    documentos: docs,
  });
});

/**
 * C-CIUDAD-CONDUCTOR (13 nov 2026, como Uber y DoorDash: la ciudad se elige al registrarse y
 * después solo se cambia dentro del mismo país; cambiar de país lo hace soporte):
 * - la primera vez (todavía no eligió) puede elegir cualquier ciudad abierta;
 * - después, solo una ciudad del MISMO país de su cuenta, una vez cada 24 horas;
 * - nunca conectado ni con un viaje o pedido en curso (no cambia el despacho a mitad de algo);
 * - el equipo la cambia a cualquiera desde el panel (`PUT /admin/conductores/:id/ciudad`).
 */
export const HORAS_ENTRE_CAMBIOS_CIUDAD = 24;

type Eleccion = {
  zona_id: string;
  pais: string;
  conectado: number;
  ciudad_elegida_en: string | null;
  puede: number;
};
async function eleccionCiudad(db: D1Database, conductorId: string): Promise<Eleccion | null> {
  return db
    .prepare(
      `SELECT r.zona_id, z.pais, r.conectado, r.ciudad_elegida_en,
              (r.ciudad_elegida_en IS NULL OR r.ciudad_elegida_en <= datetime('now', '-${HORAS_ENTRE_CAMBIOS_CIUDAD} hours')) AS puede
         FROM repartidores r JOIN zonas z ON z.id = r.zona_id WHERE r.usuario_id = ?`,
    )
    .bind(conductorId)
    .first<Eleccion>();
}

conductorPapeles.put('/conductor/ciudad', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const { zonaId } = await leerCuerpo(c, z.object({ zonaId: z.string().trim().min(5).max(40) }));
  const zona = await db
    .prepare('SELECT id, pais FROM zonas WHERE id = ? AND activa = 1')
    .bind(zonaId)
    .first<{ id: string; pais: string }>();
  if (!zona) throw new ErrorDatos('Esa ciudad no está disponible.', 'zonaId', 404);
  const ahora = await eleccionCiudad(db, u.id);
  if (ahora?.zona_id === zona.id && ahora.ciudad_elegida_en) return c.json({ zonaId: zona.id });
  if (ahora?.conectado === 1)
    throw new ErrorDatos('Desconéctate antes de cambiar de ciudad.', undefined, 409);
  const ocupado = await db
    .prepare('SELECT 1 FROM conductor_ocupacion WHERE conductor_id = ?')
    .bind(u.id)
    .first();
  if (ocupado)
    throw new ErrorDatos('Termina tu viaje en curso antes de cambiar de ciudad.', undefined, 409);
  if (!ahora?.ciudad_elegida_en) {
    // C-CIUDAD-PRIMERA-APROBADO: la primera elección es libre solo para quien todavía no fue
    // aprobado. Con la identidad o un papel ya aprobados, también exige el país de su cuenta.
    // Revisión del 13 nov 2026: el país sale de la cuenta (`usuarios.zona_id`, sin valor por
    // defecto). La zona de la fila de repartidor solo cuenta si salió de una ubicación real
    // (`ubicacion_en`): sin eso vale Miami por el DEFAULT del esquema y haría pasar a un venezolano
    // por EE. UU. Sin ningún dato, la de siempre (Miami, EE. UU.).
    const cuenta = await db
      .prepare(
        `SELECT z.pais,
           (EXISTS (SELECT 1 FROM kyc k WHERE k.usuario_id = u.id AND k.estado = 'aprobado')
            OR EXISTS (SELECT 1 FROM cumplimientos cu WHERE cu.conductor_id = u.id AND cu.estado = 'aprobado')) AS aprobado
          FROM usuarios u JOIN zonas z ON z.id = COALESCE(u.zona_id,
            (SELECT r.zona_id FROM repartidores r WHERE r.usuario_id = u.id AND r.ubicacion_en IS NOT NULL), 'US-FL-MIAMI')
         WHERE u.id = ?`,
      )
      .bind(u.id)
      .first<{ pais: string; aprobado: number }>();
    if (cuenta?.aprobado && cuenta.pais !== zona.pais)
      throw new ErrorDatos(
        'Solo puedes elegir una ciudad de tu país. Para cambiar de país, escribe a soporte.',
        'zonaId',
        409,
      );
  }
  if (ahora?.ciudad_elegida_en) {
    if (zona.pais !== ahora.pais)
      throw new ErrorDatos(
        'Solo puedes elegir una ciudad de tu país. Para cambiar de país, escribe a soporte.',
        'zonaId',
        409,
      );
    if (ahora.puede !== 1)
      throw new ErrorDatos(
        'Ya cambiaste de ciudad hoy. Podrás cambiarla otra vez dentro de 24 horas.',
        'zonaId',
        429,
      );
  }
  await db.batch([
    db.prepare('UPDATE usuarios SET zona_id = ? WHERE id = ?').bind(zona.id, u.id),
    db
      .prepare(
        `INSERT INTO repartidores (usuario_id, zona_id, ciudad_elegida_en) VALUES (?, ?, datetime('now'))
         ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id, ciudad_elegida_en = excluded.ciudad_elegida_en`,
      )
      .bind(u.id, zona.id),
  ]);
  return c.json({ zonaId: zona.id });
});

/** El equipo cambia la ciudad de un conductor (también de país), con motivo y en la auditoría. */
conductorPapeles.put('/admin/conductores/:id/ciudad', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const d = await leerCuerpo(
    c,
    z.object({
      zonaId: z.string().trim().min(5).max(40),
      motivo: z.string().trim().min(3).max(200),
    }),
  );
  const [zona, persona] = await Promise.all([
    db
      .prepare('SELECT id FROM zonas WHERE id = ? AND activa = 1')
      .bind(d.zonaId)
      .first<{ id: string }>(),
    db
      .prepare("SELECT id FROM usuarios WHERE id = ? AND rol = 'repartidor'")
      .bind(id)
      .first<{ id: string }>(),
  ]);
  if (!persona) throw new ErrorDatos('No encontramos a esa persona.', undefined, 404);
  if (!zona) throw new ErrorDatos('Esa ciudad no está disponible.', 'zonaId', 404);
  const ocupado = await db
    .prepare('SELECT 1 FROM conductor_ocupacion WHERE conductor_id = ?')
    .bind(id)
    .first();
  if (ocupado)
    throw new ErrorDatos('Tiene un viaje en curso: cámbiala cuando termine.', undefined, 409);
  const antes = await paisDelConductor(db, id);
  await db.batch([
    db.prepare('UPDATE usuarios SET zona_id = ? WHERE id = ?').bind(zona.id, id),
    db
      .prepare(
        `INSERT INTO repartidores (usuario_id, zona_id, ciudad_elegida_en) VALUES (?, ?, datetime('now'))
         ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id, conectado = 0,
           ciudad_elegida_en = excluded.ciudad_elegida_en`,
      )
      .bind(id, zona.id),
    db
      .prepare(
        'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        admin.id,
        'conductor.ciudad',
        `conductor:${id}`,
        JSON.stringify({ zonaId: antes.zona_id }),
        JSON.stringify({ zonaId: zona.id, motivo: d.motivo }),
      ),
  ]);
  return c.json({ zonaId: zona.id });
});

conductorPapeles.post('/conductor/papeles', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const q = z
    .object({
      tipo: z.enum(DOCUMENTOS_CONDUCTOR),
      vence: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    })
    .safeParse(c.req.query());
  if (!q.success) throw new ErrorDatos('Elige qué documento estás subiendo.', 'tipo', 400);
  if (Number(c.req.header('content-length') ?? 0) > MAX_DOC_BYTES)
    throw new ErrorDatos('El archivo pesa demasiado. El máximo es 5 MB.', 'archivo', 413);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (!bytes.byteLength) throw new ErrorDatos('No llegó ningún archivo.', 'archivo', 400);
  if (bytes.byteLength > MAX_DOC_BYTES)
    throw new ErrorDatos('El archivo pesa demasiado. El máximo es 5 MB.', 'archivo', 413);
  const tipo = tipoDeArchivo(bytes);
  if (!tipo) throw new ErrorDatos('Sube el documento en JPG, PNG, WebP o PDF.', 'archivo', 415);
  if (!c.env.BUCKET)
    throw new ErrorDatos(
      'El almacén de fotos no está disponible en este momento. Intenta más tarde.',
      undefined,
      503,
    );
  const id = nuevoId();
  const clave = `conductores/${u.id}/${id}.${tipo[1]}`;
  await guardarFoto(c.env.BUCKET, clave, bytes, tipo[0], { conservarOriginal: 'evidencia' });
  // El papel nuevo reemplaza al anterior del mismo tipo que no estaba aprobado (o que se rechazó).
  await db.batch([
    db
      .prepare(
        "UPDATE conductor_documentos SET estado = 'reemplazado' WHERE conductor_id = ? AND tipo = ? AND estado IN ('pendiente', 'rechazado')",
      )
      .bind(u.id, q.data.tipo),
    db
      .prepare(
        'INSERT INTO conductor_documentos (id, conductor_id, tipo, clave, vence_en) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(id, u.id, q.data.tipo, clave, q.data.vence ?? null),
  ]);
  return c.json({ id, estado: 'pendiente' }, 201);
});

// ---------------------------------------------------------------- equipo (superadmin)

conductorPapeles.get('/admin/papeles-conductor', async (c) => {
  exigir(c, 'admin');
  const estado = z
    .enum(['pendiente', 'aprobado', 'rechazado'])
    .catch('pendiente')
    .parse(c.req.query('estado') ?? 'pendiente');
  const { results } = await base(c)
    .prepare(
      `SELECT d.id, d.conductor_id AS conductorId, u.nombre AS conductor, d.tipo, d.estado, d.motivo,
              d.vence_en AS venceEn, d.creado_en AS creadoEn,
              (SELECT z.pais FROM zonas z WHERE z.id = COALESCE(r.zona_id, u.zona_id, 'US-FL-MIAMI')) AS pais
         FROM conductor_documentos d JOIN usuarios u ON u.id = d.conductor_id
         LEFT JOIN repartidores r ON r.usuario_id = d.conductor_id
        WHERE d.estado = ? ORDER BY d.creado_en LIMIT 100`,
    )
    .bind(estado)
    .all();
  return c.json({ documentos: results });
});

/** Todo lo de un conductor para llevar pasajeros, en una sola vista del panel. */
conductorPapeles.get('/admin/conductores/:id/pasajeros', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const persona = await db
    .prepare("SELECT nombre, fecha_nacimiento FROM usuarios WHERE id = ? AND rol = 'repartidor'")
    .bind(id)
    .first<{ nombre: string; fecha_nacimiento: string | null }>();
  if (!persona) throw new ErrorDatos('No encontramos a esa persona.', undefined, 404);
  const donde = await paisDelConductor(db, id);
  const [estado, { results: documentos }, kycFila] = await Promise.all([
    estadoDelConductor(db, id, false, Number.MAX_SAFE_INTEGER),
    db
      .prepare(
        "SELECT id, tipo, estado, motivo, vence_en AS venceEn FROM conductor_documentos WHERE conductor_id = ? AND estado != 'reemplazado'",
      )
      .bind(id)
      .all(),
    db.prepare('SELECT estado FROM kyc WHERE usuario_id = ?').bind(id).first<{ estado: string }>(),
  ]);
  return c.json({
    nombre: persona.nombre,
    fechaNacimiento: persona.fecha_nacimiento,
    ciudad: { id: donde.zona_id, nombre: donde.nombre, pais: donde.pais },
    perfil: perfilPasajeros(donde.pais),
    identidad: kycFila?.estado ?? 'sin_enviar',
    documentos,
    vehiculoActivo: estado.vehiculoActivo,
    servicios: estado.servicios.filter((s) => s.servicioId === 'moto' || s.servicioId === 'carro'),
  });
});

conductorPapeles.get('/admin/papeles-conductor/:id/archivo', async (c) => {
  exigir(c, 'admin');
  const d = await base(c)
    .prepare('SELECT clave FROM conductor_documentos WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ clave: string }>();
  const obj = d && c.env.BUCKET ? await c.env.BUCKET.get(d.clave) : null;
  if (!obj) throw new ErrorDatos('No encontramos ese documento.', undefined, 404);
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'cache-control': 'private, no-store',
    },
  });
});

conductorPapeles.put('/admin/papeles-conductor/:id', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const d = await leerCuerpo(
    c,
    z.object({
      estado: z.enum(['aprobado', 'rechazado']),
      motivo: z.string().trim().max(200).default(''),
      venceEn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
    }),
  );
  if (d.estado === 'rechazado' && !d.motivo)
    throw new ErrorDatos('Escribe el motivo para que la persona sepa qué corregir.', 'motivo', 422);
  const doc = await db
    .prepare(
      "SELECT id, conductor_id, tipo, vence_en FROM conductor_documentos WHERE id = ? AND estado IN ('pendiente', 'aprobado', 'rechazado')",
    )
    .bind(id)
    .first<{ id: string; conductor_id: string; tipo: string; vence_en: string | null }>();
  if (!doc) throw new ErrorDatos('No encontramos ese documento.', undefined, 404);
  const vence = d.venceEn ?? doc.vence_en;
  const donde = await paisDelConductor(db, doc.conductor_id);
  const perfil = perfilPasajeros(donde.pais);
  // Solo donde el país verifica con documentos el papel cumple requisitos de pasajeros.
  // C-PAPELES-SOLO-PASAJEROS: solo los de pasajeros, salvo que el perfil diga otros explícito.
  const requisitos =
    perfil.antecedentes === 'documentos' ? requisitosQueCumple(perfil, doc.tipo) : [];
  await db.batch([
    db
      .prepare(
        "UPDATE conductor_documentos SET estado = ?, motivo = ?, vence_en = ?, revisado_por = ?, revisado_en = datetime('now') WHERE id = ?",
      )
      .bind(d.estado, d.motivo, vence, admin.id, id),
    ...requisitos.map((r) =>
      db
        .prepare(
          `INSERT INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente, fuente_id, vence_en, aprobado_por)
           VALUES (?, '', ?, ?, 'documento_conductor', ?, ?, ?)
           ON CONFLICT(conductor_id, vehiculo_id, requisito) DO UPDATE SET estado = excluded.estado,
             fuente = excluded.fuente, fuente_id = excluded.fuente_id, vence_en = excluded.vence_en,
             aprobado_por = excluded.aprobado_por, actualizado_en = datetime('now')`,
        )
        .bind(doc.conductor_id, r, d.estado, id, vence, admin.id),
    ),
    db
      .prepare(
        'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        admin.id,
        'conductor.documento',
        `conductor:${doc.conductor_id}:${id}`,
        JSON.stringify(doc),
        JSON.stringify({ ...d, venceEn: vence, requisitos }),
      ),
  ]);
  return c.json({ estado: d.estado, requisitos });
});
