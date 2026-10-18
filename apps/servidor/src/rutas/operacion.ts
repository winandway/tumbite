import {
  conciliarPedidoDirecto,
  esDirecto,
  puedeTomarDirecto,
  reservarAlAceptar,
} from '../internacional/cobroDirecto';
import {
  confirmarPagoLocalRestaurante,
  exigirPagoLocal,
  registrarPerdidaComida,
} from '../internacional/pagoLocal';
import { liberarReserva } from '../internacional/libro';
import { cuentaVigente } from '../internacional/cuentasCobro';
import { paisDeZona } from '../internacional/paises';
import { verificarPinEntrega } from '../pin';
import { conciliarRetirosSiToca, procesarRetirosPendientes } from '../retiros';
import { type TareaReloj, anotarTareas, correrTareas } from '../reloj';
import { esConductorOcupado, repartirOperaciones } from '../operaciones';
import { Hono } from 'hono';
import { cobertura } from '../territorio';
import { z } from 'zod';
import {
  type Muestra,
  BONO_OFERTA_ABIERTA,
  OPCIONES_COCINA_OCUPADA,
  PEDIDOS_PARA_PROMEDIO,
  RADIO_LLEGADA_M,
  RECHAZOS_PARA_ABRIR,
  celdasVecinas,
  llegadaConfiable,
  saltoImposible,
  debeOfrecer,
  distanciaKm,
  geohash,
  metrosEntre,
  minutosDeViaje,
  minutosParaListo,
  nivelDe,
  prepSugerida,
} from '@tumbite/compartido';
import { MAX_FOTO_BYTES, tipoReal } from './fotos';
import { asegurarCodigoRepartidor } from './superadmin';
import { kycAprobado } from './kyc';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { CON_AJUSTE, CON_EVIDENCIAS, type FilaPedido, aPedido, calcularSinPlato } from './pedidos';
import { anotar, anotarEstado } from '../historial';
import { AVISOS, notificar } from '../notificaciones';
import { crearStripe } from '../stripe';
import { anotarEvento, cancelarConReembolso, vigilarPedidos } from '../manager';
import { anotarSenal, pausarSinSenal } from '../pausa';
import {
  esEntregaRepetida,
  estadoInicial,
  liquidar,
  liquidarPendientes,
  sentenciaLiquidacion,
} from '../liquidaciones';
import { enviarCorreo } from '../correo';
import { conciliarAyer, depurarFotos } from '../conciliacion';
import {
  abrirPase,
  enviarSms,
  llamarConNumeroOculto,
  smsConfigurado,
  telefonoE164,
  twimlPuente,
} from '../sms';
import { formatearDolares } from '@tumbite/compartido';

export const operacion = new Hono<{ Bindings: Env; Variables: Variables }>();

const SEGUNDOS_OFERTA = 45;
/** Probabilidad de pedir la selfie de control en cada conexión (como la identidad continua de los grandes). */
const PROBABILIDAD_SELFIE = 0.2;
const punto = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
/** La ubicación con la precisión que reporta el celular (metros; sin ella, no cuenta para «llegó»). */
const puntoConPrecision = punto.extend({
  precision: z.number().min(0).max(100_000).nullable().optional(),
});

// ======================= Restaurante =======================

/** Para sumar a un SELECT con el pedido como «p»: los hitos del repartidor. */
const CON_HITOS = `(SELECT creado_en FROM hitos_pedido h WHERE h.pedido_id = p.id AND h.hito = 'llego_restaurante') AS h_llego_rest,
  (SELECT creado_en FROM hitos_pedido h WHERE h.pedido_id = p.id AND h.hito = 'llego_cliente') AS h_llego_cli,
  (SELECT creado_en FROM hitos_pedido h WHERE h.pedido_id = p.id AND h.hito = 'casi_llega') AS h_casi,
  (SELECT creado_en FROM avisos_pedido a WHERE a.pedido_id = p.id AND a.aviso = 'llega_5') AS h_llega5,
  (SELECT valor FROM hitos_pedido h WHERE h.pedido_id = p.id AND h.hito = 'espera_evitable') AS h_espera,
  (SELECT creado_en FROM hitos_pedido h WHERE h.pedido_id = p.id AND h.hito = 'verificado') AS h_verificado,
  (SELECT creado_en FROM hitos_pedido h WHERE h.pedido_id = p.id AND h.hito = 'no_aparece') AS h_no_aparece`;

/** Bono de la oferta abierta (centavos), si el pedido lo tiene. */
const CON_BONO = `COALESCE((SELECT centavos FROM bonos_pedido b WHERE b.pedido_id = p.id), 0) AS bono`;

/** «No puedo confirmar mi ubicación»: pedida (sin autorizar) o autorizada por soporte. */
const CON_EXCEPCION = `(SELECT CASE WHEN x.autorizado_en IS NULL THEN 'pedida' ELSE 'autorizada' END FROM excepciones_ubicacion x WHERE x.pedido_id = p.id) AS excepcion_ubicacion`;

