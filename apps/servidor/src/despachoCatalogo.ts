import {
  ahoraServicios,
  catalogo,
  estadoDelConductor,
  evaluarServicio,
  type Servicio,
} from './rutas/servicios';
import { ErrorDatos } from './validar';

/**
 * NXT-6 · C-DESPACHO-CATALOGO (3 nov 2026): el reparto de Comida lee el catálogo de habilitaciones,
 * la misma puerta que usan Moto y Carro. Como DoorDash y Uber, solo recibe pedidos quien está
 * activado para ese servicio con un vehículo aceptado y sus papeles vigentes (licencia y seguro si
 * va en carro o moto, estudio E2 p.3) [DOC]. Ficha: docs/investigaciones-rea/2026-11-03-despacho-
 * comida-catalogo.md.
 *
 * Con interruptor POR ZONA (tabla `despacho_catalogo_zonas`), que nace APAGADO: sin fila o con
 * `activo = 0`, el reparto sigue exactamente igual que antes (C-COMIDA-INTACTA).
 */
export type MotivoSinComida =
  | 'habilitado'
  | 'proximamente'
  | 'en_pausa'
  | 'no_disponible_zona'
  | 'actualizar_app'
  | 'pendiente_aprobacion'
  | 'sin_habilitacion'
  | 'requisitos_faltantes'
  | 'vehiculo_incompatible'
  | 'preferencia_apagada'
  | 'bloqueado';

/** Las zonas con el despacho por catálogo encendido. */
export async function zonasDespachoCatalogo(db: D1Database): Promise<Set<string>> {
  const { results } = await db
    .prepare('SELECT zona_id FROM despacho_catalogo_zonas WHERE activo = 1')
    .all<{ zona_id: string }>();
  return new Set(results.map((r) => r.zona_id));
}

/** ¿El catálogo deja a este repartidor recibir pedidos de este servicio? Y si no, por qué. */
export async function motivoServicio(
  db: D1Database,
  conductorId: string,
  servicioId = 'comida',
): Promise<MotivoSinComida> {
  return (
    (await motivosServicio(db, [conductorId], servicioId)).get(conductorId) ?? 'sin_habilitacion'
  );
}

/** D1 acepta 100 valores por consulta: los lotes van de a 30 repartidores (3 valores cada uno). */
const LOTE = 30;

/**
 * ETP-5 (C-DESPACHO-LOTES, 3 nov 2026): el motivo de MUCHOS repartidores con un puñado fijo de
 * consultas por lote (bloqueos, cuenta y vehículo, habilitaciones, preferencias, compatibilidad,
 * requisitos faltantes y el catálogo de cada zona), en vez de unas 9 por repartidor. La regla es la
 * misma de `estadoDelConductor` (`evaluarServicio`), así lo que ve el conductor y el despacho no se
 * separan. La versión de la app no se sabe al repartir: aquí no frena (la exige al conectarse).
 */
