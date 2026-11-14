import {
  type PaqueteEnvio,
  VIAJE_PROGRAMADO,
  telefonoCanonico,
  validarHoraViajeProgramado,
} from '@tumbite/compartido';
import type { Env } from './env';
import { crearStripe } from './stripe';
import { ErrorDatos } from './validar';

/**
 * Nacimiento de un viaje (o envío) desde su cotización: la operación, el viaje y, en Envíos, el
 * paquete, en un solo lote. Lo usan «pedir ya» (rutas/viajesPasajero.ts) y el reloj cuando llega la
 * hora de un viaje programado (C-VIAJE-PROGRAMADO). La cotización ya apunta a la operación: el
 * precio es el de la cotización, siempre.
 */
export const ESTADOS_ACTIVOS = "('pago_pendiente', 'buscando', 'asignada', 'en_curso')";

/** El código de 4 dígitos que el pasajero le dice al conductor para empezar. */
export function pinNuevo(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return String(n % 10_000).padStart(4, '0');
}

const ESTADO_GENERAL = new Map([
  ['buscando', 'buscando'],
  ['pago_pendiente', 'pago_pendiente'],
  ['cancelado', 'cancelada'],
]);

/** «2026-11-14T15:30:00.000Z» → «2026-11-14 15:30:00» (el formato de datetime() de SQLite). */
export const fechaSql = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

export type NuevoViaje = {
  op: string;
  cotizacionId: string;
  clienteId: string;
  tipo: 'viaje_pasajero' | 'envio_paquete';
  estado: 'buscando' | 'pago_pendiente' | 'cancelado';
  metodoPago: string;
  paquete: PaqueteEnvio | null;
  pinEntrega: string;
  /**
   * «Pedir ya»: marca la cotización usada y exige que no haya otro viaje activo del mismo tipo.
   * Programado: la cotización ya quedó apartada al reservar (no se vuelve a marcar).
   */
  exigirSinActivo: boolean;
  programadoPara?: string | null;
};

/** Devuelve true si el viaje nació en este lote (false: la cotización ya no servía). */
export async function crearViajeDeCotizacion(db: D1Database, v: NuevoViaje): Promise<boolean> {
  const general = ESTADO_GENERAL.get(v.estado) ?? v.estado;
  const r = await db.batch([
    ...(v.exigirSinActivo
      ? [
          db
            .prepare(
              `UPDATE cotizaciones_viaje SET usada_en = datetime('now'), operacion_id = ?1
                WHERE id = ?2 AND cliente_id = ?3 AND usada_en IS NULL AND vence_en > datetime('now')
                  AND NOT EXISTS (SELECT 1 FROM operaciones o WHERE o.cliente_id = ?3
                                   AND o.tipo_operacion = ?4 AND o.estado_general IN ${ESTADOS_ACTIVOS})`,
            )
            .bind(v.op, v.cotizacionId, v.clienteId, v.tipo),
        ]
      : []),
    db
      .prepare(
        `INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, zona_id, estado_general, ultima_clave)
         SELECT ?1, servicio_id, ?5, cliente_id, zona_id, ?4, ?3
           FROM cotizaciones_viaje WHERE id = ?2 AND operacion_id = ?1
            AND NOT EXISTS (SELECT 1 FROM operaciones WHERE id = ?1)`,
      )
      .bind(v.op, v.cotizacionId, `pedir:${v.cotizacionId}`, general, v.tipo),
    db
      .prepare(
        `INSERT INTO viajes (operacion_id, estado, ultimo_actor, ultimo_actor_id, ultima_clave,
           origen_lat, origen_lng, origen_direccion, destino_lat, destino_lng, destino_direccion,
           pasajeros, pin_recogida, metodo_pago, cotizacion_id, categoria, programado_para)
         SELECT ?1, ?6, 'cliente', cliente_id, ?3, origen_lat, origen_lng, origen_direccion,
                destino_lat, destino_lng, destino_direccion, 1, ?4, ?5, id, categoria, ?7
           FROM cotizaciones_viaje WHERE id = ?2 AND operacion_id = ?1
            AND NOT EXISTS (SELECT 1 FROM viajes WHERE operacion_id = ?1)`,
      )
      .bind(
        v.op,
        v.cotizacionId,
        `pedir:${v.cotizacionId}`,
        pinNuevo(),
        v.metodoPago,
        v.estado,
        v.programadoPara ?? null,
      ),
    ...(v.tipo === 'envio_paquete' && v.paquete
      ? [
          db
            .prepare(
              `INSERT OR IGNORE INTO envios_persona (operacion_id, descripcion, valor_declarado, destinatario_nombre, destinatario_telefono, pin_entrega, tamano)
               SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM operaciones WHERE id = ?)`,
            )
            .bind(
              v.op,
              v.paquete.descripcion,
              v.paquete.valorDeclarado,
              v.paquete.destinatario.nombre,
              telefonoCanonico(v.paquete.destinatario.telefono),
              v.pinEntrega,
              v.paquete.tamano ?? 'pequeno',
              v.op,
            ),
        ]
      : []),
  ]);
  return Boolean(r[0]?.meta.changes);
}

