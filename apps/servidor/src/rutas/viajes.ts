import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { revisarSelfieCasco } from './ajustesViaje';
import { avisarContactos, revisarHorasAlVolante } from './seguridadViaje';
import { nuevoId } from '../cripto';
import { calificarViaje, esquemaCalificacionViaje, registrarEmergencia } from './viajesPasajero';
import {
  cobrarReservaViaje,
  devolverReservaViaje,
  reservarComisionViaje,
} from '../finanzas/conductor';
import { cargoEspera, esquemaTarifaViaje } from '@tumbite/compartido';
import {
  aceptarOperacion,
  cambiarEstadoViaje,
  liberarViaje,
  repartirOperaciones,
} from '../operaciones';
import { RADIO_LLEGADA_M, llego, metrosEntre } from '@tumbite/compartido';
import { capturarCobroViaje, soltarCobroViaje } from '../viajesCobro';

/**
 * C-VIAJE-PASOS-REALES (28 oct 2026, encontrado con REA): sin estas reglas un conductor podía
 * marcar «Llegué» desde cualquier lugar, «No se presentó» al segundo de llegar y probar códigos
 * sin límite, y cobrar sin haber ido. Igual que Namma Yatri: radio de llegada con ubicación
 * reciente, espera gratis cumplida y tope de intentos del código.
 */
export const INTENTOS_PIN_MAXIMOS = 5;
/** Espera gratis si el viaje no trae tarifa (los viajes de antes de las cotizaciones). */
export const ESPERA_GRATIS_S_POR_DEFECTO = 300;
const MINUTOS_UBICACION_LLEGADA = 2;

/**
 * Fase 3 · Lo que el conductor hace con una operación de otro servicio (Moto, Carro…). Todas las
 * reglas viven en la base (operaciones.ts y schema.sql): aquí solo se traduce la respuesta.
 * Moto y Carro siguen APAGADOS: ninguna ruta pública crea operaciones, así que en producción
 * estas rutas responden con listas vacías y «no disponible».
 *
 * Cada acción lleva la cabecera «idempotency-key» (la misma si la app reintenta): un doble toque o
 * una respuesta perdida no repiten nada.
 */
export const viajes = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * La clave lleva también al conductor (28 oct 2026): dos conductores que mandaran la misma clave
 * para el mismo viaje chocaban en la base (500). El reintento del MISMO conductor sigue igual.
 */
function claveDe(c: Ctx, accion: string, operacionId: string): string {
  const k = c.req.header('idempotency-key') ?? '';
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(k))
    throw new ErrorDatos('Falta la clave de la solicitud. Actualiza la app.', undefined, 400);
  return `${accion}:${operacionId}:${c.get('usuario')?.id ?? ''}:${k}`;
}

/** La operación tiene que ser de este conductor (sin revelar si existe para otros). */
async function miOperacion(c: Ctx, id: string, conductorId: string) {
  const f = await base(c)
    .prepare(
      `SELECT o.id, o.estado_general, v.estado, v.pin_recogida, v.pin_requerido, v.intentos_pin, v.origen_lat, v.origen_lng,
              CAST((julianday('now') - julianday(v.llego_en)) * 86400 AS INTEGER) AS espera_s,
              (SELECT q.tarifa_json FROM cotizaciones_viaje q WHERE q.operacion_id = o.id) AS tarifa_json
         FROM operaciones o
         JOIN viajes v ON v.operacion_id = o.id WHERE o.id = ? AND o.conductor_id = ?`,
    )
    .bind(id, conductorId)
    .first<{
      id: string;
      estado_general: string;
      estado: string;
      pin_recogida: string;
      pin_requerido: number;
      intentos_pin: number;
      origen_lat: number;
      origen_lng: number;
      espera_s: number | null;
      tarifa_json: string | null;
    }>();
  if (!f) throw new ErrorDatos('Este viaje ya no está asignado a ti.', undefined, 404);
  return f;
}

/**
 * M3 (C-OFERTA-COMPLETA): lo que el conductor ve ANTES de aceptar, como en Uber Moto: cuánto gana,
 * qué tan lejos está la recogida, a dónde va el viaje, cuánto dura y cómo paga el pasajero.
 */
