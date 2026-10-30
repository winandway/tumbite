import { Hono } from 'hono';
import { z } from 'zod';
import {
  type CotizacionViaje,
  DISTANCIA_MAXIMA_KM,
  SERVICIOS_VIAJE,
  type TarifaViaje,
  VIGENCIA_COTIZACION_S,
  cargoCancelacionViaje,
  cotizarViaje,
  esquemaCotizarViaje,
  esquemaTarifaViaje,
  estimarRuta,
  numeroEmergencia,
} from '@tumbite/compartido';
import { avisoEmergenciaViaje } from '../avisos';
import type { Env } from '../env';
import { nuevoId, nuevoToken, sha256 } from '../cripto';
import { cambiarEstadoViaje, repartirOperaciones } from '../operaciones';
import { devolverReservasViaje } from '../finanzas/conductor';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { abrirCobroViaje, propinaViaje, soltarCobroViaje } from '../viajesCobro';
import { estadoServicioEnZona } from './servicios';
import { zonaPara } from './zonas';

/**
 * Divoox Moto · Fase M1 (docs/PLAN-MOTO-PASAJEROS.md): la tarifa por ciudad que guarda el
 * superadmin y la cotización con PRECIO FIJO del pasajero (C-VIAJE-PRECIO-FIJO). La cotización se
 * guarda en el servidor y vence a los 5 minutos: al pedir (M2) solo viaja su id, así el precio no
 * se puede alterar desde la app. Moto existe solo en el sitio de pruebas (C-MOTO-SOLO-PRUEBAS):
 * en producción el servicio no está implementado y la cotización responde «no disponible».
 */
export const viajesPasajero = new Hono<{ Bindings: Env; Variables: Variables }>();

type FilaTarifa = {
  id: string;
  servicio_id: string;
  zona_id: string;
  moneda: string;
  base: number;
  por_km: number;
  por_minuto: number;
  minimo: number;
  espera_gratis_s: number;
  por_minuto_espera: number;
  cancelacion_gratis_s: number;
  cargo_cancelacion: number;
  cargo_no_se_presento: number;
  tope_dinamico_pb: number;
  redondeo: number;
  cargo_fijo: number;
  factor_calle_pb: number;
  velocidad_kmh: number;
  de_prueba: number;
  activa: number;
  motivo: string;
  creada_por: string | null;
  creada_en: string;
  cerrada_en: string | null;
};

export function filaATarifa(f: FilaTarifa): TarifaViaje {
  return {
    base: f.base,
    porKm: f.por_km,
    porMinuto: f.por_minuto,
    minimo: f.minimo,
    esperaGratisS: f.espera_gratis_s,
    porMinutoEspera: f.por_minuto_espera,
    cancelacionGratisS: f.cancelacion_gratis_s,
    cargoCancelacion: f.cargo_cancelacion,
    cargoNoSePresento: f.cargo_no_se_presento,
    topeDinamicoPb: f.tope_dinamico_pb,
    redondeo: f.redondeo,
    cargoFijo: f.cargo_fijo,
    factorCallePb: f.factor_calle_pb,
    velocidadKmh: f.velocidad_kmh,
  };
}

function tarifaPublica(f: FilaTarifa) {
  return {
    id: f.id,
    servicio: f.servicio_id,
    zona: f.zona_id,
    moneda: f.moneda,
    ...filaATarifa(f),
    dePrueba: f.de_prueba === 1,
    activa: f.activa === 1,
    motivo: f.motivo,
    creadaPor: f.creada_por,
    creadaEn: f.creada_en,
    cerradaEn: f.cerrada_en,
  };
}

/** La tarifa activa de un servicio en una zona, o null. */
export async function tarifaActiva(
  db: D1Database,
  servicio: string,
  zona: string,
): Promise<FilaTarifa | null> {
  return db
    .prepare('SELECT * FROM tarifas_viaje WHERE servicio_id = ? AND zona_id = ? AND activa = 1')
    .bind(servicio, zona)
    .first<FilaTarifa>();
}

const sqlFecha = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

// ---------------------------------------------------------------- superadmin

