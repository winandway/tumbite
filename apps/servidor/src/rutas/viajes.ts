import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { aceptarOperacion, cambiarEstadoViaje, liberarViaje } from '../operaciones';
import { RADIO_LLEGADA_M, llego } from '@tumbite/compartido';

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

function claveDe(c: Ctx, accion: string, operacionId: string): string {
  const k = c.req.header('idempotency-key') ?? '';
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(k))
    throw new ErrorDatos('Falta la clave de la solicitud. Actualiza la app.', undefined, 400);
  return `${accion}:${operacionId}:${k}`;
}

/** La operación tiene que ser de este conductor (sin revelar si existe para otros). */
async function miOperacion(c: Ctx, id: string, conductorId: string) {
  const f = await base(c)
    .prepare(
      `SELECT o.id, o.estado_general, v.estado, v.pin_recogida, v.intentos_pin, v.origen_lat, v.origen_lng,
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
      intentos_pin: number;
      origen_lat: number;
      origen_lng: number;
      espera_s: number | null;
      tarifa_json: string | null;
    }>();
  if (!f) throw new ErrorDatos('Este viaje ya no está asignado a ti.', undefined, 404);
  return f;
}

viajes.get('/conductor/operaciones/ofertas', async (c) => {
  const u = exigir(c, 'repartidor');
  const { results } = await base(c)
    .prepare(
      `SELECT f.operacion_id, f.vehiculo_id, f.ganancia_centavos, f.expira_en, o.servicio_id,
              v.origen_direccion, v.destino_direccion, v.pasajeros
         FROM ofertas_operacion f JOIN operaciones o ON o.id = f.operacion_id
         JOIN viajes v ON v.operacion_id = o.id
        WHERE f.conductor_id = ? AND f.estado = 'ofrecida' AND f.expira_en > datetime('now')
          AND o.estado_general = 'buscando'`,
    )
    .bind(u.id)
    .all<Record<string, unknown>>();
  return c.json({
    ofertas: results.map((f) => ({
      operacionId: String(f.operacion_id),
      vehiculoId: String(f.vehiculo_id),
      servicioId: String(f.servicio_id),
      gananciaCentavos: Number(f.ganancia_centavos),
      expiraEn: String(f.expira_en),
      origen: String(f.origen_direccion),
      destino: String(f.destino_direccion),
      pasajeros: Number(f.pasajeros),
    })),
  });
});

viajes.get('/conductor/operaciones/actual', async (c) => {
  const u = exigir(c, 'repartidor');
  const f = await base(c)
    .prepare(
      `SELECT o.id, o.servicio_id, o.version, v.estado, v.origen_direccion, v.destino_direccion,
              v.origen_lat, v.origen_lng, v.destino_lat, v.destino_lng, v.pasajeros
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
        WHERE o.conductor_id = ? AND o.estado_general IN ('asignada', 'en_curso')`,
    )
    .bind(u.id)
    .first<Record<string, unknown>>();
  return c.json({ operacion: f ?? null });
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
  const r = await aceptarOperacion(base(c), {
    operacionId: id,
    conductorId: u.id,
    vehiculoId: oferta.vehiculo_id,
    clave,
  });
  if (r.resultado === 'tomada' || r.resultado === 'ya_es_tuya')
    return c.json({ ok: true, operacionId: r.operacionId, version: r.version });
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
  return c.json({ ok: true });
});

viajes.post('/conductor/operaciones/:id/liberar', async (c) => {
  const u = exigir(c, 'repartidor');
  const id = c.req.param('id');
  const clave = claveDe(c, 'liberar', id);
  const { motivo } = await leerCuerpo(c, z.object({ motivo: z.string().max(200).default('') }));
  const ok = await liberarViaje(base(c), { operacionId: id, conductorId: u.id, motivo, clave });
  if (!ok) {
    // Reintento de una liberación que ya se hizo: la misma respuesta.
    const hecho = await base(c)
      .prepare('SELECT 1 FROM eventos_operacion WHERE idempotencia = ?')
      .bind(clave)
      .first();
    if (hecho) return c.json({ ok: true });
    throw new ErrorDatos('Este viaje ya no se puede soltar.', undefined, 409);
  }
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
    if (nombre === 'iniciar') {
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
    return c.json({ ok: true, estado: paso.hacia });
  },
);