viajes.get('/conductor/operaciones/ofertas', async (c) => {
  const u = exigir(c, 'repartidor');
  const { results } = await base(c)
    .prepare(
      `SELECT f.operacion_id, f.vehiculo_id, f.ganancia_centavos, f.expira_en, o.servicio_id,
              v.origen_direccion, v.destino_direccion, v.origen_lat, v.origen_lng, v.destino_lat,
              v.destino_lng, v.pasajeros, v.metodo_pago, q.distancia_m, q.duracion_s, q.moneda,
              d.lat AS yo_lat, d.lng AS yo_lng
         FROM ofertas_operacion f JOIN operaciones o ON o.id = f.operacion_id
         JOIN viajes v ON v.operacion_id = o.id
         LEFT JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id
         LEFT JOIN repartidores d ON d.usuario_id = f.conductor_id
        WHERE f.conductor_id = ? AND f.estado = 'ofrecida' AND f.expira_en > datetime('now')
          AND o.estado_general = 'buscando'`,
    )
    .bind(u.id)
    .all<Record<string, unknown>>();
  return c.json({
    ofertas: results.map((f) => {
      const origen = { lat: Number(f.origen_lat), lng: Number(f.origen_lng) };
      const yo =
        f.yo_lat != null && f.yo_lng != null
          ? { lat: Number(f.yo_lat), lng: Number(f.yo_lng) }
          : null;
      return {
        operacionId: String(f.operacion_id),
        vehiculoId: String(f.vehiculo_id),
        servicioId: String(f.servicio_id),
        gananciaCentavos: Number(f.ganancia_centavos),
        moneda: f.moneda == null ? null : String(f.moneda),
        expiraEn: String(f.expira_en),
        origen: String(f.origen_direccion),
        destino: String(f.destino_direccion),
        origenPunto: origen,
        destinoPunto: { lat: Number(f.destino_lat), lng: Number(f.destino_lng) },
        recogidaM: yo ? metrosEntre(yo, origen) : null,
        viajeM: f.distancia_m == null ? null : Number(f.distancia_m),
        viajeS: f.duracion_s == null ? null : Number(f.duracion_s),
        metodoPago: String(f.metodo_pago ?? 'efectivo'),
        pasajeros: Number(f.pasajeros),
      };
    }),
  });
});

/**
 * El viaje en curso del conductor, con lo que necesita la pantalla (M4): a quién recoge, cuánto
 * cobra en mano, desde cuándo espera y cuánto dura la espera gratis de SU tarifa.
 */
viajes.get('/conductor/operaciones/actual', async (c) => {
  const u = exigir(c, 'repartidor');
  const f = await base(c)
    .prepare(
      `SELECT o.id, o.servicio_id, o.version, v.estado, v.origen_direccion, v.destino_direccion,
              v.origen_lat, v.origen_lng, v.destino_lat, v.destino_lng, v.pasajeros, v.metodo_pago,
              v.intentos_pin, v.pin_requerido, v.llego_en,
              CAST((julianday('now') - julianday(v.llego_en)) * 86400 AS INTEGER) AS segundos_esperando,
              q.total, q.moneda, json_extract(q.tarifa_json, '$.esperaGratisS') AS espera_gratis_s,
              p.nombre AS pasajero
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
         LEFT JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id
         LEFT JOIN usuarios p ON p.id = o.cliente_id
        WHERE o.conductor_id = ? AND o.estado_general IN ('asignada', 'en_curso')`,
    )
    .bind(u.id)
    .first<Record<string, unknown>>();
  if (!f) return c.json({ operacion: null });
  return c.json({
    operacion: {
      ...f,
      pasajero: String(f.pasajero ?? '').split(' ')[0] ?? '',
      espera_gratis_s:
        f.espera_gratis_s == null ? ESPERA_GRATIS_S_POR_DEFECTO : Number(f.espera_gratis_s),
      intentos_pin_quedan: Math.max(0, INTENTOS_PIN_MAXIMOS - Number(f.intentos_pin ?? 0)),
    },
  });
});