/** La tarjeta guardada de la persona (la de su último pago con tarjeta), o null. */
export async function tarjetaGuardada(env: Env, db: D1Database, clienteId: string) {
  const stripe = crearStripe(env.STRIPE_SECRET_KEY);
  if (!stripe) return null;
  const u = await db
    .prepare('SELECT stripe_cliente FROM usuarios WHERE id = ?')
    .bind(clienteId)
    .first<{ stripe_cliente: string | null }>();
  if (!u?.stripe_cliente) return null;
  const lista = await stripe.get<{ data?: { id: string }[] }>(
    `/customers/${u.stripe_cliente}/payment_methods`,
    { type: 'card', limit: 1 },
  );
  const pm = lista.data?.[0]?.id;
  return pm ? { cliente: u.stripe_cliente, pm } : null;
}

export type Programar = {
  op: string;
  cotizacionId: string;
  servicioId: string;
  zonaId: string;
  metodoPago: string;
  paquete: PaqueteEnvio | null;
  programadoPara: Date;
};

/**
 * C-VIAJE-PROGRAMADO: reservar. La cotización queda apartada para la operación que nacerá (precio
 * fijo) y la reserva espera en viajes_programados. Repetir la misma reserva devuelve la misma.
 */
export async function programarViaje(env: Env, db: D1Database, u: { id: string }, p: Programar) {
  const v = validarHoraViajeProgramado(p.programadoPara);
  if (v !== 'ok')
    throw new ErrorDatos(
      v === 'pronto'
        ? 'Elige una hora de al menos 30 minutos desde ahora.'
        : 'Se puede reservar hasta 7 días adelante.',
      'programadoPara',
      422,
    );
  const pendientes = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM viajes_programados WHERE cliente_id = ? AND estado = 'programado'",
    )
    .bind(u.id)
    .first<{ n: number }>();
  if (Number(pendientes?.n ?? 0) >= VIAJE_PROGRAMADO.maxPendientes)
    throw new ErrorDatos(
      'Puedes tener hasta 5 viajes programados a la vez.',
      'programadoPara',
      409,
    );
  // Con tarjeta se cobra a la hora con la tarjeta guardada (como Uber): sin una, no se reserva.
  let ref: string | null = null;
  if (p.metodoPago === 'tarjeta') {
    const t = await tarjetaGuardada(env, db, u.id);
    if (!t)
      throw new ErrorDatos(
        'Para reservar con tarjeta, primero paga un viaje con tarjeta en la app (queda guardada).',
        'metodoPago',
        409,
      );
    ref = t.pm;
  }
  const hora = fechaSql(p.programadoPara);
  const r = await db.batch([
    db
      .prepare(
        `UPDATE cotizaciones_viaje SET usada_en = datetime('now'), operacion_id = ?1
          WHERE id = ?2 AND cliente_id = ?3 AND usada_en IS NULL AND vence_en > datetime('now')`,
      )
      .bind(p.op, p.cotizacionId, u.id),
    db
      .prepare(
        `INSERT INTO viajes_programados (id, cliente_id, cotizacion_id, servicio_id, zona_id, programado_para,
           metodo_pago, metodo_pago_ref, paquete_json)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
          WHERE EXISTS (SELECT 1 FROM cotizaciones_viaje WHERE id = ?3 AND operacion_id = ?1)`,
      )
      .bind(
        p.op,
        u.id,
        p.cotizacionId,
        p.servicioId,
        p.zonaId,
        hora,
        p.metodoPago,
        ref,
        p.paquete ? JSON.stringify(p.paquete) : null,
      ),
  ]);
  if (!r[0]?.meta.changes) {
    const otra = await db
      .prepare('SELECT operacion_id FROM cotizaciones_viaje WHERE id = ? AND usada_en IS NOT NULL')
      .bind(p.cotizacionId)
      .first<{ operacion_id: string }>();
    if (otra) return { viaje: { id: otra.operacion_id }, programado: true };
    throw new ErrorDatos('El precio venció. Vuelve a cotizar el viaje.', 'cotizacionId', 409);
  }
  return {
    viaje: { id: p.op, programadoPara: p.programadoPara.toISOString() },
    programado: true,
  };
}
