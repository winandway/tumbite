import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from './env';
import { type Variables, base, exigir } from './sesion';
import { ErrorDatos, leerCuerpo } from './validar';
import { zonaRealSql } from './cuentaPais';
import { alcanceObjetoSql } from './accesoInterno';

/**
 * C-CAMPANA-SE-VACIA (23 nov 2026, Richard) — todos los países. La pieza ÚNICA de todas las campanas
 * (superadmin, panel del restaurante, cada empresa de Flex, app del cliente y app del conductor).
 *
 * Sus palabras: «uno le da clic, la abre, los lee, ve el historial y ya esa no se vuelve a ver más».
 *
 * - La campana es de LECTURA: su número cuenta solo lo que esa persona todavía no vio.
 * - Lo visto se guarda EN EL SERVIDOR, por cuenta y por campana, con UNA marca «visto hasta» (fecha).
 *   Lo leído en la computadora tampoco sale nuevo en el celular.
 * - Mirar no escribe. Solo el gesto de abrir la campana escribe, y como mucho UNA fila (el UPDATE
 *   lleva su WHERE: si no había nada nuevo, no escribe nada). Nunca una escritura por aviso.
 * - Los números del menú (tareas) NO viven aquí: bajan al hacer la tarea (C-CONTADORES-DE-TAREA).
 */

/** Las campanas que existen. La de Flex lleva el id de la empresa. */
export const PATRON_CAMPANA =
  /^(superadmin|restaurante|cliente|repartidor|flex:[0-9A-Za-z-]{1,64})$/;

/** Las fechas de la base van «AAAA-MM-DD HH:MM:SS» (UTC); a veces llegan en ISO. Se comparan como texto. */
export const fechaCampana = (s: string | null | undefined) =>
  s ? s.replace('T', ' ').replace(/Z$/, '').slice(0, 19) : '';

/** Hasta cuándo vio esa persona esa campana ('' si nunca la abrió). UNA lectura por la llave. */
export async function leerVisto(db: D1Database, usuarioId: string, campana: string) {
  const f = await db
    .prepare('SELECT visto_hasta FROM campana_vista WHERE usuario_id = ? AND campana = ?')
    .bind(usuarioId, campana)
    .first<{ visto_hasta: string }>();
  return f?.visto_hasta ?? '';
}

/** Marca cada aviso leído o no, y cuenta los no leídos. `en` es cuándo pasó. */
export function conLeidos<T extends { en: string }>(lista: T[], visto: string) {
  const avisos = lista
    .map((a) => ({
      ...a,
      en: fechaCampana(a.en),
      leido: visto !== '' && fechaCampana(a.en) <= visto,
    }))
    .sort((a, b) => (a.en < b.en ? 1 : a.en > b.en ? -1 : 0));
  return { avisos, sinLeer: avisos.filter((a) => !a.leido).length };
}

/** Lee la marca y arma la campana de una vez. */
export async function campanaDe<T extends { en: string }>(
  db: D1Database,
  usuarioId: string,
  campana: string,
  lista: T[],
) {
  return conLeidos(lista, await leerVisto(db, usuarioId, campana));
}

/**
 * Guarda «visto hasta». Como mucho «ahora» (una fecha del futuro dejaría la campana muda) y solo si
 * es más nueva que la guardada. Devuelve cuántas filas escribió (0 o 1).
 */
export async function marcarVisto(
  db: D1Database,
  usuarioId: string,
  campana: string,
  hasta: string,
) {
  const r = await db
    .prepare(
      `INSERT INTO campana_vista (usuario_id, campana, visto_hasta) VALUES (?1, ?2, MIN(?3, datetime('now')))
         ON CONFLICT (usuario_id, campana) DO UPDATE SET visto_hasta = excluded.visto_hasta
           WHERE campana_vista.visto_hasta < excluded.visto_hasta`,
    )
    .bind(usuarioId, campana, fechaCampana(hasta))
    .run();
  return Number(r.meta.changes ?? 0);
}

export const rutasCampana = new Hono<{ Bindings: Env; Variables: Variables }>();

const esquemaVisto = z
  .object({
    campana: z.string().regex(PATRON_CAMPANA, 'Esa campana no existe.'),
    hasta: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/, 'Fecha inválida.')
      .max(30),
  })
  .strict();