/** Hora UTC de la base («YYYY-MM-DD HH:MM:SS») en milisegundos. */
function msDeBase(t: unknown): number | null {
  if (!t) return null;
  const ms = Date.parse(`${String(t).replace(' ', 'T')}Z`);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Lo que el restaurante ve del repartidor: quién es, en cuántos minutos llega, si ya llegó y desde
 * cuándo espera. La espera cuenta desde que llegó O desde la hora de listo, lo que sea más tarde:
 * si llegó antes de tiempo, esos minutos son del repartidor, no del restaurante (regla de DoorDash).
 */
function repartidorParaRestaurante(f: FilaPedido) {
  if (!f.repartidor_id) return null;
  const estado = String(f.estado);
  const rest =
    f.rest_lat != null && f.rest_lng != null
      ? { lat: Number(f.rest_lat), lng: Number(f.rest_lng) }
      : null;
  const donde =
    f.rep_lat != null && f.rep_lng != null
      ? { lat: Number(f.rep_lat), lng: Number(f.rep_lng) }
      : null;
  const llegoEn = (f.h_llego_rest as string | null) ?? null;
  const enRestaurante = estado === 'aceptado' || estado === 'listo';
  const minutosParaLlegar =
    enRestaurante && !llegoEn && rest && donde ? minutosDeViaje(distanciaKm(donde, rest)) : null;
  // La hora de listo que prometió el restaurante (aceptó + minutos); si tocó «Listo» antes, esa.
  const prometido = (msDeBase(f.aceptado_en) ?? 0) + Number(f.tiempo_prep_min ?? 20) * 60_000;
  const listoReal = msDeBase(f.listo_en);
  const listoPrevisto = listoReal != null ? Math.min(prometido, listoReal) : prometido;
  const llegoMs = msDeBase(llegoEn);
  const esperandoDesdeMs =
    llegoMs != null && enRestaurante ? Math.max(llegoMs, listoPrevisto) : null;
  return {
    nombre: String(f.repartidor_nombre ?? '').split(' ')[0],
    minutosParaLlegar,
    llego: llegoEn != null,
    llegoEn,
    // Desde cuándo cuenta la espera (puede ser en el futuro si llegó antes de la hora de listo).
    esperandoDesde: esperandoDesdeMs == null ? null : new Date(esperandoDesdeMs).toISOString(),
    esperaEvitableSeg: f.h_espera == null ? null : Number(f.h_espera),
    // Escaneó el código de la pantalla: la app ya comprobó que es el pedido correcto.
    verificado: f.h_verificado != null,
    salio: estado === 'en_camino' || estado === 'entregado',
  };
}

/** Quita al repartidor de un pedido sin entregar: vuelve a la fila de ofertas (a otros repartidores). */
export async function soltarPedido(
  db: D1Database,
  pedidoId: string,
  repartidorId: string,
  motivo = '',
) {
  await db.batch([
    // Para su tasa de finalización (C-REPARTIDOR-GRANDES): aceptó y no entregó.
    db
      .prepare(
        'INSERT OR IGNORE INTO abandonos_repartidor (pedido_id, repartidor_id, motivo) VALUES (?, ?, ?)',
      )
      .bind(pedidoId, repartidorId, motivo),
    db
      .prepare(
        "UPDATE pedidos SET repartidor_id = NULL WHERE id = ? AND repartidor_id = ? AND estado IN ('aceptado','listo')",
      )
      .bind(pedidoId, repartidorId),
    db
      .prepare("UPDATE ofertas SET estado = 'rechazada' WHERE pedido_id = ? AND repartidor_id = ?")
      .bind(pedidoId, repartidorId),
    db
      .prepare(
        "DELETE FROM hitos_pedido WHERE pedido_id = ? AND hito IN ('llego_restaurante','verificado')",
      )
      .bind(pedidoId),
    db.prepare("DELETE FROM evidencias WHERE pedido_id = ? AND tipo = 'recogida'").bind(pedidoId),
    // C-FALLOS-CRITICOS 5: un pedido suelto ya no viaja agrupado con los del repartidor que lo dejó.
    db.prepare('DELETE FROM grupos_pedido WHERE pedido_id = ?').bind(pedidoId),
  ]);
  // Fase 2: la comisión apartada para este pedido vuelve al prepago del repartidor.
  await liberarReserva(db, pedidoId, repartidorId, `soltado:${motivo}`.slice(0, 80));
  // Si ya había pagado la comida en el local (solo lo permite soporte), esa compra queda como
  // pérdida pendiente de decisión y el siguiente repartidor registra su propio pago.
  if (await registrarPerdidaComida(db, pedidoId, `soltado: ${motivo}`.slice(0, 80)))
    await db.prepare('DELETE FROM pagos_local WHERE pedido_id = ?').bind(pedidoId).run();
}

/** Un pedido confirmado por el restaurante (o verificado con código y fotografiado) sale en camino. */
async function salirEnCamino(env: Env, db: D1Database, id: string, actorId: string) {
  const antes = await db
    .prepare(
      `SELECT p.*, ${CON_HITOS}, r.lat AS rest_lat, r.lng AS rest_lng FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.id = ?`,
    )
    .bind(id)
    .first<FilaPedido>();
  const r = await db
    .prepare(
      "UPDATE pedidos SET estado = 'en_camino', recogido_en = datetime('now') WHERE id = ? AND estado = 'listo'",
    )
    .bind(id)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Este pedido ya cambió de estado. Actualiza la pantalla.', undefined, 409);
  await anotar(db, id, 'en_camino', actorId);
  await db
    .prepare(
      "UPDATE evidencias SET confirmada_en = datetime('now') WHERE pedido_id = ? AND tipo = 'recogida'",
    )
    .bind(id)
    .run();
  const desde = antes ? repartidorParaRestaurante(antes)?.esperandoDesde : null;
  if (desde) {
    const seg = Math.max(0, Math.round((Date.now() - Date.parse(desde)) / 1000));
    await db
      .prepare(
        "INSERT OR REPLACE INTO hitos_pedido (pedido_id, hito, valor) VALUES (?, 'espera_evitable', ?)",
      )
      .bind(id, seg)
      .run();
  }
  const rep = await db
    .prepare(
      'SELECT u.nombre FROM pedidos p JOIN usuarios u ON u.id = p.repartidor_id WHERE p.id = ?',
    )
    .bind(id)
    .first<{ nombre: string }>();
  await avisarAlCliente(env, db, id, (i) => AVISOS.enCamino(i, rep?.nombre.split(' ')[0] ?? ''));
  // Pedidos agrupados: los que ya estén listos salen en el mismo viaje.
  const { results: hermanos } = await db
    .prepare(
      `SELECT p.id FROM pedidos p JOIN grupos_pedido g ON g.pedido_id = p.id
       WHERE g.grupo_id = (SELECT grupo_id FROM grupos_pedido WHERE pedido_id = ?) AND p.id != ? AND p.estado = 'listo'`,
    )
    .bind(id, id)
    .all<{ id: string }>();
  for (const h of hermanos) {
    await db
      .prepare(
        "UPDATE pedidos SET estado = 'en_camino', recogido_en = datetime('now') WHERE id = ? AND estado = 'listo'",
      )
      .bind(h.id)
      .run();
    await anotar(db, h.id, 'en_camino', actorId);
    await avisarAlCliente(env, db, h.id, (i) =>
      AVISOS.enCamino(i, rep?.nombre.split(' ')[0] ?? ''),
    );
  }
}

/**
 * Con cada ubicación del repartidor, el servidor marca los hitos de su pedido activo: llegó al
 * restaurante (200 m), «casi llega» (500 m de la casa, se avisa al cliente) y llegó a la puerta.
 * Lo marca la ubicación, no un botón: nadie puede decir «llegué» desde otro lado.
 */
/**
 * Guarda la lectura del GPS entre las recientes del repartidor y devuelve las últimas (2 minutos).
 * Una lectura con un salto imposible respecto a la anterior (más de 180 km/h) no se guarda: es un
 * GPS simulado o roto, y queda anotada en la bitácora de su pedido activo.
 */
async function guardarMuestra(
  db: D1Database,
  repartidorId: string,
  d: { lat: number; lng: number; precision?: number | null },
): Promise<{ muestras: Muestra[]; salto: boolean }> {
  const leer = async () => {
    const { results } = await db
      .prepare(
        "SELECT lat, lng, precision_m, creado_en FROM ubicaciones_recientes WHERE usuario_id = ? AND creado_en >= datetime('now','-2 minutes') ORDER BY id DESC LIMIT 5",
      )
      .bind(repartidorId)
      .all<{ lat: number; lng: number; precision_m: number | null; creado_en: string }>();
    return results.map<Muestra>((r) => ({
      lat: Number(r.lat),
      lng: Number(r.lng),
      precisionM: r.precision_m == null ? null : Number(r.precision_m),
      en: msDeBase(r.creado_en) ?? 0,
    }));
  };
  const previas = await leer();
  const nueva: Muestra = {
    lat: d.lat,
    lng: d.lng,
    precisionM: d.precision ?? null,
    en: Date.now(),
  };
  if (saltoImposible(previas[0] ?? null, nueva)) return { muestras: previas, salto: true };
  await db.batch([
    db
      .prepare(
        'INSERT INTO ubicaciones_recientes (usuario_id, lat, lng, precision_m) VALUES (?, ?, ?, ?)',
      )
      .bind(repartidorId, d.lat, d.lng, d.precision ?? null),
    db
      .prepare(
        "DELETE FROM ubicaciones_recientes WHERE usuario_id = ? AND creado_en < datetime('now','-2 minutes')",
      )
      .bind(repartidorId),
  ]);
  return { muestras: [nueva, ...previas], salto: false };
}

async function registrarHitos(
  env: Env,
  db: D1Database,
  repartidorId: string,
  donde: { lat: number; lng: number },
  muestras: Muestra[] = [],
) {
  // Con pedidos agrupados lleva más de uno: los hitos se marcan para cada uno.
  const { results: activos } = await db
    .prepare(
      `SELECT p.id, p.estado, p.lat, p.lng, r.lat AS rest_lat, r.lng AS rest_lng,
        (SELECT modo FROM preferencias_entrega pe WHERE pe.pedido_id = p.id) AS entrega
       FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
      WHERE p.repartidor_id = ? AND p.estado IN ('aceptado','listo','en_camino') LIMIT 5`,
    )
    .bind(repartidorId)
    .all<{
      id: string;
      estado: string;
      lat: number | null;
      lng: number | null;
      rest_lat: number | null;
      rest_lng: number | null;
      entrega: string | null;
    }>();
  for (const p of activos) await hitosDeUno(env, db, p, donde, muestras);
}

async function hitosDeUno(
  env: Env,
  db: D1Database,
  p: {
    id: string;
    estado: string;
    lat: number | null;
    lng: number | null;
    rest_lat: number | null;
    rest_lng: number | null;
    entrega: string | null;
  },
  donde: { lat: number; lng: number },
  muestras: Muestra[],
) {
  const marcar = async (hito: string) => {
    const r = await db
      .prepare('INSERT OR IGNORE INTO hitos_pedido (pedido_id, hito) VALUES (?, ?)')
      .bind(p.id, hito)
      .run();
    return r.meta.changes > 0;
  };
  if (p.estado !== 'en_camino') {
    if (
      p.rest_lat != null &&
      p.rest_lng != null &&
      metrosEntre(donde, { lat: p.rest_lat, lng: p.rest_lng }) <= RADIO_LLEGADA_M
    )
      await marcar('llego_restaurante');
    return;
  }
  if (p.lat == null || p.lng == null) return;
  const casa = { lat: p.lat, lng: p.lng };
  const m = metrosEntre(donde, casa);
  // «Llegó a la puerta» exige dos lecturas precisas y coherentes dentro del radio, no un punto suelto.
  // Avisos por tiempo, como los grandes: «llega en 5 minutos» y, en mano, «sal a recibir» a 2.
  const faltan = minutosDeViaje(m / 1000);
  const marcarAviso = async (aviso: string) => {
    const r = await db
      .prepare('INSERT OR IGNORE INTO avisos_pedido (pedido_id, aviso) VALUES (?, ?)')
      .bind(p.id, aviso)
      .run();
    return r.meta.changes > 0;
  };
  if (faltan <= 5 && (await marcarAviso('llega_5')))
    await avisarAlCliente(env, db, p.id, (i) => AVISOS.llega5(i));
  if (faltan <= 2 && p.entrega === 'mano' && (await marcarAviso('sal_a_recibir')))
    await avisarAlCliente(env, db, p.id, (i) => AVISOS.salARecibir(i));
  if (llegadaConfiable(muestras, casa).llego) {
    // En la puerta: push y, de respaldo, SMS (el push no garantiza sonido).
    if (await marcar('llego_cliente'))
      await avisarAlCliente(env, db, p.id, (i) => AVISOS.llego(i), 'llego');
  } else if (m <= 500) {
    if (await marcar('casi_llega'))
      await avisarAlCliente(env, db, p.id, (i) => AVISOS.casiLlega(i));
  }
}

async function miRestauranteId(c: Ctx): Promise<string> {
  const u = exigir(c, 'restaurante');
  const f = await base(c)
    .prepare(
      'SELECT id FROM restaurantes WHERE (dueno_id = ?1 OR id IN (SELECT restaurante_id FROM miembros_restaurante WHERE usuario_id = ?1))',
    )
    .bind(u.id)
    .first<{ id: string }>();
  if (!f) throw new ErrorDatos('Primero completa los datos de tu restaurante.', undefined, 404);
  return f.id;
}

operacion.get('/restaurante/pedidos', async (c) => {
  const rid = await miRestauranteId(c);
  // C-PAUSA-SIN-SENAL: la app o el panel están escuchando. Una escritura cada 30 s como mucho.
  await anotarSenal(base(c), rid);
  const { results } = await base(c)
    .prepare(
      `SELECT p.*, ${CON_EVIDENCIAS}, ${CON_HITOS}, ${CON_AJUSTE}, ur.nombre AS repartidor_nombre, d.lat AS rep_lat, d.lng AS rep_lng, d.ubicacion_en AS rep_en, r.lat AS rest_lat, r.lng AS rest_lng
      FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
      LEFT JOIN usuarios ur ON ur.id = p.repartidor_id LEFT JOIN repartidores d ON d.usuario_id = p.repartidor_id
      WHERE p.restaurante_id = ? AND (p.estado IN ('pagado','aceptado','listo','en_camino')
      OR (p.estado IN ('entregado','cancelado') AND p.creado_en > datetime('now','-1 day'))) ORDER BY p.creado_en DESC`,
    )
    .bind(rid)
    .all<FilaPedido>();
  return c.json({
    pedidos: results.map((f) => ({ ...aPedido(f), repartidor: repartidorParaRestaurante(f) })),
    ...(await cocinaDe(base(c), rid)),
  });
});

/**
 * El tiempo sugerido al aceptar (promedio real de los últimos pedidos, de aceptado a listo) y los
 * minutos de «cocina ocupada» que el restaurante tenga puestos.
 */
async function cocinaDe(db: D1Database, rid: string) {
  const { results } = await db
    .prepare(
      `SELECT (julianday(listo_en) - julianday(aceptado_en)) * 1440 AS minutos FROM pedidos
       WHERE restaurante_id = ? AND listo_en IS NOT NULL AND aceptado_en IS NOT NULL ORDER BY listo_en DESC LIMIT ?`,
    )
    .bind(rid, PEDIDOS_PARA_PROMEDIO)
    .all<{ minutos: number }>();
  const r = await db
    .prepare(
      'SELECT r.tiempo_prep_min, COALESCE((SELECT extra_min FROM cocina_ocupada c WHERE c.restaurante_id = r.id), 0) AS extra FROM restaurantes r WHERE r.id = ?',
    )
    .bind(rid)
    .first<{ tiempo_prep_min: number; extra: number }>();
  const extra = Number(r?.extra ?? 0);
  return {
    cocinaOcupada: extra,
    prepSugerida: prepSugerida(
      results.map((x) => Number(x.minutos)),
      Number(r?.tiempo_prep_min ?? 20),
      extra,
    ),
  };
}

/** «Cocina ocupada»: 0, 10 o 20 minutos extra sobre el tiempo sugerido de los pedidos nuevos. */
operacion.patch('/restaurante/cocina', async (c) => {
  const rid = await miRestauranteId(c);
  const { extraMin } = await leerCuerpo(
    c,
    z.object({
      extraMin: z
        .number()
        .int()
        .refine((n) => OPCIONES_COCINA_OCUPADA.includes(n as 0)),
    }),
  );
  const db = base(c);
  await db
    .prepare(
      "INSERT OR REPLACE INTO cocina_ocupada (restaurante_id, extra_min, desde) VALUES (?, ?, datetime('now'))",
    )
    .bind(rid, extraMin)
    .run();
  return c.json(await cocinaDe(db, rid));
});

async function cambiarEstado(
  db: D1Database,
  id: string,
  rid: string,
  desde: string[],
  a: string,
  extra = '',
  valores: unknown[] = [],
) {
  const r = await db
    .prepare(
      `UPDATE pedidos SET estado = ?${extra} WHERE id = ? AND restaurante_id = ? AND estado IN (${desde.map(() => '?').join(',')})`,
    )
    .bind(a, ...valores, id, rid, ...desde)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Este pedido ya cambió de estado. Actualiza la pantalla.', undefined, 409);
  await anotar(db, id, a, rid);
}

operacion.post('/restaurante/pedidos/:id/aceptar', async (c) => {
  const rid = await miRestauranteId(c);
  const { minutos } = await leerCuerpo(c, z.object({ minutos: z.number().int().min(5).max(120) }));
  const pendiente = await base(c)
    .prepare("SELECT 1 FROM ajustes_pedido WHERE pedido_id = ? AND estado = 'pendiente'")
    .bind(c.req.param('id'))
    .first();
  if (pendiente)
    throw new ErrorDatos(
      'Espera a que el cliente decida sobre el plato que falta.',
      undefined,
      409,
    );
  await cambiarEstado(
    base(c),
    c.req.param('id'),
    rid,
    ['pagado'],
    'aceptado',
    ", aceptado_en = datetime('now'), tiempo_prep_min = ?",
    [minutos],
  );
  await avisarAlCliente(c.env, base(c), c.req.param('id'), (i, f) =>
    AVISOS.pedidoAceptado(i, f.restaurante),
  );
  return c.json({ ok: true });
});

operacion.post('/restaurante/pedidos/:id/listo', async (c) => {
  const rid = await miRestauranteId(c);
  await cambiarEstado(
    base(c),
    c.req.param('id'),
    rid,
    ['aceptado'],
    'listo',
    ", listo_en = datetime('now')",
  );
  await avisarAlCliente(c.env, base(c), c.req.param('id'), (i, f) =>
    AVISOS.listo(i, f.restaurante),
  );
  await avisarAlRepartidor(c.env, base(c), c.req.param('id'), (i, f) =>
    AVISOS.repListo(i, f.restaurante),
  );
  return c.json({ ok: true });
});

/**
 * Algo agotado: antes de que salga un repartidor, el restaurante marca el plato que no tiene.
 * Al cliente le llega el aviso y decide en su app: quitarlo (se le devuelve esa parte) o cancelar
 * todo. Si no responde en 5 minutos, se quita. Mientras tanto el Manager no cuenta la espera.
 */
operacion.post('/restaurante/pedidos/:id/falta', async (c) => {
  const rid = await miRestauranteId(c);
  const db = base(c);
  const id = c.req.param('id');
  const { platoId } = await leerCuerpo(c, z.object({ platoId: z.string().min(1) }));
  const f = await db
    .prepare(
      `SELECT p.*, ${CON_AJUSTE}, r.nombre AS restaurante_nombre FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.id = ? AND p.restaurante_id = ? AND p.estado IN ('pagado','aceptado') AND p.repartidor_id IS NULL`,
    )
    .bind(id, rid)
    .first<FilaPedido>();
  if (!f)
    throw new ErrorDatos(
      'Este pedido ya salió o ya cambió de estado: no se puede quitar un plato.',
      undefined,
      409,
    );
  if (f.aj_plato) throw new ErrorDatos('Ya avisaste de un plato en este pedido.', undefined, 409);
  const linea = (
    JSON.parse(String(f.lineas_json)) as { platoId: string; nombreEs: string; nombreEn: string }[]
  ).find((l) => l.platoId === platoId);
  if (!linea) throw new ErrorDatos('Ese plato no está en este pedido.', 'platoId', 404);
  const { devolucion } = await calcularSinPlato(db, f, platoId);
  await db
    .prepare(
      'INSERT INTO ajustes_pedido (pedido_id, plato_id, nombre_es, nombre_en, devolucion) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(id, platoId, linea.nombreEs, linea.nombreEn, devolucion)
    .run();
  await anotarEvento(db, id, 'plato_agotado', linea.nombreEs);
  await avisarAlCliente(c.env, db, id, (i, ff) =>
    AVISOS.faltaPlato(
      i,
      i === 'en' ? linea.nombreEn || linea.nombreEs : linea.nombreEs,
      ff.restaurante,
    ),
  );
  return c.json({ ok: true, devolucion });
});

/** Ajustar el tiempo de preparación después de aceptar, mientras no haya salido un repartidor. */
operacion.patch('/restaurante/pedidos/:id/tiempo', async (c) => {
  const rid = await miRestauranteId(c);
  const { minutos } = await leerCuerpo(c, z.object({ minutos: z.number().int().min(5).max(120) }));
  const r = await base(c)
    .prepare(
      "UPDATE pedidos SET tiempo_prep_min = ? WHERE id = ? AND restaurante_id = ? AND estado = 'aceptado' AND repartidor_id IS NULL",
    )
    .bind(minutos, c.req.param('id'), rid)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos(
      'Ya hay un repartidor en camino: el tiempo no se puede cambiar. Avísale por la app si va a tardar.',
      undefined,
      409,
    );
  await anotarEvento(base(c), c.req.param('id'), 'tiempo_ajustado', `${minutos} min`);
  return c.json({ ok: true });
});

/** Rechazar un pedido pagado: se cancela y se le devuelve TODO el dinero al cliente. */
operacion.post('/restaurante/pedidos/:id/rechazar', async (c) => {
  const rid = await miRestauranteId(c);
  const ok = await cancelarConReembolso(c.env, base(c), c.req.param('id'), {
    desde: ['pagado', 'aceptado'],
    actorId: rid,
    restauranteId: rid,
  });
  if (!ok) throw new ErrorDatos('Este pedido ya no se puede rechazar.', undefined, 409);
  await anotarEvento(base(c), c.req.param('id'), 'rechazado_por_restaurante');
  // El repartidor que ya iba hacia el local se entera en el momento (C-REPARTIDOR-GRANDES).
  await avisarAlRepartidor(c.env, base(c), c.req.param('id'), (i, f) =>
    AVISOS.repCancelado(i, f.restaurante),
  );
  return c.json({ ok: true });
});

/** Inicio y fin (en hora UTC de la base) del día de hoy en la zona horaria del restaurante. */
export function limitesDelDia(zonaHoraria: string, ahora = new Date()): [string, string] {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(ahora)
    .reduce<Record<string, string>>((m, p) => ({ ...m, [p.type]: p.value }), {});
  const localComoUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour),
    Number(partes.minute),
  );
  const desfase = localComoUtc - Math.floor(ahora.getTime() / 60_000) * 60_000;
  const inicio =
    Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day)) - desfase;
  const sql = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
  return [sql(inicio), sql(inicio + 86_400_000)];
}

