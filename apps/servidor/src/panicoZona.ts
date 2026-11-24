import type { Env } from './env';
import { correosEquipo, smsEquipo } from './avisosEquipo';
import { type Idioma, notificar } from './notificaciones';
import { zonaPara } from './rutas/zonas';
import { avisarLinea } from './lineas';
import { enviarSms, telefonoE164 } from './sms';
import { cortoPanico } from './smsVenezuelaTextos';

/**
 * C-PANICO-ZONA (16 nov 2026, piloto de El Vigía y Tucaní; aplica a todos los países).
 *
 * Cuando un conductor, un repartidor o un pasajero toca el botón de pánico, además del correo al
 * equipo, le llega un SMS a la persona RESPONSABLE DE ESA ZONA (zonas.responsable_telefono, que se
 * carga en el superadmin): quién es, su teléfono, el enlace del mapa con su ubicación y el viaje o
 * pedido. Si ese teléfono es también el de una cuenta de Divoox con la app instalada, le llega
 * además el aviso al celular.
 *
 * El SMS de pánico sale a CUALQUIER país (también +58), aunque SMS_PREFIJOS no lo tenga: es la
 * única excepción (los demás SMS a Venezuela siguen apagados por costo). Nunca frena la operación.
 */
export const TIPO_SMS_PANICO = 'equipo_panico';

export type Panico = {
  /** Quien tocó el botón (el envío queda registrado a su nombre en sms_enviados). */
  usuarioId: string;
  zonaId: string | null | undefined;
  rol: 'pasajero' | 'conductor' | 'repartidor';
  nombre: string;
  telefono: string | null | undefined;
  lat?: number | null;
  lng?: number | null;
  /** «viaje …» o «pedido …»; vacío si no estaba en ninguno. */
  referencia: string;
  /**
   * C-PANICO-INSISTE: el id de la emergencia (`emergencias_viaje` o `incidentes_repartidor`), para que
   * el aviso insista hasta que alguien lo abra o lo marque atendido.
   */
  panicoId?: string;
  /**
   * C-PANICO-CENTRAL: el que llama ya le mandó el SMS al equipo (la emergencia del repartidor y la del
   * viaje lo hacen siempre). Si la zona no tiene responsable, no se repite.
   */
  smsEquipoHecho?: boolean;
};

const ROL: Record<Panico['rol'], string> = {
  pasajero: 'el pasajero',
  conductor: 'el conductor',
  repartidor: 'el repartidor',
};
const ROL_EN: Record<Panico['rol'], string> = {
  pasajero: 'the rider',
  conductor: 'the driver',
  repartidor: 'the delivery driver',
};

/**
 * C-PANICO-INSISTE (24 nov 2026) — todos los países. El aviso de pánico al celular, en el idioma de
 * cada aparato, por el canal PROPIO de pánico (sonido fuerte y distinto, importancia máxima, atraviesa
 * «no molestar» donde el teléfono lo deja). Las apps de antes lo reciben por su canal de siempre.
 */
export function avisoPanico(p: Panico, zona: string | null, i: Idioma) {
  const quien = p.nombre || (i === 'en' ? 'no name' : 'sin nombre');
  const tel = p.telefono || (i === 'en' ? 'no phone' : 'sin teléfono');
  return {
    titulo:
      i === 'en'
        ? zona
          ? `PANIC in ${zona}`
          : 'PANIC: someone needs help'
        : zona
          ? `PÁNICO en ${zona}`
          : 'PÁNICO: alguien pide ayuda',
    cuerpo:
      i === 'en'
        ? [
            `${ROL_EN[p.rol]} ${quien} (phone ${tel}) asked for help.`,
            `Where: ${enlaceMapa(p.lat, p.lng)}`,
            p.referencia ? `${p.referencia}.` : '',
            'Call them now.',
          ]
            .filter(Boolean)
            .join(' ')
        : textoPanico(p, zona ?? 'tu zona'),
    canal: 'panico' as const,
    datos: { tipo: 'panico', ...(p.panicoId ? { panicoId: p.panicoId } : {}) },
  };
}

/**
 * A quién le llega el pánico de una zona: su responsable (SMS a su teléfono y aviso a la cuenta con
 * ese número) o, si la zona no tiene responsable con teléfono, el EQUIPO CENTRAL (C-PANICO-CENTRAL):
 * las cuentas del equipo que reciben los avisos de «sistema».
 */