viajesPasajero.get('/admin/viajes/tarifas', async (c) => {
  exigir(c, 'admin');
  const q = z
    .object({ servicio: z.enum(SERVICIOS_VIAJE).optional(), zona: z.string().max(40).optional() })
    .parse(c.req.query());
  const { results } = await base(c)
    .prepare(
      `SELECT * FROM tarifas_viaje WHERE (? IS NULL OR servicio_id = ?) AND (? IS NULL OR zona_id = ?)
        ORDER BY servicio_id, zona_id, activa DESC, creada_en DESC LIMIT 200`,
    )
    .bind(q.servicio ?? null, q.servicio ?? null, q.zona ?? null, q.zona ?? null)
    .all<FilaTarifa>();
  return c.json({ tarifas: results.map(tarifaPublica) });
});

/**
 * Nueva versión de la tarifa: cierra la activa (si hay) y abre esta, en un solo lote. Nunca se
 * edita una tarifa: así cada cotización vieja sigue apuntando a la tarifa con que se calculó.
 */
viajesPasajero.post('/admin/viajes/tarifas', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const d = await leerCuerpo(
    c,
    z.object({
      servicio: z.enum(SERVICIOS_VIAJE),
      zona: z.string().trim().min(2).max(40),
      tarifa: esquemaTarifaViaje,
      dePrueba: z.boolean().default(true),
      motivo: z.string().trim().min(3).max(200),
    }),
  );
  const zona = await db
    .prepare('SELECT id, moneda FROM zonas WHERE id = ?')
    .bind(d.zona)
    .first<{ id: string; moneda: string }>();
  if (!zona) throw new ErrorDatos('Esa ciudad no existe.', 'zona', 404);
  const antes = await tarifaActiva(db, d.servicio, zona.id);
  const id = nuevoId();
  const t = d.tarifa;
  await db.batch([
    db
      .prepare(
        "UPDATE tarifas_viaje SET activa = 0, cerrada_en = datetime('now') WHERE servicio_id = ? AND zona_id = ? AND activa = 1",
      )
      .bind(d.servicio, zona.id),
    db
      .prepare(
        `INSERT INTO tarifas_viaje (id, servicio_id, zona_id, moneda, base, por_km, por_minuto, minimo,
           espera_gratis_s, por_minuto_espera, cancelacion_gratis_s, cargo_cancelacion,
           cargo_no_se_presento, tope_dinamico_pb, redondeo, cargo_fijo, factor_calle_pb, velocidad_kmh,
           de_prueba, motivo, creada_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        d.servicio,
        zona.id,
        zona.moneda,
        t.base,
        t.porKm,
        t.porMinuto,
        t.minimo,
        t.esperaGratisS,
        t.porMinutoEspera,
        t.cancelacionGratisS,
        t.cargoCancelacion,
        t.cargoNoSePresento,
        t.topeDinamicoPb,
        t.redondeo,
        t.cargoFijo,
        t.factorCallePb,
        t.velocidadKmh,
        d.dePrueba ? 1 : 0,
        d.motivo,
        admin.id,
      ),
    db
      .prepare(
        'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        admin.id,
        'viaje.tarifa',
        `tarifa:${d.servicio}:${zona.id}`,
        JSON.stringify(antes ?? null),
        JSON.stringify({ id, ...t, dePrueba: d.dePrueba, motivo: d.motivo }),
      ),
  ]);
  const nueva = await db
    .prepare('SELECT * FROM tarifas_viaje WHERE id = ?')
    .bind(id)
    .first<FilaTarifa>();
  return c.json({ tarifa: nueva ? tarifaPublica(nueva) : null }, 201);
});

// ---------------------------------------------------------------- pasajero

viajesPasajero.post('/viajes/cotizar', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const d = await leerCuerpo(c, esquemaCotizarViaje);
  const zona = await zonaPara(db, d.origen.lat, d.origen.lng);
  if (!zona) throw new ErrorDatos('Todavía no llegamos a esa dirección.', 'origen', 409);
  const zonaDestino = await zonaPara(db, d.destino.lat, d.destino.lng);
  if (zonaDestino?.id !== zona.id)
    throw new ErrorDatos('El destino queda fuera de la ciudad del viaje.', 'destino', 422);
  if ((await estadoServicioEnZona(db, d.servicio, zona.id)) !== 'disponible')
    throw new ErrorDatos('Este servicio todavía no está disponible en tu ciudad.', 'servicio', 409);
  const fila = await tarifaActiva(db, d.servicio, zona.id);
  if (!fila)
    throw new ErrorDatos('Este servicio todavía no tiene precio en tu ciudad.', 'servicio', 409);
  const tarifa = filaATarifa(fila);
  const ruta = estimarRuta(tarifa, d.origen, d.destino);
  if (ruta.distanciaM < 200)
    throw new ErrorDatos('El destino está demasiado cerca del punto de recogida.', 'destino', 422);
  if (ruta.distanciaM > DISTANCIA_MAXIMA_KM[d.servicio] * 1000)
    throw new ErrorDatos('El destino está demasiado lejos para este servicio.', 'destino', 422);
  // M1: sin precio dinámico todavía (multiplicador 1). El tope ya vive en la tarifa.
  const multiplicadorPb = 10_000;
  const desglose = cotizarViaje(tarifa, ruta, multiplicadorPb);
  const id = nuevoId();
  const venceEn = sqlFecha(new Date(Date.now() + VIGENCIA_COTIZACION_S * 1000));
  await db
    .prepare(
      `INSERT INTO cotizaciones_viaje (id, cliente_id, servicio_id, zona_id, tarifa_id,
         origen_lat, origen_lng, origen_direccion, destino_lat, destino_lng, destino_direccion,
         distancia_m, duracion_s, multiplicador_pb, desglose_json, tarifa_json, total, moneda, vence_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      u.id,
      d.servicio,
      zona.id,
      fila.id,
      d.origen.lat,
      d.origen.lng,
      d.origen.direccion,
      d.destino.lat,
      d.destino.lng,
      d.destino.direccion,
      ruta.distanciaM,
      ruta.duracionS,
      multiplicadorPb,
      JSON.stringify(desglose),
      JSON.stringify(tarifa),
      desglose.total,
      fila.moneda,
      venceEn,
    )
    .run();
  const cotizacion: CotizacionViaje = {
    id,
    servicio: d.servicio,
    zona: { id: zona.id, nombre: zona.nombre },
    moneda: fila.moneda,
    distanciaM: ruta.distanciaM,
    duracionS: ruta.duracionS,
    desglose,
    total: desglose.total,
    venceEn,
    dePrueba: fila.de_prueba === 1,
  };
  return c.json({ cotizacion }, 201);
});

// ---------------------------------------------------------------- M2: pedir, ver y cancelar

/** El código de 4 dígitos que el pasajero le dice al conductor para empezar. */
function pinNuevo(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return String(n % 10_000).padStart(4, '0');
}

function claveDe(c: Ctx, accion: string, id: string): string {
  const k = c.req.header('idempotency-key') ?? '';
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(k))
    throw new ErrorDatos('Falta la clave de la solicitud. Actualiza la app.', undefined, 400);
  return `${accion}:${id}:${k}`;
}

const ESTADOS_ACTIVOS = "('pago_pendiente', 'buscando', 'asignada', 'en_curso')";

/**
 * Pedir el viaje con una cotización vigente. La cotización es de un solo uso: el mismo pedido
 * repetido (doble toque, respuesta perdida) devuelve el mismo viaje. Todo en un solo lote: la
 * cotización se marca usada, nacen la operación y el viaje, o no pasa nada.
 * M2: efectivo (el conductor cobra en mano). La tarjeta llega con el dinero (M7).
 */
viajesPasajero.post('/viajes', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const d = await leerCuerpo(
    c,
    z.object({
      cotizacionId: z.string().min(8).max(64),
      // C-VIAJE-TARJETA: con tarjeta se autoriza al pedir y se cobra al terminar.
      metodoPago: z.enum(['efectivo', 'tarjeta']).default('efectivo'),
    }),
  );
  const cot = await db
    .prepare(
      `SELECT id, servicio_id, zona_id, usada_en, operacion_id, total, moneda, vence_en > datetime('now') AS vigente
         FROM cotizaciones_viaje WHERE id = ? AND cliente_id = ?`,
    )
    .bind(d.cotizacionId, u.id)
    .first<{
      id: string;
      servicio_id: string;
      zona_id: string;
      usada_en: string | null;
      operacion_id: string | null;
      total: number;
      moneda: string;
      vigente: number;
    }>();
  if (!cot) throw new ErrorDatos('Esa cotización no existe.', 'cotizacionId', 404);
  if (cot.usada_en && cot.operacion_id) return c.json({ viaje: { id: cot.operacion_id } });
  if (!cot.vigente)
    throw new ErrorDatos('El precio venció. Vuelve a cotizar el viaje.', 'cotizacionId', 409);
  if ((await estadoServicioEnZona(db, cot.servicio_id, cot.zona_id)) !== 'disponible')
    throw new ErrorDatos('Este servicio todavía no está disponible en tu ciudad.', 'servicio', 409);
  const op = nuevoId();
  const inicial = d.metodoPago === 'tarjeta' ? 'pago_pendiente' : 'buscando';
  const r = await db.batch([
    db
      .prepare(
        `UPDATE cotizaciones_viaje SET usada_en = datetime('now'), operacion_id = ?1
          WHERE id = ?2 AND cliente_id = ?3 AND usada_en IS NULL AND vence_en > datetime('now')
            AND NOT EXISTS (SELECT 1 FROM operaciones o WHERE o.cliente_id = ?3
                             AND o.tipo_operacion = 'viaje_pasajero' AND o.estado_general IN ${ESTADOS_ACTIVOS})`,
      )
      .bind(op, cot.id, u.id),
    db
      .prepare(
        `INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, zona_id, estado_general, ultima_clave)
         SELECT ?1, servicio_id, 'viaje_pasajero', cliente_id, zona_id, ?4, ?3
           FROM cotizaciones_viaje WHERE id = ?2 AND operacion_id = ?1`,
      )
      .bind(op, cot.id, `pedir:${cot.id}`, inicial),
    db
      .prepare(
        `INSERT INTO viajes (operacion_id, estado, ultimo_actor, ultimo_actor_id, ultima_clave,
           origen_lat, origen_lng, origen_direccion, destino_lat, destino_lng, destino_direccion,
           pasajeros, pin_recogida, metodo_pago, cotizacion_id)
         SELECT ?1, ?6, 'cliente', cliente_id, ?3, origen_lat, origen_lng, origen_direccion,
                destino_lat, destino_lng, destino_direccion, 1, ?4, ?5, id
           FROM cotizaciones_viaje WHERE id = ?2 AND operacion_id = ?1`,
      )
      .bind(op, cot.id, `pedir:${cot.id}`, pinNuevo(), d.metodoPago, inicial),
  ]);
  if (!r[0]?.meta.changes) {
    const otra = await db
      .prepare('SELECT operacion_id FROM cotizaciones_viaje WHERE id = ? AND usada_en IS NOT NULL')
      .bind(cot.id)
      .first<{ operacion_id: string }>();
    if (otra) return c.json({ viaje: { id: otra.operacion_id } });
    throw new ErrorDatos('Ya tienes un viaje en curso.', undefined, 409);
  }
  // C-VIAJE-TARJETA: con tarjeta, primero la autorización; se busca conductor cuando Stripe avisa.
  if (d.metodoPago === 'tarjeta') {
    const pago = await abrirCobroViaje(c.env, db, u, op, Number(cot.total), cot.moneda);
    return c.json({ viaje: { id: op }, pago }, 201);
  }
  // Se busca conductor de una vez, sin esperar la vuelta del reloj (M3 afina el despacho).
  await repartirOperaciones(c.env, db).catch((e: unknown) =>
    console.error('viajes: despacho al pedir', e),
  );
  return c.json({ viaje: { id: op } }, 201);
});