export async function motivosServicio(
  db: D1Database,
  ids: string[],
  servicioId = 'comida',
): Promise<Map<string, MotivoSinComida>> {
  const fuera = new Map<string, MotivoSinComida>();
  const unicos = [...new Set(ids)];
  if (!unicos.length) return fuera;
  const compat = (
    await db
      .prepare('SELECT vehiculo_tipo FROM servicio_vehiculos WHERE servicio_id = ?')
      .bind(servicioId)
      .all<{ vehiculo_tipo: string }>()
  ).results.map((x) => x.vehiculo_tipo);
  const catalogos = new Map<string, Servicio | undefined>();
  const ahora = ahoraServicios();
  for (let k = 0; k < unicos.length; k += LOTE) {
    const lote = unicos.slice(k, k + LOTE);
    const marcas = lote.map(() => '?').join(',');
    const [bloq, reps, habs, prefs] = await Promise.all([
      db
        .prepare(
          `SELECT DISTINCT conductor_id FROM conductor_bloqueos WHERE conductor_id IN (${marcas})
             AND levantado_en IS NULL AND (servicio_id IS NULL OR servicio_id = ?)
             AND (hasta IS NULL OR hasta > datetime('now'))`,
        )
        .bind(...lote, servicioId)
        .all<{ conductor_id: string }>(),
      db
        .prepare(
          `SELECT u.id, COALESCE(r.zona_id, u.zona_id, 'US-FL-MIAMI') AS zona_id,
                  v.id AS vehiculo_id, v.tipo, v.estado
             FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id
             LEFT JOIN vehiculos v ON v.id = r.vehiculo_activo_id AND v.conductor_id = u.id
            WHERE u.id IN (${marcas})`,
        )
        .bind(...lote)
        .all<{
          id: string;
          zona_id: string;
          vehiculo_id: string | null;
          tipo: string | null;
          estado: string | null;
        }>(),
      db
        .prepare(
          `SELECT conductor_id, estado, vence_en FROM habilitaciones
            WHERE servicio_id = ? AND conductor_id IN (${marcas})`,
        )
        .bind(servicioId, ...lote)
        .all<{ conductor_id: string; estado: string; vence_en: string | null }>(),
      db
        .prepare(
          `SELECT conductor_id, activa FROM preferencias_servicio
            WHERE servicio_id = ? AND conductor_id IN (${marcas})`,
        )
        .bind(servicioId, ...lote)
        .all<{ conductor_id: string; activa: number }>(),
    ]);
    const bloqueados = new Set(bloq.results.map((b) => b.conductor_id));
    const cuenta = new Map(reps.results.map((r) => [r.id, r]));
    // Los requisitos que le faltan a cada uno (los del servicio y los de su vehículo), en UNA consulta.
    const filas = lote.map((id) => {
      const r = cuenta.get(id);
      const aprobado = r?.estado === 'aprobado';
      return [id, aprobado ? String(r.vehiculo_id) : '-', aprobado ? String(r.tipo) : '-'];
    });
    const valores = filas.map(() => '(?, ?, ?)').join(',');
    const faltan = await db
      .prepare(
        `WITH c(cid, vid, vtipo) AS (VALUES ${valores})
         SELECT c.cid, sr.requisito FROM c
           JOIN servicio_requisitos sr ON sr.servicio_id = ? AND sr.obligatorio = 1
           JOIN requisitos_def rd ON rd.requisito = sr.requisito
          WHERE NOT EXISTS (
                SELECT 1 FROM cumplimientos x
                 WHERE x.conductor_id = c.cid AND x.requisito = sr.requisito AND x.estado = 'aprobado'
                   AND x.vehiculo_id = CASE rd.nivel WHEN 'vehiculo' THEN c.vid ELSE '' END
                   AND (x.vence_en IS NULL OR x.vence_en > datetime('now')))
         UNION
         SELECT c.cid, svr.requisito FROM c
           JOIN servicio_vehiculo_requisitos svr ON svr.servicio_id = ? AND svr.vehiculo_tipo = c.vtipo
           JOIN requisitos_def rd ON rd.requisito = svr.requisito
          WHERE NOT EXISTS (
                SELECT 1 FROM cumplimientos x
                 WHERE x.conductor_id = c.cid AND x.requisito = svr.requisito AND x.estado = 'aprobado'
                   AND x.vehiculo_id = CASE rd.nivel WHEN 'vehiculo' THEN c.vid ELSE '' END
                   AND (x.vence_en IS NULL OR x.vence_en > datetime('now')))
          ORDER BY 1, 2`,
      )
      .bind(...filas.flat(), servicioId, servicioId)
      .all<{ cid: string; requisito: string }>();
    const hab = new Map(habs.results.map((h) => [h.conductor_id, h]));
    const pref = new Map(prefs.results.map((p) => [p.conductor_id, p.activa === 1]));
    for (const id of lote) {
      if (bloqueados.has(id)) {
        fuera.set(id, 'bloqueado');
        continue;
      }
      const r = cuenta.get(id);
      const zona = r?.zona_id ?? 'US-FL-MIAMI';
      if (!catalogos.has(zona))
        catalogos.set(
          zona,
          (await catalogo(db, zona)).find((x) => x.id === servicioId),
        );
      const s = catalogos.get(zona);
      if (!s) {
        fuera.set(id, 'no_disponible_zona');
        continue;
      }
      const e = evaluarServicio({
        s,
        ahora,
        habilitacion: hab.get(id),
        preferencia: pref.get(id),
        vehiculo: r?.vehiculo_id && r.tipo && r.estado ? { tipo: r.tipo, estado: r.estado } : null,
        tiposCompatibles: compat,
        requisitosFaltantes: faltan.results.filter((f) => f.cid === id).map((f) => f.requisito),
        versionDriver: Number.MAX_SAFE_INTEGER,
        ingles: false,
      });
      fuera.set(
        id,
        !e.puedeActivar
          ? (e.motivo as MotivoSinComida)
          : !e.preferencia
            ? 'preferencia_apagada'
            : 'habilitado',
      );
    }
  }
  return fuera;
}