export async function destinosPanico(
  env: Env,
  db: D1Database,
  zonaId: string | null,
): Promise<{ zona: string | null; telefono: string | null; usuarios: string[]; central: boolean }> {
  const z = zonaId
    ? await db
        .prepare('SELECT nombre, responsable_telefono FROM zonas WHERE id = ?')
        .bind(zonaId)
        .first<{ nombre: string; responsable_telefono: string }>()
        .catch((e: unknown) => {
          console.error('pánico: no se pudo leer la zona', String(e));
          return null;
        })
    : null;
  const para = telefonoE164(z?.responsable_telefono);
  if (z && para) {
    // El aviso al celular, si el responsable tiene cuenta con ese mismo número.
    const ultimos = para.replace(/\D/g, '').slice(-8);
    const { results } = await db
      .prepare(
        "SELECT id, telefono FROM usuarios WHERE activo = 1 AND telefono LIKE ? AND telefono <> '' LIMIT 5",
      )
      .bind(`%${ultimos}`)
      .all<{ id: string; telefono: string }>()
      .catch((e: unknown) => {
        // Nunca en silencio: sin esta lectura el responsable no recibe el aviso al celular.
        console.error('pánico: no se pudo buscar la cuenta del responsable', String(e));
        return { results: [] as { id: string; telefono: string }[] };
      });
    return {
      zona: z.nombre,
      telefono: para,
      usuarios: results.filter((u) => telefonoE164(u.telefono) === para).map((u) => u.id),
      central: false,
    };
  }
  const correos = await correosEquipo(env, 'sistema');
  const { results } = await db
    .prepare(
      `SELECT id FROM usuarios WHERE rol = 'admin' AND activo = 1
         AND LOWER(correo) IN (SELECT value FROM json_each(?)) LIMIT 20`,
    )
    .bind(JSON.stringify(correos))
    .all<{ id: string }>()
    .catch((e: unknown) => {
      console.error('pánico: no se pudo buscar al equipo central', String(e));
      return { results: [] as { id: string }[] };
    });
  return {
    zona: z?.nombre ?? null,
    telefono: null,
    usuarios: results.map((u) => u.id),
    central: true,
  };
}

export const enlaceMapa = (lat?: number | null, lng?: number | null) =>
  lat != null && lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : 'sin ubicación (no compartió el GPS)';

export function textoPanico(p: Panico, zona: string): string {
  return [
    `Divoox PÁNICO en ${zona}: ${ROL[p.rol]} ${p.nombre || 'sin nombre'}`,
    `tel. ${p.telefono || 'sin teléfono'} pidió ayuda.`,
    `Dónde: ${enlaceMapa(p.lat, p.lng)}`,
    p.referencia ? `${p.referencia}.` : '',
    'Llámalo ya.',
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 480);
}

/**
 * C-PANICO-SMS-POR-PERSONA (24 nov 2026): el SMS de pánico cuesta y tiene un tope diario para todos.
 * Una persona que toca el botón una y otra vez no puede gastarlo y dejar sin SMS a un pánico real de
 * otra: con más de `PANICO_SMS_POR_PERSONA_HORA` pánicos suyos en la última hora, los siguientes salen
 * solo por el celular y la campana (que salen siempre). Cuenta lo que ya está guardado (los pánicos de
 * la persona, incluido el de ahora): no escribe nada.
 */
export const PANICO_SMS_POR_PERSONA_HORA = 3;