/** Resumen del día: pedidos, ventas, regalos, comisión y lo que le toca al restaurante. */
operacion.get('/restaurante/resumen', async (c) => {
  const rid = await miRestauranteId(c);
  const db = base(c);
  const z = await db
    .prepare(
      'SELECT z.zona_horaria FROM restaurantes r JOIN zonas z ON z.id = r.zona_id WHERE r.id = ?',
    )
    .bind(rid)
    .first<{ zona_horaria: string }>();
  const [desde, hasta] = limitesDelDia(z?.zona_horaria ?? 'America/New_York');
  const f = await db
    .prepare(
      `SELECT COUNT(CASE WHEN estado = 'entregado' THEN 1 END) AS entregados,
      COUNT(CASE WHEN estado IN ('pagado','aceptado','listo','en_camino') THEN 1 END) AS en_curso,
      COUNT(CASE WHEN estado = 'cancelado' THEN 1 END) AS cancelados,
      COALESCE(SUM(CASE WHEN estado = 'entregado' THEN subtotal END), 0) AS ventas,
      COALESCE(SUM(CASE WHEN estado = 'entregado' THEN regalo END), 0) AS regalos,
      COALESCE(SUM(CASE WHEN estado = 'entregado' THEN comision END), 0) AS comision,
      COALESCE(SUM(CASE WHEN estado = 'entregado' THEN pago_restaurante END), 0) AS neto
      FROM pedidos WHERE restaurante_id = ? AND pagado_en >= ? AND pagado_en < ?`,
    )
    .bind(rid, desde, hasta)
    .first<Record<string, number>>();
  // Los últimos 30 días y el plan: con eso el panel compara lo que le queda con Tumbite y con
  // otras apps (calculadora de «Beneficios», C-COMPARA-REST).
  const mes = await db
    .prepare(
      `SELECT COALESCE(SUM(p.subtotal), 0) AS ventas, COALESCE(SUM(p.regalo), 0) AS regalos,
      COUNT(p.id) AS pedidos, r.plan AS plan
      FROM restaurantes r LEFT JOIN pedidos p ON p.restaurante_id = r.id AND p.estado = 'entregado'
      AND p.pagado_en >= datetime('now','-30 days') WHERE r.id = ?`,
    )
    .bind(rid)
    .first<{ ventas: number; regalos: number; pedidos: number; plan: string }>();
  return c.json({
    plan: mes?.plan ?? 'inicial',
    mes: {
      ventas: Number(mes?.ventas ?? 0),
      regalos: Number(mes?.regalos ?? 0),
      pedidos: Number(mes?.pedidos ?? 0),
    },
    resumen: {
      entregados: Number(f?.entregados ?? 0),
      enCurso: Number(f?.en_curso ?? 0),
      cancelados: Number(f?.cancelados ?? 0),
      ventas: Number(f?.ventas ?? 0),
      regalos: Number(f?.regalos ?? 0),
      comision: Number(f?.comision ?? 0),
      neto: Number(f?.neto ?? 0),
    },
  });
});

/**
 * Tablero del restaurante: 7 y 30 días, platos más vendidos, tiempo real de cocina y su
 * calificación. Todo de sus propios pedidos. Candado C-TABLERO-REST.
 */
operacion.get('/restaurante/tablero', async (c) => {
  const rid = await miRestauranteId(c);
  const db = base(c);
  const periodo = async (dias: number) => {
    const f = await db
      .prepare(
        `SELECT COUNT(*) AS pedidos, COALESCE(SUM(subtotal), 0) AS ventas, COALESCE(SUM(pago_restaurante), 0) AS neto
         FROM pedidos WHERE restaurante_id = ? AND estado = 'entregado' AND pagado_en >= datetime('now', ?)`,
      )
      .bind(rid, `-${dias} days`)
      .first<{ pedidos: number; ventas: number; neto: number }>();
    const pedidos = Number(f?.pedidos ?? 0);
    const ventas = Number(f?.ventas ?? 0);
    return {
      pedidos,
      ventas,
      neto: Number(f?.neto ?? 0),
      ticketPromedio: pedidos ? Math.round(ventas / pedidos) : 0,
    };
  };
  const { results: filas } = await db
    .prepare(
      "SELECT lineas_json FROM pedidos WHERE restaurante_id = ? AND estado = 'entregado' AND pagado_en >= datetime('now','-30 days')",
    )
    .bind(rid)
    .all<{ lineas_json: string }>();
  const cuenta = new Map<string, { nombreEs: string; nombreEn: string; cantidad: number }>();
  for (const f of filas)
    for (const l of JSON.parse(f.lineas_json) as {
      platoId: string;
      nombreEs: string;
      nombreEn: string;
      cantidad: number;
    }[]) {
      const x = cuenta.get(l.platoId) ?? {
        nombreEs: l.nombreEs,
        nombreEn: l.nombreEn,
        cantidad: 0,
      };
      x.cantidad += l.cantidad;
      cuenta.set(l.platoId, x);
    }
  const tiempos = await db
    .prepare(
      `SELECT AVG((julianday(listo_en) - julianday(aceptado_en)) * 1440) AS cocina,
       AVG(tiempo_prep_min) AS prometido
       FROM pedidos WHERE restaurante_id = ? AND listo_en IS NOT NULL AND aceptado_en IS NOT NULL
       AND pagado_en >= datetime('now','-30 days')`,
    )
    .bind(rid)
    .first<{ cocina: number | null; prometido: number | null }>();
  const cal = await db
    .prepare(
      `SELECT AVG(c.estrellas_restaurante) AS promedio, COUNT(c.estrellas_restaurante) AS n
       FROM calificaciones c JOIN pedidos p ON p.id = c.pedido_id WHERE p.restaurante_id = ?`,
    )
    .bind(rid)
    .first<{ promedio: number | null; n: number }>();
  const ahora = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM pedidos WHERE restaurante_id = ? AND estado IN ('pagado','aceptado','listo')",
    )
    .bind(rid)
    .first<{ n: number }>();
  return c.json({
    tablero: {
      semana: await periodo(7),
      mes: await periodo(30),
      topPlatos: [...cuenta.values()].sort((a, b) => b.cantidad - a.cantidad).slice(0, 5),
      minutosCocina: tiempos?.cocina == null ? null : Math.round(tiempos.cocina),
      minutosPrometidos: tiempos?.prometido == null ? null : Math.round(tiempos.prometido),
      calificacion: cal?.promedio == null ? null : Math.round(cal.promedio * 10) / 10,
      calificaciones: Number(cal?.n ?? 0),
      pedidosAhora: Number(ahora?.n ?? 0),
    },
  });
});

// ======================= Repartidor =======================

async function miFicha(c: Ctx) {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  await db.prepare('INSERT OR IGNORE INTO repartidores (usuario_id) VALUES (?)').bind(u.id).run();
  // Cada repartidor nace con su ID (US-MIA-000123).
  await asegurarCodigoRepartidor(db, u.id);
  const f = await db
    .prepare('SELECT * FROM repartidores WHERE usuario_id = ?')
    .bind(u.id)
    .first<Record<string, unknown>>();
  return { u, db, ficha: f as Record<string, unknown> };
}

async function entregaActiva(db: D1Database, repartidorId: string) {
  return db
    .prepare(
      `SELECT p.*, ${CON_EVIDENCIAS}, ${CON_HITOS}, ${CON_EXCEPCION}, ${CON_BONO}, r.nombre AS restaurante_nombre, r.direccion AS restaurante_direccion, r.lat AS rest_lat, r.lng AS rest_lng, r.telefono AS restaurante_telefono
      FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.repartidor_id = ? AND p.estado IN ('aceptado','listo','en_camino')
      ORDER BY (SELECT MIN(o.rowid) FROM ofertas o WHERE o.pedido_id = p.id AND o.repartidor_id = p.repartidor_id), p.creado_en, p.id LIMIT 1`,
    )
    .bind(repartidorId)
    .first<FilaPedido>();
}

/** Los demás pedidos del mismo grupo que lleva este repartidor (agrupados), ya con sus datos. */
async function agrupadosDe(db: D1Database, repartidorId: string, activo: FilaPedido | null) {
  if (!activo?.grupo_id) return [];
  const { results } = await db
    .prepare(
      `SELECT p.*, ${CON_EVIDENCIAS}, ${CON_HITOS}, ${CON_EXCEPCION}, ${CON_BONO}, r.nombre AS restaurante_nombre, r.direccion AS restaurante_direccion, r.lat AS rest_lat, r.lng AS rest_lng, r.telefono AS restaurante_telefono
      FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id JOIN grupos_pedido g ON g.pedido_id = p.id
      WHERE p.repartidor_id = ? AND g.grupo_id = ? AND p.id != ? AND p.estado IN ('aceptado','listo','en_camino') ORDER BY p.creado_en`,
    )
    .bind(repartidorId, String(activo.grupo_id), String(activo.id))
    .all<FilaPedido>();
  return results.map(conDatosRestaurante);
}

operacion.get('/repartidor/estado', async (c) => {
  const { u, db, ficha } = await miFicha(c);
  const activo = await entregaActiva(db, u.id);
  const selfiePendiente = await db
    .prepare('SELECT 1 FROM selfies_control WHERE usuario_id = ? AND tomada_en IS NULL')
    .bind(u.id)
    .first();
  return c.json({
    selfieControlPendiente: Boolean(selfiePendiente),
    conectado: Number(ficha.conectado) === 1,
    pausado: Number(ficha.pausado ?? 0) === 1,
    tipo: ficha.tipo,
    puntos: Number(ficha.puntos),
    nivel: nivelDe(Number(ficha.puntos)),
    activo: activo ? conDatosRestaurante(activo) : null,
    agrupados: await agrupadosDe(db, u.id, activo),
  });
});

operacion.post('/repartidor/conectar', async (c) => {
  const { u, db } = await miFicha(c);
  const d = await leerCuerpo(
    c,
    z.object({
      conectado: z.boolean(),
      lat: z.number().nullable().default(null),
      lng: z.number().nullable().default(null),
    }),
  );
  // Con el KYC obligatorio encendido, sin verificación aprobada no se reciben pedidos.
  if (d.conectado && c.env.KYC_OBLIGATORIO === '1' && !(await kycAprobado(db, u.id)))
    throw new ErrorDatos(
      'Antes de conectarte, verifica tu identidad en «Mis datos y vehículo».',
      'kyc',
      403,
    );
  // Identidad continua: al conectarse, a algunos se les pide una selfie de control (al azar, no
  // más de una por semana). Mientras esté pendiente, no se conecta.
  if (d.conectado) {
    const pendiente = await db
      .prepare('SELECT 1 FROM selfies_control WHERE usuario_id = ? AND tomada_en IS NULL')
      .bind(u.id)
      .first();
    if (!pendiente) {
      const reciente = await db
        .prepare(
          "SELECT 1 FROM selfies_control WHERE usuario_id = ? AND pedida_en > datetime('now','-7 days')",
        )
        .bind(u.id)
        .first();
      // «1» = siempre (pruebas, recorrido); «0» = nunca (las demás pruebas); sin valor = al azar.
      const toca =
        c.env.SELFIE_CONTROL_SIEMPRE === '1' ||
        (c.env.SELFIE_CONTROL_SIEMPRE !== '0' && Math.random() < PROBABILIDAD_SELFIE);
      if (!reciente && toca)
        await db
          .prepare('INSERT INTO selfies_control (id, usuario_id) VALUES (?, ?)')
          .bind(nuevoId(), u.id)
          .run();
    }
    const debe = await db
      .prepare('SELECT 1 FROM selfies_control WHERE usuario_id = ? AND tomada_en IS NULL')
      .bind(u.id)
      .first();
    if (debe)
      throw new ErrorDatos(
        'Antes de conectarte, tómate la foto de control: es rápida y confirma que eres tú.',
        'selfie',
        409,
      );
  }
  // Ciudad y área de cobertura donde está ahora (C-TERRITORIO): define qué franquicia lo ve.
  const aqui = await cobertura(db, d.lat, d.lng);
  await db
    .prepare(
      "UPDATE repartidores SET conectado = ?, lat = COALESCE(?, lat), lng = COALESCE(?, lng), zona_id = COALESCE(?, zona_id), area_id = COALESCE(?, area_id), geohash = COALESCE(?, geohash), ubicacion_en = datetime('now') WHERE usuario_id = ?",
    )
    .bind(
      d.conectado ? 1 : 0,
      d.lat,
      d.lng,
      aqui.estado === 'dentro' ? (aqui.zona?.id ?? null) : null,
      aqui.area?.id ?? null,
      d.lat != null && d.lng != null ? geohash(d.lat, d.lng) : null,
      u.id,
    )
    .run();
  // Al conectarse se sale de la pausa; y si está fuera de cobertura, se le dice (como «no puedes
  // conectarte en esta zona» de Dasher): queda conectado en su ciudad de siempre, sin ofertas aquí.
  if (d.conectado)
    await db.prepare('UPDATE repartidores SET pausado = 0 WHERE usuario_id = ?').bind(u.id).run();
  return c.json({ conectado: d.conectado, cobertura: aqui.estado });
});

operacion.post('/repartidor/ubicacion', async (c) => {
  const { u, db } = await miFicha(c);
  const d = await leerCuerpo(c, puntoConPrecision);
  const { muestras, salto } = await guardarMuestra(db, u.id, d);
  if (salto) {
    // No se mueve la ficha ni cuenta para los hitos; queda anotado en el pedido activo.
    const activo = await db
      .prepare(
        "SELECT id FROM pedidos WHERE repartidor_id = ? AND estado IN ('aceptado','listo','en_camino') LIMIT 1",
      )
      .bind(u.id)
      .first<{ id: string }>();
    if (activo)
      await anotarEvento(db, activo.id, 'gps_salto', `${d.lat.toFixed(4)},${d.lng.toFixed(4)}`);
    return c.json({ ok: true, salto: true });
  }
  const aqui = await cobertura(db, d.lat, d.lng);
  await db
    .prepare(
      "UPDATE repartidores SET lat = ?, lng = ?, zona_id = COALESCE(?, zona_id), area_id = COALESCE(?, area_id), geohash = ?, ubicacion_en = datetime('now') WHERE usuario_id = ?",
    )
    .bind(
      d.lat,
      d.lng,
      aqui.estado === 'dentro' ? (aqui.zona?.id ?? null) : null,
      aqui.area?.id ?? null,
      geohash(d.lat, d.lng),
      u.id,
    )
    .run();
  await registrarHitos(c.env, db, u.id, d, muestras).catch((e: unknown) =>
    console.error('hitos', e),
  );
  return c.json({ ok: true });
});