/**
 * Deja solo a los habilitados, en el MISMO orden, y para en cuanto junta `cuantos` (no se revisa a
 * toda la zona por un pedido). `memo` guarda la respuesta de cada repartidor durante una vuelta;
 * `ademas` es otra condición de la misma etapa (el saldo del cobro directo).
 */
export async function filtrarPorCatalogo<T extends { id: string }>(
  db: D1Database,
  candidatos: T[],
  cuantos: number,
  memo: Map<string, boolean>,
  ademas?: (c: T) => Promise<boolean>,
): Promise<T[]> {
  const fuera: T[] = [];
  // ETP-5: los que esta vuelta todavía no conoce se revisan juntos, en lotes (no uno por uno).
  const nuevos = candidatos.filter((c) => !memo.has(c.id)).map((c) => c.id);
  for (const [id, motivo] of await motivosServicio(db, nuevos))
    memo.set(id, motivo === 'habilitado');
  for (const c of candidatos) {
    if (fuera.length >= cuantos) break;
    if (memo.get(c.id) && (!ademas || (await ademas(c)))) fuera.push(c);
  }
  return fuera;
}

/**
 * Al conectarse en una zona con el interruptor encendido (NXT-6x). Como DoorDash y Uber, se conecta
 * con los servicios que SÍ tiene: si no puede Comida pero sí otro servicio de la zona (Envíos, Moto,
 * o apagó Comida a propósito), entra igual y se le devuelve el motivo de Comida para avisarle. Solo
 * se frena (409 con el porqué) cuando no puede repartir NINGÚN servicio.
 */
export async function frenoAlConectar(
  db: D1Database,
  conductorId: string,
  zonaId: string,
): Promise<MotivoSinComida | null> {
  if (!(await zonasDespachoCatalogo(db)).has(zonaId)) return null;
  const motivo = await motivoServicio(db, conductorId);
  if (motivo === 'habilitado') return null;
  // NXT-6y: «otro servicio» cuenta solo si el catálogo lo deja de verdad, con la misma regla
  // (bloqueos incluidos): un bloqueo general saca de todos los servicios.
  const { servicios } = await estadoDelConductor(db, conductorId, false, Number.MAX_SAFE_INTEGER);
  for (const s of servicios)
    if (s.servicioId !== 'comida' && s.puedeActivar && s.preferencia)
      if ((await motivoServicio(db, conductorId, s.servicioId)) === 'habilitado') return motivo;
  throw errorSinComida(motivo);
}

export function errorSinComida(motivo: MotivoSinComida): ErrorDatos {
  switch (motivo) {
    case 'pendiente_aprobacion':
      return new ErrorDatos(
        'Tu activación para repartir Comida está en revisión. Te avisamos cuando esté lista.',
        'servicios',
        409,
      );
    case 'requisitos_faltantes':
      return new ErrorDatos(
        'Para repartir Comida te faltan papeles por aprobar (identidad, licencia o seguro). Revísalos en «Mis datos y vehículo».',
        'servicios',
        409,
      );
    case 'vehiculo_incompatible':
      return new ErrorDatos(
        'Tu vehículo todavía no está aprobado para repartir Comida. Revísalo en «Mis datos y vehículo».',
        'servicios',
        409,
      );
    case 'preferencia_apagada':
      return new ErrorDatos(
        'Tienes Comida apagado en tus servicios. Enciéndelo para recibir pedidos.',
        'servicios',
        409,
      );
    case 'bloqueado':
      return new ErrorDatos(
        'Tu cuenta está en pausa para repartir Comida. Escríbenos desde Ayuda y lo revisamos.',
        'servicios',
        409,
      );
    case 'proximamente':
    case 'en_pausa':
    case 'no_disponible_zona':
      return new ErrorDatos(
        'Comida no está disponible en tu zona en este momento.',
        'servicios',
        409,
      );
    default:
      return new ErrorDatos(
        'Tu cuenta todavía no está activada para repartir Comida. Escríbenos desde Ayuda y la revisamos.',
        'servicios',
        409,
      );
  }
}