/** El gesto de abrir la campana: «ya vi hasta aquí» (la fecha del aviso más nuevo de la lista que vio). */
rutasCampana.post('/campana/visto', async (c) => {
  const u = exigir(c);
  const { campana, hasta } = await leerCuerpo(c, esquemaVisto);
  const db = base(c);
  if (campana === 'superadmin' && u.rol !== 'admin')
    throw new ErrorDatos('Tu cuenta no tiene permiso para esto.', undefined, 403);
  if (campana.startsWith('flex:')) {
    // Solo quien es de esa empresa guarda su marca (así nadie llena la tabla con empresas ajenas).
    const es = await db
      .prepare(
        "SELECT 1 FROM empresa_miembros WHERE empresa_id = ? AND usuario_id = ? AND estado = 'activo'",
      )
      .bind(campana.slice('flex:'.length), u.id)
      .first();
    if (!es && u.rol !== 'admin')
      throw new ErrorDatos('Tu cuenta no tiene permiso para esto.', undefined, 403);
  }
  const escritas = await marcarVisto(db, u.id, campana, hasta);
  return c.json({ ok: true, escritas });
});

/** Qué pasó en el superadmin (lo que llega para el equipo). El texto lo pone el panel según el tipo. */
export type AvisoSuper = {
  tipo:
    | 'ticket'
    | 'camila'
    | 'verificacion'
    | 'restaurante'
    | 'linea'
    | 'aprobacion'
    | 'emergencia'
    | 'moderacion'
    | 'sin_zona';
  id: string;
  /** Un dato corto para reconocerlo (el asunto, el nombre). */
  titulo: string;
  en: string;
  /** Ya se atendió (lo pinta en verde y deja de ser tarea). */
  resuelto: boolean;
};

const REAL = (col: string) => `${col} NOT IN (SELECT id FROM usuarios WHERE es_prueba = 1)`;
/** Lo que llegó en estos días entra en la campana; lo más viejo vive en su sección. */
const DIAS_CAMPANA = 14;
const POR_TIPO = 10;

/**
 * La campana del superadmin: lo que LLEGÓ (un ticket, un caso de Camila, una verificación, un
 * restaurante, una línea, una aprobación de dinero, una emergencia, un reporte, un conductor sin
 * ciudad), con su fecha y si ya se resolvió. Solo cuentas reales y solo la zona de trabajo de quien
 * mira. Cada parte va por su índice (estado, fecha), con tope. Solo lectura.
 */