type FilaViajeCliente = {
  id: string;
  servicio_id: string;
  estado: string;
  pin_recogida: string;
  metodo_pago: string;
  origen_direccion: string;
  destino_direccion: string;
  origen_lat: number;
  origen_lng: number;
  destino_lat: number;
  destino_lng: number;
  segundos_asignado: number | null;
  total: number | null;
  moneda: string | null;
  tarifa_json: string | null;
  conductor_nombre: string | null;
  conductor_lat: number | null;
  conductor_lng: number | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  placa: string | null;
};

async function viajeDelCliente(db: D1Database, clienteId: string, id: string | null) {
  return db
    .prepare(
      `SELECT o.id, o.servicio_id, v.estado, v.pin_recogida, v.metodo_pago, v.origen_direccion,
              v.destino_direccion, v.origen_lat, v.origen_lng, v.destino_lat, v.destino_lng,
              CAST((julianday('now') - julianday(v.asignado_en)) * 86400 AS INTEGER) AS segundos_asignado,
              q.total, q.moneda, q.tarifa_json,
              u.nombre AS conductor_nombre, d.lat AS conductor_lat, d.lng AS conductor_lng,
              h.marca, h.modelo, h.color, h.placa
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
         LEFT JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id
         LEFT JOIN usuarios u ON u.id = o.conductor_id
         LEFT JOIN repartidores d ON d.usuario_id = o.conductor_id
         LEFT JOIN vehiculos h ON h.id = o.vehiculo_id
        WHERE o.cliente_id = ?1 AND o.tipo_operacion = 'viaje_pasajero'
          AND (?2 IS NULL AND o.estado_general IN ${ESTADOS_ACTIVOS} OR o.id = ?2)
        ORDER BY o.creado_en DESC LIMIT 1`,
    )
    .bind(clienteId, id)
    .first<FilaViajeCliente>();
}