/**
 * Reparto: cada pedido listo para buscar repartidor se ofrece primero al más CERCANO al restaurante.
 * Si dos están igual de cerca (menos de medio km de diferencia), gana el de nivel más alto.
 * Rechazar o dejar vencer la oferta (60 s) solo la pasa al siguiente: no castiga.
 */
type Libre = { id: string; lat: number; lng: number; puntos: number };

/** Repartidores libres de una zona (y, si se piden, solo de esas celdas del mapa). */
async function conSaldoParaDirecto<T extends { id: string }>(
  db: D1Database,
  pedidoId: string,
  candidatos: T[],
): Promise<T[]> {
  const fuera: T[] = [];
  for (const d of candidatos) if ((await puedeTomarDirecto(db, pedidoId, d.id)).ok) fuera.push(d);
  return fuera;
}

async function libresEn(db: D1Database, zonaId: string, celdas: string[] | null): Promise<Libre[]> {
  const filtroCeldas = celdas ? `AND d.geohash IN (${celdas.map(() => '?').join(',')})` : '';
  const { results } = await db
    .prepare(
      `SELECT d.usuario_id AS id, d.lat, d.lng, d.puntos FROM repartidores d
      WHERE d.zona_id = ? AND d.conectado = 1 AND d.pausado = 0 ${filtroCeldas} AND d.lat IS NOT NULL
      AND d.ubicacion_en > datetime('now','-10 minutes')
      AND NOT EXISTS (SELECT 1 FROM pedidos p WHERE p.repartidor_id = d.usuario_id AND p.estado IN ('aceptado','listo','en_camino'))
      AND NOT EXISTS (SELECT 1 FROM ofertas o WHERE o.repartidor_id = d.usuario_id AND o.estado = 'ofrecida')
      AND NOT EXISTS (SELECT 1 FROM conductor_ocupacion c WHERE c.conductor_id = d.usuario_id)
      AND NOT EXISTS (SELECT 1 FROM ofertas_operacion x WHERE x.conductor_id = d.usuario_id AND x.estado = 'ofrecida')`,
    )
    .bind(zonaId, ...(celdas ?? []))
    .all<Libre>();
  return results;
}

/** Desvío máximo entre dos entregas para agruparlas (≈ 5 minutos de ciudad). */
const KM_DESVIO_AGRUPAR = 2;

/**
 * Repartidores ocupados que pueden llevar este pedido junto con el que ya tienen: mismo
 * restaurante, el suyo todavía sin recoger, sin oferta abierta, y las dos entregas cerca.
 */
async function agrupablesPara(db: D1Database, pedidoId: string): Promise<Libre[]> {
  const { results } = await db
    .prepare(
      `SELECT d.usuario_id AS id, d.lat, d.lng, d.puntos, q.lat AS q_lat, q.lng AS q_lng, p.lat AS p_lat, p.lng AS p_lng
       FROM pedidos p JOIN pedidos q ON q.restaurante_id = p.restaurante_id AND q.id != p.id
       JOIN repartidores d ON d.usuario_id = q.repartidor_id
       WHERE p.id = ? AND q.estado IN ('aceptado','listo') AND q.repartidor_id IS NOT NULL
       AND d.conectado = 1 AND d.lat IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM recogidas rc WHERE rc.pedido_id = q.id)
       AND NOT EXISTS (SELECT 1 FROM grupos_pedido g WHERE g.pedido_id = q.id)
       AND NOT EXISTS (SELECT 1 FROM ofertas o WHERE o.repartidor_id = d.usuario_id AND o.estado = 'ofrecida')
       AND NOT EXISTS (SELECT 1 FROM conductor_ocupacion c WHERE c.conductor_id = d.usuario_id AND c.tipo <> 'comida')
       AND NOT EXISTS (SELECT 1 FROM ofertas_operacion x WHERE x.conductor_id = d.usuario_id AND x.estado = 'ofrecida')
       LIMIT 10`,
    )
    .bind(pedidoId)
    .all<
      Libre & {
        q_lat: number | null;
        q_lng: number | null;
        p_lat: number | null;
        p_lng: number | null;
      }
    >();
  return results.filter(
    (r) =>
      r.q_lat != null &&
      r.q_lng != null &&
      r.p_lat != null &&
      r.p_lng != null &&
      distanciaKm({ lat: r.q_lat, lng: r.q_lng }, { lat: r.p_lat, lng: r.p_lng }) <=
        KM_DESVIO_AGRUPAR,
  );
}

export async function repartirOfertas(db: D1Database, env?: Env): Promise<void> {
  await db
    .prepare(
      `UPDATE ofertas SET estado = 'vencida' WHERE estado = 'ofrecida' AND creada_en < datetime('now', ?)`,
    )
    .bind(`-${SEGUNDOS_OFERTA} seconds`)
    .run();
  const { results: pendientes } = await db
    .prepare(
      `SELECT p.id, p.zona_id, p.pago_repartidor, p.estado, p.aceptado_en, p.tiempo_prep_min, r.lat, r.lng, r.geohash FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
      WHERE p.estado IN ('aceptado','listo') AND p.repartidor_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM recogidas rc WHERE rc.pedido_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM ofertas o WHERE o.pedido_id = p.id AND o.estado = 'ofrecida') ORDER BY p.pagado_en LIMIT 20`,
    )
    .all<{
      id: string;
      zona_id: string;
      pago_repartidor: number | null;
      estado: string;
      aceptado_en: string | null;
      tiempo_prep_min: number | null;
      lat: number | null;
      lng: number | null;
      geohash: string | null;
    }>();
  if (!pendientes.length) return;
  const ocupados = new Set<string>();
  for (const p of pendientes) {
    const { results: yaVistos } = await db
      .prepare('SELECT repartidor_id FROM ofertas WHERE pedido_id = ?')
      .bind(p.id)
      .all<{ repartidor_id: string }>();
    const vistos = new Set(yaVistos.map((v) => v.repartidor_id));
    // Despacho con reloj: solo a quien llegaría cuando la comida esté lista (ni antes a esperar).
    const faltan = minutosParaListo(p.estado, p.aceptado_en, p.tiempo_prep_min);
    const ordenar = (libres: Libre[]) =>
      libres
        .filter((d) => !vistos.has(d.id) && !ocupados.has(d.id))
        .map((d) => ({
          ...d,
          km:
            p.lat != null && p.lng != null
              ? distanciaKm({ lat: d.lat, lng: d.lng }, { lat: p.lat, lng: p.lng })
              : 0,
        }))
        .filter((d) => d.km <= 15 && debeOfrecer(faltan, d.km))
        .sort(
          (a, b) =>
            Math.floor(a.km * 2) - Math.floor(b.km * 2) ||
            nivelDe(b.puntos).indice - nivelDe(a.puntos).indice ||
            a.km - b.km,
        );
    // Camino rápido: solo la celda del restaurante y sus 8 vecinas (índice zona + celda).
    // Si ahí no hay nadie libre, se busca en toda la zona. Nunca se cruza de zona.
    let candidatos = p.geohash
      ? ordenar(await libresEn(db, p.zona_id, celdasVecinas(p.geohash)))
      : [];
    if (!candidatos.length) candidatos = ordenar(await libresEn(db, p.zona_id, null));
    // Fase 2 · cobro directo: solo a quien tiene saldo para la comisión y no pasó el tope de efectivo.
    candidatos = await conSaldoParaDirecto(db, p.id, candidatos);
    // Agrupar: un repartidor que todavía no recogió otro pedido de este MISMO restaurante y cuya
    // entrega queda cerca de esta (desvío menor a 5 minutos) se lo lleva en el mismo viaje.
    if (!candidatos.length) candidatos = ordenar(await agrupablesPara(db, p.id));
    if (!candidatos.length) continue;
    // Oferta abierta: a los 3 rechazos (o vencimientos) se ofrece a todos a la vez con un bono
    // que paga Tumbite. Todos los que ya la vieron son rechazos o vencimientos (no hay ofrecida).
    let bono = 0;
    if (vistos.size >= RECHAZOS_PARA_ABRIR) {
      bono = BONO_OFERTA_ABIERTA;
      const r = await db
        .prepare(
          "INSERT OR IGNORE INTO bonos_pedido (pedido_id, centavos, motivo) VALUES (?, ?, 'oferta_abierta')",
        )
        .bind(p.id, bono)
        .run();
      if (r.meta.changes)
        await anotarEvento(db, p.id, 'oferta_abierta', `${vistos.size} rechazos, bono $1`);
    }
    const elegidos = bono ? candidatos.slice(0, 20) : candidatos.slice(0, 1);
    for (const elegido of elegidos) {
      ocupados.add(elegido.id);
      await db
        .prepare(
          "INSERT OR REPLACE INTO ofertas (pedido_id, repartidor_id, estado) VALUES (?, ?, 'ofrecida')",
        )
        .bind(p.id, elegido.id)
        .run();
      if (env) {
        const rep = await db
          .prepare('SELECT idioma FROM usuarios WHERE id = ?')
          .bind(elegido.id)
          .first<{ idioma: string }>();
        const i = rep?.idioma === 'en' ? 'en' : 'es';
        const km =
          p.lat != null && p.lng != null
            ? distanciaKm(
                { lat: elegido.lat, lng: elegido.lng },
                { lat: Number(p.lat), lng: Number(p.lng) },
              )
            : 0;
        await notificar(
          env,
          db,
          elegido.id,
          AVISOS.ofertaNueva(
            i,
            formatearDolares(Number(p.pago_repartidor ?? 0) + bono, i),
            km.toFixed(1),
          ),
        );
      }
    }
  }
}

/** Aviso al celular del cliente de un pedido, en su idioma. Nunca frena la operación. */
async function avisarAlCliente(
  env: Env,
  db: D1Database,
  pedidoId: string,
  aviso: (idioma: string, f: { restaurante: string }) => { titulo: string; cuerpo: string },
  /** Con un tipo, el mismo aviso también va por SMS de respaldo (si Twilio está configurado). */
  smsTipo: string | null = null,
) {
  const f = await db
    .prepare(
      'SELECT p.cliente_id, u.idioma, u.telefono, r.nombre AS restaurante FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.id = ?',
    )
    .bind(pedidoId)
    .first<{ cliente_id: string; idioma: string; telefono: string | null; restaurante: string }>();
  if (!f) return;
  const texto = aviso(f.idioma, { restaurante: f.restaurante });
  await notificar(env, db, f.cliente_id, { ...texto, datos: { pedidoId } });
  if (smsTipo)
    await enviarSms(env, db, {
      usuarioId: f.cliente_id,
      pedidoId,
      tipo: smsTipo,
      telefono: f.telefono,
      texto: `Tumbite: ${texto.titulo}. ${texto.cuerpo}`,
    }).catch((e: unknown) => console.error('sms respaldo', e));
}

/** Aviso al celular del repartidor asignado a un pedido, en su idioma. Nunca frena la operación. */
export async function avisarAlRepartidor(
  env: Env,
  db: D1Database,
  pedidoId: string,
  aviso: (idioma: string, f: { restaurante: string }) => { titulo: string; cuerpo: string },
) {
  const f = await db
    .prepare(
      'SELECT p.repartidor_id, u.idioma, r.nombre AS restaurante FROM pedidos p JOIN usuarios u ON u.id = p.repartidor_id JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.id = ? AND p.repartidor_id IS NOT NULL',
    )
    .bind(pedidoId)
    .first<{ repartidor_id: string; idioma: string; restaurante: string }>();
  if (!f) return;
  await notificar(env, db, f.repartidor_id, {
    ...aviso(f.idioma, { restaurante: f.restaurante }),
    datos: { pedidoId },
  }).catch((e: unknown) => console.error('aviso al repartidor', e));
}

function conDatosRestaurante(f: FilaPedido) {
  return {
    ...aPedido(f),
    restaurante: {
      nombre: String(f.restaurante_nombre ?? ''),
      direccion: String(f.restaurante_direccion ?? ''),
      telefono: String(f.restaurante_telefono ?? ''),
      lat: f.rest_lat == null ? null : Number(f.rest_lat),
      lng: f.rest_lng == null ? null : Number(f.rest_lng),
    },
    // El bono de la oferta abierta se suma a lo que gana (lo paga Tumbite al entregar).
    pagoRepartidor: Number(f.pago_repartidor) + Number(f.bono ?? 0),
    bono: Number(f.bono ?? 0),
    distanciaKm: f.distancia_km == null ? null : Number(f.distancia_km),
    // Lo que la app del repartidor necesita saber de sus propios pasos.
    verificado: f.h_verificado != null,
    llegoRestaurante: f.h_llego_rest != null,
    llegoCliente: f.h_llego_cli != null,
    noApareceEn: (f.h_no_aparece as string | null) ?? null,
    excepcionUbicacion: (f.excepcion_ubicacion as 'pedida' | 'autorizada' | null) ?? null,
    // Para que el repartidor sepa cuánto falta en cocina (0 = ya está listo).
    minutosParaListo: minutosParaListo(
      String(f.estado),
      (f.aceptado_en as string | null) ?? null,
      f.tiempo_prep_min == null ? null : Number(f.tiempo_prep_min),
    ),
  };
}

