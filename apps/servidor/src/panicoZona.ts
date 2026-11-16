import type { Env } from './env';
import { notificar } from './notificaciones';
import { zonaPara } from './rutas/zonas';
import { enviarSms, telefonoE164 } from './sms';

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
};

const ROL: Record<Panico['rol'], string> = {
  pasajero: 'el pasajero',
  conductor: 'el conductor',
  repartidor: 'el repartidor',
};

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

/** Avisa al responsable de la zona. Devuelve cuántos avisos salieron (SMS + celular). */
export async function avisarResponsableZona(env: Env, db: D1Database, p: Panico): Promise<number> {
  // Sin zona guardada (cuenta sin ficha completa), se usa la zona del lugar donde está.
  const zonaId =
    p.zonaId ??
    (p.lat != null && p.lng != null
      ? ((await zonaPara(db, p.lat, p.lng, false))?.id ?? null)
      : null);
  if (!zonaId) return 0;
  const z = await db
    .prepare('SELECT nombre, responsable_nombre, responsable_telefono FROM zonas WHERE id = ?')
    .bind(zonaId)
    .first<{ nombre: string; responsable_nombre: string; responsable_telefono: string }>()
    .catch((e: unknown) => {
      console.error('pánico: no se pudo leer la zona', String(e));
      return null;
    });
  const para = telefonoE164(z?.responsable_telefono);
  if (!z || !para) {
    console.error(`pánico: la zona ${zonaId} no tiene responsable con teléfono`);
    return 0;
  }
  const texto = textoPanico(p, z.nombre);
  let enviados = 0;
  if (
    await enviarSms(env, db, {
      usuarioId: p.usuarioId,
      pedidoId: null,
      tipo: TIPO_SMS_PANICO,
      telefono: para,
      texto,
    })
  )
    enviados++;
  // El aviso al celular, si el responsable tiene cuenta con ese mismo número.
  const ultimos = para.replace(/\D/g, '').slice(-8);
  const { results } = await db
    .prepare(
      "SELECT id, telefono FROM usuarios WHERE activo = 1 AND telefono LIKE ? AND telefono <> '' LIMIT 5",
    )
    .bind(`%${ultimos}`)
    .all<{ id: string; telefono: string }>()
    .catch(() => ({ results: [] as { id: string; telefono: string }[] }));
  for (const u of results)
    if (telefonoE164(u.telefono) === para) {
      const r = await notificar(env, db, u.id, (i) => ({
        titulo: i === 'es' ? `PÁNICO en ${z.nombre}` : `PANIC in ${z.nombre}`,
        cuerpo: texto,
        datos: { tipo: 'panico' },
      })).catch(() => ({ enviados: 0 }));
      enviados += r.enviados;
    }
  return enviados;
}