function tarifaDeCopia(json: string | null) {
  try {
    return esquemaTarifaViaje.parse(JSON.parse(json ?? '{}'));
  } catch {
    return null;
  }
}

function viajePublico(f: FilaViajeCliente) {
  const t = tarifaDeCopia(f.tarifa_json);
  const cargo = t ? cargoCancelacionViaje(t, f.estado, f.segundos_asignado) : null;
  const conConductor = ['asignado', 'conductor_llego', 'en_curso'].includes(f.estado);
  return {
    id: f.id,
    servicio: f.servicio_id,
    estado: f.estado,
    // El código solo lo ve el pasajero, y solo hasta que empieza el viaje.
    pin: ['buscando', 'asignado', 'conductor_llego'].includes(f.estado) ? f.pin_recogida : null,
    metodoPago: f.metodo_pago,
    origen: { direccion: f.origen_direccion, lat: f.origen_lat, lng: f.origen_lng },
    destino: { direccion: f.destino_direccion, lat: f.destino_lat, lng: f.destino_lng },
    total: f.total,
    moneda: f.moneda,
    conductor:
      conConductor && f.conductor_nombre
        ? {
            nombre: f.conductor_nombre.split(' ')[0] ?? '',
            ubicacion:
              f.conductor_lat != null && f.conductor_lng != null
                ? { lat: f.conductor_lat, lng: f.conductor_lng }
                : null,
            vehiculo: { marca: f.marca, modelo: f.modelo, color: f.color, placa: f.placa },
          }
        : null,
    cancelacion:
      cargo === null
        ? null
        : {
            cargo,
            gratisPorS:
              t && cargo === 0 && f.segundos_asignado != null
                ? Math.max(0, t.cancelacionGratisS - f.segundos_asignado)
                : null,
          },
  };
}

