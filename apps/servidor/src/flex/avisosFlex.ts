import type { Env } from '../env';
import { notificar, type Aviso } from '../notificaciones';
import type { Ctx } from './autorizacion';

/**
 * Divoox Flex · Fase 3: avisos al celular (C-FLEX-AVISOS).
 *
 * - Idempotentes: cada aviso tiene una clave única (`flex_avisos`); repetir la petición, que el
 *   reloj pase dos veces o que dos aislados corran a la vez NO manda el aviso dos veces.
 * - Sin datos personales: nunca nombre, teléfono ni dirección del destinatario. Solo el nombre de
 *   la ruta (que pone la propia empresa) y cuántas paradas tiene.
 * - En el idioma de cada persona. Un fallo del aviso nunca deshace ni frena la operación.
 */

export type TipoAvisoConductor =
  | 'oferta'
  | 'asignacion'
  | 'oferta_por_vencer'
  | 'oferta_retirada'
  | 'ruta_cancelada'
  | 'reintento_autorizado';

export type TipoAvisoEmpresa =
  | 'ruta_aceptada'
  | 'ruta_rechazada'
  | 'oferta_vencida'
  | 'ruta_iniciada'
  | 'incidencia'
  | 'entregas_terminadas'
  | 'devolucion_pedida'
  | 'ruta_cerrada';

type Datos = { nombre: string; paradas: number };

const nombreDe = (d: Datos, i: string) =>
  d.nombre.trim() ? `«${d.nombre.trim().slice(0, 60)}»` : i === 'en' ? 'your route' : 'tu ruta';

export const TEXTOS_AVISO_CONDUCTOR: Record<TipoAvisoConductor, (i: string, d: Datos) => Aviso> = {
  oferta: (i, d) =>
    i === 'en'
      ? {
          titulo: 'New route offer',
          cuerpo: `A company is offering you a route with ${d.paradas} stops. Review it in My route.`,
        }
      : {
          titulo: 'Nueva oferta de ruta',
          cuerpo: `Una empresa te ofrece una ruta de ${d.paradas} paradas. Revísala en Mi ruta.`,
        },
  asignacion: (i, d) =>
    i === 'en'
      ? {
          titulo: 'You have a new route',
          cuerpo: `A route with ${d.paradas} stops was assigned to you. Open My route to accept it.`,
        }
      : {
          titulo: 'Tienes una ruta nueva',
          cuerpo: `Te asignaron una ruta de ${d.paradas} paradas. Abre Mi ruta para aceptarla.`,
        },
  oferta_por_vencer: (i) =>
    i === 'en'
      ? { titulo: 'Your route offer expires soon', cuerpo: 'Accept or decline it in My route.' }
      : {
          titulo: 'Tu oferta de ruta está por vencer',
          cuerpo: 'Acéptala o recházala en Mi ruta.',
        },
  oferta_retirada: (i) =>
    i === 'en'
      ? {
          titulo: 'Route offer no longer available',
          cuerpo: 'The company withdrew the offer or it expired.',
        }
      : {
          titulo: 'La oferta de ruta ya no está disponible',
          cuerpo: 'La empresa retiró la oferta o se venció.',
        },
  ruta_cancelada: (i) =>
    i === 'en'
      ? { titulo: 'Route canceled', cuerpo: 'The company canceled your route. You’re free.' }
      : { titulo: 'Ruta cancelada', cuerpo: 'La empresa canceló tu ruta. Quedas libre.' },
  reintento_autorizado: (i) =>
    i === 'en'
      ? {
          titulo: 'Retry authorized',
          cuerpo: 'The company authorized you to retry a delivery on your route.',
        }
      : {
          titulo: 'Reintento autorizado',
          cuerpo: 'La empresa autorizó reintentar una entrega de tu ruta.',
        },
};

export const TEXTOS_AVISO_EMPRESA: Record<TipoAvisoEmpresa, (i: string, d: Datos) => Aviso> = {
  ruta_aceptada: (i, d) =>
    i === 'en'
      ? { titulo: 'Route accepted', cuerpo: `The driver accepted ${nombreDe(d, i)}.` }
      : { titulo: 'Ruta aceptada', cuerpo: `El conductor aceptó ${nombreDe(d, i)}.` },
  ruta_rechazada: (i, d) =>
    i === 'en'
      ? {
          titulo: 'Route declined',
          cuerpo: `The driver declined ${nombreDe(d, i)}. Assign it again.`,
        }
      : {
          titulo: 'Ruta rechazada',
          cuerpo: `El conductor rechazó ${nombreDe(d, i)}. Vuelve a asignarla.`,
        },
  oferta_vencida: (i, d) =>
    i === 'en'
      ? {
          titulo: 'Route offer expired',
          cuerpo: `Nobody accepted ${nombreDe(d, i)} in time. It’s back in draft.`,
        }
      : {
          titulo: 'Oferta de ruta vencida',
          cuerpo: `Nadie aceptó ${nombreDe(d, i)} a tiempo. Volvió a borrador.`,
        },
  ruta_iniciada: (i, d) =>
    i === 'en'
      ? { titulo: 'Route on its way', cuerpo: `${nombreDe(d, i)} left the hub.` }
      : { titulo: 'Ruta en camino', cuerpo: `${nombreDe(d, i)} salió del centro.` },
  incidencia: (i, d) =>
    i === 'en'
      ? {
          titulo: 'Delivery exception',
          cuerpo: `A delivery on ${nombreDe(d, i)} couldn’t be completed.`,
        }
      : {
          titulo: 'Incidencia en una entrega',
          cuerpo: `Una entrega de ${nombreDe(d, i)} no se pudo completar.`,
        },
  entregas_terminadas: (i, d) =>
    i === 'en'
      ? { titulo: 'Deliveries finished', cuerpo: `${nombreDe(d, i)} finished all its stops.` }
      : { titulo: 'Entregas terminadas', cuerpo: `${nombreDe(d, i)} terminó todas sus paradas.` },
  devolucion_pedida: (i, d) =>
    i === 'en'
      ? {
          titulo: 'Returns on the way',
          cuerpo: `The driver of ${nombreDe(d, i)} is bringing packages back to the hub.`,
        }
      : {
          titulo: 'Devolución en camino',
          cuerpo: `El conductor de ${nombreDe(d, i)} vuelve al centro con paquetes.`,
        },
  ruta_cerrada: (i, d) =>
    i === 'en'
      ? { titulo: 'Route closed', cuerpo: `${nombreDe(d, i)} was closed.` }
      : { titulo: 'Ruta cerrada', cuerpo: `${nombreDe(d, i)} se cerró.` },
};