operacion.get('/repartidor/ofertas', async (c) => {
  const { u, db, ficha } = await miFicha(c);
  await repartirOfertas(db, c.env);
  const { results } = await db
    .prepare(
      `SELECT p.*, ${CON_BONO}, r.nombre AS restaurante_nombre, r.direccion AS restaurante_direccion, r.lat AS rest_lat, r.lng AS rest_lng, r.telefono AS restaurante_telefono, o.creada_en AS oferta_en
      FROM ofertas o JOIN pedidos p ON p.id = o.pedido_id JOIN restaurantes r ON r.id = p.restaurante_id
      WHERE o.repartidor_id = ? AND o.estado = 'ofrecida' AND p.repartidor_id IS NULL`,
    )
    .bind(u.id)
    .all<FilaPedido>();
  // Como en DoorDash y Uber: la oferta trae el viaje completo (hasta el local y hasta la casa),
  // los minutos estimados y cuántos artículos lleva, para decidir en 45 segundos con todo a la vista.
  const yo =
    ficha.lat != null && ficha.lng != null
      ? { lat: Number(ficha.lat), lng: Number(ficha.lng) }
      : null;
  return c.json({
    ofertas: results.map((f) => {
      const base = conDatosRestaurante(f);
      const rest =
        base.restaurante.lat != null && base.restaurante.lng != null
          ? { lat: base.restaurante.lat, lng: base.restaurante.lng }
          : null;
      const alLocal = yo && rest ? Math.round(distanciaKm(yo, rest) * 10) / 10 : null;
      const total =
        alLocal != null && base.distanciaKm != null
          ? Math.round((alLocal + base.distanciaKm) * 10) / 10
          : null;
      const viajeAlLocal = alLocal != null ? minutosDeViaje(alLocal) : 0;
      // Si la comida tarda más que el viaje al local, esa espera también cuenta.
      const espera = Math.max(0, (base.minutosParaListo ?? 0) - viajeAlLocal);
      const articulos = base.lineas.reduce((n, l) => n + Number(l.cantidad ?? 1), 0);
      return {
        ...base,
        distanciaAlLocalKm: alLocal,
        distanciaTotalKm: total,
        minutosEstimados: total != null ? minutosDeViaje(total) + espera : null,
        articulos,
        ofertaEn: String(f.oferta_en),
        segundos: SEGUNDOS_OFERTA,
      };
    }),
  });
});

/**
 * Fase 3 · La sentencia con la que un repartidor toma un pedido de Comida. Atómica: solo entra si
 * el pedido sigue sin repartidor, si el repartidor sigue con los pedidos que se vieron al decidir
 * (0, o 1 cuando se agrupa) y si no está en una operación de otro servicio. La base además lo
 * cuenta en conductor_ocupacion (y aborta si choca). Candado C-EXCLUSIVIDAD.
 */
export function tomarPedidoComida(
  db: D1Database,
  pedidoId: string,
  repartidorId: string,
  pedidosQueTiene: number,
) {
  return db
    .prepare(
      `UPDATE pedidos SET repartidor_id = ?1 WHERE id = ?2 AND repartidor_id IS NULL AND estado IN ('aceptado','listo')
        AND (SELECT COUNT(*) FROM pedidos q WHERE q.repartidor_id = ?1 AND q.estado IN ('aceptado','listo','en_camino')) = ?3
        AND NOT EXISTS (SELECT 1 FROM conductor_ocupacion c WHERE c.conductor_id = ?1 AND c.tipo <> 'comida')`,
    )
    .bind(repartidorId, pedidoId, pedidosQueTiene)
    .run();
}

