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
import { anotarDecisionHumana } from './verificacionConductor';
import { codigoCiudad } from './superadmin';
import { porCobrarRegalos } from '../regalosDivoox';
import { entornoDeHost } from '@tumbite/compartido';
import { cobertura } from '../territorio';
import { ALTA_REPARTIDOR } from '../zonaConductor';
import { accesoDe, alcanceObjetoSql, dentroDelAlcance } from '../accesoInterno';

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

/**
 * C-ZONA-CONDUCTOR-NUEVO (robot, 18 nov 2026; todos los países): el conductor nuevo que todavía no
 * se conectó ni eligió ciudad (y no vino invitado) quedaba en Miami y veía los servicios de Miami.
 * Al abrir Driver, su ubicación (la del mapa del inicio) fija su ciudad UNA vez: solo si está dentro
 * de una zona de Divoox y su ciudad todavía no salió de una ubicación real ni de su elección.
 */
conductorPapeles.post('/conductor/zona-por-ubicacion', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const { lat, lng } = await leerCuerpo(
    c,
    z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  );
  const ficha = await db
    .prepare(
      'SELECT zona_id, ubicacion_en, ciudad_elegida_en FROM repartidores WHERE usuario_id = ?',
    )
    .bind(u.id)
    .first<{ zona_id: string; ubicacion_en: string | null; ciudad_elegida_en: string | null }>();
  if (ficha?.ubicacion_en || ficha?.ciudad_elegida_en)
    return c.json({ zonaId: ficha.zona_id, cambio: false });
  const aqui = await cobertura(db, lat, lng);
  const zona = aqui.estado === 'dentro' ? (aqui.zona?.id ?? null) : null;
  if (!zona || zona === ficha?.zona_id)
    return c.json({ zonaId: ficha?.zona_id ?? null, cambio: false });
  await db.batch([
    db.prepare(ALTA_REPARTIDOR).bind(u.id),
    db
      .prepare(
        'UPDATE repartidores SET zona_id = ? WHERE usuario_id = ? AND ubicacion_en IS NULL AND ciudad_elegida_en IS NULL',
      )
      .bind(zona, u.id),
    db.prepare('UPDATE usuarios SET zona_id = ? WHERE id = ? AND zona_id IS NULL').bind(zona, u.id),
  ]);
  return c.json({ zonaId: zona, cambio: true });
});

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

/**
 * C-CAMBIAR-CIUDAD-ADMIN (piloto, 18 nov 2026; todos los países): el equipo cambia la ciudad de un
 * conductor desde su ficha. Revisión del 18 nov:
 * - ATÓMICO: el código nuevo se calcula antes (contador de su ciudad) y cuenta, fila de repartidor
 *   (ciudad, código, `ciudad_elegida_en`, área en blanco) y auditoría van en UN solo lote. Si algo
 *   falla, nada cambia y se ve el error. Sin código nuevo posible, no se cambia nada.
 * - Nunca conectado ni con trabajo en curso: la condición va en el mismo UPDATE (sin carrera) y
 *   sin filas cambiadas responde 409.
 * - Misma ciudad: se rechaza (no regenera el código).
 * - País nuevo: pide `cambioPais: true` y se niega si queda dinero del país viejo (billetera, libro,
 *   cuenta de cobro, regalos por cobrar, recargas o retiros pendientes) o si tiene papeles, vehículo
 *   o habilitaciones del país viejo (no valen en el nuevo: el equipo decide primero). Lo más seguro.
 * - En producción no se ofrecen ni aceptan zonas internas de prueba (C-DISPONIBLE-MUNDO).
 */
const ZONA_DE_PRUEBA = /\((pruebas|test)\)/i;
const enProduccion = (c: { req: { url: string } }) =>
  entornoDeHost(new URL(c.req.url).host) === 'produccion';

/** Las ciudades a las que el equipo puede pasar a este conductor (activas, de su alcance). */
conductorPapeles.get('/admin/conductores/:id/ciudades-destino', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const actual = await paisDelConductor(db, id);
  const { results } = await db
    .prepare('SELECT id, nombre, pais FROM zonas WHERE activa = 1 ORDER BY pais, nombre')
    .all<{ id: string; nombre: string; pais: string | null }>();
  const acceso = accesoDe(c);
  const ciudades = results
    .filter((z) => z.id !== actual.zona_id)
    .filter((z) => !(enProduccion(c) && ZONA_DE_PRUEBA.test(z.nombre)))
    .filter(
      (z) =>
        !acceso ||
        dentroDelAlcance(
          { alcance: { ...acceso.alcance, servicios: null } },
          { zona: z.id, pais: z.pais, servicio: null },
        ),
    )
    .map((z) => ({ id: z.id, nombre: z.nombre, pais: z.pais ?? 'US' }));
  return c.json({ actual: { zonaId: actual.zona_id, pais: actual.pais }, ciudades });
});