/** Quién de la empresa recibe los avisos: dueño, operaciones y operadores activos. */
const ROLES_AVISO = "('dueno', 'operaciones', 'operador')";

async function datosRuta(db: D1Database, rutaId: string) {
  return db
    .prepare(
      `SELECT r.id, r.empresa_id, r.conductor_id, r.nombre,
         (SELECT COUNT(*) FROM ruta_paradas WHERE ruta_id = r.id) AS paradas
       FROM rutas_flex r WHERE r.id = ?`,
    )
    .bind(rutaId)
    .first<{
      id: string;
      empresa_id: string;
      conductor_id: string | null;
      nombre: string;
      paradas: number;
    }>();
}

async function mandar(
  env: Env,
  db: D1Database,
  usuarios: string[],
  clave: string,
  tipo: string,
  rutaId: string,
  texto: (i: string) => Aviso,
): Promise<number> {
  if (!usuarios.length) return 0;
  const { results } = await db
    .prepare(`SELECT id, idioma FROM usuarios WHERE id IN (SELECT value FROM json_each(?))`)
    .bind(JSON.stringify(usuarios))
    .all<{ id: string; idioma: string }>();
  let enviados = 0;
  for (const u of results) {
    // Primero se reserva la clave: si ya existía, este aviso ya salió (o está saliendo).
    const r = await db
      .prepare(
        'INSERT OR IGNORE INTO flex_avisos (clave, usuario_id, tipo, ruta_id) VALUES (?, ?, ?, ?)',
      )
      .bind(`${clave}:${u.id}`, u.id, tipo, rutaId)
      .run();
    if (!r.meta.changes) continue;
    const aviso = texto(u.idioma);
    await notificar(env, db, u.id, {
      ...aviso,
      datos: { tipo: 'flex', evento: tipo, rutaId },
    });
    enviados++;
  }
  return enviados;
}

/** Aviso al conductor de la ruta (o a `conductorId` si ya no está en la ruta, p. ej. retirada). */
export async function avisarConductor(
  env: Env,
  db: D1Database,
  p: { tipo: TipoAvisoConductor; rutaId: string; ocasion: string; conductorId?: string | null },
): Promise<number> {
  const r = await datosRuta(db, p.rutaId);
  const conductor = p.conductorId ?? r?.conductor_id;
  if (!r || !conductor) return 0;
  const d = { nombre: r.nombre, paradas: Number(r.paradas) };
  return mandar(env, db, [conductor], `c:${p.tipo}:${p.rutaId}:${p.ocasion}`, p.tipo, r.id, (i) =>
    TEXTOS_AVISO_CONDUCTOR[p.tipo](i, d),
  );
}

/** Aviso a las personas de la empresa dueña de la ruta. */
export async function avisarEmpresa(
  env: Env,
  db: D1Database,
  p: { tipo: TipoAvisoEmpresa; rutaId: string; ocasion: string },
): Promise<number> {
  const r = await datosRuta(db, p.rutaId);
  if (!r) return 0;
  const { results } = await db
    .prepare(
      `SELECT usuario_id FROM empresa_miembros WHERE empresa_id = ? AND estado = 'activo' AND rol IN ${ROLES_AVISO}`,
    )
    .bind(r.empresa_id)
    .all<{ usuario_id: string }>();
  const d = { nombre: r.nombre, paradas: Number(r.paradas) };
  return mandar(
    env,
    db,
    results.map((x) => x.usuario_id),
    `e:${p.tipo}:${p.rutaId}:${p.ocasion}`,
    p.tipo,
    r.id,
    (i) => TEXTOS_AVISO_EMPRESA[p.tipo](i, d),
  );
}

/**
 * Trabajo para después de responder: en Cloudflare va con waitUntil (no demora la respuesta);
 * donde no hay contexto de ejecución (pruebas), se espera aquí mismo. Nunca rompe la operación.
 */
export async function despues(c: Ctx, trabajo: () => Promise<unknown>): Promise<void> {
  const seguro = () =>
    trabajo().catch((e: unknown) => console.error('flex: tarea posterior falló', e));
  const ctx = ((): { waitUntil: (p: Promise<unknown>) => void } | null => {
    try {
      return c.executionCtx;
    } catch {
      return null;
    }
  })();
  if (ctx) ctx.waitUntil(seguro());
  else await seguro();
}