viajesPasajero.get('/viajes/actual', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  let f = await viajeDelCliente(db, u.id, null);
  // M3: el sitio no tiene reloj propio (el de afuera pasa cada 5 minutos). Mientras el pasajero
  // espera, su consulta mueve el despacho si la oferta anterior venció o fue rechazada.
  if (f?.estado === 'buscando') {
    const abierta = await db
      .prepare(
        "SELECT 1 FROM ofertas_operacion WHERE operacion_id = ? AND estado = 'ofrecida' AND expira_en > datetime('now')",
      )
      .bind(f.id)
      .first();
    if (!abierta) {
      await repartirOperaciones(c.env, db).catch((e: unknown) =>
        console.error('viajes: despacho al consultar', e),
      );
      f = await viajeDelCliente(db, u.id, null);
    }
  }
  const deuda = await db
    .prepare(
      "SELECT COALESCE(SUM(monto), 0) AS monto, MAX(moneda) AS moneda FROM deudas_pasajero WHERE cliente_id = ? AND estado = 'pendiente'",
    )
    .bind(u.id)
    .first<{ monto: number; moneda: string | null }>();
  return c.json({
    viaje: f ? viajePublico(f) : null,
    deudaPendiente: deuda?.monto ? { monto: deuda.monto, moneda: deuda.moneda } : null,
  });
});

viajesPasajero.get('/viajes/:id', async (c) => {
  const u = exigir(c, 'cliente');
  const f = await viajeDelCliente(base(c), u.id, c.req.param('id'));
  if (!f) throw new ErrorDatos('Ese viaje no existe.', undefined, 404);
  return c.json({ viaje: viajePublico(f) });
});

/**
 * El pasajero cancela. Gratis mientras se busca conductor y en la ventana desde la asignación;
 * después, el cargo de la tarifa copiada en la cotización. En efectivo, el cargo queda como deuda
 * para su próximo viaje (no se cobra en el momento).
 */