export async function avisosSuperadmin(
  db: D1Database,
  acceso: Parameters<typeof alcanceObjetoSql>[0],
): Promise<AvisoSuper[]> {
  const ticket = alcanceObjetoSql(acceso, 'ticket', 't.id');
  const conductor = alcanceObjetoSql(acceso, 'repartidor', 'k.usuario_id');
  const conductorD = alcanceObjetoSql(acceso, 'repartidor', 'u.id');
  const restaurante = alcanceObjetoSql(acceso, 'restaurante', 'r.id');
  const viaje = alcanceObjetoSql(acceso, 'viaje', 'e.operacion_id');
  const desde = `datetime('now', '-${DIAS_CAMPANA} days')`;
  // UNA consulta por tipo, todas en UN lote (un viaje a la base). No van unidas con UNION: D1 no deja
  // más de cinco partes en una sola consulta compuesta («too many terms in compound SELECT»).
  const partes: [sql: string, valores: unknown[]][] = [
    // Un ticket que vuelve a abrirse (el cliente contestó) vuelve a ser noticia: cuenta su última vez.
    [
      `SELECT 'ticket' AS tipo, t.id, t.asunto AS titulo,
        CASE WHEN t.estado = 'abierto' THEN t.actualizado_en ELSE t.creado_en END AS en,
        t.estado <> 'abierto' AS resuelto FROM tickets t
       WHERE t.estado IN ('abierto', 'respondido', 'cerrado') AND t.actualizado_en >= ${desde}
         AND (t.usuario_id IS NULL OR ${REAL('t.usuario_id')})${ticket.sql}
       ORDER BY t.actualizado_en DESC LIMIT ${POR_TIPO}`,
      ticket.valores,
    ],
    [
      `SELECT 'camila' AS tipo, cc.persona_id AS id, COALESCE(cp.nombre, '') AS titulo,
        cc.creado_en AS en, cc.estado <> 'abierto' AS resuelto
       FROM camila_casos cc JOIN camila_personas cp ON cp.id = cc.persona_id
       WHERE cc.estado IN ('abierto', 'cerrado') AND cc.creado_en >= ${desde}
         AND (cp.usuario_id IS NULL OR ${REAL('cp.usuario_id')})
       ORDER BY cc.creado_en DESC LIMIT ${POR_TIPO}`,
      [],
    ],
    [
      `SELECT 'verificacion' AS tipo, k.usuario_id AS id, COALESCE(u.nombre, '') AS titulo,
        k.enviado_en AS en, k.estado <> 'pendiente' AS resuelto
       FROM kyc k JOIN usuarios u ON u.id = k.usuario_id
       WHERE k.estado IN ('pendiente', 'aprobado', 'rechazado') AND k.enviado_en >= ${desde}
         AND u.es_prueba = 0${conductor.sql}
       ORDER BY k.enviado_en DESC LIMIT ${POR_TIPO}`,
      conductor.valores,
    ],
    [
      `SELECT 'restaurante' AS tipo, r.id, r.nombre AS titulo, r.creado_en AS en,
        r.estado <> 'pendiente' AS resuelto FROM restaurantes r
       WHERE r.creado_en >= ${desde} AND ${REAL('r.dueno_id')}${restaurante.sql}
       ORDER BY r.creado_en DESC LIMIT ${POR_TIPO}`,
      restaurante.valores,
    ],
    [
      `SELECT 'linea' AS tipo, s.id, s.nombre AS titulo, s.creado_en AS en,
        s.estado <> 'pendiente' AS resuelto FROM solicitudes_linea s
       WHERE s.creado_en >= ${desde} ORDER BY s.creado_en DESC LIMIT ${POR_TIPO}`,
      [],
    ],
    [
      `SELECT 'aprobacion' AS tipo, a.id, a.tipo AS titulo, a.creado_en AS en,
        a.estado <> 'pendiente' AS resuelto FROM aprobaciones_dinero a
       WHERE a.creado_en >= ${desde} ORDER BY a.creado_en DESC LIMIT ${POR_TIPO}`,
      [],
    ],
    [
      `SELECT 'emergencia' AS tipo, e.operacion_id AS id, '' AS titulo, e.creado_en AS en,
        e.atendida_en IS NOT NULL AS resuelto FROM emergencias_viaje e
       WHERE e.creado_en >= ${desde} AND ${REAL('e.actor_id')}${viaje.sql}
       ORDER BY e.creado_en DESC LIMIT ${POR_TIPO}`,
      viaje.valores,
    ],
    [
      `SELECT 'moderacion' AS tipo, rc.id, rc.motivo AS titulo, rc.creado_en AS en,
        rc.estado <> 'abierto' AS resuelto FROM reportes_contenido rc
       WHERE rc.estado IN ('abierto', 'resuelto') AND rc.creado_en >= ${desde}
       ORDER BY rc.creado_en DESC LIMIT ${POR_TIPO}`,
      [],
    ],
    // Conductores reales sin ciudad: solo mientras falte (al ponérsela, sale de la campana y del menú).
    [
      `SELECT 'sin_zona' AS tipo, u.id, u.nombre AS titulo, u.creado_en AS en, 0 AS resuelto
       FROM usuarios u JOIN repartidores d ON d.usuario_id = u.id
       WHERE u.rol = 'repartidor' AND u.activo = 1 AND u.es_prueba = 0
         AND ${zonaRealSql('d', 'u')} IS NULL${conductorD.sql}
       ORDER BY u.creado_en DESC LIMIT ${POR_TIPO}`,
      conductorD.valores,
    ],
  ];
  const lotes = await db.batch(partes.map(([sql, valores]) => db.prepare(sql).bind(...valores)));
  const results = lotes.flatMap(
    (l) =>
      l.results as {
        tipo: AvisoSuper['tipo'];
        id: string;
        titulo: string | null;
        en: string | null;
        resuelto: number;
      }[],
  );
  return results
    .filter((f) => f.en)
    .map((f) => ({
      tipo: f.tipo,
      id: f.id,
      titulo: f.titulo ?? '',
      en: fechaCampana(f.en),
      resuelto: Number(f.resuelto) === 1,
    }));
}

/** El pedido que llega al restaurante. */
export type AvisoRestaurante = {
  tipo: 'pedido';
  id: string;
  titulo: string;
  en: string;
  resuelto: boolean;
};

/** La campana del panel del restaurante: los pedidos que llegaron en estos dos días. Solo lectura. */
export async function avisosRestaurante(
  db: D1Database,
  usuarioId: string,
): Promise<AvisoRestaurante[]> {
  const { results } = await db
    .prepare(
      `SELECT p.id, r.nombre, p.creado_en, p.estado FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
        WHERE p.restaurante_id IN (SELECT id FROM restaurantes WHERE dueno_id = ?1
                UNION SELECT restaurante_id FROM miembros_restaurante WHERE usuario_id = ?1)
          AND p.creado_en >= datetime('now', '-2 days') AND p.estado <> 'pago_pendiente'
        ORDER BY p.creado_en DESC LIMIT 20`,
    )
    .bind(usuarioId)
    .all<{ id: string; nombre: string; creado_en: string; estado: string }>();
  return results.map((p) => ({
    tipo: 'pedido',
    id: p.id,
    titulo: `#${p.id.slice(0, 4).toUpperCase()} · ${p.nombre}`,
    en: fechaCampana(p.creado_en),
    resuelto: p.estado !== 'pagado',
  }));
}