viajes.post('/conductor/operaciones/:id/aceptar', async (c) => {
  const u = exigir(c, 'repartidor');
  const id = c.req.param('id');
  const clave = claveDe(c, 'aceptar', id);
  const oferta = await base(c)
    .prepare(
      'SELECT vehiculo_id FROM ofertas_operacion WHERE operacion_id = ? AND conductor_id = ?',
    )
    .bind(id, u.id)
    .first<{ vehiculo_id: string }>();
  if (!oferta) throw new ErrorDatos('Esta oferta ya no está disponible.', undefined, 409);
  // C-VIAJE-SEGURIDAD-2: con 12 horas al volante en 24, primero descansa.
  await revisarHorasAlVolante(base(c), u.id);
  // C-MOTO-CIUDAD: donde la ciudad lo pide, la selfie con el casco puesto de las últimas 12 horas.
  await revisarSelfieCasco(base(c), u.id, id);
  // M7 (C-VIAJE-COMISION): si en ese mercado rige el prepago, la comisión prevista se aparta ANTES
  // de aceptar; si el saldo no alcanza, no se acepta.
  const info = await base(c)
    .prepare(
      `SELECT o.servicio_id, o.zona_id, z.pais, q.total, q.moneda FROM operaciones o
         JOIN zonas z ON z.id = o.zona_id
         JOIN viajes v ON v.operacion_id = o.id
         LEFT JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id WHERE o.id = ?`,
    )
    .bind(id)
    .first<{
      servicio_id: string;
      zona_id: string;
      pais: string;
      total: number | null;
      moneda: string | null;
    }>();
  if (info?.total != null && info.moneda) {
    const reserva = await reservarComisionViaje(base(c), {
      servicio: info.servicio_id === 'carro' ? 'car' : 'ride',
      pais: info.pais,
      ciudad: info.zona_id,
      moneda: info.moneda,
      operacionId: id,
      conductorId: u.id,
      valor: info.total,
    });
    if (!reserva.ok)
      throw new ErrorDatos(
        'Tu saldo prepago no alcanza para la comisión de este viaje. Recarga para aceptarlo.',
        undefined,
        409,
      );
  }
  const r = await aceptarOperacion(base(c), {
    operacionId: id,
    conductorId: u.id,
    vehiculoId: oferta.vehiculo_id,
    clave,
  });
  if (r.resultado === 'tomada' || r.resultado === 'ya_es_tuya')
    return c.json({ ok: true, operacionId: r.operacionId, version: r.version });
  // No se lo quedó: lo apartado vuelve al prepago.
  await devolverReservaViaje(base(c), id, u.id, 'no_aceptado');
  if (r.resultado === 'ocupado')
    throw new ErrorDatos('Termina tu entrega actual antes de aceptar otra.', undefined, 409);
  if (r.resultado === 'otro_conductor')
    throw new ErrorDatos('Otro conductor ya tomó este viaje.', undefined, 409);
  throw new ErrorDatos('Esta oferta ya no está disponible.', undefined, 409);
});

viajes.post('/conductor/operaciones/:id/rechazar', async (c) => {
  const u = exigir(c, 'repartidor');
  await base(c)
    .prepare(
      "UPDATE ofertas_operacion SET estado = 'rechazada', respondida_en = datetime('now') WHERE operacion_id = ? AND conductor_id = ? AND estado = 'ofrecida'",
    )
    .bind(c.req.param('id'), u.id)
    .run();
  // M3: si lo rechaza, el viaje pasa al siguiente conductor de una vez (no espera al reloj).
  await repartirOperaciones(c.env, base(c)).catch((e: unknown) =>
    console.error('viajes: despacho al rechazar', e),
  );
  return c.json({ ok: true });
});