viajesPasajero.post('/viajes/:id/cancelar', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const id = c.req.param('id');
  const clave = claveDe(c, 'cancelar-cliente', id);
  const f = await viajeDelCliente(db, u.id, id);
  if (!f) throw new ErrorDatos('Ese viaje no existe.', undefined, 404);
  if (f.estado === 'cancelado') return c.json({ ok: true, cargo: 0 }); // reintento
  const t = tarifaDeCopia(f.tarifa_json);
  const cargo = cargoCancelacionViaje(
    t ?? { cancelacionGratisS: 0, cargoCancelacion: 0 },
    f.estado,
    f.segundos_asignado,
  );
  if (cargo === null)
    throw new ErrorDatos(
      'El viaje ya empezó: ya no se puede cancelar desde la app.',
      undefined,
      409,
    );
  const ok = await cambiarEstadoViaje(db, {
    operacionId: id,
    desde: f.estado,
    hacia: 'cancelado',
    actor: 'cliente',
    actorId: u.id,
    clave,
    motivo: 'cancelado_por_pasajero',
  });
  if (!ok) throw new ErrorDatos('El viaje cambió. Actualiza la pantalla.', undefined, 409);
  await devolverReservasViaje(db, id, 'cancelado_por_pasajero');
  // C-VIAJE-TARJETA: con tarjeta, el cargo se cobra de la autorización (o se anula si no hay cargo).
  if (f.metodo_pago === 'tarjeta') {
    const cobrado = await soltarCobroViaje(c.env, db, id, cargo);
    return c.json({ ok: true, cargo: cobrado });
  }
  if (cargo > 0 && f.moneda)
    await db
      .prepare(
        `INSERT OR IGNORE INTO deudas_pasajero (id, cliente_id, operacion_id, motivo, monto, moneda, conductor_id)
         VALUES (?, ?, ?, 'cancelacion', ?, ?, (SELECT conductor_id FROM operaciones WHERE id = ?))`,
      )
      .bind(nuevoId(), u.id, id, cargo, f.moneda, id)
      .run();
  return c.json({ ok: true, cargo });
});

/** C-VIAJE-PROPINA: propina después del viaje, con la tarjeta guardada (como Uber y Comida). */
viajesPasajero.post('/viajes/:id/propina', async (c) => {
  const u = exigir(c, 'cliente');
  const { centavos } = await leerCuerpo(
    c,
    z.object({ centavos: z.number().int().min(100).max(10_000) }),
  );
  return c.json({
    ok: true,
    propina: await propinaViaje(c.env, base(c), u.id, c.req.param('id'), centavos),
  });
});

// ---------------------------------------------------------------- M6: seguridad del viaje

/**
 * Botón de emergencia (pasajero o conductor): queda guardado con la ubicación, le llega al equipo
 * por correo y la app llama al número de emergencias del país que devuelve esta respuesta.
 * Nunca falla por el correo: lo importante es que quede registrado y que la app llame.
 */