export async function smsDePanicoPermitido(db: D1Database, usuarioId: string): Promise<boolean> {
  const f = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM emergencias_viaje WHERE actor_id = ?1 AND creado_en >= datetime('now', '-1 hour'))
            + (SELECT COUNT(*) FROM incidentes_repartidor WHERE repartidor_id = ?1 AND tipo = 'emergencia'
                 AND creado_en >= datetime('now', '-1 hour')) AS n`,
    )
    .bind(usuarioId)
    .first<{ n: number }>()
    .catch((e: unknown) => {
      // Si no se puede contar, el SMS sale: ante la duda, que el pánico llegue.
      console.error('pánico: no se pudo contar los pánicos de la persona', String(e));
      return null;
    });
  const permitido = Number(f?.n ?? 0) <= PANICO_SMS_POR_PERSONA_HORA;
  if (!permitido)
    console.error(
      `pánico: ${usuarioId} pasó ${PANICO_SMS_POR_PERSONA_HORA} pánicos en una hora; sale sin SMS`,
    );
  return permitido;
}

/** Avisa al responsable de la zona. Devuelve cuántos avisos salieron (SMS + celular). */
export async function avisarResponsableZona(env: Env, db: D1Database, p: Panico): Promise<number> {
  // C-LINEAS-TAXI: si el conductor está en una línea, el líder y el segundo contacto reciben el aviso además
  // del responsable de la zona (más avisos, nunca menos). Si falla, la emergencia sigue su camino.
  let deLinea = 0;
  if (p.rol !== 'pasajero')
    deLinea = await avisarLinea(env, db, {
      usuarioId: p.usuarioId,
      nombre: p.nombre,
      telefono: p.telefono,
      lat: p.lat,
      lng: p.lng,
      referencia: p.referencia,
    }).catch((e: unknown) => {
      console.error('pánico: no se pudo avisar a la línea', String(e));
      return 0;
    });
  // Sin zona guardada (cuenta sin ficha completa), se usa la zona del lugar donde está.
  const zonaId =
    p.zonaId ??
    (p.lat != null && p.lng != null
      ? ((await zonaPara(db, p.lat, p.lng, false))?.id ?? null)
      : null);
  const d = await destinosPanico(env, db, zonaId);
  let enviados = 0;
  const conSms = await smsDePanicoPermitido(db, p.usuarioId);
  if (d.telefono) {
    if (
      conSms &&
      (await enviarSms(env, db, {
        usuarioId: p.usuarioId,
        pedidoId: null,
        tipo: TIPO_SMS_PANICO,
        telefono: d.telefono,
        texto: textoPanico(p, d.zona ?? ''),
        textoCorto: cortoPanico(p, ROL[p.rol], d.zona ?? ''),
      }))
    )
      enviados++;
  } else {
    // C-PANICO-CENTRAL: sin responsable con teléfono, el pánico NO se queda sin nadie: va al equipo
    // central (SMS si el que llama no lo mandó ya, y aviso al celular abajo). El canario lo marca.
    console.error(`pánico: la zona ${zonaId ?? 'desconocida'} no tiene responsable con teléfono`);
    if (!p.smsEquipoHecho && conSms)
      enviados += await smsEquipo(
        env,
        'sistema',
        textoPanico(p, d.zona ?? 'una zona sin responsable'),
        TIPO_SMS_PANICO,
      ).catch((e: unknown) => {
        console.error('pánico: SMS al equipo central', String(e));
        return 0;
      });
  }
  for (const u of d.usuarios) {
    const r = await notificar(env, db, u, (i) => avisoPanico(p, d.zona, i)).catch(() => ({
      enviados: 0,
    }));
    enviados += r.enviados;
  }
  return enviados + deLinea;
}

/**
 * C-PANICO-INSISTE (24 nov 2026) — todos los países. Un pánico que nadie abre no se queda en un solo
 * aviso: el reloj lo repite a los 2, 4 y 6 minutos (tres veces, ni una más) a los mismos destinos,
 * hasta que alguien abre el aviso (la app marca «visto») o el equipo lo marca atendido en el panel.
 * Solo el aviso al celular (el SMS sale una vez: cuesta y ya llegó). Cada repetición deja su marca
 * de una vez en la tabla que ya existe (`flex_avisos`); con nada que repetir, la vuelta no escribe.
 */
export const PANICO_REPETIR_MIN = [2, 4, 6] as const;
const VENTANA_MIN = 10;

export const clavePanicoVisto = (id: string) => `panico:${id}:visto`;

type Abierto = {
  id: string;
  actor: string;
  rol: Panico['rol'];
  zona: string | null;
  nombre: string;
  telefono: string | null;
  lat: number | null;
  lng: number | null;
  referencia: string;
  minutos: number;
};

/** Los pánicos de los últimos minutos sin atender ni abiertos por nadie. */
async function panicosAbiertos(db: D1Database): Promise<Abierto[]> {
  const { results } = await db
    .prepare(
      `SELECT e.id, e.actor_id AS actor, e.rol, o.zona_id AS zona, u.nombre, u.telefono, e.lat, e.lng,
              'Viaje ' || e.operacion_id AS referencia,
              CAST((julianday('now') - julianday(e.creado_en)) * 1440 AS INTEGER) AS minutos
         FROM emergencias_viaje e JOIN operaciones o ON o.id = e.operacion_id
         JOIN usuarios u ON u.id = e.actor_id
        WHERE e.atendida_en IS NULL AND e.creado_en >= datetime('now', ?)
          AND NOT EXISTS (SELECT 1 FROM flex_avisos f WHERE f.clave = 'panico:' || e.id || ':visto')
       UNION ALL
       SELECT i.id, i.repartidor_id, 'repartidor', d.zona_id, u.nombre, u.telefono, i.lat, i.lng,
              CASE WHEN i.pedido_id IS NULL THEN '' ELSE 'Pedido ' || i.pedido_id END,
              CAST((julianday('now') - julianday(i.creado_en)) * 1440 AS INTEGER)
         FROM incidentes_repartidor i JOIN usuarios u ON u.id = i.repartidor_id
         LEFT JOIN repartidores d ON d.usuario_id = i.repartidor_id
        WHERE i.tipo = 'emergencia' AND i.creado_en >= datetime('now', ?)
          AND NOT EXISTS (SELECT 1 FROM flex_avisos f WHERE f.clave = 'panico:' || i.id || ':visto')
       LIMIT 20`,
    )
    .bind(`-${VENTANA_MIN} minutes`, `-${VENTANA_MIN} minutes`)
    .all<Abierto>();
  return results;
}

/** Una vuelta del reloj: repite lo que toca repetir. Devuelve cuántos avisos repitió. */
export async function insistirPanicos(env: Env, db: D1Database): Promise<number> {
  let repetidos = 0;
  for (const a of await panicosAbiertos(db)) {
    const vuelta = PANICO_REPETIR_MIN.filter((m) => a.minutos >= m).length;
    if (!vuelta) continue;
    const marca = await db
      .prepare(
        "INSERT OR IGNORE INTO flex_avisos (clave, usuario_id, tipo) VALUES (?, ?, 'panico_repetido')",
      )
      .bind(`panico:${a.id}:${vuelta}`, a.actor)
      .run();
    if (!marca.meta.changes) continue;
    const p: Panico = {
      usuarioId: a.actor,
      zonaId: a.zona,
      rol: a.rol,
      nombre: a.nombre,
      telefono: a.telefono,
      lat: a.lat,
      lng: a.lng,
      referencia: a.referencia,
      panicoId: a.id,
    };
    const d = await destinosPanico(
      env,
      db,
      a.zona ??
        (a.lat != null && a.lng != null
          ? ((await zonaPara(db, a.lat, a.lng, false))?.id ?? null)
          : null),
    );
    for (const u of d.usuarios) {
      await notificar(env, db, u, (i) => {
        const aviso = avisoPanico(p, d.zona, i);
        return {
          ...aviso,
          titulo: `${aviso.titulo} · ${i === 'en' ? 'still unanswered' : 'sin atender'}`,
        };
      }).catch((e: unknown) => console.error('pánico: repetición', String(e)));
      repetidos++;
    }
  }
  return repetidos;
}

/** La zona de un pánico: la del viaje, la del repartidor o, si no la tiene, la del lugar donde lo tocó. */
async function zonaDePanico(db: D1Database, id: string) {
  const f = await db
    .prepare(
      `SELECT o.zona_id AS zona, e.lat, e.lng FROM emergencias_viaje e JOIN operaciones o ON o.id = e.operacion_id WHERE e.id = ?1
       UNION ALL SELECT d.zona_id, i.lat, i.lng FROM incidentes_repartidor i
         LEFT JOIN repartidores d ON d.usuario_id = i.repartidor_id WHERE i.id = ?1 AND i.tipo = 'emergencia'
       LIMIT 1`,
    )
    .bind(id)
    .first<{ zona: string | null; lat: number | null; lng: number | null }>();
  if (!f) return undefined;
  if (f.zona) return f.zona;
  return f.lat != null && f.lng != null
    ? ((await zonaPara(db, f.lat, f.lng, false))?.id ?? null)
    : null;
}

/**
 * Quien abrió el aviso de pánico lo marca visto: deja de insistir (una escritura, por la acción).
 * C-PANICO-VISTO-SOLO-DESTINO: solo puede hacerlo quien recibe ese pánico (el responsable de la zona o,
 * si la zona no tiene, el equipo central) o una cuenta del equipo; cualquier otra recibe 403.
 */
export async function marcarPanicoVisto(
  env: Env,
  db: D1Database,
  id: string,
  usuario: { id: string; rol: string },
): Promise<'ok' | 'no_existe' | 'prohibido'> {
  const zona = await zonaDePanico(db, id);
  if (zona === undefined) return 'no_existe';
  if (
    usuario.rol !== 'admin' &&
    !(await destinosPanico(env, db, zona)).usuarios.includes(usuario.id)
  )
    return 'prohibido';
  await db
    .prepare(
      "INSERT OR IGNORE INTO flex_avisos (clave, usuario_id, tipo) VALUES (?, ?, 'panico_visto')",
    )
    .bind(clavePanicoVisto(id), usuario.id)
    .run();
  return 'ok';
}

/**
 * C-PANICO-PANEL: lo que el panel del equipo necesita para sonar y ponerse en rojo aunque la pestaña
 * esté detrás. Una lectura chica por los índices de siempre; mirar no escribe nada.
 */
export async function panicosSinAtender(db: D1Database) {
  const f = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM emergencias_viaje WHERE atendida_en IS NULL
            AND creado_en >= datetime('now', '-1 day')) AS viajes,
         (SELECT COUNT(*) FROM incidentes_repartidor i WHERE i.tipo = 'emergencia'
            AND i.creado_en >= datetime('now', '-30 minutes')
            AND NOT EXISTS (SELECT 1 FROM flex_avisos f WHERE f.clave = 'panico:' || i.id || ':visto')) AS repartidores,
         (SELECT MAX(creado_en) FROM (
            SELECT creado_en FROM emergencias_viaje WHERE atendida_en IS NULL
              AND creado_en >= datetime('now', '-1 day')
            UNION ALL SELECT i.creado_en FROM incidentes_repartidor i WHERE i.tipo = 'emergencia'
              AND i.creado_en >= datetime('now', '-30 minutes')
              AND NOT EXISTS (SELECT 1 FROM flex_avisos f WHERE f.clave = 'panico:' || i.id || ':visto'))) AS ultimo`,
    )
    .first<{ viajes: number; repartidores: number; ultimo: string | null }>();
  return {
    cantidad: Number(f?.viajes ?? 0) + Number(f?.repartidores ?? 0),
    ultimo: f?.ultimo ?? null,
  };
}

