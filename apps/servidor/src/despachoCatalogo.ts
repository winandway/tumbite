import { estadoDelConductor } from './rutas/servicios';
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
  const bloqueo = await db
    .prepare(
      `SELECT 1 FROM conductor_bloqueos WHERE conductor_id = ? AND levantado_en IS NULL
         AND (servicio_id IS NULL OR servicio_id = ?) AND (hasta IS NULL OR hasta > datetime('now'))`,
    )
    .bind(conductorId, servicioId)
    .first();
  if (bloqueo) return 'bloqueado';
  // La versión de la app no se sabe al repartir: aquí no frena (la app la exige al conectarse).
  const { servicios } = await estadoDelConductor(db, conductorId, false, Number.MAX_SAFE_INTEGER);
  const s = servicios.find((x) => x.servicioId === servicioId);
  if (!s) return 'no_disponible_zona';
  if (!s.puedeActivar) return s.motivo as MotivoSinComida;
  if (!s.preferencia) return 'preferencia_apagada';
  return 'habilitado';
}

/**
 * Deja solo a los habilitados, en el MISMO orden, y para en cuanto junta `cuantos` (no se revisa a
 * toda la zona por un pedido). `memo` guarda la respuesta de cada repartidor durante una vuelta.
 */
export async function filtrarPorCatalogo<T extends { id: string }>(
  db: D1Database,
  candidatos: T[],
  cuantos: number,
  memo: Map<string, boolean>,
): Promise<T[]> {
  const fuera: T[] = [];
  for (const c of candidatos) {
    if (fuera.length >= cuantos) break;
    let ok = memo.get(c.id);
    if (ok === undefined) {
      ok = (await motivoServicio(db, c.id)) === 'habilitado';
      memo.set(c.id, ok);
    }
    if (ok) fuera.push(c);
  }
  return fuera;
}

/** Al conectarse en una zona con el interruptor encendido: el porqué, en palabras, si no puede. */
export async function frenoAlConectar(db: D1Database, conductorId: string, zonaId: string) {
  if (!(await zonasDespachoCatalogo(db)).has(zonaId)) return;
  const motivo = await motivoServicio(db, conductorId);
  if (motivo === 'habilitado') return;
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