export async function registrarEmergencia(
  c: Ctx,
  p: {
    operacionId: string;
    actorId: string;
    rol: 'pasajero' | 'conductor';
    lat?: number;
    lng?: number;
  },
) {
  const db = base(c);
  const f = await db
    .prepare(
      `SELECT z.pais, u.nombre FROM operaciones o JOIN zonas z ON z.id = o.zona_id
         JOIN usuarios u ON u.id = ? WHERE o.id = ?`,
    )
    .bind(p.actorId, p.operacionId)
    .first<{ pais: string; nombre: string }>();
  await db
    .prepare(
      'INSERT INTO emergencias_viaje (id, operacion_id, actor_id, rol, lat, lng) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(nuevoId(), p.operacionId, p.actorId, p.rol, p.lat ?? null, p.lng ?? null)
    .run();
  await avisoEmergenciaViaje(c.env, {
    operacionId: p.operacionId,
    rol: p.rol,
    nombre: f?.nombre ?? '',
    donde: p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : 'sin ubicación',
  }).catch((e: unknown) => console.error('viajes: correo de emergencia', e));
  return { numero: numeroEmergencia(f?.pais) };
}

const cuerpoEmergencia = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

viajesPasajero.post('/viajes/:id/emergencia', async (c) => {
  const u = exigir(c, 'cliente');
  const id = c.req.param('id');
  if (!(await viajeDelCliente(base(c), u.id, id)))
    throw new ErrorDatos('Ese viaje no existe.', undefined, 404);
  const d = await leerCuerpo(c, cuerpoEmergencia);
  return c.json(
    await registrarEmergencia(c, { operacionId: id, actorId: u.id, rol: 'pasajero', ...d }),
  );
});

/**
 * Compartir el viaje (Grab «Share My Ride», DiDi): un enlace largo y secreto que muestra el viaje
 * en vivo a quien lo reciba, sin cuenta. Se guarda solo su huella y deja de servir al terminar.
 */
viajesPasajero.post('/viajes/:id/compartir', async (c) => {
  const u = exigir(c, 'cliente');
  const id = c.req.param('id');
  const f = await viajeDelCliente(base(c), u.id, id);
  if (!f) throw new ErrorDatos('Ese viaje no existe.', undefined, 404);
  if (['terminado', 'cancelado', 'sin_conductor', 'no_show'].includes(f.estado))
    throw new ErrorDatos('Este viaje ya terminó.', undefined, 409);
  const codigo = nuevoToken();
  await base(c)
    .prepare('INSERT INTO viajes_compartidos (huella, operacion_id, creado_por) VALUES (?, ?, ?)')
    .bind(await sha256(codigo), id, u.id)
    .run();
  const sitio = (c.env.SITIO_URL ?? new URL(c.req.url).origin).replace(/\/$/, '');
  return c.json({ url: `${sitio}/ride/${codigo}` }, 201);
});

/** Lo que ve quien recibió el enlace: solo mientras el viaje no termine. */
viajesPasajero.get('/publico/viaje/:codigo', async (c) => {
  const codigo = c.req.param('codigo');
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(codigo))
    throw new ErrorDatos('Este enlace no existe.', undefined, 404);
  const f = await base(c)
    .prepare(
      `SELECT v.estado, v.origen_direccion, v.destino_direccion, v.destino_lat, v.destino_lng,
              u.nombre AS conductor, d.lat, d.lng, d.ubicacion_en, h.marca, h.modelo, h.color, h.placa
         FROM viajes_compartidos s JOIN operaciones o ON o.id = s.operacion_id
         JOIN viajes v ON v.operacion_id = o.id
         LEFT JOIN usuarios u ON u.id = o.conductor_id
         LEFT JOIN repartidores d ON d.usuario_id = o.conductor_id
         LEFT JOIN vehiculos h ON h.id = o.vehiculo_id
        WHERE s.huella = ?`,
    )
    .bind(await sha256(codigo))
    .first<Record<string, unknown>>();
  if (!f) throw new ErrorDatos('Este enlace no existe.', undefined, 404);
  const estado = String(f.estado);
  if (['terminado', 'cancelado', 'sin_conductor', 'no_show'].includes(estado))
    return c.json({ viaje: { estado, terminado: true } });
  return c.json({
    viaje: {
      estado,
      terminado: false,
      origen: String(f.origen_direccion),
      destino: String(f.destino_direccion),
      conductor: f.conductor ? String(f.conductor).split(' ')[0] : null,
      vehiculo: f.conductor
        ? { marca: f.marca, modelo: f.modelo, color: f.color, placa: f.placa }
        : null,
      ubicacion: f.lat != null && f.lng != null ? { lat: Number(f.lat), lng: Number(f.lng) } : null,
      ubicacionEn: f.ubicacion_en ?? null,
    },
  });
});

/**
 * Pieza «viajes» de /datos/salud (M7, conciliación): ningún viaje cerrado hace más de 10 minutos
 * puede seguir con comisión apartada (se cobró o se devolvió), y ninguna deuda puede quedar
 * «cobrada» sin el viaje que la cobró. Si algo queda colgado, se ve en rojo.
 */
export async function saludViajes(db: D1Database): Promise<'ok' | 'error'> {
  const f = await db
    .prepare(
      `SELECT
         -- Una sola pasada por las reservas de viajes (sin cruzar todo el libro con todas las
         -- operaciones): el id del viaje sale de la referencia «reserva_viaje:<viaje>:<conductor>:…».
         (SELECT COUNT(*) FROM (
            SELECT r.op, r.cuenta_id FROM (
              SELECT substr(l.referencia, 15, instr(substr(l.referencia, 15), ':') - 1) AS op,
                     l.cuenta_id, l.monto
                FROM libro l
               WHERE l.bolsillo = 'reservado' AND l.referencia LIKE 'reserva_viaje:%') r
            JOIN operaciones o ON o.id = r.op
           WHERE o.estado_general IN ('terminada', 'cancelada', 'sin_conductor')
             AND o.actualizado_en < datetime('now', '-10 minutes')
           GROUP BY r.op, r.cuenta_id HAVING SUM(r.monto) != 0)) AS colgadas,
         (SELECT COUNT(*) FROM deudas_pasajero WHERE estado = 'cobrada' AND cobrada_en IS NULL) AS huerfanas`,
    )
    .first<{ colgadas: number; huerfanas: number }>();
  return Number(f?.colgadas) === 0 && Number(f?.huerfanas) === 0 ? 'ok' : 'error';
}