/**
 * C-PANICO-CENTRAL, el canario: una zona ACTIVA sin responsable de pánico con teléfono se ve en rojo
 * en el panel (y avisa una vez al equipo por el canario). El pánico de esa zona igual llega al equipo
 * central, pero alguien de la zona tiene que poder llegar en minutos.
 */
const MS_MEMORIA_SALUD = 60_000;
let memoriaSalud: { db: D1Database; en: number; estado: 'ok' | 'error' } | null = null;
/** Al cambiar el responsable de una zona, la salud se vuelve a mirar en la próxima llamada. */
export const olvidarSaludPanico = () => {
  memoriaSalud = null;
};

export async function saludPanicoZonas(db: D1Database): Promise<'ok' | 'error'> {
  // El canario se llama a menudo: el resultado se guarda en memoria un minuto (sin escribir nada).
  const ahora = Date.now();
  if (memoriaSalud && memoriaSalud.db === db && ahora - memoriaSalud.en < MS_MEMORIA_SALUD)
    return memoriaSalud.estado;
  const { results } = await db
    .prepare('SELECT responsable_telefono AS t FROM zonas WHERE activa = 1 LIMIT 500')
    .all<{ t: string | null }>();
  const estado = results.some((z) => !telefonoE164(z.t)) ? 'error' : 'ok';
  memoriaSalud = { db, en: ahora, estado };
  return estado;
}

export async function zonasSinResponsable(db: D1Database) {
  const { results } = await db
    .prepare('SELECT id, nombre, responsable_telefono AS t FROM zonas WHERE activa = 1 LIMIT 500')
    .all<{ id: string; nombre: string; t: string | null }>();
  return results.filter((z) => !telefonoE164(z.t)).map((z) => ({ id: z.id, nombre: z.nombre }));
}