operacion.post('/repartidor/ofertas/:id/aceptar', async (c) => {
  const { u, db } = await miFicha(c);
  const id = c.req.param('id');
  const oferta = await db
    .prepare(
      "SELECT 1 FROM ofertas WHERE pedido_id = ? AND repartidor_id = ? AND estado = 'ofrecida'",
    )
    .bind(id, u.id)
    .first();
  if (!oferta) throw new ErrorDatos('Esta oferta ya no está disponible.', undefined, 409);
  // Fase 2 · cobro directo: sin saldo para la comisión (o pasado el tope de efectivo) no se acepta.
  const directo = await puedeTomarDirecto(db, id, u.id);
  if (!directo.ok)
    throw new ErrorDatos(
      directo.motivo === 'saldo'
        ? 'Te falta saldo para la comisión de este pedido. Recarga y vuelve a intentar.'
        : 'Llegaste al tope de efectivo del día. Concilia o recarga para seguir con pedidos en efectivo.',
      undefined,
      409,
    );
  const activa = await entregaActiva(db, u.id);
  let grupo: string | null = null;
  if (activa) {
    // Solo se agrupa con un pedido del mismo restaurante que todavía no recogió.
    const nuevo = await db
      .prepare('SELECT restaurante_id FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ restaurante_id: string }>();
    const puede =
      nuevo?.restaurante_id === String(activa.restaurante_id) &&
      ['aceptado', 'listo'].includes(String(activa.estado)) &&
      !activa.grupo_id;
    if (!puede)
      throw new ErrorDatos('Termina tu entrega actual antes de aceptar otra.', undefined, 409);
    grupo = nuevoId();
  }
  // Atómico: si dos tocan a la vez, solo uno se lo lleva. Fase 3: en la MISMA sentencia se
  // exige que el repartidor siga como lo vimos arriba (sin pedido, o con el único que se agrupa)
  // y la base (conductor_ocupacion) aborta si está en una operación de otro servicio.
  let r: D1Result;
  try {
    r = await tomarPedidoComida(db, id, u.id, activa ? 1 : 0);
  } catch (e) {
    if (esConductorOcupado(e))
      throw new ErrorDatos('Termina tu entrega actual antes de aceptar otra.', undefined, 409);
    throw e;
  }
  if (!r.meta.changes) {
    const tomado = await db
      .prepare('SELECT repartidor_id, estado FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ repartidor_id: string | null; estado: string }>();
    if (tomado?.repartidor_id === u.id) return c.json({ ok: true }); // doble toque: ya es tuyo
    if (tomado && !tomado.repartidor_id && ['aceptado', 'listo'].includes(tomado.estado))
      throw new ErrorDatos('Termina tu entrega actual antes de aceptar otra.', undefined, 409);
    if (tomado && !tomado.repartidor_id)
      throw new ErrorDatos('Esta oferta ya no está disponible.', undefined, 409);
    throw new ErrorDatos('Otro repartidor ya tomó este pedido.', undefined, 409);
  }
  // La comisión se aparta en el libro; si entre la comprobación y aquí otro canje la consumió,
  // el pedido vuelve a la fila y el repartidor recibe el aviso claro.
  try {
    await reservarAlAceptar(db, id, u.id);
  } catch (e) {
    await soltarPedido(db, id, u.id, 'sin saldo para la comisión');
    throw e;
  }
  if (grupo && activa) {
    await db.batch([
      db
        .prepare('INSERT OR REPLACE INTO grupos_pedido (pedido_id, grupo_id) VALUES (?, ?)')
        .bind(String(activa.id), grupo),
      db
        .prepare('INSERT OR REPLACE INTO grupos_pedido (pedido_id, grupo_id) VALUES (?, ?)')
        .bind(id, grupo),
    ]);
    await anotarEvento(db, id, 'agrupado', `con #${String(activa.id).slice(0, 6).toUpperCase()}`);
  }
  await db.batch([
    db
      .prepare("UPDATE ofertas SET estado = 'aceptada' WHERE pedido_id = ? AND repartidor_id = ?")
      .bind(id, u.id),
    // En la oferta abierta la vieron varios: a los demás se les quita.
    db
      .prepare(
        "UPDATE ofertas SET estado = 'vencida' WHERE pedido_id = ? AND estado = 'ofrecida' AND repartidor_id != ?",
      )
      .bind(id, u.id),
  ]);
  const v = await db
    .prepare('SELECT vehiculo_tipo, color, placa FROM repartidor_datos WHERE usuario_id = ?')
    .bind(u.id)
    .first<{ vehiculo_tipo: string; color: string; placa: string }>();
  const vehiculo = [
    v?.color,
    v?.vehiculo_tipo?.replace('_', ' '),
    v?.placa ? `· ${v.placa.slice(-4)}` : '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  await avisarAlCliente(c.env, db, id, (i) =>
    AVISOS.repartidorAsignado(i, u.nombre.split(' ')[0] ?? '', vehiculo),
  );
  return c.json({ ok: true });
});

operacion.post('/repartidor/ofertas/:id/rechazar', async (c) => {
  const { u, db } = await miFicha(c);
  await db
    .prepare(
      "UPDATE ofertas SET estado = 'rechazada' WHERE pedido_id = ? AND repartidor_id = ? AND estado = 'ofrecida'",
    )
    .bind(c.req.param('id'), u.id)
    .run();
  return c.json({ ok: true });
});

/** La foto que manda el celular y dónde estaba al tomarla (en la dirección: ?lat=…&lng=…). */
async function leerFoto(c: Ctx) {
  if (!c.env.BUCKET)
    throw new ErrorDatos(
      'El almacén de fotos no está disponible en este momento. Intenta más tarde.',
      undefined,
      503,
    );
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength === 0)
    throw new ErrorDatos('Falta la foto. Tómala y vuelve a intentar.', 'foto', 400);
  if (bytes.byteLength > MAX_FOTO_BYTES)
    throw new ErrorDatos('La foto pesa demasiado. El máximo es 3 MB.', 'foto', 413);
  const tipo = tipoReal(bytes);
  if (!tipo) throw new ErrorDatos('Sube una foto en JPG, PNG o WebP.', 'foto', 415);
  const lat = Number(c.req.query('lat'));
  const lng = Number(c.req.query('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    throw new ErrorDatos(
      'Necesitamos tu ubicación para confirmar que estás en el lugar. Revisa que el GPS esté encendido.',
      undefined,
      422,
    );
  return { bytes, tipo, donde: { lat, lng }, bucket: c.env.BUCKET };
}

async function guardarEvidencia(
  db: D1Database,
  foto: Awaited<ReturnType<typeof leerFoto>>,
  pedidoId: string,
  tipo: 'recogida' | 'entrega',
  distanciaM: number | null,
  confirmada: boolean,
  modo: string | null = null,
  nota = '',
) {
  const clave = `evidencias/${pedidoId}/${tipo}-${nuevoId()}`;
  await foto.bucket.put(clave, foto.bytes, {
    httpMetadata: { contentType: foto.tipo, cacheControl: 'private, no-store' },
  });
  await db
    .prepare(
      `INSERT OR REPLACE INTO evidencias (pedido_id, tipo, clave, lat, lng, distancia_m, modo, nota, creada_en, confirmada_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ${confirmada ? "datetime('now')" : 'NULL'})`,
    )
    .bind(pedidoId, tipo, clave, foto.donde.lat, foto.donde.lng, distanciaM, modo, nota)
    .run();
}

const lejos = (metros: number | null) => metros != null && metros > RADIO_LLEGADA_M;
/** Las cuentas de los revisores de las tiendas prueban desde otra ciudad: sin regla de distancia. */
const esRevisor = (c: Ctx, correo: string) =>
  (c.env.CORREOS_REVISOR ?? '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .includes(correo.toLowerCase());
const comoPunto = (lat: unknown, lng: unknown) =>
  lat == null || lng == null ? null : { lat: Number(lat), lng: Number(lng) };

/**
 * Recoger: el repartidor, en el restaurante, toma la foto del pedido cerrado. El pedido NO sale
 * todavía: el restaurante ve la foto en su pantalla y confirma que se lo entregó a esa persona.
 * Así nadie se lleva una bolsa sin dejar rastro. Se puede repetir la foto antes de que confirmen.
 */
operacion.post('/repartidor/pedidos/:id/foto-recogida', async (c) => {
  const { u, db } = await miFicha(c);
  const id = c.req.param('id');
  const p = await db
    .prepare(
      "SELECT r.lat, r.lng FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.id = ? AND p.repartidor_id = ? AND p.estado = 'listo'",
    )
    .bind(id, u.id)
    .first<{ lat: number | null; lng: number | null }>();
  if (!p)
    throw new ErrorDatos('El restaurante todavía no marcó el pedido como listo.', undefined, 409);
  // Cobro directo: sin el pago de la comida registrado (monto, ticket, método), no sale.
  await exigirPagoLocal(db, id);
  const foto = await leerFoto(c);
  const rest = comoPunto(p.lat, p.lng);
  const metros = rest ? metrosEntre(foto.donde, rest) : null;
  if (lejos(metros) && !esRevisor(c, u.correo))
    throw new ErrorDatos(
      'Todavía no estás en el restaurante. Acércate y vuelve a tomar la foto.',
      undefined,
      409,
    );
  await guardarEvidencia(db, foto, id, 'recogida', metros, false);
  // La foto en el restaurante prueba que llegó (por si el GPS no alcanzó a marcarlo antes).
  await db
    .prepare("INSERT OR IGNORE INTO hitos_pedido (pedido_id, hito) VALUES (?, 'llego_restaurante')")
    .bind(id)
    .run();
  await anotarEvento(db, id, 'foto_recogida');
  const verificado = await db
    .prepare("SELECT 1 FROM hitos_pedido WHERE pedido_id = ? AND hito = 'verificado'")
    .bind(id)
    .first();
  if (verificado) await salirEnCamino(c.env, db, id, u.id);
  return c.json({ ok: true, salio: !!verificado, url: `/datos/pedidos/${id}/evidencia/recogida` });
});

/** El restaurante confirma que le entregó el pedido a ese repartidor: ahora sí sale en camino. */
operacion.post('/restaurante/pedidos/:id/confirmar-recogida', async (c) => {
  const rid = await miRestauranteId(c);
  const db = base(c);
  const id = c.req.param('id');
  const ev = await db
    .prepare(
      "SELECT 1 FROM evidencias e JOIN pedidos p ON p.id = e.pedido_id WHERE e.pedido_id = ? AND e.tipo = 'recogida' AND p.restaurante_id = ? AND p.estado = 'listo'",
    )
    .bind(id, rid)
    .first();
  if (!ev)
    throw new ErrorDatos(
      'El repartidor todavía no tomó la foto del pedido. Pídele que la tome en su app.',
      undefined,
      409,
    );
  await exigirPagoLocal(db, id);
  await salirEnCamino(c.env, db, id, rid);
  // Cobro directo: al confirmar la entrega, el restaurante confirma también que le pagaron.
  await confirmarPagoLocalRestaurante(db, id, rid);
  return c.json({ ok: true });
});

/**
 * El repartidor escanea el código QR de la pantalla del restaurante (o escribe los 4 caracteres
 * del número): la app comprueba que es el pedido correcto. Con el código verificado, la foto de
 * la bolsa hace salir el pedido sin que el restaurante tenga que tocar nada.
 */
operacion.post('/repartidor/pedidos/:id/verificar', async (c) => {
  const { u, db } = await miFicha(c);
  const id = c.req.param('id');
  const { codigo } = await leerCuerpo(c, z.object({ codigo: z.string().trim().min(1).max(80) }));
  const p = await db
    .prepare(
      "SELECT id FROM pedidos WHERE id = ? AND repartidor_id = ? AND estado IN ('listo','aceptado')",
    )
    .bind(id, u.id)
    .first<{ id: string }>();
  if (!p) throw new ErrorDatos('Este pedido no está contigo.', undefined, 409);
  const limpio = codigo.replace(/^tumbite:pedido:/i, '').trim();
  const correcto = limpio === p.id || limpio.toUpperCase() === p.id.slice(0, 4).toUpperCase();
  if (!correcto)
    throw new ErrorDatos(
      'Ese código no es de este pedido. Escanea el de la pantalla del restaurante.',
      'codigo',
      409,
    );
  await db
    .prepare("INSERT OR IGNORE INTO hitos_pedido (pedido_id, hito) VALUES (?, 'verificado')")
    .bind(id)
    .run();
  // Si la foto de la bolsa ya estaba tomada, con el código verificado el pedido sale ya.
  const conFoto = await db
    .prepare("SELECT 1 FROM evidencias WHERE pedido_id = ? AND tipo = 'recogida'")
    .bind(id)
    .first();
  if (conFoto) await salirEnCamino(c.env, db, id, u.id);
  return c.json({ ok: true, correcto: true, salio: !!conFoto });
});

/**
 * Entregado: solo en la puerta (a menos de 200 m de la dirección) y con la foto de la entrega.
 * Se acredita a cada billetera, una sola vez (el libro no permite repetir pedido + concepto).
 */
/**
 * «No puedo confirmar mi ubicación»: el GPS no da en la puerta (edificio, túnel, celular viejo). El
 * repartidor explica por qué, soporte lo autoriza desde el panel y queda quién y cuándo. Solo con
 * la autorización se puede entregar sin la comprobación del GPS.
 */
operacion.post('/repartidor/pedidos/:id/no-puedo-confirmar', async (c) => {
  const { u, db } = await miFicha(c);
  const id = c.req.param('id');
  const d = await leerCuerpo(c, z.object({ motivo: z.string().trim().min(5).max(300) }));
  const p = await db
    .prepare(
      "SELECT r.nombre AS restaurante FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.id = ? AND p.repartidor_id = ? AND p.estado = 'en_camino'",
    )
    .bind(id, u.id)
    .first<{ restaurante: string }>();
  if (!p) throw new ErrorDatos('Este pedido no está en camino contigo.', undefined, 409);
  await db
    .prepare(
      'INSERT INTO excepciones_ubicacion (pedido_id, motivo) VALUES (?, ?) ON CONFLICT(pedido_id) DO UPDATE SET motivo = excluded.motivo',
    )
    .bind(id, d.motivo)
    .run();
  await anotarEvento(db, id, 'ubicacion_sin_confirmar', d.motivo);
  const corto = id.slice(0, 6).toUpperCase();
  for (const para of (c.env.ADMIN_CORREOS ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean))
    await enviarCorreo(c.env, {
      de: 'avisos',
      para,
      asunto: `Pedido #${corto}: el repartidor no puede confirmar su ubicación`,
      texto: `El repartidor del pedido #${corto} de ${p.restaurante} pide entregar sin la comprobación del GPS. Motivo: «${d.motivo}». Revísalo en el panel (Pedidos → #${corto}) y autoriza si corresponde.`,
    }).catch((e: unknown) => console.error('excepción ubicación: correo', e));
  return c.json({ ok: true, estado: 'pedida' });
});

operacion.post('/repartidor/pedidos/:id/entregado', async (c) => {
  const { u, db } = await miFicha(c);
  const id = c.req.param('id');
  const p = await db
    .prepare(
      `SELECT p.*, ${CON_HITOS}, ${CON_EXCEPCION}, ${CON_BONO}, r.dueno_id, (SELECT modo FROM preferencias_entrega pe WHERE pe.pedido_id = p.id) AS entrega FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.id = ? AND p.repartidor_id = ? AND p.estado = 'en_camino'`,
    )
    .bind(id, u.id)
    .first<Record<string, unknown>>();
  if (!p) throw new ErrorDatos('Este pedido no está en camino contigo.', undefined, 409);
  // Mayoría de edad: si algún plato lo exige, solo en mano y con el documento revisado.
  const requiereEdad = lineasConEdad(p);
  // En la puerta: con foto. En mano: sin foto (el cliente lo recibió). En lugar seguro: foto y nota,
  // después de avisar que el cliente no aparece y esperar 5 minutos.
  const esFoto = (c.req.header('content-type') ?? '').startsWith('image/');
  if (requiereEdad && esFoto)
    throw new ErrorDatos(
      'Este pedido tiene productos para mayores de 21: entrégalo en mano y revisa el documento.',
      'edad',
      409,
    );
  const modoPedido = String(c.req.query('modo') ?? '');
  let donde: { lat: number; lng: number };
  let modo: 'puerta' | 'mano' | 'seguro';
  let nota = String(c.req.query('nota') ?? '')
    .trim()
    .slice(0, 300);
  let foto: Awaited<ReturnType<typeof leerFoto>> | null = null;
  if (esFoto) {
    foto = await leerFoto(c);
    donde = foto.donde;
    modo = modoPedido === 'seguro' ? 'seguro' : 'puerta';
  } else {
    const d = await leerCuerpo(
      c,
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        modo: z.literal('mano'),
        nota: z.string().trim().max(300).default(''),
        pin: z.string().trim().optional(),
        /** El repartidor revisó el documento y la persona es mayor de 21 (solo si el pedido lo exige). */
        mayorEdad: z.boolean().optional(),
        /** Qué documento vio y sus últimos 4 dígitos, y quién recibió: la «firma» de una entrega con edad (punto 24). */
        documento: z.enum(['licencia', 'pasaporte', 'otro']).optional(),
        documentoUltimos4: z
          .string()
          .regex(/^\d{4}$/)
          .optional(),
        nombreRecibe: z.string().trim().max(80).optional(),
      }),
    );
    if (requiereEdad && d.mayorEdad !== true)
      throw new ErrorDatos(
        'Revisa el documento de quien recibe y confirma que es mayor de 21 antes de entregar.',
        'edad',
        409,
      );
    if (requiereEdad && (!d.documento || !d.documentoUltimos4 || !d.nombreRecibe))
      throw new ErrorDatos(
        'Escribe el tipo de documento, sus últimos cuatro dígitos y el nombre de quien recibe.',
        'edad',
        409,
      );
    donde = { lat: d.lat, lng: d.lng };
    modo = 'mano';
    nota = requiereEdad
      ? `${d.nota ? `${d.nota} · ` : ''}ID ${d.documento} ••${d.documentoUltimos4} · recibió ${d.nombreRecibe}`
      : d.nota;
    // Si el cliente pidió PIN, quien recibe se lo da al repartidor; sin PIN correcto no se entrega.
    await verificarPinEntrega(
      db,
      id,
      d.pin,
      'El PIN no es correcto. Pídeselo a quien recibe el pedido: está en su app.',
    );
  }
  const casa = comoPunto(p.lat, p.lng);
  const metros = casa ? metrosEntre(donde, casa) : null;
  if (lejos(metros) && !esRevisor(c, u.correo))
    throw new ErrorDatos(
      'Todavía no llegas a la dirección de entrega. El botón se activa cuando estés en la puerta.',
      undefined,
      409,
    );
  // GPS serio: la llegada la confirman dos lecturas precisas (hito «llegó»), o soporte autorizó la
  // excepción «No puedo confirmar mi ubicación». Un punto suelto no alcanza.
  if (p.h_llego_cli == null && p.excepcion_ubicacion !== 'autorizada' && !esRevisor(c, u.correo))
    throw new ErrorDatos(
      'Todavía no confirmamos tu ubicación en la puerta. Espera unos segundos con el GPS encendido o pide la excepción a soporte.',
      'gps',
      409,
    );
  if (modo === 'seguro') {
    const aviso = msDeBase(p.h_no_aparece);
    if (aviso == null || Date.now() - aviso < 5 * 60_000)
      throw new ErrorDatos(
        'Primero avisa que el cliente no aparece y espera 5 minutos.',
        undefined,
        409,
      );
    if (!nota) throw new ErrorDatos('Escribe dónde dejaste el pedido.', 'nota', 422);
  }
  if (foto) await guardarEvidencia(db, foto, id, 'entrega', metros, true, modo, nota);
  else
    await db
      .prepare(
        "INSERT OR REPLACE INTO evidencias (pedido_id, tipo, clave, lat, lng, distancia_m, modo, nota, confirmada_en) VALUES (?, 'entrega', '', ?, ?, ?, ?, ?, datetime('now'))",
      )
      .bind(id, donde.lat, donde.lng, metros, modo, nota)
      .run();
  // C-COBRO-AL-ENTREGAR: primero se REGISTRA la entrega (con su liquidación y los abonos, en un
  // lote), después se cobra. Si Stripe falla, la entrega ya quedó y el reloj termina el cobro.
  const pi = String(p.stripe_pago ?? '');
  const inicial = await estadoInicial(db, id, pi);
  // Lo que gana el repartidor: envío + complemento + el bono de la oferta abierta (si lo hubo).
  const entrega = Number(p.envio) + Number(p.complemento) + Number(p.bono ?? 0);
  try {
    await db.batch([
      sentenciaLiquidacion(db, id, pi, Number(p.total), inicial),
      db
        .prepare(
          "UPDATE pedidos SET estado = 'entregado', entregado_en = datetime('now') WHERE id = ? AND estado = 'en_camino'",
        )
        .bind(id),
      anotarEstado(db, id, 'entregado', u.id),
      // Fase 2 · cobro directo: el dinero nunca pasó por Tumbite (el cliente le pagó al repartidor y
      // él al restaurante en el local): no se acreditan bolsillos; la conciliación lo deja en el libro.
      ...(esDirecto(String(p.metodo_pago ?? 'tarjeta'))
        ? []
        : [
            db
              .prepare(
                "INSERT OR IGNORE INTO movimientos (id, usuario_id, pedido_id, monto, concepto) VALUES (?, ?, ?, ?, 'venta')",
              )
              .bind(nuevoId(), p.dueno_id, id, Number(p.pago_restaurante)),
            db
              .prepare(
                "INSERT OR IGNORE INTO movimientos (id, usuario_id, pedido_id, monto, concepto) VALUES (?, ?, ?, ?, 'entrega')",
              )
              .bind(nuevoId(), u.id, id, entrega),
            db
              .prepare(
                "INSERT OR IGNORE INTO movimientos (id, usuario_id, pedido_id, monto, concepto) VALUES (?, ?, ?, ?, 'propina')",
              )
              .bind(nuevoId(), u.id, id, Number(p.propina)),
          ]),
      db.prepare('UPDATE repartidores SET puntos = puntos + 10 WHERE usuario_id = ?').bind(u.id),
    ]);
  } catch (e) {
    if (esEntregaRepetida(e)) throw new ErrorDatos('Este pedido ya se entregó.', undefined, 409);
    throw e;
  }
  await liquidar(c.env, db, id).catch((e: unknown) =>
    console.error('entrega: el cobro queda para el reloj', id, e),
  );
  await avisarAlCliente(c.env, db, c.req.param('id'), (i) => AVISOS.entregado(i));
  // Fase 2 · cobro directo: si el cobro ya estaba confirmado, la conciliación cierra aquí.
  await conciliarPedidoDirecto(db, id).catch((e: unknown) =>
    console.error('conciliación directa', e),
  );
  return c.json({ ok: true, url: `/datos/pedidos/${id}/evidencia/entrega` });
});

// ======================= Reloj externo =======================

/**
 * YaDominios Cloud no tiene tareas programadas: un reloj de afuera (GitHub Actions, cada 5 min)
 * llama aquí con el secreto. Hoy: vencer ofertas viejas y repartir las pendientes aunque ningún
 * repartidor haya abierto la app. Sin secreto configurado, la ruta no existe para nadie.
 */
operacion.post('/reloj', async (c) => {
  const secreto = c.env.RELOJ_SECRETO;
  const dado = c.req.header('x-reloj-secreto') ?? '';
  if (!secreto || dado.length !== secreto.length || !(await igualesSeguro(dado, secreto)))
    throw new ErrorDatos('No encontrado.', undefined, 404);
  // Comparte el candado por minuto con el reloj nuevo (/datos/interno/reloj): si los dos llegan
  // en el mismo minuto, las tareas corren una sola vez (C-RELOJ-UNA-VEZ).
  return c.json(
    await correrRelojUnaVez(c.env, base(c), new Date().toISOString().slice(0, 16), 'github'),
  );
});

/**
 * Corre las tareas del reloj UNA vez por minuto, venga de donde venga (reloj actual de GitHub o
 * Worker externo). La fila de tareas_programadas se crea en una sola sentencia: el segundo que
 * llega en el mismo minuto encuentra la fila y no corre nada.
 */
export async function correrRelojUnaVez(
  env: Env,
  db: D1Database,
  ventana: string,
  origen: 'github' | 'externo',
  /** Solo para las pruebas: otra lista de tareas y otro nombre (la salud solo mira «reloj»). */
  prueba?: { tareas: readonly TareaReloj[]; tarea: string },
) {
  const tarea = prueba?.tarea ?? 'reloj';
  const clave = `${tarea}:${ventana}`;
  // C-RELOJ-UNA-VEZ: una fila por minuto, creada en una sola sentencia. El segundo que llega en
  // ese minuto (GitHub o Cloudflare, o un reintento) no corre nada.
  const nueva = await db
    .prepare('INSERT OR IGNORE INTO tareas_programadas (clave, tarea, resultado) VALUES (?, ?, ?)')
    .bind(clave, tarea, `origen:${origen}`)
    .run();
  if (!nueva.meta.changes) return { ok: true as const, yaHecho: true as const, ventana };
  let resultado: Awaited<ReturnType<typeof correrReloj>>;
  try {
    // C-RELOJ-AISLADO: cada tarea con su propio manejo de errores; esto ya no lanza por una tarea.
    resultado = await correrReloj(env, db, prueba?.tareas);
    await anotarTareas(db, clave, resultado.vuelta);
  } catch (e) {
    console.error('reloj', origen, e);
    await db
      .prepare('UPDATE tareas_programadas SET resultado = ? WHERE clave = ?')
      .bind(`origen:${origen} error`, clave)
      .run();
    throw e;
  }
  await db.batch([
    db
      .prepare(
        "UPDATE tareas_programadas SET terminada_en = datetime('now'), resultado = ? WHERE clave = ?",
      )
      .bind(
        `origen:${origen} ${resultado.vuelta.estado} ${JSON.stringify(resultado.resumen)}`.slice(
          0,
          2000,
        ),
        clave,
      ),
    db.prepare(
      "DELETE FROM peticiones_internas WHERE recibida_en < datetime('now', '-10 minutes')",
    ),
    db.prepare("DELETE FROM tareas_programadas WHERE empezada_en < datetime('now', '-7 days')"),
    db.prepare("DELETE FROM reloj_tareas WHERE creado_en < datetime('now', '-7 days')"),
    db.prepare("DELETE FROM lotes_ubicacion WHERE recibido_en < datetime('now', '-7 days')"),
  ]);
  return { ok: true as const, ...resultado.resumen, fallidas: resultado.vuelta.fallidas, ventana };
}

/**
 * Las tareas del reloj, en orden. Las llaman el reloj de GitHub (/datos/reloj) y el externo de
 * Cloudflare (/datos/interno/reloj), siempre a través de correrRelojUnaVez. Cada una es repetible
 * y corre aunque la anterior falle (C-RELOJ-AISLADO). Crítica = toca pedidos o dinero.
 */
export const TAREAS_RELOJ: readonly TareaReloj[] = [
  { nombre: 'ofertas', critica: true, correr: (env, db) => repartirOfertas(db, env) },
  // Fase 3: operaciones de otros servicios (en producción no hay ninguna: no hace nada). Crítica:
  // ofrece viajes y devuelve a «buscando» los de un conductor sin señal. Sin catch propio: si falla,
  // lo atrapa correrTareas, queda en reloj_tareas y la salud lo ve.
  { nombre: 'operaciones', critica: true, correr: (env, db) => repartirOperaciones(env, db) },
  { nombre: 'manager', critica: true, correr: (env, db) => vigilarPedidos(env, db) },
  // C-COBRO-AL-ENTREGAR: termina los cobros de entregas que Stripe no pudo capturar en el momento.
  { nombre: 'liquidaciones', critica: true, correr: (env, db) => liquidarPendientes(env, db) },
  {
    nombre: 'sin_repartidor',
    critica: false,
    correr: async (_env, db) =>
      (
        await db
          .prepare(
            "SELECT count(*) AS n FROM pedidos WHERE estado IN ('aceptado','listo') AND repartidor_id IS NULL",
          )
          .first<{ n: number }>()
      )?.n ?? 0,
  },
  // Dinero vigilado: la conciliación de ayer (una vez al día).
  {
    nombre: 'conciliacion',
    critica: true,
    correr: async (env, db) => {
      const r = await conciliarAyer(env, db);
      return r ? { dia: r.dia, cuadra: r.cuadra } : null;
    },
  },
  // Fase 0: retiros dudosos o atascados se reintentan (misma clave) y una vez al día se concilian.
  {
    nombre: 'retiros',
    critica: true,
    correr: (env, db) => {
      const stripe = crearStripe(env.STRIPE_SECRET_KEY);
      return stripe ? procesarRetirosPendientes(db, stripe) : Promise.resolve(null);
    },
  },
  {
    nombre: 'conciliacion_retiros',
    critica: true,
    correr: async (env, db) => {
      const stripe = crearStripe(env.STRIPE_SECRET_KEY);
      const r = stripe ? await conciliarRetirosSiToca(db, stripe) : null;
      return r ? { cuadra: r.cuadra } : null;
    },
  },
  // Retención de fotos (30 días). Puede esperar: no es crítica.
  // Pausa sin señal (C-PAUSA-SIN-SENAL): solo avisa. La pausa misma se calcula al leer, así que
  // si esta tarea falla, los clientes igual no pueden pedir a una tienda sin señal.
  { nombre: 'pausa_sin_senal', critica: false, correr: (env, db) => pausarSinSenal(env, db) },
  {
    nombre: 'fotos',
    critica: false,
    correr: (env, db) => (env.BUCKET ? depurarFotos(db, env.BUCKET) : Promise.resolve(0)),
  },
];

export async function correrReloj(
  env: Env,
  db: D1Database,
  tareas: readonly TareaReloj[] = TAREAS_RELOJ,
) {
  const vuelta = await correrTareas(env, db, tareas);
  const de = (n: string) => vuelta.tareas.find((t) => t.nombre === n);
  const resumen = {
    manager: de('manager')?.datos ?? null,
    sinRepartidor: (de('sin_repartidor')?.datos as number | undefined) ?? 0,
    conciliacion: de('conciliacion')?.datos ?? null,
    fotosBorradas: (de('fotos')?.datos as number | undefined) ?? 0,
    retiros: de('retiros')?.datos ?? null,
    conciliacionRetiros: de('conciliacion_retiros')?.datos ?? null,
    operaciones: de('operaciones')?.datos ?? null,
    tareas: Object.fromEntries(vuelta.tareas.map((t) => [t.nombre, t.ok ? 'ok' : 'error'])),
    cuando: new Date().toISOString(),
  };
  return { vuelta, resumen };
}

async function igualesSeguro(a: string, b: string): Promise<boolean> {
  const h = async (x: string) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(x)));
  const [ha, hb] = await Promise.all([h(a), h(b)]);
  return ha.every((v, i) => v === hb.at(i));
}