// ---------------------------------------------------------------- M8: calificación

export const esquemaCalificacionViaje = z.object({
  estrellas: z.number().int().min(1).max(5),
  comentario: z.string().trim().max(500).default(''),
});

/** Guarda la calificación de un lado (una sola: repetir responde igual sin cambiarla). */
export async function calificarViaje(
  db: D1Database,
  p: {
    operacionId: string;
    de: 'pasajero' | 'conductor';
    autorId: string;
    estrellas: number;
    comentario: string;
  },
) {
  const v = await db
    .prepare('SELECT estado FROM viajes WHERE operacion_id = ?')
    .bind(p.operacionId)
    .first<{ estado: string }>();
  if (v?.estado !== 'terminado')
    throw new ErrorDatos('Solo se califica un viaje terminado.', undefined, 409);
  await db
    .prepare(
      'INSERT OR IGNORE INTO calificaciones_viaje (operacion_id, de, autor_id, estrellas, comentario) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(p.operacionId, p.de, p.autorId, p.estrellas, p.comentario)
    .run();
}

viajesPasajero.post('/viajes/:id/calificar', async (c) => {
  const u = exigir(c, 'cliente');
  const id = c.req.param('id');
  if (!(await viajeDelCliente(base(c), u.id, id)))
    throw new ErrorDatos('Ese viaje no existe.', undefined, 404);
  const d = await leerCuerpo(c, esquemaCalificacionViaje);
  await calificarViaje(base(c), { operacionId: id, de: 'pasajero', autorId: u.id, ...d });
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- M9: panel del superadmin

/** Lo que el superadmin vigila de Moto: emergencias abiertas, viajes recientes y tarifas activas. */
viajesPasajero.get('/admin/viajes', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const [emergencias, viajes, tarifas] = await Promise.all([
    db
      .prepare(
        `SELECT e.id, e.operacion_id, e.rol, e.lat, e.lng, e.creado_en, u.nombre, u.correo, u.telefono
           FROM emergencias_viaje e JOIN usuarios u ON u.id = e.actor_id
          WHERE e.atendida_en IS NULL ORDER BY e.creado_en DESC LIMIT 50`,
      )
      .all<Record<string, unknown>>(),
    db
      .prepare(
        `SELECT o.id, o.servicio_id, o.zona_id, o.creado_en, v.estado, v.origen_direccion,
                v.destino_direccion, v.metodo_pago, v.total_final_centavos, q.total, q.moneda,
                p.nombre AS pasajero, d.nombre AS conductor
           FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
           LEFT JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id
           LEFT JOIN usuarios p ON p.id = o.cliente_id
           LEFT JOIN usuarios d ON d.id = o.conductor_id
          WHERE o.tipo_operacion = 'viaje_pasajero'
          ORDER BY o.estado_general IN ('buscando', 'asignada', 'en_curso') DESC, o.creado_en DESC
          LIMIT 50`,
      )
      .all<Record<string, unknown>>(),
    db
      .prepare(
        `SELECT t.*, z.nombre AS zona_nombre FROM tarifas_viaje t JOIN zonas z ON z.id = t.zona_id
          WHERE t.activa = 1 ORDER BY t.servicio_id, z.nombre`,
      )
      .all<FilaTarifa & { zona_nombre: string }>(),
  ]);
  return c.json({
    emergencias: emergencias.results,
    viajes: viajes.results,
    tarifas: tarifas.results.map((f) => ({ ...tarifaPublica(f), zonaNombre: f.zona_nombre })),
  });
});

viajesPasajero.post('/admin/viajes/emergencias/:id/atender', async (c) => {
  const admin = exigir(c, 'admin');
  const { nota } = await leerCuerpo(c, z.object({ nota: z.string().trim().min(3).max(500) }));
  const r = await base(c)
    .prepare(
      "UPDATE emergencias_viaje SET atendida_en = datetime('now'), atendida_por = ?, nota = ? WHERE id = ? AND atendida_en IS NULL",
    )
    .bind(admin.id, nota, c.req.param('id'))
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Esa emergencia ya fue atendida.', undefined, 409);
  return c.json({ ok: true });
});