conductorPapeles.put('/admin/conductores/:id/ciudad', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const d = await leerCuerpo(
    c,
    z.object({
      zonaId: z.string().trim().min(5).max(40),
      motivo: z.string().trim().min(3).max(200),
      cambioPais: z.boolean().optional(),
    }),
  );
  const [zona, persona] = await Promise.all([
    db
      .prepare('SELECT id, pais, nombre, codigo_ciudad FROM zonas WHERE id = ? AND activa = 1')
      .bind(d.zonaId)
      .first<{ id: string; pais: string | null; nombre: string; codigo_ciudad: string | null }>(),
    db
      .prepare(
        `SELECT u.id, r.conectado, r.codigo FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id
          WHERE u.id = ? AND u.rol = 'repartidor'`,
      )
      .bind(id)
      .first<{ id: string; conectado: number | null; codigo: string | null }>(),
  ]);
  if (!persona) throw new ErrorDatos('No encontramos a esa persona.', undefined, 404);
  if (!zona || (enProduccion(c) && ZONA_DE_PRUEBA.test(zona.nombre)))
    throw new ErrorDatos('Esa ciudad no está disponible.', 'zonaId', 404);
  // C-PERMISOS-FINOS: nadie manda a un conductor a una ciudad fuera de su propia zona de trabajo
  // (la ficha de origen ya la comprueba el intermedio).
  const acceso = accesoDe(c);
  if (
    acceso &&
    !dentroDelAlcance(
      { alcance: { ...acceso.alcance, servicios: null } },
      { zona: zona.id, pais: zona.pais, servicio: null },
    )
  )
    throw new ErrorDatos('Esa ciudad no está en tu zona de trabajo.', 'zonaId', 403);
  const antes = await paisDelConductor(db, id);
  if (antes.zona_id === zona.id) throw new ErrorDatos('Ya está en esa ciudad.', 'zonaId', 409);
  if (Number(persona.conectado) === 1)
    throw new ErrorDatos(
      'Está conectado: tiene que desconectarse antes de cambiar de ciudad.',
      undefined,
      409,
    );
  const ocupado = await db
    .prepare('SELECT 1 FROM conductor_ocupacion WHERE conductor_id = ?')
    .bind(id)
    .first();
  if (ocupado)
    throw new ErrorDatos('Tiene un viaje en curso: cámbiala cuando termine.', undefined, 409);
  const paisNuevo = (zona.pais ?? 'US').toUpperCase();
  if (paisNuevo !== antes.pais) {
    if (!d.cambioPais)
      throw new ErrorDatos(
        `Es un cambio de país (de ${antes.pais} a ${paisNuevo}): confírmalo para seguir.`,
        'cambioPais',
        409,
      );
    const queda = await db
      .prepare(
        `SELECT
           (SELECT COALESCE(SUM(monto), 0) FROM movimientos WHERE usuario_id = ?1) AS billetera,
           (SELECT COALESCE(SUM(ABS(t.s)), 0) FROM (SELECT SUM(monto) AS s FROM libro
              WHERE cuenta_id = ?1 AND pais = ?2 GROUP BY bolsillo, moneda) t) AS libro,
           EXISTS (SELECT 1 FROM cuentas_stripe WHERE usuario_id = ?1) AS cobro,
           EXISTS (SELECT 1 FROM recargas WHERE usuario_id = ?1 AND estado = 'pendiente') AS recarga,
           EXISTS (SELECT 1 FROM retiros WHERE usuario_id = ?1
                    AND estado IN ('pendiente', 'enviando', 'reintentar', 'revision')) AS retiro,
           (EXISTS (SELECT 1 FROM conductor_documentos WHERE conductor_id = ?1 AND estado != 'reemplazado')
            OR EXISTS (SELECT 1 FROM vehiculos WHERE conductor_id = ?1 AND estado != 'retirado')
            OR EXISTS (SELECT 1 FROM habilitaciones WHERE conductor_id = ?1)) AS papeles`,
      )
      .bind(id, antes.pais)
      .first<{
        billetera: number;
        libro: number;
        cobro: number;
        recarga: number;
        retiro: number;
        papeles: number;
      }>();
    const regalos = await porCobrarRegalos(db, id);
    if (
      Number(queda?.billetera) ||
      Number(queda?.libro) ||
      Number(queda?.cobro) ||
      Number(queda?.recarga) ||
      Number(queda?.retiro) ||
      (regalos?.monto ?? 0) > 0
    )
      throw new ErrorDatos(
        `Tiene saldo o una cuenta de cobro en ${antes.pais}: ciérralos antes de cambiarlo de país.`,
        'cambioPaisDinero',
        409,
      );
    if (Number(queda?.papeles))
      throw new ErrorDatos(
        `Tiene papeles, vehículo o servicios de ${antes.pais}, que no valen en ${paisNuevo}: el equipo tiene que revisarlos antes de cambiarlo de país.`,
        'cambioPaisPapeles',
        409,
      );
  }
  // El código nuevo, ANTES del lote (el contador de la ciudad nueva sube aunque luego falle: solo
  // queda un número sin usar). Si no se puede, no se cambia nada.
  const prefijo = `${paisNuevo.slice(0, 2)}-${codigoCiudad({ codigo_ciudad: zona.codigo_ciudad, nombre: zona.nombre })}`;
  const n = await db
    .prepare(
      'INSERT INTO contadores (clave, n) VALUES (?, 1) ON CONFLICT(clave) DO UPDATE SET n = n + 1 RETURNING n',
    )
    .bind(`repartidor:${prefijo}`)
    .first<{ n: number }>();
  if (!n?.n)
    throw new ErrorDatos('No se pudo preparar su código nuevo. Intenta otra vez.', undefined, 503);
  const codigo = `${prefijo}-${String(n.n).padStart(6, '0')}`;
  // UN lote: la fila (solo si sigue desconectado y sin trabajo), y la cuenta y la auditoría SOLO si
  // la fila cambió (miran la fila ya cambiada). Un código repetido hace fallar el lote entero.
  const [fila] = await db
    .batch([
      db.prepare(ALTA_REPARTIDOR).bind(id),
      db
        .prepare(
          `UPDATE repartidores SET zona_id = ?1, codigo = ?2, area_id = NULL, ciudad_elegida_en = datetime('now')
          WHERE usuario_id = ?3 AND conectado = 0
            AND NOT EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = ?3)`,
        )
        .bind(zona.id, codigo, id),
      db
        .prepare(
          'UPDATE usuarios SET zona_id = ?1 WHERE id = ?2 AND EXISTS (SELECT 1 FROM repartidores WHERE usuario_id = ?2 AND codigo = ?3)',
        )
        .bind(zona.id, id, codigo),
      db
        .prepare(
          `INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json)
         SELECT ?1, 'conductor.ciudad', ?2, ?3, ?4
          WHERE EXISTS (SELECT 1 FROM repartidores WHERE usuario_id = ?5 AND codigo = ?6)`,
        )
        .bind(
          admin.id,
          `conductor:${id}`,
          JSON.stringify({ zonaId: antes.zona_id, pais: antes.pais, codigo: persona.codigo }),
          JSON.stringify({ zonaId: zona.id, pais: paisNuevo, codigo, motivo: d.motivo }),
          id,
          codigo,
        ),
    ])
    .then((r) => [r[1]]);
  if (!Number(fila?.meta.changes))
    throw new ErrorDatos(
      'Se conectó o empezó un trabajo mientras tanto: no se cambió nada. Intenta otra vez cuando esté desconectado.',
      undefined,
      409,
    );
  return c.json({ zonaId: zona.id, codigo });
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
  if (!q.success)
    throw new ErrorDatos(
      'Ese papel no está en la lista. Usa licencia_conducir (Carro), licencia_moto (Moto) o antecedentes_penales.',
      'tipo',
      400,
    );
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
  // C-PERMISOS-FINOS: los papeles de los conductores de su alcance.
  const alc = alcanceObjetoSql(accesoDe(c), 'repartidor', 'd.conductor_id');
  const { results } = await base(c)
    .prepare(
      `SELECT d.id, d.conductor_id AS conductorId, u.nombre AS conductor, d.tipo, d.estado, d.motivo,
              d.vence_en AS venceEn, d.creado_en AS creadoEn,
              (SELECT z.pais FROM zonas z WHERE z.id = COALESCE(r.zona_id, u.zona_id, 'US-FL-MIAMI')) AS pais
         FROM conductor_documentos d JOIN usuarios u ON u.id = d.conductor_id
         LEFT JOIN repartidores r ON r.usuario_id = d.conductor_id
        WHERE d.estado = ?${alc.sql} ORDER BY d.creado_en LIMIT 100`,
    )
    .bind(estado, ...alc.valores)
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
  // C-VERIFICACION-IA: la decisión de la persona queda al lado de lo que dijo la IA.
  if (doc.tipo === 'licencia_moto' || doc.tipo === 'licencia_conducir')
    await anotarDecisionHumana(c.env, db, {
      conductorId: doc.conductor_id,
      papel: ['licencia'],
      decision: d.estado,
      por: admin.id,
    });
  return c.json({ estado: d.estado, requisitos });
});