// ======================= Cliente: seguimiento =======================

/** El cliente cancela mientras el restaurante no haya aceptado; el dinero vuelve completo. */
operacion.post('/pedidos/:id/cancelar', async (c) => {
  const u = exigir(c);
  const db = base(c);
  const id = c.req.param('id');
  const ok = await cancelarConReembolso(c.env, db, id, {
    desde: ['pago_pendiente', 'pagado'],
    actorId: u.id,
    clienteId: u.id,
  });
  if (!ok)
    throw new ErrorDatos(
      'El restaurante ya está preparando tu pedido y no se puede cancelar. Si hay un problema, repórtalo y te ayudamos.',
      undefined,
      409,
    );
  await anotarEvento(db, id, 'cancelado_por_cliente');
  return c.json({ ok: true });
});

operacion.get('/pedidos/:id/seguimiento', async (c) => {
  const u = exigir(c);
  // El Manager también mira aquí: la app pregunta cada pocos segundos, más puntual que el reloj.
  await vigilarPedidos(c.env, base(c), c.req.param('id')).catch((e: unknown) =>
    console.error('manager: seguimiento', e),
  );
  const f = await base(c)
    .prepare(
      `SELECT p.*, ${CON_EVIDENCIAS}, ${CON_HITOS}, ${CON_AJUSTE}, r.nombre AS restaurante_nombre, r.dueno_id, r.lat AS rest_lat, r.lng AS rest_lng, ur.nombre AS repartidor_nombre, d.lat AS rep_lat, d.lng AS rep_lng, d.ubicacion_en AS rep_en
      FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
      LEFT JOIN usuarios ur ON ur.id = p.repartidor_id LEFT JOIN repartidores d ON d.usuario_id = p.repartidor_id WHERE p.id = ?`,
    )
    .bind(c.req.param('id'))
    .first<FilaPedido>();
  if (!f || (f.cliente_id !== u.id && u.rol !== 'admin'))
    throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  const enRuta = f.estado === 'en_camino';
  // Por qué se canceló, para decírselo claro al cliente (lo anota el Manager en la bitácora).
  const motivo =
    f.estado === 'cancelado'
      ? await base(c)
          .prepare(
            "SELECT evento FROM bitacora_pedidos WHERE pedido_id = ? AND evento IN ('cancelado_por_cliente','rechazado_por_restaurante','cancelado_sin_respuesta') ORDER BY id DESC LIMIT 1",
          )
          .bind(c.req.param('id'))
          .first<{ evento: string }>()
      : null;
  const motivoCancelacion =
    motivo?.evento === 'cancelado_por_cliente'
      ? 'cliente'
      : motivo?.evento === 'rechazado_por_restaurante'
        ? 'restaurante'
        : motivo?.evento === 'cancelado_sin_respuesta'
          ? 'sin_respuesta'
          : null;
  const { results: historial } = await base(c)
    .prepare(
      'SELECT estado, creado_en AS fecha FROM historial_estados WHERE pedido_id = ? ORDER BY id',
    )
    .bind(c.req.param('id'))
    .all<{ estado: string; fecha: string }>();
  // Tiempo estimado: lo que falta de cocina + el viaje a 25 km/h de ciudad (mínimo 5 min).
  const repLat = enRuta && f.rep_lat != null ? Number(f.rep_lat) : null;
  const repLng = enRuta && f.rep_lng != null ? Number(f.rep_lng) : null;
  const casa = f.lat != null && f.lng != null ? { lat: Number(f.lat), lng: Number(f.lng) } : null;
  const rest =
    f.rest_lat != null && f.rest_lng != null
      ? { lat: Number(f.rest_lat), lng: Number(f.rest_lng) }
      : null;
  const origen = repLat != null && repLng != null ? { lat: repLat, lng: repLng } : rest;
  const kmQueFaltan = origen && casa ? distanciaKm(origen, casa) : null;
  const minutosViaje =
    kmQueFaltan == null ? null : Math.max(5, Math.round((kmQueFaltan / 25) * 60));
  const minutosCocina =
    f.estado === 'pagado' || f.estado === 'aceptado' ? Number(f.tiempo_prep_min ?? 20) : 0;
  const minutosEstimados =
    f.estado === 'entregado' || f.estado === 'cancelado' || minutosViaje == null
      ? null
      : minutosCocina + minutosViaje;
  // «Llega a más tardar»: se fija cuando el restaurante acepta (su tiempo + el viaje + 10 de margen).
  const aceptadoMs = msDeBase(f.aceptado_en);
  const viajeRestCasa = rest && casa ? minutosDeViaje(distanciaKm(rest, casa)) : 15;
  const llegaAMasTardar =
    aceptadoMs != null && f.estado !== 'entregado' && f.estado !== 'cancelado'
      ? new Date(
          aceptadoMs + (Number(f.tiempo_prep_min ?? 20) + viajeRestCasa + 10) * 60_000,
        ).toISOString()
      : null;
  return c.json({
    pedido: {
      ...aPedido(f),
      historial,
      motivoCancelacion,
      restaurante: rest,
      minutosEstimados,
      llegaAMasTardar,
      // Solo el cliente ve su PIN: se lo da a quien reciba el pedido.
      pin:
        f.cliente_id === u.id
          ? ((
              await base(c)
                .prepare('SELECT pin FROM pines_entrega WHERE pedido_id = ?')
                .bind(c.req.param('id'))
                .first<{ pin: string }>()
            )?.pin ?? null)
          : null,
      // La reseña que dejó (con la respuesta del restaurante, si la hubo).
      resena:
        f.cliente_id === u.id
          ? await base(c)
              .prepare(
                'SELECT estrellas_restaurante, comentario, respuesta, respondida_en FROM calificaciones WHERE pedido_id = ?',
              )
              .bind(c.req.param('id'))
              .first<{
                estrellas_restaurante: number;
                comentario: string;
                respuesta: string | null;
                respondida_en: string | null;
              }>()
              .then((x) =>
                x
                  ? {
                      estrellas: Number(x.estrellas_restaurante),
                      comentario: x.comentario,
                      respuesta: x.respuesta,
                      respondidaEn: x.respondida_en,
                    }
                  : null,
              )
          : null,
      // Cobro directo por transferencia: el cliente ve a quién y a dónde transferir (nombre del
      // beneficiario y cuenta vigente), nada más. Solo el cliente del pedido y solo con repartidor.
      cuentaCobro:
        f.cliente_id === u.id &&
        f.repartidor_id &&
        String(f.metodo_pago ?? '') === 'transferencia_repartidor'
          ? await cuentaVigente(
              base(c),
              String(f.repartidor_id),
              ...(await paisDeZona(base(c), String(f.zona_id ?? 'US-FL-MIAMI')).then(
                (z) => [z.pais, z.moneda] as const,
              )),
            ).then((cu) =>
              cu
                ? {
                    tipo: cu.tipo,
                    banco: cu.banco,
                    titular: cu.titular,
                    identificador: cu.identificador,
                    verificacion: cu.verificacion,
                  }
                : null,
            )
          : null,
      repartidor: f.repartidor_id
        ? {
            // Solo el nombre de pila: la privacidad del repartidor también cuenta.
            nombre: String(f.repartidor_nombre ?? '').split(' ')[0],
            lat: repLat,
            lng: repLng,
            actualizado: enRuta ? ((f.rep_en as string | null) ?? null) : null,
            llegaEn5: f.h_llega5 != null,
            casiLlega: f.h_casi != null,
            llego: f.h_llego_cli != null,
          }
        : null,
    },
  });
});

/**
 * Llamada con número oculto: el repartidor o el cliente de un pedido en marcha toca «Llamar»;
 * Twilio lo llama a él primero y, al contestar, marca al otro. Los dos ven el número de Tumbite.
 */