viajes.post('/conductor/operaciones/:id/liberar', async (c) => {
  const u = exigir(c, 'repartidor');
  const id = c.req.param('id');
  const clave = claveDe(c, 'liberar', id);
  const { motivo } = await leerCuerpo(c, z.object({ motivo: z.string().max(200).default('') }));
  const ok = await liberarViaje(base(c), { operacionId: id, conductorId: u.id, motivo, clave });
  if (ok) await devolverReservaViaje(base(c), id, u.id, 'soltado');
  if (!ok) {
    // Reintento de una liberación que ya se hizo: la misma respuesta.
    const hecho = await base(c)
      .prepare('SELECT 1 FROM eventos_operacion WHERE idempotencia = ?')
      .bind(clave)
      .first();
    if (hecho) return c.json({ ok: true });
    throw new ErrorDatos('Este viaje ya no se puede soltar.', undefined, 409);
  }
  await repartirOperaciones(c.env, base(c)).catch((e: unknown) =>
    console.error('viajes: despacho al soltar', e),
  );
  return c.json({ ok: true });
});

const PASOS = new Map([
  ['llegue', { desde: 'asignado', hacia: 'conductor_llego' }],
  ['iniciar', { desde: 'conductor_llego', hacia: 'en_curso' }],
  ['terminar', { desde: 'en_curso', hacia: 'terminado' }],
  ['no-se-presento', { desde: 'conductor_llego', hacia: 'no_show' }],
]);

