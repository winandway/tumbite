import { flotasActivas } from './flota';
import { anotarGpsFoto, guardarFoto } from '../fotoLimpia';
import { destinosActivos, revisarLlegadaDestino } from '../modoDestino';
import { premiarReferidoDelPedido } from '../referidos';
import { evaluarDestacado } from './repartidorGrandes';
import { correosEquipo } from '../avisosEquipo';
import { topesDeZona } from '../internacional/tarifas';
import { TAREAS_FLEX } from '../flex/automatizacion';
import { TAREAS_FINANZAS } from '../finanzas/reloj';
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
import { comprobarCodigo, mandarCodigo, telefonoPorVerificar } from '../telefonoVuelta';
import { pagoPicoPara } from '../pagoPico';
import { sentenciasCobroAnuncio } from '../anuncios';
import { anotarPorTiempo, completarPorTiempo, leerPorTiempo } from '../ganarPorTiempo';
import { paisDeZona } from '../internacional/paises';
import { sinFotoConPin, verificarPinEntrega } from '../pin';
import { conciliarRetirosSiToca, procesarRetirosPendientes } from '../retiros';
import {
  type TareaReloj,
  anotarTareas,
  correrTareas,
  esPrimeraDeLaHora,
  esPrimeraDelDia,
  relojEnPausa,
  tomarMinuto,
} from '../reloj';
import { PRESUPUESTO_VUELTA_RELOJ, contarFilas, pasoDelTope } from '../presupuestoFilas';
import { volverPlatosAgotados } from './catalogo';
import { correrSombra, leerAjustes, reputacionVisible } from '../rewards/sombra';
import { DIAS_FOTO_ENTREGA, correoDeEntrega } from '../avisos';
import { esConductorOcupado, repartirOperaciones } from '../operaciones';
import { Hono } from 'hono';
import { cobertura } from '../territorio';
import { z } from 'zod';
import {
  type Muestra,
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
  paisDelCodigoZona,
  VERSION_TERMINOS,
  estimacionLlegada,
  rangoLlegada,
  segundosDesde,
  senalPerdida,
  acercaAlDestino,
  LECTURA_VIEJA_MS,
  edadLecturaMs,
} from '@tumbite/compartido';
import { MAX_FOTO_BYTES, tipoReal } from './fotos';
import { asegurarCodigoRepartidor, papelesObligatorios } from './superadmin';
import { kycAprobado } from './kyc';
import {
  type MotivoSinComida,
  errorSinComida,
  filtrarPorCatalogo,
  frenoAlConectar,
  zonasDespachoCatalogo,
} from '../despachoCatalogo';
import { enIdiomaDePeticion, idiomaDeLaPeticion } from '../mensajesEn';
import type { Env } from '../env';
import { entornoDe } from '../entorno';
import { nuevoId } from '../cripto';
import { avanzarPrueba, crearPedidoPrueba, esPedidoPrueba, pedidosPrueba } from '../pedidoPrueba';
import { ofertasPractica, practicaActiva } from '../entregaPractica';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import {
  CON_AJUSTE,
  CON_EVIDENCIAS,
  type FilaPedido,
  aPedido,
  aplicarAjuste,
  calcularSinPlato,
  type Propuesta,
} from './pedidos';
import { anotar, anotarEstado } from '../historial';
import { lineasDeTienda } from './tiendas';
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
import { crearTicket } from './tickets';
import {
  abrirPase,
  enviarSms,
  llamarConNumeroOculto,
  smsConfigurado,
  telefonoE164,
  twimlPuente,
} from '../sms';
import {
  type FaltaPapel,
  faltaPapel,
  formatearMonto,
  platosDelPedido,
  etiquetasValidas,
  nombreCorto,
  rendimientoRestaurante,
} from '@tumbite/compartido';

export const operacion = new Hono<{ Bindings: Env; Variables: Variables }>();

const SEGUNDOS_OFERTA = 45;
/** C-REOFERTA-UNICO: segundos después de terminar su oferta antes de volver a ofrecérsela. */
const RESPIRO_REOFERTA = 60;
/** Probabilidad de pedir la selfie de control en cada conexión (como la identidad continua de los grandes). */
const PROBABILIDAD_SELFIE = 0.2;
/** Días sin conectarse a partir de los cuales la foto de control es obligatoria al volver. */
const DIAS_PARA_VERIFICAR_AL_VOLVER = 14;
const punto = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
/** La ubicación con la precisión que reporta el celular (metros; sin ella, no cuenta para «llegó»). */
const puntoConPrecision = punto.extend({
  precision: z.number().min(0).max(100_000).nullable().optional(),
  /** Android marca la ubicación simulada («mock»); G2: nunca cuenta para llegar ni mueve la ficha. */
  simulada: z.boolean().optional(),
  /** C-LATIDO-UBICACION: hora de la lectura y del envío, los dos del reloj del celular (ms). */
  leidaEn: z.number().int().min(0).optional(),
  enviadaEn: z.number().int().min(0).optional(),
  /** Revisión 2: edad de la lectura medida con un solo reloj del celular (puede venir negativa). */
  edadMs: z.number().int().optional(),
});

/**
 * C-CLIENTE-AUSENTE: minutos que el repartidor espera en la puerta tras avisar que el cliente no
 * aparece (DoorDash 5, Uber Eats 8 [DOC]). Por configuración (`ESPERA_CLIENTE_AUSENTE_MIN`).
 */
export const ESPERA_AUSENTE_POR_DEFECTO_MIN = 5;
export function minutosEsperaAusente(env: Env): number {
  const n = Number(env.ESPERA_CLIENTE_AUSENTE_MIN ?? ESPERA_AUSENTE_POR_DEFECTO_MIN);
  return Number.isInteger(n) ? Math.min(15, Math.max(2, n)) : ESPERA_AUSENTE_POR_DEFECTO_MIN;
}

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
const CON_BONO = `COALESCE((SELECT centavos FROM bonos_pedido b WHERE b.pedido_id = p.id), 0) AS bono,
  (SELECT motivo FROM bonos_pedido b WHERE b.pedido_id = p.id) AS bono_motivo`;

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
    // C-AUDITIVA-REPARTIDOR: escribirle por el chat en vez de llamarlo.
    dificultadAuditiva: Number(f.rep_auditiva ?? 0) === 1,
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
      // C-REOFERTA-UNICO: el respiro para volver a ofrecérselo cuenta desde que lo soltó.
      .prepare(
        "UPDATE ofertas SET estado = 'rechazada', creada_en = datetime('now') WHERE pedido_id = ? AND repartidor_id = ?",
      )
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
  if (!r.meta.changes) {
    // C-FOTO-RECOGIDA-REPETIDA (13 nov 2026, simulador de compras): la foto o el código llegaron dos
    // veces a la vez y el otro ya lo hizo salir. Ya salió: no es un error ni se repite nada.
    const ya = await db
      .prepare("SELECT 1 FROM pedidos WHERE id = ? AND estado = 'en_camino'")
      .bind(id)
      .first();
    if (ya) return;
    throw new ErrorDatos('Este pedido ya cambió de estado. Actualiza la pantalla.', undefined, 409);
  }
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
      `SELECT p.*, ${CON_EVIDENCIAS}, ${CON_HITOS}, ${CON_AJUSTE}, ur.nombre AS repartidor_nombre, uc.nombre AS cliente_nombre, d.lat AS rep_lat, d.lng AS rep_lng, d.ubicacion_en AS rep_en, r.lat AS rest_lat, r.lng AS rest_lng,
        (SELECT a.auditiva FROM accesibilidad_repartidor a WHERE a.usuario_id = p.repartidor_id) AS rep_auditiva,
        (SELECT s.estado FROM solicitudes_cancelacion s WHERE s.pedido_id = p.id ORDER BY s.creado_en DESC LIMIT 1) AS cancelacion_estado
      FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
      LEFT JOIN usuarios ur ON ur.id = p.repartidor_id LEFT JOIN usuarios uc ON uc.id = p.cliente_id
      LEFT JOIN repartidores d ON d.usuario_id = p.repartidor_id
      WHERE p.restaurante_id = ? AND (p.estado IN ('pagado','aceptado','listo','en_camino')
      OR (p.estado IN ('entregado','cancelado') AND p.creado_en > datetime('now','-1 day'))) ORDER BY p.creado_en DESC`,
    )
    .bind(rid)
    .all<FilaPedido>();
  // C-PEDIDO-PRUEBA: los de prueba van arriba, marcados; salen de su propia tabla.
  const prueba = await pedidosPrueba(base(c), rid);
  return c.json({
    pedidos: [
      ...prueba,
      ...results.map((f) => ({
        ...aPedido(f),
        repartidor: repartidorParaRestaurante(f),
        // LAN-3y: para la comanda, solo el nombre y la inicial (como DoorDash y Uber Eats).
        clienteCorto: nombreCorto(f.cliente_nombre == null ? '' : String(f.cliente_nombre)),
        // C-CANCELAR-LISTO: si el restaurante ya pidió a soporte cancelarlo, y en qué quedó.
        cancelacion: (f as { cancelacion_estado?: string | null }).cancelacion_estado ?? null,
      })),
    ],
    ...(await cocinaDe(base(c), rid)),
  });
});

/** C-PEDIDO-PRUEBA: «Enviar un pedido de prueba» (panel y app del restaurante). */
operacion.post('/restaurante/pedido-prueba', async (c) => {
  const rid = await miRestauranteId(c);
  const u = exigir(c, 'restaurante');
  return c.json({ pedido: await crearPedidoPrueba(base(c), rid, u.id) });
});