operacion.post('/pedidos/:id/llamar', async (c) => {
  const u = exigir(c, 'cliente', 'repartidor');
  const db = base(c);
  const id = c.req.param('id');
  const p = await db
    .prepare(
      `SELECT p.cliente_id, p.repartidor_id, uc.telefono AS tel_cliente, ur.telefono AS tel_repartidor
       FROM pedidos p JOIN usuarios uc ON uc.id = p.cliente_id LEFT JOIN usuarios ur ON ur.id = p.repartidor_id
       WHERE p.id = ? AND p.estado IN ('aceptado','listo','en_camino')`,
    )
    .bind(id)
    .first<{
      cliente_id: string;
      repartidor_id: string | null;
      tel_cliente: string | null;
      tel_repartidor: string | null;
    }>();
  if (!p || (u.id !== p.cliente_id && u.id !== p.repartidor_id))
    throw new ErrorDatos('Este pedido no está en marcha contigo.', undefined, 409);
  if (!smsConfigurado(c.env))
    throw new ErrorDatos(
      'Las llamadas todavía no están activas. Escríbele por el chat del pedido.',
      undefined,
      409,
    );
  if (!p.repartidor_id) throw new ErrorDatos('Todavía no hay repartidor asignado.', undefined, 409);
  const soyCliente = u.id === p.cliente_id;
  const yo = telefonoE164(soyCliente ? p.tel_cliente : p.tel_repartidor);
  const otro = telefonoE164(soyCliente ? p.tel_repartidor : p.tel_cliente);
  if (!yo)
    throw new ErrorDatos(
      'Agrega tu número de celular en tu cuenta para poder llamar.',
      undefined,
      409,
    );
  if (!otro)
    throw new ErrorDatos(
      'La otra persona no tiene celular registrado. Escríbele por el chat del pedido.',
      undefined,
      409,
    );
  const llamadaId = nuevoId();
  try {
    await llamarConNumeroOculto(c.env, yo, otro);
  } catch (e) {
    console.error('llamada', e);
    await db
      .prepare("INSERT INTO llamadas (id, pedido_id, de_usuario, estado) VALUES (?, ?, ?, 'error')")
      .bind(llamadaId, id, u.id)
      .run();
    throw new ErrorDatos(
      'No pudimos conectar la llamada. Intenta otra vez o escribe por el chat.',
      undefined,
      503,
    );
  }
  await db
    .prepare(
      "INSERT INTO llamadas (id, pedido_id, de_usuario, estado) VALUES (?, ?, ?, 'llamando')",
    )
    .bind(llamadaId, id, u.id)
    .run();
  await anotarEvento(
    db,
    id,
    'llamada',
    soyCliente ? 'cliente → repartidor' : 'repartidor → cliente',
  );
  return c.json({ ok: true, estado: 'llamando' });
});

/** ¿Alguna línea del pedido exige mayoría de edad? (queda congelado en lineas_json al pedir). */
function lineasConEdad(f: Record<string, unknown>): boolean {
  try {
    const lineas = JSON.parse(String(f.lineas_json ?? '[]')) as { requiereEdad?: boolean }[];
    return lineas.some((l) => l.requiereEdad === true);
  } catch {
    return false;
  }
}

/**
 * Recogida en el local: el cliente llega y el restaurante marca la entrega (con el PIN del cliente
 * si lo pidió). Se cobra la tarjeta en ese momento, como en una entrega normal.
 */
operacion.post('/restaurante/pedidos/:id/entregado-local', async (c) => {
  const rid = await miRestauranteId(c);
  const db = base(c);
  const id = c.req.param('id');
  const { pin } = await leerCuerpo(c, z.object({ pin: z.string().trim().optional() }));
  const p = await db
    .prepare(
      `SELECT p.*, r.dueno_id FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
       WHERE p.id = ? AND p.restaurante_id = ? AND p.estado = 'listo' AND EXISTS (SELECT 1 FROM recogidas rc WHERE rc.pedido_id = p.id)`,
    )
    .bind(id, rid)
    .first<Record<string, unknown>>();
  if (!p)
    throw new ErrorDatos('Este pedido no es una recogida lista para entregar.', undefined, 409);
  await verificarPinEntrega(
    db,
    id,
    pin,
    'El PIN no es correcto. Pídeselo al cliente: está en su app.',
  );
  if (lineasConEdad(p)) {
    // Mayoría de edad: el restaurante confirma que revisó el documento.
    const { mayorEdad } = await c.req
      .json<{ mayorEdad?: boolean }>()
      .catch(() => ({ mayorEdad: false }));
    if (mayorEdad !== true)
      throw new ErrorDatos(
        'Revisa el documento de quien recibe y confirma que es mayor de 21 antes de entregar.',
        'edad',
        409,
      );
  }
  // C-COBRO-AL-ENTREGAR: primero se registra la entrega, después se cobra (ver la entrega normal).
  const pi = String(p.stripe_pago ?? '');
  const inicial = await estadoInicial(db, id, pi);
  const dueno = String(p.dueno_id);
  try {
    await db.batch([
      sentenciaLiquidacion(db, id, pi, Number(p.total), inicial),
      db
        .prepare(
          "UPDATE pedidos SET estado = 'entregado', entregado_en = datetime('now') WHERE id = ? AND estado = 'listo'",
        )
        .bind(id),
      anotarEstado(db, id, 'entregado', dueno),
      db
        .prepare(
          "INSERT OR IGNORE INTO movimientos (id, usuario_id, pedido_id, monto, concepto) VALUES (?, ?, ?, ?, 'venta')",
        )
        .bind(nuevoId(), dueno, id, Number(p.pago_restaurante)),
      db
        .prepare(
          "INSERT OR IGNORE INTO evidencias (pedido_id, tipo, clave, modo, confirmada_en) VALUES (?, 'entrega', '', 'local', datetime('now'))",
        )
        .bind(id),
    ]);
  } catch (e) {
    if (esEntregaRepetida(e)) throw new ErrorDatos('Este pedido ya se entregó.', undefined, 409);
    throw e;
  }
  await liquidar(c.env, db, id).catch((e: unknown) =>
    console.error('recogida: el cobro queda para el reloj', id, e),
  );
  await avisarAlCliente(c.env, db, id, (i) => AVISOS.entregado(i));
  return c.json({ ok: true });
});

/** El puente de Twilio: con el pase válido, marca al otro número con el de Tumbite como remitente. */
// F9: la llamada pide GET, pero se acepta también POST (el método por defecto de Twilio).
operacion.on(['GET', 'POST'], '/twilio/puente', async (c) => {
  const a = await abrirPase(c.env, c.req.query('t') ?? '');
  if (!a || !c.env.TWILIO_FROM) throw new ErrorDatos('No encontrado.', undefined, 404);
  return c.body(twimlPuente(a, c.env.TWILIO_FROM), 200, { 'content-type': 'text/xml' });
});

/** El cliente no aparece: el repartidor avisa desde la puerta; a los 5 minutos puede dejarlo en lugar seguro. */
operacion.post('/repartidor/pedidos/:id/no-aparece', async (c) => {
  const { u, db } = await miFicha(c);
  const id = c.req.param('id');
  const p = await db
    .prepare(
      `SELECT p.id, ${CON_HITOS} FROM pedidos p WHERE p.id = ? AND p.repartidor_id = ? AND p.estado = 'en_camino'`,
    )
    .bind(id, u.id)
    .first<FilaPedido>();
  if (!p) throw new ErrorDatos('Este pedido no está en camino contigo.', undefined, 409);
  if (!p.h_llego_cli)
    throw new ErrorDatos('Todavía no estás en la puerta del cliente.', undefined, 409);
  const r = await db
    .prepare("INSERT OR IGNORE INTO hitos_pedido (pedido_id, hito) VALUES (?, 'no_aparece')")
    .bind(id)
    .run();
  if (r.meta.changes) {
    await anotarEvento(db, id, 'cliente_no_aparece');
    await avisarAlCliente(c.env, db, id, (i) => AVISOS.noAparece(i), 'no_aparece');
  }
  const desde = (
    await db
      .prepare("SELECT creado_en FROM hitos_pedido WHERE pedido_id = ? AND hito = 'no_aparece'")
      .bind(id)
      .first<{ creado_en: string }>()
  )?.creado_en;
  const hasta = (msDeBase(desde) ?? Date.now()) + 5 * 60_000;
  return c.json({ ok: true, esperaHasta: new Date(hasta).toISOString() });
});

/** El repartidor no puede seguir (antes de recoger): el pedido vuelve a buscar repartidor, sin castigo. */
operacion.post('/repartidor/pedidos/:id/soltar', async (c) => {
  const { u, db } = await miFicha(c);
  const id = c.req.param('id');
  const { motivo } = await leerCuerpo(c, z.object({ motivo: z.string().trim().min(1).max(200) }));
  const estado = await db
    .prepare('SELECT estado FROM pedidos WHERE id = ? AND repartidor_id = ?')
    .bind(id, u.id)
    .first<{ estado: string }>();
  if (!estado) throw new ErrorDatos('Este pedido no está contigo.', undefined, 409);
  if (estado.estado === 'en_camino')
    throw new ErrorDatos(
      'Ya recogiste el pedido: ahora hay que entregarlo. Si tienes un problema, repórtalo.',
      undefined,
      409,
    );
  if (await db.prepare('SELECT 1 FROM pagos_local WHERE pedido_id = ?').bind(id).first())
    throw new ErrorDatos(
      'Ya pagaste la comida de este pedido: entrégalo, o escribe a soporte si no puedes seguir.',
      undefined,
      409,
    );
  await soltarPedido(db, id, u.id, motivo);
  await anotarEvento(db, id, 'repartidor_solto', motivo);
  return c.json({ ok: true });
});

/** Chat del pedido entre el cliente y el repartidor (y nuestro equipo lee si hay reclamo). */
async function pedidoDelChat(db: D1Database, id: string, u: { id: string; rol: string }) {
  const p = await db
    .prepare('SELECT id, estado, cliente_id, repartidor_id FROM pedidos WHERE id = ?')
    .bind(id)
    .first<{ id: string; estado: string; cliente_id: string; repartidor_id: string | null }>();
  const puede = p && (u.rol === 'admin' || p.cliente_id === u.id || p.repartidor_id === u.id);
  if (!p || !puede) throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  return p;
}

operacion.get('/pedidos/:id/mensajes', async (c) => {
  const u = exigir(c);
  const db = base(c);
  const p = await pedidoDelChat(db, c.req.param('id'), u);
  const desde = Number(c.req.query('desde') ?? 0);
  const { results } = await db
    .prepare(
      'SELECT m.id, m.de_usuario_id AS de, u.nombre, m.texto, m.creado_en AS en FROM mensajes_pedido m JOIN usuarios u ON u.id = m.de_usuario_id WHERE m.pedido_id = ? AND m.id > ? ORDER BY m.id LIMIT 200',
    )
    .bind(p.id, desde)
    .all<{ id: number; de: string; nombre: string; texto: string; en: string }>();
  return c.json({
    abierto: ['aceptado', 'listo', 'en_camino'].includes(p.estado) && !!p.repartidor_id,
    mensajes: results.map((m) => ({
      ...m,
      nombre: m.nombre.split(' ')[0],
      mio: m.de === u.id,
    })),
  });
});

operacion.post('/pedidos/:id/mensajes', async (c) => {
  const u = exigir(c, 'cliente', 'repartidor');
  const db = base(c);
  const p = await pedidoDelChat(db, c.req.param('id'), u);
  if (!['aceptado', 'listo', 'en_camino'].includes(p.estado) || !p.repartidor_id)
    throw new ErrorDatos('Este pedido ya no está activo: el chat se cerró.', undefined, 409);
  const { texto } = await leerCuerpo(c, z.object({ texto: z.string().trim().min(1).max(500) }));
  await db
    .prepare('INSERT INTO mensajes_pedido (pedido_id, de_usuario_id, texto) VALUES (?, ?, ?)')
    .bind(p.id, u.id, texto)
    .run();
  const para = u.id === p.cliente_id ? p.repartidor_id : p.cliente_id;
  const destino = await db
    .prepare('SELECT idioma FROM usuarios WHERE id = ?')
    .bind(para)
    .first<{ idioma: string }>();
  await notificar(c.env, db, para, {
    ...AVISOS.mensaje(destino?.idioma === 'en' ? 'en' : 'es', u.nombre.split(' ')[0] ?? '', texto),
    datos: { pedidoId: p.id },
  });
  return c.json({ ok: true });
});

/** La foto de la recogida o de la entrega: solo el cliente, el restaurante, el repartidor y el equipo. */
operacion.get('/pedidos/:id/evidencia/:tipo', async (c) => {
  const u = exigir(c);
  const tipo = c.req.param('tipo');
  if (tipo !== 'recogida' && tipo !== 'entrega') return c.text('No encontrado', 404);
  const f = await base(c)
    .prepare(
      'SELECT e.clave, p.cliente_id, p.repartidor_id, r.dueno_id FROM evidencias e JOIN pedidos p ON p.id = e.pedido_id JOIN restaurantes r ON r.id = p.restaurante_id WHERE e.pedido_id = ? AND e.tipo = ?',
    )
    .bind(c.req.param('id'), tipo)
    .first<{ clave: string; cliente_id: string; repartidor_id: string | null; dueno_id: string }>();
  const puede =
    f && (u.rol === 'admin' || [f.cliente_id, f.repartidor_id, f.dueno_id].includes(u.id));
  if (!f || !puede || !c.env.BUCKET) return c.text('No encontrado', 404);
  const obj = await c.env.BUCKET.get(f.clave);
  if (!obj) return c.text('No encontrado', 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(obj.body, { headers });
});

operacion.post('/pedidos/:id/calificar', async (c) => {
  const u = exigir(c, 'cliente');
  const d = await leerCuerpo(
    c,
    z.object({
      estrellasRestaurante: z.number().int().min(1).max(5),
      estrellasRepartidor: z.number().int().min(1).max(5).nullable().default(null),
      culpaRestaurante: z.boolean().default(false),
      comentario: z.string().trim().max(500).default(''),
    }),
  );
  const db = base(c);
  const p = await db
    .prepare("SELECT 1 FROM pedidos WHERE id = ? AND cliente_id = ? AND estado = 'entregado'")
    .bind(c.req.param('id'), u.id)
    .first();
  if (!p) throw new ErrorDatos('Solo se califican pedidos entregados.', undefined, 409);
  await db
    .prepare(
      'INSERT OR REPLACE INTO calificaciones (pedido_id, estrellas_restaurante, estrellas_repartidor, culpa_restaurante, comentario) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(
      c.req.param('id'),
      d.estrellasRestaurante,
      d.estrellasRepartidor,
      d.culpaRestaurante ? 1 : 0,
      d.comentario,
    )
    .run();
  return c.json({ ok: true });
});