viajes.post(
  '/conductor/operaciones/:id/:paso{llegue|iniciar|terminar|no-se-presento}',
  async (c) => {
    const u = exigir(c, 'repartidor');
    const id = c.req.param('id');
    const nombre = c.req.param('paso');
    const paso = PASOS.get(nombre);
    if (!paso)
      throw new ErrorDatos('Este paso ya no corresponde. Actualiza la pantalla.', undefined, 404);
    const clave = claveDe(c, nombre, id);
    const op = await miOperacion(c, id, u.id);
    const db = base(c);
    if (nombre === 'llegue' && op.estado === paso.desde) {
      const yo = await db
        .prepare(
          "SELECT lat, lng FROM repartidores WHERE usuario_id = ? AND lat IS NOT NULL AND ubicacion_en > datetime('now', ?)",
        )
        .bind(u.id, `-${MINUTOS_UBICACION_LLEGADA} minutes`)
        .first<{ lat: number; lng: number }>();
      if (!llego(yo ?? null, { lat: op.origen_lat, lng: op.origen_lng }, RADIO_LLEGADA_M))
        throw new ErrorDatos(
          'Todavía no estás en el punto de recogida. Acércate y vuelve a intentarlo.',
          undefined,
          409,
        );
    }
    if (nombre === 'no-se-presento' && op.estado === paso.desde) {
      let espera = ESPERA_GRATIS_S_POR_DEFECTO;
      try {
        const t = JSON.parse(op.tarifa_json ?? '{}') as { esperaGratisS?: unknown };
        if (typeof t.esperaGratisS === 'number') espera = t.esperaGratisS;
      } catch {
        console.error('viajes: copia de tarifa dañada en la cotización', id);
      }
      if ((op.espera_s ?? 0) < espera)
        throw new ErrorDatos(
          'Espera a tu pasajero hasta que termine el tiempo de espera gratis.',
          undefined,
          409,
        );
    }
    // C-MOTO-CIUDAD: en las ciudades (u horas) sin código, el viaje empieza sin pedirlo.
    if (nombre === 'iniciar' && op.pin_requerido) {
      const { pin } = await leerCuerpo(c, z.object({ pin: z.string().regex(/^\d{4}$/) }));
      if (op.estado === paso.desde) {
        if (op.intentos_pin >= INTENTOS_PIN_MAXIMOS)
          throw new ErrorDatos(
            'Demasiados intentos con el código. Llama a soporte desde la app.',
            'pin',
            429,
          );
        if (pin !== op.pin_recogida) {
          await db
            .prepare('UPDATE viajes SET intentos_pin = intentos_pin + 1 WHERE operacion_id = ?')
            .bind(id)
            .run();
          throw new ErrorDatos(
            'El código no coincide. Pídeselo otra vez a tu pasajero.',
            'pin',
            409,
          );
        }
      }
    }
    const ok = await cambiarEstadoViaje(db, {
      operacionId: id,
      desde: paso.desde,
      hacia: paso.hacia,
      actor: 'conductor',
      actorId: u.id,
      clave,
    });
    if (!ok) {
      if (op.estado === paso.hacia) return c.json({ ok: true, estado: op.estado }); // reintento
      throw new ErrorDatos('Este paso ya no corresponde. Actualiza la pantalla.', undefined, 409);
    }
    // C-VIAJE-SEGURIDAD-2: al empezar, los contactos de confianza reciben el viaje (nunca frena).
    if (nombre === 'iniciar')
      await avisarContactos(c, id).catch((e: unknown) =>
        console.error('viajes: aviso a contactos de confianza', e),
      );
    if (nombre === 'terminar') {
      const totalFinal = await cerrarCuentaViaje(c, id, u.id);
      // C-VIAJE-TARJETA: con tarjeta, se cobra al terminar (nunca más de lo autorizado).
      if (totalFinal != null) await capturarCobroViaje(c.env, db, id, u.id, totalFinal);
      return c.json({ ok: true, estado: paso.hacia, totalFinal });
    }
    if (nombre === 'no-se-presento') await devolverReservaViaje(db, id, u.id, 'no_se_presento');
    // M2: el pasajero que no se presentó debe el cargo de la tarifa copiada; en efectivo queda como
    // deuda para su próximo viaje (una sola por viaje).
    // C-VIAJE-TARJETA: con tarjeta, el cargo se cobra de la autorización en vez de quedar como deuda.
    const tarjeta = await db
      .prepare("SELECT 1 AS t FROM cobros_viaje WHERE operacion_id = ? AND estado = 'autorizado'")
      .bind(id)
      .first<{ t: number }>();
    if (nombre === 'no-se-presento' && tarjeta) {
      const q = await db
        .prepare(
          `SELECT json_extract(q.tarifa_json, '$.cargoNoSePresento') AS cargo FROM viajes v
             JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id WHERE v.operacion_id = ?`,
        )
        .bind(id)
        .first<{ cargo: number | null }>();
      await soltarCobroViaje(c.env, db, id, Number(q?.cargo ?? 0));
    } else if (nombre === 'no-se-presento')
      await db
        .prepare(
          `INSERT OR IGNORE INTO deudas_pasajero (id, cliente_id, operacion_id, motivo, monto, moneda, conductor_id)
           SELECT ?, o.cliente_id, o.id, 'no_se_presento', json_extract(q.tarifa_json, '$.cargoNoSePresento'), q.moneda, o.conductor_id
             FROM operaciones o JOIN cotizaciones_viaje q ON q.operacion_id = o.id
            WHERE o.id = ? AND json_extract(q.tarifa_json, '$.cargoNoSePresento') > 0`,
        )
        .bind(nuevoId(), id)
        .run();
    return c.json({ ok: true, estado: paso.hacia });
  },
);

/** M6: el conductor también tiene botón de emergencia durante su viaje. */
viajes.post('/conductor/operaciones/:id/emergencia', async (c) => {
  const u = exigir(c, 'repartidor');
  const id = c.req.param('id');
  await miOperacion(c, id, u.id);
  const d = await leerCuerpo(
    c,
    z.object({
      lat: z.number().min(-90).max(90).optional(),
      lng: z.number().min(-180).max(180).optional(),
    }),
  );
  return c.json(
    await registrarEmergencia(c, { operacionId: id, actorId: u.id, rol: 'conductor', ...d }),
  );
});

/**
 * M7: la cuenta final de un viaje terminado. Precio fijo + espera pasada la gratis (de la tarifa
 * copiada) + lo que el pasajero debía de viajes anteriores (se cobra ahora y queda saldado), y la
 * comisión apartada pasa a Divoox. Todo idempotente: repetir «terminar» no cobra dos veces.
 */