operacion.post('/restaurante/pedidos/:id/terminar-prueba', async (c) => {
  const rid = await miRestauranteId(c);
  const id = c.req.param('id');
  if (!esPedidoPrueba(id))
    throw new ErrorDatos('Solo se terminan pedidos de prueba.', undefined, 409);
  await avanzarPrueba(base(c), rid, id, 'terminar');
  return c.json({ ok: true });
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
  if (!r.meta.changes) {
    // C-RESTAURANTE-DOBLE-TOQUE (13 nov 2026, lo encontró el simulador de compras): el segundo
    // toque (o el reintento tras un corte) encuentra el pedido YA en el estado que pedía. No es un
    // error: responde igual que el primero y no anota ni avisa otra vez. Cualquier otro estado
    // sigue siendo 409.
    const ya = await db
      .prepare('SELECT 1 FROM pedidos WHERE id = ? AND restaurante_id = ? AND estado = ?')
      .bind(id, rid, a)
      .first();
    if (ya) return false;
    throw new ErrorDatos('Este pedido ya cambió de estado. Actualiza la pantalla.', undefined, 409);
  }
  await anotar(db, id, a, rid);
  return true;
}

/**
 * Mientras el cliente decide sobre un plato agotado, el restaurante no puede aceptar ni marcar
 * «listo»: después de «listo» el cliente ya no podría responder y el plato se cobraría
 * (C-LISTO-SIN-AJUSTE).
 */
async function sinAjustePendiente(db: D1Database, pedidoId: string) {
  const pendiente = await db
    .prepare("SELECT 1 FROM ajustes_pedido WHERE pedido_id = ? AND estado = 'pendiente'")
    .bind(pedidoId)
    .first();
  if (pendiente)
    throw new ErrorDatos(
      'Espera a que el cliente decida sobre el plato que falta.',
      undefined,
      409,
    );
}

/** Aceptar un pedido (panel, app y API de punto de venta usan esta misma pieza). */
export async function aceptarPedido(
  env: Env,
  db: D1Database,
  pedidoId: string,
  rid: string,
  minutos: number,
) {
  await sinAjustePendiente(db, pedidoId);
  const cambio = await cambiarEstado(
    db,
    pedidoId,
    rid,
    ['pagado'],
    'aceptado',
    ", aceptado_en = datetime('now'), tiempo_prep_min = ?",
    [minutos],
  );
  if (!cambio) return;
  await avisarAlCliente(env, db, pedidoId, (i, f) => AVISOS.pedidoAceptado(i, f.restaurante));
}

/**
 * C-ACEPTAR-SOLO: si el restaurante tiene la aceptación automática, el pedido pagado se acepta
 * solo con el tiempo sugerido (como el «auto-confirm» de DoorDash). Un programado espera a que se
 * abra su ventana (45 minutos antes); un pedido con un plato agotado sin decidir, también espera.
 * Devuelve true si lo aceptó.
 */
export async function aceptarSiEsAutomatico(env: Env, db: D1Database, pedidoId: string) {
  const f = await db
    .prepare(
      `SELECT p.restaurante_id AS rid FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
        WHERE p.id = ? AND p.estado = 'pagado' AND r.aceptar_solo = 1
          AND (p.programado_para IS NULL OR datetime(p.programado_para, '-45 minutes') <= datetime('now'))
          AND NOT EXISTS (SELECT 1 FROM ajustes_pedido a WHERE a.pedido_id = p.id AND a.estado = 'pendiente')`,
    )
    .bind(pedidoId)
    .first<{ rid: string }>();
  if (!f) return false;
  const { prepSugerida } = await cocinaDe(db, f.rid);
  await aceptarPedido(env, db, pedidoId, f.rid, Math.min(120, Math.max(5, prepSugerida)));
  return true;
}

/** Marcar listo (panel, app y API de punto de venta). */
export async function marcarListo(env: Env, db: D1Database, pedidoId: string, rid: string) {
  await sinAjustePendiente(db, pedidoId);
  if (
    !(await cambiarEstado(db, pedidoId, rid, ['aceptado'], 'listo', ", listo_en = datetime('now')"))
  )
    return;
  await avisarAlCliente(env, db, pedidoId, (i, f) => AVISOS.listo(i, f.restaurante));
  await avisarAlRepartidor(env, db, pedidoId, (i, f) => AVISOS.repListo(i, f.restaurante));
}

operacion.post('/restaurante/pedidos/:id/aceptar', async (c) => {
  const rid = await miRestauranteId(c);
  const { minutos } = await leerCuerpo(c, z.object({ minutos: z.number().int().min(5).max(120) }));
  if (esPedidoPrueba(c.req.param('id'))) {
    await avanzarPrueba(base(c), rid, c.req.param('id'), 'aceptar', minutos);
    return c.json({ ok: true });
  }
  await aceptarPedido(c.env, base(c), c.req.param('id'), rid, minutos);
  return c.json({ ok: true });
});

operacion.post('/restaurante/pedidos/:id/listo', async (c) => {
  const rid = await miRestauranteId(c);
  if (esPedidoPrueba(c.req.param('id'))) {
    await avanzarPrueba(base(c), rid, c.req.param('id'), 'listo');
    return c.json({ ok: true });
  }
  await marcarListo(c.env, base(c), c.req.param('id'), rid);
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
  const { platoId, propuestas: idsPropuestos } = await leerCuerpo(
    c,
    z.object({
      platoId: z.string().min(1),
      // C-TIENDAS-REEMPLAZOS: hasta tres reemplazos del propio catálogo, como el escaneo de Instacart.
      propuestas: z.array(z.string().min(1).max(64)).max(3).default([]),
    }),
  );
  const f = await db
    .prepare(
      `SELECT p.*, ${CON_AJUSTE}, r.nombre AS restaurante_nombre, r.tipo_comercio AS tipo_comercio FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.id = ? AND p.restaurante_id = ? AND p.estado IN ('pagado','aceptado') AND p.repartidor_id IS NULL`,
    )
    .bind(id, rid)
    .first<FilaPedido>();
  if (!f)
    throw new ErrorDatos(
      'Este pedido ya salió o ya cambió de estado: no se puede quitar un plato.',
      undefined,
      409,
    );
  // C-TIENDAS-FALTANTES: en una tienda pueden faltar varios productos (uno detrás de otro, como en
  // Instacart); en un restaurante, uno por pedido. Nunca dos a la vez sin resolver.
  const esTienda = String(f.tipo_comercio ?? 'restaurante') !== 'restaurante';
  if (f.aj_plato && (!esTienda || f.aj_estado === 'pendiente'))
    throw new ErrorDatos('Ya avisaste de un plato en este pedido.', undefined, 409);
  const linea = (
    JSON.parse(String(f.lineas_json)) as {
      platoId: string;
      nombreEs: string;
      nombreEn: string;
      sustitucion?: string;
      reemplazo?: { platoId: string };
    }[]
  ).find((l) => l.platoId === platoId);
  if (!linea) throw new ErrorDatos('Ese plato no está en este pedido.', 'platoId', 404);
  const { devolucion } = await calcularSinPlato(db, f, platoId);
  // Los reemplazos tienen que ser de esta tienda, disponibles y distintos del que falta.
  const propuestas: Propuesta[] = [];
  const noDisponible = () =>
    new ErrorDatos(
      'Ese reemplazo no está disponible en tu tienda. Elige otro producto.',
      'propuestas',
      409,
    );
  for (const pid of [...new Set(idsPropuestos)].filter((x) => x !== platoId)) {
    if (esTienda) {
      // Del catálogo de la tienda, con su precio rebajado y solo si hay hoy.
      const [l] = await lineasDeTienda(c, { id: rid, tipo_comercio: f.tipo_comercio }, [
        { platoId: pid, cantidad: 1 },
      ]).catch(() => {
        throw noDisponible();
      });
      if (!l) throw noDisponible();
      propuestas.push({
        platoId: l.platoId,
        nombreEs: l.nombreEs,
        nombreEn: l.nombreEn,
        precioCentavos: l.precioCentavos,
        imagen: l.imagen ? String(l.imagen) : null,
      });
      continue;
    }
    const pl = await db
      .prepare(
        'SELECT id, nombre_es, nombre_en, precio_centavos, imagen FROM platos WHERE id = ? AND restaurante_id = ? AND disponible = 1',
      )
      .bind(pid, rid)
      .first<{
        id: string;
        nombre_es: string;
        nombre_en: string;
        precio_centavos: number;
        imagen: string | null;
      }>();
    if (!pl) throw noDisponible();
    propuestas.push({
      platoId: pl.id,
      nombreEs: pl.nombre_es,
      nombreEn: pl.nombre_en,
      precioCentavos: Number(pl.precio_centavos),
      imagen: pl.imagen,
    });
  }
  // ETP-4 (C-TIENDAS-REEMPLAZO-ELEGIDO): el reemplazo que eligió el cliente va primero, si hoy
  // está; si tampoco está, se devuelve el dinero (no se cambia por otro que no eligió).
  let elegido = false;
  if (
    esTienda &&
    linea.sustitucion === 'especifico' &&
    linea.reemplazo &&
    linea.reemplazo.platoId !== platoId
  ) {
    const [l] = await lineasDeTienda(c, { id: rid, tipo_comercio: f.tipo_comercio }, [
      { platoId: linea.reemplazo.platoId, cantidad: 1 },
    ]).catch(() => [undefined]);
    if (l) {
      propuestas.unshift({
        platoId: l.platoId,
        nombreEs: l.nombreEs,
        nombreEn: l.nombreEn,
        precioCentavos: l.precioCentavos,
        imagen: l.imagen ? String(l.imagen) : null,
      });
      elegido = true;
    }
  }
  await db
    .prepare(
      `INSERT INTO ajustes_pedido (pedido_id, plato_id, nombre_es, nombre_en, devolucion, propuestas_json) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(pedido_id) DO UPDATE SET plato_id = excluded.plato_id, nombre_es = excluded.nombre_es,
         nombre_en = excluded.nombre_en, devolucion = excluded.devolucion, estado = 'pendiente',
         propuestas_json = excluded.propuestas_json, reemplazo_id = NULL,
         creado_en = datetime('now'), resuelto_en = NULL
       WHERE ajustes_pedido.estado = 'quitado'`,
    )
    .bind(id, platoId, linea.nombreEs, linea.nombreEn, devolucion, JSON.stringify(propuestas))
    .run();
  await anotarEvento(db, id, 'plato_agotado', linea.nombreEs);
  // C-TIENDAS-FALTANTES: el cliente ya dijo en el carrito qué hacer si falta. «Reembolsar» y «uno
  // parecido» (si la tienda lo marca, tampoco tenía uno parecido) se devuelven en el acto; solo
  // «avísame» espera su decisión, como un restaurante.
  // «Uno parecido» con un reemplazo propuesto: va el primero, como el «Best match» de Instacart.
  if (
    esTienda &&
    ((linea.sustitucion === 'similar' && propuestas[0]) ||
      (linea.sustitucion === 'especifico' && elegido))
  ) {
    const r = await aplicarAjuste(
      c.env,
      db,
      id,
      'reemplazar',
      exigir(c, 'restaurante').id,
      propuestas[0]!.platoId,
    );
    return c.json({ ok: true, devolucion: r.devolucion, resuelto: true, cancelado: r.cancelado });
  }
  if (esTienda && (linea.sustitucion ?? 'reembolsar') !== 'contactar') {
    const r = await aplicarAjuste(c.env, db, id, 'quitar', exigir(c, 'restaurante').id);
    return c.json({ ok: true, devolucion: r.devolucion, resuelto: true, cancelado: r.cancelado });
  }
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
  // C-PEDIDO-PRUEBA: rechazar uno de prueba no pasa por Stripe ni avisa a nadie.
  if (esPedidoPrueba(c.req.param('id'))) {
    await avanzarPrueba(base(c), rid, c.req.param('id'), 'rechazar');
    return c.json({ ok: true });
  }
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
      'SELECT z.zona_horaria, z.moneda FROM restaurantes r JOIN zonas z ON z.id = r.zona_id WHERE r.id = ?',
    )
    .bind(rid)
    .first<{ zona_horaria: string; moneda: string | null }>();
  const [desde, hasta] = limitesDelDia(z?.zona_horaria ?? 'America/New_York');
  // C-MONEDA-RECORRIDO: solo los pedidos en la moneda del restaurante (nunca se suman monedas).
  const moneda = z?.moneda || 'USD';
  const f = await db
    .prepare(
      `SELECT COUNT(CASE WHEN estado = 'entregado' THEN 1 END) AS entregados,
      COUNT(CASE WHEN estado IN ('pagado','aceptado','listo','en_camino') THEN 1 END) AS en_curso,
      COUNT(CASE WHEN estado = 'cancelado' THEN 1 END) AS cancelados,
      COALESCE(SUM(CASE WHEN estado = 'entregado' THEN subtotal END), 0) AS ventas,
      COALESCE(SUM(CASE WHEN estado = 'entregado' THEN regalo END), 0) AS regalos,
      COALESCE(SUM(CASE WHEN estado = 'entregado' THEN comision END), 0) AS comision,
      COALESCE(SUM(CASE WHEN estado = 'entregado' THEN pago_restaurante END), 0) AS neto
      FROM pedidos WHERE restaurante_id = ? AND pagado_en >= ? AND pagado_en < ? AND moneda = ?`,
    )
    .bind(rid, desde, hasta, moneda)
    .first<Record<string, number>>();
  // Los últimos 30 días y el plan: con eso el panel compara lo que le queda con Divoox y con
  // otras apps (calculadora de «Beneficios», C-COMPARA-REST).
  const mes = await db
    .prepare(
      `SELECT COALESCE(SUM(p.subtotal), 0) AS ventas, COALESCE(SUM(p.regalo), 0) AS regalos,
      COUNT(p.id) AS pedidos, r.plan AS plan
      FROM restaurantes r LEFT JOIN pedidos p ON p.restaurante_id = r.id AND p.estado = 'entregado'
      AND p.pagado_en >= datetime('now','-30 days') AND p.moneda = ? WHERE r.id = ?`,
    )
    .bind(moneda, rid)
    .first<{ ventas: number; regalos: number; pedidos: number; plan: string }>();
  return c.json({
    moneda,
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
  // C-MONEDA-RECORRIDO: las cifras en la moneda del restaurante, sin mezclar otras.
  const moneda =
    (
      await db
        .prepare(
          'SELECT z.moneda FROM restaurantes r JOIN zonas z ON z.id = r.zona_id WHERE r.id = ?',
        )
        .bind(rid)
        .first<{ moneda: string | null }>()
    )?.moneda || 'USD';
  const periodo = async (dias: number) => {
    const f = await db
      .prepare(
        `SELECT COUNT(*) AS pedidos, COALESCE(SUM(subtotal), 0) AS ventas, COALESCE(SUM(pago_restaurante), 0) AS neto
         FROM pedidos WHERE restaurante_id = ? AND estado = 'entregado' AND pagado_en >= datetime('now', ?) AND moneda = ?`,
      )
      .bind(rid, `-${dias} days`, moneda)
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
  // C-RENDIMIENTO-REST: por hora y día (hora del restaurante), clientes nuevos y que repiten, cancelados.
  const zona =
    (
      await db
        .prepare(
          'SELECT z.zona_horaria FROM restaurantes r JOIN zonas z ON z.id = r.zona_id WHERE r.id = ?',
        )
        .bind(rid)
        .first<{ zona_horaria: string | null }>()
    )?.zona_horaria || 'America/New_York';
  const { results: entregados } = await db
    .prepare(
      `SELECT pagado_en, subtotal, cliente_id FROM pedidos WHERE restaurante_id = ? AND estado = 'entregado'
        AND pagado_en >= datetime('now','-30 days') AND moneda = ? LIMIT 5000`,
    )
    .bind(rid, moneda)
    .all<{ pagado_en: string; subtotal: number; cliente_id: string }>();
  const { results: previos } = await db
    .prepare(
      `SELECT DISTINCT cliente_id FROM pedidos WHERE restaurante_id = ? AND estado = 'entregado'
        AND pagado_en < datetime('now','-30 days')`,
    )
    .bind(rid)
    .all<{ cliente_id: string }>();
  const rendimiento = rendimientoRestaurante(
    entregados.map((f) => ({
      pagadoEn: f.pagado_en,
      subtotal: Number(f.subtotal),
      clienteId: f.cliente_id,
    })),
    zona,
    new Set(previos.map((f) => f.cliente_id)),
  );
  const cancelados = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM pedidos WHERE restaurante_id = ? AND estado = 'cancelado'
        AND cancelado_en >= datetime('now','-30 days')`,
    )
    .bind(rid)
    .first<{ n: number }>();
  // C-PRECISION-PEDIDOS (29 oct 2026), como la «precisión de pedidos» de DoorDash Merchant: pedidos
  // del mes con una queja de plato faltante, equivocado o dañado, y lo devuelto a los clientes.
  const problemas = await db
    .prepare(
      `SELECT COUNT(DISTINCT t.pedido_id) AS n FROM tickets t JOIN pedidos p ON p.id = t.pedido_id
        WHERE p.restaurante_id = ? AND t.tipo = 'queja' AND t.creado_en >= datetime('now','-30 days')
          AND json_extract(t.datos_json, '$.motivo') IN ('articulo_faltante','pedido_incorrecto','frio_o_danado')`,
    )
    .bind(rid)
    .first<{ n: number }>();
  const devuelto = await db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(d.monto), 0) AS monto FROM devoluciones d JOIN pedidos p ON p.id = d.pedido_id
        WHERE p.restaurante_id = ? AND p.moneda = ? AND d.creado_en >= datetime('now','-30 days')`,
    )
    .bind(rid, moneda)
    .first<{ n: number; monto: number }>();
  const conProblemas = Number(problemas?.n ?? 0);
  return c.json({
    tablero: {
      moneda,
      zonaHoraria: zona,
      ...rendimiento,
      canceladosMes: Number(cancelados?.n ?? 0),
      pedidosConProblemasMes: conProblemas,
      precisionPct: entregados.length
        ? Math.round(
            ((entregados.length - Math.min(conProblemas, entregados.length)) / entregados.length) *
              1000,
          ) / 10
        : null,
      reembolsosMes: { cantidad: Number(devuelto?.n ?? 0), monto: Number(devuelto?.monto ?? 0) },
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

/** La versión de los términos que le falta aceptar (null si ya la aceptó; al revisor nunca). */
async function terminosPorAceptar(
  db: D1Database,
  usuarioId: string,
  revisor: boolean,
): Promise<string | null> {
  if (revisor) return null;
  const ya = await db
    .prepare('SELECT 1 FROM terminos_aceptados WHERE usuario_id = ? AND version = ?')
    .bind(usuarioId, VERSION_TERMINOS)
    .first();
  return ya ? null : VERSION_TERMINOS;
}

operacion.post('/repartidor/terminos', async (c) => {
  const { u, db } = await miFicha(c);
  const { version } = await leerCuerpo(c, z.object({ version: z.string().trim().min(1).max(20) }));
  if (version !== VERSION_TERMINOS)
    throw new ErrorDatos(
      'Esa no es la versión vigente de los términos. Vuelve a abrir la app.',
      undefined,
      409,
    );
  await db
    .prepare('INSERT OR IGNORE INTO terminos_aceptados (usuario_id, version) VALUES (?, ?)')
    .bind(u.id, version)
    .run();
  return c.json({ ok: true });
});

operacion.post('/repartidor/telefono/codigo', async (c) => {
  const { u, db } = await miFicha(c);
  const ultimos = await mandarCodigo(c.env, db, u.id, u.idioma === 'en' ? 'en' : 'es');
  return c.json({ ok: true, ultimos });
});

operacion.post('/repartidor/telefono/verificar', async (c) => {
  const { u, db } = await miFicha(c);
  const { codigo } = await leerCuerpo(
    c,
    z.object({
      codigo: z
        .string()
        .trim()
        .regex(/^\d{6}$/),
    }),
  );
  await comprobarCodigo(db, u.id, codigo);
  return c.json({ ok: true });
});

operacion.put('/repartidor/modo-pago', async (c) => {
  const { u, db } = await miFicha(c);
  const { modo } = await leerCuerpo(c, z.object({ modo: z.enum(['oferta', 'tiempo']) }));
  if (modo === 'tiempo' && (await leerPorTiempo(db)).centavosHora <= 0)
    throw new ErrorDatos('Ganar por tiempo todavía no está disponible en tu zona.', 'modo', 409);
  await db
    .prepare('UPDATE repartidores SET modo_pago = ? WHERE usuario_id = ?')
    .bind(modo, u.id)
    .run();
  return c.json({ modo });
});

operacion.get('/admin/ganar-por-tiempo', async (c) => {
  exigir(c, 'admin');
  return c.json(await leerPorTiempo(base(c)));
});

operacion.put('/admin/ganar-por-tiempo', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      centavosHora: z.number().int().min(0).max(10_000),
      centavosMilla: z.number().int().min(0).max(500),
    }),
  );
  await base(c)
    .prepare(
      "INSERT INTO config (clave, valor) VALUES ('ganar_por_tiempo', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
    )
    .bind(JSON.stringify(d))
    .run();
  return c.json(d);
});

operacion.get('/repartidor/estado', async (c) => {
  const { u, db, ficha } = await miFicha(c);
  const activo = await entregaActiva(db, u.id);
  const selfiePendiente = await db
    .prepare('SELECT clave FROM selfies_control WHERE usuario_id = ? AND tomada_en IS NULL')
    .bind(u.id)
    .first<{ clave: string }>();
  const terminos = await terminosPorAceptar(db, u.id, await esRevisor(c, u.correo));
  // Días sin conectarse (desde su última ubicación), solo si son DIAS_PARA_VERIFICAR_AL_VOLVER o más.
  const ultima = ficha.ubicacion_en ? Date.parse(`${String(ficha.ubicacion_en)}Z`) : NaN;
  const dias = Number.isFinite(ultima) ? Math.floor((Date.now() - ultima) / 86_400_000) : 0;
  return c.json({
    terminosPorAceptar: terminos,
    vuelveTrasDias:
      Number(ficha.conectado) !== 1 && dias >= DIAS_PARA_VERIFICAR_AL_VOLVER ? dias : null,
    selfieControlPendiente: Boolean(selfiePendiente),
    // C-TELEFONO-VUELTA: los últimos 4 del teléfono que hay que confirmar por SMS (o null).
    telefonoPorVerificar: (await esRevisor(c, u.correo))
      ? null
      : await telefonoPorVerificar(c.env, db, u.id),
    // C-PRUEBA-DE-VIDA: ya mandó la de frente y falta la de giro (sobrevive a cerrar la app).
    selfieControlFalta: selfiePendiente ? (selfiePendiente.clave ? 'giro' : 'frente') : null,
    conectado: Number(ficha.conectado) === 1,
    // C-GANAR-POR-TIEMPO: si está encendido, el repartidor elige cómo cobrar.
    ganarPorTiempo: await (async () => {
      const t = await leerPorTiempo(db);
      return {
        activo: t.centavosHora > 0,
        centavosHora: t.centavosHora,
        centavosMilla: t.centavosMilla,
        modo:
          (ficha.modo_pago as string | null) === 'tiempo' && t.centavosHora > 0
            ? 'tiempo'
            : 'oferta',
      };
    })(),
    // C-UNIDAD-ELEGIDA: la zona dice el país (millas o kilómetros si el repartidor no eligió).
    zonaId: (ficha.zona_id as string | null) ?? null,
    pausado: Number(ficha.pausado ?? 0) === 1,
    tipo: ficha.tipo,
    puntos: Number(ficha.puntos),
    nivel: nivelDe(Number(ficha.puntos)),
    // C-REWARDS-PILOTO: el nivel de reputación, solo si Rewards está activo para este repartidor.
    reputacion:
      (await reputacionVisible({ ...c.env, ENTORNO_RELOJ: entornoDe(c.req.url) }, db, u.id)) ??
      undefined,
    // C-ENTREGA-PRACTICA: sin entrega real, la de práctica de la cuenta de revisión (o null).
    activo: activo
      ? { ...conDatosRestaurante(activo), esperaAusenteMin: minutosEsperaAusente(c.env) }
      : await practicaActiva(db, u.id),
    agrupados: await agrupadosDe(db, u.id, activo),
    // C-OCUPADO-VISIBLE (BRF-1): si una ruta Flex o un viaje lo ocupa, no le llegan pedidos de
    // comida (C-FLEX-OCUPACION); la app lo dice en vez de «Buscando pedidos cerca de ti…».
    ocupadoEn:
      (
        await db
          .prepare(
            "SELECT tipo FROM conductor_ocupacion WHERE conductor_id = ? AND tipo <> 'comida'",
          )
          .bind(u.id)
          .first<{ tipo: 'ruta_flex' | 'operacion' }>()
      )?.tipo ?? null,
  });
});

const TEXTO_PAPEL = new Map<FaltaPapel, string>([
  [
    'licencia',
    'Para repartir en carro o moto, escribe tu licencia y su vencimiento en «Mis datos y vehículo».',
  ],
  [
    'licencia_vencida',
    'Tu licencia está vencida. Actualízala en «Mis datos y vehículo» para conectarte.',
  ],
  [
    'seguro',
    'Para repartir en carro o moto, escribe tu seguro y su vencimiento en «Mis datos y vehículo».',
  ],
  [
    'seguro_vencido',
    'Tu seguro está vencido. Actualízalo en «Mis datos y vehículo» para conectarte.',
  ],
]);

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
  // G4b (como DoorDash): en carro o moto, licencia y seguro vigentes antes de conectarse.
  if (d.conectado && (await papelesObligatorios(db))) {
    const p = await db
      .prepare(
        'SELECT vehiculo_tipo, licencia_numero, licencia_vence, seguro_poliza, seguro_vence FROM repartidor_datos WHERE usuario_id = ?',
      )
      .bind(u.id)
      .first<{
        vehiculo_tipo: string;
        licencia_numero: string | null;
        licencia_vence: string | null;
        seguro_poliza: string | null;
        seguro_vence: string | null;
      }>();
    const falta = faltaPapel({
      vehiculoTipo: p?.vehiculo_tipo,
      licenciaNumero: p?.licencia_numero,
      licenciaVence: p?.licencia_vence,
      seguroPoliza: p?.seguro_poliza,
      seguroVence: p?.seguro_vence,
    });
    if (falta) throw new ErrorDatos(TEXTO_PAPEL.get(falta) ?? '', 'papeles', 409);
  }
  // C-DESPACHO-CATALOGO (NXT-6): en una zona con el despacho por catálogo encendido, se dice al
  // conectarse por qué no le llegarían pedidos de Comida (como DoorDash: sin activar, no se reparte).
  let sinComida: MotivoSinComida | null = null;
  if (d.conectado) {
    const z = await db
      .prepare(
        "SELECT COALESCE(r.zona_id, u.zona_id, 'US-FL-MIAMI') AS zona_id FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id WHERE u.id = ?",
      )
      .bind(u.id)
      .first<{ zona_id: string }>();
    if (z) sinComida = await frenoAlConectar(db, u.id, z.zona_id);
  }
  // C-TERMINOS-ACTUALIZADOS (31 oct 2026, como DoorDash): si cambiaron, se aceptan antes.
  if (d.conectado && (await terminosPorAceptar(db, u.id, await esRevisor(c, u.correo))))
    throw new ErrorDatos(
      'Actualizamos los términos para repartidores. Léelos y acéptalos para conectarte.',
      'terminos',
      409,
    );
  // C-TELEFONO-VUELTA (D8, como DoorDash): tras 14 días sin conectarse, el teléfono se confirma
  // por SMS. Solo donde el SMS sale; al revisor de las tiendas no se le pide.
  if (
    d.conectado &&
    !(await esRevisor(c, u.correo)) &&
    (await telefonoPorVerificar(c.env, db, u.id))
  )
    throw new ErrorDatos(
      'Bienvenido de vuelta. Confirma tu teléfono con el código que te mandamos por SMS.',
      'telefono',
      409,
    );
  // Identidad continua: al conectarse, a algunos se les pide una selfie de control (al azar, no
  // más de una por semana). Mientras esté pendiente, no se conecta. Al revisor de las tiendas no
  // se le pide (27 oct 2026): probaría la app y se quedaría trancado en una selfie.
  if (d.conectado && !(await esRevisor(c, u.correo))) {
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
      // C-VUELTA-VERIFICA (31 oct 2026, como DoorDash al volver a la app): si lleva 14 días o más
      // sin conectarse, la foto de control va siempre, sin importar el azar ni la de la semana.
      const vuelve = await db
        .prepare(
          `SELECT 1 FROM repartidores WHERE usuario_id = ?1 AND ubicacion_en IS NOT NULL
           AND ubicacion_en < datetime('now','-${DIAS_PARA_VERIFICAR_AL_VOLVER} days')
           AND NOT EXISTS (SELECT 1 FROM selfies_control sc WHERE sc.usuario_id = ?1
             AND sc.tomada_en > datetime('now','-${DIAS_PARA_VERIFICAR_AL_VOLVER} days'))`,
        )
        .bind(u.id)
        .first();
      // «1» = siempre (pruebas, recorrido); «0» = nunca al azar (las demás pruebas); sin valor = al azar.
      const toca =
        c.env.SELFIE_CONTROL_SIEMPRE === '1' ||
        (c.env.SELFIE_CONTROL_SIEMPRE !== '0' && Math.random() < PROBABILIDAD_SELFIE);
      if (vuelve || (!reciente && toca))
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
  // C-REPARTIDOR-DESTACADO: al conectarse se revisa si sigue cumpliendo (no frena la conexión).
  if (d.conectado)
    await evaluarDestacado(db, u.id).catch((e: unknown) =>
      console.error('destacado: no se pudo revisar', e),
    );
  // NXT-6x: conectado para otros servicios, pero sin Comida: el porqué, para avisarle.
  return c.json({
    conectado: d.conectado,
    cobertura: aqui.estado,
    // NXT-6y: con el texto en su idioma, para que la app se lo diga sin bloquearlo.
    ...(sinComida
      ? {
          sinComida,
          avisoComida: enIdiomaDePeticion(
            errorSinComida(sinComida).message,
            idiomaDeLaPeticion((n) => c.req.header(n)),
          ),
        }
      : {}),
  });
});

/**
 * C-POSICION-SIN-REESCRIBIR (regla «cada escritura tiene presupuesto»): la ficha del repartidor
 * solo se reescribe si se movió MOVIDO_MIN_M o si su última posición tiene más de
 * REFRESCO_POSICION_S. El navegador ignora el «cada 10 s / 30 m» del GPS y mandaba cada lectura;
 * cada UPDATE pesa cinco filas con sus índices. Todos los umbrales de «sin señal» son de minutos.
 */
export const MOVIDO_MIN_M = 25;
export const REFRESCO_POSICION_S = 60;

export function hayQueReescribirPosicion(
  ficha: { lat?: unknown; lng?: unknown; ubicacion_en?: unknown },
  d: { lat: number; lng: number },
  ahora = Date.now(),
): boolean {
  if (ficha.lat == null || ficha.lng == null || !ficha.ubicacion_en) return true;
  const en = Date.parse(`${String(ficha.ubicacion_en).replace(' ', 'T')}Z`);
  if (!Number.isFinite(en) || ahora - en >= REFRESCO_POSICION_S * 1000) return true;
  return metrosEntre({ lat: Number(ficha.lat), lng: Number(ficha.lng) }, d) >= MOVIDO_MIN_M;
}

operacion.post('/repartidor/ubicacion', async (c) => {
  const { u, db, ficha } = await miFicha(c);
  const d = await leerCuerpo(c, puntoConPrecision);
  // G2: una ubicación que el propio celular marca como simulada no se guarda ni cuenta; queda
  // anotada en el pedido activo para que soporte la vea.
  if (d.simulada) {
    const activo = await db
      .prepare(
        "SELECT id FROM pedidos WHERE repartidor_id = ? AND estado IN ('aceptado','listo','en_camino') LIMIT 1",
      )
      .bind(u.id)
      .first<{ id: string }>();
    if (activo)
      await anotarEvento(db, activo.id, 'gps_simulado', `${d.lat.toFixed(4)},${d.lng.toFixed(4)}`);
    return c.json({ ok: true, simulada: true });
  }
  // C-LATIDO-UBICACION: una lectura vieja (el celular reenvía la última que tenía) no es señal
  // nueva. No se guarda ni refresca «última señal»: el cliente ve «señal perdida».
  if (edadLecturaMs(d) > LECTURA_VIEJA_MS) return c.json({ ok: true, lecturaVieja: true });
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
  if (hayQueReescribirPosicion(ficha, d)) {
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
  }
  await registrarHitos(c.env, db, u.id, d, muestras).catch((e: unknown) =>
    console.error('hitos', e),
  );
  // C-MODO-DESTINO: al llegar a su destino, el modo se apaga solo.
  await revisarLlegadaDestino(db, u.id, d);
  return c.json({ ok: true });
});

/**
 * Reparto: cada pedido listo para buscar repartidor se ofrece primero al más CERCANO al restaurante.
 * Si dos están igual de cerca (menos de medio km de diferencia), gana el de nivel más alto.
 * Rechazar o dejar vencer la oferta (60 s) solo la pasa al siguiente: no castiga.
 */
/** `en_turno`: C-TURNOS-REPARTIDOR, está dentro de un turno reservado (tiene prioridad). */
type Libre = {
  id: string;
  lat: number;
  lng: number;
  puntos: number;
  en_turno?: number;
  /** C-REPARTIDOR-DESTACADO */
  destacado?: number;
  /** C-REWARDS-PRIORIDAD: nivel de reputación, solo de los participantes del piloto. */
  nivel_rep?: string | null;
};

const RANGO_NIVEL = new Map([
  ['diamante', 3],
  ['oro', 2],
  ['plata', 1],
]);

/**
 * El orden de las ofertas: a igual tramo de distancia, primero quien está en su turno; después,
 * con la prioridad de Rewards encendida, el de mejor nivel de reputación (C-REWARDS-PRIORIDAD,
 * como Platinum de DoorDash); después el destacado y los puntos; al final, el más cerca.
 */
export function compararLibres(
  a: Libre & { km: number },
  b: Libre & { km: number },
  prioridadNivel: boolean,
): number {
  const rango = (d: Libre) => (prioridadNivel ? (RANGO_NIVEL.get(d.nivel_rep ?? '') ?? 0) : 0);
  return (
    Math.floor(a.km * 2) - Math.floor(b.km * 2) ||
    Number(b.en_turno ?? 0) - Number(a.en_turno ?? 0) ||
    rango(b) - rango(a) ||
    Number(b.destacado ?? 0) - Number(a.destacado ?? 0) ||
    nivelDe(b.puntos).indice - nivelDe(a.puntos).indice ||
    a.km - b.km
  );
}

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

async function libresEn(
  db: D1Database,
  zonaId: string,
  celdas: string[] | null,
  /** C-FLOTA-PROPIA: solo los repartidores propios de este restaurante (sin mirar zona ni celda). */
  flotaDe?: string,
): Promise<Libre[]> {
  const filtroCeldas =
    celdas && !flotaDe ? `AND d.geohash IN (${celdas.map(() => '?').join(',')})` : '';
  const donde = flotaDe
    ? `d.usuario_id IN (SELECT usuario_id FROM flota_restaurante WHERE restaurante_id = ? AND estado = 'activo')`
    : 'd.zona_id = ?';
  const { results } = await db
    .prepare(
      `SELECT d.usuario_id AS id, d.lat, d.lng, d.puntos, d.destacado,
        CASE WHEN EXISTS (SELECT 1 FROM piloto_participantes pp WHERE pp.usuario_id = d.usuario_id)
          THEN (SELECT rd.nivel_con_gracia FROM reputacion_diaria rd WHERE rd.repartidor_id = d.usuario_id
                ORDER BY rd.fecha DESC LIMIT 1) END AS nivel_rep,
        EXISTS (SELECT 1 FROM turnos_repartidor t WHERE t.repartidor_id = d.usuario_id AND t.estado IN ('programado','activo')
          AND t.inicio <= datetime('now') AND t.fin > datetime('now')) AS en_turno
      FROM repartidores d
      WHERE ${donde} AND d.conectado = 1 AND d.pausado = 0 ${filtroCeldas} AND d.lat IS NOT NULL
      AND d.ubicacion_en > datetime('now','-10 minutes')
      AND NOT EXISTS (SELECT 1 FROM pedidos p WHERE p.repartidor_id = d.usuario_id AND p.estado IN ('aceptado','listo','en_camino'))
      AND NOT EXISTS (SELECT 1 FROM ofertas o WHERE o.repartidor_id = d.usuario_id AND o.estado = 'ofrecida')
      AND NOT EXISTS (SELECT 1 FROM conductor_ocupacion c WHERE c.conductor_id = d.usuario_id)
      AND NOT EXISTS (SELECT 1 FROM ofertas_operacion x WHERE x.conductor_id = d.usuario_id AND x.estado = 'ofrecida')`,
    )
    .bind(flotaDe ?? zonaId, ...(flotaDe ? [] : (celdas ?? [])))
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
      `SELECT p.id, p.zona_id, p.pago_repartidor, p.moneda, p.estado, p.aceptado_en, p.tiempo_prep_min, r.lat, r.lng, r.geohash,
        p.lat AS e_lat, p.lng AS e_lng, p.restaurante_id, r.flota_modo, r.flota_respaldo, r.dueno_id, p.flota_aviso_en,
        CAST((julianday(p.programado_para) - julianday('now')) * 1440 AS INTEGER) AS min_franja
      FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
      WHERE p.estado IN ('aceptado','listo') AND p.repartidor_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM recogidas rc WHERE rc.pedido_id = p.id)
      -- C-PEDIDO-PROGRAMADO: uno para más tarde se ofrece desde 45 minutos antes de su franja.
      AND (p.programado_para IS NULL OR p.programado_para <= datetime('now', '+45 minutes'))
      AND NOT EXISTS (SELECT 1 FROM ofertas o WHERE o.pedido_id = p.id AND o.estado = 'ofrecida') ORDER BY p.pagado_en LIMIT 20`,
    )
    .all<{
      id: string;
      zona_id: string;
      pago_repartidor: number | null;
      moneda: string | null;
      estado: string;
      aceptado_en: string | null;
      tiempo_prep_min: number | null;
      lat: number | null;
      lng: number | null;
      geohash: string | null;
      e_lat: number | null;
      e_lng: number | null;
      min_franja: number | null;
      restaurante_id: string;
      flota_modo: string | null;
      flota_respaldo: number | null;
      dueno_id: string;
      flota_aviso_en: string | null;
    }>();
  if (!pendientes.length) return;
  // C-FLOTA-PROPIA: quién reparte solo para su restaurante.
  const flotas = await flotasActivas(db);
  // C-MODO-DESTINO: quien tiene el modo encendido solo recibe entregas que lo acercan a su destino.
  const destinos = await destinosActivos(db);
  const prioridadNivel = (await leerAjustes(db)).prioridadDespacho;
  const ocupados = new Set<string>();
  const zonasCatalogo = await zonasDespachoCatalogo(db);
  const memoCatalogo = new Map<string, boolean>();
  pedidos: for (const p of pendientes) {
    // C-REOFERTA-UNICO: quien ya la vio (rechazó, la dejó vencer o la soltó) no la recibe otra
    // vez mientras haya otro a quien ofrecerla; si no hay nadie más, vuelve a ser candidato pasado
    // el respiro (con un solo repartidor el pedido no se queda «Buscando repartidor…» para siempre).
    const { results: yaVistos } = await db
      .prepare(
        "SELECT repartidor_id, creada_en > datetime('now', ?) AS reciente FROM ofertas WHERE pedido_id = ?",
      )
      .bind(`-${SEGUNDOS_OFERTA + RESPIRO_REOFERTA} seconds`, p.id)
      .all<{ repartidor_id: string; reciente: number }>();
    const vistos = new Set(yaVistos.map((v) => v.repartidor_id));
    const recientes = new Set(
      yaVistos.filter((v) => Number(v.reciente) === 1).map((v) => v.repartidor_id),
    );
    let excluir = vistos;
    // Despacho con reloj: solo a quien llegaría cuando la comida esté lista (ni antes a esperar).
    // C-PEDIDO-PROGRAMADO: la comida debe estar lista 15 minutos antes de la franja, no antes.
    const faltan = Math.max(
      minutosParaListo(p.estado, p.aceptado_en, p.tiempo_prep_min),
      p.min_franja == null ? 0 : p.min_franja - 15,
    );
    const ordenar = (libres: Libre[]) =>
      libres
        .filter((d) => !excluir.has(d.id) && !ocupados.has(d.id))
        .map((d) => ({
          ...d,
          km:
            p.lat != null && p.lng != null
              ? distanciaKm({ lat: d.lat, lng: d.lng }, { lat: p.lat, lng: p.lng })
              : 0,
        }))
        .filter((d) => d.km <= 15 && debeOfrecer(faltan, d.km))
        // C-FLOTA-PROPIA: un repartidor propio solo recibe los pedidos de su restaurante.
        .filter((d) => (flotas.get(d.id) ?? p.restaurante_id) === p.restaurante_id)
        .filter((d) => {
          const destino = destinos.get(d.id);
          if (!destino) return true;
          return (
            p.e_lat != null &&
            p.e_lng != null &&
            acercaAlDestino(d, { lat: Number(p.e_lat), lng: Number(p.e_lng) }, destino)
          );
        })
        // C-TURNOS-REPARTIDOR, C-REWARDS-PRIORIDAD y C-REPARTIDOR-DESTACADO, en ese orden.
        .sort((a, b) => compararLibres(a, b, prioridadNivel));
    // Camino rápido: solo la celda del restaurante y sus 8 vecinas (índice zona + celda).
    // Si ahí no hay nadie libre, se busca en toda la zona. Nunca se cruza de zona.
    let candidatos: (Libre & { km: number })[] = [];
    for (const ronda of recientes.size < vistos.size ? [vistos, recientes] : [vistos]) {
      excluir = ronda;
      // C-FLOTA-PROPIA: primero (o solo) a los repartidores del restaurante. No se mira la
      // habilitación del catálogo (son del restaurante), pero sí el saldo del cobro directo, igual
      // que al aceptar: nunca se ofrece un pedido que después no se va a poder aceptar. El reparto
      // del dinero con flota propia lo decide Richard; hasta entonces vale la regla de siempre.
      const propia = p.flota_modo === 'propia';
      if (propia)
        candidatos = await conSaldoParaDirecto(
          db,
          p.id,
          ordenar(await libresEn(db, p.zona_id, null, p.restaurante_id)),
        );
      if (candidatos.length) {
        // Ya hay a quién ofrecerlo dentro de su flota.
      } else if (propia && Number(p.flota_respaldo) !== 1) {
        // Sin respaldo, nunca cae solo a la red: se le avisa al restaurante, una sola vez por pedido.
        if (!p.flota_aviso_en) {
          const r = await db
            .prepare(
              "UPDATE pedidos SET flota_aviso_en = datetime('now') WHERE id = ? AND flota_aviso_en IS NULL",
            )
            .bind(p.id)
            .run();
          if (env && r.meta.changes > 0)
            await notificar(env, db, p.dueno_id, {
              titulo: 'Ningún repartidor tuyo está libre',
              cuerpo: `El pedido ${p.id.slice(0, 4).toUpperCase()} espera repartidor. Avísale a tu equipo o enciende el respaldo de Divoox.`,
              datos: { tipo: 'flota_sin_repartidor', pedidoId: p.id },
            }).catch((e: unknown) => console.error('flota: no se pudo avisar al restaurante', e));
        }
        continue pedidos;
      } else if (!zonasCatalogo.has(String(p.zona_id))) {
        // Fase 2 · cobro directo: solo a quien tiene saldo para la comisión y no pasó el tope de
        // efectivo, revisado EN CADA ETAPA antes de ampliar (C-DESPACHO-SALDO-ETAPAS, ETP-1): un libre
        // sin saldo en la celda del restaurante no tapa a uno con saldo en el resto de la zona.
        candidatos = p.geohash
          ? await conSaldoParaDirecto(
              db,
              p.id,
              ordenar(await libresEn(db, p.zona_id, celdasVecinas(p.geohash))),
            )
          : [];
        if (!candidatos.length)
          candidatos = await conSaldoParaDirecto(
            db,
            p.id,
            ordenar(await libresEn(db, p.zona_id, null)),
          );
        // Agrupar: un repartidor que todavía no recogió otro pedido de este MISMO restaurante y cuya
        // entrega queda cerca de esta (desvío menor a 5 minutos) se lo lleva en el mismo viaje.
        if (!candidatos.length) candidatos = ordenar(await agrupablesPara(db, p.id));
      } else {
        // C-DESPACHO-CATALOGO (NXT-6, NXT-6x): con el interruptor de la zona encendido, solo quien
        // está activado para Comida según el catálogo, revisado EN CADA ETAPA antes de decidir si se
        // amplía la búsqueda (un no habilitado en la celda no tapa a un habilitado en la zona), junto
        // con el saldo del cobro directo; para en cuanto junta los que hacen falta.
        const cuantos = vistos.size >= RECHAZOS_PARA_ABRIR ? 20 : 1;
        const saldo = async (d: { id: string }) => (await puedeTomarDirecto(db, p.id, d.id)).ok;
        candidatos = p.geohash
          ? await filtrarPorCatalogo(
              db,
              ordenar(await libresEn(db, p.zona_id, celdasVecinas(p.geohash))),
              cuantos,
              memoCatalogo,
              saldo,
            )
          : [];
        if (!candidatos.length)
          candidatos = await filtrarPorCatalogo(
            db,
            ordenar(await libresEn(db, p.zona_id, null)),
            cuantos,
            memoCatalogo,
            saldo,
          );
        if (!candidatos.length)
          candidatos = await filtrarPorCatalogo(
            db,
            ordenar(await agrupablesPara(db, p.id)),
            cuantos,
            memoCatalogo,
          );
      }
      if (candidatos.length) break;
    }
    if (!candidatos.length) continue;
    // C-PAGO-PICO: en una celda con demanda alta, la primera oferta lleva el pago pico (si está
    // encendido y queda presupuesto hoy). Se guarda como bono del pedido y se cobra al entregar.
    const ya = await db
      .prepare('SELECT centavos FROM bonos_pedido WHERE pedido_id = ?')
      .bind(p.id)
      .first<{ centavos: number }>();
    let bono = Number(ya?.centavos ?? 0);
    if (!ya) {
      const pico = await pagoPicoPara(db, String(p.zona_id), p.lat, p.lng);
      if (pico) {
        await db
          .prepare(
            "INSERT OR IGNORE INTO bonos_pedido (pedido_id, centavos, motivo) VALUES (?, ?, 'hora_pico')",
          )
          .bind(p.id, pico)
          .run();
        await anotarEvento(db, p.id, 'pago_pico', `pago pico ${pico}`);
        bono = pico;
      }
    }
    // Oferta abierta: a los 3 rechazos (o vencimientos) se ofrece a todos a la vez con un bono
    // que paga Divoox. Todos los que ya la vieron son rechazos o vencimientos (no hay ofrecida).
    // Si ya llevaba pago pico, el bono de la oferta abierta se le suma.
    let abierta = false;
    if (vistos.size >= RECHAZOS_PARA_ABRIR) {
      // C-TOPES-PAIS: el bono del país de la zona (EE. UU.: el de siempre).
      const extra = (await topesDeZona(db, String(p.zona_id))).topes?.bonoOfertaAbierta ?? 0;
      abierta = extra > 0;
      const r = await db
        .prepare(
          `INSERT INTO bonos_pedido (pedido_id, centavos, motivo) VALUES (?1, ?2, 'oferta_abierta')
           ON CONFLICT(pedido_id) DO UPDATE SET centavos = centavos + ?2, motivo = 'oferta_abierta'
           WHERE motivo <> 'oferta_abierta'`,
        )
        .bind(p.id, extra)
        .run();
      if (r.meta.changes)
        await anotarEvento(db, p.id, 'oferta_abierta', `${vistos.size} rechazos, bono ${extra}`);
      bono = Number(
        (
          await db
            .prepare('SELECT centavos FROM bonos_pedido WHERE pedido_id = ?')
            .bind(p.id)
            .first<{ centavos: number }>()
        )?.centavos ?? 0,
      );
    }
    const elegidos = abierta ? candidatos.slice(0, 20) : candidatos.slice(0, 1);
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
            formatearMonto(Number(p.pago_repartidor ?? 0) + bono, String(p.moneda ?? 'USD'), i),
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
      texto: `Divoox: ${texto.titulo}. ${texto.cuerpo}`,
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
    // El bono de la oferta abierta se suma a lo que gana (lo paga Divoox al entregar).
    pagoRepartidor: Number(f.pago_repartidor) + Number(f.bono ?? 0),
    bono: Number(f.bono ?? 0),
    // C-PAGO-PICO: «hora_pico» u «oferta_abierta», para que la app diga por qué lleva bono.
    bonoMotivo: (f.bono_motivo as string | null) ?? null,
    distanciaKm: f.distancia_km == null ? null : Number(f.distancia_km),
    // C-DISTANCIA-POR-PAIS: el país del pedido decide millas o kilómetros en la app.
    pais: paisDelCodigoZona(f.zona_id as string | null),
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
  // C-ENTREGA-PRACTICA: a una cuenta de revisión sin ofertas reales le llega la de práctica.
  const practica = results.length ? [] : await ofertasPractica(c, esRevisor, SEGUNDOS_OFERTA);
  return c.json({
    ofertas: [
      ...results.map((f) => {
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
          // Cobro en mano (como DiDi y Rappi en efectivo): lo que el repartidor adelanta en el local
          // con su dinero, para que decida ANTES de aceptar.
          adelantoLocal: esDirecto(String(f.metodo_pago ?? 'tarjeta'))
            ? Number(f.pago_restaurante)
            : 0,
        };
      }),
      ...practica,
    ],
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
  // C-ACEPTAR-DOBLE-TOQUE: si el pedido ya es suyo (segundo toque o reintento), responde ok antes
  // de mirar la oferta, que ya quedó «aceptada».
  const yaSuyo = await db
    .prepare(
      "SELECT 1 FROM pedidos WHERE id = ? AND repartidor_id = ? AND estado IN ('aceptado','listo','en_camino')",
    )
    .bind(id, u.id)
    .first();
  if (yaSuyo) return c.json({ ok: true });
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
  // C-GANAR-POR-TIEMPO: si eligió «por tiempo», desde aquí corre su hora activa.
  await anotarPorTiempo(db, id, u.id);
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
  // C-FOTOS-SIN-METADATOS: la foto se guarda limpia; el GPS que traía queda aparte como prueba.
  const { gps } = await guardarFoto(foto.bucket, clave, foto.bytes, foto.tipo, {
    cacheControl: 'private, no-store',
  });
  if (gps) await anotarGpsFoto(db, clave, gps);
  await db
    .prepare(
      `INSERT OR REPLACE INTO evidencias (pedido_id, tipo, clave, lat, lng, distancia_m, modo, nota, creada_en, confirmada_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ${confirmada ? "datetime('now')" : 'NULL'})`,
    )
    .bind(pedidoId, tipo, clave, foto.donde.lat, foto.donde.lng, distanciaM, modo, nota)
    .run();
}

const lejos = (metros: number | null) => metros != null && metros > RADIO_LLEGADA_M;
/**
 * Las cuentas de los revisores de las tiendas prueban desde otra ciudad: sin regla de distancia.
 * Vienen de la variable CORREOS_REVISOR o de la tabla «revisores» (el botón del superadmin).
 */
export async function esRevisor(c: Ctx, correo: string): Promise<boolean> {
  // Solo con el correo confirmado (C-FRANQUICIA-CORREO-CONFIRMADO): las cuentas que crea el
  // superadmin para los revisores nacen confirmadas; una cuenta registrada con un correo de la
  // lista, sin confirmarlo, no se salta la regla de distancia.
  const confirmada = await base(c)
    .prepare('SELECT 1 FROM usuarios WHERE correo = ? AND correo_confirmado_en IS NOT NULL')
    .bind(correo)
    .first();
  if (!confirmada) return false;
  const porVariable = (c.env.CORREOS_REVISOR ?? '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .includes(correo.toLowerCase());
  if (porVariable) return true;
  const fila = await base(c)
    .prepare('SELECT 1 FROM revisores WHERE correo = ?')
    .bind(correo)
    .first();
  return Boolean(fila);
}
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
  if (!p) {
    // C-FOTO-RECOGIDA-REPETIDA: la app reintenta la foto (corte de red, doble toque) y el pedido
    // ya salió con este repartidor: responde como la primera vez, sin escribir nada.
    const salio = await db
      .prepare("SELECT 1 FROM pedidos WHERE id = ? AND repartidor_id = ? AND estado = 'en_camino'")
      .bind(id, u.id)
      .first();
    if (salio)
      return c.json({ ok: true, salio: true, url: `/datos/pedidos/${id}/evidencia/recogida` });
    throw new ErrorDatos('El restaurante todavía no marcó el pedido como listo.', undefined, 409);
  }
  // Cobro directo: sin el pago de la comida registrado (monto, ticket, método), no sale.
  await exigirPagoLocal(db, id);
  const foto = await leerFoto(c);
  const rest = comoPunto(p.lat, p.lng);
  const metros = rest ? metrosEntre(foto.donde, rest) : null;
  if (lejos(metros) && !(await esRevisor(c, u.correo)))
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

/**
 * C-COBRO-DIRECTO-LOCAL: foto del ticket del restaurante (opcional), después de registrar el pago en el
 * local. Queda en el almacén privado; la ven el repartidor, el restaurante, el cliente y soporte.
 */
operacion.post('/repartidor/pedidos/:id/foto-ticket', async (c) => {
  const { u, db } = await miFicha(c);
  const id = c.req.param('id');
  const r = await db
    .prepare(
      "SELECT 1 FROM pagos_local l JOIN pedidos p ON p.id = l.pedido_id WHERE l.pedido_id = ? AND l.repartidor_id = ? AND p.estado IN ('aceptado','listo','en_camino')",
    )
    .bind(id, u.id)
    .first();
  if (!r)
    throw new ErrorDatos(
      'Primero registra lo que pagaste al restaurante y el importe del ticket.',
      undefined,
      409,
    );
  const foto = await leerFoto(c);
  const clave = `evidencias/${id}/ticket-${nuevoId()}`;
  await guardarFoto(foto.bucket, clave, foto.bytes, foto.tipo, {
    cacheControl: 'private, no-store',
  });
  const anterior = await db
    .prepare('SELECT ticket_clave FROM pagos_local WHERE pedido_id = ?')
    .bind(id)
    .first<{ ticket_clave: string | null }>();
  await db
    .prepare('UPDATE pagos_local SET ticket_clave = ? WHERE pedido_id = ?')
    .bind(clave, id)
    .run();
  // Si repitió la foto, la anterior no queda huérfana en el almacén.
  if (anterior?.ticket_clave) await foto.bucket.delete(anterior.ticket_clave);
  await anotarEvento(db, id, 'foto_ticket');
  return c.json({ ok: true, url: `/datos/pedidos/${id}/evidencia/ticket` });
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
      "SELECT id, estado FROM pedidos WHERE id = ? AND repartidor_id = ? AND estado IN ('listo','aceptado','en_camino')",
    )
    .bind(id, u.id)
    .first<{ id: string; estado: string }>();
  if (!p) throw new ErrorDatos('Este pedido no está contigo.', undefined, 409);
  const limpio = codigo.replace(/^tumbite:pedido:/i, '').trim();
  const correcto = limpio === p.id || limpio.toUpperCase() === p.id.slice(0, 4).toUpperCase();
  if (!correcto)
    throw new ErrorDatos(
      'Ese código no es de este pedido. Escanea el de la pantalla del restaurante.',
      'codigo',
      409,
    );
  // C-QR-UNA-VEZ: la cámara puede leer el código dos veces; si ya salió con él, es ok y no escribe.
  if (p.estado === 'en_camino') return c.json({ ok: true, correcto: true, salio: true });
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
  for (const para of await correosEquipo(c.env, 'pedidos'))
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
  if (!p) {
    // C-ENTREGA-REINTENTO (28 oct 2026, visto en el recorrido del sitio de pruebas): si la
    // respuesta se perdió y la app reintenta, el pedido ya está entregado por ESTE repartidor:
    // se responde igual que la primera vez, no con un error que lo hace dudar en la puerta.
    const ya = await db
      .prepare("SELECT 1 FROM pedidos WHERE id = ? AND repartidor_id = ? AND estado = 'entregado'")
      .bind(id, u.id)
      .first();
    if (ya)
      return c.json({ ok: true, yaEntregado: true, url: `/datos/pedidos/${id}/evidencia/entrega` });
    throw new ErrorDatos('Este pedido no está en camino contigo.', undefined, 409);
  }
  // Mayoría de edad: si algún plato lo exige, solo en mano y con el documento revisado.
  const requiereEdad = lineasConEdad(p);
  // En la puerta: con foto. En mano: sin foto (el cliente lo recibió). En lugar seguro: foto y nota,
  // después de avisar que el cliente no aparece y esperar 5 minutos.
  const esFoto = (c.req.header('content-type') ?? '').startsWith('image/');
  const modoPedido = String(c.req.query('modo') ?? '');
  // C-CLIENTE-AUSENTE: «el cliente no apareció» se cierra con una foto del lugar como constancia;
  // la comida no se deja (con PIN, con edad o en efectivo nunca se deja sin entregar).
  const ausente = esFoto && modoPedido === 'ausente';
  if (requiereEdad && esFoto && !ausente)
    throw new ErrorDatos(
      'Este pedido tiene productos para mayores de 21: entrégalo en mano y revisa el documento.',
      'edad',
      409,
    );
  let donde: { lat: number; lng: number };
  let modo: 'puerta' | 'mano' | 'seguro' | 'ausente';
  let nota = String(c.req.query('nota') ?? '')
    .trim()
    .slice(0, 300);
  let foto: Awaited<ReturnType<typeof leerFoto>> | null = null;
  if (esFoto) {
    // C-PIN-SIN-FOTO: la foto no salta el PIN; la de «no apareció» no entrega nada.
    if (!ausente) await sinFotoConPin(db, id);
    foto = await leerFoto(c);
    donde = foto.donde;
    modo = ausente ? 'ausente' : modoPedido === 'seguro' ? 'seguro' : 'puerta';
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
  if (lejos(metros) && !(await esRevisor(c, u.correo)))
    throw new ErrorDatos(
      'Todavía no llegas a la dirección de entrega. El botón se activa cuando estés en la puerta.',
      undefined,
      409,
    );
  // GPS serio: la llegada la confirman dos lecturas precisas (hito «llegó»), o soporte autorizó la
  // excepción «No puedo confirmar mi ubicación». Un punto suelto no alcanza.
  if (
    p.h_llego_cli == null &&
    p.excepcion_ubicacion !== 'autorizada' &&
    !(await esRevisor(c, u.correo))
  )
    throw new ErrorDatos(
      'Todavía no confirmamos tu ubicación en la puerta. Espera unos segundos con el GPS encendido o pide la excepción a soporte.',
      'gps',
      409,
    );
  // C-COBRO-DIRECTO: un pedido que se cobra en mano no se deja en un lugar seguro sin cobrar (como
  // los pedidos en efectivo de DoorDash). Si el cliente no aparece, el camino es «No pagó».
  if (modo === 'seguro' && esDirecto(String(p.metodo_pago ?? 'tarjeta')))
    throw new ErrorDatos(
      'Este pedido se cobra en mano: no se puede dejar sin entregarlo. Si el cliente no aparece, toca «El cliente no pagó».',
      undefined,
      409,
    );
  if (modo === 'ausente' && esDirecto(String(p.metodo_pago ?? 'tarjeta')))
    throw new ErrorDatos(
      'Este pedido se cobra en mano: si el cliente no aparece, toca «El cliente no pagó».',
      undefined,
      409,
    );
  if (modo === 'seguro' || modo === 'ausente') {
    const aviso = msDeBase(p.h_no_aparece);
    const espera = minutosEsperaAusente(c.env);
    if (aviso == null || Date.now() - aviso < espera * 60_000)
      throw new ErrorDatos(
        `Primero avisa que el cliente no aparece y espera ${espera} minutos.`,
        undefined,
        409,
      );
    if (modo === 'seguro' && !nota)
      throw new ErrorDatos('Escribe dónde dejaste el pedido.', 'nota', 422);
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
  // C-GANAR-POR-TIEMPO: en modo «por tiempo», lo que falte para la hora activa garantizada se
  // suma al bono del pedido (mismo camino que el pago pico; la conciliación ya lo cuenta).
  const porTiempo = await completarPorTiempo(
    db,
    id,
    u.id,
    Number(p.envio) + Number(p.complemento),
    Number(p.bono ?? 0),
    Number(p.distancia_km ?? 0),
  );
  // Lo que gana el repartidor: envío + complemento + el bono (oferta abierta, hora pico, por tiempo).
  const entrega = Number(p.envio) + Number(p.complemento) + Number(p.bono ?? 0) + porTiempo;
  try {
    await db.batch([
      sentenciaLiquidacion(db, id, pi, Number(p.total), inicial),
      db
        // Sin condición de estado A PROPÓSITO: si soporte canceló el pedido entre la lectura y este
        // lote, el disparador de transiciones rechaza cancelado → entregado y el lote ENTERO se
        // deshace (ni liquidación, ni abonos, ni puntos). Con «AND estado = 'en_camino'» el UPDATE
        // no cambiaba nada y el resto del lote abonaba igual.
        .prepare(
          "UPDATE pedidos SET estado = 'entregado', entregado_en = datetime('now') WHERE id = ?",
        )
        .bind(id),
      anotarEstado(db, id, 'entregado', u.id),
      // Fase 2 · cobro directo: el dinero nunca pasó por Divoox (el cliente le pagó al repartidor y
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
      // C-ANUNCIOS: si el pedido llegó desde un anuncio, se le cobra al restaurante al entregar.
      ...sentenciasCobroAnuncio(db, id, String(p.dueno_id), nuevoId()),
      db.prepare('UPDATE repartidores SET puntos = puntos + 10 WHERE usuario_id = ?').bind(u.id),
    ]);
  } catch (e) {
    if (esEntregaRepetida(e)) throw new ErrorDatos('Este pedido ya se entregó.', undefined, 409);
    if (String(e).includes('transicion_de_pedido_no_permitida'))
      throw new ErrorDatos('Este pedido ya cambió de estado.', undefined, 409);
    throw e;
  }
  // C-REFERIDOS: si era el primer pedido de un amigo invitado, quien lo invitó recibe su crédito.
  await premiarReferidoDelPedido(db, id).catch((e: unknown) =>
    console.error('referidos: crédito de quien invitó', id, e),
  );
  await liquidar(c.env, db, id).catch((e: unknown) =>
    console.error('entrega: el cobro queda para el reloj', id, e),
  );
  if (modo === 'ausente') await cerrarComoAusente(c.env, db, id, u, nota);
  else {
    await avisarAlCliente(c.env, db, c.req.param('id'), (i) => AVISOS.entregado(i));
    // C-CORREO-ENTREGA: el correo con la foto; si falla, la entrega ya quedó (queda en el canario).
    await correoDeEntrega(c.env, db, id).catch((e: unknown) =>
      console.error('correo de entrega', id, e),
    );
  }
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
  if (relojEnPausa(c.req.url)) return c.json({ ok: true, pausado: true });
  // Comparte el candado por minuto con el reloj nuevo (/datos/interno/reloj): si los dos llegan
  // en el mismo minuto, las tareas corren una sola vez (C-RELOJ-UNA-VEZ).
  return c.json(
    await correrRelojUnaVez(
      // Rewards (modo sombra) necesita saber en qué sitio corre el reloj: solo actúa en pruebas.
      { ...c.env, ENTORNO_RELOJ: entornoDe(c.req.url) } as Env,
      base(c),
      new Date().toISOString().slice(0, 16),
      'github',
    ),
  );
});

/**
 * La limpieza diaria corre en la primera vuelta del día desde las 04:00 UTC (LECT-3: antes solo en
 * la ventana exacta «AAAA-MM-DDT04:00», que con GitHub solo casi nunca caía).
 */
export const esVueltaDeLimpieza = (ventana: string, anterior?: string) =>
  esPrimeraDelDia(ventana, anterior ?? `${ventana.slice(0, 10)}T03:59`);

/** LECT-3: la fila de detalle de una vuelta (solo si falló, si escribió algo o es el latido). */
async function anotarVuelta(db: D1Database, clave: string, tarea: string, resultado: string) {
  await db
    .prepare(
      `INSERT INTO tareas_programadas (clave, tarea, terminada_en, resultado) VALUES (?, ?, datetime('now'), ?)
       ON CONFLICT(clave) DO UPDATE SET terminada_en = excluded.terminada_en, resultado = excluded.resultado`,
    )
    .bind(clave, tarea, resultado.slice(0, 2000))
    .run();
}

/**
 * Corre las tareas del reloj UNA vez por minuto, venga de donde venga (reloj actual de GitHub o
 * Worker externo). LECT-3 (13 nov 2026): el minuto se toma en UNA fila fija de `config` con una
 * sola sentencia atómica (`tomarMinuto`): el segundo que llega en el mismo minuto no corre nada.
 * Una vuelta ociosa escribe solo esa fila; la de `tareas_programadas` queda si falló, si sus
 * tareas escribieron algo, y una vez por hora (el latido).
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
  // C-RELOJ-UNA-VEZ: una escritura atómica por minuto en una sola fila. El segundo que llega en
  // ese minuto (GitHub o Cloudflare, o un reintento en otro aislado) no corre nada.
  const marcadas = await tomarMinuto(db, tarea, ventana, origen);
  if (!marcadas) return { ok: true as const, yaHecho: true as const, ventana };
  // La vuelta anterior: la más nueva de las marcadas que sea más vieja que esta.
  const anterior = marcadas.find((v) => v.ventana < ventana)?.ventana;
  const deLaHora = esPrimeraDeLaHora(ventana, anterior);
  // Las limpiezas que pueden esperar (cada: 'hora') corren solo en la primera vuelta de la hora.
  const tareas = (prueba?.tareas ?? TAREAS_RELOJ).filter((t) => t.cada !== 'hora' || deLaHora);
  let resultado: Awaited<ReturnType<typeof correrReloj>>;
  try {
    // C-RELOJ-AISLADO: cada tarea con su propio manejo de errores; esto ya no lanza por una tarea.
    resultado = await correrReloj(env, db, tareas);
    await anotarTareas(db, clave, resultado.vuelta);
  } catch (e) {
    console.error('reloj', origen, e);
    await anotarVuelta(db, clave, tarea, `origen:${origen} error`);
    throw e;
  }
  if (resultado.vuelta.fallidas.length || resultado.resumen.filas.escritas > 0 || deLaHora)
    await anotarVuelta(
      db,
      clave,
      tarea,
      `origen:${origen} ${resultado.vuelta.estado} ${JSON.stringify(resultado.resumen)}`,
    );
  // Las vueltas de diagnóstico (otra tarea: «reloj-diag», «reloj-f2») no hacen la limpieza.
  if (tarea !== 'reloj')
    return {
      ok: true as const,
      ...resultado.resumen,
      fallidas: resultado.vuelta.fallidas,
      ventana,
    };
  // Los sellos de las peticiones firmadas (anti-repetición de 10 minutos): una vez por hora basta.
  if (deLaHora)
    await db
      .prepare("DELETE FROM peticiones_internas WHERE recibida_en < datetime('now', '-10 minutes')")
      .run();
  // C-RELOJ-SOLO-FALLAS: la limpieza grande corre UNA vez al día (la primera vuelta desde las
  // 04:00 UTC), no en cada minuto. Cada borrado va por índice: reloj_tareas solo guarda fallas y su
  // índice parcial es de creado_en con ok = 0; las filas buenas que quedaron de antes, por tandas.
  if (esPrimeraDelDia(ventana, anterior)) {
    await db.batch([
      db.prepare("DELETE FROM tareas_programadas WHERE empezada_en < datetime('now', '-7 days')"),
      db.prepare(
        "DELETE FROM reloj_tareas WHERE ok = 0 AND creado_en < datetime('now', '-7 days')",
      ),
      db.prepare(
        'DELETE FROM reloj_tareas WHERE rowid IN (SELECT rowid FROM reloj_tareas WHERE ok = 1 LIMIT 50000)',
      ),
      db.prepare("DELETE FROM lotes_ubicacion WHERE recibido_en < datetime('now', '-7 days')"),
    ]);
  }
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
  // Divoox Rewards · Fase 2: reputación en MODO SOMBRA (solo en pruebas; en producción no hace nada).
  { nombre: 'rewards_sombra', critica: false, correr: (env, db) => correrSombra(env, db) },
  // C-AGOTADO-HOY: los platos agotados «por hoy» vuelven a la medianoche del restaurante.
  { nombre: 'platos_vuelven', critica: false, correr: (_env, db) => volverPlatosAgotados(db) },
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
  // C-CONCILIACION-ATOMICA: si la conciliación de un pedido en mano no corrió (se cortó la petición
  // de la entrega o del «Cobré»), el reloj la retoma. Es idempotente.
  {
    nombre: 'conciliacion_directa',
    critica: true,
    correr: async (_env, db) => {
      const { results } = await db
        .prepare(
          `SELECT id FROM pedidos WHERE metodo_pago != 'tarjeta' AND estado = 'entregado' AND conciliacion_estado = 'pendiente'
            AND cobro_estado IN ('confirmado', 'parcial', 'no_pagado') LIMIT 50`,
        )
        .all<{ id: string }>();
      let n = 0;
      for (const r of results) if (await conciliarPedidoDirecto(db, r.id)) n++;
      return n;
    },
  },
  // Sesiones vencidas: no sirven para entrar (se valida el vencimiento), pero se borran para que la
  // tabla no crezca sin fin.
  // LECT-3: una vez por hora (recorre la tabla de sesiones: no tiene índice por vencimiento). Como
  // mucho 500 filas borradas por vuelta.
  {
    nombre: 'sesiones_vencidas',
    critica: false,
    cada: 'hora',
    escriturasEsperadas: 500,
    correr: async (_env, db) => {
      const r = await db
        .prepare(
          "DELETE FROM sesiones WHERE rowid IN (SELECT rowid FROM sesiones WHERE expira_en < datetime('now', '-1 day') LIMIT 500)",
        )
        .run();
      return Number(r.meta.changes ?? 0);
    },
  },
  // Retención de fotos (30 días). Puede esperar: no es crítica.
  // Pausa sin señal (C-PAUSA-SIN-SENAL): solo avisa. La pausa misma se calcula al leer, así que
  // si esta tarea falla, los clientes igual no pueden pedir a una tienda sin señal.
  { nombre: 'pausa_sin_senal', critica: false, correr: (env, db) => pausarSinSenal(env, db) },
  // LECT-3: la retención de fotos (evidencias y tickets de 30 días) una vez por hora: recorre
  // `evidencias` hasta encontrar las viejas. Como mucho 200 evidencias y 200 tickets por vuelta.
  {
    nombre: 'fotos',
    critica: false,
    cada: 'hora',
    escriturasEsperadas: 400,
    correr: (env, db) => (env.BUCKET ? depurarFotos(db, env.BUCKET) : Promise.resolve(0)),
  },
  // Divoox Flex · Fase 3: ofertas vencidas, avisos por vencer, integraciones y limpieza (mismo reloj).
  ...TAREAS_FLEX,
  // Flex · Fase 4: conciliación y recuperación de las billeteras, recarga automática y alertas.
  ...TAREAS_FINANZAS,
];

export async function correrReloj(
  env: Env,
  db: D1Database,
  tareas: readonly TareaReloj[] = TAREAS_RELOJ,
) {
  // C-PRESUPUESTO-FILAS: las tareas usan la base envuelta que cuenta filas; si la vuelta pasa
  // del tope, las que faltan no corren y la vuelta queda con «presupuesto» fallida.
  const contada = contarFilas(db);
  const vuelta = await correrTareas(env, contada.db, tareas, Date.now, () =>
    pasoDelTope(contada.cuenta, PRESUPUESTO_VUELTA_RELOJ),
  );
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
    // C-RELOJ-OCIOSO-SIN-ESCRITURAS: lo que leyeron y escribieron las tareas en esta vuelta. Queda
    // en tareas_programadas.resultado (la misma fila que ya se actualiza: no cuesta una escritura).
    filas: { leidas: contada.cuenta.leidas, escritas: contada.cuenta.escritas },
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
      `SELECT p.*, ${CON_EVIDENCIAS}, ${CON_HITOS}, ${CON_AJUSTE}, r.nombre AS restaurante_nombre, r.dueno_id, r.lat AS rest_lat, r.lng AS rest_lng, ur.nombre AS repartidor_nombre, d.lat AS rep_lat, d.lng AS rep_lng, d.ubicacion_en AS rep_en,
        (SELECT 1 FROM kyc k WHERE k.usuario_id = p.repartidor_id AND k.estado = 'aprobado' AND k.selfie IS NOT NULL) AS rep_foto,
        (SELECT a.auditiva FROM accesibilidad_repartidor a WHERE a.usuario_id = p.repartidor_id) AS rep_auditiva
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
  // C-SEGUIMIENTO-HONESTO: la misma cuenta que el enlace compartido (pieza compartida).
  const { minutosEstimados, llegaAMasTardar } = estimacionLlegada({
    estado: String(f.estado),
    tiempoPrepMin: f.tiempo_prep_min == null ? null : Number(f.tiempo_prep_min),
    aceptadoMs: msDeBase(f.aceptado_en),
    restaurante: rest,
    casa,
    repartidor: repLat != null && repLng != null ? { lat: repLat, lng: repLng } : null,
  });
  const llegadaRango = rangoLlegada(Date.now(), minutosEstimados, llegaAMasTardar);
  const haceSegundos = enRuta ? segundosDesde(f.rep_en as string | null) : null;
  return c.json({
    pedido: {
      ...aPedido(f),
      historial,
      motivoCancelacion,
      restaurante: rest,
      minutosEstimados,
      llegaAMasTardar,
      llegadaRango,
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
            haceSegundos,
            senalPerdida: senalPerdida(haceSegundos),
            llegaEn5: f.h_llega5 != null,
            casiLlega: f.h_casi != null,
            llego: f.h_llego_cli != null,
            // C-FOTO-VERIFICADA: la foto aprobada contra su documento (como el perfil de Uber).
            foto: f.rep_foto ? `/datos/pedidos/${String(f.id)}/repartidor/foto` : null,
            // C-AUDITIVA-REPARTIDOR: el cliente le escribe por el chat en vez de llamarlo.
            dificultadAuditiva: Number(f.rep_auditiva ?? 0) === 1,
          }
        : null,
    },
  });
});

/**
 * Llamada con número oculto: el repartidor o el cliente de un pedido en marcha toca «Llamar»;
 * Twilio lo llama a él primero y, al contestar, marca al otro. Los dos ven el número de Divoox.
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
      ...sentenciasCobroAnuncio(db, id, dueno, nuevoId()),
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
  // C-REFERIDOS: si era el primer pedido de un amigo invitado, quien lo invitó recibe su crédito.
  await premiarReferidoDelPedido(db, id).catch((e: unknown) =>
    console.error('referidos: crédito de quien invitó', id, e),
  );
  await liquidar(c.env, db, id).catch((e: unknown) =>
    console.error('recogida: el cobro queda para el reloj', id, e),
  );
  await avisarAlCliente(c.env, db, id, (i) => AVISOS.entregado(i));
  return c.json({ ok: true });
});

/** El puente de Twilio: con el pase válido, marca al otro número con el de Divoox como remitente. */
// F9: la llamada pide GET, pero se acepta también POST (el método por defecto de Twilio).
operacion.on(['GET', 'POST'], '/twilio/puente', async (c) => {
  const a = await abrirPase(c.env, c.req.query('t') ?? '');
  if (!a || !c.env.TWILIO_FROM) throw new ErrorDatos('No encontrado.', undefined, 404);
  return c.body(twimlPuente(a, c.env.TWILIO_FROM), 200, { 'content-type': 'text/xml' });
});

/**
 * C-CLIENTE-AUSENTE: el pedido se cerró como «cliente no apareció». El dinero siguió el camino de
 * una entrega (el cliente paga, sin reembolso automático; el repartidor y el restaurante cobran lo
 * suyo, como en DoorDash y Uber Eats). Aquí: la bitácora, el aviso al cliente y el caso
 * para soporte (si el cliente reclama, soporte decide con la foto y la hora de cada paso).
 */
async function cerrarComoAusente(
  env: Env,
  db: D1Database,
  id: string,
  rep: { id: string; nombre: string; correo: string; idioma?: string },
  nota: string,
) {
  // La constancia es la evidencia (modo «ausente», con foto); el evento queda en la bitácora.
  await anotarEvento(db, id, 'cliente_ausente', nota);
  await avisarAlCliente(env, db, id, (i) => AVISOS.clienteAusente(i), 'cliente_ausente');
  const codigo = id.slice(0, 4).toUpperCase();
  await crearTicket(env, db, {
    tipo: 'soporte',
    nombre: `${rep.nombre} (repartidor)`,
    correo: rep.correo,
    idioma: rep.idioma === 'en' ? 'en' : 'es',
    asunto: `Cliente no apareció · pedido ${codigo}`,
    mensaje: [
      `El repartidor cerró el pedido ${codigo} como «cliente no apareció» después de avisar y esperar en la puerta.`,
      'Hay foto del lugar como constancia. El cliente pagó y el repartidor y el restaurante cobraron lo suyo.',
      nota ? `Nota del repartidor: ${nota}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    usuarioId: rep.id,
    pedidoId: id,
  }).catch((e: unknown) => console.error('cliente ausente: caso de soporte', id, e));
}

/** El cliente no aparece: el repartidor avisa desde la puerta; pasada la espera puede dejarlo en lugar seguro o, con PIN, cerrar como «cliente no apareció». */
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
  const minutos = minutosEsperaAusente(c.env);
  const hasta = (msDeBase(desde) ?? Date.now()) + minutos * 60_000;
  return c.json({ ok: true, esperaHasta: new Date(hasta).toISOString(), minutos });
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
      'SELECT m.id, m.de_usuario_id AS de, u.nombre, m.texto, m.creado_en AS en, m.foto_clave FROM mensajes_pedido m JOIN usuarios u ON u.id = m.de_usuario_id WHERE m.pedido_id = ? AND m.id > ? ORDER BY m.id LIMIT 200',
    )
    .bind(p.id, desde)
    .all<{
      id: number;
      de: string;
      nombre: string;
      texto: string;
      en: string;
      foto_clave: string | null;
    }>();
  return c.json({
    abierto: ['aceptado', 'listo', 'en_camino'].includes(p.estado) && !!p.repartidor_id,
    mensajes: results.map(({ foto_clave, ...m }) => ({
      ...m,
      nombre: m.nombre.split(' ')[0],
      mio: m.de === u.id,
      ...(foto_clave ? { foto: true } : {}),
    })),
  });
});

/**
 * C-CHAT-FOTOS (como Instacart): una foto en el chat del pedido, para mostrar un reemplazo o dónde
 * dejar el pedido. Privada (chat/<pedido>/…): solo la ven los del pedido y soporte.
 */
operacion.post('/pedidos/:id/mensajes/foto', async (c) => {
  const u = exigir(c, 'cliente', 'repartidor');
  const db = base(c);
  const p = await pedidoDelChat(db, c.req.param('id'), u);
  if (!['aceptado', 'listo', 'en_camino'].includes(p.estado) || !p.repartidor_id)
    throw new ErrorDatos('Este pedido ya no está activo: el chat se cerró.', undefined, 409);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength === 0) throw new ErrorDatos('No llegó ninguna foto.', 'foto', 400);
  if (bytes.byteLength > MAX_FOTO_BYTES)
    throw new ErrorDatos('La foto pesa demasiado. El máximo es 3 MB.', 'foto', 413);
  const tipo = tipoReal(bytes);
  if (!tipo) throw new ErrorDatos('Sube una foto en JPG, PNG o WebP.', 'foto', 415);
  if (!c.env.BUCKET)
    throw new ErrorDatos(
      'El almacén no está disponible en este momento. Intenta más tarde.',
      undefined,
      503,
    );
  const clave = `chat/${p.id}/${nuevoId()}`;
  await guardarFoto(c.env.BUCKET, clave, bytes, tipo, { cacheControl: 'private, no-store' });
  await db
    .prepare(
      "INSERT INTO mensajes_pedido (pedido_id, de_usuario_id, texto, foto_clave) VALUES (?, ?, '', ?)",
    )
    .bind(p.id, u.id, clave)
    .run();
  const para = u.id === p.cliente_id ? p.repartidor_id : p.cliente_id;
  const destino = await db
    .prepare('SELECT idioma FROM usuarios WHERE id = ?')
    .bind(para)
    .first<{ idioma: string }>();
  const en = destino?.idioma === 'en';
  await notificar(c.env, db, para, {
    ...AVISOS.mensaje(en ? 'en' : 'es', u.nombre.split(' ')[0] ?? '', en ? 'Photo' : 'Foto'),
    datos: { pedidoId: p.id },
  });
  return c.json({ ok: true }, 201);
});

operacion.get('/pedidos/:id/mensajes/:mid/foto', async (c) => {
  const u = exigir(c);
  const db = base(c);
  const p = await pedidoDelChat(db, c.req.param('id'), u).catch(() => null);
  if (!p || !c.env.BUCKET) return c.text('No encontrado', 404);
  const f = await db
    .prepare('SELECT foto_clave FROM mensajes_pedido WHERE id = ? AND pedido_id = ?')
    .bind(Number(c.req.param('mid')), p.id)
    .first<{ foto_clave: string | null }>();
  if (!f?.foto_clave) return c.text('No encontrado', 404);
  const obj = await c.env.BUCKET.get(f.foto_clave);
  if (!obj) return c.text('No encontrado', 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(obj.body, { headers });
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

/** La foto de la recogida, de la entrega o del ticket: el cliente, el restaurante (dueño y su equipo), el repartidor y soporte. */
/**
 * C-CORREO-ENTREGA: la foto de una entrega por su enlace propio (el del correo), sin sesión. Vence
 * a los 7 días; un enlace inventado o vencido da «no encontrado».
 */
operacion.get('/entregas/foto/:token', async (c) => {
  const token = c.req.param('token');
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token) || !c.env.BUCKET) return c.text('No encontrado', 404);
  const f = await base(c)
    .prepare(
      `SELECT e.clave FROM fotos_entrega_publicas t JOIN evidencias e ON e.pedido_id = t.pedido_id AND e.tipo = 'entrega'
        WHERE t.token = ? AND t.creado_en > datetime('now', ?) AND e.clave <> ''`,
    )
    .bind(token, `-${DIAS_FOTO_ENTREGA} days`)
    .first<{ clave: string }>();
  if (!f) return c.text('No encontrado', 404);
  const obj = await c.env.BUCKET.get(f.clave);
  if (!obj) return c.text('No encontrado', 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('cache-control', 'private, max-age=3600');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-robots-tag', 'noindex, nofollow');
  return new Response(obj.body, { headers });
});

operacion.get('/pedidos/:id/evidencia/:tipo', async (c) => {
  const u = exigir(c);
  const tipo = c.req.param('tipo');
  if (tipo !== 'recogida' && tipo !== 'entrega' && tipo !== 'ticket')
    return c.text('No encontrado', 404);
  const f = await base(c)
    .prepare(
      tipo === 'ticket'
        ? 'SELECT l.ticket_clave AS clave, p.cliente_id, p.repartidor_id, r.dueno_id, (SELECT 1 FROM miembros_restaurante mr WHERE mr.restaurante_id = r.id AND mr.usuario_id = ?) AS miembro FROM pagos_local l JOIN pedidos p ON p.id = l.pedido_id JOIN restaurantes r ON r.id = p.restaurante_id WHERE l.pedido_id = ? AND l.ticket_clave IS NOT NULL'
        : 'SELECT e.clave, p.cliente_id, p.repartidor_id, r.dueno_id, (SELECT 1 FROM miembros_restaurante mr WHERE mr.restaurante_id = r.id AND mr.usuario_id = ?) AS miembro FROM evidencias e JOIN pedidos p ON p.id = e.pedido_id JOIN restaurantes r ON r.id = p.restaurante_id WHERE e.pedido_id = ? AND e.tipo = ?',
    )
    .bind(...(tipo === 'ticket' ? [u.id, c.req.param('id')] : [u.id, c.req.param('id'), tipo]))
    .first<{
      clave: string;
      cliente_id: string;
      repartidor_id: string | null;
      dueno_id: string;
      miembro: number | null;
    }>();
  // También el equipo del restaurante (manager o staff), que opera los pedidos igual que el dueño.
  const puede =
    f &&
    (u.rol === 'admin' ||
      [f.cliente_id, f.repartidor_id, f.dueno_id].includes(u.id) ||
      (u.rol === 'restaurante' && f.miembro === 1));
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
      // C-GUSTO-PLATOS: pulgar arriba o abajo por cada plato del pedido (opcional).
      platos: z
        .array(z.object({ platoId: z.string().min(1).max(80), gusta: z.boolean() }))
        .max(50)
        .default([]),
      // C-ELOGIOS-MOTIVOS: elogios (5 estrellas) o motivos (3 o menos) ya escritos, por código.
      etiquetasRestaurante: z.array(z.string().min(1).max(40)).max(12).default([]),
      etiquetasRepartidor: z.array(z.string().min(1).max(40)).max(12).default([]),
    }),
  );
  const db = base(c);
  const p = await db
    .prepare(
      "SELECT restaurante_id, repartidor_id, lineas_json FROM pedidos WHERE id = ? AND cliente_id = ? AND estado = 'entregado'",
    )
    .bind(c.req.param('id'), u.id)
    .first<{ restaurante_id: string; repartidor_id: string | null; lineas_json: string }>();
  if (!p) throw new ErrorDatos('Solo se califican pedidos entregados.', undefined, 409);
  await db
    .prepare(
      // Actualizar sin borrar la fila: la respuesta del restaurante y la fecha original se conservan.
      `INSERT INTO calificaciones (pedido_id, estrellas_restaurante, estrellas_repartidor, culpa_restaurante, comentario) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(pedido_id) DO UPDATE SET estrellas_restaurante = excluded.estrellas_restaurante, estrellas_repartidor = excluded.estrellas_repartidor,
       culpa_restaurante = excluded.culpa_restaurante, comentario = excluded.comentario`,
    )
    .bind(
      c.req.param('id'),
      d.estrellasRestaurante,
      d.estrellasRepartidor,
      d.culpaRestaurante ? 1 : 0,
      d.comentario,
    )
    .run();
  // Solo cuentan los platos que estaban en este pedido; calificar otra vez reemplaza los votos.
  const delPedido = platosDelPedido(String(p.lineas_json ?? '[]'));
  const votos = d.platos.filter((x) => delPedido.has(x.platoId));
  if (d.platos.length)
    await db.batch([
      db.prepare('DELETE FROM calificaciones_platos WHERE pedido_id = ?').bind(c.req.param('id')),
      ...votos.map((v) =>
        db
          .prepare(
            'INSERT INTO calificaciones_platos (pedido_id, plato_id, restaurante_id, gusta) VALUES (?, ?, ?, ?)',
          )
          .bind(c.req.param('id'), v.platoId, p.restaurante_id, v.gusta ? 1 : 0),
      ),
    ]);
  // C-ELOGIOS-MOTIVOS: solo las del tipo que tocan las estrellas; calificar otra vez las reemplaza.
  const etiquetas = [
    ...etiquetasValidas('restaurante', d.estrellasRestaurante, d.etiquetasRestaurante).map((x) => ({
      ...x,
      para: 'restaurante',
    })),
    ...(p.repartidor_id
      ? etiquetasValidas('repartidor', d.estrellasRepartidor, d.etiquetasRepartidor).map((x) => ({
          ...x,
          para: 'repartidor',
        }))
      : []),
  ];
  await db.batch([
    db.prepare('DELETE FROM calificaciones_etiquetas WHERE pedido_id = ?').bind(c.req.param('id')),
    ...etiquetas.map((x) =>
      db
        .prepare(
          'INSERT INTO calificaciones_etiquetas (pedido_id, para, tipo, etiqueta, repartidor_id, restaurante_id) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(
          c.req.param('id'),
          x.para,
          x.tipo,
          x.etiqueta,
          p.repartidor_id ?? null,
          p.restaurante_id,
        ),
    ),
  ]);
  return c.json({ ok: true });
});