async function cerrarCuentaViaje(c: Ctx, operacionId: string, conductorId: string) {
  const db = base(c);
  const f = await db
    .prepare(
      `SELECT o.cliente_id, v.total_final_centavos, q.total, q.moneda, q.tarifa_json,
              CAST((julianday(v.iniciado_en) - julianday(v.llego_en)) * 86400 AS INTEGER) AS espera_s
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
         LEFT JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id WHERE o.id = ?`,
    )
    .bind(operacionId)
    .first<{
      cliente_id: string;
      total_final_centavos: number | null;
      total: number | null;
      moneda: string | null;
      tarifa_json: string | null;
      espera_s: number | null;
    }>();
  await cobrarReservaViaje(db, operacionId, conductorId);
  if (!f || f.total == null) return null;
  if (f.total_final_centavos != null) return f.total_final_centavos;
  let espera = 0;
  try {
    espera = cargoEspera(
      esquemaTarifaViaje.parse(JSON.parse(f.tarifa_json ?? '{}')),
      f.espera_s ?? 0,
    );
  } catch {
    console.error('viajes: copia de tarifa dañada al cerrar', operacionId);
  }
  await db.batch([
    db
      .prepare(
        `UPDATE deudas_pasajero SET estado = 'cobrada', resuelta_en = datetime('now'), cobrada_en = ?
          WHERE cliente_id = ? AND estado = 'pendiente' AND moneda = ? AND operacion_id != ?`,
      )
      .bind(operacionId, f.cliente_id, f.moneda, operacionId),
    db
      .prepare(
        `UPDATE viajes SET total_final_centavos = ? + ? +
           (SELECT COALESCE(SUM(monto), 0) FROM deudas_pasajero WHERE cobrada_en = ?)
          WHERE operacion_id = ? AND total_final_centavos IS NULL`,
      )
      .bind(f.total, espera, operacionId, operacionId),
  ]);
  await pasarDeudasAlAfectado(db, operacionId, conductorId);
  const fin = await db
    .prepare('SELECT total_final_centavos FROM viajes WHERE operacion_id = ?')
    .bind(operacionId)
    .first<{ total_final_centavos: number | null }>();
  return fin?.total_final_centavos ?? null;
}

/**
 * C-CARGO-AL-AFECTADO (30 oct 2026), como Uber: el cargo de cancelación o de «no se presentó» es del
 * conductor al que le pasó. Si se cobra en un viaje siguiente, quien lo cobra (en efectivo lo tiene en
 * la mano; con tarjeta se le acredita entero) lo devuelve de sus ganancias y va al afectado. Una vez
 * por deuda.
 */
async function pasarDeudasAlAfectado(db: D1Database, operacionId: string, cobradorId: string) {
  const { results } = await db
    .prepare(
      `SELECT id, conductor_id, monto FROM deudas_pasajero
        WHERE cobrada_en = ? AND conductor_id IS NOT NULL AND conductor_id <> ?`,
    )
    .bind(operacionId, cobradorId)
    .all<{ id: string; conductor_id: string; monto: number }>();
  const mov = (usuario: string, monto: number, concepto: string, ref: string) =>
    db
      .prepare(
        `INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia)
         SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM movimientos WHERE referencia = ?)`,
      )
      .bind(nuevoId(), usuario, monto, concepto, ref, ref);
  for (const d of results)
    await db.batch([
      mov(d.conductor_id, d.monto, 'entrega', `deuda-viaje:${d.id}:afectado`),
      mov(cobradorId, -d.monto, 'ajuste', `deuda-viaje:${d.id}:cobrador`),
    ]);
}

/** M8: el conductor califica al pasajero al terminar. */
viajes.post('/conductor/operaciones/:id/calificar', async (c) => {
  const u = exigir(c, 'repartidor');
  const id = c.req.param('id');
  const f = await base(c)
    .prepare('SELECT 1 FROM operaciones WHERE id = ? AND conductor_id = ?')
    .bind(id, u.id)
    .first();
  if (!f) throw new ErrorDatos('Este viaje ya no está asignado a ti.', undefined, 404);
  const d = await leerCuerpo(c, esquemaCalificacionViaje);
  await calificarViaje(base(c), { operacionId: id, de: 'conductor', autorId: u.id, ...d });
  return c.json({ ok: true });
});
